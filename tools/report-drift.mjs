#!/usr/bin/env node
/**
 * Lists the keys whose English text differs between the installed build and
 * the repository. Translations follow the installed build, because that is what
 * the running application displays; after an application update these keys are
 * the ones to re-translate first.
 *
 * Usage:
 *   node tools/report-drift.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const dictionary = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))

const drift = []
for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    if (value.wordingChangedFrom === undefined) continue
    drift.push({
      namespace,
      key,
      currentEnglish: value.en,
      previousEnglish: value.wordingChangedFrom,
      russian: dictionary[namespace]?.[key],
      context: value.context[0] ?? entry.sources[0] ?? '',
    })
  }
}

mkdirSync(resolve(root, 'reports'), { recursive: true })
writeFileSync(resolve(root, 'reports/en-drift.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'Английский текст этих ключей изменился между сборками. Русский перевод сделан по прежней формулировке — после обновления приложения его нужно проверить или переписать.',
  count: drift.length,
  keys: drift,
}, null, 2)}\n`)

console.log(`keys whose English changed between the installed build and the repository: ${drift.length}`)
for (const item of drift.slice(0, 15)) {
  console.log(`  ${item.namespace}/${item.key}: "${item.previousEnglish}" → "${item.currentEnglish}"`)
}
console.log('written: reports/en-drift.json')
