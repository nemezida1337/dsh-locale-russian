/**
 * Host half of the Russian localization pack: local Russian speech recognition.
 *
 * The same package already contributes the `ru` language to the web client; this
 * half registers a host-local provider in the stock `speechToText` registry, so
 * the built-in voice-input plugin records audio and inserts text as usual while
 * the recognition itself runs on the machine through gigastt + GigaAM v3 (MIT).
 * Audio never leaves the machine and no API keys are needed.
 *
 * The provider owns one managed `gigastt serve` child process, lazily started on
 * the first transcription, plus explicit model preparation with download progress.
 */
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Cordis plugin identity. The speech registry is injected dynamically inside
 * `apply`, not declared as a required dependency: a required `inject` keeps the
 * entry pending when the voice-input bundle is disabled, and DSH refuses to boot
 * with an entry that never activated.
 */
export const name = 'dsh-locale-russian'

/** Provider identity shown by the stock voice-input settings. */
const PROVIDER_ID = 'gigaam-local'
const PROVIDER_NAME = 'GigaAM v3 (локально, RU)'
/**
 * GigaAM v3 is Russian-only, so the provider advertises automatic detection
 * only: it keeps the stock `auto` default valid and never offers a language the
 * engine cannot serve. Transcription ignores the hint either way.
 */
const LANGUAGES = ['auto']

/** Engine release used when the binary is missing: downloaded on demand. */
const ENGINE_VERSION = '2.22.0'
const ENGINE_RELEASE_BASE = 'https://github.com/ekhodzitsky/gigastt/releases/download'
/** Platform targets published by the engine release, with the binary name inside. */
const ENGINE_TARGETS = {
  'darwin-arm64': { target: 'aarch64-apple-darwin', binary: 'gigastt' },
  'linux-x64': { target: 'x86_64-unknown-linux-gnu', binary: 'gigastt' },
  'linux-arm64': { target: 'aarch64-unknown-linux-gnu', binary: 'gigastt' },
  'win32-x64': { target: 'x86_64-pc-windows-msvc', binary: 'gigastt.exe' },
}

/**
 * Chooses the engine archive for a platform.
 * @param platform - Node platform id.
 * @param arch - Node architecture id.
 * @returns the release target and the binary name inside the archive.
 * @throws when the platform has no published build.
 */
function engineTarget(platform = process.platform, arch = process.arch) {
  const entry = ENGINE_TARGETS[`${platform}-${arch}`]
  if (entry === undefined) {
    throw new Error(
      `Для ${platform}-${arch} нет готовой сборки движка. Скачайте gigastt вручную: `
      + 'https://github.com/ekhodzitsky/gigastt/releases и укажите binaryPath в настройках плагина.',
    )
  }
  return entry
}

/** Managed INT8 e2e head: punctuation, casing and ITN come from the model itself. */
const MODEL_VARIANT = 'e2e_rnnt'
const MODEL_FILES = [
  'v3_e2e_rnnt_encoder_int8.onnx',
  'v3_e2e_rnnt_decoder.onnx',
  'v3_e2e_rnnt_joint.onnx',
  'v3_e2e_rnnt_vocab.txt',
]

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const DEFAULT_BINARY = join(DSH_HOME, 'bin', 'gigastt')
const DEFAULT_MODEL_DIR = join(homedir(), '.gigastt', 'models')
const READY_TIMEOUT_MS = 120_000
const STOP_TIMEOUT_MS = 3_000

/** Editable glossary: one phrase per line, reread on every recognition. */
const DEFAULT_HOTWORDS_FILE = join(DSH_HOME, 'speech-ru', 'hotwords.txt')
const DEFAULT_HOTWORDS_BOOST = 8
/** Engine limits for one request: at most 64 phrases, 64 characters each. */
const MAX_HOTWORDS = 64
const MAX_HOTWORD_LENGTH = 64
/** Seeded once when the file is missing; users edit it freely afterwards. */
const SEED_HOTWORDS = [
  '# Hotwords: bias recognition toward these exact spellings.',
  '# One phrase per line; "#" starts a comment. Tuning takes effect on the next',
  '# dictation, no restart needed. Do not add similar-sounding fragments of the',
  '# same phrase (for example both "DeepSeek Harness" and "Harness"): competing',
  '# entries corrupt the output.',
  '',
  'DeepSeek Harness',
  'DSH',
  'GigaAM',
  'gigastt',
  '',
].join('\n')

/** A cancelled preparation is not a failure; it restores the idle phase. */
class CancelledError extends Error {}

/**
 * Downloads the engine release for this platform, verifies its checksum, unpacks
 * it, and proves the binary runs before replacing the target path. Progress goes
 * through `onProgress`, cancellation through `isCancelled`.
 * @param options - target path, overrides, progress and cancellation hooks.
 * @returns after the binary is installed and verified.
 */
async function installEngine({ binaryPath, engineVersion, engineBaseUrl, onProgress, isCancelled, log }) {
  const { target, binary } = engineTarget()
  const version = engineVersion ?? ENGINE_VERSION
  const base = (engineBaseUrl ?? `${ENGINE_RELEASE_BASE}/v${version}`).replace(/\/+$/u, '')
  const archiveName = `gigastt-${version}-${target}.tar.gz`
  const archiveUrl = `${base}/${archiveName}`
  const progress = (completedBytes, totalBytes) => onProgress?.({ resource: 'Движок распознавания', completedBytes, totalBytes })
  progress(0, 0)

  const response = await fetch(archiveUrl, { signal: AbortSignal.timeout(300_000) })
  if (!response.ok) throw new Error(`Не удалось скачать движок: HTTP ${response.status} (${archiveUrl})`)
  const total = Number(response.headers.get('content-length') ?? 0)
  const chunks = []
  let received = 0
  for await (const chunk of response.body) {
    if (isCancelled?.() === true) throw new CancelledError()
    chunks.push(chunk)
    received += chunk.length
    progress(received, total)
  }
  const archive = Buffer.concat(chunks)

  const expected = await releaseChecksum(`${archiveUrl}.sha256`)
  if (expected === undefined) {
    log?.('checksum file unavailable, skipping verification')
  } else {
    const actual = createHash('sha256').update(archive).digest('hex')
    if (actual !== expected) {
      throw new Error(`Контрольная сумма движка не совпала: ожидалась ${expected.slice(0, 12)}…, получена ${actual.slice(0, 12)}…`)
    }
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'gigastt-'))
  try {
    writeFileSync(join(tempDir, archiveName), archive)
    const untar = spawnSync('tar', ['-xzf', archiveName], { cwd: tempDir, encoding: 'utf8' })
    if (untar.error !== undefined) throw new Error(`Не удалось запустить tar: ${untar.error.message}`)
    if (untar.status !== 0) throw new Error(`Не удалось распаковать архив движка: ${String(untar.stderr ?? '').slice(0, 300)}`)
    const extracted = join(tempDir, binary)
    if (!existsSync(extracted)) throw new Error(`В архиве движка нет файла ${binary}`)
    mkdirSync(dirname(binaryPath), { recursive: true })
    copyFileSync(extracted, binaryPath)
    chmodSync(binaryPath, 0o755)
    const probe = spawnSync(binaryPath, ['--version'], { encoding: 'utf8' })
    if (probe.error !== undefined) throw new Error(`Скачанный движок не запускается: ${probe.error.message}`)
    if (probe.status !== 0) throw new Error(`Скачанный движок не запускается: ${String(probe.stderr ?? '').slice(0, 300)}`)
    log?.('engine installed', binaryPath, String(probe.stdout).trim())
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

/** Reads the release checksum file; undefined when it is unavailable. */
async function releaseChecksum(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) return undefined
    const match = /^([a-f0-9]{64})/iu.exec((await response.text()).trim())
    return match === null ? undefined : match[1].toLowerCase()
  } catch {
    return undefined
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Register the GigaAM provider with the shared speech registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context with `speechToText`.
 * @param {{
 *   binaryPath?: string, modelDir?: string, port?: number, debug?: boolean,
 *   hotwords?: string[], hotwordsFile?: string, hotwordsBoost?: number,
 *   hotwordsDefault?: boolean,
 * }} [config] - local paths and recognition tuning.
 */
export function apply(ctx, config = {}) {
  const binaryPath = config.binaryPath ?? DEFAULT_BINARY
  const modelDir = config.modelDir ?? DEFAULT_MODEL_DIR
  const debug = config.debug === true
  const log = debug ? (...args) => console.log('[dsh-locale-russian]', ...args) : () => {}
  const hotwordsFile = config.hotwordsFile ?? DEFAULT_HOTWORDS_FILE
  const configHotwords = Array.isArray(config.hotwords) ? config.hotwords : []
  const hotwordsBoost = Number.isFinite(Number(config.hotwordsBoost))
    ? Math.max(0, Number(config.hotwordsBoost)) : DEFAULT_HOTWORDS_BOOST
  const hotwordsDefault = config.hotwordsDefault === true

  const listeners = new Set()
  const notify = () => {
    if (disposed) return
    for (const listener of listeners) {
      try { listener() } catch (error) { log('listener failed', error) }
    }
  }

  /** Current ordered preparation steps; empty before the first preparation. */
  let steps = []
  /** Latest public preparation state without `steps`; snapshots add them. */
  let phase = { phase: hasModel() ? 'ready' : 'unprepared' }
  /** Active preparation task, or undefined when idle. */
  let preparation
  /** Managed child process and its readiness, or undefined when stopped. */
  let server
  /** Serializes transcriptions because the engine pool is intentionally single. */
  let queue = Promise.resolve()
  let disposed = false

  function hasModel() {
    return MODEL_FILES.every((file) => existsSync(join(modelDir, file)))
  }

  /** Seed the editable glossary once so there is something to tune from day one. */
  function ensureHotwordsFile() {
    try {
      if (existsSync(hotwordsFile)) return
      mkdirSync(dirname(hotwordsFile), { recursive: true })
      writeFileSync(hotwordsFile, SEED_HOTWORDS, 'utf8')
      log('seeded hotwords', hotwordsFile)
    } catch (error) {
      log('cannot seed hotwords file', error)
    }
  }

  /**
   * Read the current glossary from config plus the editable file. The file is
   * reread on every recognition, so wording changes never need a restart.
   * Commas are rejected because the engine splits the request parameter on them.
   */
  function readHotwords() {
    const phrases = new Set()
    const add = (value) => {
      if (typeof value !== 'string') return
      const phrase = value.trim()
      if (phrase === '' || phrase.startsWith('#') || phrase.includes(',')) return
      if (phrase.length > MAX_HOTWORD_LENGTH) return
      phrases.add(phrase)
    }
    for (const phrase of configHotwords) add(phrase)
    try {
      for (const line of readFileSync(hotwordsFile, 'utf8').split('\n')) add(line)
    } catch (error) {
      log('cannot read hotwords file', error)
    }
    return [...phrases].slice(0, MAX_HOTWORDS)
  }

  function snapshot() {
    const state = { ...phase }
    if (steps.length > 0) state.steps = steps.map((step) => ({ ...step }))
    return state
  }

  function setPhase(next) {
    phase = next
    notify()
  }

  function step(kind, status) {
    const entry = steps.find((candidate) => candidate.kind === kind)
    if (entry === undefined) return
    entry.status = status
    if (status === 'running' && entry.startedAt === undefined) entry.startedAt = Date.now()
    notify()
  }

  /** Free loopback port, so several hosts or a stale server never collide. */
  function freePort() {
    return new Promise((resolve, reject) => {
      const probe = createServer()
      probe.unref()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => {
        const { port } = probe.address()
        probe.close(() => resolve(port))
      })
    })
  }

  function stderrTail(stream) {
    let tail = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => { tail = (tail + chunk).slice(-4000) })
    return () => tail
  }

  /** Start the managed engine process and wait until it can accept audio. */
  async function startServer() {
    const port = config.port ?? await freePort()
    const origin = `http://127.0.0.1:${port}`
    log('starting gigastt', binaryPath, 'on', origin)
    const child = spawn(binaryPath, [
      'serve', '--host', '127.0.0.1', '--port', String(port),
      '--model-dir', modelDir, '--profile', 'edge',
      ...(hotwordsDefault ? ['--hotwords-default'] : []),
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    const readStderr = stderrTail(child.stderr)
    const record = { child, origin }
    let spawnError

    child.once('error', (error) => { spawnError = error })
    child.once('exit', (code) => {
      const tail = readStderr().trim().split('\n').slice(-3).join(' | ')
      record.exitError = new Error(`gigastt завершился (код ${code})${tail === '' ? '' : `: ${tail}`}`)
      if (server === record) server = undefined
      log('gigastt exited', code)
    })

    const ready = (async () => {
      const deadline = Date.now() + READY_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (spawnError !== undefined) {
          throw new Error(`Не удалось запустить gigastt (${binaryPath}): ${spawnError.code ?? spawnError.message}`)
        }
        if (child.exitCode !== null) throw record.exitError
        try {
          const response = await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(2_000) })
          if (response.ok) {
            log('gigastt ready on', origin)
            return
          }
        } catch (error) {
          // not listening yet or still loading the model
        }
        await sleep(150)
      }
      throw new Error('gigastt не стал готов за 120 секунд')
    })()
    ready.catch(() => {})
    record.ready = ready
    record.exitError = undefined
    server = record
    return ready
  }

  async function stopServer() {
    const record = server
    server = undefined
    if (record === undefined) return
    if (record.child.exitCode !== null) return
    const exited = new Promise((resolve) => record.child.once('exit', resolve))
    record.child.kill('SIGTERM')
    await Promise.race([exited, sleep(STOP_TIMEOUT_MS).then(() => record.child.kill('SIGKILL'))])
  }

  async function ensureServer() {
    if (server?.child.exitCode === null) {
      try {
        await server.ready
        return
      } catch (error) {
        await stopServer()
        throw error
      }
    }
    try {
      await startServer()
    } catch (error) {
      await stopServer()
      throw error
    }
  }

  function connectionFailure(error) {
    const code = error?.cause?.code ?? error?.code
    if (['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'].includes(code)) return true
    return error instanceof Error && /fetch failed/i.test(error.message)
  }

  function wavSeconds(audio) {
    return Math.max(0, (audio.byteLength - 44) / 32_000)
  }

  async function postTranscribe(audio, signal) {
    const hotwords = readHotwords()
    let url = `${server.origin}/v1/transcribe`
    if (hotwords.length > 0) {
      url += `?hotwords=${hotwords.map((phrase) => encodeURIComponent(phrase)).join(',')}`
      url += `&hotwords_boost=${encodeURIComponent(String(hotwordsBoost))}`
    }
    log('transcribing', audio.byteLength, 'bytes; hotwords:', hotwords.length)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: audio,
      signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`GigaAM вернул HTTP ${response.status}${body === '' ? '' : `: ${body.slice(0, 300)}`}`)
    }
    return await response.json()
  }

  async function transcribe(input, signal) {
    if (!hasModel()) {
      throw new Error('Модель GigaAM не подготовлена. Откройте «Плагины → Голосовой ввод» и нажмите «Скачать и подготовить».')
    }
    await ensureServer()
    const started = performance.now()
    let payload
    try {
      payload = await postTranscribe(input.audio, signal)
    } catch (error) {
      if (signal.aborted || !connectionFailure(error)) throw error
      log('engine connection failed, restarting')
      await ensureServer()
      payload = await postTranscribe(input.audio, signal)
    }
    const text = typeof payload.text === 'string' ? payload.text.trim() : ''
    log('transcribed', text.length, 'chars')
    return {
      text,
      audioSeconds: typeof payload.duration === 'number' ? payload.duration : wavSeconds(input.audio),
      inferenceSeconds: (performance.now() - started) / 1000,
    }
  }

  function serialized(task) {
    const run = queue.then(task, task)
    queue = run.then(() => {}, () => {})
    return run
  }

  /** Download the managed model with per-file progress events. */
  function downloadModel(task) {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, [
        'download', '--model-variant', MODEL_VARIANT, '--model-dir', modelDir, '--progress', 'json',
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      task.child = child
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout += chunk
        let index
        while ((index = stdout.indexOf('\n')) >= 0) {
          const line = stdout.slice(0, index).trim()
          stdout = stdout.slice(index + 1)
          if (!line.startsWith('{')) continue
          let event
          try { event = JSON.parse(line) } catch { continue }
          if (event.phase === 'download' && typeof event.bytes_total === 'number') {
            setPhase({
              phase: 'downloading',
              resource: String(event.file ?? 'GigaAM'),
              completedBytes: Number(event.bytes_done ?? 0),
              totalBytes: Number(event.bytes_total),
            })
          } else if (event.phase === 'done') {
            setPhase({ phase: 'loading', startedAt: Date.now(), step: 'verify' })
            step('model', 'complete')
            step('verify', 'running')
          }
        }
      })
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000) })
      child.on('error', (error) => reject(new Error(`Не удалось запустить ${binaryPath}: ${error.code ?? error.message}`)))
      child.on('exit', (code) => {
        task.child = undefined
        if (task.cancelled) { reject(new CancelledError()); return }
        if (code === 0) {
          step('model', 'complete')
          step('verify', 'complete')
          resolve()
          return
        }
        const tail = stderr.trim().split('\n').slice(-2).join(' | ')
        reject(new Error(`Загрузка модели завершилась с кодом ${code}${tail === '' ? '' : `: ${tail}`}`))
      })
    })
  }

  /**
   * Check resources, download the model when missing, then load the engine.
   * The host owns this task across page and session changes.
   */
  async function runPreparation() {
    if (preparation !== undefined) return preparation.done
    if (phase.phase === 'ready' || phase.phase === 'standby') return
    const task = { cancelled: false }
    preparation = task
    steps = ['check', 'engine', 'model', 'verify', 'load'].map((kind) => ({ kind, status: 'pending' }))
    setPhase({ phase: 'checking', startedAt: Date.now(), step: 'check' })
    step('check', 'running')
    task.done = (async () => {
      try {
        await sleep(0)
        const present = hasModel()
        step('check', 'complete')
        if (existsSync(binaryPath)) {
          step('engine', 'complete')
        } else {
          // Одна кнопка: недостающий движок ставится здесь же, до модели.
          step('engine', 'running')
          setPhase({ phase: 'downloading', startedAt: Date.now(), step: 'engine', resource: 'Движок распознавания' })
          await installEngine({
            binaryPath,
            engineVersion: config.engineVersion,
            engineBaseUrl: config.engineBaseUrl,
            log,
            isCancelled: () => task.cancelled,
            onProgress: (update) => setPhase({
              phase: 'downloading',
              startedAt: phase.startedAt ?? Date.now(),
              step: 'engine',
              resource: update.resource,
              completedBytes: update.completedBytes,
              totalBytes: update.totalBytes,
            }),
          })
          step('engine', 'complete')
          if (task.cancelled) throw new CancelledError()
        }
        if (present) {
          step('model', 'complete')
          step('verify', 'complete')
        } else {
          step('model', 'running')
          await downloadModel(task)
          if (task.cancelled) throw new CancelledError()
        }
        setPhase({ phase: 'loading', startedAt: Date.now(), step: 'load' })
        step('load', 'running')
        await ensureServer()
        if (task.cancelled) throw new CancelledError()
        step('load', 'complete')
        setPhase({ phase: 'ready' })
        log('preparation ready')
      } catch (error) {
        for (const entry of steps) if (entry.status === 'running') entry.status = 'cancelled'
        if (task.cancelled || error instanceof CancelledError) setPhase({ phase: 'cancelled' })
        else setPhase({ phase: 'failed', message: error instanceof Error ? error.message : String(error) })
      } finally {
        preparation = undefined
        notify()
      }
    })()
    return task.done
  }

  async function cancelPreparation() {
    const task = preparation
    if (task === undefined) {
      if (phase.phase !== 'ready' && phase.phase !== 'standby') setPhase({ phase: 'cancelled' })
      return
    }
    task.cancelled = true
    task.child?.kill('SIGTERM')
    await task.done.catch(() => {})
    await stopServer()
  }

  const preparationApi = {
    snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    prepare() { void runPreparation() },
    cancel() { return cancelPreparation() },
  }

  ensureHotwordsFile()

  /**
   * Starts the engine in the background when this provider is the selection and
   * the model is ready, so the first dictation does not wait for the model load.
   * The start is delayed: the app finishes booting first. A change of the
   * selected provider is observed through the service stream.
   * @param ctx - scoped context carrying the speech service.
   * @returns disposer that cancels the delayed start and the subscription.
   */
  function schedulePrewarm(ctx) {
    if (config.prewarm === false) return () => {}
    let started = false
    const controller = new AbortController()
    const warm = () => {
      if (started) return
      if (!existsSync(binaryPath) || !hasModel()) return
      started = true
      log('prewarming engine')
      void ensureServer().catch((error) => {
        started = false
        log('prewarm failed', error instanceof Error ? error.message : String(error))
      })
    }
    const timer = setTimeout(() => {
      try {
        if (ctx.speechToText.snapshot?.()?.selection?.providerId === PROVIDER_ID) warm()
      } catch (error) {
        log('prewarm skipped', error instanceof Error ? error.message : String(error))
      }
    }, config.prewarmDelayMs ?? 5_000)
    const follow = (async () => {
      try {
        for await (const snapshot of ctx.speechToText.follow?.(controller.signal) ?? []) {
          if (snapshot?.selection?.providerId === PROVIDER_ID) warm()
        }
      } catch (error) {
        if (controller.signal.aborted !== true) {
          log('prewarm follow failed', error instanceof Error ? error.message : String(error))
        }
      }
    })()
    return () => {
      clearTimeout(timer)
      controller.abort()
      void follow
    }
  }

  // Провайдер появляется только там, где включён голосовой ввод; без сервиса
  // плагин остаётся активным и просто ничего не регистрирует.
  ctx.inject(['speechToText'], (ctx) => {
    ctx.effect(() => {
      const remove = ctx.speechToText.register({
      info: {
        id: PROVIDER_ID,
        name: PROVIDER_NAME,
        location: 'host-local',
        languages: LANGUAGES,
        setupEstimate: {
          recommendedDiskBytes: 500_000_000,
          expectedMemoryBytes: 1_000_000_000,
          minimumMinutes: 1,
          maximumMinutes: 5,
        },
      },
      preparation: preparationApi,
      transcribe: (input, signal) => serialized(() => transcribe(input, signal)),
    })
    console.log(`[dsh-locale-russian] registered ${PROVIDER_ID} (${PROVIDER_NAME}); binary=${binaryPath} modelDir=${modelDir} hotwords=${readHotwords().length} boost=${hotwordsBoost}`)
      return async () => {
        disposed = true
        const active = preparation
        if (active !== undefined) {
          active.cancelled = true
          active.child?.kill('SIGTERM')
        }
        listeners.clear()
        await stopServer()
        await remove()
      }
    })
    // Прогрев необязателен: ошибки не мешают работе провайдера.
    ctx.effect(() => schedulePrewarm(ctx), '__MODULE_ID__: prewarm')
  })
}

/** Test seam: helpers and data exercised by the offline tests. */
export const internals = { engineTarget, installEngine, modelFiles: MODEL_FILES }
