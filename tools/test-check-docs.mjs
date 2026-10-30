#!/usr/bin/env node
/**
 * Tests the documentation checker itself: a consistent temporary repository
 * passes, while a stale version, wrong counts, a broken link and an unknown
 * script are reported.
 *
 * Usage:
 *   node tools/test-check-docs.mjs
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

const tool = join(import.meta.dirname, 'check-docs.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-docs-test-'))

/** Builds a temporary repository; `overrides` replaces individual documents. */
function prepare({ readme, development, scripts = { lint: 'node tools/lint-translations.mjs' } } = {}) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'tools'), { recursive: true })
  mkdirSync(join(workspace, 'dictionary'), { recursive: true })
  mkdirSync(join(workspace, 'docs'), { recursive: true })
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({
    version: '1.2.3',
    engines: { dsh: '^0.2.1-rc.2' },
    scripts: { test: 'npm run lint', ...scripts },
  }))
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify({ common: { a: 'А', b: 'Б' } }))
  writeFileSync(join(workspace, 'dictionary', 'plugin-meta.json'), JSON.stringify({ 'X': 'Икс' }))
  writeFileSync(join(workspace, 'tools', 'lint-translations.mjs'), '')
  writeFileSync(join(workspace, 'docs', 'DEVELOPMENT.md'), development ?? 'tools/lint-translations.mjs\n`engines.dsh` в манифесте (`^0.2.1-rc.2`)\n')
  writeFileSync(join(workspace, 'README.md'), readme ?? 'Пакет версии 1.2.3: 2 строки в 1 namespace, 1 строка описаний.\n[док](docs/DEVELOPMENT.md)\n')
}

const run = () => spawnSync(process.execPath, [tool, '--root', workspace], { encoding: 'utf8' })

console.log('согласованная документация')
prepare()
{
  const result = run()
  check('код 0', result.status === 0, result.stderr)
  check('сообщает согласованность', result.stdout.includes('документация согласована'))
}

console.log('устаревшая версия')
prepare({ readme: 'Установка: `"dsh-locale-russian": "^1.1.0"`.\n[док](docs/DEVELOPMENT.md)\n' })
{
  const result = run()
  check('найдена устаревшая версия', result.status === 1 && result.stderr.includes('1.1.0'), result.stderr)
}

console.log('неверные числа')
prepare({ readme: 'Пакет: 999 строк в 7 namespace.\n[док](docs/DEVELOPMENT.md)\n' })
{
  const result = run()
  check('найдены неверные строки', result.status === 1 && result.stderr.includes('999'), result.stderr)
  check('найдены неверные namespace', result.stderr.includes('7'), result.stderr)
}

console.log('битая ссылка и неизвестный скрипт')
prepare({ readme: '[нет](docs/missing.md)\n`npm run nope`\n[док](docs/DEVELOPMENT.md)\n' })
{
  const result = run()
  check('битая ссылка найдена', result.status === 1 && result.stderr.includes('missing.md'), result.stderr)
  check('неизвестный скрипт найден', result.stderr.includes('nope'), result.stderr)
}

console.log('несовпадающий диапазон')
prepare({ development: 'tools/lint-translations.mjs\n`engines.dsh` в манифесте (`^0.1.0-rc.1`)\n' })
{
  const result = run()
  check('диапазон найден', result.status === 1 && result.stderr.includes('0.1.0-rc.1'), result.stderr)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки чекера документации пройдены')
