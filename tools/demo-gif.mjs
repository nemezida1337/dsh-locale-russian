#!/usr/bin/env node
/**
 * Records a short GIF of the Russian interface for the README: opens the page,
 * walks through the main screen and the settings tabs, saves the frames, and
 * assembles them with ffmpeg.
 *
 * Needs a running `dsh web` server with the pack and ffmpeg on PATH.
 *
 * Usage:
 *   node tools/demo-gif.mjs --url "http://127.0.0.1:5610/?token=…" [--out docs/screenshots/demo.gif]
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { launchChrome, openPage, sleep } from './lib/cdp.mjs'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option, flag } = createArgs()

const url = option('url')
if (url === undefined) {
  console.error('нужен --url запущенного сервера dsh web с нашим пакетом')
  process.exit(2)
}
const outPath = resolve(root, option('out', 'docs/screenshots/demo.gif'))
const width = Number(option('width', '1280'))
const height = Number(option('height', '800'))
const keepFrames = flag('keep-frames')
const chromePath = option('chrome')

/** Screens of the walkthrough: label to click and how long to settle. */
const SCREENS = [
  { label: undefined, wait: 6_000 },
  { label: 'Настройки', wait: 2_000 },
  { label: 'Встроенные', wait: 2_500 },
]

const frames = mkdtempSync(join(tmpdir(), 'dsh-demo-'))
const chrome = await launchChrome({ lang: 'ru-RU', chromePath })
const page = await openPage(chrome.version, { width, height, scale: 1 })
try {
  await page.navigate(url)
  // Свежий профиль показывает приветственные окна (уведомление о версии,
  // настройка ключа API): без их закрытия кадры — модальные окна.
  await sleep(3_000)
  for (let round = 0; round < 4; round += 1) {
    let dismissed = false
    for (const label of ['Продолжить', 'Настроить позже', 'Понятно', 'Закрыть', 'Пропустить']) {
      if (await page.clickText(label)) {
        console.log(`закрыто окно: «${label}»`)
        await sleep(1_000)
        dismissed = true
        break
      }
    }
    if (!dismissed) break
  }
  let index = 0
  for (const screen of SCREENS) {
    if (screen.label !== undefined) {
      const clicked = await page.clickText(screen.label)
      if (!clicked) console.log(`клик «${screen.label}»: не найдено, кадр останется прежним`)
    }
    await sleep(screen.wait)
    index += 1
    await page.screenshot(join(frames, `frame-${String(index).padStart(2, '0')}.png`))
    console.log(`кадр ${index}: ${screen.label ?? 'главный экран'}`)
  }
} finally {
  await page.close()
  await chrome.close()
}

const files = readdirSync(frames).filter((name) => name.endsWith('.png')).sort()
if (files.length === 0) throw new Error('кадры не записались')
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  throw new Error('ffmpeg не найден: установите его, чтобы собрать GIF')
}
mkdirSync(dirname(outPath), { recursive: true })
// Палитра даёт заметно меньший файл, чем прямой GIF-кодировщик.
const palette = join(frames, 'palette.png')
const ffmpegPalette = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(frames, 'frame-%02d.png'), '-vf', 'palettegen=stats_mode=diff', palette], { encoding: 'utf8' })
if (ffmpegPalette.status !== 0) throw new Error(`палитра не собралась: ${ffmpegPalette.stderr}`)
const ffmpegGif = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', '1', '-i', join(frames, 'frame-%02d.png'),
  '-i', palette,
  '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3',
  '-loop', '0', outPath,
], { encoding: 'utf8' })
if (ffmpegGif.status !== 0) throw new Error(`GIF не собрался: ${ffmpegGif.stderr}`)

if (!keepFrames) rmSync(frames, { recursive: true, force: true })
if (!existsSync(outPath)) throw new Error('GIF не создан')
console.log(`GIF: ${outPath.replace(`${root}/`, '')} | ${(statSync(outPath).size / 1024).toFixed(0)} КБ | кадров: ${files.length}`)
