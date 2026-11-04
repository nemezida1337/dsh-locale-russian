#!/usr/bin/env node
/**
 * Tests the engine modes of the speech provider: GigaAM only, Whisper only, and
 * the hybrid merge that prefers the transcript covering more dictionary terms.
 *
 * Usage:
 *   node tools/test-engine-modes.mjs
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const here = import.meta.dirname
const workspace = mkdtempSync(join(tmpdir(), 'dsh-engine-modes-'))
const wav = readFileSync(join(here, '..', 'test', 'fixtures', 'ru-sample.wav'))
const fakeGigastt = join(workspace, 'fake-gigastt.mjs')
const fakeWhisper = join(workspace, 'fake-whisper.mjs')
copyFileSync(join(here, '..', 'test', 'fixtures', 'fake-gigastt.mjs'), fakeGigastt)
copyFileSync(join(here, '..', 'test', 'fixtures', 'fake-whisper-cli.mjs'), fakeWhisper)
const fakeWhisperServer = join(workspace, 'fake-whisper-server.mjs')
copyFileSync(join(here, '..', 'test', 'fixtures', 'fake-whisper-server.mjs'), fakeWhisperServer)
chmodSync(fakeWhisperServer, 0o755)
chmodSync(fakeGigastt, 0o755)
chmodSync(fakeWhisper, 0o755)
const modelDir = join(workspace, 'models')
mkdirSync(modelDir, { recursive: true })
/** Builds a 16 kHz mono 16-bit WAV with silence-tone-silence. */
function makeWav({ silenceSeconds = 1, toneSeconds = 0.5, sampleRate = 16000, amplitude = 8000 } = {}) {
  const samples = []
  for (let index = 0; index < Math.round(silenceSeconds * sampleRate); index += 1) samples.push(0)
  for (let index = 0; index < Math.round(toneSeconds * sampleRate); index += 1) samples.push(Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * amplitude))
  for (let index = 0; index < Math.round(silenceSeconds * sampleRate); index += 1) samples.push(0)
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((value, index) => data.writeInt16LE(Math.max(-32768, Math.min(32767, value)), index * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const whisperModel = join(workspace, 'whisper-model.bin')
writeFileSync(whisperModel, 'x')

const { apply, internals } = await import('../lib/index.js')
for (const name of internals.modelFiles) writeFileSync(join(modelDir, name), 'x')

/** Applies the provider with the given engine mode and dictionary. */
function setup({ engine, words = ['GitHub'], replacements = {}, whisper = true, whisperServer = false, merge, port = 0 }) {
  const hotwordsFile = join(workspace, `hotwords-${engine}.txt`)
  const header = '# Hotwords\n'
  const section = words.length === 0
    ? ''
    : `\n# === личный словарь (dsh-locale-russian) ===\n${words.join('\n')}\n# === /личный словарь ===\n`
  writeFileSync(hotwordsFile, `${header}${section}`)
  const replacementsFile = join(workspace, `replacements-${engine}.json`)
  writeFileSync(replacementsFile, JSON.stringify({ replacements }))
  const service = {
    register(provider) { this.provider = provider; return async () => {} },
    snapshot() { return { selection: { providerId: 'gigaam-local' } } },
    async *follow() {},
  }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: fakeGigastt,
    modelDir,
    hotwordsFile,
    replacementsFile,
    engine,
    ...(merge === undefined ? {} : { merge }),
    whisperBinaryPath: whisper ? fakeWhisper : join(workspace, 'нет-бинаря'),
    whisperModelPath: whisperModel,
    // По умолчанию тёплый сервер выключен пустой строкой: быстро и без сети.
    whisperServerPath: whisperServer ? fakeWhisperServer : '',
    prewarm: false,
    dictionaryPort: port,
    hotwordsWatchMs: 10,
  })
  return { service, cleanups, hotwordsFile }
}

console.log('режим whisper')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const { service, cleanups } = setup({ engine: 'whisper' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('текст от Whisper', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: термины берём у Whisper')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const { service, cleanups } = setup({ engine: 'hybrid' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('выбран текст с термином', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('whisper получает словарный prompt')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const argsFile = join(workspace, 'whisper-args.log')
  process.env.FAKE_WHISPER_ARGS = argsFile
  const { service, cleanups } = setup({ engine: 'whisper', words: ['GitHub', 'OpenAI'] })
  await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const args = JSON.parse(readFileSync(argsFile, 'utf8').trim().split('\n')[0])
  check('есть --prompt', args.includes('--prompt'), JSON.stringify(args))
  const promptIndex = args.indexOf('--prompt')
  check('prompt содержит термины', promptIndex >= 0 && String(args[promptIndex + 1]).includes('GitHub') && String(args[promptIndex + 1]).includes('OpenAI'), args[promptIndex + 1])
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_WHISPER_ARGS
}

console.log('гибрид: по умолчанию — русское от GigaAM, термин от Whisper')
{
  process.env.FAKE_TRANSCRIPT = 'Сегодня хорошая погода. Я открыл Гитхаб.'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Сегодня хорошая погода. Я открыл GitHub.'
  const { service, cleanups } = setup({ engine: 'hybrid', words: ['GitHub'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('русское предложение от GigaAM, термин от Whisper', result.text === 'Сегодня хорошая погода. Я открыл GitHub.', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: умный выбор целого текста')
{
  process.env.FAKE_TRANSCRIPT = 'Привет. Сегодня обсудили gighab OpenAINSOIC и Worktrees. Deeplay прошёл.'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Привет, сегодня обсудили GitHub, OpenAI, Slack и Worktrees. Деплой прошел.'
  const { service, cleanups } = setup({ engine: 'hybrid', words: ['GitHub', 'OpenAI', 'Slack', 'Worktrees'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('искажённая латиница GigaAM проигрывает Whisper', result.text.startsWith('Привет, сегодня обсудили GitHub'), result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: пословное слияние')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка связи. Гитхап Пир Фордж Лайфер.'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи. GitHub, Peer, Forge, LiveShare.'
  const { service, cleanups } = setup({ engine: 'hybrid', merge: 'words', words: ['GitHub', 'Peer', 'Forge', 'LiveShare'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('термины из Whisper, русское от GigaAM', result.text === 'Проверка связи. GitHub, Peer, Forge, LiveShare.', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: защита от дублей при пословном слиянии')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка gighab OpenAINSOIC и Worktrees'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub, OpenAI и Worktrees'
  const { service, cleanups } = setup({ engine: 'hybrid', merge: 'words', words: ['GitHub', 'OpenAI', 'Worktrees'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const duplicated = (result.text.match(/GitHub/gu) ?? []).length + (result.text.match(/gighab/gu) ?? []).length
  check('нет дублей терминов', duplicated === 1, result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: числа остаются у GigaAM')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка связи 1, 2, 3.'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи, 123.'
  const { service, cleanups } = setup({ engine: 'hybrid', merge: 'words' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('числа GigaAM сохранены', result.text === 'Проверка связи 1, 2, 3.', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: термин, пропущенный GigaAM')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка связи.'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи GitHub'
  const { service, cleanups } = setup({ engine: 'hybrid', merge: 'words' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('термин добавлен из Whisper', result.text.includes('GitHub'), result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: русский текст остаётся у GigaAM')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка GitHub и связи'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи'
  const { service, cleanups } = setup({ engine: 'hybrid' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('выбран GigaAM', result.text === 'Проверка GitHub и связи', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('гибрид: замены применяются после слияния')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи'
  const { service, cleanups } = setup({ engine: 'hybrid', words: [], replacements: { 'гитхаб': 'GitHub' } })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('замена сработала', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('режим text и диагностика')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const { service, cleanups } = setup({ engine: 'hybrid', words: ['GitHub'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('в режиме text выбран лучший текст', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('диагностика сохраняет оба текста')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const hotwordsFile = join(workspace, 'debug-hotwords.txt')
  writeFileSync(hotwordsFile, '# Hotwords\nGitHub\n')
  const { service, cleanups } = setup({ engine: 'hybrid', words: ['GitHub'] })
  // Включаем диагностику через отдельный apply с тем же файлом словаря.
  const serviceDebug = {
    register(provider) { this.provider = provider; return async () => {} },
    snapshot() { return { selection: { providerId: 'gigaam-local' } } },
    async *follow() {},
  }
  const debugCleanups = []
  const scoped = { speechToText: serviceDebug, effect(cb) { const d = cb(); debugCleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); debugCleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: fakeGigastt,
    modelDir,
    hotwordsFile,
    replacementsFile: join(workspace, 'debug-replacements.json'),
    engine: 'hybrid',
    whisperBinaryPath: fakeWhisper,
    whisperModelPath: whisperModel,
    prewarm: false,
    dictionaryPort: 0,
    hotwordsWatchMs: 10,
    debugTranscripts: true,
  })
  await serviceDebug.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const debug = JSON.parse(readFileSync(join(workspace, 'transcripts.json'), 'utf8'))
  check('диагностика: оба текста и слияние', Array.isArray(debug) && debug[0].gigaam === 'Проверка гитхаб' && debug[0].whisper === 'Проверка GitHub' && debug[0].merged === 'Проверка GitHub', JSON.stringify(debug))
  await serviceDebug.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const history = JSON.parse(readFileSync(join(workspace, 'transcripts.json'), 'utf8'))
  check('история накапливается', history.length === 2, String(history.length))
  for (const cleanup of debugCleanups.reverse()) await cleanup()
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('last-transcription отдаёт применённые замены')
{
  const freePort = await new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
  })
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб'
  const { service, cleanups } = setup({ engine: 'gigaam', replacements: { 'гитхаб': 'GitHub' }, port: freePort })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('замена применилась', result.text === 'Проверка GitHub', result.text)
  const info = await fetch(`http://127.0.0.1:${freePort}/last-transcription`).then((response) => response.json())
  check('endpoint вернул применённые замены', Array.isArray(info?.applied) && info.applied.some((pair) => pair.heard === 'гитхаб' && pair.chosen === 'GitHub'), JSON.stringify(info))
  // Тайминги слов для Chronoflow: start/end — секунды от начала аудио.
  check('слова с таймингами в endpoint', Array.isArray(info?.words) && info.words.length === 2
    && info.words.every((word) => typeof word.word === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end)), JSON.stringify(info?.words))
  check('слова совпадают с gigaamText', Array.isArray(info?.words) && info.words.map((word) => word.word).join(' ') === info.gigaamText, JSON.stringify({ words: info?.words, gigaamText: info?.gigaamText }))
  check('длительность аудио в endpoint', info?.audioDurationSeconds === 1, String(info?.audioDurationSeconds))
  check('старые поля не изменились', typeof info?.at === 'number' && info.raw === 'Проверка гитхаб' && info.text === 'Проверка GitHub' && info.mode === 'gigaam', JSON.stringify({ at: info?.at, raw: info?.raw, text: info?.text, mode: info?.mode }))
  check('слова в результате провайдера', Array.isArray(result.words) && result.words.length === 2, JSON.stringify(result.words))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
}

console.log('last-transcription: whisper и hybrid')
{
  const freePort = () => new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
  })
  // whisper: словарей нет, words пустой, gigaamText отсутствует.
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи'
  const whisperPort = await freePort()
  const whisperRun = setup({ engine: 'whisper', port: whisperPort })
  const whisperResult = await whisperRun.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const whisperInfo = await fetch(`http://127.0.0.1:${whisperPort}/last-transcription`).then((response) => response.json())
  check('whisper: words пустой', Array.isArray(whisperInfo?.words) && whisperInfo.words.length === 0, JSON.stringify(whisperInfo?.words))
  check('whisper: gigaamText отсутствует', whisperInfo?.gigaamText === undefined, String(whisperInfo?.gigaamText))
  check('whisper: mode сохранён', whisperInfo?.mode === 'whisper' && whisperResult.text === 'Проверка связи', JSON.stringify({ mode: whisperInfo?.mode, text: whisperResult.text }))
  for (const cleanup of whisperRun.cleanups.reverse()) await cleanup()

  // hybrid: тайминги от GigaAM-ветки, итоговый текст может отличаться.
  process.env.FAKE_TRANSCRIPT = 'Проверка гигаам'
  const hybridPort = await freePort()
  const hybridRun = setup({ engine: 'hybrid', port: hybridPort })
  const hybridResult = await hybridRun.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const hybridInfo = await fetch(`http://127.0.0.1:${hybridPort}/last-transcription`).then((response) => response.json())
  check('hybrid: слова от GigaAM', Array.isArray(hybridInfo?.words) && hybridInfo.words.length === 2 && hybridInfo.gigaamText === 'Проверка гигаам', JSON.stringify({ words: hybridInfo?.words, gigaamText: hybridInfo?.gigaamText }))
  check('hybrid: mode сохранён', hybridInfo?.mode === 'hybrid', String(hybridInfo?.mode))
  check('hybrid: текст получен', typeof hybridResult.text === 'string' && hybridResult.text.length > 0, hybridResult.text)
  for (const cleanup of hybridRun.cleanups.reverse()) await cleanup()

  // Невалидные слова отбрасываются, а start == end сохраняется.
  process.env.FAKE_TRANSCRIPT = 'Привет'
  process.env.FAKE_WORDS_JSON = JSON.stringify([
    { word: 'Привет', start: 0.1, end: 0.1, confidence: 0.5 },
    { word: '', start: 0.2, end: 0.3 },
    { word: 'мусор', start: 'нет', end: 1 },
  ])
  const wordsPort = await freePort()
  const wordsRun = setup({ engine: 'gigaam', port: wordsPort })
  await wordsRun.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const wordsInfo = await fetch(`http://127.0.0.1:${wordsPort}/last-transcription`).then((response) => response.json())
  check('невалидные слова отброшены', Array.isArray(wordsInfo?.words) && wordsInfo.words.length === 1 && wordsInfo.words[0].start === 0.1 && wordsInfo.words[0].end === 0.1, JSON.stringify(wordsInfo?.words))
  for (const cleanup of wordsRun.cleanups.reverse()) await cleanup()

  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WORDS_JSON
}

console.log('VAD: тишина обрезается, слова сдвигаются')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка'
  process.env.FAKE_WORDS_JSON = JSON.stringify([{ word: 'Проверка', start: 0.1, end: 0.4, confidence: 0.9 }])
  process.env.FAKE_AUDIO_DURATION = '0.5'
  const audioFile = join(workspace, 'trimmed.wav')
  process.env.FAKE_AUDIO_OUT = audioFile
  const silenceWav = makeWav({ silenceSeconds: 1, toneSeconds: 0.5 })
  const port = await new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
  })
  const { service, cleanups } = setup({ engine: 'gigaam', port })
  await service.provider.transcribe({ audio: silenceWav }, AbortSignal.timeout(30_000))
  const received = readFileSync(audioFile)
  check('тишина обрезана', received.length < silenceWav.length, `${received.length} vs ${silenceWav.length}`)
  const info = await fetch(`http://127.0.0.1:${port}/last-transcription`).then((response) => response.json())
  check('смещение обрезки записано', info.audioTrimOffsetSeconds > 0.5 && info.audioTrimOffsetSeconds < 1.2, String(info.audioTrimOffsetSeconds))
  check('слова сдвинуты на смещение', Array.isArray(info.words) && info.words[0].start > 0.5 && info.words[0].start < 1.3, JSON.stringify(info.words))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WORDS_JSON
  delete process.env.FAKE_AUDIO_DURATION
  delete process.env.FAKE_AUDIO_OUT
}

console.log('пунктуация и заглавные')
{
  process.env.FAKE_TRANSCRIPT = 'привет как дела? всё хорошо'
  const first = setup({ engine: 'gigaam' })
  const result = await first.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('заглавные и пунктуация', result.text === 'Привет как дела? Всё хорошо', result.text)
  for (const cleanup of first.cleanups.reverse()) await cleanup()
  process.env.FAKE_TRANSCRIPT = 'проверка 1 , 2 , 3'
  const second = setup({ engine: 'gigaam' })
  const numbers = await second.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('пробелы у чисел и запятых', numbers.text === 'Проверка 1, 2, 3', numbers.text)
  for (const cleanup of second.cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
}

console.log('prompt Whisper обновляется вместе со словарём')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const argsFile = join(workspace, 'whisper-args-cache.log')
  process.env.FAKE_WHISPER_ARGS = argsFile
  const { service, cleanups, hotwordsFile } = setup({ engine: 'whisper', words: ['GitHub'] })
  await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const before = readFileSync(hotwordsFile, 'utf8')
  writeFileSync(hotwordsFile, before.replace('# === /личный словарь ===', 'Kubernetes\n# === /личный словарь ==='))
  await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const lines = readFileSync(argsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  const promptOf = (args) => args[args.indexOf('--prompt') + 1] ?? ''
  check('prompt содержит словарь', promptOf(lines[0]).includes('GitHub'), promptOf(lines[0]))
  check('prompt обновился после нового слова', promptOf(lines[1]).includes('Kubernetes'), promptOf(lines[1]))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_WHISPER_ARGS
}

console.log('подсказка динамического словаря по контексту')
{
  process.env.FAKE_TRANSCRIPT = 'Kubernetes и Podman'
  const port = await new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
  })
  const { service, cleanups } = setup({ engine: 'gigaam', port })
  const api = (path, options = {}) => fetch(`http://127.0.0.1:${port}${path}`, options)
  await api('/hotwords', { method: 'POST', body: 'Kubernetes' })
  await api('/hotwords', { method: 'POST', body: 'Podman' })
  await api('/profiles/create', { method: 'POST', body: JSON.stringify({ name: 'Проект' }) })
  const afterCreate = await api('/profiles').then((response) => response.json())
  const projectId = afterCreate.active
  const defaultId = afterCreate.profiles.find((profile) => profile.id !== projectId)?.id
  await api('/profiles/switch', { method: 'POST', body: JSON.stringify({ id: defaultId }) })
  await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const after = await api('/profiles').then((response) => response.json())
  check('подсказка указывает на словарь проекта', after.suggestion?.id === projectId && after.suggestion?.hits >= 2, JSON.stringify({ suggestion: after.suggestion, projectId }))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
}

const freePort = () => new Promise((resolve) => {
  const probe = createServer()
  probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
})

console.log('auto: быстрый путь без Whisper')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка связи'
  const argsFile = join(workspace, 'auto-fast-whisper-args.log')
  process.env.FAKE_WHISPER_ARGS = argsFile
  const port = await freePort()
  const { service, cleanups } = setup({ engine: 'auto', port })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: русский текст без Whisper', result.text === 'Проверка связи', result.text)
  check('auto: Whisper не вызывался', !existsSync(argsFile), existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : 'нет файла')
  const info = await fetch(`http://127.0.0.1:${port}/last-transcription`).then((response) => response.json())
  check('auto: fallback не срабатывал', info.autoFallback === false && info.mode === 'auto', JSON.stringify({ fallback: info.autoFallback, mode: info.mode }))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_ARGS
}

console.log('auto: Whisper подключается на английских терминах')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка gighab'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const argsFile = join(workspace, 'auto-fallback-whisper-args.log')
  process.env.FAKE_WHISPER_ARGS = argsFile
  const port = await freePort()
  const { service, cleanups } = setup({ engine: 'auto', port })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: термин исправлен Whisper', result.text === 'Проверка GitHub', result.text)
  check('auto: Whisper вызван', existsSync(argsFile) && readFileSync(argsFile, 'utf8').trim() !== '')
  const info = await fetch(`http://127.0.0.1:${port}/last-transcription`).then((response) => response.json())
  check('auto: fallback отмечен', info.autoFallback === true, JSON.stringify(info.autoFallback))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_WHISPER_ARGS
}

console.log('auto: короткая латиница не включает Whisper')
{
  process.env.FAKE_TRANSCRIPT = 'Приоритет P0 и OK'
  const argsFile = join(workspace, 'auto-short-latin-args.log')
  process.env.FAKE_WHISPER_ARGS = argsFile
  const { service, cleanups } = setup({ engine: 'auto' })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: P0/OK не тянут Whisper', result.text.includes('P0') && !existsSync(argsFile), result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_ARGS
}

console.log('тёплый whisper-server')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка через сервер'
  const marker = join(workspace, 'whisper-server-marker.log')
  process.env.FAKE_SERVER_MARKER = marker
  const { service, cleanups } = setup({ engine: 'whisper', whisperServer: true })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('тёплый сервер ответил', result.text === 'Проверка через сервер', result.text)
  check('запрос ушёл на сервер', existsSync(marker) && readFileSync(marker, 'utf8').trim() !== '')
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_MARKER
}

console.log('auto без Whisper работает как GigaAM')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка связи'
  const { service, cleanups } = setup({ engine: 'auto', whisper: false })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto без Whisper: текст есть', result.text === 'Проверка связи', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
}

console.log('auto: падение GigaAM перехватывается Whisper')
{
  process.env.FAKE_FAIL = '1'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const { service, cleanups } = setup({ engine: 'auto', words: ['GitHub'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: Whisper спас диктовку', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_FAIL
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('auto: разное число предложений — берём лучший текст')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка gighab'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub. Вторая фраза.'
  const { service, cleanups } = setup({ engine: 'auto', words: ['GitHub'] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: лучший целый текст при разном делении', result.text.startsWith('Проверка GitHub'), result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('тёплый сервер: prompt полем и single-flight')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const bodyFile = join(workspace, 'whisper-server-body.log')
  const pidFile = join(workspace, 'whisper-server-pid.log')
  process.env.FAKE_SERVER_BODY = bodyFile
  process.env.FAKE_SERVER_PID = pidFile
  process.env.FAKE_SERVER_DELAY = '400'
  const { service, cleanups } = setup({ engine: 'whisper', words: ['GitHub'], whisperServer: true })
  const [first, second] = await Promise.all([
    service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000)),
    service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000)),
  ])
  const body = readFileSync(bodyFile, 'utf8')
  check('prompt уходит полем запроса', body.includes('name="prompt"') && body.includes('GitHub'), body.slice(0, 120))
  check('single-flight: оба ответа', first.text === 'Проверка GitHub' && second.text === 'Проверка GitHub')
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_BODY
  delete process.env.FAKE_SERVER_PID
  delete process.env.FAKE_SERVER_DELAY
}

console.log('тёплый сервер: выгрузка во время старта не оставляет процесс')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка'
  const pidFile = join(workspace, 'whisper-server-pid-dispose.log')
  process.env.FAKE_SERVER_PID = pidFile
  process.env.FAKE_SERVER_DELAY = '1500'
  const { service, cleanups } = setup({ engine: 'whisper', whisperServer: true })
  const pending = service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000)).catch(() => undefined)
  const pidDeadline = Date.now() + 2000
  while (Date.now() < pidDeadline && !existsSync(pidFile)) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
  for (const cleanup of cleanups.reverse()) await cleanup()
  await pending
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1800))
  const pid = Number(readFileSync(pidFile, 'utf8'))
  let alive = true
  try {
    process.kill(pid, 0)
  } catch {
    alive = false
  }
  check('сервер не пережил выгрузку', alive === false, String(pid))
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_PID
  delete process.env.FAKE_SERVER_DELAY
}

console.log('/engine сохраняет остальные ключи конфига')
{
  const dshHome = mkdtempSync(join(tmpdir(), 'dsh-engine-config-'))
  const profileDir = join(dshHome, 'profiles', 'desktop')
  mkdirSync(profileDir, { recursive: true })
  const patchFile = join(profileDir, 'cordis.patch.yml')
  writeFileSync(patchFile, [
    '# мой комментарий про движок',
    '- id: locale-ru',
    '  config:',
    '    engine: hybrid',
    '    merge: sentences',
    '    debugTranscripts: true',
    '    whisperServerPath: /custom/whisper-server',
    '    whisperBinaryPath: /custom/whisper-cli',
    '    whisperModelPath: /custom/model.bin',
    '    hotwords:',
    '      - GitHub',
    '      - OpenAI',
    '',
  ].join('\n'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dshHome
  const port = await freePort()
  const { service, cleanups } = setup({ engine: 'hybrid', port })
  const response = await fetch(`http://127.0.0.1:${port}/engine`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engine: 'auto', merge: 'sentences' }),
  }).then((answer) => answer.json())
  const patch = readFileSync(patchFile, 'utf8')
  check('движок обновлён', response.ok === true && patch.includes('engine: auto'), JSON.stringify(response))
  check('debugTranscripts сохранён', patch.includes('debugTranscripts: true'), patch)
  check('whisperServerPath сохранён', patch.includes('whisperServerPath: /custom/whisper-server'), patch)
  check('whisperBinaryPath сохранён', patch.includes('whisperBinaryPath: /custom/whisper-cli'), patch)
  check('whisperModelPath сохранён', patch.includes('whisperModelPath: /custom/model.bin'), patch)
  check('комментарий не копится', (patch.match(/# Движок:/gu) ?? []).length === 1, patch)
  check('комментарий пользователя сохранён', patch.includes('# мой комментарий про движок'), patch)
  check('вложенный hotwords сохранён', patch.includes('    hotwords:') && patch.includes('      - GitHub'), patch)
  const second = await fetch(`http://127.0.0.1:${port}/engine`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engine: 'auto', merge: 'sentences' }),
  }).then((answer) => answer.json())
  const patchAfterSecond = readFileSync(patchFile, 'utf8')
  check('повторный POST идемпотентен', second.changed === false && patchAfterSecond === patch, JSON.stringify(second))
  for (const cleanup of cleanups.reverse()) await cleanup()
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  rmSync(dshHome, { recursive: true, force: true })
}

console.log('auto/hybrid: пустой или упавший GigaAM не теряет Whisper')
{
  process.env.FAKE_FAIL = '1'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка связи'
  const auto = setup({ engine: 'auto' })
  const autoResult = await auto.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: обычный Whisper-текст не теряется', autoResult.text === 'Проверка связи', autoResult.text)
  for (const cleanup of auto.cleanups.reverse()) await cleanup()
  const hybrid = setup({ engine: 'hybrid' })
  const hybridResult = await hybrid.service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('hybrid: обычный Whisper-текст не теряется', hybridResult.text === 'Проверка связи', hybridResult.text)
  for (const cleanup of hybrid.cleanups.reverse()) await cleanup()
  delete process.env.FAKE_FAIL
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('auto: битая латиница без словаря исправляется Whisper')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка gighab'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub. Вторая фраза.'
  const { service, cleanups } = setup({ engine: 'auto', words: [] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: gighab заменён на GitHub', result.text.startsWith('Проверка GitHub'), result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('whisper-server: ошибка запуска не роняет провайдер')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка через CLI'
  const broken = join(workspace, 'broken-whisper-server')
  writeFileSync(broken, '#!/bin/sh\nexit 0\n')
  chmodSync(broken, 0o644)
  const { service, cleanups } = setup({ engine: 'whisper', whisperServer: true })
  // Подменяем путь на неисполняемый файл.
  const port = 0
  const brokenService = {
    register(provider) { this.provider = provider; return async () => {} },
    snapshot() { return { selection: { providerId: 'gigaam-local' } } },
    async *follow() {},
  }
  const brokenCleanups = []
  const scoped = { speechToText: brokenService, effect(cb) { const d = cb(); brokenCleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); brokenCleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: fakeGigastt,
    modelDir,
    hotwordsFile: join(workspace, 'hotwords-whisper.txt'),
    replacementsFile: join(workspace, 'replacements-whisper.json'),
    engine: 'whisper',
    whisperBinaryPath: fakeWhisper,
    whisperModelPath: whisperModel,
    whisperServerPath: broken,
    prewarm: false,
    dictionaryPort: 0,
    hotwordsWatchMs: 10,
  })
  const result = await brokenService.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('откат на CLI после ошибки spawn', result.text === 'Проверка через CLI', result.text)
  for (const cleanup of brokenCleanups.reverse()) await cleanup()
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('abort во время старта whisper-server прерывает диктовку')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Не должно вернуться'
  process.env.FAKE_SERVER_DELAY = '1500'
  const { service, cleanups } = setup({ engine: 'whisper', whisperServer: true })
  const controller = new AbortController()
  const pending = service.provider.transcribe({ audio: wav }, controller.signal)
  setTimeout(() => controller.abort(), 300)
  let error
  try {
    await pending
  } catch (caught) {
    error = caught
  }
  check('abort прерывает диктовку', error !== undefined && error.name === 'AbortError', error === undefined ? 'resolve' : String(error.name))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_DELAY
}

console.log('single-flight: prewarm и диктовка делят один whisper-server')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка'
  const starts = join(workspace, 'server-starts.log')
  process.env.FAKE_SERVER_STARTS = starts
  process.env.FAKE_SERVER_DELAY = '300'
  const service = {
    register(provider) { this.provider = provider; return async () => {} },
    snapshot() { return { selection: { providerId: 'gigaam-local' } } },
    async *follow() {},
  }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: fakeGigastt,
    modelDir,
    hotwordsFile: join(workspace, 'hotwords-whisper.txt'),
    replacementsFile: join(workspace, 'replacements-whisper.json'),
    engine: 'whisper',
    whisperBinaryPath: fakeWhisper,
    whisperModelPath: whisperModel,
    whisperServerPath: fakeWhisperServer,
    prewarm: true,
    prewarmDelayMs: 0,
    dictionaryPort: 0,
    hotwordsWatchMs: 10,
  })
  const startsDeadline = Date.now() + 2000
  while (Date.now() < startsDeadline && !existsSync(starts)) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
  await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  const lines = readFileSync(starts, 'utf8').trim().split('\n').filter(Boolean)
  check('стартовал ровно один сервер', lines.length === 1, JSON.stringify(lines))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_STARTS
  delete process.env.FAKE_SERVER_DELAY
}

console.log('abort: hybrid и CLI отменяют диктовку')
{
  process.env.FAKE_TRANSCRIPT = 'Медленный GigaAM'
  process.env.FAKE_GIGAAM_DELAY = '3000'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Быстрый Whisper'
  const hybrid = setup({ engine: 'hybrid' })
  const hybridController = new AbortController()
  const hybridPending = hybrid.service.provider.transcribe({ audio: wav }, hybridController.signal)
  setTimeout(() => hybridController.abort(), 500)
  let hybridError
  try {
    await hybridPending
  } catch (caught) {
    hybridError = caught
  }
  check('hybrid abort → AbortError', hybridError?.name === 'AbortError', hybridError === undefined ? 'resolve' : String(hybridError.name))
  for (const cleanup of hybrid.cleanups.reverse()) await cleanup()
  process.env.FAKE_WHISPER_DELAY = '3000'
  delete process.env.FAKE_GIGAAM_DELAY
  const cli = setup({ engine: 'whisper' })
  const cliController = new AbortController()
  const cliPending = cli.service.provider.transcribe({ audio: wav }, cliController.signal)
  setTimeout(() => cliController.abort(), 200)
  let cliError
  try {
    await cliPending
  } catch (caught) {
    cliError = caught
  }
  check('CLI abort → AbortError', cliError?.name === 'AbortError', cliError === undefined ? 'resolve' : String(cliError.name))
  for (const cleanup of cli.cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_WHISPER_DELAY
}

console.log('auto: корректный GigaAM-текст не выбрасывается из-за OOV-латиницы')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка GitHub API'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка гитхаб апи'
  for (const merge of ['text', 'sentences']) {
    const { service, cleanups } = setup({ engine: 'auto', words: ['GitHub'], merge })
    const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
    check(`auto/${merge}: GitHub API сохранён`, result.text.includes('GitHub API'), result.text)
    for (const cleanup of cleanups.reverse()) await cleanup()
  }
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('auto: одно предложение с битой латиницей без словаря')
{
  process.env.FAKE_TRANSCRIPT = 'Проверка gighab'
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Проверка GitHub'
  const { service, cleanups } = setup({ engine: 'auto', words: [] })
  const result = await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('auto: gighab→GitHub в одном предложении', result.text === 'Проверка GitHub', result.text)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_TRANSCRIPT
  delete process.env.FAKE_WHISPER_TRANSCRIPT
}

console.log('abort: ожидание чужого старта whisper-server прерывается')
{
  process.env.FAKE_WHISPER_TRANSCRIPT = 'Не должно вернуться'
  process.env.FAKE_SERVER_DELAY = '1500'
  const starts = join(workspace, 'abort-prewarm-starts.log')
  process.env.FAKE_SERVER_STARTS = starts
  const service = {
    register(provider) { this.provider = provider; return async () => {} },
    snapshot() { return { selection: { providerId: 'gigaam-local' } } },
    async *follow() {},
  }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: fakeGigastt,
    modelDir,
    hotwordsFile: join(workspace, 'hotwords-whisper.txt'),
    replacementsFile: join(workspace, 'replacements-whisper.json'),
    engine: 'whisper',
    whisperBinaryPath: fakeWhisper,
    whisperModelPath: whisperModel,
    whisperServerPath: fakeWhisperServer,
    prewarm: true,
    prewarmDelayMs: 0,
    dictionaryPort: 0,
    hotwordsWatchMs: 10,
  })
  // Ждём, пока prewarm реально начнёт старт сервера.
  const deadline = Date.now() + 2000
  while (Date.now() < deadline && !existsSync(starts)) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
  const controller = new AbortController()
  const startedAt = Date.now()
  const pending = service.provider.transcribe({ audio: wav }, controller.signal)
  setTimeout(() => controller.abort(), 100)
  let error
  try {
    await pending
  } catch (caught) {
    error = caught
  }
  const elapsed = Date.now() - startedAt
  check('abort ожидания быстрый и AbortError', error?.name === 'AbortError' && elapsed < 900, `${error === undefined ? 'resolve' : error.name} за ${elapsed} мс`)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.FAKE_WHISPER_TRANSCRIPT
  delete process.env.FAKE_SERVER_DELAY
  delete process.env.FAKE_SERVER_STARTS
}

console.log('whisper не установлен — понятная ошибка')
{
  const { service, cleanups } = setup({ engine: 'whisper', whisper: false })
  let error
  try {
    await service.provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  } catch (caught) {
    error = caught
  }
  check('ошибка про установку Whisper', error instanceof Error && error.message.includes('Whisper не установлен'), error?.message)
  for (const cleanup of cleanups.reverse()) await cleanup()
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки режимов движка пройдены')
