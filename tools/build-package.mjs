#!/usr/bin/env node
/**
 * Builds the installable `dsh-locale-ru` client plugin from the inventory and
 * the translated batches.
 *
 * Outputs: `dictionary/ru.json` (the merged dictionary), `lib/client.js` (the
 * browser bundle in the loader's factory format), `lib/index.js` (the host half
 * with the local Russian speech provider), and `package.json` for the plugin row.
 *
 * Usage:
 *   node tools/build-package.mjs [--allow-missing]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const allowMissing = process.argv.includes('--allow-missing')

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const packageJsonPath = resolve(root, 'package.json')
const existingManifest = existsSync(packageJsonPath)
  ? JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  : {}
const translationsDir = resolve(root, 'translations')

/** Merges every translated batch into `namespace → key → russian`. */
// Batches apply in precedence order, later wins: repository-only keys first,
// then the shipped-build set, then the delta taken from the installed app, which
// carries the newest English text and therefore the authoritative translation.
const precedence = (file) => (file.startsWith('p2-') ? 0 : file.startsWith('p1-') ? 1 : 2)
const batchFiles = readdirSync(translationsDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .sort((a, b) => precedence(a) - precedence(b) || a.localeCompare(b))

const dictionary = {}
// Plugin display metadata (package descriptions and human titles) is keyed by
// its English text instead of a namespace: the client resolves those values
// through LocaleRuntime.resolveText, which the generated bundle wraps.
const pluginText = {}
const missing = []
let shadowed = 0
for (const file of batchFiles) {
  const payload = JSON.parse(readFileSync(join(translationsDir, file), 'utf8'))
  if (payload.kind === 'plugin-meta') {
    for (const [source, translated] of Object.entries(payload.translations ?? {})) {
      if (typeof translated === 'string' && translated.length > 0) pluginText[source] = translated
    }
    continue
  }
  const namespace = payload.namespace
  for (const [key, value] of Object.entries(payload.translations ?? {})) {
    if (typeof value !== 'string') continue
    dictionary[namespace] ??= {}
    if (dictionary[namespace][key] !== undefined && dictionary[namespace][key] !== value) shadowed += 1
    dictionary[namespace][key] = value
  }
}
// Editorial decisions recorded after review win over the batch translations.
const overridesPath = resolve(root, 'dictionary/overrides.json')
if (existsSync(overridesPath)) {
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
  for (const [namespace, keys] of Object.entries(overrides)) {
    if (namespace.startsWith('_')) continue
    for (const [key, value] of Object.entries(keys)) {
      dictionary[namespace] ??= {}
      dictionary[namespace][key] = value
    }
  }
}

for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    if (dictionary[namespace]?.[key] === undefined) {
      missing.push({ namespace, key, origin: value.origin })
    }
  }
}

const sortedDictionary = Object.fromEntries(
  Object.entries(dictionary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, keys]) => [namespace, Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)))]),
)

const totalKeys = Object.values(sortedDictionary).reduce((sum, keys) => sum + Object.keys(keys).length, 0)
const coverage = {
  generatedAt: new Date().toISOString(),
  namespaces: Object.keys(sortedDictionary).length,
  keys: totalKeys,
  missingKeys: missing.length,
  missingPriority1: missing.filter((item) => item.origin !== 'repo').length,
  missing,
}
mkdirSync(resolve(root, 'reports'), { recursive: true })
writeFileSync(resolve(root, 'reports/coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`)

if (missing.length > 0 && !allowMissing) {
  const priority1 = missing.filter((item) => item.origin !== 'repo')
  console.error(`missing translations: ${missing.length} (of them priority 1: ${priority1.length})`)
  for (const item of missing.slice(0, 20)) console.error(`  - ${item.namespace}/${item.key} (${item.origin})`)
  console.error('run with --allow-missing to build a partial pack')
  process.exit(1)
}

mkdirSync(resolve(root, 'dictionary'), { recursive: true })
writeFileSync(resolve(root, 'dictionary/ru.json'), `${JSON.stringify(sortedDictionary, null, 2)}\n`)

// Editorial corrections to the package copy (terminology unified with the UI
// dictionary) win over the batch translations, keyed by the English text.
const pluginOverridesPath = resolve(root, 'dictionary/plugin-meta-overrides.json')
if (existsSync(pluginOverridesPath)) {
  const pluginOverrides = JSON.parse(readFileSync(pluginOverridesPath, 'utf8'))
  for (const [source, translated] of Object.entries(pluginOverrides)) {
    if (typeof translated === 'string' && translated.length > 0) pluginText[source] = translated
  }
}
const sortedPluginText = Object.fromEntries(
  Object.entries(pluginText).sort(([a], [b]) => a.localeCompare(b)),
)
writeFileSync(resolve(root, 'dictionary/plugin-meta.json'), `${JSON.stringify(sortedPluginText, null, 2)}\n`)
const manifestName = existingManifest.name ?? 'dsh-locale-russian'
const dictionaryJson = JSON.stringify(sortedDictionary)
const pluginTextJson = JSON.stringify(sortedPluginText)
// The digest identifies the whole shipped copy: both the namespace
// dictionaries and the plugin display text.
const digest = createHash('sha256')
  .update(`${dictionaryJson}\u0000${pluginTextJson}`)
  .digest('hex')
  .slice(0, 16)

// Клиентский бандл — отдельный файл-шаблон: его можно проверить `node --check`
// и править как обычный код, а не как строку внутри генератора.
const template = readFileSync(resolve(here, 'templates/client-bundle.js'), 'utf8')
// split/join вместо replace: значения содержат `$`, который replace трактует
// как часть шаблона подстановки.
const fill = (source, placeholder, value) => source.split(placeholder).join(value)
const clientBundle = fill(
  fill(
    fill(fill(template, '__MODULE_ID__', manifestName), '__DIGEST__', digest),
    '__DICTIONARIES_JSON__',
    dictionaryJson,
  ),
  '__PLUGIN_TEXT_JSON__',
  pluginTextJson,
)

mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), clientBundle)

// The bundle patch is generated: its single row must name the installed
// package, so a rename in package.json cannot leave a stale specifier behind.
const patchFile = `# Слой патча пакета-бандла: подключает строку языкового пакета и делает
# локальный русский распознаватель выбором по умолчанию для штатного голосового
# ввода. Файл генерируется tools/build-package.mjs — имя строки берётся из
# package.json.
- insert:
    - id: locale-ru
      name: ${manifestName}
# Строка speech-to-text вставляется бандлом голосового ввода. Патч конфигурации
# применяется к ней, если этот слой идёт после бандла голосового ввода; при
# обратном порядке выбор остаётся штатным, и провайдер выбирают в настройках.
- id: speech-to-text
  config:
    defaultProvider: gigaam-local
`
writeFileSync(resolve(root, 'cordis.patch.yml'), patchFile)
// Хост-половина — отдельный шаблон: словари живут в браузерной половине, а хост
// добавляет локальное распознавание русской речи для штатного голосового ввода.
const hostPlugin = readFileSync(resolve(here, 'templates/host-plugin.js'), 'utf8')
writeFileSync(resolve(root, 'lib/index.js'), hostPlugin)

const manifest = {
  ...existingManifest,
  name: existingManifest.name ?? 'dsh-locale-russian',
  version: existingManifest.version ?? '0.1.0',
  description: 'Russian localization for the DeepSeek Harness web client, with local Russian speech recognition for voice input',
  type: 'module',
  main: 'lib/index.js',
  exports: {
    '.': './lib/index.js',
    './client': './lib/client.js',
    './icon': './icon.svg',
    './locale/*.json': './locale/*.json',
    './package.json': './package.json',
  },
  // Только то, что нужно во время работы, плюс документация: слои правок и
  // состояние переводов остаются в репозитории.
  files: [
    'lib',
    'locale/*.json',
    'cordis.patch.yml',
    'install.sh',
    'icon.svg',
    'dictionary/ru.json',
    'dictionary/plugin-meta.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'GLOSSARY.md',
    'STYLE.md',
  ],
  dsh: {
    // Both roles: a bundle so a profile installs it as one unit, and a client
    // plugin so the browser half is served. `immediately` registers the
    // language before the shell resolves its initial locale, so a Russian
    // system paints Russian on the first frame.
    bundle: { patch: './cordis.patch.yml' },
    client: {
      inject: ['@deepseek-ai/dsh-client-locale'],
      platform: 'web',
      immediately: true,
    },
  },
  // Verified against these DSH builds; widen the range when a new build ships.
  engines: { dsh: '^0.1.5-rc.1 || ^0.2.1-rc.2' },
  repository: {
    type: 'git',
    url: 'git+https://github.com/nemezida1337/dsh-locale-russian.git',
  },
  homepage: 'https://github.com/nemezida1337/dsh-locale-russian#readme',
  bugs: { url: 'https://github.com/nemezida1337/dsh-locale-russian/issues' },
  keywords: ['dsh', 'deepseek-harness', 'locale', 'localization', 'i18n', 'russian', 'ru', 'plugin'],
  author: 'dsh-locale-ru contributors',
  license: 'MIT',
}
writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`dictionary: ${Object.keys(sortedDictionary).length} namespaces, ${totalKeys} keys (digest ${digest})`)
console.log(`plugin display text: ${Object.keys(sortedPluginText).length} strings`)
console.log(`missing translations: ${missing.length} (priority 1: ${missing.filter((item) => item.origin !== 'repo').length})`)
console.log(`superseded by a newer batch: ${shadowed}`)
console.log(`written: dictionary/ru.json, lib/client.js, lib/index.js, package.json`)
