/**
 * Desktop-app installation of the language pack.
 *
 * The Electron app owns its profile and the CLI refuses to manage it, so the
 * package is added to `~/.dsh/profiles/desktop` directly: the dependency and the
 * bundle row are written into the profile manifest, pnpm (preferably the copy
 * bundled with the app) installs the package, and the result is verified.
 *
 * Safety rules: every change is backed up first, the manifest is written
 * atomically and re-validated, a failed install restores the backup, and
 * `--dry-run`/`--revert` are available.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Name of the package this installer belongs to. */
export const PACKAGE_NAME = 'dsh-locale-russian'
/** Bundle that receives the default-provider patch; our row goes before it. */
const VOICE_BUNDLE = '@deepseek-ai/dsh-experimental-voice-input-bundle'
/** App-bundled pnpm, relative to the application resources. */
const BUNDLED_PNPM = 'runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs'

/**
 * Reads and validates the profile manifest.
 * @param profileDir - profile directory.
 * @returns the parsed manifest.
 */
function readManifest(profileDir) {
  const path = join(profileDir, 'package.json')
  if (!existsSync(path)) throw new Error(`в профиле нет package.json: ${path}`)
  let manifest
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`package.json профиля не разбирается: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('package.json профиля должен быть объектом')
  }
  return manifest
}

/**
 * Computes the manifest after installation without writing anything.
 * @param manifest - current profile manifest.
 * @param options - package version to pin.
 * @returns the updated manifest and a human-readable list of changes.
 */
export function planInstall(manifest, { version }) {
  const next = JSON.parse(JSON.stringify(manifest))
  next.dependencies = { ...(next.dependencies ?? {}) }
  const spec = `^${version}`
  const changes = []
  if (next.dependencies[PACKAGE_NAME] !== spec) {
    changes.push(`dependencies["${PACKAGE_NAME}"]: ${next.dependencies[PACKAGE_NAME] ?? '—'} → ${spec}`)
    next.dependencies[PACKAGE_NAME] = spec
  }
  next.dsh = next.dsh ?? {}
  next.dsh.profile = next.dsh.profile ?? {}
  const bundles = Array.isArray(next.dsh.profile.bundles) ? [...next.dsh.profile.bundles] : []
  if (!bundles.includes(PACKAGE_NAME)) {
    const voiceIndex = bundles.indexOf(VOICE_BUNDLE)
    // Наш слой патча задаёт провайдера по умолчанию: он должен применяться
    // раньше слоя голосового ввода, иначе настройка не сработает.
    if (voiceIndex === -1) bundles.push(PACKAGE_NAME)
    else bundles.splice(voiceIndex, 0, PACKAGE_NAME)
    changes.push(`bundles: ${PACKAGE_NAME} добавлен${voiceIndex === -1 ? ' в конец' : ` перед ${VOICE_BUNDLE}`}`)
  }
  next.dsh.profile.bundles = bundles
  return { manifest: next, changes }
}

/** Writes a file atomically: a temporary neighbour, then a rename. */
function writeAtomic(path, content) {
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, content)
  renameSync(temporary, path)
}

/** Copies the files this installer may change into a backup directory. */
function backupProfile(profileDir, { now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[:.]/gu, '-')
  const backupDir = join(profileDir, `.dsh-locale-backup-${stamp}`)
  mkdirSync(backupDir, { recursive: true })
  for (const name of ['package.json', 'cordis.patch.yml']) {
    const source = join(profileDir, name)
    if (existsSync(source)) copyFileSync(source, join(backupDir, name))
  }
  return backupDir
}

/** Returns the newest backup directory of this installer, or undefined. */
export function latestBackup(profileDir) {
  if (!existsSync(profileDir)) return undefined
  const dirs = readdirSync(profileDir)
    .filter((name) => name.startsWith('.dsh-locale-backup-'))
    .sort()
  return dirs.length === 0 ? undefined : join(profileDir, dirs[dirs.length - 1])
}

/**
 * Finds pnpm: the app-bundled copy first, then the one on PATH.
 * @param options - explicit app resources directory; when given, only it is checked.
 * @returns the command to run, or undefined.
 */
function findPnpm({ appPath } = {}) {
  const candidates = appPath !== undefined
    ? [join(appPath, BUNDLED_PNPM)]
    : process.platform === 'darwin'
      ? [join('/Applications/DeepSeek Harness.app', 'Contents', 'Resources', BUNDLED_PNPM)]
      : []
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { command: process.execPath, args: [candidate] }
  }
  const onPath = spawnSync('pnpm', ['--version'], { encoding: 'utf8' })
  if (onPath.status === 0) return { command: 'pnpm', args: [] }
  return undefined
}

/** Runs pnpm install in the profile directory. */
function runPnpm(pnpm, profileDir, { dryRun }) {
  if (dryRun) return { status: 0, stdout: '(dry-run)', stderr: '' }
  const result = spawnSync(pnpm.command, [...pnpm.args, 'install', '--no-frozen-lockfile'], {
    cwd: profileDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/**
 * Installs the package into the desktop profile.
 * @param options - profile location, version, pnpm, dry-run and logging.
 * @returns the result with changes, backup and verification.
 */
export function installDesktop({ dshHome, version, dryRun = false, appPath, log = console.log }) {
  const profileDir = join(dshHome, 'profiles', 'desktop')
  if (!existsSync(profileDir)) {
    throw new Error(`профиль приложения не найден: ${profileDir}. Запустите приложение DeepSeek Harness хотя бы раз.`)
  }
  const manifest = readManifest(profileDir)
  const { manifest: next, changes } = planInstall(manifest, { version })
  if (changes.length === 0) {
    return { profileDir, changes, backupDir: undefined, pnpm: undefined, verified: verifyInstalled(profileDir, manifest) }
  }
  for (const change of changes) log(`  ${change}`)
  const pnpm = findPnpm({ appPath })
  if (pnpm === undefined && !dryRun) {
    throw new Error('pnpm не найден: установите pnpm или запустите приложение DeepSeek Harness, чтобы использовался встроенный')
  }
  if (dryRun) return { profileDir, changes, backupDir: undefined, pnpm, verified: false }

  const backupDir = backupProfile(profileDir)
  log(`  резервная копия: ${backupDir}`)
  try {
    writeAtomic(join(profileDir, 'package.json'), `${JSON.stringify(next, null, 2)}\n`)
    // Проверяем, что записанный файл читается и совпадает с задуманным.
    const written = readManifest(profileDir)
    if (JSON.stringify(written) !== JSON.stringify(next)) throw new Error('записанный package.json не совпадает с ожидаемым')
    const install = runPnpm(pnpm, profileDir, { dryRun })
    if (install.status !== 0) {
      throw new Error(`pnpm install завершился с кодом ${install.status}: ${String(install.stderr).slice(-500)}`)
    }
    const verified = verifyInstalled(profileDir, next)
    if (!verified.ok) throw new Error(verified.reason)
    return { profileDir, changes, backupDir, pnpm, verified }
  } catch (error) {
    restoreBackup(profileDir, backupDir)
    throw new Error(`${error instanceof Error ? error.message : String(error)}. Изменения отменены, профиль восстановлен из резервной копии.`)
  }
}

/**
 * Checks that the package is present in node_modules and listed in the bundles.
 * @param profileDir - profile directory.
 * @param manifest - expected manifest.
 * @returns the verification result.
 */
export function verifyInstalled(profileDir, manifest) {
  const installed = join(profileDir, 'node_modules', PACKAGE_NAME, 'package.json')
  if (!existsSync(installed)) return { ok: false, reason: `пакет не установлен: нет ${installed}` }
  const bundles = manifest.dsh?.profile?.bundles ?? []
  if (!bundles.includes(PACKAGE_NAME)) return { ok: false, reason: `в dsh.profile.bundles нет ${PACKAGE_NAME}` }
  let version
  try {
    version = JSON.parse(readFileSync(installed, 'utf8')).version
  } catch {
    return { ok: false, reason: 'package.json установленного пакета не читается' }
  }
  return { ok: true, version }
}

/** Restores the manifest and the patch file from a backup. */
function restoreBackup(profileDir, backupDir) {
  if (backupDir === undefined) return
  for (const name of ['package.json', 'cordis.patch.yml']) {
    const source = join(backupDir, name)
    if (existsSync(source)) copyFileSync(source, join(profileDir, name))
  }
}

/**
 * Reverts the installation: restores the newest backup and removes the package.
 * @param options - profile location, pnpm and logging.
 * @returns the restored backup path.
 */
export function revertDesktop({ dshHome, appPath, log = console.log }) {
  const profileDir = join(dshHome, 'profiles', 'desktop')
  const backupDir = latestBackup(profileDir)
  if (backupDir === undefined) throw new Error('резервных копий нет: откатывать нечего')
  restoreBackup(profileDir, backupDir)
  const pnpm = findPnpm({ appPath })
  if (pnpm !== undefined) {
    const result = runPnpm(pnpm, profileDir, { dryRun: false })
    if (result.status !== 0) log(`  pnpm install завершился с кодом ${result.status}: удалите пакет вручную`)
  }
  rmSync(backupDir, { recursive: true, force: true })
  log(`  профиль восстановлен из ${backupDir}`)
  return backupDir
}

/** Default DSH home. */
export function defaultDshHome() {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.dsh')
}

/** Resolves the app resources directory on macOS. */
export function defaultAppPath() {
  return process.platform === 'darwin' ? '/Applications/DeepSeek Harness.app/Contents/Resources' : undefined
}
