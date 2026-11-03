#!/usr/bin/env node
/**
 * Dictation quality harness: synthesizes a mixed Russian/English phrase with
 * macOS TTS, runs it through the real engines (GigaAM, Whisper, hybrid) and
 * compares the transcripts with the reference text.
 *
 * Usage:
 *   node tools/dictation-harness.mjs --text "Проверка связи. GitHub и OpenAI."
 *   node tools/dictation-harness.mjs --text-file phrase.txt --voice Milena
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}
const text = option('--text') ?? (option('--text-file') === undefined ? undefined : readFileSync(option('--text-file'), 'utf8'))
if (text === undefined) {
  console.error('нужен --text или --text-file')
  process.exit(2)
}
const voice = option('--voice', 'Milena')
const keep = args.includes('--keep')

const workspace = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
const aiff = join(workspace, 'phrase.aiff')
const wav = join(workspace, 'phrase.wav')
try {
  execFileSync('say', ['-v', voice, '-o', aiff, text], { stdio: 'ignore' })
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav], { stdio: 'ignore' })
} catch (error) {
  console.error('не удалось синтезировать речь (нужен macOS say/afconvert):', error instanceof Error ? error.message : error)
  process.exit(1)
}
const audio = readFileSync(wav)

/** Normalizes words for comparison. */
const words = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
/** Levenshtein over word arrays. */
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
const wer = (reference, hypothesis) => {
  const ref = words(reference)
  const hyp = words(hypothesis)
  return ref.length === 0 ? 0 : wordDistance(ref, hyp) / ref.length
}

const { internals } = await import('../lib/index.js')
const DSH_HOME = process.env.HOME + '/.dsh'
const common = {
  binaryPath: DSH_HOME + '/bin/gigastt',
  modelDir: process.env.HOME + '/.gigastt/models',
  hotwordsFile: DSH_HOME + '/speech-ru/hotwords.txt',
  replacementsFile: DSH_HOME + '/speech-ru/replacements.json',
  whisperBinaryPath: '/opt/homebrew/bin/whisper-cli',
  whisperModelPath: DSH_HOME + '/speech-ru/whisper/ggml-large-v3-turbo-q5_0.bin',
  prewarm: false,
  dictionaryPort: 0,
  hotwordsWatchMs: 10,
}
void internals

/** Runs one engine mode through the real provider. */
async function run(mode) {
  const service = { register(provider) { this.provider = provider; return async () => {} }, snapshot() { return { selection: { providerId: 'gigaam-local' } } }, async *follow() {} }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, { ...common, engine: mode })
  const started = Date.now()
  const result = await service.provider.transcribe({ audio }, AbortSignal.timeout(180_000))
  const elapsed = Date.now() - started
  for (const cleanup of cleanups.reverse()) await cleanup()
  return { text: result.text, elapsed }
}

const results = {}
for (const mode of ['gigaam', 'whisper', 'hybrid']) {
  results[mode] = await run(mode)
}
const report = {
  reference: text.trim(),
  voice,
  results: Object.fromEntries(Object.entries(results).map(([mode, value]) => [mode, {
    text: value.text,
    elapsedMs: value.elapsed,
    wer: Number(wer(text, value.text).toFixed(4)),
  }])),
}
writeFileSync(join(workspace, 'report.json'), JSON.stringify(report, null, 2))
console.log('эталон:', report.reference)
for (const [mode, value] of Object.entries(report.results)) {
  console.log(`${mode.padEnd(7)} WER ${(value.wer * 100).toFixed(1)}%  ${value.elapsedMs} мс  ${value.text}`)
}
console.log('отчёт:', join(workspace, 'report.json'))
if (!keep) rmSync(workspace, { recursive: true, force: true })
else console.log('сохранено:', workspace)
