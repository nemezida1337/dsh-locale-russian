#!/usr/bin/env node
/**
 * Tests the "+ в словарь" chip of the client bundle: it appears only for a text
 * selection inside an editable field, sends the phrase to the host endpoint, and
 * disappears together with the plugin.
 *
 * Usage:
 *   node tools/test-dictionary-chip.mjs
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

/** Minimal element: styles, attributes, listeners and children. */
class FakeElement {
  constructor(tag = 'div') {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.style = {}
    this.children = []
    this.attributes = {}
    this.listeners = new Map()
    this.parentNode = null
    this.textContent = ''
  }

  setAttribute(name, value) {
    this.attributes[name] = value
  }

  getAttribute(name) {
    return this.attributes[name] ?? null
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

/** Minimal event target for window/document. */
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

const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.createElement = (tag) => new FakeElement(tag)
documentStub.body = new FakeElement('body')
let selection = { isCollapsed: true, rangeCount: 0, toString: () => '', anchorNode: null, getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 120 }) }) }
documentStub.getSelection = () => selection
const windowStub = new FakeEventTarget()
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.EventTarget = FakeEventTarget

const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, body: options.body })
  return { ok: true, json: async () => ({ ok: true, count: 1 }) }
}
globalThis.AbortSignal = { timeout: () => undefined }

await import(`${bundle}?v=${Date.now()}`)
const plugin = windowStub.entry.factory(() => { throw new Error('no modules') })

/** Minimal locale so the bundle activates. */
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

const chip = () => documentStub.body.children.find((element) => element.getAttribute('data-dsh-locale-ru-dictionary') !== null)

console.log('кнопка появляется при выделении в поле ввода')
{
  const editable = new FakeElement('div')
  editable.editable = true
  selection = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => 'configHotwords',
    anchorNode: editable,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 120 }) }),
  }
  documentStub.dispatch('selectionchange')
  check('кнопка создана', chip() !== undefined)
  check('текст кнопки', chip()?.textContent === '+ в словарь', chip()?.textContent)
}

console.log('клик отправляет фразу в хост')
{
  chip().dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  check('запрос ушёл', requests.length === 1 && requests[0].url.includes('/hotwords'), JSON.stringify(requests))
  check('тело запроса — фраза', requests[0]?.body === 'configHotwords', requests[0]?.body)
  check('кнопка скрылась после клика', chip() === undefined)
  check('показан тост', documentStub.body.children.some((element) => element.textContent === 'Добавлено в словарь'))
}

console.log('вне поля ввода и при пустом выделении кнопки нет')
{
  const plain = new FakeElement('div')
  selection = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => 'configHotwords',
    anchorNode: plain,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 120 }) }),
  }
  documentStub.dispatch('selectionchange')
  check('вне contenteditable кнопки нет', chip() === undefined)
  selection = { isCollapsed: true, rangeCount: 0, toString: () => '', anchorNode: null, getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0 }) }) }
  documentStub.dispatch('selectionchange')
  check('пустое выделение — кнопки нет', chip() === undefined)
}

console.log('выгрузка')
{
  for (const cleanup of cleanups.reverse()) cleanup()
  check('кнопка удалена', chip() === undefined)
  const before = requests.length
  selection = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => 'GigaAM',
    anchorNode: Object.assign(new FakeElement('div'), { editable: true }),
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 10, left: 10, bottom: 20 }) }),
  }
  documentStub.dispatch('selectionchange')
  check('после выгрузки кнопка не появляется', chip() === undefined && requests.length === before)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки кнопки «+ в словарь» пройдены')
