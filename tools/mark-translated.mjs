#!/usr/bin/env node
/**
 * Records which English text each translation was made from.
 *
 * Without this state a refresh cannot tell "already translated from the current
 * wording" from "the wording changed after translation", so every changed key
 * would stay in the delta forever. Run it after finishing a translation round.
 *
 * Usage:
 *   node tools/mark-translated.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const dictionary = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))
const overridesPath = resolve(root, 'dictionary/overrides.json')
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {}

const state = {}
let marked = 0
let untranslated = 0
for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    const translated = overrides[namespace]?.[key] ?? dictionary[namespace]?.[key]
    // An empty translation is valid exactly when the English source is empty
    // too (a shared prefix that only some languages fill).
    if (typeof translated !== 'string' || (translated.length === 0 && value.en.length > 0)) {
      untranslated += 1
      continue
    }
    state[`${namespace}\u0000${key}`] = value.en
    marked += 1
  }
}

const pluginText = existsSync(resolve(root, 'dictionary/plugin-meta.json'))
  ? JSON.parse(readFileSync(resolve(root, 'dictionary/plugin-meta.json'), 'utf8'))
  : {}
const pluginState = {}
for (const source of Object.keys(pluginText)) pluginState[source] = source

writeFileSync(resolve(root, 'dictionary/translated-from.json'), `${JSON.stringify({
  _comment: 'Английский текст, по которому сделан текущий перевод. Обновляется tools/mark-translated.mjs после завершения раунда перевода.',
  keys: Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b))),
  pluginText: Object.fromEntries(Object.entries(pluginState).sort(([a], [b]) => a.localeCompare(b))),
}, null, 2)}\n`)

console.log(`отмечено переведёнными: ${marked} ключей, ${Object.keys(pluginState).length} строк метаданных`)
console.log(untranslated > 0 ? `без перевода осталось: ${untranslated} (они останутся в дельте)` : 'непереведённых ключей нет')
console.log('written: dictionary/translated-from.json')
