#!/usr/bin/env node
/**
 * Tests the inline highlights of the last dictation: applied replacements are
 * highlighted blue, suspicious words get yellow suggestions, and a click on a
 * highlight selects the word and opens the replacement popover.
 *
 * Usage:
 *   node tools/test-highlight.mjs
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = resolve(here, '..', 'lib', 'client.js')

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

class FakeElement {
  constructor(tag = 'div') {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.style = {}
    this.children = []
    this.childNodes = []
    this.attributes = {}
    this.listeners = new Map()
    this.parentNode = null
    this.textContent = ''
    this.value = ''
  }

  focus() {}

  setAttribute(name, value) { this.attributes[name] = value }

  getAttribute(name) { return this.attributes[name] ?? null }

  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener))
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this, preventDefault() {}, ...event })
  }

  appendChild(child) {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  remove() {
    if (this.parentNode !== null) this.parentNode.children = this.parentNode.children.filter((entry) => entry !== this)
    this.parentNode = null
  }

  closest() { return this.editable === true ? this : null }
}

class FakeEventTarget {
  constructor() { this.listeners = new Map() }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener))
  }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this, preventDefault() {}, ...event })
  }
}

class FakeRecorder extends FakeEventTarget {
  stop() { this.dispatch('stop') }
}

const observerCallbacks = []
class FakeMutationObserver {
  constructor(callback) { observerCallbacks.push(callback) }
  observe() {}
  disconnect() {}
}

const selectionRanges = []
const rangeStub = {
  setStart() {},
  setEnd() {},
  getBoundingClientRect: () => ({ left: 120, top: 200, width: 64, height: 16, bottom: 216, right: 184 }),
}
const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.createElement = (tag) => new FakeElement(tag)
documentStub.body = new FakeElement('body')
documentStub.activeElement = null
documentStub.createRange = () => ({ ...rangeStub })
documentStub.execCommand = () => true
documentStub.getSelection = () => ({
  isCollapsed: false,
  rangeCount: 1,
  toString: () => 'GitHub',
  anchorNode: documentStub.activeElement,
  getRangeAt: () => rangeStub,
  removeAllRanges() {},
  addRange(range) { selectionRanges.push(range) },
})
const windowStub = new FakeEventTarget()
windowStub.innerWidth = 1200
windowStub.innerHeight = 800
windowStub.EventTarget = FakeEventTarget
windowStub.MediaRecorder = FakeRecorder
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.EventTarget = FakeEventTarget
globalThis.MutationObserver = FakeMutationObserver
globalThis.MediaRecorder = FakeRecorder
globalThis.AbortSignal = { timeout: () => undefined }
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { readText: async () => '' } }, configurable: true })

globalThis.fetch = async (url) => {
  const path = String(url)
  if (path.endsWith('/last-transcription')) return { ok: true, json: async () => ({ applied: [{ heard: 'гитхаб', chosen: 'GitHub' }] }) }
  if (path.endsWith('/dictionary')) return { ok: true, json: async () => ({ words: ['GitHub'], replacements: {} }) }
  return { ok: true, json: async () => ({ ok: true, count: 1 }) }
}

await import(`${bundle}?v=${Date.now()}`)
const plugin = windowStub.entry.factory(() => { throw new Error('no modules') })
const locale = {
  addLanguage() { return () => {} },
  register() { return () => {} },
  getSnapshot() { return { active: 'en' } },
  fallbackChain: (value) => [value],
  resolveText: (text) => text,
  translate: (namespace, key) => key,
  bind: () => (key) => key,
}
const cleanups = []
plugin.apply({
  locale,
  effect(callback) {
    const disposer = callback()
    cleanups.push(typeof disposer === 'function' ? disposer : () => {})
    return disposer
  },
})
await new Promise((resolvePromise) => setTimeout(resolvePromise, 0))

const editable = new FakeElement('div')
editable.editable = true
editable.childNodes = [{ nodeType: 3, data: 'Проверка GitHub, гитхаб и gighab' }]
documentStub.activeElement = editable
documentStub.dispatch('focusin', { target: editable })

const highlights = (kind) => documentStub.body.children.filter((element) => element.getAttribute('data-dsh-locale-ru-highlight') === kind)

console.log('подсветка после диктовки')
{
  const recorder = new windowStub.MediaRecorder()
  recorder.stop()
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('замена подсвечена синим', highlights('replaced').length === 1, String(highlights('replaced').length))
  check('подозрительные слова подсвечены жёлтым', highlights('suggestion').length === 2, String(highlights('suggestion').length))
}

console.log('клик по подсветке открывает варианты')
{
  highlights('replaced')[0].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('слово выделено', selectionRanges.length === 1, String(selectionRanges.length))
  const popover = documentStub.body.children.find((element) => element.getAttribute('data-dsh-locale-ru-dictionary') !== null)
  check('поповер открыт', popover !== undefined)
  const texts = []
  const walk = (element) => {
    if (element === undefined) return
    if (typeof element.textContent === 'string' && element.textContent !== '') texts.push(element.textContent)
    for (const child of element.children ?? []) walk(child)
  }
  walk(popover)
  check('есть кандидат GitHub', texts.includes('GitHub'), JSON.stringify(texts))
  check('есть «Вернуть: гитхаб»', texts.some((text) => text.includes('Вернуть: гитхаб')), JSON.stringify(texts))
}

console.log('Escape убирает подсветку')
{
  documentStub.dispatch('keydown', { key: 'Escape' })
  check('подсветка очищена', highlights('replaced').length === 0 && highlights('suggestion').length === 0)
}

for (const cleanup of cleanups.reverse()) cleanup()
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки подсветки пройдены')
