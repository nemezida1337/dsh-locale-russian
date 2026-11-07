#!/usr/bin/env node
/**
 * Builds `market/updates.json` from CHANGELOG.md: per-version curated notes for
 * the in-app update notice. Sections are split into «Новое / Исправлено /
 * Безопасность» by simple keywords; critical versions are marked manually in
 * `market/critical.json` or with `[critical]` in the CHANGELOG heading.
 *
 * Usage:
 *   node tools/build-updates.mjs [--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const changelogPath = resolve(root, 'CHANGELOG.md')
const criticalPath = resolve(root, 'market/critical.json')
const outputPath = resolve(root, 'market/updates.json')
const checkOnly = process.argv.includes('--check')

/** Strips the markdown that would only add noise in a compact card. */
function plain(text) {
  return String(text ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/[ \t]+/gu, ' ')
    .trim()
}

// Только явная пометка, иначе описание самой фичи «critical» делает релиз критичным.
const CRITICAL = /\[critical\]/iu
const SECURITY = /(?:SSRF|CSRF|XSS|уязвим|инъекц|поддел|утечк|безопасност[ьи] импорта|security)/iu
const FIX = /(?:исправ|починен|баг|регресс|фикс|fix|ошибк)/iu

const criticalFile = existsSync(criticalPath) ? JSON.parse(readFileSync(criticalPath, 'utf8')) : {}
const criticalVersions = new Set(Array.isArray(criticalFile?.critical) ? criticalFile.critical.map(String) : [])

const lines = readFileSync(changelogPath, 'utf8').split(/\r?\n/u)
const versions = []
let current
for (const line of lines) {
  const heading = /^##\s+(?:\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?)\s*(?:—\s*(.*))?$/u.exec(line.trim())
  if (heading !== null) {
    current = {
      version: heading[1],
      date: heading[2] === undefined ? '' : plain(heading[2]).slice(0, 40),
      critical: criticalVersions.has(heading[1]),
      requiresRestart: true,
      changelogUrl: `https://github.com/nemezida1337/dsh-locale-russian/releases/tag/v${heading[1]}`,
      notes: { ru: { new: [], fixed: [], security: [] } },
    }
    versions.push(current)
    continue
  }
  if (current === undefined) continue
  if (!line.startsWith('- ')) continue
  const text = plain(line.slice(2))
  if (text === '') continue
  if (CRITICAL.test(text)) current.critical = true
  const bucket = SECURITY.test(text) ? 'security' : FIX.test(text) ? 'fixed' : 'new'
  if (current.notes.ru[bucket].length < 8) current.notes.ru[bucket].push(text)
}

const payload = {
  format: 1,
  generatedAt: new Date().toISOString(),
  versions: versions.map((entry) => ({
    ...entry,
    // Пустые секции не нужны клиенту.
    notes: { ru: Object.fromEntries(Object.entries(entry.notes.ru).filter(([, items]) => items.length > 0)) },
  })),
}
const serialized = `${JSON.stringify(payload, null, 2)}\n`
if (checkOnly) {
  let current
  try {
    current = JSON.parse(readFileSync(outputPath, 'utf8'))
  } catch {
    current = undefined
  }
  // generatedAt меняется каждый запуск; сверяем содержимое версий.
  if (current === undefined || current.format !== payload.format || JSON.stringify(current.versions) !== JSON.stringify(payload.versions)) {
    console.error('market/updates.json устарел: запустите npm run updates:build')
    process.exit(1)
  }
  console.log(`обновления согласованы: ${payload.versions.length} версий`)
  process.exit(0)
}
writeFileSync(outputPath, serialized)
console.log(`обновления: ${payload.versions.length} версий → market/updates.json`)
