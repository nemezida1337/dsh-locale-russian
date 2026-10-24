#!/usr/bin/env node
/**
 * One-command setup of the local speech engine used by the Russian voice input:
 * downloads `gigastt` (the GigaAM v3 runtime) and the INT8 model.
 *
 * Runs the packaged `install.sh` through `sh`, so the download logic lives in one
 * place. On platforms without a POSIX shell the command prints the manual steps.
 *
 * Usage:
 *   npx dsh-locale-russian-install
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, '..', 'install.sh')

if (process.platform === 'win32') {
  console.error('install.sh рассчитан на macOS и Linux. Для Windows скачайте релиз gigastt вручную:')
  console.error('  https://github.com/ekhodzitsky/gigastt/releases')
  console.error('Положите бинарник в %USERPROFILE%\\.dsh\\bin\\gigastt.exe, модель скачает карточка плагина.')
  process.exit(1)
}

console.log('Устанавливаю движок распознавания и модель GigaAM (~315 МБ, один раз)...')
const result = spawnSync('sh', [script], { stdio: 'inherit' })
if (result.error !== undefined) {
  console.error(`не удалось запустить установку: ${result.error.message}`)
  console.error(`скрипт лежит здесь: ${script}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
