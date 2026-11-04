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
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    // Наш слой патча задаёт провайдера по умолчанию и лимит диктовки, поэтому
    // он должен применяться ПОСЛЕ слоя голосового ввода.
    if (voiceIndex === -1) bundles.push(PACKAGE_NAME)
    else bundles.splice(voiceIndex + 1, 0, PACKAGE_NAME)
    changes.push(`bundles: ${PACKAGE_NAME} добавлен${voiceIndex === -1 ? ' в конец' : ` после ${VOICE_BUNDLE}`}`)
  } else {
    // Уже установленный пакет мог оказаться раньше голосового ввода: тогда
    // патчи конфигурации не применяются. Переставляем.
    const voiceIndex = bundles.indexOf(VOICE_BUNDLE)
    const ownIndex = bundles.indexOf(PACKAGE_NAME)
    if (voiceIndex !== -1 && ownIndex < voiceIndex) {
      bundles.splice(ownIndex, 1)
      bundles.splice(bundles.indexOf(VOICE_BUNDLE) + 1, 0, PACKAGE_NAME)
      changes.push(`bundles: ${PACKAGE_NAME} перемещён после ${VOICE_BUNDLE}, чтобы применились патчи конфигурации`)
    }
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

/** Blocks the process for the given time without external commands (cross-platform). */
function sleepSync(ms) {
  spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`])
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

/** Whisper model used by the hybrid engine. */
export const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin'
/** Default model location inside the DSH home. */
export const whisperModelPath = (dshHome) => join(dshHome, 'speech-ru', 'whisper', 'ggml-large-v3-turbo-q5_0.bin')

/** Finds the whisper-cli binary: explicit env, Homebrew prefixes, then PATH. */
export function findWhisperBinary({ env = process.env } = {}) {
  if (typeof env.WHISPER_CLI === 'string' && env.WHISPER_CLI.length > 0 && existsSync(env.WHISPER_CLI)) return env.WHISPER_CLI
  for (const candidate of ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli']) {
    if (existsSync(candidate)) return candidate
  }
  const found = spawnSync('which', ['whisper-cli'], { encoding: 'utf8' })
  if (found.status === 0 && found.stdout.trim().length > 0) return found.stdout.trim()
  return undefined
}

/**
 * Downloads a file with progress logging, writing atomically through a temp file.
 * @param url - source URL.
 * @param target - destination path.
 * @param options - log, minimum accepted size.
 * @returns the written path.
 */
export async function downloadFile(url, target, { log = console.log, minBytes = 0, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} при скачивании ${url}`)
  const total = Number(response.headers.get('content-length') ?? 0)
  mkdirSync(dirname(target), { recursive: true })
  const temp = `${target}.download-${process.pid}`
  const chunks = []
  let received = 0
  let lastPercent = -10
  if (response.body !== undefined && typeof response.body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of response.body) {
      chunks.push(Buffer.from(chunk))
      received += chunk.length
      if (total > 0) {
        const percent = Math.floor((received / total) * 100)
        if (percent >= lastPercent + 10) {
          lastPercent = percent
          log(`  модель: ${percent}% (${(received / 1048576).toFixed(0)} из ${(total / 1048576).toFixed(0)} МБ)`)
        }
      }
    }
  } else {
    chunks.push(Buffer.from(await response.arrayBuffer()))
    received = chunks[0].length
  }
  const data = Buffer.concat(chunks)
  if (data.length < minBytes) throw new Error(`скачано слишком мало: ${data.length} байт`)
  writeFileSync(temp, data)
  renameSync(temp, target)
  return target
}

/**
 * Ensures the Whisper model is present, downloading it when missing.
 * @param options - dshHome, log, dryRun, modelPath, minBytes, fetchImpl.
 * @returns the model path and whether it was downloaded.
 */
export async function ensureWhisperModel({ dshHome, log = console.log, dryRun = false, modelPath, minBytes = 100 * 1024 * 1024, fetchImpl = fetch } = {}) {
  const target = modelPath ?? whisperModelPath(dshHome)
  if (existsSync(target)) {
    const size = statSync(target).size
    if (size >= minBytes) return { path: target, downloaded: false }
  }
  if (dryRun) {
    log(`  модель Whisper: будет скачана → ${target}`)
    return { path: target, downloaded: true, dryRun: true }
  }
  log(`  скачиваю модель Whisper (~574 МБ) → ${target}`)
  await downloadFile(WHISPER_MODEL_URL, target, { log, minBytes, fetchImpl })
  return { path: target, downloaded: true }
}

/**
 * Installs Whisper: the binary (via Homebrew when missing) and the model.
 * @param options - dshHome, log, dryRun, installBinary, modelPath.
 * @returns the binary and model paths.
 */
export async function installWhisper({ dshHome, log = console.log, dryRun = false, installBinary = true, modelPath, minBytes = 100 * 1024 * 1024, vendorRoot = VENDOR_WHISPER_ROOT, arch = process.arch, searchSystem = true } = {}) {
  let binary
  // Сначала вложенный prebuilt: не требует Homebrew и интернета.
  const vendorDir = join(vendorRoot, arch)
  const vendorBinary = join(vendorDir, 'whisper-cli')
  if (existsSync(vendorBinary)) {
    const targetDir = join(dshHome, 'speech-ru', 'whisper', 'bin')
    if (!dryRun) {
      rmSync(targetDir, { recursive: true, force: true })
      mkdirSync(targetDir, { recursive: true })
      cpSync(vendorDir, targetDir, { recursive: true })
      for (const name of readdirSync(targetDir)) chmodSync(join(targetDir, name), 0o755)
    }
    binary = join(targetDir, 'whisper-cli')
    log(`  whisper-cli: вложенный prebuilt (${arch})`)
  } else if (searchSystem) {
    binary = findWhisperBinary()
  }
  if (binary === undefined && installBinary && !dryRun) {
    const brew = spawnSync('brew', ['--version'], { encoding: 'utf8' })
    if (brew.status === 0) {
      log('  whisper-cli не найден — ставлю через Homebrew (brew install whisper-cpp)')
      const result = spawnSync('brew', ['install', 'whisper-cpp'], { stdio: 'inherit' })
      if (result.status !== 0) log('  Homebrew не смог поставить whisper-cpp — работаем на GigaAM')
      binary = findWhisperBinary()
    } else {
      log('  whisper-cli не найден и Homebrew нет — работаем на GigaAM')
    }
  }
  const model = await ensureWhisperModel({ dshHome, log, dryRun, modelPath, minBytes })
  return { binary, modelPath: model.path }
}

/** Root of the vendored whisper-cli bundles shipped with the package. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const VENDOR_WHISPER_ROOT = join(PACKAGE_ROOT, 'vendor', 'whisper')

/** Marker of the dictionary engine block in the profile patch. */
const ENGINE_BLOCK_MARKER = '# Гибрид GigaAM + Whisper'

/** Removes the engine configuration block from the patch lines. */
function removeEngineBlock(lines) {
  const result = []
  let skipping = false
  for (const line of lines) {
    if (line.startsWith('- id: locale-ru')) {
      // Убираем и комментарий-маркер прямо перед строкой.
      while (result.length > 0) {
        const previous = result[result.length - 1].trim()
        if (previous === '' || previous.startsWith(ENGINE_BLOCK_MARKER) || previous.startsWith('# Движок:')) result.pop()
        else break
      }
      skipping = true
      continue
    }
    if (skipping) {
      if (line.startsWith('  ') || line.trim() === '') continue
      skipping = false
    }
    result.push(line)
  }
  return result
}

/** Strips newlines/CR so config values cannot inject extra YAML keys. */
function sanitizeConfigValue(value) {
  return String(value ?? '').replace(/[\r\n]+/gu, ' ').trim()
}

/** Raw lines of config keys the installer does not manage (nested lists too). */
function readProfileExtraLines(profileDir) {
  try {
    const text = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
    const block = text.match(/- id: locale-ru[\s\S]*?(?=\n- id:|\s*$)/u)
    if (block === null) return []
    const lines = block[0].split('\n')
    const extras = []
    const managed = new Set(['engine', 'merge', 'debugTranscripts', 'whisperBinaryPath', 'whisperServerPath', 'whisperModelPath'])
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^    ([A-Za-z][\w-]*):/u)
      if (match === null || managed.has(match[1])) continue
      extras.push(lines[index])
      let nested = index + 1
      while (nested < lines.length && /^\s{6,}\S/u.test(lines[nested])) {
        extras.push(lines[nested])
        nested += 1
      }
      index = nested - 1
    }
    return extras
  } catch {
    return []
  }
}

/** Reads all keys of the existing locale-ru block. */
function readProfileConfigKeys(profileDir) {
  try {
    const text = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
    const block = text.match(/- id: locale-ru[\s\S]*?(?=\n- id:|\s*$)/u)
    if (block === null) return {}
    const keys = {}
    for (const line of block[0].split('\n')) {
      const pair = line.match(/^\s{4}([A-Za-z][\w-]*):\s*(.*)$/u)
      if (pair !== null) keys[pair[1]] = pair[2]
    }
    return keys
  } catch {
    return {}
  }
}

/** Reads the engine of the existing locale-ru block (keeps the user choice). */
export function readProfileEngine(profileDir) {
  try {
    const text = readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
    const block = text.match(/- id: locale-ru[\s\S]*?(?=\n- id:|\s*$)/u)
    if (block === null) return undefined
    const engine = block[0].match(/^\s{4}engine:\s*(\S+)/mu)
    return engine === null ? undefined : engine[1]
  } catch {
    return undefined
  }
}

/**
 * Writes the locale-ru block into the profile patch file, keeping keys the
 * installer does not manage (trimSilence, nested lists, custom paths).
 * @param profileDir - profile directory.
 * @param options - engine, merge, whisper paths and diagnostics flag.
 * @returns whether the file changed.
 */
export function writeProfileConfig(profileDir, { engine = 'auto', merge, whisperBinaryPath, whisperServerPath, whisperModelPath: modelPath, debugTranscripts } = {}) {
  const path = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(path)) throw new Error(`в профиле нет cordis.patch.yml: ${path}`)
  const previous = readFileSync(path, 'utf8')
  const current = readProfileConfigKeys(profileDir)
  const cleaned = removeEngineBlock(previous.split('\n'))
  const block = [ENGINE_BLOCK_MARKER + ': английские термины от Whisper, русская речь от GigaAM.']
  block.push('- id: locale-ru')
  block.push('  config:')
  block.push(`    engine: ${sanitizeConfigValue(engine)}`)
  // Пользовательские ключи (trimSilence, merge, пути) не теряем.
  const effectiveMerge = merge !== undefined ? merge : current.merge
  if (effectiveMerge !== undefined && effectiveMerge !== '') block.push(`    merge: ${sanitizeConfigValue(effectiveMerge)}`)
  const effectiveDebug = debugTranscripts !== undefined
    ? debugTranscripts
    : current.debugTranscripts !== undefined ? current.debugTranscripts === 'true' : true
  block.push(`    debugTranscripts: ${effectiveDebug === true ? 'true' : 'false'}`)
  const effectiveBinary = whisperBinaryPath !== undefined ? whisperBinaryPath : current.whisperBinaryPath
  const effectiveServer = whisperServerPath !== undefined ? whisperServerPath : current.whisperServerPath
  const effectiveModel = modelPath !== undefined ? modelPath : current.whisperModelPath
  if (effectiveBinary !== undefined && effectiveBinary !== '') block.push(`    whisperBinaryPath: ${sanitizeConfigValue(effectiveBinary)}`)
  if (effectiveServer !== undefined && effectiveServer !== '') block.push(`    whisperServerPath: ${sanitizeConfigValue(effectiveServer)}`)
  if (effectiveModel !== undefined && effectiveModel !== '') block.push(`    whisperModelPath: ${sanitizeConfigValue(effectiveModel)}`)
  for (const line of readProfileExtraLines(profileDir)) block.push(line)
  const next = `${cleaned.join('\n').replace(/\n+$/u, '')}\n\n${block.join('\n')}\n`
  if (previous === next) return false
  writeFileSync(path, next)
  return true
}

/** Removes the engine configuration from the profile patch. */
export function removeProfileConfig(profileDir) {
  const path = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(path)) return false
  const previous = readFileSync(path, 'utf8')
  const next = `${removeEngineBlock(previous.split('\n')).join('\n').replace(/\n+$/u, '')}\n`
  if (next === previous) return false
  writeFileSync(path, next)
  return true
}

/**
 * Installs the package into the desktop profile.
 * @param options - profile location, version, pnpm, dry-run and logging.
 * @returns the result with changes, backup and verification.
 */
export async function installDesktop({
  dshHome,
  version,
  dryRun = false,
  appPath,
  log = console.log,
  retryDelays = [15000, 30000, 45000],
  engine,
  merge,
  whisper = true,
  whisperModelPath: modelPath,
  debugTranscripts,
  fetchImpl,
}) {
  const profileDir = join(dshHome, 'profiles', 'desktop')
  if (!existsSync(profileDir)) {
    throw new Error(`профиль приложения не найден: ${profileDir}. Запустите приложение DeepSeek Harness хотя бы раз.`)
  }
  const manifest = readManifest(profileDir)
  const { manifest: next, changes } = planInstall(manifest, { version })
  for (const change of changes) log(`  ${change}`)
  if (dryRun) {
    if (changes.length === 0) log(`  пакет уже установлен: ${PACKAGE_NAME}`)
    const whisperPlan = whisper === false ? { binary: undefined, modelPath: undefined } : await installWhisper({ dshHome, log, dryRun: true, modelPath, fetchImpl })
    const plannedEngine = engine ?? readProfileEngine(profileDir) ?? (whisperPlan.binary !== undefined ? 'auto' : 'gigaam')
    log(`  движок: ${plannedEngine}`)
    return { profileDir, changes, backupDir: undefined, pnpm: undefined, verified: false, dryRun: true, engine: plannedEngine, whisper: whisperPlan }
  }
  if (changes.length === 0) {
    // Пакет уже стоит: всё равно настраиваем движок и докачиваем Whisper.
    const whisperResult = whisper === false ? { binary: undefined, modelPath: undefined } : await installWhisper({ dshHome, log, dryRun: false, modelPath, fetchImpl })
    const chosenEngineRaw = engine ?? readProfileEngine(profileDir) ?? (whisperResult.binary !== undefined ? 'auto' : 'gigaam')
    const chosenEngine = whisper === false && chosenEngineRaw !== 'gigaam' ? 'gigaam' : chosenEngineRaw
    writeProfileConfig(profileDir, {
      engine: chosenEngine,
      merge,
      debugTranscripts,
      whisperBinaryPath: whisperResult.binary,
      whisperServerPath: whisperResult.binary === undefined || !existsSync(join(dirname(whisperResult.binary), 'whisper-server')) ? undefined : join(dirname(whisperResult.binary), 'whisper-server'),
      whisperModelPath: whisperResult.modelPath,
    })
    log(`  движок: ${chosenEngine}${whisperResult.binary === undefined ? ' (Whisper недоступен)' : ''}`)
    return { profileDir, changes, backupDir: undefined, pnpm: undefined, verified: verifyInstalled(profileDir, manifest), engine: chosenEngine, whisper: whisperResult, alreadyInstalled: true }
  }
  const pnpm = findPnpm({ appPath })
  if (pnpm === undefined && !dryRun) {
    throw new Error('pnpm не найден: установите pnpm или запустите приложение DeepSeek Harness, чтобы использовался встроенный')
  }

  const backupDir = backupProfile(profileDir)
  log(`  резервная копия: ${backupDir}`)
  try {
    writeAtomic(join(profileDir, 'package.json'), `${JSON.stringify(next, null, 2)}\n`)
    // Проверяем, что записанный файл читается и совпадает с задуманным.
    const written = readManifest(profileDir)
    if (JSON.stringify(written) !== JSON.stringify(next)) throw new Error('записанный package.json не совпадает с ожидаемым')
    // Сразу после релиза npm может ещё не отдавать новую версию: повторяем.
    let install = runPnpm(pnpm, profileDir, { dryRun })
    for (let attempt = 0; install.status !== 0 && attempt < retryDelays.length; attempt += 1) {
      log(`  pnpm install не удался (код ${install.status}), повтор через ${Math.round(retryDelays[attempt] / 1000)} с — возможно, npm ещё не отдаёт версию`)
      sleepSync(retryDelays[attempt])
      install = runPnpm(pnpm, profileDir, { dryRun })
    }
    if (install.status !== 0) {
      throw new Error(`pnpm install завершился с кодом ${install.status}: ${String(install.stderr).slice(-500)}`)
    }
    const verified = verifyInstalled(profileDir, next)
    if (!verified.ok) throw new Error(verified.reason)
    // Whisper и конфигурация движка: нормальная установка одним действием.
    let whisperResult = { binary: undefined, modelPath: undefined }
    if (whisper !== false) {
      whisperResult = await installWhisper({ dshHome, log, dryRun, modelPath, fetchImpl })
    }
    const chosenEngineRaw = engine ?? readProfileEngine(profileDir) ?? (whisperResult.binary !== undefined ? 'auto' : 'gigaam')
    const chosenEngine = whisper === false && chosenEngineRaw !== 'gigaam' ? 'gigaam' : chosenEngineRaw
    writeProfileConfig(profileDir, {
      engine: chosenEngine,
      merge,
      debugTranscripts,
      whisperBinaryPath: whisperResult.binary,
      whisperServerPath: whisperResult.binary === undefined || !existsSync(join(dirname(whisperResult.binary), 'whisper-server')) ? undefined : join(dirname(whisperResult.binary), 'whisper-server'),
      whisperModelPath: whisperResult.modelPath,
    })
    log(`  движок: ${chosenEngine}${whisperResult.binary === undefined ? ' (Whisper недоступен)' : ''}`)
    return { profileDir, changes, backupDir, pnpm, verified, engine: chosenEngine, whisper: whisperResult }
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
