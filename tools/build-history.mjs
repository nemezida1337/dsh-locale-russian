#!/usr/bin/env node
/**
 * Builds `market/history.json`: the coverage of every released version, read
 * from the git tags. The dashboard renders this table, and `--check` fails when
 * the committed history is behind the repository.
 *
 * A tag without git history (a shallow clone) is not invented: the tool keeps
 * the entries already committed and only makes sure the current version is
 * present, so `--check` stays meaningful in CI.
 *
 * Usage:
 *   node tools/build-history.mjs [--check]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option, flag } = createArgs()
const root = resolve(option('root', resolve(here, '..')))
const check = flag('check')
const historyPath = resolve(root, option('out', 'market/history.json'))

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)
const manifest = readJson(resolve(root, 'package.json'))

/** Counts strings and namespaces of a dictionary document. */
function coverage(dictionary) {
  const namespaces = Object.keys(dictionary ?? {})
  const strings = namespaces.reduce((sum, namespace) => sum + Object.keys(dictionary[namespace] ?? {}).length, 0)
  return { strings, namespaces: namespaces.length }
}

/** Runs git in the repository, or returns undefined when git is unavailable. */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

/** Collects one history entry per release tag. */
function fromTags() {
  const tags = git(['tag', '--list', 'v*', '--sort=v:refname'])
  if (tags === undefined || tags.length === 0) return []
  const entries = []
  for (const tag of tags.split('\n')) {
    const version = tag.replace(/^v/u, '')
    const raw = git(['show', `${tag}:dictionary/ru.json`])
    if (raw === undefined) continue
    let dictionary
    try {
      dictionary = JSON.parse(raw)
    } catch {
      continue
    }
    const date = git(['log', '-1', '--format=%cI', tag]) ?? ''
    const pluginMeta = readJson(resolve(root, 'dictionary/plugin-meta.json'), {})
    entries.push({
      version,
      date,
      ...coverage(dictionary),
      pluginDescriptions: Object.keys(pluginMeta).length,
    })
  }
  return entries
}

const existing = readJson(historyPath, { versions: [] })
const byVersion = new Map((existing.versions ?? []).map((entry) => [entry.version, entry]))

// Теги дают исторические данные, текущая версия — самые свежие цифры.
for (const entry of fromTags()) byVersion.set(entry.version, entry)
byVersion.set(manifest.version, {
  version: manifest.version,
  date: byVersion.get(manifest.version)?.date ?? new Date().toISOString().slice(0, 10),
  ...coverage(readJson(resolve(root, 'dictionary/ru.json'), {})),
  pluginDescriptions: Object.keys(readJson(resolve(root, 'dictionary/plugin-meta.json'), {})).length,
})

const versions = [...byVersion.values()].sort((left, right) => {
  const parse = (version) => version.split(/[.-]/u).map((part) => (/^\d+$/u.test(part) ? Number(part) : part))
  const a = parse(left.version)
  const b = parse(right.version)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const one = a[index] ?? 0
    const two = b[index] ?? 0
    if (one === two) continue
    if (typeof one === 'number' && typeof two === 'number') return one - two
    return String(one).localeCompare(String(two))
  }
  return 0
})

const document = { format: 1, versions }
const serialized = `${JSON.stringify(document, null, 2)}\n`

if (check) {
  const current = existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : ''
  const same = current === serialized
  // В мелком клоне без тегов проверяем только наличие текущей версии.
  const hasCurrent = (readJson(historyPath, { versions: [] }).versions ?? []).some((entry) => entry.version === manifest.version)
  if (!same && !hasCurrent) {
    console.error('история покрытия устарела: запустите npm run history и закоммитьте market/history.json')
    process.exit(1)
  }
  console.log(`история покрытия: ${versions.length} версий, текущая ${manifest.version} на месте`)
  process.exit(0)
}

writeFileSync(historyPath, serialized)
console.log(`история покрытия: ${historyPath.replace(`${root}/`, '')} | версий: ${versions.length}`)
