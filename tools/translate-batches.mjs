#!/usr/bin/env node
/**
 * Translates the delta batches produced by `npm run refresh` with a pluggable
 * provider, then validates the result structurally and leaves the rest to the
 * usual gates (`npm run lint`, `npm test`, review).
 *
 * The tool never invents keys: it reads `batches/manifest.json` (interface copy)
 * and `batches/plugin-manifest.json` (plugin display metadata), sends the
 * untranslated items to the provider in small groups, and writes
 * `translations/<next-free-id>.json` files in the repository format.
 *
 * Providers:
 *   mock     — deterministic fake translation, used by the tests;
 *   command  — an external program: JSON request on stdin, JSON answer on stdout;
 *   openai   — an OpenAI-compatible chat-completions endpoint (DeepSeek API,
 *              Ollama, LM Studio, OpenRouter): the model returns one string per item.
 *
 * Usage:
 *   node tools/translate-batches.mjs --provider openai \
 *     --base-url https://api.deepseek.com/v1 --model deepseek-chat \
 *     --api-key-env DEEPSEEK_API_KEY [--limit 50] [--namespaces chat,settings]
 *   node tools/translate-batches.mjs --provider mock --dry-run
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option, flag } = createArgs()
// `--root` lets the tests (and the language-pack template) point the tool at a
// different checkout; by default it works on this repository.
const root = resolve(option('root', resolve(here, '..')))

const providerName = option('provider', 'mock')
const batchSize = Math.max(1, Number(option('batch-size', 20)))
const limit = Number(option('limit', '0')) || Number.POSITIVE_INFINITY
const dryRun = flag('dry-run')
const outDir = resolve(root, option('out', 'translations'))
const namespaceFilter = (option('namespaces', '') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)

/** Placeholders of a template, sorted; used to reject a lost parameter. */
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')

/** Reads a JSON file, or undefined when it does not exist. */
function readJson(path) {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Loads untranslated items from both manifests. */
function loadItems() {
  const items = []
  const uiManifest = readJson(resolve(root, 'batches/manifest.json'))
  for (const batch of uiManifest?.batches ?? []) {
    const file = readJson(resolve(root, 'batches', batch.file))
    for (const item of file?.items ?? []) {
      if (namespaceFilter.length > 0 && !namespaceFilter.includes(item.namespace)) continue
      items.push({ kind: 'ui', namespace: item.namespace, key: item.key, en: item.en, context: item.context })
    }
  }
  const pluginManifest = readJson(resolve(root, 'batches/plugin-manifest.json'))
  for (const batch of pluginManifest?.batches ?? []) {
    const file = readJson(resolve(root, 'batches', batch.file))
    for (const item of file?.items ?? []) {
      items.push({ kind: 'plugin', en: item.en, packages: item.packages ?? [] })
    }
  }
  return items.slice(0, limit)
}

/** The translation contract every provider implements. */
function mockProvider() {
  return {
    id: 'mock',
    async translate(items) {
      return items.map((item) => `Перевод: ${item.en}`)
    },
  }
}

/** An external command: JSON in on stdin, JSON array of strings out on stdout. */
function commandProvider(command) {
  return {
    id: `command:${command}`,
    async translate(items) {
      const request = JSON.stringify({ items: items.map((item) => ({ en: item.en, context: item.context })) })
      const result = spawnSync(command, { shell: true, input: request, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      if (result.error !== undefined) throw new Error(`провайдер не запустился: ${result.error.message}`)
      if (result.status !== 0) throw new Error(`провайдер завершился с кодом ${result.status}: ${result.stderr.slice(0, 500)}`)
      return parseAnswers(result.stdout)
    },
  }
}

/** OpenAI-compatible chat completions: one translated string per item. */
function openaiProvider() {
  const baseUrl = (option('base-url', 'https://api.deepseek.com/v1') ?? '').replace(/\/+$/, '')
  const model = option('model', 'deepseek-chat')
  const apiKeyEnv = option('api-key-env', 'DEEPSEEK_API_KEY')
  const apiKey = process.env[apiKeyEnv]
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(`провайдер openai требует ключ в переменной ${apiKeyEnv}`)
  }
  return {
    id: `openai:${model}`,
    async translate(items) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt() },
            {
              role: 'user',
              content: JSON.stringify(items.map((item) => ({ key: item.key ?? item.en.slice(0, 40), en: item.en, context: item.context }))),
            },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`провайдер ответил HTTP ${response.status}: ${body.slice(0, 300)}`)
      }
      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      if (typeof content !== 'string') throw new Error('в ответе провайдера нет текста перевода')
      return parseAnswers(content)
    },
  }
}

/** The glossary and the rules that matter for a batch translation. */
function systemPrompt() {
  const glossary = readFileSync(resolve(root, 'GLOSSARY.md'), 'utf8')
    .split('\n')
    .filter((line) => /^\| .* \| .* \|/.test(line) && !/^\|\s*(Английский|Английское)/.test(line))
    .slice(0, 160)
    .join('\n')
  const style = readFileSync(resolve(root, 'STYLE.md'), 'utf8').slice(0, 4000)
  return [
    'Ты переводишь интерфейс DeepSeek Harness на русский язык. Верни ТОЛЬКО JSON-массив строк в том же порядке и той же длины, что и вход.',
    'Правила: сохраняй все плейсхолдеры вида {name} без изменений; не переводи имена пакетов, команд, моделей, провайдеров и брендов;',
    'пиши кратко, как в интерфейсе; используй терминологию глоссария; ё — только в словах, где она пишется; не добавляй пояснений и кавычек вокруг строк.',
    '',
    'Глоссарий:',
    glossary,
    '',
    'Правила стиля:',
    style,
  ].join('\n')
}

/** Parses a provider answer: JSON array of strings, tolerating code fences. */
function parseAnswers(raw) {
  const text = String(raw).trim().replace(/^```(?:json)?/u, '').replace(/```$/u, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error(`провайдер вернул не JSON-массив: ${text.slice(0, 300)}`)
  const parsed = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('провайдер вернул не массив')
  return parsed.map((value) => (typeof value === 'string' ? value : String(value ?? '')))
}

/** Next free numeric id for a prefix: p3-025 → p3-026, plugin-07 → plugin-08. */
function nextFreeId(prefix, width) {
  const used = readdirSync(outDir)
    .map((name) => new RegExp(`^${prefix}-(\\d+)\\.json$`, 'u').exec(name))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]))
  const next = used.length === 0 ? 1 : Math.max(...used) + 1
  return `${prefix}-${String(next).padStart(width, '0')}`
}

/** Structural checks every answer must pass before it is written. */
function validate(item, translated) {
  const problems = []
  if (typeof translated !== 'string' || translated.trim().length === 0) problems.push('пустой перевод')
  if (translated.includes('\n')) problems.push('перевод содержит перевод строки')
  const expected = placeholders(item.en)
  const actual = placeholders(translated)
  if (expected !== actual) problems.push(`плейсхолдеры: ожидались {${expected}}, получены {${actual}}`)
  if (translated === item.en && /[A-Za-z]{4,}/.test(item.en)) problems.push('перевод совпадает с английским')
  if (translated.length > item.en.length * 3 + 40) problems.push('перевод заметно длиннее оригинала')
  return problems
}

/** Translates items in groups, collecting answers and problems. */
async function translateAll(provider, items) {
  const translated = []
  const problems = []
  for (let index = 0; index < items.length; index += batchSize) {
    const group = items.slice(index, index + batchSize)
    const answers = await provider.translate(group)
    if (answers.length !== group.length) {
      throw new Error(`провайдер вернул ${answers.length} строк на ${group.length} элементов`)
    }
    for (const [offset, item] of group.entries()) {
      const answer = answers[offset]
      const itemProblems = validate(item, answer)
      if (itemProblems.length > 0) {
        problems.push({ item, answer, problems: itemProblems })
        continue
      }
      translated.push({ ...item, ru: answer.trim() })
    }
  }
  return { translated, problems }
}

/** Writes one translation file per interface namespace and one for metadata. */
function writeTranslations(translated) {
  mkdirSync(outDir, { recursive: true })
  const written = []
  const byNamespace = new Map()
  const pluginItems = []
  for (const item of translated) {
    if (item.kind === 'plugin') {
      pluginItems.push(item)
      continue
    }
    const list = byNamespace.get(item.namespace) ?? []
    list.push(item)
    byNamespace.set(item.namespace, list)
  }
  for (const [namespace, items] of byNamespace) {
    const id = nextFreeId('p3', 3)
    const data = { id, namespace, translations: Object.fromEntries(items.map((item) => [item.key, item.ru])) }
    const path = join(outDir, `${id}.json`)
    if (!dryRun) writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
    written.push(path)
  }
  if (pluginItems.length > 0) {
    const id = nextFreeId('plugin', 2)
    const data = { id, kind: 'plugin-meta', translations: Object.fromEntries(pluginItems.map((item) => [item.en, item.ru])) }
    const path = join(outDir, `${id}.json`)
    if (!dryRun) writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
    written.push(path)
  }
  return written
}

/** Entry point: load, translate, validate, write, report. */
async function main() {
  const provider = providerName === 'mock'
    ? mockProvider()
    : providerName === 'command'
      ? commandProvider(option('command', ''))
      : providerName === 'openai'
        ? openaiProvider()
        : (() => { throw new Error(`неизвестный провайдер: ${providerName}`) })()

  const items = loadItems()
  if (items.length === 0) {
    console.log('нечего переводить: дельта пуста (запустите npm run refresh после обновления DSH)')
    return
  }
  console.log(`провайдер: ${provider.id} | элементов: ${items.length} | группы по ${batchSize}`)
  const { translated, problems } = await translateAll(provider, items)
  const written = writeTranslations(translated)

  for (const problem of problems) {
    console.warn(`  ! ${problem.item.namespace ?? 'plugin'}/${problem.item.key ?? problem.item.en.slice(0, 40)}: ${problem.problems.join('; ')}`)
  }
  console.log(`\nпереведено: ${translated.length}/${items.length}${dryRun ? ' (dry-run, файлы не записаны)' : ''}`)
  for (const path of written) console.log(`  записан ${path.replace(`${root}/`, '')}`)
  if (problems.length > 0) {
    console.error(`\nпроблем: ${problems.length} — исправьте вручную, затем npm run lint && npm test`)
    process.exitCode = 1
    return
  }
  console.log('\nдальше: npm run lint && npm test, затем вычитка и выпуск по тегу')
}

main().catch((error) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
