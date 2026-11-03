#!/usr/bin/env node
/**
 * Tests the personal hotwords dictionary: the shared module, the installer CLI
 * commands, and the host endpoint the interface uses.
 *
 * Usage:
 *   node tools/test-hotwords.mjs
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  MAX_PERSONAL_HOTWORDS,
  addPersonalHotword,
  applyReplacements,
  clearPersonalHotwords,
  forgetPersonalHotword,
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
  const caseAdd = addPersonalHotword(base, 'GitHub')
  const caseDup = addPersonalHotword(caseAdd.text, 'github')
  check('дубликат без учёта регистра', caseDup.ok === true && caseDup.duplicate === true && caseDup.count === 1)
  const forgotten = forgetPersonalHotword(caseAdd.text, 'github')
  check('забывание без учёта регистра', forgotten.ok === true && forgotten.count === 0)
  const map = { 'гитхаб': 'GitHub', 'фордж': 'Forge' }
  check('замена применяется', applyReplacements('Проверка гитхаб и фордж', map) === 'Проверка GitHub и Forge')
  check('замена без учёта регистра', applyReplacements('Гитхаб, фордж.', map) === 'GitHub, Forge.')
  check('границы слова соблюдаются', applyReplacements('гитхабер не тронут', map) === 'гитхабер не тронут')
  check('без замен текст не меняется', applyReplacements('Проверка связи', map) === 'Проверка связи')
  check('длинная замена применяется первой', applyReplacements('гитхаб и гит', { 'гит': 'GIT', 'гитхаб': 'GitHub' }) === 'GitHub и GIT')
  check('русские окончания', applyReplacements('на гитхабе и без гитхаба', map) === 'на GitHub и без GitHub')
  check('окончание после гласной', applyReplacements('Опенаи заблокировали', { 'Опена': 'OpenAI' }) === 'OpenAI заблокировали')
  check('«гитхабер» не тронут', applyReplacements('гитхабер не тронут', map) === 'гитхабер не тронут')
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
  // stdin: путь «-» читает список из ввода.
  const fromStdin = spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--hotwords-file', file, '--hotwords-add-file', '-'], { encoding: 'utf8', input: 'Kubernetes\nPodman\n' })
  check('список из stdin', fromStdin.status === 0 && fromStdin.stdout.includes('добавлено: 2'), fromStdin.stdout + fromStdin.stderr)
  const exported = cli('--hotwords-export', '-')
  const payload = JSON.parse(exported.stdout)
  check('экспорт в stdout', exported.status === 0 && Array.isArray(payload.words) && payload.words.includes('Kubernetes'), exported.stdout)
  check('экспорт содержит замены', payload.replacements !== undefined && typeof payload.replacements === 'object')
  const imported = spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--hotwords-file', file, '--hotwords-import', '-'], {
    encoding: 'utf8',
    input: JSON.stringify({ words: ['WebSocket'], replacements: { 'гитхаб': 'GitHub' } }),
  })
  check('импорт из stdin', imported.status === 0 && imported.stdout.includes('слов 1') && imported.stdout.includes('замен 1'), imported.stdout + imported.stderr)
  check('слово из импорта в словаре', readFileSync(file, 'utf8').includes('WebSocket'))
  const replacementsFile = join(workspace, 'replacements.json')
  check('замена из импорта записана', readFileSync(replacementsFile, 'utf8').includes('"гитхаб": "GitHub"'), readFileSync(replacementsFile, 'utf8'))
}

console.log('словарь из проекта')
{
  const project = join(workspace, 'project')
  mkdirSync(join(project, 'src'), { recursive: true })
  mkdirSync(join(project, 'node_modules'), { recursive: true })
  writeFileSync(join(project, 'src', 'audio-engine.ts'), 'export class GigaAmEngine { start(configHotwords: string[]) { return configHotwords.length } }\n')
  writeFileSync(join(project, 'src', 'panel.tsx'), 'export const WorktreesPanel = () => null\nexport const useData = () => null\n// Harness is mentioned here too\nexport const Harness = 1\n')
  writeFileSync(join(project, 'node_modules', 'ignored.js'), 'export class ShouldNotAppear {}\n')
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'dsh-locale-russian' }))
  const file = join(workspace, 'project-hotwords.txt')
  const cli = (...args) => spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--hotwords-file', file, ...args], { encoding: 'utf8' })
  const seedFile = join(workspace, 'project-hotwords.txt')
  writeFileSync(seedFile, '# Hotwords\nDeepSeek Harness\n')
  const scan = cli('--hotwords-from', project)
  check('сканирование добавляет термины', scan.status === 0 && scan.stdout.includes('добавлено'), scan.stdout + scan.stderr)
  const words = readPersonalHotwords(readFileSync(file, 'utf8'))
  check('термины из кода', words.includes('GigaAmEngine') && words.includes('configHotwords') && words.includes('WorktreesPanel'), JSON.stringify(words))
  check('общие слова пропущены', !words.includes('useData') && !words.includes('Data'), JSON.stringify(words))
  check('node_modules не сканируется', !words.some((word) => word.includes('ShouldNotAppear')), JSON.stringify(words))
  check('обрывок существующей фразы пропущен', !words.includes('Harness'), JSON.stringify(words))
  const manifestFile = join(workspace, 'projects.json')
  check('манифест проектов записан', existsSync(manifestFile) && readFileSync(manifestFile, 'utf8').includes('GigaAmEngine'))
  const again = cli('--hotwords-from', project)
  check('повторный запуск без дублей', again.status === 0 && readPersonalHotwords(readFileSync(file, 'utf8')).length === words.length, again.stdout)
  const limited = cli('--hotwords-from', project, '--hotwords-limit', '1')
  check('лимит работает', limited.status === 0 && readPersonalHotwords(readFileSync(file, 'utf8')).length === 1, limited.stdout)
  const missing = cli('--hotwords-from', join(workspace, 'нет-папки'))
  check('отсутствующая папка — ошибка', missing.status !== 0)
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
  process.env.DSH_HOME = workspace
  mkdirSync(join(workspace, 'profiles', 'desktop'), { recursive: true })
  writeFileSync(join(workspace, 'profiles', 'desktop', 'cordis.patch.yml'), '- id: test\n')
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
  const forget = await fetch(`http://127.0.0.1:${port}/forget`, { method: 'POST', body: JSON.stringify('GitHub') }).then((response) => response.json())
  check('слово забыто через endpoint', forget.ok === true && !readFileSync(file, 'utf8').includes('\nGitHub\n'), JSON.stringify(forget))
  const forgetMissing = await fetch(`http://127.0.0.1:${port}/forget`, { method: 'POST', body: JSON.stringify('НетТакого') })
  check('забывание отсутствующего — 400', forgetMissing.status === 400)
  const forgetPair = await fetch(`http://127.0.0.1:${port}/forget-pair`, { method: 'POST', body: JSON.stringify({ heard: 'гитхаб' }) }).then((response) => response.json())
  check('пара забыта через endpoint', forgetPair.ok === true && !readFileSync(replacementsFile, 'utf8').includes('"гитхаб"'), JSON.stringify(forgetPair))
  const forgetPairMissing = await fetch(`http://127.0.0.1:${port}/forget-pair`, { method: 'POST', body: JSON.stringify({ heard: 'нет' }) })
  check('забывание отсутствующей пары — 400', forgetPairMissing.status === 400)
  writeFileSync(join(workspace, 'transcripts.json'), JSON.stringify([{ at: Date.now(), merged: 'говорю NGINE и Sentences Default' }]))
  await post('engine')
  const suggestions = await fetch(`http://127.0.0.1:${port}/suggestions`).then((response) => response.json())
  check('предложение искажённого термина', Array.isArray(suggestions.suggestions) && suggestions.suggestions.some((entry) => entry.heard === 'ngine' && entry.chosen === 'engine'), JSON.stringify(suggestions))
  const engineGet = await fetch(`http://127.0.0.1:${port}/engine`).then((response) => response.json())
  check('engine: текущий движок', engineGet.engine === 'gigaam' && engineGet.merge === 'auto', JSON.stringify(engineGet))
  const enginePost = await fetch(`http://127.0.0.1:${port}/engine`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engine: 'hybrid', merge: 'sentences' }),
  }).then((response) => response.json())
  check('engine: сохранение выбора', enginePost.ok === true && enginePost.restartRequired === true, JSON.stringify(enginePost))
  const patchFile = join(workspace, 'profiles', 'desktop', 'cordis.patch.yml')
  check('engine: конфиг записан', readFileSync(patchFile, 'utf8').includes('engine: hybrid') && readFileSync(patchFile, 'utf8').includes('merge: sentences'), readFileSync(patchFile, 'utf8'))
  const engineBad = await fetch(`http://127.0.0.1:${port}/engine`, { method: 'POST', body: JSON.stringify({ engine: 'nope' }) })
  check('engine: неверный движок — 400', engineBad.status === 400)
  const learnedBad = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  check('битый JSON отклоняется', learnedBad.status === 400)
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.DSH_HOME
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
    replacementsFile: join(dir, 'replacements.json'),
    prewarm: false,
    dictionaryPort: 0,
    hotwordsWatchMs: 50,
  })
  const wav = readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', 'ru-sample.wav'))
  const provider = service.provider
  process.env.FAKE_TRANSCRIPT = 'Проверка гитхаб и фордж'
  const replacementsFile = join(dir, 'replacements.json')
  writeFileSync(replacementsFile, JSON.stringify({ replacements: { 'гитхаб': 'GitHub', 'фордж': 'Forge' } }))
  const first = await provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('провайдер применяет выученные замены', first.text === 'Проверка GitHub и Forge', first.text)
  const started = readFileSync(argsFile, 'utf8').trim().split('\n')
  check('движок получил файл словаря', started[0].includes('--hotwords-file') && started[0].includes(file), started[0])
  check('движок получил буст', started[0].includes('--hotwords-boost'), started[0])
  // Меняем словарь: следующий запрос перезапускает движок.
  writeFileSync(file, '# Hotwords\nDeepSeek Harness\n\n# === личный словарь (dsh-locale-russian) ===\nconfigHotwords\n# === /личный словарь ===\n')
  await new Promise((resolve) => setTimeout(resolve, 20))
  // Изменяем словарь и ждём фоновый перезапуск — без новой диктовки.
  writeFileSync(file, '# Hotwords\nDeepSeek Harness\n\n# === личный словарь (dsh-locale-russian) ===\nconfigHotwords\nНовоеСлово\n# === /личный словарь ===\n')
  await new Promise((resolve) => setTimeout(resolve, 250))
  const background = readFileSync(argsFile, 'utf8').trim().split('\n')
  check('движок перезапущен в фоне без диктовки', background.length === 2, String(background.length))
  const second = await provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('после изменения словаря распознавание работает', second.text === 'Проверка GitHub и Forge', second.text)
  delete process.env.FAKE_TRANSCRIPT
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
