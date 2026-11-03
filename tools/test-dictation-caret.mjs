#!/usr/bin/env node
/**
 * Tests the caret fix of the client bundle: after a dictation insertion the
 * caret moves to the end of the composer, so the next dictation is appended
 * below the previous text instead of above it.
 *
 * Usage:
 *   node tools/test-dictation-caret.mjs
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
    this.listeners = new Map()
    this.parentNode = null
    this.textContent = ''
  }

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

  closest(selector) {
    return this.editable === true ? this : null
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener))
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, preventDefault() {}, ...event })
  }
}

/** Records the last selection written to the document. */
const selectionState = { ranges: [], removed: 0 }
const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.createElement = (tag) => new FakeElement(tag)
documentStub.body = new FakeElement('body')
documentStub.documentElement = new FakeElement('html')
documentStub.activeElement = null
documentStub.createRange = () => ({
  element: null,
  collapseToEnd: false,
  selectNodeContents(element) { this.element = element },
  collapse(value) { this.collapseToEnd = value === false },
})
documentStub.getSelection = () => ({
  removeAllRanges() { selectionState.removed += 1 },
  addRange(range) { selectionState.ranges.push(range) },
})
const windowStub = new FakeEventTarget()
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }

/** Recorders the patch tracks; the stop event marks the dictation end. */
class FakeRecorder extends FakeEventTarget {
  constructor() {
    super()
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.dispatch('stop')
  }
}

/** MutationObserver stub: keeps callbacks so tests can fire them. */
const observerCallbacks = []
let observerDisconnected = false
class FakeMutationObserver {
  constructor(callback) {
    observerCallbacks.push(callback)
  }

  observe() {}

  disconnect() {
    observerDisconnected = true
  }
}

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.EventTarget = FakeEventTarget
globalThis.MutationObserver = FakeMutationObserver
globalThis.MediaRecorder = FakeRecorder
windowStub.EventTarget = FakeEventTarget
windowStub.MediaRecorder = FakeRecorder
globalThis.AbortSignal = { timeout: () => undefined }
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) })

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
documentStub.activeElement = editable
documentStub.dispatch('focusin', { target: editable })

console.log('после остановки записи каретка уходит в конец')
{
  check('наблюдатель установлен', observerCallbacks.length === 1, String(observerCallbacks.length))
  // Рекордер создаём через пропатченный MediaRecorder: только так патч его видит.
  const recorder = new windowStub.MediaRecorder()
  recorder.stop()
  selectionState.ranges.length = 0
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
  check('каретка перенесена', selectionState.ranges.length === 1, String(selectionState.ranges.length))
  check('диапазон в конце поля', selectionState.ranges[0]?.element === editable && selectionState.ranges[0]?.collapseToEnd === true,
    JSON.stringify({ same: selectionState.ranges[0]?.element === editable, toEnd: selectionState.ranges[0]?.collapseToEnd }))
}

console.log('без свежей диктовки каретка не двигается')
{
  // Свежий экземпляр плагина: запись не останавливали, окно вставки закрыто.
  await import(`${bundle}?fresh=${Date.now()}`)
  const freshPlugin = windowStub.entry.factory(() => { throw new Error('no modules') })
  freshPlugin.apply({
    locale,
    effect(callback) {
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
  })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0))
  // Наблюдатель второго экземпляра — последний в списке.
  const freshObserver = observerCallbacks[observerCallbacks.length - 1]
  selectionState.ranges.length = 0
  freshObserver?.()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
  check('без диктовки переноса нет', selectionState.ranges.length === 0, String(selectionState.ranges.length))
}

console.log('выгрузка')
{
  for (const cleanup of cleanups.reverse()) cleanup()
  check('наблюдатель отключён', observerDisconnected === true)
  selectionState.ranges.length = 0
  observerCallbacks[0]?.()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
  check('после выгрузки каретка не двигается', selectionState.ranges.length === 0)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки переноса каретки пройдены')
