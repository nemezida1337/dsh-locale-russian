#!/usr/bin/env node
/**
 * Tests the coverage-history builder in a temporary git repository: entries come
 * from tags, the current version is always present, and `--check` reports a
 * committed history that lags behind.
 *
 * Usage:
 *   node tools/test-history.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const tool = join(import.meta.dirname, 'build-history.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-history-test-'))
const git = (...args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/** Writes a minimal repository with one tagged release. */
function prepare() {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'dictionary'), { recursive: true })
  mkdirSync(join(workspace, 'market'), { recursive: true })
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'pack', version: '2.0.0' }))
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify({ a: { one: '1', two: '2' } }))
  writeFileSync(join(workspace, 'dictionary', 'plugin-meta.json'), JSON.stringify({ x: 'икс' }))
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  git('add', '.')
  git('commit', '-qm', 'first')
  git('tag', 'v1.0.0')
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify({ a: { one: '1', two: '2' }, b: { three: '3' } }))
  git('add', '.')
  git('commit', '-qm', 'second')
  git('tag', 'v1.1.0')
}

const run = (args = []) => spawnSync(process.execPath, [tool, '--root', workspace, ...args], { encoding: 'utf8' })

console.log('история из тегов')
prepare()
{
  const result = run()
  check('код 0', result.status === 0, result.stderr)
  const history = JSON.parse(readFileSync(join(workspace, 'market', 'history.json'), 'utf8'))
  check('две версии из тегов и текущая', history.versions.length === 3, history.versions.map((entry) => entry.version).join(','))
  const first = history.versions.find((entry) => entry.version === '1.0.0')
  const second = history.versions.find((entry) => entry.version === '1.1.0')
  check('строки первой версии', first?.strings === 2, String(first?.strings))
  check('строки второй версии', second?.strings === 3, String(second?.strings))
  check('описания плагинов', first?.pluginDescriptions === 1)
  check('текущая версия в конце', history.versions.at(-1)?.version === '2.0.0')
  check('check проходит на свежей истории', run(['--check']).status === 0)
}

console.log('история устарела')
prepare()
{
  run()
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify({ a: { one: '1' }, b: { three: '3' }, c: { four: '4' } }))
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'pack', version: '2.1.0' }))
  const stale = run(['--check'])
  check('check падает без текущей версии', stale.status === 1, stale.stdout || stale.stderr)
  run()
  check('после пересборки check проходит', run(['--check']).status === 0)
}

console.log('мелкий клон без тегов')
prepare()
{
  run()
  git('tag', '-d', 'v1.0.0')
  git('tag', '-d', 'v1.1.0')
  const result = run(['--check'])
  check('текущая версия считается на месте', result.status === 0, result.stderr)
  check('файл истории не перезаписан пустым', existsSync(join(workspace, 'market', 'history.json')))
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки истории покрытия пройдены')
