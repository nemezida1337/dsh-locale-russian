#!/usr/bin/env node
/**
 * Merges the reviewer corrections into the editorial override layer.
 *
 * Reviewers write `reports/review-*.json`; this tool copies every correction
 * into `dictionary/overrides.json` (which build-package and the linter apply
 * on top of the batch translations) and records what it applied in
 * `reports/review-applied.json` for provenance.
 *
 * Usage:
 *   node tools/apply-reviews.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dryRun = process.argv.includes('--dry-run')

const reportsDir = resolve(root, 'reports')
const overridesPath = resolve(root, 'dictionary/overrides.json')
const overrides = existsSync(overridesPath)
  ? JSON.parse(readFileSync(overridesPath, 'utf8'))
  : { _comment: 'Редакционные решения после вычитки: применяются поверх батчей при сборке и участвуют в линтере.' }

const dictionary = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))
const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
// Plugin display metadata lives in its own override file, keyed by the English
// text instead of a namespace + key pair.
const pluginOverridesPath = resolve(root, 'dictionary/plugin-meta-overrides.json')
const pluginOverrides = existsSync(pluginOverridesPath)
  ? JSON.parse(readFileSync(pluginOverridesPath, 'utf8'))
  : {}
const pluginMeta = JSON.parse(readFileSync(resolve(root, 'strings/plugin-meta.json'), 'utf8'))
const knownPluginText = new Set(pluginMeta.descriptions.map((entry) => entry.en))
for (const entry of pluginMeta.packages) {
  if (typeof entry.title === 'string' && entry.title !== entry.name) knownPluginText.add(entry.title)
}
const pluginDictionary = existsSync(resolve(root, 'dictionary/plugin-meta.json'))
  ? JSON.parse(readFileSync(resolve(root, 'dictionary/plugin-meta.json'), 'utf8'))
  : {}
// A correction may target a string that only the built table knows: the npm
// release ships packages the installed app does not, so their copy arrives
// through a later translation round rather than through strings/plugin-meta.json.
for (const source of Object.keys(pluginDictionary)) knownPluginText.add(source)
for (const source of Object.keys(pluginOverrides)) knownPluginText.add(source)

const applied = []
const skipped = []
for (const file of readdirSync(reportsDir).filter((name) => /^review-.*\.json$/.test(name))) {
  const payload = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'))
  if (payload.kind === 'plugin-meta') {
    for (const [source, correction] of Object.entries(payload.corrections ?? {})) {
      const value = typeof correction === 'string' ? correction : correction?.value
      const reason = typeof correction === 'string' ? '' : (correction?.reason ?? '')
      if (typeof value !== 'string' || value.length === 0) {
        skipped.push({ file, key: source.slice(0, 60), why: 'no value' })
        continue
      }
      if (!knownPluginText.has(source)) {
        skipped.push({ file, key: source.slice(0, 60), why: 'not a known plugin metadata string' })
        continue
      }
      const before = pluginOverrides[source] ?? pluginDictionary[source]
      if (before === value) {
        skipped.push({ file, key: source.slice(0, 60), why: 'already matches' })
        continue
      }
      pluginOverrides[source] = value
      applied.push({ file, kind: 'plugin-meta', key: source.slice(0, 60), before, after: value, reason })
    }
    continue
  }
  for (const [namespace, keys] of Object.entries(payload.corrections ?? {})) {
    for (const [key, correction] of Object.entries(keys)) {
      const value = typeof correction === 'string' ? correction : correction?.value
      const reason = typeof correction === 'string' ? '' : (correction?.reason ?? '')
      const source = inventory.namespaces[namespace]?.keys?.[key]
      if (typeof value !== 'string' || value.length === 0) {
        skipped.push({ file, namespace, key, why: 'no value' })
        continue
      }
      if (source === undefined) {
        skipped.push({ file, namespace, key, why: 'key is not in the inventory' })
        continue
      }
      const before = overrides[namespace]?.[key] ?? dictionary[namespace]?.[key]
      if (before === value) {
        skipped.push({ file, namespace, key, why: 'already matches' })
        continue
      }
      overrides[namespace] ??= {}
      overrides[namespace][key] = value
      applied.push({ file, namespace, key, before, after: value, reason })
    }
  }
}

if (!dryRun) {
  writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`)
  writeFileSync(pluginOverridesPath, `${JSON.stringify(pluginOverrides, null, 2)}\n`)
  writeFileSync(resolve(reportsDir, 'review-applied.json'), `${JSON.stringify({
    appliedAt: new Date().toISOString(),
    applied,
    skipped,
  }, null, 2)}\n`)
}

console.log(`applied corrections: ${applied.length}${dryRun ? ' (dry run)' : ''}`)
console.log(`skipped: ${skipped.length}`)
for (const item of applied.slice(0, 40)) {
  const where = item.kind === 'plugin-meta' ? `plugin-meta ${item.key}` : `${item.namespace}/${item.key}`
  console.log(`  ${where}: ${JSON.stringify(item.before)} → ${JSON.stringify(item.after)}`)
}
if (skipped.length > 0) {
  const reasons = skipped.reduce((accumulator, item) => {
    accumulator[item.why] = (accumulator[item.why] ?? 0) + 1
    return accumulator
  }, {})
  console.log(`skipped reasons: ${JSON.stringify(reasons)}`)
}
