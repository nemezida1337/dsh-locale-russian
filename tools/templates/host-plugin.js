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
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createServer as createNetServer, isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
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
  splitPersonal,
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
 *   retentionMinDictations?: number, allowLocalDictionaryImport?: boolean,
 *   whisperChunkSeconds?: number, whisperChunkThresholdSeconds?: number,
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
  const engineMode = config.engine === 'whisper' || config.engine === 'hybrid' || config.engine === 'auto'
    ? config.engine
    : 'gigaam'
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
  /** Warm whisper.cpp HTTP server: the model is loaded once per process. */
  let whisperServer
  /** Prompt the running whisper server was started with. */
  let whisperServerPromptSignature = ''
  /** Set after repeated server failures: fall back to the whisper CLI. */
  let whisperServerDisabled = false
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
  /** Leading silence removed before recognition (seconds). */
  let audioTrimOffsetSeconds = 0
  /** True while a background engine reload is in flight. */
  let reloading = false
  /** Info about the last transcription: applied replacements, for the client. */
  let lastTranscription
  /** Ring of recent transcripts so the client can match a late dictation to its text. */
  const recentTranscriptions = []
  /** Set when the auto mode had to ask Whisper for a second opinion. */
  let autoFallback = false
  /** Whether the auto mode tried Whisper and whether it failed. */
  let autoWhisperTried = false
  let autoWhisperFailed = false
  /** Whisper transcript of the current dictation (for diagnostics). */
  let lastWhisperText = ''
  /** Single-flight guard for the warm whisper server. */
  let whisperServerStarting
  let whisperServerStartingChild
  /** After a failed start the warm path retries only after this timestamp. */
  let whisperServerDisabledUntil = 0
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
    try {
      const stats = readStats()
      stats.terms[String(raw).trim()] = { hits: 0, lastAt: 0, sinceDictation: stats.dictations }
      writeStats(stats)
    } catch (error) {
      log('cannot reset word stats', error)
    }
    log('personal hotword added', String(raw).trim(), 'total', result.count)
    return { ok: true, count: result.count }
  }

  /** Path of the desktop profile patch that carries the engine configuration. */
  function engineConfigPath() {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    return join(home, 'profiles', 'desktop', 'cordis.patch.yml')
  }

  /** Strips newlines/CR so config values cannot inject extra YAML keys. */
  function sanitizeConfigValue(value) {
    return String(value ?? '').replace(/[\r\n]+/gu, ' ').trim()
  }

  /** Raw lines of config keys the plugin does not manage (nested lists too). */
  function readBlockExtraLines(source) {
    const block = String(source ?? '').match(/- id: locale-ru[\s\S]*?(?=\n- id:|\s*$)/u)
    if (block === null) return []
    const lines = block[0].split('\n')
    const extras = []
    const managed = new Set(['engine', 'merge', 'debugTranscripts', 'whisperBinaryPath', 'whisperServerPath', 'whisperModelPath'])
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^    ([A-Za-z][\w-]*):/u)
      if (match === null || managed.has(match[1])) continue
      extras.push(lines[index])
      let nested = index + 1
      while (nested < lines.length && /^\s{6,}\S/u.test(lines[nested])) {
        extras.push(lines[nested])
        nested += 1
      }
      index = nested - 1
    }
    return extras
  }

  /** Removes the `- id: locale-ru` block from patch lines. */
  function stripEngineBlock(lines) {
    const result = []
    let skipping = false
    for (const line of lines) {
      if (line.startsWith('- id: locale-ru')) {
        while (result.length > 0) {
          const previous = result[result.length - 1].trim()
          if (previous === '' || previous.startsWith('# Движок:') || previous.startsWith('# Гибрид GigaAM + Whisper')) result.pop()
          else break
        }
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
    const source = readFileSync(path, 'utf8')
    // Сохраняем остальные ключи блока (debugTranscripts, whisperServerPath…),
    // иначе переключение движка молча теряет настройки.
    const current = {}
    const blockMatch = source.match(/- id: locale-ru[\s\S]*?(?=\n- id:|\s*$)/u)
    if (blockMatch !== null) {
      for (const line of blockMatch[0].split('\n')) {
        const pair = line.match(/^\s{4}([A-Za-z][\w-]*):\s*(.*)$/u)
        if (pair !== null) current[pair[1]] = pair[2]
      }
    }
    const lines = stripEngineBlock(source.split('\n'))
    const header = engine === 'auto'
      ? '# Движок: auto — быстрый русский через GigaAM, Whisper для терминов.'
      : `# Движок: ${engine}${engine === 'gigaam' ? ' — только GigaAM' : ''}.`
    const block = [
      header,
      '- id: locale-ru',
      '  config:',
      `    engine: ${engine}`,
      `    merge: ${merge}`,
    ]
    for (const line of readBlockExtraLines(source)) block.push(line)
    // Сохраняем и управляемые ключи, которых нет среди аргументов.
    for (const key of ['debugTranscripts', 'whisperServerPath', 'whisperBinaryPath', 'whisperModelPath']) {
      if (current[key] !== undefined && current[key] !== '') block.push(`    ${key}: ${sanitizeConfigValue(current[key])}`)
    }
    if (current.whisperBinaryPath === undefined && existsSync(whisperBinaryPath)) block.push(`    whisperBinaryPath: ${sanitizeConfigValue(whisperBinaryPath)}`)
    if (current.whisperModelPath === undefined && existsSync(whisperModelPath)) block.push(`    whisperModelPath: ${sanitizeConfigValue(whisperModelPath)}`)
    const next = `${lines.join('\n').replace(/\n+$/u, '')}\n\n${block.join('\n')}\n`
    if (next === source) return { ok: true, engine, merge, restartRequired: false, changed: false }
    try {
      writeFileSync(path, next)
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
      return {
        autoLearn: parsed?.autoLearn !== false,
        autoSwitch: parsed?.autoSwitch !== false,
        autoSwitchMode: parsed?.autoSwitchMode === 'auto' ? 'auto' : 'suggest',
        activeProfile: typeof parsed?.activeProfile === 'string' && parsed.activeProfile !== '' ? parsed.activeProfile : 'default',
        profilesBootstrapped: parsed?.profilesBootstrapped === true,
      }
    } catch {
      return { autoLearn: true, autoSwitch: true, autoSwitchMode: 'suggest', activeProfile: 'default', profilesBootstrapped: false }
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

  /** Path of the dictionary usage statistics file. */
  function statsFilePath() {
    return join(dirname(hotwordsFile), 'stats.json')
  }

  /** Effective retention threshold: config value or 30 dictations. */
  function retentionMinDictations() {
    const value = Number(config.retentionMinDictations)
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 30
  }

  /** Reads usage statistics; never fails the caller. */
  function readStats() {
    const empty = { dictations: 0, terms: {}, pairs: {}, enabledAt: Date.now(), updatedAt: 0 }
    try {
      const parsed = JSON.parse(readFileSync(statsFilePath(), 'utf8'))
      return {
        dictations: Number.isFinite(Number(parsed?.dictations)) && Number(parsed.dictations) >= 0 ? Number(parsed.dictations) : 0,
        terms: parsed?.terms !== null && typeof parsed.terms === 'object'
          ? Object.fromEntries(Object.entries(parsed.terms).filter(([, value]) => value !== null && typeof value === 'object'))
          : {},
        pairs: parsed?.pairs !== null && typeof parsed.pairs === 'object'
          ? Object.fromEntries(Object.entries(parsed.pairs).filter(([, value]) => value !== null && typeof value === 'object'))
          : {},
        enabledAt: Number(parsed?.enabledAt) || Date.now(),
        updatedAt: Number(parsed?.updatedAt) || 0,
      }
    } catch {
      log('stats file is unreadable; starting with empty statistics')
      return empty
    }
  }

  /** Writes usage statistics atomically. */
  function writeStats(stats) {
    try {
      const file = statsFilePath()
      const temp = `${file}.tmp-${process.pid}`
      writeFileSync(temp, `${JSON.stringify({ ...stats, updatedAt: Date.now() }, null, 2)}\n`)
      renameSync(temp, file)
    } catch (error) {
      log('cannot write stats', error)
    }
  }

  /** Term match that respects Russian endings (same rules as replacements). */
  function containsTerm(text, term) {
    if (typeof term !== 'string' || term.length < 2) return false
    try {
      return applyReplacements(String(text ?? ''), { [term]: '\u0000match\u0000' }) !== String(text ?? '')
    } catch {
      return String(text ?? '').toLowerCase().includes(term.toLowerCase())
    }
  }

  /** Case-insensitive whole-word check (letters/digits as boundaries). */
  function containsWord(text, word) {
    if (typeof word !== 'string' || word === '') return false
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    try {
      return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(String(text ?? ''))
    } catch {
      return String(text ?? '').toLowerCase().includes(word.toLowerCase())
    }
  }

  /** Bumps term and replacement counters after a dictation. */
  function bumpStats(applied, text, raw) {
    const stats = readStats()
    stats.dictations += 1
    const haystack = String(text ?? '')
    const rawHaystack = String(raw ?? '')
    const terms = new Set([...readHotwords(), ...Object.values(readReplacementsFile())])
    for (const term of terms) {
      if (typeof term !== 'string' || term.length < 2) continue
      const key = term
      const entry = stats.terms[key] ?? { hits: 0, lastAt: 0, sinceDictation: stats.dictations }
      if (containsTerm(rawHaystack, term) || containsTerm(haystack, term)) {
        entry.hits = (entry.hits ?? 0) + 1
        entry.lastAt = Date.now()
      }
      stats.terms[key] = entry
    }
    for (const pair of applied ?? []) {
      if (typeof pair?.heard !== 'string') continue
      const entry = stats.pairs[pair.heard] ?? { applied: 0, lastAt: 0 }
      entry.applied = (entry.applied ?? 0) + 1
      entry.lastAt = Date.now()
      stats.pairs[pair.heard] = entry
    }
    writeStats(stats)
  }

  /** Personal hotwords that never helped after enough dictations. */
  function staleHotwords(stats, minDictations) {
    let personal = []
    try {
      personal = readPersonalHotwords(readFileSync(hotwordsFile, 'utf8'))
    } catch {
      personal = []
    }
    const stale = []
    for (const word of personal) {
      const entry = stats.terms[word]
      // Отсчёт начинается с момента, когда слово попало в статистику.
      if (entry === undefined || entry === null || typeof entry !== 'object') continue
      const since = Number.isFinite(Number(entry.sinceDictation)) ? Number(entry.sinceDictation) : stats.dictations
      if ((Number(entry.hits) || 0) > 0) continue
      if (stats.dictations - since < minDictations) continue
      stale.push({ word, hits: 0, lastAt: Number(entry.lastAt) || 0 })
    }
    return stale
  }

  /** True when an address is loopback/private/link-local/reserved. */
  function isPrivateAddress(address) {
    const value = String(address ?? '').toLowerCase().replace(/^\[|\]$/gu, '')
    if (value === '') return true
    if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7))
    if (isIP(value) === 4) {
      const [a, b] = value.split('.').map(Number)
      if (a === 0 || a === 10 || a === 127) return true
      if (a === 169 && b === 254) return true
      if (a === 172 && b >= 16 && b <= 31) return true
      if (a === 192 && b === 168) return true
      if (a === 100 && b >= 64 && b <= 127) return true
      if (a === 198 && (b === 18 || b === 19)) return true
      if (a >= 224) return true
      return false
    }
    if (isIP(value) === 6) {
      if (value === '::1' || value === '::') return true
      if (/^f[cd]/u.test(value)) return true
      if (/^fe[89ab]/u.test(value)) return true
      if (/^ff/u.test(value)) return true
      return false
    }
    return true
  }

  /** DNS-resolves a host and rejects it when any address is private. */
  async function resolvesToPrivate(host) {
    try {
      const answers = await lookup(host, { all: true })
      if (answers.length === 0) return true
      return answers.some((answer) => isPrivateAddress(answer.address))
    } catch {
      return true
    }
  }

  /** Validates an import URL (protocol, hostname, private addresses). */
  async function safeImportUrl(value) {
    let url
    try {
      url = new URL(String(value ?? ''))
    } catch {
      return undefined
    }
    const localAllowed = config.allowLocalDictionaryImport === true
    if (url.protocol !== 'https:' && !(localAllowed && url.protocol === 'http:')) return undefined
    if (url.username !== '' || url.password !== '') return undefined
    const host = url.hostname.toLowerCase().replace(/\.$/u, '')
    if (host === '') return undefined
    if (host === 'localhost' || host === 'localhost.localdomain') {
      return localAllowed ? url : undefined
    }
    const address = host.replace(/^\[|\]$/gu, '')
    if (isIP(address) !== 0) return isPrivateAddress(address) && !localAllowed ? undefined : url
    if (await resolvesToPrivate(address)) return localAllowed ? url : undefined
    return url
  }

  /** Reads a response body with a hard byte limit. */
  async function readLimitedText(response, limitBytes) {
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > limitBytes) throw new Error('too-large')
    if (response.body === null || response.body === undefined) return { text: (await response.text()).slice(0, limitBytes), truncated: false }
    const reader = response.body.getReader()
    const chunks = []
    let total = 0
    let truncated = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value === undefined) continue
      total += value.byteLength
      if (total > limitBytes) {
        chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - limitBytes))))
        truncated = true
        try {
          await reader.cancel()
        } catch {
          // поток уже закрыт
        }
        break
      }
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    return { text: buffer.toString('utf8'), truncated }
  }

  /** Fetches an import URL, revalidating every redirect hop. */
  async function fetchImportUrl(initialUrl) {
    let url = initialUrl
    for (let hop = 0; hop < 4; hop += 1) {
      const checked = await safeImportUrl(url.toString())
      if (checked === undefined) throw new Error('bad-url')
      const answer = await fetch(checked, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json, text/plain' },
      })
      if (answer.status >= 300 && answer.status < 400) {
        const location = answer.headers.get('location')
        if (location === null) throw new Error('bad-redirect')
        url = new URL(location, checked)
        continue
      }
      if (!answer.ok) throw new Error(`http-${answer.status}`)
      return await readLimitedText(answer, 512 * 1024)
    }
    throw new Error('too-many-redirects')
  }

  /** Directory with dynamic dictionary profiles. */
  function profilesDir() {
    return join(dirname(hotwordsFile), 'profiles')
  }

  /** True when the profile id is safe to turn into a file name. */
  function safeProfileId(id) {
    return typeof id === 'string' && /^[a-zа-яё0-9][a-zа-яё0-9-]{0,39}$/iu.test(id)
  }

  /** Path of one dictionary profile; undefined for unsafe ids. */
  function profilePath(id) {
    if (!safeProfileId(id)) return undefined
    const resolved = join(profilesDir(), `${id}.json`)
    // Дополнительная страховка: файл обязан лежать внутри profilesDir.
    return dirname(resolved) === profilesDir() ? resolved : undefined
  }

  /** Reads one profile file. */
  function readProfileFile(id) {
    const path = profilePath(id)
    if (path === undefined) return undefined
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'))
      if (parsed === null || typeof parsed !== 'object') return undefined
      return {
        id,
        name: typeof parsed.name === 'string' && parsed.name !== '' ? parsed.name : id,
        words: Array.isArray(parsed.words) ? parsed.words.filter((word) => typeof word === 'string') : [],
        replacements: parsed.replacements !== null && typeof parsed.replacements === 'object' ? parsed.replacements : {},
        updatedAt: Number(parsed.updatedAt) || 0,
      }
    } catch {
      return undefined
    }
  }

  /** Writes one profile file atomically. */
  function writeProfileFile(profile) {
    const file = profilePath(profile.id)
    if (file === undefined) return false
    try {
      mkdirSync(profilesDir(), { recursive: true })
      const temp = `${file}.tmp-${process.pid}`
      writeFileSync(temp, `${JSON.stringify({ ...profile, updatedAt: Date.now() }, null, 2)}\n`)
      renameSync(temp, file)
      return true
    } catch (error) {
      log('cannot write profile', error)
      return false
    }
  }

  /** Lists profiles; creates the default one from the active dictionary. */
  function readProfiles({ create = true } = {}) {
    let files = []
    try {
      mkdirSync(profilesDir(), { recursive: true })
      files = readdirSync(profilesDir()).filter((name) => name.endsWith('.json'))
    } catch {
      files = []
    }
    let profiles = files.map((name) => readProfileFile(name.slice(0, -5))).filter((profile) => profile !== undefined)
    if (profiles.length === 0 && create === true && readSettings().profilesBootstrapped !== true) {
      const settings = readSettings()
      const snapshot = snapshotActiveDictionary(settings.activeProfile ?? 'default', settings.activeProfile ?? 'default')
      if (snapshot !== undefined) {
        writeProfileFile(snapshot)
        writeSettings({ ...settings, profilesBootstrapped: true })
        profiles = [snapshot]
      }
    }
    return profiles.sort((left, right) => left.name.localeCompare(right.name))
  }

  /** Personal words and replacements of the active dictionary. */
  function snapshotActiveDictionary(id, name) {
    let words = []
    try {
      words = readPersonalHotwords(readFileSync(hotwordsFile, 'utf8'))
    } catch {
      words = []
    }
    return { id, name: name ?? id, words, replacements: readReplacementsFile(), updatedAt: Date.now() }
  }

  /** Replaces the active dictionary files with the given profile contents. */
  function writeActiveDictionary(words, replacements) {
    try {
      let before = ''
      try {
        before = splitPersonal(readFileSync(hotwordsFile, 'utf8')).before.trimEnd()
      } catch {
        before = ''
      }
      const content = `${before === '' ? '' : `${before}\n\n`}${PERSONAL_MARKER}\n${words.join('\n')}\n${PERSONAL_END}\n`
      writeFileSync(hotwordsFile, content)
      writeFileSync(replacementsFile, renderReplacements(replacements))
      return true
    } catch (error) {
      log('cannot switch profile', error)
      return false
    }
  }

  /** Switches to another dynamic dictionary, saving the current one first. */
  function switchProfile(id) {
    const target = readProfileFile(id)
    if (target === undefined) return { ok: false, reason: 'not-found' }
    const settings = readSettings()
    if (settings.activeProfile !== id) {
      // Имя профиля человекочитаемое: при сохранении не заменяем его id.
      const previous = readProfileFile(settings.activeProfile)
      const current = snapshotActiveDictionary(settings.activeProfile, previous?.name ?? settings.activeProfile)
      if (current !== undefined) writeProfileFile(current)
    }
    if (!writeActiveDictionary(target.words, target.replacements)) return { ok: false, reason: 'write-failed' }
    writeSettings({ ...settings, activeProfile: id })
    // Новые слова не должны сразу попадать в retention: даём им grace-период.
    try {
      const stats = readStats()
      for (const word of target.words) {
        const entry = stats.terms[word] ?? { hits: 0, lastAt: 0, sinceDictation: stats.dictations }
        entry.sinceDictation = stats.dictations
        stats.terms[word] = entry
      }
      writeStats(stats)
    } catch (error) {
      log('cannot refresh profile stats', error)
    }
    return { ok: true, active: id }
  }

  /** Creates a profile from the current dictionary and switches to it. */
  function createProfile(name) {
    const clean = normalizePhrase(name)
    if (clean === '') return { ok: false, reason: 'bad-name' }
    const settings = readSettings()
    const base = clean.toLowerCase().replace(/[^a-zа-я0-9]+/giu, '-').replace(/^-+|-+$/gu, '').slice(0, 40) || 'profile'
    let id = base
    let suffix = 2
    while (readProfileFile(id) !== undefined) {
      id = `${base}-${suffix}`
      suffix += 1
    }
    // Сохраняем последние слова текущего активного профиля — только если он жив.
    const previous = readProfileFile(settings.activeProfile)
    if (previous !== undefined) {
      const current = snapshotActiveDictionary(settings.activeProfile, previous.name ?? settings.activeProfile)
      if (current !== undefined) writeProfileFile(current)
    }
    const profile = snapshotActiveDictionary(id, clean)
    if (!writeProfileFile(profile)) return { ok: false, reason: 'write-failed' }
    writeSettings({ ...settings, activeProfile: id, profilesBootstrapped: true })
    return { ok: true, id, name: clean }
  }

  /** Deletes a profile; the active one switches to another or to an empty one. */
  function deleteProfile(id) {
    const settings = readSettings()
    const file = profilePath(id)
    if (file === undefined) return { ok: false, reason: 'bad-id' }
    try {
      rmSync(file, { force: true })
    } catch (error) {
      log('cannot delete profile', error)
      return { ok: false, reason: 'delete-failed' }
    }
    if (settings.activeProfile === id) {
      const remaining = readProfiles({ create: false }).filter((profile) => profile.id !== id)
      const target = remaining[0]
      if (target !== undefined) {
        // Напрямую, без snapshot: иначе удалённый профиль воскреснет.
        writeActiveDictionary(target.words, target.replacements)
        writeSettings({ ...settings, activeProfile: target.id })
      } else {
        writeActiveDictionary([], {})
        writeSettings({ ...settings, activeProfile: 'default', profilesBootstrapped: true })
      }
    }
    return { ok: true }
  }

  /** Last hint: which non-active dictionary matches the recognized text. */
  let profileSuggestion
  /** Profile switched automatically after the last dictation. */
  let profileAutoSwitched

  /** Updates the dynamic-dictionary hint after a transcription. */
  function updateProfileSuggestion(text) {
    const settings = readSettings()
    if (settings.autoSwitch === false) {
      profileSuggestion = undefined
      return
    }
    const haystack = ` ${String(text ?? '').toLowerCase()} `
    let best
    for (const profile of readProfiles()) {
      if (profile.id === settings.activeProfile) continue
      let hits = 0
      for (const word of profile.words) {
        if (word.trim() === '') continue
        if (containsTerm(haystack, word)) hits += 1
      }
      for (const heard of Object.keys(profile.replacements)) {
        if (containsTerm(haystack, heard)) hits += 1
      }
      if (hits >= 2 && (best === undefined || hits > best.hits)) best = { id: profile.id, name: profile.name, hits }
    }
    profileSuggestion = best
    if (best !== undefined && settings.autoSwitchMode === 'auto') {
      const switched = switchProfile(best.id)
      if (switched.ok === true) {
        profileAutoSwitched = { id: best.id, name: best.name }
        profileSuggestion = undefined
      }
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
  /** True when the request comes from our own app or a local process. */
  function isTrustedRequest(request) {
    const host = request.headers.host
    if (typeof host === 'string' && host !== '' && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/iu.test(host)) return false
    const site = request.headers['sec-fetch-site']
    const origin = request.headers.origin
    const userAgent = String(request.headers['user-agent'] ?? '')
    // Electron (file://) присылает Origin: null; DSH 0.2.2+ грузит рендерер
    // со схемы dsh-app://app. Обычный браузер с opaque origin тоже даёт null,
    // но у него нет Electron в UA.
    const electron = /Electron|DeepSeek Harness/iu.test(userAgent)
    const appSchemeOrigin = typeof origin === 'string' && /^(?:dsh-app|file):\/\//iu.test(origin) && electron
    if (typeof site === 'string' && site !== '') {
      if (site === 'cross-site') return (origin === 'null' && electron) || appSchemeOrigin
      return true
    }
    if (origin === 'null') return electron
    if (appSchemeOrigin) return true
    if (typeof origin === 'string' && origin !== '') {
      try {
        const url = new URL(origin)
        return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1' || url.hostname === '[::1]'
      } catch {
        return false
      }
    }
    return true
  }

  /**
   * Mutating requests from a browser must carry our client header: a cross-site
   * page cannot send it without a preflight, which we reject for untrusted
   * origins. Local non-browser processes (curl/CLI) have no Origin and pass.
   */
  function isMutatingAllowed(request) {
    const browserContext = request.headers.origin !== undefined || request.headers['sec-fetch-site'] !== undefined
    if (!browserContext) return true
    return request.headers['x-dsh-locale-client'] === '1' && isTrustedRequest(request)
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
      if (!isTrustedRequest(request)) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, reason: 'cross-site' }))
        return
      }
      response.setHeader('access-control-allow-origin', '*')
      response.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS')
      response.setHeader('access-control-allow-headers', 'content-type, x-dsh-locale-client')
      response.setHeader('access-control-allow-private-network', 'true')
      if (request.method === 'OPTIONS' && !isTrustedRequest(request)) {
        response.writeHead(403)
        response.end()
        return
      }
      if (request.method === 'POST' && !isMutatingAllowed(request)) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, reason: 'csrf' }))
        return
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-private-network': 'true' })
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
          merge: config.merge ?? 'sentences',
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
          const engines = ['auto', 'gigaam', 'whisper', 'hybrid']
          const merges = ['auto', 'sentences', 'text', 'words']
          const engine = engines.includes(payload?.engine) ? payload.engine : undefined
          const merge = merges.includes(payload?.merge) ? payload.merge : (config.merge ?? 'sentences')
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
      if (request.method === 'GET' && (request.url === '/transcriptions' || request.url.startsWith('/transcriptions?'))) {
        let after = 0
        try {
          after = Number(new URL(request.url, 'http://127.0.0.1').searchParams.get('after') ?? 0) || 0
        } catch {
          after = 0
        }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ items: recentTranscriptions.filter((item) => item.at > after) }))
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
      if (request.method === 'GET' && request.url === '/profiles') {
        const settings = readSettings()
        const profiles = readProfiles()
        response.writeHead(200, { 'content-type': 'application/json' })
        const switched = profileAutoSwitched
        profileAutoSwitched = undefined
        response.end(JSON.stringify({
          active: settings.activeProfile,
          autoSwitch: settings.autoSwitch,
          mode: settings.autoSwitchMode,
          switched,
          profiles: profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            words: profile.words.length,
            replacements: Object.keys(profile.replacements).length,
            updatedAt: profile.updatedAt,
          })),
          suggestion: profileSuggestion,
        }))
        return
      }
      if (request.method === 'POST' && request.url === '/profiles/create') {
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
          const result = createProfile(payload?.name)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/profiles/switch') {
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
          const result = switchProfile(payload?.id)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/profiles/delete') {
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
          const result = deleteProfile(payload?.id)
          response.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json' })
          response.end(JSON.stringify(result))
        })
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
          const hasAutoLearn = typeof payload?.autoLearn === 'boolean'
          const hasAutoSwitch = typeof payload?.autoSwitch === 'boolean'
          const hasAutoSwitchMode = payload?.autoSwitchMode === 'auto' || payload?.autoSwitchMode === 'suggest'
          if (!hasAutoLearn && !hasAutoSwitch && !hasAutoSwitchMode) {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-settings' }))
            return
          }
          const settings = { ...readSettings() }
          if (hasAutoLearn) settings.autoLearn = payload.autoLearn
          if (hasAutoSwitch) settings.autoSwitch = payload.autoSwitch
          if (hasAutoSwitchMode) settings.autoSwitchMode = payload.autoSwitchMode
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
          profiles: { active: readSettings().activeProfile, count: readProfiles().length },
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
              const stats = readStats()
              if (stats.terms[phrase] !== undefined) {
                delete stats.terms[phrase]
                writeStats(stats)
              }
            } catch (error) {
              log('cannot drop word stats', error)
            }
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
      if (request.method === 'GET' && request.url === '/stats') {
        const stats = readStats()
        const minDictations = retentionMinDictations()
        let personal = []
        try {
          personal = readPersonalHotwords(readFileSync(hotwordsFile, 'utf8'))
        } catch {
          personal = []
        }
        const replacements = readReplacementsFile()
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          dictations: stats.dictations,
          enabledAt: stats.enabledAt,
          updatedAt: stats.updatedAt,
          minDictations,
          words: personal.map((word) => {
            const entry = stats.terms[word] ?? {}
            return { word, hits: Number(entry.hits) || 0, lastAt: Number(entry.lastAt) || 0 }
          }),
          replacements: Object.entries(replacements).map(([heard, chosen]) => {
            const entry = stats.pairs[heard] ?? {}
            return { heard, chosen, applied: Number(entry.applied) || 0, lastAt: Number(entry.lastAt) || 0 }
          }),
          stale: staleHotwords(stats, minDictations),
        }))
        return
      }
      if (request.method === 'POST' && request.url === '/stats/prune') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) request.destroy()
        })
        request.on('end', () => {
          let payload = {}
          try {
            payload = JSON.parse(body)
          } catch {
            payload = {}
          }
          const stats = readStats()
          const stale = staleHotwords(stats, retentionMinDictations())
          if (payload?.dryRun !== false) {
            response.writeHead(200, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: true, dryRun: true, stale }))
            return
          }
          let current
          try {
            current = readFileSync(hotwordsFile, 'utf8')
          } catch {
            current = SEED_HOTWORDS
          }
          const removed = []
          for (const entry of stale) {
            const result = forgetPersonalPhrase(current, entry.word)
            if (result.ok !== true) continue
            current = result.text
            removed.push(entry.word)
            delete stats.terms[entry.word]
          }
          if (removed.length > 0) {
            try {
              writeFileSync(hotwordsFile, current)
              writeStats(stats)
              void reloadHotwordsInBackground()
            } catch (error) {
              log('cannot prune dictionary', error)
              response.writeHead(500, { 'content-type': 'application/json' })
              response.end(JSON.stringify({ ok: false, reason: 'write-failed' }))
              return
            }
          }
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok: true, removed }))
        })
        return
      }
      if (request.method === 'POST' && request.url === '/stats/reset') {
        writeStats({ dictations: 0, terms: {}, pairs: {}, enabledAt: Date.now(), updatedAt: 0 })
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true }))
        return
      }
      if (request.method === 'POST' && request.url === '/dictionary/import-url') {
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
          if (body.length > 8192) request.destroy()
        })
        request.on('end', async () => {
          let payload
          try {
            payload = JSON.parse(body)
          } catch {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-json' }))
            return
          }
          const url = await safeImportUrl(payload?.url)
          if (url === undefined) {
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'bad-url' }))
            return
          }
          let text
          try {
            const loaded = await fetchImportUrl(url)
            text = loaded.text
            if (loaded.truncated) log('dictionary import truncated at 512 KB')
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'fetch-failed'
            log('dictionary import failed', reason)
            response.writeHead(400, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason }))
            return
          }
          const trimmed = String(text).trim()
          let words = []
          let pairs = []
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            let parsed
            try {
              parsed = JSON.parse(trimmed)
            } catch {
              response.writeHead(400, { 'content-type': 'application/json' })
              response.end(JSON.stringify({ ok: false, reason: 'bad-json-body' }))
              return
            }
            words = Array.isArray(parsed)
              ? parsed.filter((word) => typeof word === 'string')
              : Array.isArray(parsed?.words) ? parsed.words.filter((word) => typeof word === 'string') : []
            pairs = parsed?.replacements !== null && typeof parsed?.replacements === 'object'
              ? Object.entries(parsed.replacements).filter(([heard, chosen]) => typeof heard === 'string' && typeof chosen === 'string')
              : []
          } else {
            words = trimmed.split(/[\n,;]+/u).map((word) => word.trim()).filter((word) => word !== '')
          }
          const limit = 100
          words = words.slice(0, limit)
          pairs = pairs.slice(0, Math.max(0, limit - words.length))
          let wordsAdded = 0
          let pairsAdded = 0
          for (const word of words) {
            const result = addPersonalHotword(word)
            if (result.ok === true && result.duplicate !== true) wordsAdded += 1
          }
          for (const [heard, chosen] of pairs) {
            if (Number(heard.length) > MAX_HOTWORD_LENGTH || Number(chosen.length) > MAX_HOTWORD_LENGTH) continue
            const result = learnCorrection(heard, chosen, 'manual')
            if (result.ok === true) pairsAdded += 1
          }
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ ok: true, words: wordsAdded, replacements: pairsAdded, total: words.length + pairs.length }))
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
      // Любая синхронная ошибка маршрута не должна ронять host-процесс.
      const safeHandle = (request, response) => {
        try {
          handle(request, response)
        } catch (error) {
          log('dictionary endpoint error', error)
          try {
            response.writeHead(500, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ ok: false, reason: 'internal' }))
          } catch {
            // соединение уже закрыто
          }
        }
      }
      const candidate = createServer(safeHandle)
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

  /** Path to whisper-server (vendor bundle, Homebrew or the CLI directory). */
  function whisperServerBinary() {
    if (typeof config.whisperServerPath === 'string') {
      // Пустая строка — явное «тёплый сервер выключен».
      if (config.whisperServerPath === '') return undefined
      if (existsSync(config.whisperServerPath)) return config.whisperServerPath
      log('whisperServerPath не найден, ищу стандартные:', config.whisperServerPath)
    }
    const candidates = [
      join(dirname(whisperBinaryPath), 'whisper-server'),
      '/opt/homebrew/bin/whisper-server',
      '/usr/local/bin/whisper-server',
    ]
    return candidates.find((candidate) => existsSync(candidate))
  }

  /** Free loopback port for the warm server. */
  async function pickWhisperPort() {
    return await new Promise((resolve, reject) => {
      const probe = createNetServer()
      probe.unref?.()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address()
        const port = typeof address === 'object' && address !== null ? address.port : 0
        probe.close(() => resolve(port))
      })
    })
  }

  /** Stops the warm whisper server, including a start still in progress. */
  async function stopWhisperServer() {
    const children = []
    if (whisperServer !== undefined) children.push(whisperServer.child)
    if (whisperServerStartingChild !== undefined) children.push(whisperServerStartingChild)
    whisperServer = undefined
    whisperServerStartingChild = undefined
    for (const child of children) {
      if (child === undefined || child === null || child.exitCode !== null) continue
      try {
        child.kill('SIGTERM')
      } catch (error) {
        // процесс уже остановлен
      }
      await new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve()
          return
        }
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch (error) {
            // процесс уже остановлен
          }
          resolve()
        }, STOP_TIMEOUT_MS)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }

  /**
   * Starts (or reuses) the warm whisper server. Single-flight: a prewarm and
   * the first dictation share one start instead of spawning two processes.
   * @param signal - optional abort signal of the dictation.
   * @returns the server origin, or undefined when unavailable.
   */
  async function ensureWhisperServer(signal) {
    if (whisperServer !== undefined) return whisperServer.origin
    if (whisperServerStarting !== undefined) {
      if (signal === undefined) return await whisperServerStarting
      // Чужой старт (prewarm) не убиваем, но ожидание делаем прерываемым.
      return await new Promise((resolve, reject) => {
        const abort = () => {
          signal.removeEventListener?.('abort', abort)
          const error = new Error('Диктовка отменена')
          error.name = 'AbortError'
          reject(error)
        }
        if (signal.aborted === true) {
          abort()
          return
        }
        signal.addEventListener?.('abort', abort, { once: true })
        whisperServerStarting.then((value) => {
          signal.removeEventListener?.('abort', abort)
          resolve(value)
        }, (error) => {
          signal.removeEventListener?.('abort', abort)
          reject(error)
        })
      })
    }
    if (disposed || signal?.aborted === true) return undefined
    if (Date.now() < whisperServerDisabledUntil) return undefined
    if (!hasWhisper()) return undefined
    const binary = whisperServerBinary()
    if (binary === undefined) return undefined
    whisperServerStarting = (async () => {
      let port
      try {
        port = await pickWhisperPort()
      } catch (error) {
        log('cannot pick a port for whisper-server', error)
        return undefined
      }
      const args = ['-m', whisperModelPath, '--host', '127.0.0.1', '--port', String(port), '-t', '8', '-l', whisperLanguage, '-nt']
      let child
      try {
        child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (error) {
        log('cannot start whisper-server', error)
        whisperServerDisabledUntil = Date.now() + 60_000
        return undefined
      }
      whisperServerStartingChild = child
      let spawnError
      child.once('error', (error) => {
        spawnError = error
        log('whisper-server spawn error', error instanceof Error ? error.message : String(error))
        whisperServerDisabledUntil = Date.now() + 60_000
        try {
          child.kill('SIGKILL')
        } catch {
          // процесс уже остановлен
        }
      })
      child.stdout?.resume?.()
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000) })
      child.on('exit', () => {
        if (whisperServer?.child === child) whisperServer = undefined
      })
      const origin = `http://127.0.0.1:${port}`
      const deadline = Date.now() + 12_000
      while (Date.now() < deadline) {
        if (disposed || signal?.aborted === true) {
          try {
            child.kill('SIGKILL')
          } catch (error) {
            // процесс уже остановлен
          }
          return undefined
        }
        if (spawnError !== undefined || child.exitCode !== null) break
        try {
          const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(800) })
          if (response.ok || response.status === 404) {
            whisperServer = { child, port, origin }
            log('whisper-server ready on', port)
            return origin
          }
        } catch (error) {
          // сервер ещё загружает модель
        }
        await sleep(200)
      }
      log('whisper-server did not start', stderr.slice(-300))
      try {
        child.kill('SIGKILL')
      } catch (error) {
        // процесс уже остановлен
      }
      whisperServerDisabledUntil = Date.now() + 60_000
      return undefined
    })()
    try {
      return await whisperServerStarting
    } finally {
      whisperServerStarting = undefined
      whisperServerStartingChild = undefined
    }
  }

  /** Sends audio to the warm whisper server; returns text or undefined. */
  async function postWhisperServer(audio, signal) {
    const origin = await ensureWhisperServer(signal)
    if (origin === undefined) return undefined
    const boundary = `----dshwhisper${Date.now()}${Math.random().toString(16).slice(2)}`
    const field = (name, data, filename) => Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"${filename === undefined ? '' : `; filename="${filename}"`}\r\n`),
      filename === undefined ? Buffer.from('\r\n') : Buffer.from('Content-Type: audio/wav\r\n\r\n'),
      data,
      Buffer.from('\r\n'),
    ])
    const parts = [field('file', audio, 'audio.wav')]
    const prompt = whisperPrompt()
    // whisper.cpp 1.9.5 принимает prompt полем запроса — сервер не нужно
    // перезапускать при изменении словаря.
    if (prompt !== '') parts.push(field('prompt', Buffer.from(prompt)))
    const body = Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)])
    try {
      const response = await fetch(`${origin}/inference`, {
        method: 'POST',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
        signal,
      })
      if (!response.ok) {
        log('whisper-server HTTP', response.status)
        return undefined
      }
      const payload = await response.json()
      return typeof payload?.text === 'string' ? payload.text.trim() : undefined
    } catch (error) {
      if (signal?.aborted === true) throw error
      log('whisper-server request failed', error instanceof Error ? error.message : String(error))
      return undefined
    }
  }

  /** Parses a 16-bit PCM WAV: format fields and the data chunk bounds. */
  function parseWav(audio) {
    if (!Buffer.isBuffer(audio) || audio.length < 44) return undefined
    if (audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') return undefined
    let offset = 12
    let format
    let dataOffset
    let dataLength
    while (offset + 8 <= audio.length) {
      const id = audio.toString('ascii', offset, offset + 4)
      const size = audio.readUInt32LE(offset + 4)
      const body = offset + 8
      if (id === 'fmt ' && body + 16 <= audio.length) {
        format = {
          audioFormat: audio.readUInt16LE(body),
          channels: audio.readUInt16LE(body + 2),
          sampleRate: audio.readUInt32LE(body + 4),
          bitsPerSample: audio.readUInt16LE(body + 14),
        }
      } else if (id === 'data') {
        dataOffset = body
        dataLength = Math.min(size, audio.length - body)
      }
      offset = body + size + (size % 2)
      if (dataOffset !== undefined && format !== undefined) break
    }
    if (format === undefined || dataOffset === undefined) return undefined
    if (format.audioFormat !== 1 || format.bitsPerSample !== 16 || format.channels < 1) return undefined
    return { ...format, dataOffset, dataLength }
  }

  /**
   * Trims leading and trailing silence from a 16-bit PCM WAV. Timings returned
   * by the engine are relative to the trimmed audio, so the caller shifts words
   * by `offsetSeconds` back to the original recording timeline.
   * @param audio - WAV buffer.
   * @param options - enabled flag, threshold ratio and padding.
   * @returns trimmed audio plus the removed leading offset.
   */
  function trimSilenceWav(audio, { enabled = true, thresholdRatio = 0.02, paddingMs = 150 } = {}) {
    const originalSeconds = wavSeconds(audio)
    const passthrough = { audio, offsetSeconds: 0, durationSeconds: originalSeconds, trimmed: false }
    if (!enabled) return passthrough
    const wav = parseWav(audio)
    if (wav === undefined) return passthrough
    const frameBytes = 2 * wav.channels
    const frameCount = Math.floor(wav.dataLength / frameBytes)
    if (frameCount === 0) return passthrough
    const frameSamples = Math.max(1, Math.round(wav.sampleRate * 0.02))
    const frames = Math.ceil(frameCount / frameSamples)
    const energies = new Array(frames).fill(0)
    let maxEnergy = 0
    for (let frame = 0; frame < frames; frame += 1) {
      let sum = 0
      let count = 0
      const start = frame * frameSamples
      const end = Math.min(frameCount, start + frameSamples)
      for (let sample = start; sample < end; sample += 1) {
        const value = audio.readInt16LE(wav.dataOffset + sample * frameBytes)
        sum += value * value
        count += 1
      }
      const rms = count === 0 ? 0 : Math.sqrt(sum / count)
      energies[frame] = rms
      if (rms > maxEnergy) maxEnergy = rms
    }
    const threshold = Math.max(60, maxEnergy * thresholdRatio)
    let first = energies.findIndex((energy) => energy >= threshold)
    if (first === -1) return passthrough
    let last = energies.length - 1
    while (last > first && energies[last] < threshold) last -= 1
    const paddingFrames = Math.round(paddingMs / 20)
    first = Math.max(0, first - paddingFrames)
    last = Math.min(energies.length - 1, last + paddingFrames)
    const startSample = first * frameSamples
    const endSample = Math.min(frameCount, (last + 1) * frameSamples)
    if (startSample === 0 && endSample === frameCount) return passthrough
    const startByte = startSample * frameBytes
    const endByte = endSample * frameBytes
    const header = Buffer.from(audio.subarray(0, wav.dataOffset))
    const body = Buffer.from(audio.subarray(wav.dataOffset + startByte, wav.dataOffset + endByte))
    const result = Buffer.concat([header, body])
    result.writeUInt32LE(result.length - 8, 4)
    result.writeUInt32LE(body.length, wav.dataOffset - 4)
    return {
      audio: result,
      offsetSeconds: startSample / wav.sampleRate,
      durationSeconds: wavSeconds(result),
      trimmed: true,
    }
  }

  /**
   * Splits a long WAV into ~20 s pieces, cutting at the quietest frame near
   * each boundary. Whisper's long-form decoding otherwise merges everything
   * into one run-on without sentence punctuation.
   * @param audio - WAV buffer.
   * @param chunkSeconds - target piece length.
   * @param thresholdSeconds - shorter audio is returned as one piece.
   * @returns WAV buffers.
   */
  function chunkWav(audio, chunkSeconds, thresholdSeconds) {
    const wav = parseWav(audio)
    if (wav === undefined || wavSeconds(audio) <= thresholdSeconds) return [audio]
    const frameSamples = Math.max(1, Math.round(wav.sampleRate * 0.02))
    const frameBytes = 2 * wav.channels
    const frames = Math.floor(wav.dataLength / frameBytes / frameSamples)
    if (frames < 2) return [audio]
    const energies = new Array(frames)
    for (let frame = 0; frame < frames; frame += 1) {
      let sum = 0
      for (let sample = 0; sample < frameSamples; sample += 1) {
        const value = audio.readInt16LE(wav.dataOffset + (frame * frameSamples + sample) * frameBytes)
        sum += value * value
      }
      energies[frame] = Math.sqrt(sum / frameSamples)
    }
    const secondsPerFrame = frameSamples / wav.sampleRate
    const cuts = []
    let lastFrame = 0
    while ((frames - lastFrame) * secondsPerFrame > chunkSeconds * 1.4) {
      const targetFrame = lastFrame + Math.round(chunkSeconds / secondsPerFrame)
      const from = Math.max(lastFrame + Math.round(2 / secondsPerFrame), targetFrame - Math.round(3 / secondsPerFrame))
      const to = Math.min(frames - 1, targetFrame + Math.round(3 / secondsPerFrame))
      let bestFrame = targetFrame
      let bestEnergy = Infinity
      for (let frame = from; frame <= to; frame += 1) {
        if (energies[frame] < bestEnergy) {
          bestEnergy = energies[frame]
          bestFrame = frame
        }
      }
      cuts.push(bestFrame)
      lastFrame = bestFrame
    }
    cuts.push(frames)
    const chunks = []
    let startFrame = 0
    for (const endFrame of cuts) {
      const startByte = wav.dataOffset + startFrame * frameSamples * frameBytes
      const endByte = wav.dataOffset + Math.min(frames, endFrame) * frameSamples * frameBytes
      const body = Buffer.from(audio.subarray(startByte, endByte))
      const header = Buffer.from(audio.subarray(0, wav.dataOffset))
      header.writeUInt32LE(header.length - 8 + body.length, 4)
      header.writeUInt32LE(body.length, wav.dataOffset - 4)
      chunks.push(Buffer.concat([header, body]))
      startFrame = endFrame
    }
    return chunks
  }

  /** Light punctuation cleanup: spacing, sentence capitals. */
  function normalizeText(text) {
    let value = String(text ?? '')
    if (value === '') return value
    value = value.replace(/[ \t]+/gu, ' ')
    value = value.replace(/\s+([,.;:!?])/gu, '$1')
    // Пробел после знака: не трогаем десятичные «1,2».
    value = value.replace(/([,.;:!?])(?=[\p{L}])/gu, '$1 ')
    value = value.replace(/([,;:!?])(?=\d)/gu, (match, punctuation, offset, whole) => {
      const before = whole[offset - 1] ?? ''
      return /\d/u.test(before) ? match : `${punctuation} `
    })
    value = value.replace(/([.!?])(?=\d)/gu, '$1 ')
    // Заглавные в начале текста и после конца предложения.
    value = value.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    return value.trim()
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
  /** Cache for the Whisper prompt: rebuilt only when the dictionary changes. */
  let whisperPromptCache = { signature: '', value: '' }

  function whisperPrompt() {
    const terms = []
    const seen = new Set()
    const push = (term, weight) => {
      const clean = normalizePhrase(term)
      const key = clean.toLowerCase()
      if (clean === '' || seen.has(key)) return
      seen.add(key)
      terms.push({ term: clean, weight })
    }
    for (const word of readHotwords()) push(word, /[A-Za-z]/u.test(word) ? 3 : 1)
    for (const chosen of Object.values(readReplacementsFile())) push(chosen, /[A-Za-z]/u.test(chosen) ? 3 : 1)
    // Свежие авто-пары важнее: они появились из реальных ошибок.
    for (const pair of readLearnedQueue()) push(pair.chosen, 4)
    terms.sort((left, right) => right.weight - left.weight)
    const signature = terms.map((entry) => entry.term).join('\u0000')
    if (signature === whisperPromptCache.signature) return whisperPromptCache.value
    let prompt = ''
    let count = 0
    for (const entry of terms) {
      const next = prompt === '' ? entry.term : `${prompt}, ${entry.term}`
      if (next.length > 600 || count >= 60) break
      prompt = next
      count += 1
    }
    // Нейтральный префикс: голый список терминов Whisper воспринимает как
    // продолжение перечисления и перестаёт ставить точки в конце предложений.
    const value = prompt === '' ? '' : `Термины: ${prompt}.`
    const capped = value.length > 600 ? value.slice(0, 600) : value
    whisperPromptCache = { signature, value: capped }
    return capped
  }

  /**
   * Transcribes audio with whisper-cli: a separate multilingual engine that is
   * stronger on English terms than GigaAM.
   * @param audio - WAV bytes.
   * @param signal - cancellation.
   * @returns recognized text.
   */
  async function transcribeViaWhisper(audio, signal) {
    const chunks = chunkWav(
      audio,
      Number.isFinite(Number(config.whisperChunkSeconds)) ? Number(config.whisperChunkSeconds) : 20,
      Number.isFinite(Number(config.whisperChunkThresholdSeconds)) ? Number(config.whisperChunkThresholdSeconds) : 30,
    )
    if (chunks.length === 1) return await transcribeWhisperOnce(audio, signal)
    const pieces = []
    for (const chunk of chunks) {
      if (signal?.aborted === true) {
        const error = new Error('Диктовка отменена')
        error.name = 'AbortError'
        throw error
      }
      const piece = await transcribeWhisperOnce(chunk, signal)
      if (piece !== '') pieces.push(piece)
    }
    const text = pieces.join(' ').replace(/\s+/gu, ' ').trim()
    lastWhisperText = text
    return text
  }

  async function transcribeWhisperOnce(audio, signal) {
    if (signal?.aborted === true) {
      const error = new Error('Диктовка отменена')
      error.name = 'AbortError'
      throw error
    }
    // Тёплый сервер держит модель в памяти: ~0,7 с вместо ~1,1 с у CLI.
    const warm = await postWhisperServer(audio, signal).catch((error) => {
      if (signal.aborted) throw error
      log('whisper server unavailable', error instanceof Error ? error.message : String(error))
      return undefined
    })
    if (warm !== undefined) {
      lastWhisperText = warm
      return warm
    }
    if (signal?.aborted === true) {
      const error = new Error('Диктовка отменена')
      error.name = 'AbortError'
      throw error
    }
    const file = join(tmpdir(), `dsh-whisper-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`)
    writeFileSync(file, audio)
    try {
      const cliText = await new Promise((resolve, reject) => {
        const prompt = whisperPrompt()
        const child = spawn(whisperBinaryPath, [
          '-m', whisperModelPath, '-f', file, '-l', whisperLanguage, '-nt', '-t', '8',
          ...(prompt === '' ? [] : ['--prompt', prompt]),
        ], { stdio: ['ignore', 'pipe', 'pipe'], ...(signal === undefined ? {} : { signal }) })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => { stdout += chunk })
        child.stderr.on('data', (chunk) => { stderr += chunk })
        const onAbort = () => { child.kill('SIGTERM') }
        if (signal?.aborted === true) onAbort()
        else signal?.addEventListener?.('abort', onAbort)
        child.on('error', reject)
        child.on('close', (code) => {
          signal?.removeEventListener?.('abort', onAbort)
          if (signal?.aborted === true) {
            const error = new Error('Диктовка отменена')
            error.name = 'AbortError'
            reject(error)
            return
          }
          if (code !== 0) {
            reject(new Error(`whisper-cli завершился (код ${code}): ${stderr.slice(-300)}`))
            return
          }
          resolve(stdout.trim())
        })
      })
      lastWhisperText = cliText
      return cliText
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
  /** Normalized word set of a sentence, for alignment between engines. */
  function alignmentWords(text) {
    return new Set(String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/u).filter(Boolean))
  }

  /** Word-overlap similarity of two sentences (0..1). */
  function sentenceSimilarity(left, right) {
    const a = alignmentWords(left)
    const b = alignmentWords(right)
    if (a.size === 0 || b.size === 0) return 0
    let intersection = 0
    for (const word of a) if (b.has(word)) intersection += 1
    return intersection / Math.max(a.size, b.size)
  }

  /**
   * Merges transcripts sentence by sentence. If the engines split sentences
   * differently, sentences are matched by word overlap instead of order, and
   * unmatched Whisper sentences are kept when they add new content.
   * @param gigaamText - GigaAM transcript.
   * @param whisperText - Whisper transcript.
   * @param dictionary - known terms.
   * @returns merged text, or undefined when alignment is unreliable.
   */
  function mergeBySentences(gigaamText, whisperText, dictionary) {
    const left = splitSentences(gigaamText)
    const right = splitSentences(whisperText)
    if (left.length === 0 || right.length === 0) return undefined
    const score = (text) => {
      const hits = termHits(text)
      const suspicious = String(text).split(/\s+/u).filter((token) => {
        const core = token.replace(/[^\p{L}\p{N}]+$/u, '')
        if (core.length < 3 || !/[A-Za-z]/u.test(core)) return false
        return !dictionary.some((term) => alignWord(term) === alignWord(core))
      }).length
      return hits - suspicious
    }
    if (left.length === right.length) {
      let similarity = 0
      let pairwiseOk = true
      for (let index = 0; index < left.length; index += 1) {
        const pair = sentenceSimilarity(left[index], right[index])
        similarity += pair
        // Средней похожести мало: одна несовпавшая пара переставляет фразы.
        if (pair < 0.35) pairwiseOk = false
      }
      similarity /= left.length
      if (similarity >= 0.5 && pairwiseOk) {
        return left.map((sentence, index) => (score(right[index]) > score(sentence) ? right[index] : sentence)).join(' ')
      }
      // Порядок разошёлся: безопаснее взять целый текст, чем перемешать фразы.
      return undefined
    }
    // Опорный порядок — всегда GigaAM: его предложения не теряются и не
    // переставляются. Whisper подменяет предложение только при явном совпадении.
    // Сначала находим пары, чтобы понять, какие фразы Whisper уже покрывают
    // несколько коротких фраз GigaAM (иначе они попадут в текст дважды).
    const used = new Set()
    const matches = new Array(left.length).fill(-1)
    for (let index = 0; index < left.length; index += 1) {
      let bestIndex = -1
      let bestSimilarity = 0
      for (let candidate = 0; candidate < right.length; candidate += 1) {
        if (used.has(candidate)) continue
        const similarity = sentenceSimilarity(left[index], right[candidate])
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestIndex = candidate
        }
      }
      if (bestIndex >= 0 && bestSimilarity >= 0.5) {
        used.add(bestIndex)
        matches[index] = bestIndex
      }
    }
    /** Доля слов фразы, фонетически найденных в другой фразе. */
    const coverageIn = (sentence, haystack) => {
      const tokens = String(sentence).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
      if (tokens.length === 0) return 0
      const hayTokens = String(haystack).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
      let covered = 0
      for (const token of tokens) {
        if (hayTokens.some((word) => phoneticSimilarity(token, word) >= 0.8)) covered += 1
      }
      return covered / tokens.length
    }
    // Какие предложения Whisper реально попадут в текст: только выбранные
    // по score. Права, которые проиграли GigaAM, не должны скрывать соседние
    // фразы — иначе теряется смысл (например, «Мне ошибка выдаётся»).
    const chooseRight = left.map((sentence, index) => matches[index] >= 0
      && score(right[matches[index]]) > score(sentence))
    const plannedRight = left.map((sentence, index) => (chooseRight[index] ? right[matches[index]] : undefined)).filter(Boolean)
    const merged = []
    for (let index = 0; index < left.length; index += 1) {
      const bestIndex = matches[index]
      if (bestIndex >= 0) {
        merged.push(chooseRight[index] ? right[bestIndex] : left[index])
        continue
      }
      // Фраза уже покрыта предложением Whisper, которое войдёт в текст
      // (он объединил несколько коротких фраз в одну) — не дублируем её.
      if (plannedRight.some((candidate) => coverageIn(left[index], candidate) >= 0.75)) continue
      merged.push(left[index])
    }
    // Непарные предложения Whisper дописываем только как действительно новые:
    // если фраза фонетически уже покрыта сказанным (например, «Rozatti Platform»
    // против «разате платформ»), это дубль из-за другой разбивки, и в конец он
    // попадать не должен — иначе кажется, что начало уехало в конец.
    const mergedTokens = String(merged.join(' ')).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    for (let index = 0; index < right.length; index += 1) {
      if (used.has(index)) continue
      const sentence = right[index]
      const tokens = String(sentence).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []
      if (tokens.length === 0) continue
      let coveredWords = 0
      for (const token of tokens) {
        if (mergedTokens.some((word) => phoneticSimilarity(token, word) >= 0.8)) coveredWords += 1
      }
      if (coveredWords / tokens.length >= 0.4) continue
      const words = alignmentWords(sentence)
      if (words.size < 3) continue
      merged.push(sentence)
    }
    return merged.length === 0 ? undefined : merged.join(' ')
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
    /** A whole transcript beats a positional mix when the split does not line up. */
    const wholeText = () => {
      const gigaamLatin = hasLatinToken(gigaamText)
      const whisperLatin = hasLatinToken(whisperText)
      if (whisperLatin && !gigaamLatin) return whisperText
      if (gigaamLatin && !whisperLatin) return gigaamText
      if (whisperLatin && gigaamLatin) {
        return latinTermScore(whisperText, dictionary) > latinTermScore(gigaamText, dictionary) ? whisperText : gigaamText
      }
      return gigaamText
    }
    if (left.length === 0 || right.length === 0) return wholeText()
    if (left.length !== right.length) return wholeText()
    // Одинаковое число предложений ещё не значит, что они совпадают по смыслу:
    // у движков разная разбивка, и позиционное слияние перемешивает фразы.
    for (let index = 0; index < left.length; index += 1) {
      if (sentenceSimilarity(left[index], right[index]) < 0.4) return wholeText()
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
    const mergedText = merged.join(' ')
    const wordsIn = (value) => String(value ?? '').split(/\s+/u).filter(Boolean).length
    // Позиционное слияние не должно раздувать текст дублями.
    if (wordsIn(mergedText) > Math.max(wordsIn(gigaamText), wordsIn(whisperText)) + 2) return wholeText()
    return mergedText
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
            start: Number(word?.start) + audioTrimOffsetSeconds,
            end: Number(word?.end) + audioTrimOffsetSeconds,
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
    if ((engineMode === 'whisper' || engineMode === 'hybrid') && !hasWhisper()) {
      throw new Error('Whisper не установлен: положите whisper-cli и модель в ~/.dsh/speech-ru/whisper или укажите пути в конфиге.')
    }
    transcribing = true
    // Тайминги не должны перетекать из предыдущей диктовки (whisper-режим,
    // сбой GigaAM): сбрасываем перед каждым распознаванием.
    gigaamWords = []
    gigaamTextForTimings = ''
    gigaamAudioSeconds = undefined
    autoFallback = false
    autoWhisperTried = false
    autoWhisperFailed = false
    lastWhisperText = ''
    // Обрезаем тишину: короче аудио — быстрее и точнее; слова сдвигаем назад.
    const prepared = trimSilenceWav(input.audio, {
      enabled: config.trimSilence !== false,
      thresholdRatio: Number.isFinite(Number(config.silenceThreshold)) ? Number(config.silenceThreshold) : 0.02,
      paddingMs: Number.isFinite(Number(config.silencePaddingMs)) ? Number(config.silencePaddingMs) : 150,
    })
    audioTrimOffsetSeconds = prepared.offsetSeconds
    const trimmedInput = prepared.trimmed ? { ...input, audio: prepared.audio } : input
    const started = performance.now()
    try {
      let raw
      if (engineMode === 'whisper') {
        raw = await transcribeViaWhisper(trimmedInput.audio, signal)
      } else if (engineMode === 'auto') {
        // Быстрый путь: GigaAM (~0,13 с); Whisper — только как страховка.
        let gigaamAnswer
        let gigaamFailed = false
        try {
          gigaamAnswer = await transcribeGigaam(trimmedInput, signal)
        } catch (error) {
          if (signal?.aborted === true || !hasWhisper()) throw error
          log('gigaam failed in auto, trying whisper', error instanceof Error ? error.message : String(error))
          gigaamFailed = true
          gigaamAnswer = { text: '', words: [], duration: undefined }
        }
        gigaamWords = gigaamAnswer.words ?? []
        gigaamTextForTimings = gigaamAnswer.text
        gigaamAudioSeconds = gigaamAnswer.duration
        raw = gigaamAnswer.text
        const autoDictionary = [...readHotwords(), ...Object.values(readReplacementsFile())].map((term) => term.toLowerCase())
        const autoLatin = (String(gigaamAnswer.text ?? '').match(/[A-Za-z]{3,}/gu) ?? [])
        const autoUnknownLatin = autoLatin.some((token) => !autoDictionary.some((term) => term.includes(token.toLowerCase())))
        const autoConfidences = (gigaamAnswer.words ?? []).map((word) => Number(word.confidence)).filter((value) => Number.isFinite(value))
        const autoAverage = autoConfidences.length === 0 ? 1 : autoConfidences.reduce((sum, value) => sum + value, 0) / autoConfidences.length
        // Кириллическая транслитерация термина («гейтхаб» вместо GitHub) —
        // тоже повод позвать Whisper.
        const autoLatinTerms = [...readHotwords(), ...Object.values(readReplacementsFile())]
          .filter((term) => /[A-Za-z]{4,}/u.test(String(term)))
        const autoCyrillicTokens = (String(gigaamAnswer.text ?? '').match(/[А-Яа-яЁё]{4,}/gu) ?? [])
        // Согласные устойчивее к транслитерации: «гейтхэп» и GitHub дают
        // похожий скелет g-t-h-p / g-t-h-b.
        const consonantKey = (value) => phoneticKey(value).replace(/[aeiouy]/gu, '')
        const consonantSimilarity = (left, right) => {
          const a = consonantKey(left)
          const b = consonantKey(right)
          if (a.length < 2 || b.length < 2) return 0
          if (a === b) return 1
          return 1 - wordDistance(a, b) / Math.max(a.length, b.length)
        }
        const autoTransliterated = autoCyrillicTokens.some((token) =>
          autoLatinTerms.some((term) => phoneticSimilarity(token, term) >= 0.45 || consonantSimilarity(token, term) >= 0.6))
        const needWhisper = gigaamFailed || String(gigaamAnswer.text ?? '').trim() === '' || autoUnknownLatin || autoTransliterated || autoAverage < 0.55
        if (needWhisper && hasWhisper()) {
          autoWhisperTried = true
          const whisperText = await transcribeViaWhisper(trimmedInput.audio, signal).catch((error) => {
            if (signal?.aborted === true || error?.name === 'AbortError') throw error
            autoWhisperFailed = true
            log('whisper failed in auto', error instanceof Error ? error.message : String(error))
            return ''
          })
          if (whisperText !== '') {
            autoFallback = true
            const dictionary = [...readHotwords(), ...Object.values(readReplacementsFile())]
            const strategy = config.merge ?? 'sentences'
            // Точечно чиним только битые латинские токены GigaAM по похожим
            // токенам Whisper; корректный GigaAM-текст не выбрасываем.
            const repairLatinTokens = (sourceText, whisper, terms) => {
              const textValue = String(sourceText ?? '')
              if (textValue === '' || String(whisper ?? '') === '') return textValue
              const known = new Set((terms ?? []).map((term) => String(term).toLowerCase()))
              const whisperTokens = (String(whisper).match(/[A-Za-z][A-Za-z0-9-]{2,}/gu) ?? [])
              if (whisperTokens.length === 0) return textValue
              return textValue.replace(/[A-Za-z][A-Za-z0-9-]{2,}/gu, (token) => {
                if (known.has(token.toLowerCase())) return token
                let best
                let bestScore = 0
                for (const candidate of whisperTokens) {
                  const score = phoneticSimilarity(token, candidate)
                  if (score > bestScore) {
                    bestScore = score
                    best = candidate
                  }
                }
                return best !== undefined && bestScore >= 0.6 && best.toLowerCase() !== token.toLowerCase() ? best : token
              })
            }
            const repaired = repairLatinTokens(gigaamAnswer.text, whisperText, dictionary)
            // Пустой GigaAM не должен выигрывать по равенству очков.
            const bestSingle = String(gigaamAnswer.text ?? '').trim() === ''
              ? whisperText
              : transcriptScore(whisperText) > transcriptScore(gigaamAnswer.text) ? whisperText : gigaamAnswer.text
            let merged
            if (strategy === 'words') merged = mergeByWords(repaired, whisperText, dictionary)
            else if (strategy === 'text' || strategy === 'auto') merged = transcriptScore(whisperText) > transcriptScore(repaired) ? whisperText : repaired
            else merged = mergeBySentences(repaired, whisperText, dictionary) ?? (() => {
              const wordCount = (value) => String(value ?? '').split(/\s+/u).filter(Boolean).length
              // Whisper мог распознать больше речи: не теряем его предложения.
              if (autoUnknownLatin && wordCount(whisperText) > wordCount(repaired) + 1) return whisperText
              return transcriptScore(whisperText) > transcriptScore(repaired) ? whisperText : repaired
            })()
            const wordCount = (value) => String(value ?? '').split(/\s+/u).filter(Boolean).length
            const suspiciousCount = (value) => (String(value ?? '').match(/[A-Za-z]{3,}/gu) ?? [])
              .filter((token) => !autoDictionary.some((term) => term.includes(token.toLowerCase()))).length
            const bestWhole = wordCount(repaired) >= wordCount(whisperText) ? repaired : whisperText
            if (String(merged ?? '').trim() === '' || wordCount(merged) < Math.max(wordCount(repaired), wordCount(whisperText)) * 0.8) merged = bestWhole
            else if (wordCount(merged) > Math.max(wordCount(repaired), wordCount(whisperText)) + 2) merged = bestWhole
            else if (suspiciousCount(merged) > suspiciousCount(bestWhole)) merged = bestWhole
            raw = String(merged ?? '').trim() !== '' ? merged : bestWhole
          } else if (gigaamFailed) {
            throw new Error('Не удалось распознать: GigaAM и Whisper не ответили.')
          }
        } else if (gigaamFailed) {
          throw new Error('GigaAM недоступен, а Whisper не установлен.')
        }
      } else if (engineMode === 'hybrid') {
        const [gigaamAnswer, whisperText] = await Promise.all([
          transcribeGigaam(trimmedInput, signal).catch((error) => {
            if (signal?.aborted === true || error?.name === 'AbortError') throw error
            log('gigaam failed in hybrid', error instanceof Error ? error.message : String(error))
            return { text: '', words: [], duration: undefined }
          }),
          transcribeViaWhisper(trimmedInput.audio, signal).catch((error) => {
            if (signal?.aborted === true || error?.name === 'AbortError') throw error
            log('whisper failed in hybrid', error instanceof Error ? error.message : String(error))
            return ''
          }),
        ])
        if (signal?.aborted === true) {
          const error = new Error('Диктовка отменена')
          error.name = 'AbortError'
          throw error
        }
        const gigaamText = gigaamAnswer.text
        gigaamWords = gigaamAnswer.words ?? []
        gigaamTextForTimings = gigaamText
        gigaamAudioSeconds = gigaamAnswer.duration
        const dictionary = [...readHotwords(), ...Object.values(readReplacementsFile())]
        const gigaamHits = termHits(gigaamText)
        const whisperHits = termHits(whisperText)
        const gigaamScore = transcriptScore(gigaamText)
        const whisperScore = transcriptScore(whisperText)
        const bestSingle = String(gigaamText ?? '').trim() === ''
          ? whisperText
          : whisperScore > gigaamScore ? whisperText : gigaamText
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
        const hybridWordCount = (value) => String(value ?? '').split(/\s+/u).filter(Boolean).length
        const hybridSuspicious = (value) => (String(value ?? '').match(/[A-Za-z]{3,}/gu) ?? [])
          .filter((token) => !dictionary.some((term) => term.toLowerCase().includes(token.toLowerCase()))).length
        if (String(merged ?? '').trim() === '' || hybridWordCount(merged) < Math.max(hybridWordCount(gigaamText), hybridWordCount(whisperText)) * 0.8) merged = bestSingle
        else if (hybridWordCount(merged) > Math.max(hybridWordCount(gigaamText), hybridWordCount(whisperText)) + 2) merged = bestSingle
        else if (hybridSuspicious(merged) > hybridSuspicious(bestSingle)) merged = bestSingle
        raw = String(merged ?? '').trim() !== '' ? merged : bestSingle
        if (String(raw ?? '').trim() === '') throw new Error('Не удалось распознать: ни GigaAM, ни Whisper не ответили.')
      } else {
        const gigaamAnswer = await transcribeGigaam(trimmedInput, signal)
        raw = gigaamAnswer.text
        gigaamWords = gigaamAnswer.words ?? []
        gigaamTextForTimings = gigaamAnswer.text
        gigaamAudioSeconds = gigaamAnswer.duration
      }
      // Выученные замены применяем к расшифровке: «гитхап» → GitHub. Клиент
      // показывает уведомление о замене, поэтому это не молчаливая правка.
      const replacements = readReplacementsFile()
      let text = applyReplacements(raw, replacements)
      if (config.punctuation !== false) text = normalizeText(text)
      // Какие замены реально сработали — клиент подсветит эти слова.
      const applied = []
      if (text !== raw) {
        for (const [heard, chosen] of Object.entries(replacements)) {
          if (containsTerm(raw, heard) && containsTerm(text, chosen) && raw !== text) applied.push({ heard, chosen })
        }
      }
      if (config.debugTranscripts === true) {
        try {
          // История последних диктовок: сравнение движков и слияния.
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
            engine: engineMode,
            mode: config.merge ?? 'sentences',
            autoFallback,
            autoWhisperTried,
            autoWhisperFailed,
            gigaam: gigaamTextForTimings,
            whisper: lastWhisperText,
            merged: raw,
            hits: { gigaam: termHits(gigaamTextForTimings), whisper: termHits(lastWhisperText), merged: termHits(raw) },
          })
          writeFileSync(historyFile, `${JSON.stringify(history.slice(-50), null, 2)}\n`)
        } catch (error) {
          log('cannot write transcript debug', error)
        }
      }
      bumpStats(applied, text, raw)
      updateProfileSuggestion(text)
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
        // Сколько тишины срезали: клиенты прибавляют это к своим меткам.
        audioTrimOffsetSeconds,
        // В режиме auto: понадобился ли Whisper (для диагностики скорости).
        autoFallback,
        autoWhisperTried,
        autoWhisperFailed,
        // Если режим auto переключил словарь — клиент покажет уведомление.
        autoProfileSwitch: profileAutoSwitched,
      }
      recentTranscriptions.push({ at: lastTranscription.at, text, mode: engineMode, autoFallback })
      if (recentTranscriptions.length > 20) recentTranscriptions.shift()
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
    await stopWhisperServer()
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
        if (ctx.speechToText.snapshot?.()?.selection?.providerId === PROVIDER_ID) {
          warm()
          if (engineMode !== 'gigaam' && hasWhisper()) {
            void ensureWhisperServer().catch((error) => {
              log('whisper prewarm failed', error instanceof Error ? error.message : String(error))
            })
          }
        }
      } catch (error) {
        log('prewarm skipped', error instanceof Error ? error.message : String(error))
      }
    }, config.prewarmDelayMs ?? 5_000)
    const follow = (async () => {
      try {
        for await (const snapshot of ctx.speechToText.follow?.(controller.signal) ?? []) {
          if (snapshot?.selection?.providerId === PROVIDER_ID) {
            warm()
            if (engineMode !== 'gigaam' && hasWhisper()) {
              void ensureWhisperServer(controller.signal).catch((error) => {
                log('whisper prewarm failed', error instanceof Error ? error.message : String(error))
              })
            }
          }
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

  // Отладочный шов для офлайн-аудита слияния на реальных транскриптах.
  if (config.debugMerge === true) {
    globalThis.__dshLocaleRuMergePreview = (gigaamText, whisperText, dictionary = []) => ({
      sentences: mergeBySentences(gigaamText, whisperText, dictionary),
      words: mergeByWords(gigaamText, whisperText, dictionary),
      auto: mergeByAuto(gigaamText, whisperText, dictionary),
    })
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
        await stopWhisperServer()
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
