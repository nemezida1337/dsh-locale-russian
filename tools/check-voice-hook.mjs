#!/usr/bin/env node
/**
 * Checks that the stock voice-input client still cancels the capture on blur and
 * on a hidden page, and that our keep-alive heuristic would recognise those two
 * listeners. If DSH changes that code, the patch silently stops working, so this
 * check fails the build instead.
 *
 * Usage:
 *   node tools/check-voice-hook.mjs [--packages <dir>] [--file <client.js>]
 *
 * Without a file or package directory it prints a skip note: CI runs it in the
 * app job, where the application packages are extracted.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option } = createArgs()
// `--root` нужен тестам: они проверяют и случай без пакетов приложения.
const root = resolve(option('root', resolve(here, '..')))

/** Locates the voice input client file. */
function findClient() {
  const explicit = option('file')
  if (explicit !== undefined) return resolve(root, explicit)
  const packages = option('packages')
  const candidates = [
    packages === undefined ? undefined : join(resolve(root, packages), 'dsh-experimental-client-ui-voice-input', 'lib', 'client.js'),
    join(root, '.app-packages', 'dsh-experimental-client-ui-voice-input', 'lib', 'client.js'),
  ].filter((candidate) => candidate !== undefined)
  return candidates.find((candidate) => existsSync(candidate))
}

const path = findClient()
if (path === undefined) {
  console.log('проверка хука диктовки пропущена: пакеты приложения не найдены (запускается в job app-drift)')
  process.exit(0)
}

const source = readFileSync(path, 'utf8')
const problems = []

/** Extracts a listener body by its declaration prefix. */
function bodyOf(prefix) {
  const start = source.indexOf(prefix)
  if (start === -1) return undefined
  const open = source.indexOf('{', start)
  if (open === -1) return undefined
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, index + 1)
    }
  }
  return undefined
}

// Наш патч узнаёт обработчики по источнику: в нём есть cancel и фаза записи.
const checks = [
  { name: 'blur', prefix: 'const blur = () =>', marker: 'addEventListener("blur"' },
  { name: 'visibilitychange', prefix: 'const visibility = () =>', marker: 'addEventListener("visibilitychange"' },
]
for (const check of checks) {
  const body = bodyOf(check.prefix)
  if (body === undefined) {
    problems.push(`не найден обработчик ${check.name} (${check.prefix}) — возможно, DSH изменил код отмены`)
    continue
  }
  if (!body.includes('cancel')) problems.push(`обработчик ${check.name} больше не вызывает cancel`)
  if (!body.includes('recording') && !body.includes('transcribing')) {
    problems.push(`обработчик ${check.name} не упоминает фазу записи — наш патч его не узнает`)
  }
  if (!source.includes(check.marker)) problems.push(`обработчик ${check.name} больше не подписывается на ${check.name}`)
}

if (problems.length > 0) {
  console.error(`хук диктовки изменился (${path}):`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error('Обновите installVoiceKeepAlive в tools/templates/client-bundle.js под новый код DSH.')
  process.exit(1)
}
console.log(`хук диктовки совместим: ${path.replace(`${root}/`, '')}`)
