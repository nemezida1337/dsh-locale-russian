#!/usr/bin/env node
/**
 * Builds the coverage dashboard into a temporary file and checks the parts that
 * must not drift: totals, per-namespace table, source breakdown, links, and the
 * absence of unrendered template markers.
 *
 * Usage:
 *   node tools/test-dashboard.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

const workspace = mkdtempSync(join(tmpdir(), 'dsh-dashboard-test-'))
const out = join(workspace, 'index.html')
const tool = join(import.meta.dirname, 'build-dashboard.mjs')
const result = spawnSync(process.execPath, [tool, '--out', out], { encoding: 'utf8' })
check('сборка дашборда прошла', result.status === 0, result.stderr)

const html = readFileSync(out, 'utf8')
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
const dictionary = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'dictionary/ru.json'), 'utf8'))
const totalKeys = Object.values(dictionary).reduce((sum, keys) => sum + Object.keys(keys).length, 0)

check('заголовок страницы', html.includes('Русская локализация DeepSeek Harness'))
check('версия пакета', html.includes(manifest.version) || /v\d+\.\d+\.\d+/.test(html))
check('число строк совпадает со словарём', html.includes(`>${totalKeys}<`), String(totalKeys))
check('таблица по namespace', html.includes('По namespace') && html.includes('<code>common</code>'))
check('источники строк', html.includes('Источники строк') && html.includes('app.asar'))
check('история выпусков', html.includes('История выпусков') && /<td>v\d+\.\d+\.\d+<\/td>/.test(html))
check('текущая версия в истории', html.includes(`<td>v${manifest.version}</td>`), manifest.version)
check('ссылки на npm и GitHub', html.includes('npmjs.com') && html.includes('github.com/nemezida1337/dsh-locale-russian'))
check('нет незаполненных шаблонов', !/undefined|NaN|\$\{/.test(html))

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки дашборда пройдены')
