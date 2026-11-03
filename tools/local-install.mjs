#!/usr/bin/env node
/**
 * Installs the locally built package into the desktop profile for testing
 * without publishing a release. Keeps a backup and supports --revert.
 *
 * Usage:
 *   node tools/local-install.mjs            # поставить сборку из репозитория
 *   node tools/local-install.mjs --revert   # вернуть предыдущую копию
 */
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const revert = args.includes('--revert')
const dshHome = args.includes('--dsh-home') ? args[args.indexOf('--dsh-home') + 1] : join(homedir(), '.dsh')
const target = join(dshHome, 'profiles', 'desktop', 'node_modules', 'dsh-locale-russian')
const profileDir = dirname(dirname(target))
if (!existsSync(profileDir)) {
  console.error(`профиль не найден: ${profileDir}`)
  process.exit(1)
}

/** Finds the newest local backup next to the target. */
function latestBackup() {
  const parent = dirname(target)
  if (!existsSync(parent)) return undefined
  const backups = readdirSync(parent)
    .filter((name) => name.startsWith('.dsh-locale-local-backup-'))
    .sort()
  return backups.length === 0 ? undefined : join(parent, backups[backups.length - 1])
}

if (revert) {
  const backup = latestBackup()
  if (backup === undefined) {
    console.error('нет локального бэкапа для отката')
    process.exit(1)
  }
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  renameSync(backup, target)
  console.log(`откат выполнен из ${backup}`)
  process.exit(0)
}

if (!existsSync(join(root, 'lib', 'client.js')) || !existsSync(join(root, 'lib', 'index.js'))) {
  console.error('сборка не найдена: сначала запустите node tools/build-package.mjs')
  process.exit(1)
}
const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
const backup = join(dirname(target), `.dsh-locale-local-backup-${stamp}`)
if (existsSync(target)) {
  renameSync(target, backup)
  console.log(`бэкап: ${backup}`)
} else {
  mkdirSync(target, { recursive: true })
}
for (const entry of ['package.json', 'lib', 'locale', 'cordis.patch.yml', 'dictionary', 'icon.svg', 'bin', 'vendor']) {
  const source = join(root, entry)
  if (!existsSync(source)) continue
  cpSync(source, join(target, entry), { recursive: true })
}
console.log(`локальная сборка установлена: ${target}`)
console.log('перезапустите приложение; откат: node tools/local-install.mjs --revert')
