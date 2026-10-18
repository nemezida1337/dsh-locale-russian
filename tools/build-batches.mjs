#!/usr/bin/env node
/**
 * Splits the inventory into translation batches.
 *
 * Priority 1 holds every key the installed build can display; priority 2 holds
 * keys that exist only in the repository (newer or experimental packages).
 * Batches keep one namespace together where possible and carry the English
 * text, the Chinese source-of-truth copy, the owning repository file, and the
 * plural-form requirements of each key.
 *
 * Usage:
 *   node tools/build-batches.mjs [--size 120]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const sizeIndex = args.indexOf('--size')
const batchSize = sizeIndex === -1 ? 120 : Number(args[sizeIndex + 1])

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const delta = args.includes('--delta')
const dictionary = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))
const overrides = existsSync(resolve(root, 'dictionary/overrides.json'))
  ? JSON.parse(readFileSync(resolve(root, 'dictionary/overrides.json'), 'utf8'))
  : {}
// The repository checkout names the source file owning each key; the app bundle
// only names its package, so prefer the repository path when both know the key.
// Which English text each existing translation was made from; keys whose text
// moved since then belong in the delta again.
const translatedFromPath = resolve(root, 'dictionary/translated-from.json')
const translatedFrom = existsSync(translatedFromPath)
  ? JSON.parse(readFileSync(translatedFromPath, 'utf8')).keys ?? {}
  : {}
const repoContexts = existsSync(resolve(root, 'strings/repo.json'))
  ? JSON.parse(readFileSync(resolve(root, 'strings/repo.json'), 'utf8')).namespaces
  : {}
const batchesDir = resolve(root, 'batches')
rmSync(batchesDir, { recursive: true, force: true })
mkdirSync(batchesDir, { recursive: true })

/** Picks the plural guidance one key needs. */
function pluralHint(key, entry) {
  const siblingBase = key.replace(/\.(one|other|zero|two|few|many)$/, '')
  const hasPair = /\.(one|other)$/.test(key)
  return {
    plural: entry.plural === true ? true : undefined,
    pair: hasPair ? siblingBase : undefined,
    siblingIsOne: key.endsWith('.other') ? true : undefined,
  }
}

const groups = { p1: [], p2: [], p3: [] }
for (const [ns, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    const translated = overrides[ns]?.[key] ?? dictionary[ns]?.[key]
    // A key needs work when it has no translation, or when the English text
    // moved after the translation was recorded (dictionary/translated-from.json).
    const changed = value.wordingChangedFrom !== undefined
      && translatedFrom[`${ns}\u0000${key}`] !== value.en
    if (delta && translated !== undefined && !changed) continue
    const item = {
      namespace: ns,
      key,
      en: value.en,
      zh: value.zh,
      context: repoContexts[ns]?.en?.[key] !== undefined
        ? (repoContexts[ns]?.sources?.[0] ?? value.context ?? '')
        : (value.context ?? entry.sources[0] ?? ''),
      currentRu: translated,
      priority: delta ? 'p3' : (value.origin === 'repo' ? 'p2' : 'p1'),
      previousEn: changed ? value.wordingChangedFrom : undefined,
      ...pluralHint(key, value),
    }
    groups[item.priority].push(item)
  }
}

const manifest = []
for (const [priority, items] of Object.entries(groups)) {
  const byNamespace = new Map()
  for (const item of items) {
    if (!byNamespace.has(item.namespace)) byNamespace.set(item.namespace, [])
    byNamespace.get(item.namespace).push(item)
  }
  const ordered = [...byNamespace.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let index = 0
  for (const [ns, namespaceItems] of ordered) {
    for (let offset = 0; offset < namespaceItems.length; offset += batchSize) {
      index += 1
      const chunk = namespaceItems.slice(offset, offset + batchSize)
      const id = `${priority}-${String(index).padStart(3, '0')}`
      const file = resolve(batchesDir, `${id}.json`)
      writeFileSync(file, `${JSON.stringify({
        id,
        namespace: ns,
        priority,
        count: chunk.length,
        items: chunk,
      }, null, 2)}\n`)
      manifest.push({ id, namespace: ns, priority, count: chunk.length, file: `${id}.json` })
    }
  }
}

writeFileSync(resolve(batchesDir, 'manifest.json'), `${JSON.stringify({ batchSize, batches: manifest }, null, 2)}\n`)
for (const priority of ['p1', 'p2', 'p3']) {
  const subset = manifest.filter((batch) => batch.priority === priority)
  if (subset.length > 0 || priority !== 'p3') {
    console.log(`${priority}: ${subset.length} batches / ${subset.reduce((sum, batch) => sum + batch.count, 0)} keys`)
  }
}
console.log(`batch size: ${batchSize}`)
