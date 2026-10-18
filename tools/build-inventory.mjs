#!/usr/bin/env node
/**
 * Merges every dictionary source into the translation source of truth.
 *
 * Sources, highest priority first:
 *   1. `strings/app.json`        — client bundles from the installed desktop app (app.asar)
 *   2. `strings/registered.json` — client bundles of the CLI installation
 *   3. `strings/repo.json`       — dictionary sources in the repository clone
 *
 * The highest-priority source decides the English text a translator sees; every
 * variant is kept so a later run can tell which keys changed wording between
 * releases.
 *
 * Usage:
 *   node tools/build-inventory.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const stringsDir = resolve(root, 'strings')

const sources = [
  { id: 'app', file: resolve(stringsDir, 'app.json') },
  { id: 'installed', file: resolve(stringsDir, 'registered.json') },
  { id: 'repo', file: resolve(stringsDir, 'repo.json') },
].map((source) => ({
  ...source,
  present: existsSync(source.file),
  data: existsSync(source.file) ? JSON.parse(readFileSync(source.file, 'utf8')) : undefined,
}))

/** Keys whose copy carries a count and therefore needs Russian plural forms. */
function needsPlural(key, en) {
  if (/\.(one|other|zero|two|few|many)$/.test(key)) return true
  return /\{(?:n|count|value|total)\}/.test(en ?? '')
}

const namespaceNames = new Set()
for (const source of sources) {
  for (const ns of Object.keys(source.data?.namespaces ?? {})) namespaceNames.add(ns)
}

const namespaces = new Map()
for (const ns of [...namespaceNames].sort()) {
  const keyNames = new Set()
  for (const source of sources) {
    for (const key of Object.keys(source.data?.namespaces?.[ns]?.en ?? {})) keyNames.add(key)
  }
  const entries = {}
  const contexts = new Set()
  for (const source of sources) {
    for (const context of source.data?.namespaces?.[ns]?.sources ?? []) contexts.add(context)
  }
  for (const key of [...keyNames].sort()) {
    const variants = {}
    let zh
    for (const source of sources) {
      const value = source.data?.namespaces?.[ns]?.en?.[key]
      if (typeof value === 'string') variants[source.id] = value
      if (zh === undefined) {
        const translated = source.data?.namespaces?.[ns]?.zh?.[key]
        if (typeof translated === 'string') zh = translated
      }
    }
    const order = ['app', 'installed', 'repo']
    const origin = order.find((id) => variants[id] !== undefined)
    if (origin === undefined) continue
    const en = variants[origin]
    entries[key] = {
      en,
      zh,
      origin,
      variants,
      context: contexts.size > 0 ? [...contexts].sort()[0] : '',
      plural: needsPlural(key, en) || undefined,
    }
  }
  namespaces.set(ns, {
    sources: [...contexts].sort(),
    presentIn: sources.filter((source) => source.data?.namespaces?.[ns] !== undefined).map((source) => source.id),
    keys: entries,
  })
}

const stats = {
  namespaces: namespaces.size,
  keys: 0,
  fromApp: 0,
  fromInstalled: 0,
  fromRepo: 0,
  plural: 0,
  wordingChanged: 0,
}
for (const entry of namespaces.values()) {
  for (const value of Object.values(entry.keys)) {
    stats.keys += 1
    if (value.origin === 'app') stats.fromApp += 1
    else if (value.origin === 'installed') stats.fromInstalled += 1
    else stats.fromRepo += 1
    if (value.plural === true) stats.plural += 1
    const reference = value.variants.installed ?? value.variants.repo
    if (value.variants.app !== undefined && reference !== undefined && reference !== value.variants.app) {
      value.wordingChangedFrom = reference
      stats.wordingChanged += 1
    }
    // Per-source copies only matter while merging; downstream tooling needs the
    // chosen text, the previous wording of a changed key, and the origin.
    delete value.variants
  }
}

const inventory = {
  generatedAt: new Date().toISOString(),
  sources: Object.fromEntries(sources.map((source) => [source.id, {
    present: source.present,
    root: source.data?.packageRoot ?? source.data?.repoRoot ?? null,
  }])),
  stats,
  namespaces: Object.fromEntries(namespaces),
}
mkdirSync(stringsDir, { recursive: true })
writeFileSync(resolve(stringsDir, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`)

console.log(`sources: ${sources.map((source) => `${source.id}${source.present ? '' : ' (нет)'}`).join(', ')}`)
console.log(`namespaces: ${stats.namespaces}, keys: ${stats.keys}`)
console.log(`  из приложения: ${stats.fromApp}, из CLI: ${stats.fromInstalled}, из репозитория: ${stats.fromRepo}`)
console.log(`  склоняемых ключей: ${stats.plural}, сменивших английский текст: ${stats.wordingChanged}`)
