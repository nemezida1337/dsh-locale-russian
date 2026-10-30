#!/usr/bin/env node
/**
 * Tests the consistency checker: identical English with different translations is
 * reported, a matching allowlist entry silences it, an unexpected variant still
 * fails, and `--warn` only warns.
 *
 * Usage:
 *   node tools/test-consistency.mjs
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const tool = join(import.meta.dirname, 'check-consistency.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-consistency-test-'))

/** Writes a temporary repository with the given dictionary and allowlist. */
function prepare({ dictionary, allow = {} }) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'dictionary'), { recursive: true })
  mkdirSync(join(workspace, 'strings'), { recursive: true })
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'pack', version: '1.0.0' }))
  // ru.json хранит только русские строки, инвентарь — только английские.
  const russian = {}
  const english = { namespaces: {} }
  for (const [namespace, entries] of Object.entries(dictionary)) {
    russian[namespace] = {}
    english.namespaces[namespace] = { keys: {} }
    for (const [key, entry] of Object.entries(entries)) {
      russian[namespace][key] = entry.ru
      english.namespaces[namespace].keys[key] = { en: entry.en }
    }
  }
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify(russian))
  writeFileSync(join(workspace, 'dictionary', 'consistency-allow.json'), JSON.stringify(allow))
  writeFileSync(join(workspace, 'strings', 'inventory.json'), JSON.stringify(english))
}

const run = (args = []) => spawnSync(process.execPath, [tool, '--root', workspace, ...args], { encoding: 'utf8' })

const withVariants = () => ({
  chat: { a: { en: 'Failed', ru: 'Сбой' } },
  job: { b: { en: 'Failed', ru: 'Ошибка' } },
})

console.log('расхождение без белого списка')
prepare({ dictionary: { chat: { a: { en: 'Failed', ru: 'Сбой' } }, job: { b: { en: 'Failed', ru: 'Ошибка' } } } })
{
  const result = run()
  check('код 1', result.status === 1, result.stderr)
  check('называет строку', result.stderr.includes('Failed'), result.stderr)
  check('список показывает ключи', run(['--list']).stdout.includes('chat/a'))
  check('--warn не падает', run(['--warn']).status === 0)
}

console.log('белый список покрывает различия')
prepare({
  dictionary: { chat: { a: { en: 'Failed', ru: 'Сбой' } }, job: { b: { en: 'Failed', ru: 'Ошибка' } } },
  allow: { Failed: { allowed: ['Сбой', 'Ошибка'], reason: 'разные экраны' } },
})
{
  const result = run()
  check('код 0', result.status === 0, result.stderr)
  check('сообщает о белом списке', result.stdout.includes('белом списке'))
}

console.log('новый вариант не в белом списке')
prepare({
  dictionary: { chat: { a: { en: 'Failed', ru: 'Сбой' } }, job: { b: { en: 'Failed', ru: 'Ошибка' } }, stats: { c: { en: 'Failed', ru: 'Провал' } } },
  allow: { Failed: { allowed: ['Сбой', 'Ошибка'], reason: 'разные экраны' } },
})
{
  const result = run()
  check('код 1', result.status === 1, result.stderr)
  check('называет лишний вариант', result.stderr.includes('Провал'), result.stderr)
}

console.log('одинаковые переводы')
prepare({ dictionary: { chat: { a: { en: 'Close', ru: 'Закрыть' } }, job: { b: { en: 'Close', ru: 'Закрыть' } } } })
{
  const result = run()
  check('код 0 без расхождений', result.status === 0, result.stderr)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки согласованности пройдены')
