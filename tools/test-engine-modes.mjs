#!/usr/bin/env node
/**
 * Tests the engine modes of the speech provider: GigaAM only, Whisper only, and
 * the hybrid merge that prefers the transcript covering more dictionary terms.
 *
 * Usage:
 *   node tools/test-engine-modes.mjs
 */
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
chmodSync(fakeGigastt, 0o755)
chmodSync(fakeWhisper, 0o755)
const modelDir = join(workspace, 'models')
mkdirSync(modelDir, { recursive: true })
const whisperModel = join(workspace, 'whisper-model.bin')
writeFileSync(whisperModel, 'x')

const { apply, internals } = await import('../lib/index.js')
for (const name of internals.modelFiles) writeFileSync(join(modelDir, name), 'x')

/** Applies the provider with the given engine mode and dictionary. */
function setup({ engine, words = ['GitHub'], replacements = {}, whisper = true, merge }) {
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
    prewarm: false,
    dictionaryPort: 0,
    hotwordsWatchMs: 10,
  })
  return { service, cleanups }
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
