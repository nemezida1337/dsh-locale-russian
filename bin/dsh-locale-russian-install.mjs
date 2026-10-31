#!/usr/bin/env node
/**
 * One-command setup for this package.
 *
 * Without arguments it installs the local speech engine used by the Russian voice
 * input: downloads `gigastt` (the GigaAM v3 runtime) and the INT8 model by running
 * the packaged `install.sh`.
 *
 * With `--desktop` it installs the package itself into the DeepSeek Harness
 * desktop app profile (the app owns that profile, so the CLI cannot manage it):
 * adds the dependency and the bundle row, runs pnpm, and verifies the result.
 * Use `--dry-run` to see the changes and `--revert` to undo them.
 *
 * Usage:
 *   npx dsh-locale-russian-install                 # engine + model
 *   npx dsh-locale-russian-install --desktop       # into the desktop app
 *   npx dsh-locale-russian-install --desktop --dry-run
 *   npx dsh-locale-russian-install --desktop --revert
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import {
  PACKAGE_NAME,
  defaultAppPath,
  defaultDshHome,
  installDesktop,
  latestBackup,
  revertDesktop,
} from './desktop-install.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

// Неизвестный флаг — почти всегда опечатка: лучше сказать об этом сразу.
const KNOWN = new Set(['--desktop', '--dry-run', '--revert', '--yes', '-y', '--help', '-h', '--profile'])
for (const [index, arg] of args.entries()) {
  if (!arg.startsWith('-')) continue
  if (!KNOWN.has(arg)) {
    console.error(`неизвестный флаг: ${arg}. Справка: --help`)
    process.exit(2)
  }
  if (arg === '--profile' && (args[index + 1] === undefined || args[index + 1].startsWith('-'))) {
    console.error('флагу --profile нужен путь к каталогу DSH')
    process.exit(2)
  }
}

if (flag('--help') || flag('-h')) {
  console.log('npx dsh-locale-russian-install                 установить движок и модель')
  console.log('npx dsh-locale-russian-install --desktop       установить пакет в приложение')
  console.log('  --dry-run                                     показать изменения без записи')
  console.log('  --revert                                      откатить установку в приложение')
  console.log('  --profile <путь>                              каталог DSH (по умолчанию ~/.dsh)')
  process.exit(0)
}

if (!flag('--desktop')) {
  // Движок распознавания: логика лежит в install.sh, чтобы не дублировать её.
  const script = resolve(here, '..', 'install.sh')
  if (process.platform === 'win32') {
    console.error('install.sh рассчитан на macOS и Linux. Для Windows скачайте релиз gigastt вручную:')
    console.error('  https://github.com/ekhodzitsky/gigastt/releases')
    console.error('Положите бинарник в %USERPROFILE%\\.dsh\\bin\\gigastt.exe, модель скачает карточка плагина.')
    process.exit(1)
  }
  console.log('Устанавливаю движок распознавания и модель GigaAM (~313 МБ, один раз)...')
  const result = spawnSync('sh', [script], { stdio: 'inherit' })
  if (result.error !== undefined) {
    console.error(`не удалось запустить установку: ${result.error.message}`)
    console.error(`скрипт лежит здесь: ${script}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

// Режим установки в настольное приложение.
const dshHome = resolve(value('--profile') ?? defaultDshHome())
const dryRun = flag('--dry-run')
const version = JSON.parse(readFileSync(resolve(here, '..', 'package.json'), 'utf8')).version

/** Asks for confirmation unless `--yes` or a non-interactive run. */
async function confirm(question) {
  if (flag('--yes') || flag('-y') || !process.stdin.isTTY) return true
  const reader = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await reader.question(`${question} [y/N] `)).trim().toLowerCase()
  reader.close()
  return answer === 'y' || answer === 'yes' || answer === 'д' || answer === 'да'
}

try {
  if (flag('--revert')) {
    if (dryRun) {
      const backup = latestBackup(resolve(dshHome, 'profiles', 'desktop'))
      if (backup === undefined) {
        console.error('резервных копий нет: откатывать нечего')
        process.exit(1)
      }
      console.log(`Dry-run: профиль будет восстановлен из ${backup}`)
      process.exit(0)
    }
    console.log(`Откатываю установку ${PACKAGE_NAME} в профиле приложения…`)
    revertDesktop({ dshHome, appPath: defaultAppPath(), log: console.log })
    console.log('Готово. Перезапустите приложение DeepSeek Harness.')
    process.exit(0)
  }
  console.log(`Установка ${PACKAGE_NAME}@${version} в приложение DeepSeek Harness${dryRun ? ' (dry-run)' : ''}…`)
  if (!dryRun && !(await confirm('Изменю package.json профиля приложения (с резервной копией). Продолжить?'))) {
    console.log('Отменено.')
    process.exit(0)
  }
  const result = installDesktop({
    dshHome,
    version,
    dryRun,
    appPath: defaultAppPath(),
    log: console.log,
  })
  if (result.changes.length === 0) {
    console.log(`Пакет уже установлен: ${PACKAGE_NAME}${result.verified.ok ? ` ${result.verified.version}` : ''}.`)
    process.exit(0)
  }
  if (dryRun) {
    console.log('Dry-run: файлы не изменены. Запустите без --dry-run, чтобы применить.')
    process.exit(0)
  }
  console.log(`Готово: установлен ${PACKAGE_NAME}${result.verified.version === undefined ? '' : ` ${result.verified.version}`}.`)
  console.log('Перезапустите приложение DeepSeek Harness и выберите язык в «Настройки → Общие → Язык».')
  if (result.backupDir !== undefined) console.log(`Резервная копия: ${result.backupDir} (откат: --revert)`)
  process.exit(0)
} catch (error) {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
