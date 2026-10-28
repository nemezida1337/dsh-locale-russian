#!/usr/bin/env node
/**
 * Tests the language-pack scaffolder: generates a pack into a temporary
 * directory, checks the substituted files, and runs the generated pack's own
 * self-test. Also covers the argument validation.
 *
 * Usage:
 *   node tools/test-scaffold.mjs
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
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

const tool = join(import.meta.dirname, 'scaffold-locale.mjs')
const workspace = mkdtempSync(join(tmpdir(), 'dsh-scaffold-test-'))
const run = (args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' })

const outDir = join(workspace, 'dsh-locale-german')
const result = run(['--id', 'de', '--label', 'Deutsch', '--package', 'dsh-locale-german', '--out', outDir])
check('генерация прошла', result.status === 0, result.stderr)
check('каталог создан', existsSync(outDir))

const expectedFiles = ['package.json', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'locale/de.json', 'locale/en.json', 'README.md', 'test.mjs', 'icon.svg']
for (const file of expectedFiles) check(`файл ${file}`, existsSync(join(outDir, file)))

const manifest = JSON.parse(readFileSync(join(outDir, 'package.json'), 'utf8'))
check('имя пакета подставлено', manifest.name === 'dsh-locale-german', manifest.name)
check('язык в манифесте', manifest.dsh?.language?.id === 'de' && manifest.dsh?.language?.label === 'Deutsch', JSON.stringify(manifest.dsh?.language))
check('bundle и client объявлены', manifest.dsh?.bundle?.patch === './cordis.patch.yml' && manifest.dsh?.client?.platform === 'web')

const patch = readFileSync(join(outDir, 'cordis.patch.yml'), 'utf8')
check('строка патча с нужным id', patch.includes('id: locale-de') && patch.includes('name: dsh-locale-german'), patch)

const client = readFileSync(join(outDir, 'lib/client.js'), 'utf8')
check('id модуля равен имени пакета', client.includes('id: "dsh-locale-german"'))
check('язык в бандле', client.includes('id: "de"') && client.includes('label: "Deutsch"'))

const leftovers = []
const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      walk(path)
      continue
    }
    const text = readFileSync(path, 'utf8')
    if (/__(PACKAGE_NAME|LANG_ID|LANG_LABEL|FALLBACK)__/u.test(text)) leftovers.push(path)
  }
}
walk(outDir)
check('незаполненных плейсхолдеров нет', leftovers.length === 0, leftovers.join(', '))

const selfTest = spawnSync(process.execPath, ['test.mjs'], { cwd: outDir, encoding: 'utf8' })
check('самотест сгенерированного пакета проходит', selfTest.status === 0, selfTest.stderr || selfTest.stdout)

const syntax = spawnSync(process.execPath, ['--check', 'lib/client.js'], { cwd: outDir, encoding: 'utf8' })
check('бандл синтаксически корректен', syntax.status === 0, syntax.stderr)

console.log('проверка аргументов')
check('некорректный id отклоняется', run(['--id', 'DE', '--label', 'X', '--package', 'p', '--out', join(workspace, 'a')]).status !== 0)
check('пустой label отклоняется', run(['--id', 'de', '--label', '', '--package', 'p', '--out', join(workspace, 'b')]).status !== 0)
check('некорректный пакет отклоняется', run(['--id', 'de', '--label', 'X', '--package', 'Плохой пакет', '--out', join(workspace, 'c')]).status !== 0)
check('существующий каталог без --force отклоняется', run(['--id', 'de', '--label', 'Deutsch', '--package', 'dsh-locale-german', '--out', outDir]).status !== 0)
{
  const again = run(['--id', 'de', '--label', 'Deutsch', '--package', 'dsh-locale-german', '--out', outDir, '--force'])
  check('--force перезаписывает', again.status === 0, again.stderr)
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки генератора языковых паков пройдены')
