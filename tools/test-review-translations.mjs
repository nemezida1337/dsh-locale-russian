#!/usr/bin/env node
/**
 * Tests the review tool: a clean answer produces an empty report, a flagged
 * answer lands in the report (and fails with --fail-on-issues), a wrong answer
 * length is rejected, and configuration errors are reported clearly.
 *
 * Usage:
 *   node tools/test-review-translations.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const tool = join(import.meta.dirname, 'review-translations.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-review-test-'))
const run = (args) => spawnSync(process.execPath, [tool, '--root', workspace, ...args], { encoding: 'utf8' })

/** Prepares a tiny checkout: a dictionary, an inventory and a glossary. */
function prepare() {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'dictionary'), { recursive: true })
  mkdirSync(join(workspace, 'strings'), { recursive: true })
  writeFileSync(join(workspace, 'GLOSSARY.md'), '| Английский | Русский |\n|---|---|\n| session | сессия |\n')
  writeFileSync(join(workspace, 'dictionary', 'ru.json'), JSON.stringify({
    chat: { 'turn.count': '{n} turns', 'send': 'Send' },
  }))
  writeFileSync(join(workspace, 'strings', 'inventory.json'), JSON.stringify({
    namespaces: { chat: { keys: { 'turn.count': { en: '{n} turns' }, 'send': { en: 'Send' } } } },
  }))
}

const command = (body) => `node -e "${body.replace(/"/gu, '\\"')}"`

console.log('замечаний нет')
prepare()
{
  const result = run(['--provider', 'mock'])
  check('код выхода 0', result.status === 0, result.stderr)
  check('сообщает об отсутствии замечаний', result.stdout.includes('замечаний: 0'))
  const report = readFileSync(join(workspace, 'reports', 'review.md'), 'utf8')
  check('отчёт записан', report.includes('Проверено строк: 2') && report.includes('Замечаний нет'))
}

console.log('замечание найдено')
prepare()
{
  const body = "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const q=JSON.parse(s);process.stdout.write(JSON.stringify(q.payload.map((p,i)=>i===1?{index:i,issue:'лишний перевод служебного имени',suggestion:'Send'}:{index:i,issue:null})))})"
  const result = run(['--provider', 'command', '--command', command(body)])
  check('код выхода 0 без --fail-on-issues', result.status === 0, result.stderr)
  const report = readFileSync(join(workspace, 'reports', 'review.md'), 'utf8')
  check('замечание в отчёте', report.includes('chat/send') && report.includes('лишний перевод служебного имени'))
  check('предложение в отчёте', report.includes('Send'))
  const strict = run(['--provider', 'command', '--command', command(body), '--fail-on-issues'])
  check('--fail-on-issues возвращает 1', strict.status === 1, String(strict.status))
}

console.log('ошибки')
prepare()
{
  const wrongLength = run(['--provider', 'command', '--command', command("process.stdout.write('[]')")])
  check('неверное число вердиктов — ошибка', wrongLength.status !== 0 && wrongLength.stderr.includes('вердиктов'), wrongLength.stderr)
  check('неизвестный провайдер — ошибка', run(['--provider', 'nope']).status !== 0)
  check('openai без ключа — ошибка', run(['--provider', 'openai']).status !== 0)
}

console.log('dry-run')
prepare()
{
  const result = run(['--provider', 'mock', '--dry-run'])
  check('dry-run печатает отчёт', result.status === 0 && result.stdout.includes('Замечаний нет'))
  check('dry-run не пишет отчёт', !existsSync(join(workspace, 'reports', 'review.md')))
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки инструмента вычитки пройдены')
