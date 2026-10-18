#!/usr/bin/env node
/**
 * Walks the interface screen by screen and reports what the translator has to
 * care about: rendered text, and any element whose copy is clipped by its
 * container (longer Russian labels are the usual cause).
 *
 * Usage:
 *   node tools/gui-sweep.mjs --url "http://127.0.0.1:5610/?token=…" \
 *     [--out reports/sweep] [--baseline reports/sweep/summary.json] [--compare]
 *
 * Exit code 1 when `--compare` finds a screen with more clipped elements than
 * the baseline recorded, so CI or a pre-release check can gate on it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
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
const flag = (name) => args.includes(`--${name}`)

const url = option('url')
if (url === undefined) {
  console.error('нужен --url с токеном: node tools/gui-sweep.mjs --url "http://127.0.0.1:5610/?token=…"')
  process.exit(2)
}
const outDir = resolve(root, option('out', 'reports/sweep'))
const baselinePath = resolve(root, option('baseline', 'reports/sweep/summary.json'))
const compare = flag('compare')
// A pre-release check wants a hard failure on any clipped copy, not only on a
// regression against a baseline.
const failOnClip = flag('fail-on-clip')

/** Labels that dismiss first-run dialogs, in either language. */
const DISMISS = ['Продолжить', 'Настроить позже', 'Continue', 'Set up later', 'Позже']
/** Settings sections; whichever exist in this build are visited. */
const SECTIONS = [
  'Общие', 'Модели', 'Встроенные', 'Встроенные плагины', 'Плагины',
  'Пресеты агента', 'Учётная запись', 'Настройки плагинов', 'Список плагинов',
]

const chrome = await launchChrome({ port: Number(option('port', 9401)) })
const page = await openPage(chrome.version)

// Копия, которой владеет пакет, — кириллическая. Латинские строки приходят из
// данных хоста: описания навыков из SKILL.md, имена пакетов, модели и команды;
// они не переводятся (так же ведёт себя и китайская локаль), поэтому обрезка
// таких строк — замечание, а не провал проверки.
const OWN_COPY = /[А-Яа-яЁё]/

const screens = []
/** Captures the current screen: text, clipping, screenshot. */
async function capture(id, title) {
  const text = await page.text()
  const clipped = await page.clipped()
  const png = resolve(outDir, `${id}.png`)
  const txt = resolve(outDir, `${id}.txt`)
  mkdirSync(outDir, { recursive: true })
  await page.screenshot(png)
  writeFileSync(txt, `# ${title}\n\n${text}\n`)
  const clippedItems = (Array.isArray(clipped) ? clipped : []).map((item) => ({
    ...item,
    ours: OWN_COPY.test(item.text),
  }))
  screens.push({
    id,
    title,
    chars: typeof text === 'string' ? text.length : 0,
    clipped: clippedItems,
    png: `${id}.png`,
    txt: `${id}.txt`,
  })
  const own = clippedItems.filter((item) => item.ours)
  const data = clippedItems.filter((item) => !item.ours)
  const clippedNote = own.length + data.length === 0
    ? ''
    : ` ⚠ обрезано:${own.length > 0 ? ` ${own.map((item) => JSON.stringify(item.text)).join(', ')}` : ''}`
      + `${data.length > 0 ? ` (+${data.length} строк данных хоста)` : ''}`
  console.log(`${id.padEnd(28)} ${String(screens[screens.length - 1].chars).padStart(6)} знаков${clippedNote}`)
}

await page.navigate(url)
await sleep(6000)

for (const label of DISMISS) {
  if (await page.clickText(label)) {
    console.log(`закрыт стартовый диалог: «${label}»`)
    await sleep(1200)
    break
  }
}
await capture('00-main', 'Главный экран')

if (await page.clickText('Настройки') || await page.clickText('Settings')) {
  await sleep(2500)
  await capture('01-settings', 'Настройки')
  let index = 0
  for (const section of SECTIONS) {
    if (!await page.clickText(section)) continue
    index += 1
    await sleep(2000)
    await capture(`${String(index + 1).padStart(2, '0')}-${section.replace(/\s+/gu, '-').toLowerCase()}`, `Настройки → ${section}`)
  }
  if (await page.clickText('Закрыть') || await page.clickText('Close')) await sleep(1500)
}

// A session screen exists only when the profile has a workspace; without one
// the composer is absent and its menus cannot be captured.
if (await page.clickText('Новая сессия') || await page.clickText('New Session')) {
  await sleep(2500)
  for (const label of DISMISS) {
    if (await page.clickText(label)) { await sleep(1200); break }
  }
  await capture('89-session', 'Новая сессия')
}

// Composer menus: they carry a lot of translated copy in a small area.
if (await page.focus('textarea, [contenteditable="true"]')) {
  await page.insertText('/')
  await sleep(1800)
  await capture('90-slash-menu', 'Меню команд «/»')
  await page.evaluate(`(() => {
    const node = document.querySelector('textarea, [contenteditable="true"]')
    if (node) { node.textContent = ''; node.value = '' }
  })()`)
  await page.insertText('@')
  await sleep(1800)
  await capture('91-at-menu', 'Меню ссылок «@»')
} else {
  console.log('поле ввода не найдено: в профиле нет рабочей области, меню «/» и «@» не сняты')
}

const clippedTotal = screens.reduce((sum, screen) => sum + screen.clipped.length, 0)
const clippedOwn = screens.reduce((sum, screen) => sum + screen.clipped.filter((item) => item.ours).length, 0)
const summary = {
  generatedAt: new Date().toISOString(),
  url: url.replace(/token=.*/u, 'token=…'),
  screens: screens.map((screen) => ({
    id: screen.id,
    title: screen.title,
    chars: screen.chars,
    clipped: screen.clipped,
    png: screen.png,
    txt: screen.txt,
  })),
  totals: { screens: screens.length, clipped: clippedTotal, clippedOwnCopy: clippedOwn },
}
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

console.log(`\nэкранов: ${screens.length}, обрезанных элементов: ${clippedTotal} (из них наша копия: ${clippedOwn})`)
console.log(`сводка: ${resolve(outDir, 'summary.json')}`)

let regressions = 0
if (compare && existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const before = new Map(baseline.screens.map((screen) => [screen.id, screen]))
  for (const screen of summary.screens) {
    const previous = before.get(screen.id)
    if (previous === undefined) {
      console.log(`новый экран: ${screen.id}`)
      continue
    }
    if (screen.clipped.length > previous.clipped.length) {
      regressions += 1
      console.log(`РЕГРЕССИЯ ${screen.id}: обрезано ${previous.clipped.length} → ${screen.clipped.length}`)
      for (const item of screen.clipped) console.log(`   ${item.width}/${item.scrollWidth} ${JSON.stringify(item.text)}`)
    }
    before.delete(screen.id)
  }
  for (const missing of before.keys()) console.log(`экран пропал: ${missing}`)
  console.log(regressions === 0 ? 'регрессий по обрезке нет' : `регрессий: ${regressions}`)
}

page.close()
await chrome.close()
if (failOnClip && clippedOwn > 0) {
  console.log(`обрезано элементов нашей копии: ${clippedOwn} — проверка не пройдена`)
  process.exitCode = 1
} else if (failOnClip && clippedTotal > 0) {
  console.log(`обрезаны только строки данных хоста (${clippedTotal}) — это не наша копия, проверка пройдена`)
  process.exitCode = regressions > 0 ? 1 : 0
} else {
  process.exitCode = regressions > 0 ? 1 : 0
}
