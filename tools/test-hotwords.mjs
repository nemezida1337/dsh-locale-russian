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
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
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

console.log('SSRF: IPv6-формы приватных адресов')
{
  const { internals } = await import('../lib/index.js')
  const privateAddresses = [
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '169.254.1.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '0:0:0:0:0:ffff:7f00:1',
    '0:0:0:0:0:0:0:1',
    '64:ff9b::7f00:1',
    '2002:7f00:0001::',
  ]
  for (const address of privateAddresses) {
    check(`приватный адрес ${address}`, internals.isPrivateAddress(address) === true)
  }
  const publicAddresses = ['8.8.8.8', '1.1.1.1', '2606:4700::1111', '2a00:1450:4001::1']
  for (const address of publicAddresses) {
    check(`публичный адрес ${address}`, internals.isPrivateAddress(address) === false)
  }
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
    allowLocalDictionaryImport: true,
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
  // Очередь авто-обучения: авто-пары попадают в /review, пользователь решает.
  const learnAuto = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ heard: 'нгіне', chosen: 'engine', source: 'auto' }),
  }).then((response) => response.json())
  check('авто-пара выучена', learnAuto.ok === true, JSON.stringify(learnAuto))
  const review1 = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('авто-пара в очереди проверки', Array.isArray(review1.pairs) && review1.pairs.some((pair) => pair.heard === 'нгіне' && pair.chosen === 'engine'), JSON.stringify(review1))
  const dictionaryAuto = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('источник замены — auto', dictionaryAuto.sources?.replacements?.['нгіне'] === 'auto', JSON.stringify(dictionaryAuto.sources))
  const keepAuto = await fetch(`http://127.0.0.1:${port}/review/keep`, { method: 'POST', body: JSON.stringify({ heard: 'нгіне' }) }).then((response) => response.json())
  const review2 = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('«Оставить» убирает пару из очереди', keepAuto.ok === true && review2.pairs.length === 0, JSON.stringify(review2))
  check('«Оставить» сохраняет замену', readFileSync(join(workspace, 'endpoint-replacements.json'), 'utf8').includes('engine'))
  await fetch(`http://127.0.0.1:${port}/learn`, { method: 'POST', body: JSON.stringify({ heard: 'другой', chosen: 'engine', source: 'auto' }) })
  const forgetAuto = await fetch(`http://127.0.0.1:${port}/review/forget`, { method: 'POST', body: JSON.stringify({ heard: 'другой' }) }).then((response) => response.json())
  check('«Убрать» удаляет замену и очередь', forgetAuto.ok === true && !readFileSync(join(workspace, 'endpoint-replacements.json'), 'utf8').includes('"другой"'))
  const manualLearn = await fetch(`http://127.0.0.1:${port}/learn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ heard: 'вручную', chosen: 'engine' }),
  }).then((response) => response.json())
  const reviewAfterManual = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('ручное обучение не попадает в очередь', manualLearn.ok === true && !reviewAfterManual.pairs.some((pair) => pair.heard === 'вручную'), JSON.stringify(reviewAfterManual))
  // Источники слов: слово из манифеста проекта помечается как project.
  writeFileSync(join(workspace, 'projects.json'), JSON.stringify({ '/tmp/project': ['configHotwords'] }))
  const dictionarySources = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('источник слова — project', dictionarySources.sources?.words?.configHotwords === 'project', JSON.stringify(dictionarySources.sources?.words))
  // Повреждённый learned.json не затирается и не роняет endpoint'ы.
  writeFileSync(join(workspace, 'learned.json'), '{ broken')
  const reviewCorrupt = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('битый learned.json: corrupt-флаг', reviewCorrupt.corrupt === true && reviewCorrupt.pairs.length === 0, JSON.stringify(reviewCorrupt))
  const keepCorrupt = await fetch(`http://127.0.0.1:${port}/review/keep`, { method: 'POST', body: JSON.stringify({ heard: 'x' }) })
  check('keep при битом файле — 400', keepCorrupt.status === 400, String(keepCorrupt.status))
  check('битый learned.json не перезаписан', readFileSync(join(workspace, 'learned.json'), 'utf8').startsWith('{ broken'))
  writeFileSync(join(workspace, 'learned.json'), JSON.stringify({ pairs: [] }))
  // Ручное переобучение обновляет chosen в очереди.
  await fetch(`http://127.0.0.1:${port}/learn`, { method: 'POST', body: JSON.stringify({ heard: 'термин', chosen: 'first', source: 'auto' }) })
  await fetch(`http://127.0.0.1:${port}/learn`, { method: 'POST', body: JSON.stringify({ heard: 'термин', chosen: 'second' }) })
  const reviewUpdated = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('ручное обучение обновило очередь', reviewUpdated.pairs.some((pair) => pair.heard === 'термин' && pair.chosen === 'second'), JSON.stringify(reviewUpdated.pairs))
  // Удаление пары чистит и очередь.
  await fetch(`http://127.0.0.1:${port}/learn`, { method: 'POST', body: JSON.stringify({ heard: 'пара', chosen: 'engine', source: 'auto' }) })
  await fetch(`http://127.0.0.1:${port}/forget-pair`, { method: 'POST', body: JSON.stringify({ heard: 'пара' }) })
  const reviewAfterForget = await fetch(`http://127.0.0.1:${port}/review`).then((response) => response.json())
  check('/forget-pair чистит очередь', !reviewAfterForget.pairs.some((pair) => pair.heard === 'пара'), JSON.stringify(reviewAfterForget.pairs))
  // Односимвольные замены и удаление отсутствующей пары — 400.
  const tooShort = await fetch(`http://127.0.0.1:${port}/learn`, { method: 'POST', body: JSON.stringify({ heard: 'я', chosen: 'I' }) })
  check('односимвольная замена — 400', tooShort.status === 400, String(tooShort.status))
  const forgetMissingPair = await fetch(`http://127.0.0.1:${port}/review/forget`, { method: 'POST', body: JSON.stringify({ heard: 'нет-такой' }) })
  check('удаление отсутствующей пары — 400', forgetMissingPair.status === 400, String(forgetMissingPair.status))
  // Динамические словари: создание, переключение, удаление.
  const profiles0 = await fetch(`http://127.0.0.1:${port}/profiles`).then((response) => response.json())
  check('словари: активный по умолчанию', typeof profiles0.active === 'string' && profiles0.profiles.length >= 1, JSON.stringify(profiles0))
  const defaultId = profiles0.active
  // Создаём профиль до добавления терминов: словари должны быть изолированы.
  const created = await fetch(`http://127.0.0.1:${port}/profiles/create`, { method: 'POST', body: JSON.stringify({ name: 'Проект' }) }).then((response) => response.json())
  check('словарь создан', created.ok === true && created.id !== undefined, JSON.stringify(created))
  const profilesAfterCreate = await fetch(`http://127.0.0.1:${port}/profiles`).then((response) => response.json())
  check('новый словарь активен', profilesAfterCreate.active === created.id && profilesAfterCreate.profiles.length >= 2, JSON.stringify(profilesAfterCreate))
  await post('Kubernetes')
  await post('Podman')
  const switched = await fetch(`http://127.0.0.1:${port}/profiles/switch`, { method: 'POST', body: JSON.stringify({ id: defaultId }) }).then((response) => response.json())
  check('переключение на другой словарь', switched.ok === true && switched.active === defaultId, JSON.stringify(switched))
  const dictionaryDefault = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('слова другого словаря скрыты', !dictionaryDefault.words.includes('Kubernetes'), JSON.stringify(dictionaryDefault.words))
  const switchedBack = await fetch(`http://127.0.0.1:${port}/profiles/switch`, { method: 'POST', body: JSON.stringify({ id: created.id }) }).then((response) => response.json())
  const dictionaryProject = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('слова проекта вернулись', switchedBack.ok === true && dictionaryProject.words.includes('Kubernetes'), JSON.stringify(dictionaryProject.words))
  const autoSwitch = await fetch(`http://127.0.0.1:${port}/settings`, { method: 'POST', body: JSON.stringify({ autoSwitch: false }) }).then((response) => response.json())
  check('настройка подсказок сохраняется', autoSwitch.ok === true && autoSwitch.settings.autoSwitch === false, JSON.stringify(autoSwitch))
  const deleted = await fetch(`http://127.0.0.1:${port}/profiles/delete`, { method: 'POST', body: JSON.stringify({ id: created.id }) }).then((response) => response.json())
  check('словарь удалён', deleted.ok === true, JSON.stringify(deleted))
  // Настройки диктовки, статус и «доктор».
  const settingsGet = await fetch(`http://127.0.0.1:${port}/settings`).then((response) => response.json())
  check('настройки: авто-обучение по умолчанию включено', settingsGet.autoLearn === true, JSON.stringify(settingsGet))
  const settingsPost = await fetch(`http://127.0.0.1:${port}/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoLearn: false }),
  }).then((response) => response.json())
  check('настройки: выключение авто-обучения', settingsPost.ok === true && settingsPost.settings.autoLearn === false, JSON.stringify(settingsPost))
  const settingsAfter = await fetch(`http://127.0.0.1:${port}/settings`).then((response) => response.json())
  check('настройки: значение сохранилось', settingsAfter.autoLearn === false, JSON.stringify(settingsAfter))
  const settingsBad = await fetch(`http://127.0.0.1:${port}/settings`, { method: 'POST', body: JSON.stringify({ autoLearn: 'нет' }) })
  check('настройки: неверное значение — 400', settingsBad.status === 400, String(settingsBad.status))
  const status = await fetch(`http://127.0.0.1:${port}/status`).then((response) => response.json())
  check('статус: движок и модель', status.engine === 'gigaam' && typeof status.gigaam?.model === 'boolean', JSON.stringify(status))
  check('статус: словарь и настройки', typeof status.dictionary?.words === 'number' && status.settings?.autoLearn === false, JSON.stringify(status.dictionary))
  const doctor = await fetch(`http://127.0.0.1:${port}/doctor`).then((response) => response.json())
  check('доктор: список проверок', Array.isArray(doctor.items) && doctor.items.length >= 6 && typeof doctor.ok === 'boolean', JSON.stringify(doctor.items?.map((item) => item.id)))
  check('доктор: битые ресурсы отмечены', doctor.items.some((item) => item.id === 'gigaam-model' && item.ok === false), JSON.stringify(doctor.items))
  // Защита от cross-site запросов: чужой сайт не читает диктовку и не пишет словарь.
  const crossSite = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
  })
  check('cross-site запрос отклонён', crossSite.status === 403, String(crossSite.status))
  const sameSite = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'same-site', origin: `http://127.0.0.1:${port}` },
  })
  check('same-site запрос разрешён', sameSite.status === 200, String(sameSite.status))
  const electronNull = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'null', 'user-agent': 'Mozilla/5.0 Electron/39.0.0' },
  })
  check('запрос Electron (Origin: null) разрешён', electronNull.status === 200, String(electronNull.status))
  const opaqueOrigin = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'null' },
  })
  check('opaque-origin без Electron отклонён', opaqueOrigin.status === 403, String(opaqueOrigin.status))
  // DSH 0.2.2 грузит рендерер со схемы dsh-app://app: это не opaque origin,
  // но и не loopback-URL, поэтому доверяем схеме только при Electron UA.
  const appScheme = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'dsh-app://app', 'user-agent': 'Mozilla/5.0 DeepSeek Harness Electron/44.7.0' },
  })
  check('dsh-app origin разрешён', appScheme.status === 200, String(appScheme.status))
  const appSchemeForeign = await fetch(`http://127.0.0.1:${port}/last-transcription`, {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'dsh-app://app', 'user-agent': 'Mozilla/5.0 Safari/605' },
  })
  check('dsh-app без Electron отклонён', appSchemeForeign.status === 403, String(appSchemeForeign.status))
  const preflight = await fetch(`http://127.0.0.1:${port}/dictionary`, {
    method: 'OPTIONS',
    headers: {
      origin: 'dsh-app://app',
      'sec-fetch-site': 'cross-site',
      'user-agent': 'Mozilla/5.0 DeepSeek Harness Electron/44.7.0',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-dsh-locale-client',
    },
  })
  check('preflight dsh-app разрешён', preflight.status === 204, String(preflight.status))
  check('preflight разрешает private network', preflight.headers.get('access-control-allow-private-network') === 'true')
  // CSRF: мутирующий POST из браузера требует клиентский заголовок.
  const csrfNoHeader = await fetch(`http://127.0.0.1:${port}/stats/reset`, {
    method: 'POST',
    headers: { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' },
  })
  check('POST без клиентского заголовка отклонён', csrfNoHeader.status === 403, String(csrfNoHeader.status))
  const csrfWithHeader = await fetch(`http://127.0.0.1:${port}/stats/reset`, {
    method: 'POST',
    headers: { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json', 'x-dsh-locale-client': '1' },
  })
  check('POST с клиентским заголовком разрешён', csrfWithHeader.status === 200, String(csrfWithHeader.status))
  // Path traversal в id профиля.
  const traversalDelete = await fetch(`http://127.0.0.1:${port}/profiles/delete`, {
    method: 'POST',
    body: JSON.stringify({ id: '../victim' }),
  })
  check('path traversal удаления профиля отклонён', traversalDelete.status === 400, String(traversalDelete.status))
  const traversalSwitch = await fetch(`http://127.0.0.1:${port}/profiles/switch`, {
    method: 'POST',
    body: JSON.stringify({ id: '../victim' }),
  })
  check('path traversal переключения отклонён', traversalSwitch.status === 400, String(traversalSwitch.status))
  const badHost = await new Promise((resolve) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/health', headers: { host: 'evil.example' } }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode))
    })
    request.on('error', () => resolve(0))
    request.end()
  })
  check('чужой Host отклонён', badHost === 403, String(badHost))
  // Статистика и ретенция.
  const statsInitial = await fetch(`http://127.0.0.1:${port}/stats`).then((response) => response.json())
  check('статистика: начальная форма', typeof statsInitial.dictations === 'number' && Array.isArray(statsInitial.words) && Array.isArray(statsInitial.stale), JSON.stringify(statsInitial))
  await post('НеиспользуемоеСлово')
  const statsFile = join(workspace, 'stats.json')
  writeFileSync(statsFile, JSON.stringify({
    dictations: 40,
    enabledAt: Date.now() - 90 * 24 * 3600 * 1000,
    terms: { НеиспользуемоеСлово: { hits: 0, lastAt: 0, sinceDictation: 0 } },
    pairs: {},
  }))
  const statsStale = await fetch(`http://127.0.0.1:${port}/stats`).then((response) => response.json())
  check('ретенция: слово помечено неиспользуемым', statsStale.stale.some((entry) => entry.word === 'НеиспользуемоеСлово'), JSON.stringify(statsStale.stale))
  const prunePreview = await fetch(`http://127.0.0.1:${port}/stats/prune`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true }) }).then((response) => response.json())
  check('ретенция: dry-run показывает кандидатов', prunePreview.ok === true && prunePreview.stale.some((entry) => entry.word === 'НеиспользуемоеСлово'), JSON.stringify(prunePreview))
  const pruned = await fetch(`http://127.0.0.1:${port}/stats/prune`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: false }) }).then((response) => response.json())
  check('ретенция: слово удалено', pruned.ok === true && pruned.removed.includes('НеиспользуемоеСлово'), JSON.stringify(pruned))
  const afterPrune = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('после ретенции слова нет', !afterPrune.words.includes('НеиспользуемоеСлово'), JSON.stringify(afterPrune.words))
  // Подготовка модели из браузера требует CSRF-заголовок.
  const prepareNoHeader = await fetch(`http://127.0.0.1:${port}/model/prepare`, {
    method: 'POST',
    headers: { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' },
  })
  check('prepare без клиентского заголовка отклонён', prepareNoHeader.status === 403, String(prepareNoHeader.status))
  // Битый stats.json с null-записью не роняет статистику.
  writeFileSync(statsFile, JSON.stringify({ dictations: 40, terms: { 'Сломанное': null }, pairs: {} }))
  const statsNull = await fetch(`http://127.0.0.1:${port}/stats`)
  check('stats с null-записью не падает', statsNull.status === 200, String(statsNull.status))
  writeFileSync(statsFile, JSON.stringify({ dictations: 40, terms: {}, pairs: {} }))
  // Удаление последнего активного профиля не воскрешает его.
  const profilesBeforeDelete = await fetch(`http://127.0.0.1:${port}/profiles`).then((response) => response.json())
  const activeProfileId = profilesBeforeDelete.active
  const deletedActive = await fetch(`http://127.0.0.1:${port}/profiles/delete`, { method: 'POST', body: JSON.stringify({ id: activeProfileId }) }).then((response) => response.json())
  const profilesAfterDelete = await fetch(`http://127.0.0.1:${port}/profiles`).then((response) => response.json())
  check('удаление последнего профиля не воскрешает файл', deletedActive.ok === true && !(profilesAfterDelete.profiles ?? []).some((profile) => profile.id === activeProfileId), JSON.stringify(profilesAfterDelete))
  const createdAfterDelete = await fetch(`http://127.0.0.1:${port}/profiles/create`, { method: 'POST', body: JSON.stringify({ name: 'Новый' }) }).then((response) => response.json())
  const profilesAfterRecreate = await fetch(`http://127.0.0.1:${port}/profiles`).then((response) => response.json())
  check('создание после удаления не воскрешает default', createdAfterDelete.ok === true && !(profilesAfterRecreate.profiles ?? []).some((profile) => profile.id === 'default'), JSON.stringify(profilesAfterRecreate))
  // Импорт по URL.
  const importedBody = JSON.stringify({ words: ['СловоИзURL'], replacements: { 'фром': 'from' } })
  const importServer = createHttpServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(importedBody)
  })
  const importPort = await new Promise((resolve) => {
    importServer.listen(0, '127.0.0.1', () => {
      const value = importServer.address().port
      resolve(value)
    })
  })
  const imported = await fetch(`http://127.0.0.1:${port}/dictionary/import-url`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: `http://127.0.0.1:${importPort}/dict.json` }),
  }).then((response) => response.json())
  await new Promise((resolve) => importServer.close(resolve))
  check('импорт по URL: слова и замены', imported.ok === true && imported.words >= 1 && imported.replacements >= 1, JSON.stringify(imported))
  const afterImport = await fetch(`http://127.0.0.1:${port}/dictionary`).then((response) => response.json())
  check('импорт по URL: слово в словаре', afterImport.words.includes('СловоИзURL'), JSON.stringify(afterImport.words))
  const badUrl = await fetch(`http://127.0.0.1:${port}/dictionary/import-url`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'file:///etc/passwd' }) }).then((response) => response.status)
  check('импорт по URL: неверная схема отклонена', badUrl === 400, String(badUrl))
  // CORS/CSRF: dsh-app origin доверяется только с Electron UA и заголовком клиента.
  const dshApp = { origin: 'dsh-app://app', 'user-agent': 'Mozilla/5.0 DeepSeek Harness Electron/44.7.0' }
  const transcriptions = await fetch(`http://127.0.0.1:${port}/transcriptions?after=0`, { headers: dshApp })
  check('transcriptions: dsh-app разрешён', transcriptions.status === 200, String(transcriptions.status))
  const transcriptionsEvil = await fetch(`http://127.0.0.1:${port}/transcriptions`, { headers: { origin: 'https://evil.example' } })
  check('transcriptions: чужой origin отклонён', transcriptionsEvil.status === 403, String(transcriptionsEvil.status))
  const settingsNoHeader = await fetch(`http://127.0.0.1:${port}/settings`, {
    method: 'POST', headers: { ...dshApp, 'content-type': 'application/json' }, body: JSON.stringify({ autoLearn: true }),
  })
  check('POST без клиентского заголовка — csrf 403', settingsNoHeader.status === 403, String(settingsNoHeader.status))
  const settingsWithHeader = await fetch(`http://127.0.0.1:${port}/settings`, {
    method: 'POST', headers: { ...dshApp, 'content-type': 'application/json', 'x-dsh-locale-client': '1' }, body: JSON.stringify({ autoLearn: true }),
  })
  check('POST с клиентским заголовком разрешён', settingsWithHeader.status === 200, String(settingsWithHeader.status))
  const preflightEvil = await fetch(`http://127.0.0.1:${port}/settings`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
  check('preflight чужого origin — 403', preflightEvil.status === 403, String(preflightEvil.status))
  const fileOrigin = await fetch(`http://127.0.0.1:${port}/transcriptions`, { headers: { origin: 'file://', 'user-agent': 'Mozilla/5.0 Electron/44.7.0' } })
  check('file:// origin с Electron разрешён', fileOrigin.status === 200, String(fileOrigin.status))
  const engineGet = await fetch(`http://127.0.0.1:${port}/engine`).then((response) => response.json())
  check('engine: текущий движок', engineGet.engine === 'gigaam' && engineGet.merge === 'sentences', JSON.stringify(engineGet))
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
  check('движок перезапущен в фоне без диктовки', background.length >= 2, String(background.length))
  const second = await provider.transcribe({ audio: wav }, AbortSignal.timeout(30_000))
  check('после изменения словаря распознавание работает', second.text === 'Проверка GitHub и Forge', second.text)
  delete process.env.FAKE_TRANSCRIPT
  const restarted = readFileSync(argsFile, 'utf8').trim().split('\n')
  check('движок перезапущен с новым файлом', restarted.length >= 2 && restarted[restarted.length - 1].includes('--hotwords-file'), String(restarted.length))
  for (const cleanup of cleanups.reverse()) await cleanup()
  delete process.env.ARGS_FILE
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки личного словаря пройдены')
