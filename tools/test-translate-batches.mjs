#!/usr/bin/env node
/**
 * Tests `tools/translate-batches.mjs` against synthetic batches in a temporary
 * checkout: the mock provider, dry-run, the external-command provider, and the
 * structural checks that stop a broken answer before it reaches the repository.
 *
 * Usage:
 *   node tools/test-translate-batches.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const failures = []
/** Reads a JSON file, or undefined when it is absent. */
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return undefined }
}
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const tool = join(import.meta.dirname, 'translate-batches.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-translate-test-'))

/** Runs the tool against the temporary checkout. */
const run = (args) => spawnSync(process.execPath, [tool, '--root', workspace, ...args], { encoding: 'utf8' })

/** Creates a fresh temporary checkout with the given batches. */
function prepare({ ui = [], plugin = [], glossary = true, dictionary = undefined } = {}) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'batches'), { recursive: true })
  mkdirSync(join(workspace, 'translations'), { recursive: true })
  mkdirSync(join(workspace, 'dictionary'), { recursive: true })
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify(dictionary?.ui ?? {}))
  writeFileSync(join(workspace, 'dictionary', 'plugin-meta.json'), JSON.stringify(dictionary?.plugin ?? {}))
  if (glossary) {
    writeFileSync(join(workspace, 'GLOSSARY.md'), '| Английский | Русский |\n|---|---|\n| session | сессия |\n')
    writeFileSync(join(workspace, 'STYLE.md'), '# Стиль\n')
  }
  const uiManifest = { batchSize: 120, batches: [] }
  ui.forEach((batch, index) => {
    const id = `p3-${String(index + 1).padStart(3, '0')}`
    uiManifest.batches.push({ id, namespace: batch.namespace, priority: 'p3', count: batch.items.length, file: `${id}.json` })
    writeFileSync(join(workspace, 'batches', `${id}.json`), JSON.stringify({ id, namespace: batch.namespace, priority: 'p3', count: batch.items.length, items: batch.items }))
  })
  writeFileSync(join(workspace, 'batches', 'manifest.json'), JSON.stringify(uiManifest))
  const pluginManifest = { batchSize: 90, batches: [] }
  plugin.forEach((batch, index) => {
    const id = `plugin-${String(index + 1).padStart(2, '0')}`
    pluginManifest.batches.push({ id, count: batch.length, file: `${id}.json` })
    writeFileSync(join(workspace, 'batches', `${id}.json`), JSON.stringify({ id, kind: 'plugin-meta', count: batch.length, items: batch }))
  })
  writeFileSync(join(workspace, 'batches', 'plugin-manifest.json'), JSON.stringify(pluginManifest))
}

const uiItems = [
  { namespace: 'chat', key: 'plain', en: 'Plain text', context: 'test' },
  { namespace: 'chat', key: 'counted', en: '{count} files', context: 'test' },
  { namespace: 'settings', key: 'title', en: 'Settings', context: 'test' },
]

console.log('пустая дельта')
prepare()
{
  const result = run(['--provider', 'mock'])
  check('пустая дельта не падает', result.status === 0, result.stderr)
  check('сообщает, что переводить нечего', result.stdout.includes('нечего переводить'))
}

console.log('mock-провайдер')
prepare({ ui: [{ namespace: 'chat', items: uiItems.filter((item) => item.namespace === 'chat') }, { namespace: 'settings', items: uiItems.filter((item) => item.namespace === 'settings') }], plugin: [[{ kind: 'description', en: 'A test plugin', packages: ['@example/plugin'] }]] })
{
  const result = run(['--provider', 'mock'])
  check('перевод записан', result.status === 0, result.stderr)
  const files = readdirSync(join(workspace, 'translations')).sort()
  check('файлы по namespace и метаданным', files.join(',') === 'p3-001.json,p3-002.json,plugin-01.json', files.join(','))
  const chat = readJson(join(workspace, 'translations', 'p3-001.json'))
  check('формат файла namespace', chat?.namespace === 'chat' && chat?.translations?.plain === 'Перевод: Plain text')
  check('плейсхолдер сохранён', chat?.translations?.counted === 'Перевод: {count} files')
  const meta = readJson(join(workspace, 'translations', 'plugin-01.json'))
  check('формат метаданных', meta?.kind === 'plugin-meta' && meta?.translations?.['A test plugin'] === 'Перевод: A test plugin')
  check('следующий id не занят', run(['--provider', 'mock']).status === 0)
  const second = readdirSync(join(workspace, 'translations')).sort()
  check('повторный запуск берёт свободные id', second.includes('p3-003.json') || second.includes('p3-004.json'), second.join(','))
}

console.log('dry-run')
prepare({ ui: [{ namespace: 'chat', items: uiItems }] })
{
  const result = run(['--provider', 'mock', '--dry-run'])
  check('dry-run успешен', result.status === 0, result.stderr)
  check('dry-run не пишет файлы', readdirSync(join(workspace, 'translations')).length === 0)
}

console.log('провайдер-команда')
prepare({ ui: [{ namespace: 'chat', items: uiItems }] })
{
  const command = `node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const q=JSON.parse(s);process.stdout.write(JSON.stringify(q.payload.map(i=>'Команда: '+i.en)))})"`
  const result = run(['--provider', 'command', '--command', command])
  check('команда переводит', result.status === 0, result.stderr)
  const file = readJson(join(workspace, 'translations', 'p3-001.json'))
  check('ответ команды записан', file?.translations?.plain === 'Команда: Plain text')
}

console.log('проверка ответа')
prepare({ ui: [{ namespace: 'chat', items: [uiItems[1]] }] })
{
  // Ответ теряет плейсхолдер — инструмент обязан отказаться его писать.
  const command = `node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify(['файлы'])))"`
  const result = run(['--provider', 'command', '--command', command])
  check('потерянный плейсхолдер — ошибка', result.status === 1)
  check('в отчёте назван плейсхолдер', result.stderr.includes('плейсхолдеры'), result.stderr)
  check('битый ответ не записан', readdirSync(join(workspace, 'translations')).length === 0)
}

console.log('уже переведённое пропускается')
prepare({
  ui: [{ namespace: 'chat', items: [uiItems[0], uiItems[1]] }],
  plugin: [[{ kind: 'description', en: 'Already translated', packages: [] }, { kind: 'description', en: 'New string', packages: [] }]],
  dictionary: { ui: { chat: { plain: 'Уже переведено' } }, plugin: { 'Already translated': 'Уже переведено' } },
})
{
  const result = run(['--provider', 'mock'])
  check('запуск успешен', result.status === 0, result.stderr)
  check('сообщает о пропуске', result.stdout.includes('пропущено: 2'), result.stdout)
  const chat = readJson(join(workspace, 'translations', 'p3-001.json'))
  check('переведён только новый ключ', chat?.translations?.counted !== undefined && chat?.translations?.plain === undefined, JSON.stringify(chat?.translations))
  const meta = readJson(join(workspace, 'translations', 'plugin-01.json'))
  check('новое описание переведено', meta?.translations?.['New string'] === 'Перевод: New string')
  check('готовое описание не перезаписано', meta?.translations?.['Already translated'] === undefined)
}

console.log('уникальные id в dry-run')
prepare({ ui: [{ namespace: 'chat', items: [uiItems[0]] }, { namespace: 'settings', items: [uiItems[2]] }] })
{
  const result = run(['--provider', 'mock', '--dry-run'])
  check('dry-run успешен', result.status === 0, result.stderr)
  const ids = [...result.stdout.matchAll(/записан translations\/(p3-\d+\.json)/g)].map((match) => match[1])
  check('id не повторяются', new Set(ids).size === ids.length && ids.length === 2, ids.join(','))
}

console.log('ошибки конфигурации')
prepare({ ui: [{ namespace: 'chat', items: uiItems }] })
check('неизвестный провайдер — ошибка', run(['--provider', 'nope']).status !== 0)
check('openai без ключа — ошибка', run(['--provider', 'openai']).status !== 0)
{
  const result = run(['--provider', 'command', '--command', 'node -e "process.exit(3)"'])
  check('падение команды — ошибка', result.status !== 0 && result.stderr.includes('кодом 3'), result.stderr)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки инструмента перевода пройдены')
