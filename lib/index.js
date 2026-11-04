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
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  MAX_HOTWORD_LENGTH,
  MAX_PERSONAL_HOTWORDS,
  PERSONAL_END,
  PERSONAL_MARKER,
  addPersonalHotword as addPersonalPhrase,
  forgetPersonalHotword as forgetPersonalPhrase,
  readPersonalHotwords,
  applyReplacements,
  readReplacements,
  removeReplacement,
  renderReplacements,
  normalizePhrase,
  upsertReplacement,
} from './hotwords.mjs'

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
// Движок принимает не больше 64 hotwords в HTTP-запросе, но файл при старте
// читает целиком (проверено на 200 фразах), поэтому лимит относится к файлу.
const MAX_HOTWORDS = 500
/** Маркеры и лимиты личного словаря живут в lib/hotwords.mjs. */
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
 *   hotwordsDefault?: boolean, dictionaryPort?: number, replacementsFile?: string,
 *   hotwordsWatchMs?: number, engine?: 'gigaam' | 'whisper' | 'hybrid',
 *   merge?: 'text' | 'words', debugTranscripts?: boolean,
 *   whisperBinaryPath?: string, whisperModelPath?: string, whisperLanguage?: string,
 * }} [config] - local paths and recognition tuning.
 */
export function apply(ctx, config = {}) {
  const binaryPath = config.binaryPath ?? DEFAULT_BINARY
  const modelDir = config.modelDir ?? DEFAULT_MODEL_DIR
  const debug = config.debug === true
  const log = debug ? (...args) => console.log('[dsh-locale-russian]', ...args) : () => {}
  const hotwordsFile = config.hotwordsFile ?? DEFAULT_HOTWORDS_FILE
  /** Engine mode: GigaAM only, Whisper only, or both with a merge. */
  const engineMode = config.engine === 'whisper' || config.engine === 'hybrid' ? config.engine : 'gigaam'
  const whisperBinaryPath = config.whisperBinaryPath ?? join(DSH_HOME, 'bin', 'whisper-cli')
  const whisperModelPath = config.whisperModelPath ?? join(DSH_HOME, 'speech-ru', 'whisper', 'ggml-large-v3-turbo-q5_0.bin')
  const whisperLanguage = config.whisperLanguage ?? 'ru'
  // Замены «как услышали → как надо» живут рядом со словарём.
  const replacementsFile = config.replacementsFile ?? join(dirname(hotwordsFile), 'replacements.json')
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
  /** Отпечаток файла словаря на момент старта движка. */
  let hotwordsSignature
  /** Serializes transcriptions because the engine pool is intentionally single. */
  let queue = Promise.resolve()
  /** True while a transcription is running: background reloads wait for it. */
  let transcribing = false
  /** Word timings of the last GigaAM pass (seconds from the audio start). */
  let gigaamWords = []
  /** GigaAM text behind the timings (hybrid output may differ). */
  let gigaamTextForTimings = ''
  /** Audio duration reported by GigaAM, when available. */
  let gigaamAudioSeconds
  /** True while a background engine reload is in flight. */
  let reloading = false
  /** Info about the last transcription: applied replacements, for the client. */
  let lastTranscription
  let disposed = false

  function hasModel() {
    return MODEL_FILES.every((file) => existsSync(join(modelDir, file)))
  }

  /** Seed the editable glossary once so there is something to tune from day one. */
  /**
   * Adds a phrase to the personal dictionary section of the hotwords file.
   * @param raw - phrase typed or selected in the interface.
   * @returns the result with the current dictionary size.
   */
  function addPersonalHotword(raw) {
    let current
    try {
      current = readFileSync(hotwordsFile, 'utf8')
    } catch {
      current = SEED_HOTWORDS
    }
    const result = addPersonalPhrase(current, raw)
    if (!result.ok) return result
    if (result.duplicate === true) return { ok: true, duplicate: true, count: result.count }
    try {
      writeFileSync(hotwordsFile, result.text)
    } catch (error) {
      log('cannot write personal hotword', error)
      return { ok: false, reason: 'write-failed' }
    }
    log('personal hotword added', String(raw).trim(), 'total', result.count)
    return { ok: true, count: result.count }
  }

  /** Path of the desktop profile patch that carries the engine configuration. */
  function engineConfigPath() {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    return join(home, 'profiles', 'desktop', 'cordis.patch.yml')
  }

  /** Removes the `- id: locale-ru` block from patch lines. */
  function stripEngineBlock(lines) {
    const result = []
    let skipping = false
    for (const line of lines) {
      if (line.startsWith('- id: locale-ru')) {
        while (result.length > 0 && (result[result.length - 1].trim() === '' || result[result.length - 1].startsWith('# Гибрид GigaAM + Whisper'))) result.pop()
        skipping = true
        continue
      }
      if (skipping) {
        if (line.startsWith('  ') || line.trim() === '') continue
        skipping = false
      }
      result.push(line)
    }
    return result
  }

  /**
   * Writes the engine choice into the desktop profile patch.
   * @param engine - gigaam, whisper or hybrid.
   * @param merge - auto, sentences, text or words.
   * @returns the result for the client.
   */
  function writeEngineConfig(engine, merge) {
    const path = engineConfigPath()
    if (!existsSync(path)) return { ok: false, reason: 'profile-not-found' }
    const lines = stripEngineBlock(readFileSync(path, 'utf8').split('\n'))
    const block = [
      '# Гибрид GigaAM + Whisper: английские термины от Whisper, русская речь от GigaAM.',
      '- id: locale-ru',
      '  config:',
      `    engine: ${engine}`,
      `    merge: ${merge}`,
    ]
    if (existsSync(whisperBinaryPath)) block.push(`    whisperBinaryPath: ${whisperBinaryPath}`)
    if (existsSync(whisperModelPath)) block.push(`    whisperModelPath: ${whisperModelPath}`)
    try {
      writeFileSync(path, `${lines.join('\n').replace(/\n+$/u, '')}\n\n${block.join('\n')}\n`)
    } catch (error) {
      log('cannot write engine config', error)
      return { ok: false, reason: 'write-failed' }
    }
    return { ok: true, engine, merge, restartRequired: true }
  }

  /** Cyrillic → Latin map for phonetic comparison of dictated terms. */
  const SUGGEST_TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z',
    'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh',
    'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  }

  /** Phonetic key of a word: transliterated, lowercase, letters and digits only. */
  function phoneticKey(value) {
    return Array.from(String(value ?? '')).map((character) => SUGGEST_TRANSLIT[character.toLowerCase()] ?? character).join('')
      .toLowerCase().replace(/[^a-z0-9]+/gu, '')
  }

  /** Similarity of two words by phonetic key. */
  function phoneticSimilarity(left, right) {
    const a = phoneticKey(left)
    const b = phoneticKey(right)
    if (a === '' || b === '') return 0
    if (a === b) return 1
    return 1 - wordDistance(a, b) / Math.max(a.length, b.length)
  }

  /** Words that are never suggested as terminology. */
  const SUGGEST_STOPWORDS = new Set([
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
    'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее',
    'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
    'даже', 'ну', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас',
    'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо',
    'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'чего', 'раз',
    'тоже', 'себе', 'под', 'будет', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого',
    'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой', 'тем', 'чтобы',
    'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда', 'можно', 'при', 'наконец',
    'два', 'об', 'другой', 'хоть', 'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас',
    'про', 'всего', 'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем',
    'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя', 'такой',
    'им', 'более', 'всегда', 'конечно', 'всю', 'между', 'the', 'and', 'for', 'with', 'from',
    'this', 'that', 'true', 'false', 'null', 'undefined', 'function', 'return', 'import',
    'export', 'const', 'let', 'var', 'class', 'type', 'string', 'number', 'boolean', 'object',
    'array', 'async', 'await', 'promise', 'error', 'data', 'value', 'name', 'key', 'index',
    'test', 'main', 'app', 'src', 'lib', 'config', 'utils', 'helper', 'common', 'core',
    'http', 'https', 'get', 'set', 'post', 'put', 'delete', 'use', 'new', 'create', 'update',
    'remove', 'add', 'list', 'item', 'items', 'props', 'state', 'render', 'component', 'page',
    'layout', 'button', 'input', 'form', 'modal', 'header', 'footer', 'sidebar', 'style',
    'theme', 'color', 'icon', 'image', 'file', 'files', 'path', 'url', 'request', 'response',
    'server', 'client', 'user', 'users', 'auth', 'login', 'token', 'session', 'json', 'text',
    'title', 'description', 'version', 'options', 'option', 'params', 'param', 'args', 'arg',
    'result', 'results', 'event', 'events', 'handler', 'callback', 'hook', 'effect', 'ref',
    'model', 'models', 'view', 'views', 'router', 'route', 'routes', 'store', 'action',
    'actions', 'reducer', 'selector', 'context', 'provider', 'service', 'services', 'manager',
    'factory', 'builder', 'parser', 'engine', 'runner', 'worker', 'queue', 'cache', 'storage',
    'settings', 'env', 'environment', 'package', 'packages', 'module', 'modules', 'default',
    'docs', 'readme', 'license', 'changelog', 'scripts', 'example', 'examples', 'demo',
    'public', 'static', 'assets', 'images', 'fonts', 'icons', 'styles', 'types', 'typing',
    'utils', 'shared', 'helpers',
  ])

  /**
   * Suggests dictionary entries from recent transcripts: tokens that look like
   * garbled terms but are not in the dictionary yet.
   * @param limit - how many suggestions to return.
   * @returns suggested heard → chosen pairs with counts.
   */
  function suggestTerms(limit = 10) {
    const historyFile = join(dirname(hotwordsFile), 'transcripts.json')
    let history = []
    try {
      const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
      if (Array.isArray(parsed)) history = parsed
    } catch {
      history = []
    }
    const knownWords = new Set(readHotwords().map((word) => word.toLowerCase()))
    const knownHeard = new Set(Object.keys(readReplacementsFile()).map((word) => word.toLowerCase()))
    const dictionary = [...readHotwords(), ...Object.values(readReplacementsFile())]
    const counts = new Map()
    for (const entry of history.slice(-20)) {
      for (const token of String(entry.merged ?? '').split(/\s+/u)) {
        const core = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
        if (core.length < 4 || core.length > 40) continue
        const lower = core.toLowerCase()
        if (SUGGEST_STOPWORDS.has(lower) || knownWords.has(lower) || knownHeard.has(lower)) continue
        if (/\d/u.test(core)) continue
        counts.set(lower, (counts.get(lower) ?? 0) + 1)
      }
    }
    const suggestions = []
    for (const [lower, count] of counts) {
      let bestTerm
      let bestScore = 0
      for (const term of dictionary) {
        const score = phoneticSimilarity(lower, term)
        if (score > bestScore) {
          bestScore = score
          bestTerm = term
        }
      }
      const threshold = /[A-Za-z]/u.test(lower) ? 0.6 : 0.7
      if (bestTerm === undefined || bestScore < threshold) continue
      if (bestTerm.toLowerCase() === lower) continue
      suggestions.push({ heard: lower, chosen: bestTerm, score: Number(bestScore.toFixed(2)), count })
    }
    suggestions.sort((left, right) => right.count - left.count || right.score - left.score)
    return suggestions.slice(0, limit)
  }

  /** Path of the voice-input settings file. */
  function settingsFilePath() {
    return join(dirname(hotwordsFile), 'settings.json')
  }

  /** Reads the voice-input settings (auto-learn is on by default). */
  function readSettings() {
    try {
      const parsed = JSON.parse(readFileSync(settingsFilePath(), 'utf8'))
      return { autoLearn: parsed?.autoLearn !== false }
    } catch {
      return { autoLearn: true }
    }
  }

  /** Writes the voice-input settings atomically. */
  function writeSettings(next) {
    try {
      const file = settingsFilePath()
      const temp = `${file}.tmp-${process.pid}`
      writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`)
      renameSync(temp, file)
      return true
    } catch (error) {
      log('cannot write settings', error)
      return false
    }
  }

  /** Health checks for the settings window («доктор»). */
  function runDoctor() {
    const items = []
    const add = (id, label, ok, detail) => items.push({ id, label, ok: Boolean(ok), detail })
    add('gigaam-binary', 'Движок GigaAM', existsSync(binaryPath), binaryPath)
    add('gigaam-model', 'Модель GigaAM', hasModel(), modelDir)
    add('whisper-binary', 'Whisper', hasWhisper(), whisperBinaryPath)
    add('whisper-model', 'Модель Whisper', existsSync(whisperModelPath), whisperModelPath)
    let hotwordsOk = true
    try {
      readHotwords()
    } catch {
      hotwordsOk = false
    }
    add('hotwords', 'Словарь', hotwordsOk && existsSync(hotwordsFile), hotwordsFile)
    let replacementsOk = true
    try {
      readReplacementsFile()
    } catch {
      replacementsOk = false
    }
    add('replacements', 'Замены', replacementsOk, replacementsFile)
    readLearnedQueue()
    add('learned', 'Очередь авто-обучения', !learnedCorrupt, learnedFilePath())
    let settingsOk = true
    try {
      readSettings()
    } catch {
      settingsOk = false
    }
    add('settings', 'Настройки', settingsOk, settingsFilePath())
    add('server', 'Сервер словаря', true, 'localhost')
    return { ok: items.every((item) => item.ok), items }
  }

  /**
   * Rejects browser requests from other sites: the local dictionary server is
   * reachable from any page on this machine, so reading the last transcription
   * from a random website must be impossible. Same-site requests (the DSH web
   * GUI on another port) and the Electron app (Origin: null) are allowed.
   * @param request - incoming HTTP request.
   * @returns true when the request must be rejected.
   */
  function isCrossSiteRequest(request) {
    const host = request.headers.host
    if (typeof host === 'string' && host !== '' && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/iu.test(host)) return true
    const site = request.headers['sec-fetch-site']
    const origin = request.headers.origin
    if (typeof site === 'string' && site !== '') {
      if (site === 'cross-site') {
        // Electron (file://) присылает Origin: null — это наше приложение.
        return !(typeof origin === 'string' && origin === 'null')
      }
      return false
    }
    if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
      try {
        const url = new URL(origin)
        return !(url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1' || url.hostname === '[::1]')
      } catch {
        return true
      }
    }
    return false
  }

  /**
   * Local endpoint for the client half: it adds a word selected in the composer
   * to the personal dictionary. Tries a small port range; CORS is open because
   * the caller is our own client plugin on the same machine.
   * @returns disposer that stops the endpoint.
   */
  function startDictionaryServer() {
    const base = Number.isFinite(Number(config.dictionaryPort)) ? Number(config.dictionaryPort) : 47118
    let active
    let disposed = false
    const handle = (request, response) => {
      // Чужой сайт не должен читать диктовку и писать в словарь.
      if (isCrossSiteRequest(request)) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, reason: 'cross-site' }))
        return
      }
      response.setHeader('access-control-allow-origin', '*')
      response.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS')
      response.setHeader('access-control-allow-headers', 'content-type')
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      if (request.method === 'GET' && request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }
      if (request.method === 'GET' && request.url === '/suggestions') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ suggestions: suggestTerms() }))
        return
      }
      if (request.method === 'GET' && request.url === '/engine') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          engine: engineMode,
          merge: config.merge ?? 'auto',
          whisper: hasWhisper(),
        }))
        return
      }
      if (request.method === 'POST' && request.url === '/engine') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 2048) request.destroy()
        })
        request.on('end', () => {
          let payload
          try {
            payload = JSON.parse(body)
          } catch {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-json' }))
            return
          }
          const engines = ['gigaam', 'whisper', 'hybrid']
          const merges = ['auto', 'sentences', 'text', 'words']
          const engine = engines.includes(payload?.engine) ? payload.engine : undefined
          const merge = merges.includes(payload?.merge) ? payload.merge : 'auto'
          if (engine === undefined) {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-engine' }))
            return
          }
          const result = writeEngineConfig(engine, merge)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'GET' && request.url === '/last-transcription') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(lastTranscription ?? null))
        return
      }
      if (request.method === 'GET' && request.url === '/dictionary') {
        let words = []
        try {
          words = readPersonalHotwords(readFileSync(hotwordsFile, 'utf8'))
        } catch {
          words = []
        }
        const replacements = readReplacementsFile()
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ words, replacements, sources: readDictionarySources(words, replacements) }))
        return
      }
      if (request.method === 'GET' && request.url === '/settings') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(readSettings()))
        return
      }
      if (request.method === 'POST' && request.url === '/settings') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 1024) request.destroy()
        })
        request.on('end', () => {
          let payload
          try {
            payload = JSON.parse(body)
          } catch {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-json' }))
            return
          }
          if (typeof payload?.autoLearn !== 'boolean') {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-settings' }))
            return
          }
          const settings = { ...readSettings(), autoLearn: payload.autoLearn }
          const ok = writeSettings(settings)
          response.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok, settings }))
        })
        return
      }
      if (request.method === 'GET' && request.url === '/status') {
        const preparationState = typeof preparationApi !== 'undefined' ? preparationApi.snapshot() : undefined
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          engine: engineMode,
          merge: config.merge ?? 'sentences',
          gigaam: { binary: existsSync(binaryPath), model: hasModel(), modelDir },
          whisper: { binary: hasWhisper(), model: existsSync(whisperModelPath) },
          dictionary: {
            words: readHotwords().length,
            replacements: Object.keys(readReplacementsFile()).length,
            review: readLearnedQueue().length,
            corrupt: learnedCorrupt,
          },
          settings: readSettings(),
          preparation: preparationState,
        }))
        return
      }
      if (request.method === 'GET' && request.url === '/doctor') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(runDoctor()))
        return
      }
      if (request.method === 'POST' && request.url === '/model/prepare') {
        preparationApi.prepare()
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }
      if (request.method === 'GET' && request.url === '/review') {
        const pairs = readLearnedQueue()
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ pairs, corrupt: learnedCorrupt }))
        return
      }
      if (request.method === 'POST' && request.url === '/review/keep') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 2048) request.destroy()
        })
        request.on('end', () => {
          let heard = body
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed === 'string') heard = parsed
            else if (parsed !== null && typeof parsed === 'object' && typeof parsed.heard === 'string') heard = parsed.heard
          } catch {
            // оставляем как есть
          }
          const ok = !learnedCorrupt && removeLearnedPair(heard)
          response.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok, reason: learnedCorrupt ? 'corrupt' : undefined }))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/review/forget') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 2048) request.destroy()
        })
        request.on('end', () => {
          let heard = body
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed === 'string') heard = parsed
            else if (parsed !== null && typeof parsed === 'object' && typeof parsed.heard === 'string') heard = parsed.heard
          } catch {
            // оставляем как есть
          }
          const result = forgetReplacementAnyCase(heard)
          removeLearnedPair(heard)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok: result.ok, removed: result.removed }))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/forget-pair') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) request.destroy()
        })
        request.on('end', () => {
          let heard = body
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed === 'string') heard = parsed
            else if (parsed !== null && typeof parsed === 'object' && typeof parsed.heard === 'string') heard = parsed.heard
          } catch {
            // оставляем как есть
          }
          const result = forgetReplacementAnyCase(heard)
          if (result.ok) removeLearnedPair(heard)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/forget') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) request.destroy()
        })
        request.on('end', () => {
          let phrase = body
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed === 'string') phrase = parsed
          } catch {
            // оставляем как есть
          }
          let current = ''
          try {
            current = readFileSync(hotwordsFile, 'utf8')
          } catch {
            current = SEED_HOTWORDS
          }
          const result = forgetPersonalPhrase(current, phrase)
          if (result.ok) {
            try {
              writeFileSync(hotwordsFile, result.text)
            } catch (error) {
              log('cannot write hotwords file', error)
              response.writeHead(400, { 'content-type': 'application/json' })
              response.end(JSON.stringify({ ok: false, reason: 'write-failed' }))
              return
            }
          }
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/learn') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 8192) request.destroy()
        })
        request.on('end', () => {
          let payload
          try {
            payload = JSON.parse(body)
          } catch {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-json' }))
            return
          }
          const result = learnCorrection(payload?.heard, payload?.chosen, payload?.source)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/hotwords') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) request.destroy()
        })
        request.on('end', () => {
          // Клиент присылает JSON-строку, ручные вызовы — обычный текст.
          let phrase = body
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed === 'string') phrase = parsed
          } catch {
            // оставляем как есть
          }
          const result = addPersonalHotword(phrase)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      response.writeHead(404)
      response.end()
    }
    const tryPort = (offset) => {
      if (disposed) return
      if (offset >= 5) {
        log('dictionary endpoint unavailable: ports busy')
        return
      }
      const candidate = createServer(handle)
      candidate.once('error', () => {
        try {
          candidate.close()
        } catch {
          // уже закрыт
        }
        tryPort(offset + 1)
      })
      candidate.listen(base + offset, '127.0.0.1', () => {
        if (disposed) {
          candidate.close()
          return
        }
        active = candidate
        log('dictionary endpoint on', base + offset)
      })
    }
    tryPort(0)
    return () => new Promise((resolve) => {
      disposed = true
      if (active === undefined) {
        resolve()
        return
      }
      // closeAllConnections: keep-alive от fetch иначе держит сервер открытым.
      active.close(() => resolve())
      active.closeAllConnections?.()
    })
  }

  /** Reads the replacements map; a missing file means no replacements yet. */
  function readReplacementsFile() {
    try {
      return readReplacements(readFileSync(replacementsFile, 'utf8'))
    } catch {
      return {}
    }
  }

  /**
   * Learns a pair: the chosen spelling joins the personal dictionary and the
   * heard → chosen pair joins the replacements map.
   * @param heard - phrase as the engine recognized it.
   * @param chosen - phrase the user picked.
   * @returns counts for both stores.
   */
  /** Path of the auto-learned pairs awaiting review. */
  function learnedFilePath() {
    return join(dirname(hotwordsFile), 'learned.json')
  }

  /** True when learned.json exists but cannot be parsed: never overwrite it. */
  let learnedCorrupt = false

  /** Reads the auto-learned pairs awaiting review. */
  function readLearnedQueue() {
    try {
      const parsed = JSON.parse(readFileSync(learnedFilePath(), 'utf8'))
      learnedCorrupt = false
      return Array.isArray(parsed?.pairs)
        ? parsed.pairs
            .filter((pair) => typeof pair?.heard === 'string' && typeof pair?.chosen === 'string')
            .map((pair) => ({ heard: normalizePhrase(pair.heard), chosen: normalizePhrase(pair.chosen), at: Number(pair.at) || 0 }))
            .filter((pair) => pair.heard !== '' && pair.chosen !== '')
        : []
    } catch (error) {
      // Отсутствие файла — норма, повреждение — нет: молча затирать нельзя.
      learnedCorrupt = !(error !== null && typeof error === 'object' && error.code === 'ENOENT')
      if (learnedCorrupt) log('learned.json is corrupt; keeping it untouched', error instanceof Error ? error.message : String(error))
      return []
    }
  }

  /** Writes the review queue atomically (temp file + rename). */
  function writeLearnedQueue(pairs) {
    if (learnedCorrupt) return false
    try {
      const file = learnedFilePath()
      const temp = `${file}.tmp-${process.pid}`
      writeFileSync(temp, `${JSON.stringify({ pairs }, null, 2)}\n`)
      renameSync(temp, file)
      return true
    } catch (error) {
      log('cannot write learned queue', error)
      return false
    }
  }

  /** Adds an auto-learned pair to the review queue (deduplicated by heard). */
  function addLearnedPair(heard, chosen) {
    const cleanHeard = normalizePhrase(heard)
    const cleanChosen = normalizePhrase(chosen)
    if (cleanHeard === '' || cleanChosen === '') return false
    const lower = cleanHeard.toLowerCase()
    const pairs = readLearnedQueue().filter((pair) => pair.heard.toLowerCase() !== lower)
    pairs.push({ heard: cleanHeard, chosen: cleanChosen, at: Date.now() })
    return writeLearnedQueue(pairs)
  }

  /** Removes a pair from the review queue. */
  function removeLearnedPair(heard) {
    const lower = String(heard).toLowerCase()
    return writeLearnedQueue(readLearnedQueue().filter((pair) => pair.heard.toLowerCase() !== lower))
  }

  /** Updates the chosen spelling of a queued pair (manual re-learn wins). */
  function updateLearnedPair(heard, chosen) {
    const lower = String(heard).toLowerCase()
    const pairs = readLearnedQueue()
    let changed = false
    for (const pair of pairs) {
      if (pair.heard.toLowerCase() === lower && pair.chosen !== chosen) {
        pair.chosen = chosen
        pair.at = Date.now()
        changed = true
      }
    }
    if (changed) writeLearnedQueue(pairs)
    return changed
  }

  /** Removes a replacement key case-insensitively; returns the removed keys. */
  function forgetReplacementAnyCase(heard) {
    const lower = String(heard).toLowerCase()
    const replacements = readReplacementsFile()
    const removed = Object.keys(replacements).filter((key) => key.toLowerCase() === lower)
    if (removed.length === 0) return { ok: false, removed: [] }
    for (const key of removed) delete replacements[key]
    try {
      writeFileSync(replacementsFile, renderReplacements(replacements))
    } catch (error) {
      log('cannot write replacements', error)
      return { ok: false, removed: [], reason: 'write-failed' }
    }
    return { ok: true, removed }
  }

  /** Words that came from the last project scan, for source labels. */
  function readProjectWords() {
    try {
      const manifest = JSON.parse(readFileSync(join(dirname(hotwordsFile), 'projects.json'), 'utf8'))
      const words = new Set()
      for (const value of Object.values(manifest)) {
        if (Array.isArray(value)) for (const word of value) if (typeof word === 'string') words.add(word.toLowerCase())
      }
      return words
    } catch {
      return new Set()
    }
  }

  /** Sources of the current dictionary entries: project/manual, auto/manual. */
  function readDictionarySources(words, replacements) {
    const projectWords = readProjectWords()
    const learned = new Set(readLearnedQueue().map((pair) => pair.heard.toLowerCase()))
    return {
      words: Object.fromEntries(words.map((word) => [word, projectWords.has(word.toLowerCase()) ? 'project' : 'manual'])),
      replacements: Object.fromEntries(Object.keys(replacements).map((heard) => [heard, learned.has(heard.toLowerCase()) ? 'auto' : 'manual'])),
    }
  }

  function learnCorrection(heard, chosen, source) {
    const trimmedHeard = typeof heard === 'string' ? heard.trim() : ''
    const trimmedChosen = typeof chosen === 'string' ? chosen.trim() : ''
    // Односимвольные замены («я» → «I») портят обычный текст.
    if (trimmedHeard.length < 2 || trimmedChosen.length < 2) return { ok: false, reason: 'too-short' }
    const replacements = readReplacementsFile()
    const updated = upsertReplacement(JSON.stringify({ replacements }), heard, chosen)
    if (!updated.ok) return { ok: false, reason: updated.reason }
    try {
      writeFileSync(replacementsFile, updated.text)
    } catch (error) {
      log('cannot write replacements', error)
      return { ok: false, reason: 'write-failed' }
    }
    // Авто-обучение попадает в очередь проверки: пользователь может оставить
    // пару или убрать её из окна словаря.
    if (source === 'auto') addLearnedPair(trimmedHeard, trimmedChosen)
    else updateLearnedPair(trimmedHeard, trimmedChosen)
    const added = addPersonalHotword(chosen)
    return {
      ok: true,
      replacements: updated.count,
      words: added.ok === true ? (added.count ?? readPersonalHotwords(readFileSync(hotwordsFile, 'utf8')).length) : undefined,
    }
  }

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
  /** Fingerprint of the hotwords file: mtime and size. */
  function hotwordsSignatureNow() {
    try {
      const stat = statSync(hotwordsFile)
      return `${stat.mtimeMs}:${stat.size}`
    } catch {
      return undefined
    }
  }

  /**
   * Restarts the engine when the hotwords file changed: the engine reads the
   * file at startup, so new phrases apply after one reload (~model load time).
   */
  /**
   * Restarts the engine in the background when the hotwords file changed, so the
   * next dictation does not wait for the model load. Skips while transcribing.
   */
  async function reloadHotwordsInBackground() {
    if (disposed || reloading || transcribing) return
    if (server === undefined || server.child.exitCode !== null) return
    const signature = hotwordsSignatureNow()
    if (signature === undefined || signature === hotwordsSignature) return
    reloading = true
    log('hotwords changed, restarting engine in background')
    try {
      await stopServer()
      await ensureServer()
    } catch (error) {
      log('background reload failed', error instanceof Error ? error.message : String(error))
    } finally {
      reloading = false
    }
  }

  async function reloadHotwordsIfChanged() {
    const signature = hotwordsSignatureNow()
    if (signature === undefined || signature === hotwordsSignature) return
    log('hotwords changed, restarting engine')
    await stopServer()
    await ensureServer()
  }

  function readHotwords() {
    const phrases = new Set()
    const add = (value) => {
      if (typeof value !== 'string') return
      // Формат движка: «фраза» или «фраза\tвес»; вес здесь не нужен — буст
      // задаётся один на все фразы.
      const line = value.replace(/\t[-+]?\d+(?:\.\d+)?\s*$/, '')
      const phrase = line.trim()
      if (phrase === '' || phrase.startsWith('#')) return
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
      const probe = createNetServer()
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
    // Словарь отдаём файлом при старте: HTTP-запрос ограничен 64 фразами, а
    // файл движок читает целиком. Изменение файла подхватывается перезапуском.
    const child = spawn(binaryPath, [
      'serve', '--host', '127.0.0.1', '--port', String(port),
      '--model-dir', modelDir, '--profile', 'edge',
      ...(existsSync(hotwordsFile) ? ['--hotwords-file', hotwordsFile, '--hotwords-boost', String(hotwordsBoost)] : []),
      ...(hotwordsDefault ? ['--hotwords-default'] : []),
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    hotwordsSignature = hotwordsSignatureNow()
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

  /** True when the Whisper binary and model are present. */
  function hasWhisper() {
    return existsSync(whisperBinaryPath) && existsSync(whisperModelPath)
  }

  /**
   * Builds Whisper's initial prompt from the personal dictionary, so the
   * multilingual engine also gets the project terminology.
   * @returns the prompt text (short enough for the model context).
   */
  function whisperPrompt() {
    const terms = [...readHotwords(), ...Object.values(readReplacementsFile())]
      .filter((term) => typeof term === 'string' && term.trim() !== '')
    const prompt = terms.slice(0, 60).join(', ')
    return prompt.length > 600 ? prompt.slice(0, 600) : prompt
  }

  /**
   * Transcribes audio with whisper-cli: a separate multilingual engine that is
   * stronger on English terms than GigaAM.
   * @param audio - WAV bytes.
   * @param signal - cancellation.
   * @returns recognized text.
   */
  async function transcribeViaWhisper(audio, signal) {
    const file = join(tmpdir(), `dsh-whisper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`)
    writeFileSync(file, audio)
    try {
      return await new Promise((resolve, reject) => {
        const prompt = whisperPrompt()
        const child = spawn(whisperBinaryPath, [
          '-m', whisperModelPath, '-f', file, '-l', whisperLanguage, '-nt', '-t', '8',
          ...(prompt === '' ? [] : ['--prompt', prompt]),
        ], { stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => { stdout += chunk })
        child.stderr.on('data', (chunk) => { stderr += chunk })
        const onAbort = () => { child.kill('SIGTERM') }
        signal?.addEventListener?.('abort', onAbort)
        child.on('error', reject)
        child.on('close', (code) => {
          signal?.removeEventListener?.('abort', onAbort)
          if (code !== 0) {
            reject(new Error(`whisper-cli завершился (код ${code}): ${stderr.slice(-300)}`))
            return
          }
          resolve(stdout.trim())
        })
      })
    } finally {
      try {
        rmSync(file, { force: true })
      } catch {
        // временный файл уберёт система
      }
    }
  }

  /** Counts known dictionary terms and replacement targets in a text. */
  function termHits(text) {
    const haystack = String(text).toLowerCase()
    if (haystack === '') return 0
    const terms = [...readHotwords(), ...Object.values(readReplacementsFile())]
    let hits = 0
    for (const term of terms) {
      if (typeof term !== 'string' || term.length < 2) continue
      if (haystack.includes(term.toLowerCase())) hits += 1
    }
    return hits
  }

  /** Normalizes a word for alignment: lowercase, letters and digits only. */
  function alignWord(token) {
    return String(token).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  }

  /** Strips trailing punctuation from a token. */
  function wordCore(token) {
    return String(token).replace(/[^\p{L}\p{N}]+$/u, '')
  }

  /** Trailing punctuation of a token. */
  function wordPunctuation(token) {
    const core = wordCore(token)
    return String(token).slice(core.length)
  }

  /** Levenshtein distance between two normalized words. */
  function wordDistance(left, right) {
    const rows = left.length + 1
    const columns = right.length + 1
    let previous = Array.from({ length: columns }, (_, index) => index)
    for (let row = 1; row < rows; row += 1) {
      const current = [row]
      for (let column = 1; column < columns; column += 1) {
        const cost = left[row - 1] === right[column - 1] ? 0 : 1
        current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost)
      }
      previous = current
    }
    return previous[columns - 1]
  }

  /** Similarity of two words in [0, 1]. */
  function wordSimilarity(left, right) {
    const a = alignWord(left)
    const b = alignWord(right)
    if (a === '' || b === '') return 0
    if (a === b) return 1
    return 1 - wordDistance(a, b) / Math.max(a.length, b.length)
  }

  /** Longest common subsequence over normalized words: index pairs. */
  function lcsWordPairs(left, right) {
    const rows = left.length
    const columns = right.length
    const table = Array.from({ length: rows + 1 }, () => new Array(columns + 1).fill(0))
    for (let row = rows - 1; row >= 0; row -= 1) {
      for (let column = columns - 1; column >= 0; column -= 1) {
        table[row][column] = left[row] === right[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1])
      }
    }
    const pairs = []
    let row = 0
    let column = 0
    while (row < rows && column < columns) {
      if (left[row] === right[column]) {
        pairs.push([row, column])
        row += 1
        column += 1
      } else if (table[row + 1][column] >= table[row][column + 1]) {
        row += 1
      } else {
        column += 1
      }
    }
    return pairs
  }

  /**
   * Merges transcripts word by word: Latin terms come from Whisper, Russian
   * text stays from GigaAM. Alignment uses the words themselves (no timings).
   * @param gigaamText - GigaAM transcript.
   * @param whisperText - Whisper transcript.
   * @param dictionary - known terms and replacement targets.
   * @returns the merged text.
   */
  function mergeByWords(gigaamText, whisperText, dictionary) {
    const left = String(gigaamText).split(/\s+/u).filter((token) => token !== '')
    const right = String(whisperText).split(/\s+/u).filter((token) => token !== '')
    if (left.length === 0) return whisperText
    if (right.length === 0) return gigaamText
    const normalizedDictionary = dictionary.map(alignWord).filter((term) => term !== '')
    const isTerm = (token) => normalizedDictionary.includes(alignWord(token))
    const hasLatin = (token) => /[A-Za-z]/u.test(token)
    const hasCyrillic = (token) => /[А-Яа-яЁё]/u.test(token)
    const isSuspicious = (token) => {
      const core = wordCore(token)
      return core.length >= 3 && hasLatin(core) && !isTerm(token)
    }
    const preferWhisper = (gigaamToken, whisperToken) => {
      const whisperCore = wordCore(whisperToken)
      if (!hasLatin(whisperCore)) return false
      if (hasCyrillic(wordCore(gigaamToken))) return true
      if (isTerm(whisperToken)) return true
      // Искажённая латиница GigaAM («gighab») заменяется похожим словом Whisper.
      return isSuspicious(gigaamToken) && wordSimilarity(gigaamToken, whisperToken) >= 0.45
    }
    const pairs = lcsWordPairs(left.map(alignWord), right.map(alignWord))
    const out = []
    let leftIndex = 0
    let rightIndex = 0
    const flushGap = (leftEnd, rightEnd) => {
      const leftGap = left.slice(leftIndex, leftEnd)
      const rightGap = right.slice(rightIndex, rightEnd)
      if (leftGap.length === 0 && rightGap.length > 0) {
        for (const token of rightGap) if (hasLatin(token)) out.push(token)
        return
      }
      if (leftGap.length === rightGap.length) {
        for (let index = 0; index < leftGap.length; index += 1) {
          const gigaamToken = leftGap[index]
          const whisperToken = rightGap[index]
          if (preferWhisper(gigaamToken, whisperToken)) {
            const punctuation = wordPunctuation(gigaamToken) === '' ? wordPunctuation(whisperToken) : wordPunctuation(gigaamToken)
            out.push(`${wordCore(whisperToken)}${punctuation}`)
          } else {
            out.push(gigaamToken)
          }
        }
        return
      }
      // Разные размеры: заменяем подозрительные слова похожими терминами Whisper.
      const leftTokens = leftGap.slice()
      const usedRight = new Set()
      for (let leftIndexInGap = 0; leftIndexInGap < leftTokens.length; leftIndexInGap += 1) {
        const gigaamToken = leftTokens[leftIndexInGap]
        if (!isSuspicious(gigaamToken)) continue
        let bestIndex = -1
        let bestScore = 0
        for (let rightIndexInGap = 0; rightIndexInGap < rightGap.length; rightIndexInGap += 1) {
          if (usedRight.has(rightIndexInGap)) continue
          const whisperToken = rightGap[rightIndexInGap]
          if (!hasLatin(wordCore(whisperToken))) continue
          const score = wordSimilarity(gigaamToken, whisperToken)
          if (score > bestScore) { bestScore = score; bestIndex = rightIndexInGap }
        }
        if (bestIndex >= 0 && bestScore >= 0.45) {
          usedRight.add(bestIndex)
          leftTokens[leftIndexInGap] = `${wordCore(rightGap[bestIndex])}${wordPunctuation(gigaamToken) || wordPunctuation(rightGap[bestIndex])}`
        }
      }
      for (const token of leftTokens) out.push(token)
      for (let rightIndexInGap = 0; rightIndexInGap < rightGap.length; rightIndexInGap += 1) {
        if (usedRight.has(rightIndexInGap)) continue
        const whisperToken = rightGap[rightIndexInGap]
        if (hasLatin(wordCore(whisperToken)) && isTerm(whisperToken)) out.push(whisperToken)
      }
    }
    for (const [leftPair, rightPair] of pairs) {
      flushGap(leftPair, rightPair)
      const gigaamToken = left[leftPair]
      const whisperToken = right[rightPair]
      if (preferWhisper(gigaamToken, whisperToken)) {
        const punctuation = wordPunctuation(gigaamToken) === '' ? wordPunctuation(whisperToken) : wordPunctuation(gigaamToken)
        out.push(`${wordCore(whisperToken)}${punctuation}`)
      } else {
        out.push(gigaamToken)
      }
      leftIndex = leftPair + 1
      rightIndex = rightPair + 1
    }
    flushGap(left.length, right.length)
    return out.join(' ')
  }

  /** Counts Latin words that are not known terms — a sign of garbled output. */
  function suspiciousLatinCount(text) {
    const terms = new Set([...readHotwords(), ...Object.values(readReplacementsFile())].map((term) => term.toLowerCase()))
    let count = 0
    for (const token of String(text).split(/\s+/u)) {
      const core = token.replace(/[^\p{L}\p{N}]+$/u, '')
      if (core.length < 3 || !/[A-Za-z]/u.test(core)) continue
      if (terms.has(core.toLowerCase())) continue
      count += 1
    }
    return count
  }

  /**
   * Scores a transcript: known terms minus garbled Latin words. Whisper usually
   * wins on mixed speech, GigaAM on clean Russian.
   * @param text - transcript.
   * @returns the score (higher is better).
   */
  function transcriptScore(text) {
    return termHits(text) - suspiciousLatinCount(text)
  }

  /** Splits text into sentences, keeping trailing punctuation. */
  function splitSentences(text) {
    const matches = String(text).match(/[^.!?]+[.!?]*/gu) ?? []
    return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence !== '')
  }

  /**
   * Merges transcripts sentence by sentence: each sentence keeps the variant
   * with the better score, so Russian sentences come from GigaAM and sentences
   * with English terms from Whisper.
   * @param gigaamText - GigaAM transcript.
   * @param whisperText - Whisper transcript.
   * @param dictionary - known terms.
   * @returns the merged text, or undefined when the sentence counts differ.
   */
  function mergeBySentences(gigaamText, whisperText, dictionary) {
    const left = splitSentences(gigaamText)
    const right = splitSentences(whisperText)
    if (left.length === 0 || left.length !== right.length) return undefined
    const score = (text) => {
      const hits = termHits(text)
      const suspicious = String(text).split(/\s+/u).filter((token) => {
        const core = token.replace(/[^\p{L}\p{N}]+$/u, '')
        if (core.length < 3 || !/[A-Za-z]/u.test(core)) return false
        return !dictionary.some((term) => alignWord(term) === alignWord(core))
      }).length
      return hits - suspicious
    }
    const merged = []
    for (let index = 0; index < left.length; index += 1) {
      const gigaamScore = score(left[index])
      const whisperScore = score(right[index])
      merged.push(whisperScore > gigaamScore ? right[index] : left[index])
    }
    return merged.join(' ')
  }

  /** True when the text contains Latin words. */
  function hasLatinToken(text) {
    return String(text).split(/\s+/u).some((token) => /[A-Za-z]{2,}/u.test(token))
  }

  /** Fuzzy score: sum of the best similarity of each Latin token to the dictionary. */
  function latinTermScore(text, dictionary) {
    let score = 0
    for (const token of String(text).split(/\s+/u)) {
      const core = wordCore(token)
      if (!/[A-Za-z]/u.test(core) || core.length < 2) continue
      let best = 0
      for (const term of dictionary) {
        const similarity = wordSimilarity(core, term)
        if (similarity > best) best = similarity
      }
      if (best >= 0.6) score += best
    }
    return score
  }

  /**
   * Auto strategy: a sentence with Latin words comes from Whisper (it is better
   * at English terms), a purely Russian sentence comes from GigaAM. When both
   * variants have Latin words, the one closer to the dictionary wins.
   * @param gigaamText - GigaAM transcript.
   * @param whisperText - Whisper transcript.
   * @param dictionary - known terms.
   * @returns the merged text.
   */
  function mergeByAuto(gigaamText, whisperText, dictionary) {
    const left = splitSentences(gigaamText)
    const right = splitSentences(whisperText)
    if (left.length === 0 || left.length !== right.length) {
      const gigaamLatin = hasLatinToken(gigaamText)
      const whisperLatin = hasLatinToken(whisperText)
      if (whisperLatin && !gigaamLatin) return whisperText
      if (gigaamLatin && !whisperLatin) return gigaamText
      if (whisperLatin && gigaamLatin) {
        return latinTermScore(whisperText, dictionary) > latinTermScore(gigaamText, dictionary) ? whisperText : gigaamText
      }
      return gigaamText
    }
    const merged = []
    for (let index = 0; index < left.length; index += 1) {
      const gigaamSentence = left[index]
      const whisperSentence = right[index]
      const gigaamLatin = hasLatinToken(gigaamSentence)
      const whisperLatin = hasLatinToken(whisperSentence)
      if (whisperLatin && !gigaamLatin) merged.push(whisperSentence)
      else if (gigaamLatin && !whisperLatin) merged.push(gigaamSentence)
      else if (whisperLatin && gigaamLatin) {
        merged.push(latinTermScore(whisperSentence, dictionary) > latinTermScore(gigaamSentence, dictionary) ? whisperSentence : gigaamSentence)
      } else {
        merged.push(gigaamSentence)
      }
    }
    return merged.join(' ')
  }


  async function postTranscribe(audio, signal) {
    // Фразы из файла движок уже знает (переданы при старте). В запросе — только
    // дополнительный список из конфигурации, и только если файла нет.
    const fromConfig = configHotwords.filter((phrase) => !phrase.includes(',') && phrase.length <= MAX_HOTWORD_LENGTH)
    const fallback = existsSync(hotwordsFile) ? [] : readHotwords()
    const hotwords = [...fromConfig, ...fallback].slice(0, 64)
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

  /** Transcribes with the GigaAM engine (the default Russian engine). */
  async function transcribeGigaam(input, signal) {
    await ensureServer()
    await reloadHotwordsIfChanged()
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
    // GigaAM всегда отдаёт words[] {word,start,end,confidence}; start/end —
    // секунды от начала аудио. Отдаём их наружу через /last-transcription,
    // чтобы клиенты (Chronoflow) могли привязывать события к словам точно.
    const words = Array.isArray(payload.words)
      ? payload.words
          .map((word) => ({
            word: String(word?.word ?? word?.text ?? ''),
            start: Number(word?.start),
            end: Number(word?.end),
            confidence: Number.isFinite(Number(word?.confidence)) ? Number(word.confidence) : undefined,
          }))
          .filter((word) => word.word !== '' && Number.isFinite(word.start) && Number.isFinite(word.end))
      : []
    const duration = Number.isFinite(Number(payload.duration)) ? Number(payload.duration) : undefined
    return { text, words, duration }
  }

  async function transcribe(input, signal) {
    if (engineMode !== 'whisper' && !hasModel()) {
      throw new Error('Модель GigaAM не подготовлена. Откройте «Плагины → Голосовой ввод» и нажмите «Скачать и подготовить».')
    }
    if (engineMode !== 'gigaam' && !hasWhisper()) {
      throw new Error('Whisper не установлен: положите whisper-cli и модель в ~/.dsh/speech-ru/whisper или укажите пути в конфиге.')
    }
    transcribing = true
    // Тайминги не должны перетекать из предыдущей диктовки (whisper-режим,
    // сбой GigaAM): сбрасываем перед каждым распознаванием.
    gigaamWords = []
    gigaamTextForTimings = ''
    gigaamAudioSeconds = undefined
    const started = performance.now()
    try {
      let raw
      if (engineMode === 'whisper') {
        raw = await transcribeViaWhisper(input.audio, signal)
      } else if (engineMode === 'hybrid') {
        const [gigaamAnswer, whisperText] = await Promise.all([
          transcribeGigaam(input, signal).catch((error) => {
            log('gigaam failed in hybrid', error instanceof Error ? error.message : String(error))
            return { text: '', words: [], duration: undefined }
          }),
          transcribeViaWhisper(input.audio, signal).catch((error) => {
            log('whisper failed in hybrid', error instanceof Error ? error.message : String(error))
            return ''
          }),
        ])
        const gigaamText = gigaamAnswer.text
        gigaamWords = gigaamAnswer.words ?? []
        gigaamTextForTimings = gigaamText
        gigaamAudioSeconds = gigaamAnswer.duration
        const dictionary = [...readHotwords(), ...Object.values(readReplacementsFile())]
        const gigaamHits = termHits(gigaamText)
        const whisperHits = termHits(whisperText)
        const gigaamScore = transcriptScore(gigaamText)
        const whisperScore = transcriptScore(whisperText)
        const bestSingle = whisperScore > gigaamScore ? whisperText : gigaamText
        let merged = gigaamText
        if (config.merge === 'words') {
          merged = mergeByWords(gigaamText, whisperText, dictionary)
          // Страховка: слияние не должно терять термины или раздувать текст
          // дублями — тогда берём лучший целый текст.
          const wordsIn = (value) => String(value).split(/\s+/u).filter(Boolean).length
          const duplicated = wordsIn(merged) > Math.max(wordsIn(gigaamText), wordsIn(whisperText)) + 1
          if (merged === '' || duplicated || termHits(merged) < Math.max(gigaamHits, whisperHits)) merged = bestSingle
        } else if (config.merge === 'auto') {
          merged = mergeByAuto(gigaamText, whisperText, dictionary)
        } else if (config.merge === undefined || config.merge === 'sentences') {
          // По умолчанию: посентенционно по оценке (термины минус искажённая
          // латиница) — на корпусе это лучший результат (8.6% WER).
          merged = mergeBySentences(gigaamText, whisperText, dictionary) ?? bestSingle
        } else {
          merged = bestSingle
        }
        raw = merged
        if (config.debugTranscripts === true) {
          try {
            // История последних диктовок: файл не перезаписывается целиком.
            const historyFile = join(dirname(hotwordsFile), 'transcripts.json')
            let history = []
            try {
              const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
              if (Array.isArray(parsed)) history = parsed
            } catch {
              history = []
            }
            history.push({
              at: new Date().toISOString(),
              mode: config.merge === 'words' ? 'words' : config.merge === 'text' ? 'text' : config.merge === 'auto' ? 'auto' : 'sentences',
              gigaam: gigaamText,
              whisper: whisperText,
              merged: raw,
              hits: { gigaam: gigaamHits, whisper: whisperHits, merged: termHits(raw) },
              scores: { gigaam: gigaamScore, whisper: whisperScore },
            })
            writeFileSync(historyFile, `${JSON.stringify(history.slice(-50), null, 2)}\n`)
          } catch (error) {
            log('cannot write transcript debug', error)
          }
        }
        if (raw === '') throw new Error('Не удалось распознать: ни GigaAM, ни Whisper не ответили.')
      } else {
        const gigaamAnswer = await transcribeGigaam(input, signal)
        raw = gigaamAnswer.text
        gigaamWords = gigaamAnswer.words ?? []
        gigaamTextForTimings = gigaamAnswer.text
        gigaamAudioSeconds = gigaamAnswer.duration
      }
      // Выученные замены применяем к расшифровке: «гитхап» → GitHub. Клиент
      // показывает уведомление о замене, поэтому это не молчаливая правка.
      const replacements = readReplacementsFile()
      const text = applyReplacements(raw, replacements)
      // Какие замены реально сработали — клиент подсветит эти слова.
      const applied = []
      if (text !== raw) {
        for (const [heard, chosen] of Object.entries(replacements)) {
          if (text.toLowerCase().includes(String(chosen).toLowerCase()) && raw.toLowerCase() !== text.toLowerCase()) applied.push({ heard, chosen })
        }
      }
      lastTranscription = {
        at: Date.now(),
        raw,
        text,
        applied,
        mode: engineMode,
        // Тайминги слов для клиентов, которым важна привязка к моменту речи.
        words: gigaamWords,
        // В hybrid текст смешанный, а тайминги — всегда от GigaAM-ветки.
        wordsSource: gigaamWords.length === 0 ? undefined : 'gigaam',
        gigaamText: gigaamTextForTimings === '' ? undefined : gigaamTextForTimings,
        audioDurationSeconds: gigaamAudioSeconds,
      }
      log('transcribed', raw.length, 'chars; mode:', engineMode, '; replaced:', text === raw ? 0 : 'yes')
      return {
        text,
        audioSeconds: wavSeconds(input.audio),
        inferenceSeconds: (performance.now() - started) / 1000,
        // DSH не валидирует результат провайдера; поля необязательные и
        // безопасны для старых клиентов.
        ...(gigaamWords.length === 0 ? {} : { words: gigaamWords }),
      }
    } finally {
      transcribing = false
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
      // Endpoint для кнопки «в словарь» живёт вместе с провайдером: без
      // голосового ввода он не нужен, и так его гарантированно закроют.
      const stopDictionaryServer = startDictionaryServer()
      // Фоновый перезапуск после изменения словаря: иначе следующий диктант
      // ждёт загрузку модели (~3 с). unref — чтобы таймер не держал процесс.
      const watchTimer = setInterval(() => {
        void reloadHotwordsInBackground()
      }, Number(config.hotwordsWatchMs ?? 2000))
      watchTimer.unref?.()
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
        clearInterval(watchTimer)
        await stopServer()
        await stopDictionaryServer()
        await remove()
      }
    })
    // Прогрев необязателен: ошибки не мешают работе провайдера.
    ctx.effect(() => schedulePrewarm(ctx), '__MODULE_ID__: prewarm')
  })
}

/** Test seam: helpers and data exercised by the offline tests. */
export const internals = { engineTarget, installEngine, modelFiles: MODEL_FILES }
