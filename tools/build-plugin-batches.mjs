#!/usr/bin/env node
/**
 * Splits the collected plugin display metadata into translation batches.
 *
 * Usage:
 *   node tools/build-plugin-batches.mjs [--size 90]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const sizeIndex = args.indexOf('--size')
const batchSize = sizeIndex === -1 ? 90 : Number(args[sizeIndex + 1])

const meta = JSON.parse(readFileSync(resolve(root, 'strings/plugin-meta.json'), 'utf8'))

const items = []
for (const entry of meta.descriptions) {
  items.push({ kind: 'description', en: entry.en, packages: entry.packages.slice(0, 3) })
}
// A title that is not the technical package name is human copy and is displayed
// as the card heading.
for (const entry of meta.packages) {
  if (typeof entry.title !== 'string' || entry.title === entry.name) continue
  if (!/\s/.test(entry.title)) continue
  items.push({ kind: 'title', en: entry.title, packages: [entry.name] })
}

const seen = new Set()
const unique = items.filter((item) => {
  if (seen.has(item.en)) return false
  seen.add(item.en)
  return true
})

const batchesDir = resolve(root, 'batches')
mkdirSync(batchesDir, { recursive: true })
const manifest = []
let index = 0
for (let offset = 0; offset < unique.length; offset += batchSize) {
  index += 1
  const chunk = unique.slice(offset, offset + batchSize)
  const id = `plugin-${String(index).padStart(2, '0')}`
  writeFileSync(resolve(batchesDir, `${id}.json`), `${JSON.stringify({
    id,
    kind: 'plugin-meta',
    count: chunk.length,
    items: chunk,
  }, null, 2)}\n`)
  manifest.push({ id, count: chunk.length, file: `${id}.json` })
}

writeFileSync(resolve(batchesDir, 'plugin-manifest.json'), `${JSON.stringify({ batchSize, batches: manifest }, null, 2)}\n`)
console.log(`описаний и названий: ${unique.length} (в том числе названий: ${unique.filter((item) => item.kind === 'title').length})`)
console.log(`батчей: ${manifest.length} по ≤${batchSize}`)
