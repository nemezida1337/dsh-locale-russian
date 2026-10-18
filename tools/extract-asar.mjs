#!/usr/bin/env node
/**
 * Extracts the DSH client packages the installed desktop application serves
 * out of its `app.asar` archive, so dictionary extraction can run against the
 * exact build the user sees rather than an older CLI installation.
 *
 * Usage:
 *   node tools/extract-asar.mjs --asar "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" \
 *     --out .app-packages [--prefix dsh/node_modules/@deepseek-ai]
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const asarPath = option('asar', '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar')
const outDir = resolve(root, option('out', '.app-packages'))
const prefix = option('prefix', 'dsh/node_modules/@deepseek-ai')

// The archive starts with a nested pickle: [4][size+8][size+4][json length],
// then the JSON directory tree, then the file payloads, aligned to 4 bytes.
const archive = readFileSync(asarPath)
const jsonStart = 16
const jsonLength = archive.readUInt32LE(12)
const header = JSON.parse(archive.subarray(jsonStart, jsonStart + jsonLength).toString('utf8'))
const dataOffset = Math.ceil((jsonStart + jsonLength) / 4) * 4

/** Walks the archive tree, yielding `path → node`. */
function* walk(node, path = '') {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const childPath = path.length === 0 ? name : `${path}/${name}`
    if (child.files !== undefined) yield* walk(child, childPath)
    else yield [childPath, child]
  }
}

/** Reads one archived file's bytes. */
function readArchived(node) {
  const start = dataOffset + Number(node.offset)
  return archive.subarray(start, start + node.size)
}

let extracted = 0
const packages = new Set()
for (const [path, node] of walk(header)) {
  if (!path.startsWith(`${prefix}/`)) continue
  const relative = path.slice(prefix.length + 1)
  const [packageName, ...rest] = relative.split('/')
  if (rest.length === 0) continue
  const inner = rest.join('/')
  const wanted = inner === 'package.json'
    || inner === 'lib/client.js'
    || inner === 'lib/index.js'
    // Plugin display metadata (human titles) lives in the exported locale JSON.
    || /^locale\/[^/]+\.json$/u.test(inner)
  if (!wanted) continue
  packages.add(packageName)
  const target = join(outDir, packageName, inner)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, readArchived(node))
  extracted += 1
}

console.log(`archive: ${asarPath}`)
console.log(`data offset: ${dataOffset}, header bytes: ${jsonLength}`)
console.log(`packages: ${packages.size}`)
console.log(`files extracted: ${extracted} → ${outDir}`)
const listed = [...packages].sort()
console.log(`first: ${listed.slice(0, 6).join(', ')}`)
if (listed.length > 0) {
  const sample = join(outDir, listed[0], 'package.json')
  if (statSync(sample).isFile()) {
    const manifest = JSON.parse(readFileSync(sample, 'utf8'))
    console.log(`sample: ${manifest.name}@${manifest.version}`)
  }
}
