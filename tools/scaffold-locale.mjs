#!/usr/bin/env node
/**
 * Creates a new language pack from `contrib/locale-template`, substituting the
 * language id, label, fallback and package name everywhere they appear.
 *
 * Usage:
 *   node tools/scaffold-locale.mjs --id de --label Deutsch \
 *     --package dsh-locale-german [--fallback en] [--out ../dsh-locale-german] [--force]
 */
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option, flag } = createArgs()

const templateDir = resolve(root, 'contrib/locale-template')

/** Text files the placeholders are substituted in. */
const TEXT_FILES = /\.(js|json|yml|md|mjs)$/u

/**
 * Validates the scaffold arguments.
 * @returns the substituted values.
 */
function readOptions() {
  const id = option('id', '')
  const label = option('label', '')
  const packageName = option('package', '')
  const fallback = option('fallback', 'en')
  if (!/^[a-z]{2,3}(-[a-z0-9]+)*$/u.test(id)) throw new Error('--id должен быть тегом языка: de, pt-br, zh-cn')
  if (label.trim().length === 0) throw new Error('--label обязателен: «Deutsch»')
  if (!/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/u.test(packageName)) throw new Error('--package должен быть именем npm-пакета')
  if (id === fallback) throw new Error('--fallback не может совпадать с --id')
  return { id, label: label.trim(), packageName, fallback }
}

/** Copies the template and replaces the placeholders in text files. */
function scaffold({ id, label, packageName, fallback }, outDir) {
  cpSync(templateDir, outDir, { recursive: true })
  const renameLocale = join(outDir, 'locale', '__LANG_ID__.json')
  if (existsSync(renameLocale)) renameSync(renameLocale, join(outDir, 'locale', `${id}.json`))

  const replacements = [
    ['__PACKAGE_NAME__', packageName],
    ['__LANG_ID__', id],
    ['__LANG_LABEL__', label],
    ['__FALLBACK__', fallback],
  ]
  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!TEXT_FILES.test(entry)) continue
      let text = readFileSync(path, 'utf8')
      for (const [placeholder, value] of replacements) text = text.split(placeholder).join(value)
      writeFileSync(path, text)
    }
  }
  walk(outDir)
}

/** Entry point: validate, scaffold, report. */
function main() {
  const values = readOptions()
  const outDir = resolve(root, option('out', join('..', values.packageName)))
  if (existsSync(outDir) && !flag('force')) {
    throw new Error(`каталог уже существует: ${outDir} (добавьте --force, чтобы перезаписать)`)
  }
  scaffold(values, outDir)
  console.log(`языковой пакет создан: ${outDir}`)
  console.log('')
  console.log('дальше:')
  console.log(`  cd ${outDir}`)
  console.log('  node test.mjs                       # самотест пакета')
  console.log('  dsh plugin --profile web add "$PWD" # установка в профиль')
  console.log('')
  console.log('строки для перевода: в репозитории dsh-locale-russian запустите npm run refresh и npm run translate,')
  console.log('затем перенесите переводы в DICTIONARIES/PLUGIN_TEXT в lib/client.js.')
}

try {
  main()
} catch (error) {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
