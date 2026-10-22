#!/usr/bin/env node
/**
 * Проверяет, что у каждого использования известных функций из `node:fs` есть
 * импорт. Статический анализ ловит опечатки и последствия чистки импортов —
 * ровно такую ошибку однажды пропустил CI, потому что дымовой тест не
 * запускает все инструменты.
 *
 * Usage:
 *   node tools/check-imports.mjs [--dir tools]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option } = createArgs()

const directory = resolve(root, option('dir', 'tools'))
const functions = [
  'readFileSync', 'writeFileSync', 'mkdirSync', 'rmSync', 'readdirSync',
  'statSync', 'existsSync', 'copyFileSync', 'unlinkSync', 'renameSync',
]

/** Собирает .mjs-файлы каталога, включая lib/. */
function collect(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) files.push(...collect(path))
    else if (entry.endsWith('.mjs')) files.push(path)
  }
  return files
}

const problems = []
for (const file of collect(directory)) {
  const source = readFileSync(file, 'utf8')
  const importLine = (source.match(/import \{([^}]*)\} from 'node:fs'/u) ?? [])[1] ?? ''
  const imported = importLine.split(',').map((name) => name.trim()).filter((name) => name.length > 0)
  for (const name of functions) {
    const used = (source.match(new RegExp(`\\b${name}\\(`, 'gu')) ?? []).length
    if (used > 0 && !imported.includes(name)) {
      problems.push(`${file.slice(root.length + 1)}: используется ${name}, но нет импорта`)
    }
  }
}

if (problems.length > 0) {
  console.error('найдены обращения к функциям node:fs без импорта:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('импорты node:fs согласованы')
