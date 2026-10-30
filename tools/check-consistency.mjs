#!/usr/bin/env node
/**
 * Checks that one English string is translated the same way everywhere. Legitimate
 * context differences (grammatical gender, different UI surfaces) are listed with
 * a reason in `dictionary/consistency-allow.json`; everything else is a problem.
 *
 * Usage:
 *   node tools/check-consistency.mjs [--warn] [--list]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option, flag } = createArgs()
const root = resolve(option('root', resolve(here, '..')))
const warnOnly = flag('warn')
const listAll = flag('list')

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback)
const dictionary = readJson(resolve(root, 'dictionary/ru.json'), {})
const current = readJson(resolve(root, 'strings/inventory.json'), {})
const alpha = readJson(resolve(root, option('alpha', '../alpha-check/strings/inventory.json')), {})
const allow = readJson(resolve(root, 'dictionary/consistency-allow.json'), {})

/** English source of a key, from the current build or the prerelease snapshot. */
function englishOf(namespace, key) {
  return current.namespaces?.[namespace]?.keys?.[key]?.en
    ?? alpha.namespaces?.[namespace]?.keys?.[key]?.en
}

// Группируем одинаковый английский текст.
const groups = new Map()
for (const [namespace, keys] of Object.entries(dictionary)) {
  for (const [key, russian] of Object.entries(keys)) {
    const english = englishOf(namespace, key)
    if (typeof english !== 'string' || typeof russian !== 'string') continue
    if (english.trim().length <= 2) continue
    const group = groups.get(english) ?? []
    group.push({ namespace, key, russian })
    groups.set(english, group)
  }
}

const problems = []
const allowed = []
for (const [english, entries] of groups) {
  const variants = [...new Set(entries.map((entry) => entry.russian))]
  if (variants.length <= 1) continue
  const rule = allow[english]
  const permitted = rule?.allowed ?? (Array.isArray(rule) ? rule : undefined)
  if (permitted !== undefined) {
    const unexpected = variants.filter((variant) => !permitted.includes(variant))
    if (unexpected.length === 0) {
      allowed.push({ english, variants, reason: rule?.reason ?? '' })
      continue
    }
    problems.push({ english, variants, unexpected, entries, reason: rule?.reason })
    continue
  }
  problems.push({ english, variants, unexpected: variants, entries })
}

if (listAll) {
  for (const problem of problems) {
    console.log(`${JSON.stringify(problem.english)} → ${problem.variants.map((variant) => JSON.stringify(variant)).join(' | ')}`)
    for (const entry of problem.entries) console.log(`    ${entry.namespace}/${entry.key}`)
  }
}

const summary = `согласованность: ${groups.size} английских строк, ${allowed.length} контекстных различий в белом списке, ${problems.length} расхождений`
if (problems.length === 0) {
  console.log(summary)
  process.exit(0)
}
console.error(summary)
for (const problem of problems.slice(0, 20)) {
  console.error(`  ✗ ${JSON.stringify(problem.english)} → ${problem.variants.map((variant) => JSON.stringify(variant)).join(' | ')}`)
  if (problem.unexpected.length > 0) console.error(`    не в белом списке: ${problem.unexpected.map((variant) => JSON.stringify(variant)).join(', ')}`)
}
if (problems.length > 20) console.error(`  … и ещё ${problems.length - 20}`)
if (!warnOnly) process.exit(1)
