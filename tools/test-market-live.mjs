#!/usr/bin/env node
/**
 * Tests the live market check against a local HTTP server: a matching index
 * passes, while a stale version, a mismatching repository copy, a missing plugin
 * and an unavailable icon are reported. Skipped when the official validator is
 * not installed.
 *
 * Usage:
 *   node tools/test-market-live.mjs
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const tool = join(import.meta.dirname, 'market-live.mjs')
const validator = [
  join(import.meta.dirname, '..', '.app-packages', 'dsh-plugin-market-index', 'lib', 'index.js'),
  join(import.meta.dirname, '..', 'node_modules', '@deepseek-ai', 'dsh-plugin-market-index', 'lib', 'index.js'),
].find((path) => existsSync(path))
if (validator === undefined) {
  console.log('пропуск: официальный валидатор не установлен')
  process.exit(0)
}

const workspace = mkdtempSync(join(tmpdir(), 'dsh-market-test-'))
const manifest = { name: 'dsh-locale-russian', version: '9.9.9', engines: { dsh: '^0.2.1-rc.2' } }
const state = { index: undefined, registry: '9.9.9', icon: true }

/** Builds an index document; the icon URL is filled in once the server listens. */
const makeIndex = ({ version = '9.9.9', name = 'dsh-locale-russian' } = {}) => ({
  format: 1,
  title: 'Русская локализация',
  plugins: [{
    name,
    description: 'Русская локализация DeepSeek Harness',
    author: 'nemezida1337',
    icon: 'http://127.0.0.1:0/icon.svg',
    versions: [{
      version,
      publishTimestamp: 1_700_000_000,
      source: { type: 'npm', name },
      engines: { dsh: '^0.2.1-rc.2' },
    }],
  }],
})

/** Starts the local server that plays both the index host and the registry. */
async function startServer() {
  const server = createServer((request, response) => {
    const url = request.url ?? ''
    if (url === '/index.json') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(state.index))
      return
    }
    if (url === '/icon.svg') {
      if (!state.icon) {
        response.writeHead(404)
        response.end('not found')
        return
      }
      response.writeHead(200, { 'content-type': 'image/svg+xml' })
      response.end('<svg xmlns="http://www.w3.org/2000/svg"/>')
      return
    }
    if (url === '/registry/dsh-locale-russian') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ 'dist-tags': { latest: state.registry } }))
      return
    }
    response.writeHead(404)
    response.end('not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  return { server, origin, indexUrl: `${origin}/index.json`, registryUrl: `${origin}/registry` }
}

/** Writes the temporary repository the tool reads. */
function prepare(localIndex) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'market'), { recursive: true })
  writeFileSync(join(workspace, 'package.json'), JSON.stringify(manifest))
  writeFileSync(join(workspace, 'market', 'index.json'), JSON.stringify(localIndex))
}

const { server, origin, indexUrl, registryUrl } = await startServer()

/** Points the index icon at the local server. */
const withIcon = (index) => {
  index.plugins[0].icon = `${origin}/icon.svg`
  return index
}

/** Runs the tool asynchronously: a synchronous child would block the local server. */
const exec = promisify(execFile)
const run = async () => {
  try {
    const { stdout, stderr } = await exec(process.execPath, [tool, '--root', workspace, '--validator', validator, '--url', indexUrl, '--registry', registryUrl], { encoding: 'utf8' })
    return { status: 0, stdout, stderr }
  } catch (error) {
    return { status: typeof error.code === 'number' ? error.code : 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

console.log('индекс совпадает')
{
  state.index = withIcon(makeIndex())
  state.registry = '9.9.9'
  prepare(state.index)
  const result = await run()
  check('код 0', result.status === 0, result.stderr)
  check('валидатор принял индекс', result.stdout.includes('живой индекс принят'))
  check('установочный spec', result.stdout.includes('dsh-locale-russian@9.9.9'))
  check('сверка с репозиторием', result.stdout.includes('совпадает с репозиторием'))
}

console.log('устаревшая версия в живом индексе')
{
  state.index = withIcon(makeIndex({ version: '9.9.0' }))
  state.registry = '9.9.9'
  prepare(withIcon(makeIndex()))
  const result = await run()
  check('расхождение версии найдено', result.status === 1 && result.stderr.includes('9.9.0'), result.stderr)
}

console.log('индекс в репозитории отличается')
{
  state.index = withIcon(makeIndex())
  prepare(withIcon(makeIndex({ version: '9.9.0' })))
  const result = await run()
  check('расхождение с репозиторием найдено', result.status === 1 && result.stderr.includes('отличается'), result.stderr)
}

console.log('пакета нет в индексе')
{
  state.index = withIcon(makeIndex({ name: 'other-plugin' }))
  prepare(withIcon(makeIndex()))
  const result = await run()
  check('отсутствие пакета найдено', result.status === 1 && result.stderr.includes('нет пакета'), result.stderr)
}

console.log('иконка недоступна')
{
  state.index = withIcon(makeIndex())
  state.icon = false
  prepare(withIcon(makeIndex()))
  const result = await run()
  check('недоступная иконка найдена', result.status === 1 && result.stderr.includes('иконка'), result.stderr)
}

await new Promise((resolve) => server.close(resolve))
rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки живого индекса пройдены')
