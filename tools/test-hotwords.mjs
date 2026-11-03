#!/usr/bin/env node
/**
 * Tests the personal hotwords dictionary: the shared module, the installer CLI
 * commands, and the host endpoint the interface uses.
 *
 * Usage:
 *   node tools/test-hotwords.mjs
 */
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  MAX_PERSONAL_HOTWORDS,
  addPersonalHotword,
  clearPersonalHotwords,
  readPersonalHotwords,
  removePersonalHotword,
} from '../lib/hotwords.mjs'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const workspace = mkdtempSync(join(tmpdir(), 'dsh-hotwords-test-'))
const base = '# Hotwords\nDeepSeek Harness\n'

console.log('модуль словаря')
{
  const added = addPersonalHotword(base, '  configHotwords  ')
  check('фраза добавляется и нормализуется', added.ok && added.count === 1 && added.text.includes('configHotwords'))
  check('секция помечена', added.text.includes('# === личный словарь') && added.text.includes('# === /личный словарь'))
  const duplicate = addPersonalHotword(added.text, 'configHotwords')
  check('дубликат не добавляется', duplicate.ok && duplicate.duplicate === true && duplicate.count === 1)
  check('чтение списка', readPersonalHotwords(added.text).join(',') === 'configHotwords')
  const removed = removePersonalHotword(added.text, 'configHotwords')
  check('удаление', removed.ok && removed.count === 0 && readPersonalHotwords(removed.text).length === 0)
  check('удаление отсутствующего', removePersonalHotword(added.text, 'нет').ok === false)
  const cleared = clearPersonalHotwords(added.text)
  check('очистка убирает секцию', !cleared.text.includes('# === личный словарь'))
  check('базовая часть сохраняется', cleared.text.includes('DeepSeek Harness'))
  check('пустая фраза отклоняется', addPersonalHotword(base, '   ').ok === false)
  check('слишком длинная отклоняется', addPersonalHotword(base, 'x'.repeat(80)).ok === false)
  check('лимит словаря', MAX_PERSONAL_HOTWORDS === 400)
}

console.log('CLI словаря')
{
  const file = join(workspace, 'cli-hotwords.txt')
  writeFileSync(file, base)
  const cli = (...args) => spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--hotwords-file', file, ...args], { encoding: 'utf8' })
  const add = cli('--hotwords-add', 'configHotwords, GigaAM; dsh-locale-russian')
  check('добавление списка', add.status === 0 && add.stdout.includes('добавлено: 3'), add.stderr)
  const list = cli('--hotwords-list')
  check('список', list.status === 0 && list.stdout.includes('configHotwords') && list.stdout.includes('GigaAM'), list.stdout)
  const bulkFile = join(workspace, 'bulk.txt')
  writeFileSync(bulkFile, 'configHotwords\nnewTerm\n')
  const bulk = cli('--hotwords-add-file', bulkFile)
  check('добавление из файла с пропуском дублей', bulk.status === 0 && bulk.stdout.includes('добавлено: 1') && bulk.stdout.includes('пропущено: 1'), bulk.stdout)
  const removed = cli('--hotwords-remove', 'GigaAM')
  check('удаление из CLI', removed.status === 0 && !readFileSync(file, 'utf8').includes('\nGigaAM\n'), removed.stdout)
  const cleared = cli('--hotwords-clear')
  check('очистка из CLI', cleared.status === 0 && readPersonalHotwords(readFileSync(file, 'utf8')).length === 0)
  const missing = cli('--hotwords-add-file', join(workspace, 'нет.txt'))
  check('отсутствующий файл — ошибка', missing.status !== 0)
}

console.log('endpoint хоста')
{
  const { apply } = await import('../lib/index.js')
  const file = join(workspace, 'endpoint-hotwords.txt')
  writeFileSync(file, base)
  const port = await new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
  })
  const service = { register() { return async () => {} }, snapshot() { return { selection: { providerId: 'gigaam-local' } } }, async *follow() {} }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: join(workspace, 'no-engine'),
    modelDir: join(workspace, 'models'),
    hotwordsFile: file,
    replacementsFile: join(workspace, 'endpoint-replacements.json'),
    dictionaryPort: port,
  })
  await new Promise((resolve) => setTimeout(resolve, 250))
  const post = (body) => fetch(`http://127.0.0.1:${port}/hotwords`, { method: 'POST', body }).then((response) => response.json())
  check('health отвечает', await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok))
  const first = await post('configHotwords')
  check('фраза добавлена через endpoint', first.ok === true && first.count === 1, JSON.stringify(first))
  check('файл обновлён', readFileSync(file, 'utf8').includes('configHotwords'))
  const again = await post('configHotwords')
  check('дубликат через endpoint', again.ok === true && again.duplicate === true)
  const bad = await post('   ')
  check('пустая фраза через endpoint отклоняется', bad.ok === false && bad.reason === 'bad-phrase')
  const jsonAdd = await fetch(`http://127.0.0.1:${port}/hotwords`, { method: 'POST', body: JSON.stringify('GigaAM') }).then((response) => response.json())
  check('JSON-строка на /hotwords', jsonAdd.ok === true, JSON.stringify(jsonAdd))
  const dictionary = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('словарь отдаёт слова', Array.isArray(dictionary.words) && dictionary.words.includes('GigaAM'), JSON.stringify(dictionary.words))
  check('словарь отдаёт замены', dictionary.replacements !== undefined && typeof dictionary.replacements === 'object')
  const learned = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ heard: 'гитхаб', chosen: 'GitHub' }),
  }).then((response) => response.json())
  check('обучение пары', learned.ok === true && learned.replacements === 1, JSON.stringify(learned))
  check('выбранное слово в словаре', readFileSync(file, 'utf8').includes('GitHub'))
  const replacementsFile = join(workspace, 'endpoint-replacements.json')
  check('пара записана в файл замен', readFileSync(replacementsFile, 'utf8').includes('"гитхаб": "GitHub"'), readFileSync(replacementsFile, 'utf8'))
  const learnedAgain = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ heard: 'гитхаб', chosen: 'GitHub' }),
  }).then((response) => response.json())
  check('повторное обучение не дублирует', learnedAgain.ok === true && learnedAgain.replacements === 1)
  const learnedBad = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  check('битый JSON отклоняется', learnedBad.status === 400)
  for (const cleanup of cleanups.reverse()) await cleanup()
  check('endpoint закрывается при выгрузке', await fetch(`http://127.0.0.1:${port}/health`).then(() => false, () => true))
}

console.log('движок читает словарь файлом и перезапускается при изменении')
{
  const { apply, internals } = await import('../lib/index.js')
  const dir = join(workspace, 'engine-case')
  mkdirSync(dir, { recursive: true })
  const argsFile = join(dir, 'args.log')
  const modelDir = join(dir, 'models')
  mkdirSync(modelDir, { recursive: true })
  for (const name of internals.modelFiles) writeFileSync(join(modelDir, name), 'x')
  const engine = join(dir, 'fake-gigastt.mjs')
  copyFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', 'fake-gigastt.mjs'), engine)
  chmodSync(engine, 0o755)
  const file = join(dir, 'hotwords.txt')
  writeFileSync(file, '# Hotwords\nDeepSeek Harness\n')
  process.env.ARGS_FILE = argsFile
  const service = { register(provider) { this.provider = provider; return async () => {} }, snapshot() { return { selection: { providerId: 'gigaam-local' } } }, async *follow() {} }
  const cleanups = []
  const scoped = { speechToText: service, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }
  apply({ inject(names, cb) { cb(scoped) }, effect(cb) { const d = cb(); cleanups.push(typeof d === 'function' ? d : () => {}); return d } }, {
    binaryPath: engine,
    modelDir,
    hotwordsFile: file,
    prewarm: false,
    dictionaryPort: 0,
  })
  const wav = readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', 'ru-sample.wav'))
  const provider = service.provider
  const first = await provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('распознавание работает', first.text === 'Проверка связи', first.text)
  const started = readFileSync(argsFile, 'utf8').trim().split('\n')
  check('движок получил файл словаря', started[0].includes('--hotwords-file') && started[0].includes(file), started[0])
  check('движок получил буст', started[0].includes('--hotwords-boost'), started[0])
  // Меняем словарь: следующий запрос перезапускает движок.
  writeFileSync(file, '# Hotwords\nDeepSeek Harness\n\n# === личный словарь (dsh-locale-russian) ===\nconfigHotwords\n# === /личный словарь ===\n')
  await new Promise((resolve) => setTimeout(resolve, 20))
  const second = await provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('после изменения словаря распознавание работает', second.text === 'Проверка связи', second.text)
  const restarted = readFileSync(argsFile, 'utf8').trim().split('\n')
  check('движок перезапущен с новым файлом', restarted.length === 2 && restarted[1].includes('--hotwords-file'), String(restarted.length))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.ARGS_FILE
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки личного словаря пройдены')
