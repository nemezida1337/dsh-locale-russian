#!/usr/bin/env node
/**
 * Opens a URL in headless Chrome through the DevTools protocol, waits for the
 * page to settle, then writes a PNG screenshot and the rendered text.
 *
 * Usage:
 *   node tools/screenshot-gui.mjs --url http://127.0.0.1:5599 \
 *     --png reports/gui.png --text reports/gui.txt [--wait 4000] [--lang ru-RU]
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

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
const clickTexts = (option('click-text', '') || '').split(',').map((item) => item.trim()).filter((item) => item.length > 0)
const typeText = option('type', '')
const focusSelector = option('focus', 'textarea, [contenteditable="true"]')
const lang = option('lang', 'ru-RU')
const port = Number(option('port', 9333))
const chromePath = option('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
const profileDir = resolve(tmpdir(), `dsh-ru-chrome-${process.pid}`)

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  `--lang=${lang}`,
  `--accept-lang=${lang},ru;q=0.9,en;q=0.8`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1440,1000',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

let chromeLog = ''
chrome.stderr.on('data', (chunk) => { chromeLog += chunk.toString() })
chrome.stdout.on('data', (chunk) => { chromeLog += chunk.toString() })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

/** Waits until the DevTools endpoint answers. */
async function waitForDevTools() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return await response.json()
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  throw new Error(`DevTools endpoint did not answer on port ${port}\n${chromeLog}`)
}

const version = await waitForDevTools()
const socket = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((resolvePromise, rejectPromise) => {
  socket.addEventListener('open', resolvePromise, { once: true })
  socket.addEventListener('error', rejectPromise, { once: true })
})

let messageId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id === undefined) return
  const entry = pending.get(message.id)
  if (entry === undefined) return
  pending.delete(message.id)
  if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
})

/** Sends one CDP command. */
function send(method, params = {}, sessionId) {
  messageId += 1
  const id = messageId
  return new Promise((resolvePromise, rejectPromise) => {
    pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }))
  })
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

await send('Page.enable', {}, sessionId)
await send('Runtime.enable', {}, sessionId)
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 2,
  mobile: false,
}, sessionId)

const loaded = new Promise((resolvePromise) => {
  const listener = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.loadEventFired' && message.sessionId === sessionId) {
      socket.removeEventListener('message', listener)
      resolvePromise()
    }
  }
  socket.addEventListener('message', listener)
})
await send('Page.navigate', { url }, sessionId)
await Promise.race([loaded, sleep(20000)])
await sleep(waitMs)

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)
  return result.result?.value
}

for (const label of clickTexts) {
  const clicked = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a')]
    const target = nodes.find((node) => (node.textContent || '').trim() === ${JSON.stringify(label)})
      || nodes.find((node) => (node.textContent || '').includes(${JSON.stringify(label)}))
    if (!target) return false
    target.click()
    return true
  })()`)
  console.log(`click "${label}": ${clicked ? 'ok' : 'not found'}`)
  await sleep(1500)
}

// Layout check: a longer Russian label must not be clipped by its container.
const overflow = await evaluate(`(() => {
  const nodes = [...document.querySelectorAll('*')]
  return nodes
    .filter((node) => node.children.length === 0
      && node.clientWidth > 0
      && node.scrollWidth > node.clientWidth + 1
      && (node.textContent || '').trim().length > 0
      && !['auto', 'scroll'].includes(getComputedStyle(node).overflowX))
    .slice(0, 40)
    .map((node) => ({
      text: (node.textContent || '').trim().slice(0, 70),
      width: node.clientWidth,
      scrollWidth: node.scrollWidth,
      className: String(node.className).slice(0, 60),
    }))
})()`)

if (typeText.length > 0) {
  const focused = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(focusSelector)})
    if (!node) return false
    node.focus()
    return true
  })()`)
  console.log(`focus for typing: ${focused ? 'ok' : 'not found'}`)
  await send('Input.insertText', { text: typeText }, sessionId)
  await sleep(1600)
}

const text = await evaluate('document.body ? document.body.innerText : ""')
const title = await evaluate('document.title')
const language = await evaluate('document.documentElement.lang')
const locale = await evaluate('(window.__DSH_BOOT__ && JSON.stringify(Object.keys(window.__DSH_BOOT__))) || ""')

mkdirSync(dirname(pngPath), { recursive: true })
mkdirSync(dirname(textPath), { recursive: true })
const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
writeFileSync(pngPath, Buffer.from(shot.data, 'base64'))
writeFileSync(textPath, [
  `url: ${url}`,
  `title: ${title}`,
  `html lang: ${language}`,
  `boot keys: ${locale}`,
  `clipped elements: ${Array.isArray(overflow) ? overflow.length : 'unknown'}`,
  ...(Array.isArray(overflow) && overflow.length > 0
    ? ['', 'Clipped text:', ...overflow.map((item) => `  ${item.width}/${item.scrollWidth} ${JSON.stringify(item.text)} (${item.className})`)]
    : []),
  '',
  text,
  '',
].join('\n'))

console.log(`title: ${title}`)
console.log(`html lang: ${language}`)
console.log(`rendered text: ${typeof text === 'string' ? text.length : 0} chars`)
console.log(`screenshot: ${pngPath}`)
console.log(`text: ${textPath}`)

socket.close()
chrome.kill('SIGTERM')
await sleep(300)
rmSync(profileDir, { recursive: true, force: true })
