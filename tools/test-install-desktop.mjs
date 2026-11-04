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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  ensureWhisperModel,
  installDesktop,
  installWhisper,
  latestBackup,
  planInstall,
  readProfileEngine,
  removeProfileConfig,
  revertDesktop,
  verifyInstalled,
  writeProfileConfig,
} from '../bin/desktop-install.mjs'

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
function prepare({ pnpmFails = false, pnpmFailsOnce = false } = {}) {
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
if (${pnpmFailsOnce ? 'true' : 'false'}) {
  const marker = path.join(process.cwd(), 'pnpm-failed-once')
  if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); console.error('pnpm: first attempt fails'); process.exit(1) }
}
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
  check('бандл вставлен после голосового ввода', manifest.dsh.profile.bundles.join(',') === `base,${voiceBundle},dsh-locale-russian`)
  check('изменения описаны', changes.length === 2)
  const second = planInstall(manifest, { version: '1.2.3' })
  check('повторный план пуст', second.changes.length === 0)
}

console.log('dry-run')
{
  const { profileDir, appPath } = prepare()
  const before = readFileSync(join(profileDir, 'package.json'), 'utf8')
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', dryRun: true, appPath, log: silent, whisper: false })
  check('изменения запланированы', result.changes.length === 2)
  check('файл не изменён', readFileSync(join(profileDir, 'package.json'), 'utf8') === before)
  check('резервная копия не создана', readdirSync(profileDir).every((name) => !name.startsWith('.dsh-locale-backup-')))
}

console.log('установка')
{
  const { profileDir, appPath } = prepare()
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  const manifest = readProfile(profileDir)
  check('зависимость в манифесте', manifest.dependencies['dsh-locale-russian'] === '^1.2.3')
  check('бандл после голосового ввода', manifest.dsh.profile.bundles.indexOf('dsh-locale-russian') > manifest.dsh.profile.bundles.indexOf(voiceBundle))
  check('пакет установлен', verifyInstalled(profileDir, manifest).ok)
  check('резервная копия создана', result.backupDir !== undefined && existsSync(join(result.backupDir, 'package.json')))
  const backupManifest = JSON.parse(readFileSync(join(result.backupDir, 'package.json'), 'utf8'))
  check('в копии прежний манифест', backupManifest.dependencies['dsh-locale-russian'] === undefined)
  check('чужой плагин сохранён', manifest.dependencies['other-plugin'] === '1.0.0')
  const again = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  check('повторная установка идемпотентна', again.changes.length === 0)
}

console.log('перестановка из старого порядка')
{
  const { profileDir, appPath } = prepare()
  const manifest = readProfile(profileDir)
  manifest.dsh.profile.bundles = ['base', 'dsh-locale-russian', voiceBundle]
  manifest.dependencies['dsh-locale-russian'] = '^1.2.3'
  writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
  const after = readProfile(profileDir)
  check('бандл перемещён после голосового ввода', after.dsh.profile.bundles.indexOf('dsh-locale-russian') > after.dsh.profile.bundles.indexOf(voiceBundle))
  check('перестановка отражена в изменениях', result.changes.some((change) => change.includes('перемещён')), JSON.stringify(result.changes))
}

console.log('сбой установки')
{
  const { profileDir, appPath } = prepare({ pnpmFails: true })
  const before = readFileSync(join(profileDir, 'package.json'), 'utf8')
  let error
  try {
    await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent, retryDelays: [], whisper: false })
  } catch (caught) {
    error = caught
  }
  check('ошибка сообщает об откате', error instanceof Error && error.message.includes('восстановлен'), error?.message)
  check('манифест восстановлен', readFileSync(join(profileDir, 'package.json'), 'utf8') === before)
  check('резервная копия осталась', latestBackup(profileDir) !== undefined)
}

console.log('повтор после сбоя pnpm')
{
  const { profileDir, appPath } = prepare({ pnpmFailsOnce: true })
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent, retryDelays: [10], whisper: false })
  check('установка прошла после повтора', result.verified.ok === true, JSON.stringify(result.verified))
  check('пакет установлен', existsSync(join(profileDir, 'node_modules', 'dsh-locale-russian', 'package.json')))
}

console.log('откат')
{
  const { profileDir, appPath } = prepare()
  const original = readFileSync(join(profileDir, 'package.json'), 'utf8')
  await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent, whisper: false })
  check('после установки манифест другой', readFileSync(join(profileDir, 'package.json'), 'utf8') !== original)
  revertDesktop({ dshHome: workspace, appPath, log: silent })
  check('манифест вернулся к исходному', readFileSync(join(profileDir, 'package.json'), 'utf8') === original)
  check('резервная копия удалена', latestBackup(profileDir) === undefined)
}

console.log('конфиг движка в профиле')
{
  const { profileDir } = prepare()
  const changed = writeProfileConfig(profileDir, {
    engine: 'hybrid',
    merge: 'auto',
    whisperBinaryPath: '/opt/homebrew/bin/whisper-cli',
    whisperModelPath: '/tmp/model.bin',
  })
  check('конфиг записан', changed === true)
  const patch = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
  check('движок hybrid в патче', patch.includes('engine: hybrid') && patch.includes('merge: auto'), patch)
  check('пути Whisper в патче', patch.includes('whisper-cli') && patch.includes('/tmp/model.bin'))
  const again = writeProfileConfig(profileDir, {
    engine: 'hybrid',
    merge: 'auto',
    whisperBinaryPath: '/opt/homebrew/bin/whisper-cli',
    whisperModelPath: '/tmp/model.bin',
  })
  check('повторная запись не дублирует', again === false && (patch.match(/engine: hybrid/gu) ?? []).length === 1, patch)
  const removed = removeProfileConfig(profileDir)
  const after = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
  check('конфиг удалён', removed === true && !after.includes('engine: hybrid'), after)
}

console.log('модель Whisper: скачивание')
{
  const { profileDir } = prepare()
  const modelPath = join(workspace, 'whisper-model.bin')
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: () => '10' },
    body: (async function* () { yield Buffer.from('0123456789') })(),
  })
  const downloaded = await ensureWhisperModel({ dshHome: workspace, modelPath, minBytes: 5, fetchImpl: fakeFetch })
  check('модель скачана', downloaded.downloaded === true && readFileSync(modelPath, 'utf8') === '0123456789')
  const cached = await ensureWhisperModel({ dshHome: workspace, modelPath, minBytes: 5 })
  check('повторно не скачивается', cached.downloaded === false)
  const dry = await ensureWhisperModel({ dshHome: workspace, modelPath: join(workspace, 'new-model.bin'), minBytes: 5, dryRun: true })
  check('dry-run не скачивает', dry.dryRun === true && !existsSync(join(workspace, 'new-model.bin')))
  void profileDir
}

console.log('вложенный Whisper: копируется без Homebrew')
{
  prepare()
  const vendorRoot = join(workspace, 'vendor-whisper')
  const arch = 'arm64'
  mkdirSync(join(vendorRoot, arch), { recursive: true })
  writeFileSync(join(vendorRoot, arch, 'whisper-cli'), '#!/bin/sh\necho fake\n')
  writeFileSync(join(vendorRoot, arch, 'libfake.dylib'), 'fake')
  const modelPath = join(workspace, 'vendor-model.bin')
  writeFileSync(modelPath, 'model')
  const result = await installWhisper({ dshHome: workspace, vendorRoot, arch, modelPath, minBytes: 1, log: silent })
  const target = join(workspace, 'speech-ru', 'whisper', 'bin', 'whisper-cli')
  check('prebuilt скопирован', result.binary === target && existsSync(target))
  check('модель на месте', result.modelPath === modelPath && existsSync(modelPath))
  const fallback = await installWhisper({ dshHome: workspace, vendorRoot: join(workspace, 'нет-vendor'), installBinary: false, searchSystem: false, modelPath, minBytes: 1, log: silent })
  check('без vendor и brew — binary нет', fallback.binary === undefined)
}

console.log('installDesktop пишет конфиг движка')
{
  const { profileDir, appPath } = prepare()
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent, whisper: false, engine: 'gigaam', merge: 'auto' })
  check('движок gigaam в результате', result.engine === 'gigaam', JSON.stringify(result.engine))
  const patch = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
  check('конфиг записан установщиком', patch.includes('engine: gigaam') && patch.includes('merge: auto'), patch)
}

console.log('нет профиля')
{
  rmSync(workspace, { recursive: true, force: true })
  let error
  try {
    await installDesktop({ dshHome: workspace, version: '1.2.3', log: silent, whisper: false })
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
  const result = await installDesktop({ dshHome: workspace, version: '1.2.3', appPath, log: silent })
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
    await installDesktop({ dshHome: workspace, version: '1.2.3', appPath: join(workspace, 'no-app'), log: silent, whisper: false })
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
console.log('P0: дефолты установщика и пакет')
{
  const here = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))
  check('vendor в files пакета', Array.isArray(pkg.files) && pkg.files.includes('vendor'), JSON.stringify(pkg.files))
  const build = readFileSync(join(here, 'build-package.mjs'), 'utf8')
  check('vendor в build-package', /files:\s*\[[^\]]*'vendor'/su.test(build))
  check('whisper-server в vendor', existsSync(join(here, '..', 'vendor', 'whisper', 'arm64', 'whisper-server')))
  // dry-run без Whisper → gigaam, а не hybrid.
  const home = mkdtempSync(join(tmpdir(), 'dsh-install-auto-'))
  mkdirSync(join(home, 'profiles', 'desktop'), { recursive: true })
  writeFileSync(join(home, 'profiles', 'desktop', 'package.json'), JSON.stringify({ name: 'p', private: true, dependencies: {}, dsh: { profile: { bundles: [voiceBundle] } } }))
  writeFileSync(join(home, 'profiles', 'desktop', 'cordis.patch.yml'), '- id: test\n')
  const dry = await installDesktop({ dshHome: home, version: '1.2.3', dryRun: true, appPath: join(home, 'fake-app'), log: silent, whisper: false })
  check('dry-run без Whisper: gigaam', dry.engine === 'gigaam', JSON.stringify(dry.engine))
  rmSync(home, { recursive: true, force: true })
  // Повторная установка сохраняет выбранный движок.
  const home2 = mkdtempSync(join(tmpdir(), 'dsh-install-keep-'))
  mkdirSync(join(home2, 'profiles', 'desktop'), { recursive: true })
  writeFileSync(join(home2, 'profiles', 'desktop', 'cordis.patch.yml'), '- id: test\n')
  writeProfileConfig(join(home2, 'profiles', 'desktop'), { engine: 'auto', merge: 'sentences', debugTranscripts: true })
  check('движок читается из профиля', readProfileEngine(join(home2, 'profiles', 'desktop')) === 'auto')
  rmSync(home2, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки установщика для приложения пройдены')
