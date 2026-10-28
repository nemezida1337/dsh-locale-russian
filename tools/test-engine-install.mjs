#!/usr/bin/env node
/**
 * Offline test for the one-button engine installation: it serves a fake release
 * (a tarball with a stand-in `gigastt` script plus its checksum) from a local
 * HTTP server and checks platform selection, download progress, checksum
 * verification, unpacking, the run probe, and the failure paths.
 *
 * Usage:
 *   node tools/test-engine-install.mjs
 */
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { internals } from '../lib/index.js'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const workspace = mkdtempSync(join(tmpdir(), 'dsh-engine-test-'))

console.log('выбор платформенной сборки')
check('macOS arm64', internals.engineTarget('darwin', 'arm64').target === 'aarch64-apple-darwin')
check('macOS arm64: имя бинарника', internals.engineTarget('darwin', 'arm64').binary === 'gigastt')
check('Linux x64', internals.engineTarget('linux', 'x64').target === 'x86_64-unknown-linux-gnu')
check('Linux arm64', internals.engineTarget('linux', 'arm64').target === 'aarch64-unknown-linux-gnu')
check('Windows x64: .exe', internals.engineTarget('win32', 'x64').binary === 'gigastt.exe')
let unsupported
try {
  internals.engineTarget('darwin', 'x64')
} catch (error) {
  unsupported = error
}
check('неподдерживаемая платформа объясняет, что делать', unsupported instanceof Error && unsupported.message.includes('gigastt/releases'), unsupported?.message)

const { target, binary } = internals.engineTarget()
const version = '2.22.0'
const archiveName = `gigastt-${version}-${target}.tar.gz`

/** Creates the fake release archive: a stand-in engine that answers --version. */
function buildArchive() {
  const stage = join(workspace, 'stage')
  mkdirSync(stage, { recursive: true })
  const script = join(stage, binary)
  writeFileSync(script, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "gigastt 2.22.0"; exit 0; fi\nexit 0\n')
  chmodSync(script, 0o755)
  const archive = join(workspace, archiveName)
  const result = spawnSync('tar', ['-czf', archive, binary], { cwd: stage, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`не удалось собрать тестовый архив: ${result.stderr}`)
  return readFileSync(archive)
}

const archive = buildArchive()
const checksum = createHash('sha256').update(archive).digest('hex')

/** Starts a local release server; `mode` decides what it serves. */
async function startServer(mode) {
  const server = createServer((request, response) => {
    const url = request.url ?? ''
    if (mode === 'missing') {
      response.writeHead(404)
      response.end('not found')
      return
    }
    if (url.endsWith('.sha256')) {
      if (mode === 'no-checksum') {
        response.writeHead(404)
        response.end('not found')
        return
      }
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end(`${mode === 'bad-checksum' ? 'f'.repeat(64) : checksum}  ${archiveName}\n`)
      return
    }
    if (url.endsWith('.tar.gz')) {
      response.writeHead(200, { 'content-type': 'application/gzip', 'content-length': archive.length })
      response.end(archive)
      return
    }
    response.writeHead(404)
    response.end('not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` }
}

/** Runs the installer against a local release and returns its outcome. */
async function install(mode) {
  const { server, baseUrl } = await startServer(mode)
  const binaryPath = join(workspace, `installed-${mode}`, binary)
  const progress = []
  let error
  try {
    await internals.installEngine({
      binaryPath,
      engineVersion: version,
      engineBaseUrl: baseUrl,
      onProgress: (update) => progress.push(update),
      isCancelled: () => false,
      log: () => {},
    })
  } catch (caught) {
    error = caught
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  return { binaryPath, progress, error }
}

console.log('установка движка')
{
  const result = await install('ok')
  check('ошибки нет', result.error === undefined, result.error?.message)
  check('бинарник на месте', existsSync(result.binaryPath))
  check('бинарник исполняемый', (statSync(result.binaryPath).mode & 0o111) !== 0)
  check('прогресс сообщался', result.progress.length > 0 && result.progress.some((update) => update.totalBytes > 0))
  const probe = spawnSync(result.binaryPath, ['--version'], { encoding: 'utf8' })
  check('бинарник запускается и отвечает версией', probe.status === 0 && probe.stdout.includes('gigastt 2.22.0'), probe.stdout ?? probe.stderr)
}

console.log('контрольная сумма')
{
  const result = await install('bad-checksum')
  check('несовпадение суммы — ошибка', result.error instanceof Error && result.error.message.includes('Контрольная сумма'), result.error?.message)
  check('бинарник не установлен', !existsSync(result.binaryPath))
}

console.log('сумма недоступна')
{
  const result = await install('no-checksum')
  check('без файла суммы установка продолжается', result.error === undefined, result.error?.message)
  check('бинарник установлен', existsSync(result.binaryPath))
}

console.log('релиз недоступен')
{
  const result = await install('missing')
  check('404 — понятная ошибка', result.error instanceof Error && result.error.message.includes('HTTP 404'), result.error?.message)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки установки движка пройдены')
