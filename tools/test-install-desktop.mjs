#!/usr/bin/env node
/**
 * Tests the desktop-app installer: the manifest plan, dry-run, a successful
 * install with a stand-in pnpm, a failed install that restores the backup,
 * idempotency, revert, and the missing-profile error.
 *
 * Usage:
 *   node tools/test-install-desktop.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { installDesktop, latestBackup, planInstall, revertDesktop, verifyInstalled } from '../bin/desktop-install.mjs'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const workspace = mkdtempSync(join(tmpdir(), 'dsh-desktop-test-'))
const voiceBundle = '@deepseek-ai/dsh-experimental-voice-input-bundle'

/** Builds a fake DSH home with a desktop profile and a fake pnpm. */
function prepare({ pnpmFails = false } = {}) {
  rmSync(workspace, { recursive: true, force: true })
  const profileDir = join(workspace, 'profiles', 'desktop')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify({
    name: 'dsh-profile-desktop',
    private: true,
    dependencies: { 'other-plugin': '1.0.0' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', voiceBundle] } },
  }, null, 2)}\n`)
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '- id: test\n')
  const pnpmDir = join(workspace, 'fake-app', 'runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin')
  mkdirSync(pnpmDir, { recursive: true })
  writeFileSync(join(pnpmDir, 'pnpm.cjs'), `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const version = ${JSON.stringify(pnpmFails ? 'fail' : '1.2.3')}
if (version === 'fail') { console.error('pnpm: simulated failure'); process.exit(1) }
const target = path.join(process.cwd(), 'node_modules', 'dsh-locale-russian')
fs.mkdirSync(target, { recursive: true })
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'dsh-locale-russian', version: '1.2.3' }))
`)
  return { profileDir, appPath: join(workspace, 'fake-app') }
}

const readProfile = (profileDir) => JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const silent = () => {}

console.log('план изменений')
{
  const { manifest, changes } = planInstall({ dependencies: {}, dsh: { profile: { bundles: ['base', voiceBundle] } } }, { version: '1.2.3' })
  check('зависимость добавлена', manifest.dependencies['dsh-locale-russian'] === '^1.2.3')
  check('бандл вставлен перед голосовым вводом', manifest.dsh.profile.bundles.join(',') === `base,dsh-locale-russian,${voiceBundle}`)
  check('изменения описаны', changes.length === 2)
  const second = planInstall(manifest, { version: '1.2.3' })
  check('повторный план пуст', second.changes.length === 0)
}

console.log('dry-run')
{
  const { profileDir, appPath } = prepare()
  const before = readFileSync(join(profileDir, 'package.json'), 'utf8')
  const result = installDesktop({ dshHome: workspace, version: '1.2.3', dryRun: true, appPath, log: silent })
  check('изменения запланированы', result.changes.length === 2)
  check('файл не изменён', readFileSync(join(profileDir, 'package.json'), 'utf8') === before)
  check('резервная копия не создана', readdirSync(profileDir).every((name) => !name.startsWith('.dsh-locale-backup-')))
}

console.log('установка')
{
  const { profileDir, appPath } = prepare()
  const result = installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  const manifest = readProfile(profileDir)
  check('зависимость в манифесте', manifest.dependencies['dsh-locale-russian'] === '^1.2.3')
  check('бандл перед голосовым вводом', manifest.dsh.profile.bundles.indexOf('dsh-locale-russian') < manifest.dsh.profile.bundles.indexOf(voiceBundle))
  check('пакет установлен', verifyInstalled(profileDir, manifest).ok)
  check('резервная копия создана', result.backupDir !== undefined && existsSync(join(result.backupDir, 'package.json')))
  const backupManifest = JSON.parse(readFileSync(join(result.backupDir, 'package.json'), 'utf8'))
  check('в копии прежний манифест', backupManifest.dependencies['dsh-locale-russian'] === undefined)
  check('чужой плагин сохранён', manifest.dependencies['other-plugin'] === '1.0.0')
  const again = installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  check('повторная установка идемпотентна', again.changes.length === 0)
}

console.log('сбой установки')
{
  const { profileDir, appPath } = prepare({ pnpmFails: true })
  const before = readFileSync(join(profileDir, 'package.json'), 'utf8')
  let error
  try {
    installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  } catch (caught) {
    error = caught
  }
  check('ошибка сообщает об откате', error instanceof Error && error.message.includes('восстановлен'), error?.message)
  check('манифест восстановлен', readFileSync(join(profileDir, 'package.json'), 'utf8') === before)
  check('резервная копия осталась', latestBackup(profileDir) !== undefined)
}

console.log('откат')
{
  const { profileDir, appPath } = prepare()
  const original = readFileSync(join(profileDir, 'package.json'), 'utf8')
  installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  check('после установки манифест другой', readFileSync(join(profileDir, 'package.json'), 'utf8') !== original)
  revertDesktop({ dshHome: workspace, appPath, log: silent })
  check('манифест вернулся к исходному', readFileSync(join(profileDir, 'package.json'), 'utf8') === original)
  check('резервная копия удалена', latestBackup(profileDir) === undefined)
}

console.log('нет профиля')
{
  rmSync(workspace, { recursive: true, force: true })
  let error
  try {
    installDesktop({ dshHome: workspace, version: '1.2.3', log: silent })
  } catch (caught) {
    error = caught
  }
  check('понятная ошибка', error instanceof Error && error.message.includes('профиль приложения не найден'), error?.message)
}

console.log('CLI')
{
  prepare()
  const cli = spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--desktop', '--dry-run', '--profile', workspace], { encoding: 'utf8', cwd: join(import.meta.dirname, '..') })
  check('код 0', cli.status === 0, cli.stderr)
  check('сообщает про dry-run', cli.stdout.includes('Dry-run'))
  const help = spawnSync(process.execPath, ['bin/dsh-locale-russian-install.mjs', '--help'], { encoding: 'utf8', cwd: join(import.meta.dirname, '..') })
  check('--help описывает режимы', help.stdout.includes('--desktop') && help.stdout.includes('--revert'))
}

console.log('манифест без dsh и dependencies')
{
  const { profileDir, appPath } = prepare()
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop' }, null, 2))
  const result = installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  const manifest = readProfile(profileDir)
  check('dependencies созданы', manifest.dependencies['dsh-locale-russian'] === '^1.2.3')
  check('dsh.profile создан', Array.isArray(manifest.dsh?.profile?.bundles) && manifest.dsh.profile.bundles.includes('dsh-locale-russian'))
  check('установка подтверждена', result.verified.ok)
}

console.log('нет pnpm')
{
  const { profileDir } = prepare()
  const pathBackup = process.env.PATH
  process.env.PATH = join(workspace, 'empty-path')
  let error
  try {
    installDesktop({ dshHome: workspace, version: '1.2.3', appPath: join(workspace, 'no-app'), log: silent })
  } catch (caught) {
    error = caught
  } finally {
    process.env.PATH = pathBackup
  }
  check('понятная ошибка про pnpm', error instanceof Error && error.message.includes('pnpm не найден'), error?.message)
  check('профиль не изменён', JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')).dependencies['dsh-locale-russian'] === undefined)
}

console.log('откат без копий')
{
  const { profileDir } = prepare()
  let error
  try {
    revertDesktop({ dshHome: workspace, appPath: join(workspace, 'fake-app'), log: silent })
  } catch (caught) {
    error = caught
  }
  check('сообщает, что откатывать нечего', error instanceof Error && error.message.includes('резервных копий нет'), error?.message)
  check('профиль не тронут', existsSync(join(profileDir, 'package.json')))
}

rmSync(workspace, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки установщика для приложения пройдены')
