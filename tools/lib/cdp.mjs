/**
 * Minimal Chrome DevTools Protocol client for the GUI tools.
 *
 * It launches headless Chrome, opens one page, and exposes the few operations
 * the checks need: evaluate an expression, click by visible text, type text, and
 * capture a screenshot. Both `screenshot-gui.mjs` and `gui-sweep.mjs` build on
 * it, so the protocol plumbing lives in one place.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'

export const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Starts headless Chrome and waits for its DevTools endpoint. */
export async function launchChrome({
  port = 9333,
  lang = 'ru-RU',
  chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME,
  windowSize = '1440,1000',
} = {}) {
  const profileDir = resolve(tmpdir(), `dsh-chrome-${process.pid}-${port}`)
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
    `--window-size=${windowSize}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  let log = ''
  chrome.stderr.on('data', (chunk) => { log += chunk.toString() })
  chrome.stdout.on('data', (chunk) => { log += chunk.toString() })

  let version
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) { version = await response.json(); break }
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  if (version === undefined) throw new Error(`DevTools endpoint did not answer on port ${port}\n${log}`)

  return {
    chrome,
    profileDir,
    version,
    async close() {
      chrome.kill('SIGTERM')
      await sleep(300)
      rmSync(profileDir, { recursive: true, force: true })
    },
  }
}

/** One attached page with the operations the checks use. */
export class Page {
  constructor(socket, sessionId) {
    this.socket = socket
    this.sessionId = sessionId
    this.nextId = 0
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id === undefined) return
      const entry = this.pending.get(message.id)
      if (entry === undefined) return
      this.pending.delete(message.id)
      if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)))
      else entry.resolve(message.result)
    })
  }

  /** Sends one protocol command. */
  send(method, params = {}) {
    this.nextId += 1
    const id = this.nextId
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
      this.socket.send(JSON.stringify({ id, method, params, sessionId: this.sessionId }))
    })
  }

  /** Evaluates an expression in the page and returns its value. */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    return result.result?.value
  }

  /** Navigates and waits for the load event. */
  async navigate(url, timeoutMs = 20000) {
    const loaded = new Promise((resolvePromise) => {
      const listener = (event) => {
        const message = JSON.parse(event.data)
        if (message.method === 'Page.loadEventFired' && message.sessionId === this.sessionId) {
          this.socket.removeEventListener('message', listener)
          resolvePromise()
        }
      }
      this.socket.addEventListener('message', listener)
    })
    await this.send('Page.navigate', { url })
    await Promise.race([loaded, sleep(timeoutMs)])
  }

  /** Clicks the first element whose text matches, returning whether it found one. */
  async clickText(label, { exact = true } = {}) {
    return await this.evaluate(`(() => {
      const nodes = [...document.querySelectorAll('button, [role="button"], [role="tab"], a, li, label')]
      const wanted = ${JSON.stringify(label)}
      const visible = nodes.filter((node) => node.offsetParent !== null)
      const target = ${exact}
        ? visible.find((node) => (node.textContent || '').trim() === wanted)
          || visible.find((node) => (node.textContent || '').trim().startsWith(wanted))
        : visible.find((node) => (node.textContent || '').includes(wanted))
      if (!target) return false
      target.click()
      return true
    })()`)
  }

  /** Inserts text into the focused element. */
  async insertText(text) {
    await this.send('Input.insertText', { text })
  }

  /** Focuses the first node matching a selector. */
  async focus(selector) {
    return await this.evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)})
      if (!node) return false
      node.focus()
      return true
    })()`)
  }

  /** Captures a PNG screenshot. */
  async screenshot(path) {
    mkdirSync(dirname(path), { recursive: true })
    const shot = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path, Buffer.from(shot.data, 'base64'))
  }

  /** Reports elements whose text is clipped by their container. */
  async clipped() {
    return await this.evaluate(`(() => {
      return [...document.querySelectorAll('*')]
        .filter((node) => node.children.length === 0
          && node.clientWidth > 0
          && node.scrollWidth > node.clientWidth + 1
          && (node.textContent || '').trim().length > 0
          && !['auto', 'scroll'].includes(getComputedStyle(node).overflowX))
        .slice(0, 40)
        .map((node) => ({
          text: (node.textContent || '').trim().slice(0, 80),
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          className: String(node.className).slice(0, 60),
        }))
    })()`)
  }

  /** Renders the visible page text. */
  text() {
    return this.evaluate('document.body ? document.body.innerText : ""')
  }
}

/** Opens one about:blank target and attaches to it. */
export async function openPage(version, { width = 1440, height = 1000, scale = 2 } = {}) {
  const socket = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener('open', resolvePromise, { once: true })
    socket.addEventListener('error', rejectPromise, { once: true })
  })

  let nextId = 0
  const pending = new Map()
  const raw = (method, params = {}) => {
    nextId += 1
    const id = nextId
    return new Promise((resolvePromise, rejectPromise) => {
      pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id === undefined) return
    const entry = pending.get(message.id)
    if (entry === undefined) return
    pending.delete(message.id)
    if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)))
    else entry.resolve(message.result)
  })

  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true })
  const page = new Page(socket, sessionId)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  await page.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: false,
  })
  page.close = () => socket.close()
  return page
}

/** Reads the access token a `dsh web` run printed into its log. */
export function tokenFromLog(logPath) {
  const text = require('node:fs').readFileSync(logPath, 'utf8')
  const match = /token=([A-Za-z0-9_-]+)/u.exec(text)
  if (match === null) throw new Error(`no access token in ${logPath}`)
  return match[1]
}
