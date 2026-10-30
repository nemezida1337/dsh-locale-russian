#!/usr/bin/env node
/**
 * End-to-end check of the speech engine: installs (or reuses) the engine, makes
 * sure the model is prepared, transcribes a recorded Russian sample through the
 * provider itself, and asserts the recognized text.
 *
 * Runs on any platform with a published engine build: macOS arm64, Linux
 * x64/arm64 and Windows x64. The CI job `engine-smoke` runs it weekly on Linux
 * and Windows, where the plugin otherwise never meets a real engine.
 *
 * Usage:
 *   node tools/engine-smoke.mjs [--work <dir>] [--binary <path>] [--model-dir <dir>] [--keep]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { apply, internals } from '../lib/index.js'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option, flag } = createArgs()

const work = resolve(option('work', join(tmpdir(), 'dsh-engine-smoke')))
const keep = flag('keep')
const fixture = resolve(option('fixture', join(root, 'test/fixtures/ru-sample.wav')))
const engineVersion = option('engine-version', '2.22.0')

/** A stand-in speech service that only captures the registered provider. */
function makeService() {
  const registered = []
  return {
    registered,
    register(provider) {
      registered.push(provider)
      return async () => {}
    },
    snapshot() {
      return { selection: { providerId: 'gigaam-local' }, providers: [] }
    },
    async *follow() {},
  }
}

/** Builds a Cordis-like context. */
function makeCtx(service) {
  const cleanups = []
  const scoped = {
    speechToText: service,
    effect(callback) {
      const disposer = callback()
      cleanups.push(typeof disposer === 'function' ? disposer : () => {})
      return disposer
    },
  }
  return {
    ctx: {
      inject(names, callback) {
        callback(scoped)
      },
      effect(callback) {
        const disposer = callback()
        cleanups.push(typeof disposer === 'function' ? disposer : () => {})
        return disposer
      },
    },
    cleanups,
  }
}

/** Waits until the model is prepared, the preparation fails, or time runs out. */
async function waitForModel(provider, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastPhase
  while (Date.now() < deadline) {
    const snapshot = provider.preparation.snapshot()
    if (snapshot.phase !== lastPhase) {
      lastPhase = snapshot.phase
      const percent = snapshot.totalBytes > 0 ? ` ${Math.round((snapshot.completedBytes / snapshot.totalBytes) * 100)}%` : ''
      console.log(`  подготовка: ${snapshot.phase}${snapshot.resource === undefined ? '' : ` · ${snapshot.resource}`}${percent}`)
    }
    if (snapshot.phase === 'ready' || snapshot.phase === 'standby') return
    if (snapshot.phase === 'failed') throw new Error(`подготовка модели не удалась: ${snapshot.message ?? 'без сообщения'}`)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`модель не подготовилась за ${Math.round(timeoutMs / 60_000)} минут`)
}

/** Entry point: engine, model, transcription, checks. */
async function main() {
  if (!existsSync(fixture)) throw new Error(`нет тестовой записи: ${fixture}`)
  mkdirSync(work, { recursive: true })
  console.log(`платформа: ${process.platform}-${process.arch}`)

  const binaryPath = resolve(option('binary', join(work, 'bin', process.platform === 'win32' ? 'gigastt.exe' : 'gigastt')))
  if (existsSync(binaryPath)) {
    console.log(`движок уже на месте: ${binaryPath}`)
  } else {
    console.log('скачивание движка…')
    await internals.installEngine({
      binaryPath,
      engineVersion,
      onProgress: (update) => {
        if (update.totalBytes > 0) process.stdout.write(`\r  ${Math.round((update.completedBytes / update.totalBytes) * 100)}%`)
      },
      log: (...args) => console.log('  ', ...args),
    })
    process.stdout.write('\n')
  }
  const version = spawnSync(binaryPath, ['--version'], { encoding: 'utf8' })
  if (version.status !== 0) throw new Error(`движок не запускается: ${version.stderr ?? version.error?.message}`)
  console.log(`движок: ${String(version.stdout).trim()}`)

  const modelDir = resolve(option('model-dir', join(work, 'models')))
  const modelComplete = internals.modelFiles.every((name) => existsSync(join(modelDir, name)))
  console.log(`модель: ${modelComplete ? 'готова' : 'будет скачана'} (${modelDir})`)

  const service = makeService()
  const { ctx, cleanups } = makeCtx(service)
  apply(ctx, {
    binaryPath,
    modelDir,
    hotwordsFile: join(work, 'hotwords.txt'),
    prewarm: false,
  })
  const provider = service.registered[0]
  if (provider === undefined) throw new Error('провайдер не зарегистрировался')
  console.log('провайдер зарегистрирован')

  try {
    if (!modelComplete) {
      provider.preparation.prepare()
      await waitForModel(provider, 25 * 60_000)
    }
    const audio = readFileSync(fixture)
    console.log(`распознавание: ${fixture.replace(`${root}/`, '')} (${Math.round(audio.length / 1024)} КБ)`)
    const started = Date.now()
    const result = await provider.transcribe({ audio }, AbortSignal.timeout(300_000))
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`текст: «${result.text}»`)
    console.log(`время: ${seconds} с, аудио: ${result.audioSeconds?.toFixed?.(2) ?? '?'} с`)
    if (typeof result.text !== 'string' || result.text.trim().length === 0) {
      throw new Error('движок вернул пустой текст')
    }
    if (!/проверк|связ|один|два|три/iu.test(result.text)) {
      throw new Error(`распознанный текст не похож на тестовую запись: «${result.text}»`)
    }
    writeFileSync(join(work, 'result.json'), JSON.stringify({ platform: `${process.platform}-${process.arch}`, engine: String(version.stdout).trim(), text: result.text, seconds: Number(seconds) }, null, 2))
    console.log('движок работает: текст распознан')
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup()
  }
  if (!keep) rmSync(work, { recursive: true, force: true })
}

main().catch((error) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
