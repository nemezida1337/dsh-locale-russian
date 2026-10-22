#!/usr/bin/env node
/**
 * Collects the plugin display metadata DSH shows in the Plugins settings page.
 *
 * The Host reads each composed package's `package.json` `description` (and the
 * `meta.title` of its exported locale JSON) and hands the values to the browser
 * as `LocalizedText`. Official packages ship English only, so the client shows
 * English cards; this tool gathers those strings so the language pack can carry
 * a translation table and resolve them for Russian.
 *
 * Sources: packages extracted from the installed app (`--packages`) and the
 * repository clone (`--repo`).
 *
 * Usage:
 *   node tools/extract-plugin-meta.mjs
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { createArgs } from './lib/cli.mjs'
import { dirname, resolve, join } from 'node:path'
import { displayPath } from './lib/paths.mjs'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const { option, flag } = createArgs()

const packagesDir = resolve(root, option('packages', '.app-packages'))
const repoRoot = option('repo', resolve(root, '../deepseek-harness'))
const outFile = resolve(root, option('out', 'strings/plugin-meta.json'))

/** Reads `meta.title` / `meta.description` out of a package's English locale JSON. */
function localeMeta(packageDir) {
  const english = join(packageDir, 'locale', 'en.json')
  if (!existsSync(english)) return {}
  try {
    const payload = JSON.parse(readFileSync(english, 'utf8'))
    const meta = payload?.meta ?? {}
    return {
      localeTitle: typeof meta.title === 'string' ? meta.title : undefined,
      localeDescription: typeof meta.description === 'string' ? meta.description : undefined,
    }
  } catch {
    return {}
  }
}

const entries = []
const seen = new Set()

/** Records one package manifest. */
function collect(packageDir, source) {
  const manifestPath = join(packageDir, 'package.json')
  if (!existsSync(manifestPath)) return
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return
  }
  if (typeof manifest.name !== 'string' || manifest.private === true) return
  // Nested dependency copies repeat the same package; keep the first seen.
  if (seen.has(manifest.name)) return
  seen.add(manifest.name)
  const meta = localeMeta(packageDir)
  entries.push({
    name: manifest.name,
    version: manifest.version,
    title: meta.localeTitle ?? manifest.name,
    description: meta.localeDescription ?? (typeof manifest.description === 'string' ? manifest.description : undefined),
    source,
  })
}

if (existsSync(packagesDir)) {
  for (const name of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!name.isDirectory() || name.name === 'node_modules') continue
    collect(join(packagesDir, name.name), 'app')
  }
}
// The repository ships packages under several roots: packages/<group>/<name>,
// native/<name>/packages/<platform>, vendor, and so on. Walking the whole tree
// keeps platform variants (Linux, Windows, arm64) in the table instead of only
// the ones the current machine installs.
const REPO_SKIP = new Set([
  'node_modules', '.git', 'lib', 'dist', 'coverage', '.pnpm',
  // Fixture and example manifests are not shipped packages.
  'tests', 'test', '__tests__', 'fixtures', '__fixtures__', 'examples', 'docs', 'website',
])
function walkRepo(dir, depth) {
  if (depth > 4) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  // A monorepo root has a manifest *and* child packages, so collecting never
  // stops the descent.
  if (entries.some((entry) => entry.isFile() && entry.name === 'package.json')) collect(dir, 'repo')
  for (const entry of entries) {
    if (!entry.isDirectory() || REPO_SKIP.has(entry.name) || entry.name.startsWith('.')) continue
    walkRepo(join(dir, entry.name), depth + 1)
  }
}
if (existsSync(repoRoot)) walkRepo(repoRoot, 0)

// Translation works on unique strings: several packages share a description.
const uniqueDescriptions = new Map()
for (const entry of entries) {
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0) continue
  const list = uniqueDescriptions.get(entry.description) ?? []
  list.push(entry.name)
  uniqueDescriptions.set(entry.description, list)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  packagesDir: displayPath(packagesDir),
  repoRoot: displayPath(repoRoot),
  stats: {
    packages: entries.length,
    withDescription: entries.filter((entry) => entry.description !== undefined).length,
    uniqueDescriptions: uniqueDescriptions.size,
  },
  descriptions: [...uniqueDescriptions.entries()]
    .map(([en, packages]) => ({ en, packages }))
    .sort((a, b) => b.packages.length - a.packages.length || a.en.localeCompare(b.en)),
  packages: entries,
}, null, 2)}\n`)

console.log(`packages: ${entries.length}, с описанием: ${entries.filter((entry) => entry.description !== undefined).length}`)
console.log(`уникальных английских описаний: ${uniqueDescriptions.size}`)
const longest = [...uniqueDescriptions.keys()].sort((a, b) => b.length - a.length)[0]
console.log(`самое длинное (${longest?.length ?? 0} знаков): ${longest?.slice(0, 90) ?? '—'}…`)
console.log(`written: ${outFile}`)
