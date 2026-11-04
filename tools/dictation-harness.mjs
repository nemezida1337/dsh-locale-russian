#!/usr/bin/env node
/**
 * Dictation quality harness: synthesizes phrases with macOS TTS, runs them
 * through the real engines and strategies, and reports WER, term accuracy and
 * latency. Used to tune the hybrid merge with numbers instead of guesses.
 *
 * Usage:
 *   node tools/dictation-harness.mjs --text "Проверка GitHub и OpenAI"
 *   node tools/dictation-harness.mjs --corpus test/corpus/dictation.json
 *   node tools/dictation-harness.mjs --corpus test/corpus/dictation.json --json report.json
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { apply } from '../lib/index.js'
import { readPersonalHotwords } from '../lib/hotwords.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}
const corpusPath = option('--corpus')
const textArg = option('--text')
const voice = option('--voice', 'Milena')
const jsonPath = option('--json')
const limit = Number(option('--limit', '0')) || 0

const phrases = corpusPath !== undefined
  ? JSON.parse(readFileSync(corpusPath, 'utf8')).phrases
  : [{ id: 'single', text: textArg ?? '' }]
if (phrases.length === 0 || (corpusPath === undefined && textArg === undefined)) {
  console.error('нужен --text или --corpus')
  process.exit(2)
}
const selected = limit > 0 ? phrases.slice(0, limit) : phrases

const workspace = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
const DSH_HOME = process.env.HOME + '/.dsh'
const dictionary = readPersonalHotwords(readFileSync(DSH_HOME + '/speech-ru/hotwords.txt', 'utf8'))
  .filter((term) => term.length >= 2)

/** Normalizes words for comparison. */
const words = (value) => String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
/** Levenshtein with traceback: substitutions, insertions, deletions. */
function align(left, right) {
  const rows = left.length + 1
  const columns = right.length + 1
  const table = Array.from({ length: rows }, () => new Array(columns).fill(0))
  for (let row = 0; row < rows; row += 1) table[row][0] = row
  for (let column = 0; column < columns; column += 1) table[0][column] = column
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      table[row][column] = Math.min(table[row - 1][column] + 1, table[row][column - 1] + 1, table[row - 1][column - 1] + cost)
    }
  }
  let row = left.length
  let column = right.length
  let substitutions = 0
  let insertions = 0
  let deletions = 0
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && left[row - 1] === right[column - 1]) {
      row -= 1
      column -= 1
    } else if (row > 0 && column > 0 && table[row][column] === table[row - 1][column - 1] + 1) {
      substitutions += 1
      row -= 1
      column -= 1
    } else if (row > 0 && table[row][column] === table[row - 1][column] + 1) {
      deletions += 1
      row -= 1
    } else {
      insertions += 1
      column -= 1
    }
  }
  return { substitutions, insertions, deletions, errors: substitutions + insertions + deletions }
}
const wer = (reference, hypothesis) => {
  const ref = words(reference)
  return ref.length === 0 ? 0 : align(ref, words(hypothesis)).errors / ref.length
}
/** Fraction of dictionary terms present in the transcript in the correct form. */
const termAccuracy = (reference, hypothesis) => {
  const haystack = ` ${words(hypothesis).join(' ')} `
  const terms = dictionary.filter((term) => reference.toLowerCase().includes(term.toLowerCase()))
  if (terms.length === 0) return 1
  let found = 0
  for (const term of terms) if (haystack.includes(` ${words(term).join(' ')} `)) found += 1
  return found / terms.length
}

const common = {
  binaryPath: DSH_HOME + '/bin/gigastt',
  modelDir: process.env.HOME + '/.gigastt/models',
  hotwordsFile: DSH_HOME + '/speech-ru/hotwords.txt',
  replacementsFile: DSH_HOME + '/speech-ru/replacements.json',
  whisperBinaryPath: '/opt/homebrew/bin/whisper-cli',
  whisperModelPath: DSH_HOME + '/speech-ru/whisper/ggml-large-v3-turbo-q5_0.bin',
  // Для чистоты замера — CLI без тёплого сервера.
  whisperServerPath: '',
  prewarm: false,
  dictionaryPort: 0,
  hotwordsWatchMs: 10,
}

/** Runs one engine/merge strategy through the real provider. */
async function run(audio, mode, merge) {
  const service = { register(provider) { this.provider = provider; return async () => {} }, snapshot() { return { selection: { providerId: 'gigaam-local' } } }, async *follow() {} }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, { ...common, engine: mode, ...(merge === undefined ? {} : { merge }) })
  const started = Date.now()
  const result = await service.provider.transcribe({ audio }, AbortSignal.timeout(180_000))
  const elapsed = Date.now() - started
  for (const cleanup of cleanups.reverse()) await cleanup()
  return { text: result.text, elapsed }
}

const strategies = [
  { id: 'auto', mode: 'auto' },
  { id: 'gigaam', mode: 'gigaam' },
  { id: 'whisper', mode: 'whisper' },
  { id: 'hybrid-text', mode: 'hybrid', merge: 'text' },
  { id: 'hybrid-auto', mode: 'hybrid' },
  { id: 'hybrid-sentences', mode: 'hybrid', merge: 'sentences' },
  { id: 'hybrid-words', mode: 'hybrid', merge: 'words' },
]

const report = { voice, at: new Date().toISOString(), phrases: [] }
for (const phrase of selected) {
  const aiff = join(workspace, `${phrase.id}.aiff`)
  const wav = join(workspace, `${phrase.id}.wav`)
  try {
    execFileSync('say', ['-v', voice, '-o', aiff, phrase.text], { stdio: 'ignore' })
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav], { stdio: 'ignore' })
  } catch (error) {
    console.error(`не удалось синтезировать «${phrase.id}»:`, error instanceof Error ? error.message : error)
    continue
  }
  const audio = readFileSync(wav)
  const entry = { id: phrase.id, reference: phrase.text, results: {} }
  for (const strategy of strategies) {
    const result = await run(audio, strategy.mode, strategy.merge)
    entry.results[strategy.id] = {
      text: result.text,
      elapsedMs: result.elapsed,
      wer: Number(wer(phrase.text, result.text).toFixed(4)),
      terms: Number(termAccuracy(phrase.text, result.text).toFixed(4)),
    }
  }
  report.phrases.push(entry)
  console.log(`\n[${phrase.id}] ${phrase.text}`)
  for (const strategy of strategies) {
    const value = entry.results[strategy.id]
    console.log(`  ${strategy.id.padEnd(16)} WER ${(value.wer * 100).toFixed(1).padStart(5)}%  термины ${(value.terms * 100).toFixed(0).padStart(3)}%  ${String(value.elapsedMs).padStart(5)} мс  ${value.text}`)
  }
}

// Агрегат по стратегиям.
report.summary = {}
for (const strategy of strategies) {
  const values = report.phrases.map((entry) => entry.results[strategy.id]).filter(Boolean)
  report.summary[strategy.id] = {
    meanWer: Number((values.reduce((sum, value) => sum + value.wer, 0) / values.length).toFixed(4)),
    meanTerms: Number((values.reduce((sum, value) => sum + value.terms, 0) / values.length).toFixed(4)),
    meanElapsedMs: Math.round(values.reduce((sum, value) => sum + value.elapsedMs, 0) / values.length),
  }
}
console.log('\n=== Средние по корпусу ===')
for (const strategy of strategies) {
  const summary = report.summary[strategy.id]
  console.log(`${strategy.id.padEnd(16)} WER ${(summary.meanWer * 100).toFixed(1).padStart(5)}%  термины ${(summary.meanTerms * 100).toFixed(0).padStart(3)}%  ${summary.meanElapsedMs} мс`)
}
if (jsonPath !== undefined) {
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  console.log(`отчёт: ${jsonPath}`)
}
rmSync(workspace, { recursive: true, force: true })
