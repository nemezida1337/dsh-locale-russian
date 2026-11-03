#!/usr/bin/env node
/**
 * Tests the dictionary popover of the client bundle: a selection inside the
 * composer gets replacement candidates from the personal dictionary, picking
 * one replaces the selection and teaches the pair, and "add to dictionary"
 * still works when no candidate fits.
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
documentStub.execCommand = (command, _show, value) => {
  documentStub.execCalls.push({ command, value })
  return true
}
documentStub.execCalls = []
let selection = {
  isCollapsed: true,
  rangeCount: 0,
  toString: () => '',
  anchorNode: null,
  getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 120 }) }),
}
documentStub.getSelection = () => selection
const windowStub = new FakeEventTarget()
windowStub.innerWidth = 1200
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.EventTarget = FakeEventTarget
globalThis.AbortSignal = { timeout: () => undefined }

const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method ?? 'GET', body: options.body })
  if (url.endsWith('/dictionary')) {
    return { ok: true, json: async () => ({ words: ['GitHub', 'Lifeshare', 'GigaAM'], replacements: {} }) }
  }
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

const panel = () => documentStub.body.children.find((element) => element.getAttribute('data-dsh-locale-ru-dictionary') !== null)
const rows = () => (panel()?.children ?? []).map((child) => child.textContent)
const row = (text) => (panel()?.children ?? []).find((child) => child.textContent === text)

/** Puts a selection into the editable and waits for the async popover. */
async function select(phrase, editable) {
  selection = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => phrase,
    anchorNode: editable,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 120 }) }),
  }
  documentStub.dispatch('selectionchange')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
}

console.log('кандидаты для выделенного слова')
{
  const editable = new FakeElement('div')
  editable.editable = true
  await select('гитхаб', editable)
  check('поповер показан', panel() !== undefined)
  check('заголовок с выделенным словом', rows().some((text) => text.includes('гитхаб')), JSON.stringify(rows()))
  check('кандидат GitHub найден', row('GitHub') !== undefined, JSON.stringify(rows()))
  check('есть пункт «в словарь»', rows().some((text) => text.includes('в словарь')), JSON.stringify(rows()))
}

console.log('выбор кандидата заменяет и учит')
{
  requests.length = 0
  documentStub.execCalls.length = 0
  row('GitHub').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  check('замена через execCommand', documentStub.execCalls.some((call) => call.command === 'insertText' && call.value === 'GitHub'), JSON.stringify(documentStub.execCalls))
  const learn = requests.find((request) => request.url.endsWith('/learn'))
  check('пара отправлена на /learn', learn !== undefined && learn.method === 'POST', JSON.stringify(requests))
  check('тело — heard и chosen', learn !== undefined && JSON.parse(learn.body).heard === 'гитхаб' && JSON.parse(learn.body).chosen === 'GitHub', learn?.body)
  check('поповер скрыт', panel() === undefined)
  check('тост о замене', documentStub.body.children.some((element) => element.textContent.includes('Заменено')))
}

console.log('без кандидатов — только добавление в словарь')
{
  const editable = new FakeElement('div')
  editable.editable = true
  await select('Проверка', editable)
  check('поповер с добавлением', panel() !== undefined && rows().some((text) => text.includes('в словарь')), JSON.stringify(rows()))
  requests.length = 0
  row('＋ «Проверка» в словарь').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  const add = requests.find((request) => request.url.endsWith('/hotwords'))
  check('фраза отправлена на /hotwords', add !== undefined && add.method === 'POST', JSON.stringify(requests))
  check('в JSON-строке', add !== undefined && JSON.parse(add.body) === 'Проверка', add?.body)
}

console.log('вне поля ввода поповера нет')
{
  const plain = new FakeElement('div')
  await select('гитхаб', plain)
  check('вне contenteditable поповера нет', panel() === undefined)
}

console.log('выгрузка')
{
  for (const cleanup of cleanups.reverse()) cleanup()
  check('поповер удалён', panel() === undefined)
  selection = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => 'гитхаб',
    anchorNode: Object.assign(new FakeElement('div'), { editable: true }),
    getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 10, left: 10, bottom: 20 }) }),
  }
  documentStub.dispatch('selectionchange')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  check('после выгрузки поповер не появляется', panel() === undefined)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки поповера словаря пройдены')
