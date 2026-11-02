#!/usr/bin/env node
/**
 * Tests the voice hook checker: a matching client passes, a changed handler
 * fails with an explanation, and a missing file is reported as skipped.
 *
 * Usage:
 *   node tools/test-check-voice-hook.mjs
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

const tool = join(import.meta.dirname, 'check-voice-hook.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-voice-hook-test-'))
const stock = `const blur = () => {
  if (current.current?.phase === "recording") cancel();
};
const visibility = () => {
  if (document.hidden && current.current && current.current.phase !== "transcribing") cancel();
};
window.addEventListener("blur", blur);
document.addEventListener("visibilitychange", visibility);
`
const run = (file) => spawnSync(process.execPath, [tool, '--file', file], { encoding: 'utf8' })

console.log('совместимый код')
{
  const file = join(workspace, 'ok.js')
  writeFileSync(file, stock)
  const result = run(file)
  check('код 0', result.status === 0, result.stderr)
  check('сообщает совместимость', result.stdout.includes('совместим'))
}

console.log('изменённый обработчик')
{
  const file = join(workspace, 'changed.js')
  writeFileSync(file, stock.replace('if (current.current?.phase === "recording") cancel();', 'cleanup();'))
  const result = run(file)
  check('код 1', result.status === 1, String(result.status))
  check('объясняет причину', result.stderr.includes('cancel') || result.stderr.includes('фазу записи'), result.stderr)
}

console.log('нет файла')
{
  // Пустой корень: в репозитории .app-packages может быть, поэтому изолируемся.
  const emptyRoot = join(workspace, 'empty-root')
  spawnSync('mkdir', ['-p', emptyRoot])
  const result = spawnSync(process.execPath, [tool, '--root', emptyRoot], { encoding: 'utf8' })
  check('пропуск без пакетов', result.status === 0 && result.stdout.includes('пропущена'), result.stdout)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки хука диктовки пройдены')
