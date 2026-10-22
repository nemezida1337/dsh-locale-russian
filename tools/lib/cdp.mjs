/**
 * Minimal Chrome DevTools Protocol client for the GUI tools.
 *
 * It launches headless Chrome, opens one page, and exposes the few operations
 * the checks need: evaluate an expression, click by visible text, type text, and
 * capture a screenshot. Both `screenshot-gui.mjs` and `gui-sweep.mjs` build on
 * it, so the protocol plumbing lives in one place.
 */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'

export const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/** Chrome candidates: an explicit path, the macOS bundle, then PATH names. */
const CHROME_CANDIDATES = ['chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']

/** Resolves a Chrome executable, preferring CHROME_PATH and the macOS bundle. */
function resolveChrome(explicit) {
  if (explicit !== undefined) return explicit
  // An empty value must fall through to the PATH lookup: CI passes the output
  // of the setup action, which is empty when the action names it differently.
  if (typeof process.env.CHROME_PATH === 'string' && process.env.CHROME_PATH.length > 0) return process.env.CHROME_PATH
  if (existsSync(MAC_CHROME)) return MAC_CHROME
  for (const name of CHROME_CANDIDATES) {
    const found = spawnSync('which', [name], { encoding: 'utf8' })
    if (found.status === 0 && found.stdout.trim().length > 0) return found.stdout.trim()
  }
  throw new Error('Chrome не найден: задайте CHROME_PATH или установите chrome/chromium в PATH')
}

/** Starts headless Chrome and waits for its DevTools endpoint. */
export async function launchChrome({
  port,
  lang = 'ru-RU',
  chromePath,
  windowSize = '1440,1000',
} = {}) {
  const executable = resolveChrome(chromePath)
  if (port !== undefined) {
    // Иначе DevTools-эндпоинт ответит чужой процесс, и команды вернут «Not supported».
    const busy = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(400) })
      .then(() => true, () => false)
    if (busy) {
      throw new Error(`порт ${port} уже занят другим процессом — укажите другой через --port или уберите флаг: тогда Chrome выберет свободный`)
    }
  }
  const profileDir = resolve(tmpdir(), `dsh-chrome-${process.pid}-${Date.now()}`)
  const chrome = spawn(executable, [
    '--headless=new',
    // Порт 0 — Chrome сам выберет свободный и запишет его в DevToolsActivePort.
    `--remote-debugging-port=${port ?? 0}`,
    `--user-data-dir=${profileDir}`,
    `--lang=${lang}`,
    `--accept-lang=${lang},ru;q=0.9,en;q=0.8`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    // Needed in containers and on CI runners; harmless on a workstation.
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--window-size=${windowSize}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  let log = ''
  chrome.stderr.on('data', (chunk) => { log += chunk.toString() })
  chrome.stdout.on('data', (chunk) => { log += chunk.toString() })

  let endpoint = port
  if (endpoint === undefined) {
    const marker = resolve(profileDir, 'DevToolsActivePort')
    for (let attempt = 0; attempt < 60 && endpoint === undefined; attempt += 1) {
      if (existsSync(marker)) {
        const [line] = readFileSync(marker, 'utf8').split('\n')
        const parsed = Number(line)
        if (Number.isInteger(parsed) && parsed > 0) endpoint = parsed
      }
      if (endpoint === undefined) await sleep(250)
    }
    if (endpoint === undefined) {
      throw new Error(`Chrome не сообщил отладочный порт (executable: ${executable})\n${log}`)
    }
  }

  let version
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${endpoint}/json/version`)
      if (response.ok) { version = await response.json(); break }
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  if (version === undefined) {
    throw new Error(`DevTools endpoint did not answer on port ${endpoint} (executable: ${executable})\n${log}`)
  }

  return {
    chrome,
    profileDir,
    version,
    async close() {
      chrome.kill('SIGTERM')
      for (let attempt = 0; attempt < 20 && chrome.exitCode === null; attempt += 1) await sleep(100)
      if (chrome.exitCode === null) chrome.kill('SIGKILL')
      await sleep(200)
      // Windows holds the profile's files for a moment after the process ends,
      // so removal is best-effort with retries; a leftover temp directory is not
      // a reason to fail the check.
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      } catch {
        // The runner cleans its temp directory anyway.
      }
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
      // Имя команды в ошибке: без него отказ протокола нечем объяснить.
    if (message.error !== undefined) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`))
      else entry.resolve(message.result)
    })
  }

  /** Закрывает вкладку вместе с её соединением. */
  close() {
    this.pending.clear()
    this.socket.close()
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
          // Screen-reader-only copy is one pixel wide on purpose.
          && node.clientWidth > 4
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
      pending.set(id, { method, resolve: resolvePromise, reject: rejectPromise })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id === undefined) return
    const entry = pending.get(message.id)
    if (entry === undefined) return
    pending.delete(message.id)
    // Имя команды в ошибке: без него отказ протокола нечем объяснить.
    if (message.error !== undefined) entry.reject(new Error(`${entry.method}: ${JSON.stringify(message.error)}`))
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
  return page
}
