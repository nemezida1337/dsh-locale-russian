#!/usr/bin/env node
/**
 * Tests the discussions report: comments are rendered with authors and links,
 * and an answer without comments exits with the "nothing to report" code.
 *
 * Usage:
 *   node tools/test-discussion-report.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

const tool = join(import.meta.dirname, 'discussion-report.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-discussions-test-'))
const run = (answer) => {
  const path = join(workspace, 'answer.json')
  writeFileSync(path, JSON.stringify(answer))
  return spawnSync(process.execPath, [tool, '--input', path], { encoding: 'utf8' })
}

const base = (comments) => ({
  data: {
    repository: {
      discussions: {
        nodes: [{ number: 10146, title: 'Russian localization', url: 'https://example/10146', comments: { nodes: comments } }],
      },
    },
  },
})

console.log('комментарии есть')
{
  const result = run(base([
    { author: { login: 'someone' }, body: 'Looks great, thanks!', createdAt: '2026-10-30T10:00:00Z' },
    { author: { login: 'nemezida1337' }, body: 'Thanks!', createdAt: '2026-10-30T11:00:00Z' },
  ]))
  check('код выхода 0', result.status === 0, result.stderr)
  check('ссылка на обсуждение', result.stdout.includes('https://example/10146'))
  check('автор комментария', result.stdout.includes('@someone'))
  check('наш комментарий помечен', result.stdout.includes('(наш)'))
  check('текст комментария', result.stdout.includes('Looks great'))
}

console.log('комментариев нет')
{
  const result = run(base([]))
  check('код выхода 10 (нечего сообщать)', result.status === 10, String(result.status))
  check('отчёт не печатается', result.stdout.trim() === '')
}

console.log('битый ответ')
{
  const result = run({ data: { repository: { discussions: { nodes: [] } } } })
  check('пустой ответ — ошибка', result.status === 2, String(result.status))
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки отчёта по обсуждениям пройдены')
