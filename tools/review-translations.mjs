#!/usr/bin/env node
/**
 * Reviews finished translations against the English source with a model and
 * writes a Markdown report of the questionable strings. It never edits the
 * dictionary: fixes go through `dictionary/overrides.json` after a human look.
 *
 * Providers are the same as in `tools/translate-batches.mjs`: `mock` (tests),
 * `command` (external program) and `openai` (any OpenAI-compatible endpoint).
 *
 * Usage:
 *   node tools/review-translations.mjs --provider openai --model deepseek-chat \
 *     --api-key-env DEEPSEEK_API_KEY [--namespaces stats,forgePanel] [--limit 200]
 *   node tools/review-translations.mjs --provider mock --dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'
import { createProvider, parseJsonArray } from './lib/translate-providers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option, flag } = createArgs()
const root = resolve(option('root', resolve(here, '..')))
const providerName = option('provider', 'mock')
const batchSize = Math.max(1, Number(option('batch-size', 20)))
const limit = Number(option('limit', '0')) || Number.POSITIVE_INFINITY
const dryRun = flag('dry-run')
const failOnIssues = flag('fail-on-issues')
const outPath = resolve(root, option('out', 'reports/review.md'))
const namespaceFilter = (option('namespaces', '') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)

/** Reads a JSON file, or an empty object when it is absent. */
function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
}

/** Collects English → Russian pairs that are worth reviewing. */
function loadPairs() {
  const dictionary = readJson(resolve(root, 'dictionary/ru.json'))
  const inventory = readJson(resolve(root, 'strings/inventory.json'))
  const pairs = []
  for (const [namespace, keys] of Object.entries(dictionary)) {
    if (namespaceFilter.length > 0 && !namespaceFilter.includes(namespace)) continue
    for (const [key, translated] of Object.entries(keys)) {
      const en = inventory.namespaces?.[namespace]?.keys?.[key]?.en
      if (typeof en !== 'string' || typeof translated !== 'string') continue
      pairs.push({ namespace, key, en, ru: translated })
    }
  }
  return pairs.slice(0, limit)
}

/** The reviewer prompt: what counts as a problem. */
function reviewPrompt() {
  const glossary = readFileSync(resolve(root, 'GLOSSARY.md'), 'utf8')
    .split('\n')
    .filter((line) => /^\| .* \| .* \|/.test(line) && !/^\|\s*(Английский|Английское)/.test(line))
    .slice(0, 160)
    .join('\n')
  return [
    'Ты рецензент русской локализации интерфейса DeepSeek Harness. На вход приходит JSON-массив пар: key, en, ru.',
    'Для каждой пары реши, есть ли проблема перевода. Проблемой считается:',
    'искажение смысла; нарушение глоссария или терминологии; неестественная или двусмысленная формулировка;',
    'потерянный или лишний плейсхолдер {name}; перевод служебных имён (пакеты, команды, модели, бренды);',
    'слишком длинный текст для подписи интерфейса; пропущенная «ё» там, где она пишется.',
    'Верни ТОЛЬКО JSON-массив объектов в том же порядке и той же длины, что и вход:',
    '[{"index": 0, "issue": null}] — если всё хорошо, или',
    '[{"index": 0, "issue": "кратко, что не так", "suggestion": "предлагаемый вариант"}] — если есть проблема.',
    'Не придирайся к стилю без причины: если перевод верный и естественный, issue должен быть null.',
    '',
    'Глоссарий:',
    glossary,
  ].join('\n')
}

/** Splits pairs into groups, asks the provider, and collects the verdicts. */
async function reviewAll(provider, pairs) {
  const issues = []
  for (let index = 0; index < pairs.length; index += batchSize) {
    const group = pairs.slice(index, index + batchSize)
    const payload = group.map((pair, offset) => ({ index: offset, key: pair.key, en: pair.en, ru: pair.ru }))
    const verdicts = parseJsonArray(await provider.complete(reviewPrompt(), payload))
    if (verdicts.length !== group.length) {
      throw new Error(`провайдер вернул ${verdicts.length} вердиктов на ${group.length} строк`)
    }
    for (const [offset, verdict] of verdicts.entries()) {
      const pair = group[offset]
      const issue = typeof verdict?.issue === 'string' ? verdict.issue.trim() : ''
      if (issue.length === 0) continue
      issues.push({
        ...pair,
        issue,
        suggestion: typeof verdict.suggestion === 'string' ? verdict.suggestion.trim() : '',
      })
    }
  }
  return issues
}

/** Renders the Markdown report. */
function renderReport(issues, total) {
  const lines = ['# Вычитка перевода', '', `Проверено строк: ${total}. Замечаний: ${issues.length}.`, '']
  if (issues.length === 0) {
    lines.push('Замечаний нет.')
    return `${lines.join('\n')}\n`
  }
  lines.push('| Namespace / ключ | Английский | Русский | Замечание | Предложение |')
  lines.push('|---|---|---|---|---|')
  for (const issue of issues) {
    const cell = (text) => String(text).replace(/\|/gu, '\\|').replace(/\n/gu, ' ')
    lines.push(`| \`${issue.namespace}/${issue.key}\` | ${cell(issue.en)} | ${cell(issue.ru)} | ${cell(issue.issue)} | ${cell(issue.suggestion)} |`)
  }
  return `${lines.join('\n')}\n`
}

/** Entry point: load pairs, review, report. */
async function main() {
  const provider = createProvider({
    name: providerName,
    command: option('command'),
    baseUrl: option('base-url'),
    model: option('model'),
    apiKeyEnv: option('api-key-env'),
    mockResponse: (payload) => payload.map(() => ({ index: 0, issue: null })),
  })
  const pairs = loadPairs()
  if (pairs.length === 0) {
    console.log('нечего проверять: пары не найдены (проверьте --namespaces и dictionary/ru.json)')
    return
  }
  console.log(`провайдер: ${provider.id} | строк: ${pairs.length} | группы по ${batchSize}`)
  const issues = await reviewAll(provider, pairs)
  const report = renderReport(issues, pairs.length)
  if (dryRun) {
    console.log(report)
    return
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, report)
  console.log(`замечаний: ${issues.length} из ${pairs.length}`)
  console.log(`отчёт: ${outPath.replace(`${root}/`, '')}`)
  if (issues.length > 0) {
    for (const issue of issues.slice(0, 10)) console.log(`  ! ${issue.namespace}/${issue.key}: ${issue.issue}`)
    if (failOnIssues) process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
