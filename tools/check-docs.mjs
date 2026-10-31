#!/usr/bin/env node
/**
 * Checks that the documentation matches the repository: version and counts,
 * the compatibility range, the tool and script lists, internal links and
 * anchors, screenshot files, and stale install examples.
 *
 * This catches the class of drift that once left the README describing an old
 * version, an old engine platform list, and a broken link.
 *
 * Usage:
 *   node tools/check-docs.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option } = createArgs()
// `--root` нужен тестам чекера: они собирают временный репозиторий с расхождениями.
const root = resolve(option('root', resolve(here, '..')))
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const readJson = (path) => JSON.parse(read(path))

const manifest = readJson('package.json')
const dictionary = readJson('dictionary/ru.json')
const pluginText = readJson('dictionary/plugin-meta.json')
const totalKeys = Object.values(dictionary).reduce((sum, keys) => sum + Object.keys(keys).length, 0)
const namespaces = Object.keys(dictionary).length
const pluginKeys = Object.keys(pluginText).length

const problems = []
const fail = (message) => problems.push(message)

/** Documents that describe the current state (CHANGELOG is historical). */
const CURRENT_DOCS = ['README.md', 'docs/DEVELOPMENT.md', 'docs/FAQ.md', 'CONTRIBUTING.md', 'market/README.md', 'GLOSSARY.md', 'STYLE.md', 'contrib/plugin-recipe.md']
// Проверяем только существующие документы: тестовый репозиторий содержит не все.
const text = Object.fromEntries(CURRENT_DOCS.filter((file) => existsSync(resolve(root, file))).map((file) => [file, read(file)]))

// --- version, counts and range -------------------------------------------------
const version = manifest.version
const majorMinor = version.split('.').slice(0, 2).join('.')

for (const [file, body] of Object.entries(text)) {
  for (const match of body.matchAll(/dsh-locale-russian"?\s*:\s*"\^(\d+\.\d+\.\d+)"/g)) {
    if (match[1] !== version) fail(`${file}: пример установки ссылается на ${match[1]}, а версия ${version}`)
  }
}

for (const [file, body] of Object.entries(text)) {
  for (const line of body.split('\n')) {
    // Числа другого пакета (в разделе про занятое имя) и метаданные плагинов не проверяем.
    if (/dsh-locale-ru@/.test(line) || /названия и описания|описаний плагинов|строк описаний/i.test(line)) continue
    for (const match of line.matchAll(/\b(\d{3,5})\s+строк/gu)) {
      if (Number(match[1]) !== totalKeys) fail(`${file}: «${match[1]} строк» не совпадает со словарём (${totalKeys})`)
    }
    for (const match of line.matchAll(/\b(\d{1,3})\s+namespace/gu)) {
      if (Number(match[1]) !== namespaces) fail(`${file}: «${match[1]} namespace» не совпадает со словарём (${namespaces})`)
    }
  }
  if (/\b(\d{2,4})\s+строк[а-я]*\s+(описаний|метаданных)/.test(body)) {
    for (const match of body.matchAll(/\b(\d{2,4})\s+строк[а-я]*\s+(?:описаний|метаданных)/g)) {
      if (Number(match[1]) !== pluginKeys) fail(`${file}: «${match[1]} строк описаний» не совпадает с таблицей (${pluginKeys})`)
    }
  }
  for (const match of body.matchAll(/`engines\.dsh`[^.\n]{0,40}`([^`]*\^0[^`]*)`/gu)) {
    if (match[1].trim() !== manifest.engines.dsh) {
      fail(`${file}: диапазон engines.dsh (${match[1].trim()}) не совпадает с манифестом (${manifest.engines.dsh})`)
    }
  }
}

// --- tools and scripts ---------------------------------------------------------
const toolFiles = readdirSync(resolve(root, 'tools'))
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => `tools/${name}`)
const development = text['docs/DEVELOPMENT.md']
for (const tool of toolFiles) {
  const bare = tool.replace(/^tools\//u, '').replace(/\.mjs$/u, '')
  if (!development.includes(tool) && !development.includes(bare)) {
    fail(`docs/DEVELOPMENT.md: инструмент ${tool} не описан`)
  }
}
for (const match of development.matchAll(/tools\/[\w-]+\.mjs/g)) {
  if (!existsSync(resolve(root, match[0]))) fail(`docs/DEVELOPMENT.md: описан несуществующий ${match[0]}`)
}
for (const [file, body] of Object.entries(text)) {
  for (const match of body.matchAll(/npm run ([\w:-]+)/g)) {
    if (manifest.scripts[match[1]] === undefined) fail(`${file}: скрипт npm run ${match[1]} отсутствует`)
  }
}

// --- internal links and anchors ------------------------------------------------
const slug = (heading) => heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
for (const [file, body] of Object.entries(text)) {
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
    const [path, anchor] = target.split('#')
    const targetPath = resolve(root, dirname(file), path)
    if (!existsSync(targetPath)) {
      fail(`${file}: ссылка на несуществующий ${target}`)
      continue
    }
    if (anchor !== undefined && targetPath.endsWith('.md')) {
      const headings = [...readFileSync(targetPath, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map((heading) => slug(heading[1]))
      if (!headings.includes(anchor)) fail(`${file}: якорь ${target} не найден`)
    }
  }
}

// --- screenshots ---------------------------------------------------------------
for (const match of text['README.md'].matchAll(/docs\/screenshots\/[\w-]+\.png/g)) {
  if (!existsSync(resolve(root, match[0]))) fail(`README.md: нет файла ${match[0]}`)
}

if (problems.length > 0) {
  console.error(`расхождений в документации: ${problems.length}`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  process.exit(1)
}
console.log(`документация согласована: версия ${version}, ${totalKeys} строк, ${namespaces} namespace, ${pluginKeys} описаний, ${toolFiles.length} инструментов`)
