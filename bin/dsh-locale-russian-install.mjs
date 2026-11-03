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
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import {
  MAX_PERSONAL_HOTWORDS,
  addPersonalHotword,
  clearPersonalHotwords,
  readPersonalHotwords,
  removePersonalHotword,
} from '../lib/hotwords.mjs'
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
const KNOWN = new Set([
  '--desktop', '--dry-run', '--revert', '--yes', '-y', '--help', '-h', '--profile',
  '--hotwords-add', '--hotwords-add-file', '--hotwords-list', '--hotwords-remove',
  '--hotwords-clear', '--hotwords-file',
])
const NEEDS_VALUE = new Set(['--profile', '--hotwords-add', '--hotwords-add-file', '--hotwords-remove', '--hotwords-file'])
for (const [index, arg] of args.entries()) {
  if (!arg.startsWith('-')) continue
  if (!KNOWN.has(arg)) {
    console.error(`неизвестный флаг: ${arg}. Справка: --help`)
    process.exit(2)
  }
  if (NEEDS_VALUE.has(arg) && (args[index + 1] === undefined || args[index + 1].startsWith('-'))) {
    console.error(`флагу ${arg} нужен аргумент`)
    process.exit(2)
  }
}

if (flag('--help') || flag('-h')) {
  console.log('npx dsh-locale-russian-install                 установить движок и модель')
  console.log('npx dsh-locale-russian-install --desktop       установить пакет в приложение')
  console.log('  --dry-run                                     показать изменения без записи')
  console.log('  --revert                                      откатить установку в приложение')
  console.log('  --profile <путь>                              каталог DSH (по умолчанию ~/.dsh)')
  console.log('')
  console.log('Личный словарь распознавания:')
  console.log('  --hotwords-add "слово, фраза"                 добавить слова в словарь')
  console.log('  --hotwords-add-file <путь>                    добавить слова из файла (по одному в строке)')
  console.log('  --hotwords-list                               показать личный словарь')
  console.log('  --hotwords-remove "слово"                     удалить слово')
  console.log('  --hotwords-clear                              очистить личный словарь')
  console.log('  --hotwords-file <путь>                        свой файл словаря')
  process.exit(0)
}

// Личный словарь: первичное заполнение и правка из терминала.
const hotwordsMode = flag('--hotwords-add') || flag('--hotwords-add-file') || flag('--hotwords-list')
  || flag('--hotwords-remove') || flag('--hotwords-clear')
if (hotwordsMode) {
  const dshHome = resolve(value('--profile') ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'))
  const file = resolve(value('--hotwords-file') ?? join(dshHome, 'speech-ru', 'hotwords.txt'))
  const read = () => (existsSync(file) ? readFileSync(file, 'utf8') : '')
  const write = (text) => {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  const phrases = []
  if (flag('--hotwords-add')) {
    phrases.push(...String(value('--hotwords-add') ?? '').split(/[,;\n]/u))
  }
  if (flag('--hotwords-add-file')) {
    const source = value('--hotwords-add-file')
    if (source === undefined || !existsSync(source)) {
      console.error(`файл не найден: ${source ?? '(не указан)'}`)
      process.exit(1)
    }
    phrases.push(...readFileSync(source, 'utf8').split('\n'))
  }
  // Пустые строки — не «пропущенные фразы»: просто убираем их из ввода.
  const requested = phrases.map((phrase) => phrase.trim()).filter((phrase) => phrase !== '')
  if (phrases.length > 0) {
    let text = read()
    let added = 0
    let skipped = 0
    for (const phrase of requested) {
      const result = addPersonalHotword(text, phrase)
      if (result.ok && result.duplicate !== true) {
        text = result.text
        added += 1
      } else {
        skipped += 1
      }
    }
    write(text)
    const count = readPersonalHotwords(text).length
    console.log(`добавлено: ${added}, пропущено: ${skipped}, всего в личном словаре: ${count}/${MAX_PERSONAL_HOTWORDS}`)
    process.exit(0)
  }
  if (flag('--hotwords-remove')) {
    const result = removePersonalHotword(read(), String(value('--hotwords-remove') ?? ''))
    if (!result.ok) {
      console.error(`не найдено в словаре: ${value('--hotwords-remove')}`)
      process.exit(1)
    }
    write(result.text)
    console.log(`удалено, осталось: ${result.count}`)
    process.exit(0)
  }
  if (flag('--hotwords-clear')) {
    const result = clearPersonalHotwords(read())
    write(result.text)
    console.log('личный словарь очищен')
    process.exit(0)
  }
  // --hotwords-list
  const personal = readPersonalHotwords(read())
  if (personal.length === 0) {
    console.log(`личный словарь пуст: ${file}`)
    process.exit(0)
  }
  console.log(`личный словарь (${personal.length}/${MAX_PERSONAL_HOTWORDS}), файл: ${file}`)
  for (const phrase of personal) console.log(`  ${phrase}`)
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
