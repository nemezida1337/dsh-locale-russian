#!/usr/bin/env node
/**
 * Captures one screen of the running interface: it opens a URL in headless
 * Chrome through the DevTools protocol, optionally dismisses dialogs and types
 * text, then writes a PNG screenshot, the rendered text, and the list of
 * clipped elements.
 *
 * For a walkthrough over every screen use `tools/gui-sweep.mjs`; this tool is
 * for one specific screen while developing.
 *
 * Usage:
 *   node tools/screenshot-gui.mjs --url "http://127.0.0.1:5599/?token=…" \
 *     --png reports/gui.png --text reports/gui.txt \
 *     [--wait 4000] [--lang ru-RU] [--click-text "Продолжить,Настройки"] \
 *     [--type "/"] [--focus "textarea, [contenteditable=\"true\"]"]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchChrome, openPage, sleep } from './lib/cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const url = option('url', 'http://127.0.0.1:5599')
const pngPath = resolve(root, option('png', 'reports/gui.png'))
const textPath = resolve(root, option('text', 'reports/gui.txt'))
const waitMs = Number(option('wait', 4000))
const lang = option('lang', 'ru-RU')
const port = Number(option('port', 9333))
const chromePath = option('chrome', undefined)
const clickTexts = (option('click-text', '') ?? '').split(',').map((item) => item.trim()).filter((item) => item.length > 0)
const typeText = option('type', '')
const focusSelector = option('focus', 'textarea, [contenteditable="true"]')

const chrome = await launchChrome({ port, lang, chromePath })
const page = await openPage(chrome.version)

await page.navigate(url)
await sleep(waitMs)

for (const label of clickTexts) {
  const clicked = await page.clickText(label)
  console.log(`клик «${label}»: ${clicked ? 'ок' : 'не найдено'}`)
  await sleep(1500)
}

if (typeText.length > 0) {
  const focused = await page.focus(focusSelector)
  console.log(`фокус для ввода: ${focused ? 'ок' : 'поле не найдено'}`)
  await page.insertText(typeText)
  await sleep(1600)
}

const text = await page.text()
const clipped = await page.clipped()
const title = await page.evaluate('document.title')
const documentLanguage = await page.evaluate('document.documentElement.lang')

mkdirSync(dirname(pngPath), { recursive: true })
mkdirSync(dirname(textPath), { recursive: true })
await page.screenshot(pngPath)
writeFileSync(textPath, [
  `url: ${url}`,
  `title: ${title}`,
  `html lang: ${documentLanguage}`,
  `clipped elements: ${Array.isArray(clipped) ? clipped.length : 'unknown'}`,
  ...(Array.isArray(clipped) && clipped.length > 0
    ? ['', 'Clipped text:', ...clipped.map((item) => `  ${item.width}/${item.scrollWidth} ${JSON.stringify(item.text)} (${item.className})`)]
    : []),
  '',
  text,
  '',
].join('\n'))

console.log(`html lang: ${documentLanguage}`)
console.log(`rendered text: ${typeof text === 'string' ? text.length : 0} chars`)
console.log(`screenshot: ${pngPath}`)
console.log(`text: ${textPath}`)

page.close()
await chrome.close()
