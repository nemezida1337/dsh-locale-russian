#!/usr/bin/env node
/**
 * Runs the whole extraction chain in one command: it re-reads the client
 * packages of the installed app, of the DSH installation, and of the repository
 * clone, rebuilds the inventory, and reports exactly which strings a new build
 * adds or rewords.
 *
 * The chain is:
 *   app.asar → client bundles → dictionary inventory → delta batches → drift report
 *
 * Usage:
 *   node tools/refresh.mjs [--check] [--skip-asar] [--skip-install] [--skip-repo]
 *                          [--asar <path>] [--packages <dir>] [--install-root <dir>]
 *                          [--repo <path>]
 *
 * `--check` exits nonzero when the delta is not empty, which is how CI notices
 * that a new DSH build shipped strings nobody translated yet.
 */
import { spawnSync } from 'node:child_process'
import { createArgs } from './lib/cli.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option, flag } = createArgs()

const check = flag('check')
const asarPath = option('asar', '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar')
const packagesDir = resolve(root, option('packages', '.app-packages'))
const installRoot = resolve(option('install-root', resolve(homedir(), '.dsh/profiles/node_modules/@deepseek-ai')))
const repoRoot = option('repo', resolve(root, '../deepseek-harness'))

const steps = []
/** Runs one tool, streaming its output. */
function run(label, script, extraArgs = [], env = {}) {
  process.stdout.write(`\n=== ${label}\n`)
  const result = spawnSync(process.execPath, [resolve(here, script), ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  const ok = result.status === 0
  steps.push({ label, ok })
  return ok
}

const haveAsar = existsSync(asarPath)
const haveInstall = existsSync(installRoot)
const haveRepo = existsSync(resolve(repoRoot, 'packages'))

if (!flag('skip-asar') && haveAsar) {
  run('Пакеты приложения из app.asar', 'extract-asar.mjs', ['--asar', asarPath, '--out', '.app-packages'])
} else {
  console.log(`\n=== Пакеты приложения: пропущено${haveAsar ? '' : ' (app.asar не найден)'}`)
}

if (existsSync(packagesDir)) {
  run('Словари приложения', 'extract-static.mjs', ['--out', 'strings/app.json'],
    { DSH_CLIENT_PKG_ROOT: packagesDir })
}
if (!flag('skip-install') && haveInstall) {
  run('Словари CLI-сборки', 'extract-static.mjs', ['--out', 'strings/registered.json'],
    { DSH_CLIENT_PKG_ROOT: installRoot })
}
if (!flag('skip-repo') && haveRepo) {
  run('Словари репозитория', 'extract-repo.mjs', ['--repo', repoRoot])
}
run('Метаданные плагинов', 'extract-plugin-meta.mjs', ['--packages', packagesDir, '--repo', repoRoot])
run('Инвентарь', 'build-inventory.mjs')
run('Батчи дельты', 'build-batches.mjs', ['--delta'])
run('Батчи метаданных плагинов', 'build-plugin-batches.mjs')
run('Отчёт о расхождениях', 'report-drift.mjs')

// Delta summary: what a translator still has to do.
const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const dictionary = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))
const overridesPath = resolve(root, 'dictionary/overrides.json')
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {}
const translatedFromPath = resolve(root, 'dictionary/translated-from.json')
const translatedFrom = existsSync(translatedFromPath)
  ? JSON.parse(readFileSync(translatedFromPath, 'utf8')).keys ?? {}
  : {}

const missingKeys = []
const rewordedKeys = []
for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    const translated = overrides[namespace]?.[key] ?? dictionary[namespace]?.[key]
    if (typeof translated !== 'string' || (translated.length === 0 && value.en.length > 0)) {
      missingKeys.push(`${namespace}/${key}`)
      continue
    }
    if (value.wordingChangedFrom !== undefined && translatedFrom[`${namespace}\u0000${key}`] !== value.en) {
      rewordedKeys.push(`${namespace}/${key}`)
    }
  }
}
const missing = missingKeys.length
const reworded = rewordedKeys.length

const pluginText = existsSync(resolve(root, 'dictionary/plugin-meta.json'))
  ? JSON.parse(readFileSync(resolve(root, 'dictionary/plugin-meta.json'), 'utf8'))
  : {}
const pluginMeta = existsSync(resolve(root, 'strings/plugin-meta.json'))
  ? JSON.parse(readFileSync(resolve(root, 'strings/plugin-meta.json'), 'utf8'))
  : { descriptions: [], packages: [] }
const expectedPluginText = new Set(pluginMeta.descriptions.map((entry) => entry.en))
for (const entry of pluginMeta.packages) {
  if (typeof entry.title === 'string' && entry.title !== entry.name && /\s/.test(entry.title)) expectedPluginText.add(entry.title)
}
const missingPluginSources = []
for (const source of expectedPluginText) {
  if (pluginText[source] === undefined) missingPluginSources.push(source)
}
const missingPluginText = missingPluginSources.length

const failedSteps = steps.filter((step) => !step.ok)
console.log('\n================ сводка обновления ================')
console.log(`источники: приложение ${existsSync(packagesDir) ? 'да' : 'нет'}, CLI ${haveInstall ? 'да' : 'нет'}, репозиторий ${haveRepo ? 'да' : 'нет'}`)
console.log(`ключей в инвентаре: ${inventory.stats.keys}`)
console.log(`без перевода: ${missing}, с изменившимся английским: ${reworded}`)
for (const key of missingKeys.slice(0, 20)) console.log(`  − ${key}`)
if (missing > 20) console.log(`  − … и ещё ${missing - 20}`)
for (const key of rewordedKeys.slice(0, 20)) console.log(`  ~ ${key}`)
if (reworded > 20) console.log(`  ~ … и ещё ${reworded - 20}`)
console.log(`описаний плагинов без перевода: ${missingPluginText}`)
for (const source of missingPluginSources.slice(0, 20)) console.log(`  · ${source.slice(0, 120)}`)
if (missingPluginSources.length > 20) console.log(`  · … и ещё ${missingPluginSources.length - 20}`)
if (failedSteps.length > 0) {
  console.log(`шаги с ошибкой: ${failedSteps.map((step) => step.label).join(', ')}`)
}

const delta = missing + reworded + missingPluginText
if (delta === 0 && failedSteps.length === 0) {
  console.log('дельты нет — перевод соответствует текущим сборкам')
  console.log('дальше: npm test (линтер, сборка, проверка бандла)')
} else {
  console.log('дальше: перевести файлы batches/p3-*.json и batches/plugin-*.json,')
  console.log('        затем node tools/mark-translated.mjs && npm test')
}

process.exitCode = failedSteps.length > 0 || (check && delta > 0) ? 1 : 0
