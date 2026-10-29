#!/usr/bin/env node
/**
 * Tests the engine prewarm: the provider starts the engine in the background when
 * it is the selected recognizer and the model is ready, does not start it
 * otherwise, reacts to a selection change, and stops the engine on dispose.
 *
 * The engine is a stand-in script that answers `/ready` and records start and
 * stop in marker files.
 *
 * Usage:
 *   node tools/test-prewarm.mjs
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const workspace = mkdtempSync(join(tmpdir(), 'dsh-prewarm-test-'))
const marker = join(workspace, 'started')
const stopMarker = join(workspace, 'stopped')

/** The stand-in engine: serves `/ready` and records its lifecycle. */
function writeEngine() {
  const path = join(workspace, 'fake-gigastt')
  writeFileSync(path, `#!${process.execPath}
const http = require('node:http')
const fs = require('node:fs')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('gigastt 2.22.0'); process.exit(0) }
if (args[0] !== 'serve') process.exit(0)
const port = Number(args[args.indexOf('--port') + 1])
fs.writeFileSync(${JSON.stringify(marker)}, String(port))
const server = http.createServer((request, response) => { response.writeHead(200); response.end('ok') })
server.listen(port, '127.0.0.1')
const stop = () => { fs.writeFileSync(${JSON.stringify(stopMarker)}, '1'); server.close(() => process.exit(0)) }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
`)
  chmodSync(path, 0o755)
  return path
}

/** Creates the model files the provider expects. */
function writeModel(dir) {
  mkdirSync(dir, { recursive: true })
  for (const name of internals.modelFiles) writeFileSync(join(dir, name), 'x')
}

/** A stand-in speech service. */
function makeService({ selected = 'gigaam-local', follow = [] } = {}) {
  const registered = []
  return {
    registered,
    register(provider) {
      registered.push(provider)
      return async () => {}
    },
    snapshot() {
      return { selection: { providerId: selected }, providers: [] }
    },
    async *follow(signal) {
      for (const snapshot of follow) {
        if (signal.aborted === true) return
        yield snapshot
      }
    },
  }
}

/** Builds a Cordis-like context around a service. */
function makeCtx(service) {
  const cleanups = []
  const ctx = {
    inject(names, callback) {
      callback(makeScoped(service, cleanups))
    },
    effect(callback) {
      const disposer = callback()
      cleanups.push(typeof disposer === 'function' ? disposer : () => {})
      return disposer
    },
  }
  return { ctx, cleanups }
}

function makeScoped(service, cleanups) {
  return {
    speechToText: service,
    effect(callback) {
      const disposer = callback()
      cleanups.push(typeof disposer === 'function' ? disposer : () => {})
      return disposer
    },
  }
}

/** Waits until a file appears or the timeout expires. */
async function waitFor(path, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(path)) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

const binaryPath = writeEngine()
const modelDir = join(workspace, 'models')
writeModel(modelDir)

/** Runs one scenario and returns whether the engine started. */
async function scenario({ config = {}, service = makeService(), delay = 3000 } = {}) {
  rmSync(marker, { force: true })
  rmSync(stopMarker, { force: true })
  const { apply } = await import(`../lib/index.js?case=${Math.random()}`)
  const { ctx, cleanups } = makeCtx(service)
  apply(ctx, {
    binaryPath,
    modelDir,
    hotwordsFile: join(workspace, 'hotwords.txt'),
    prewarmDelayMs: 0,
    ...config,
  })
  const started = await waitFor(marker, delay)
  for (const cleanup of cleanups.reverse()) await cleanup()
  const stopped = await waitFor(stopMarker, 2_000)
  return { started, stopped, service }
}

console.log('прогрев при выбранном провайдере')
{
  const result = await scenario()
  check('движок запущен', result.started)
  check('провайдер зарегистрирован', result.service.registered.length === 1)
  check('при выгрузке движок остановлен', result.stopped)
}

console.log('прогрев отключён')
{
  const result = await scenario({ config: { prewarm: false }, delay: 1_200 })
  check('движок не запущен', !result.started)
}

console.log('выбран другой провайдер')
{
  const result = await scenario({ service: makeService({ selected: 'sensevoice' }), delay: 1_200 })
  check('движок не запущен', !result.started)
}

console.log('модель не подготовлена')
{
  const emptyModels = join(workspace, 'empty-models')
  mkdirSync(emptyModels, { recursive: true })
  const result = await scenario({ config: { modelDir: emptyModels }, delay: 1_200 })
  check('движок не запущен', !result.started)
}

console.log('смена провайдера в настройках')
{
  const service = makeService({
    selected: 'sensevoice',
    follow: [{ selection: { providerId: 'sensevoice' } }, { selection: { providerId: 'gigaam-local' } }],
  })
  const result = await scenario({ service })
  check('движок запущен после выбора нашего провайдера', result.started)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки прогрева пройдены')
