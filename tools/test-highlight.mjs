#!/usr/bin/env node
/**
 * Tests the inline highlights of the last dictation: only the freshly inserted
 * fragment is decorated, stale transcriptions are ignored, overlays follow
 * scroll and disappear on typing/outside clicks, and a click selects the word.
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

  get innerText() {
    const textOf = (node) => {
      if (node === null || node === undefined) return ''
      if (node.nodeType === 3) return String(node.data ?? '')
      if (node.nodeType !== 1) return ''
      const tag = String(node.tagName ?? '').toUpperCase()
      if (tag === 'BR') return '\n'
      const inner = (node.childNodes ?? []).map(textOf).join('')
      if (tag === 'P') return `${inner}\n\n`
      return /^(DIV|LI)$/u.test(tag) ? `${inner}\n` : inner
    }
    return (this.childNodes ?? []).map(textOf).join('')
  }

  focus() {}

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child)
    this.childNodes = this.childNodes.filter((entry) => entry !== child)
    child.parentNode = null
  }

  get firstChild() {
    return this.children[0] ?? null
  }

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

  contains(target) {
    return this === target || this.children.includes(target) || this.childNodes.includes(target)
  }
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

const createdRanges = []
const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.createElement = (tag) => new FakeElement(tag)
documentStub.body = new FakeElement('body')
documentStub.activeElement = null
documentStub.createRange = () => {
  const range = {
    startIndex: -1,
    endIndex: -1,
    setStart(node, index) { this.startNode = node; this.startIndex = index },
    setEnd(node, index) { this.endNode = node; this.endIndex = index },
    getBoundingClientRect: () => ({ left: 120, top: 200, width: 64, height: 16, bottom: 216, right: 184 }),
  }
  createdRanges.push(range)
  return range
}
documentStub.execCommand = () => true
documentStub.getSelection = () => ({
  isCollapsed: false,
  rangeCount: 1,
  toString: () => 'GitHub',
  anchorNode: documentStub.activeElement,
  getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 120, top: 200, width: 64, height: 16 }) }),
  removeAllRanges() {},
  addRange() {},
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

let transcriptionAt = Date.now()
globalThis.fetch = async (url) => {
  const path = String(url)
  if (path.endsWith('/last-transcription')) {
    return { ok: true, json: async () => ({ at: transcriptionAt, applied: [{ heard: 'гитхаб', chosen: 'GitHub' }] }) }
  }
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
documentStub.activeElement = editable
documentStub.dispatch('focusin', { target: editable })

const highlights = (kind) => documentStub.body.children.filter((element) => element.getAttribute('data-dsh-locale-ru-highlight') === kind)

/** Runs one dictation: before-text, insertion, observer callback. */
async function dictate(before, after) {
  editable.childNodes = [{ nodeType: 3, data: before }]
  const recorder = new windowStub.MediaRecorder()
  recorder.stop()
  editable.childNodes = [{ nodeType: 3, data: after }]
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
}

console.log('подсветка только внутри вставленного фрагмента')
{
  const before = 'Проверка GitHub в старом тексте. '
  const after = `${before}Продиктовано: GitHub, гитхаб и gighab`
  await dictate(before, after)
  check('замена подсвечена один раз', highlights('replaced').length === 1, String(highlights('replaced').length))
  const replacedRange = createdRanges.find((range) => range.startIndex >= before.length)
  check('замена внутри вставки, а не в старом тексте', replacedRange !== undefined, JSON.stringify(createdRanges.map((range) => range.startIndex)))
  check('подозрительные слова подсвечены', highlights('suggestion').length === 2, String(highlights('suggestion').length))
}

console.log('старая транскрипция не подсвечивается')
{
  documentStub.dispatch('input', {})
  transcriptionAt = Date.now() - 60000
  await dictate('Старый текст. ', 'Старый текст. Новый GitHub')
  check('устаревшая транскрипция проигнорирована', highlights('replaced').length === 0 && highlights('suggestion').length === 0)
}

console.log('ввод и клик вне подсветки снимают её')
{
  transcriptionAt = Date.now()
  await dictate('Текст. ', 'Текст. Свежий GitHub')
  check('подсветка появилась', highlights('replaced').length === 1)
  documentStub.dispatch('input', {})
  check('ввод очистил подсветку', highlights('replaced').length === 0)
  await dictate('Текст. ', 'Текст. Ещё GitHub')
  check('подсветка появилась снова', highlights('replaced').length === 1)
  documentStub.dispatch('pointerdown', { target: new FakeElement('div') })
  check('клик вне подсветки очистил её', highlights('replaced').length === 0)
}

console.log('клик по подсветке открывает варианты')
{
  transcriptionAt = Date.now()
  await dictate('Текст. ', 'Текст. GitHub')
  check('есть подсветка для клика', highlights('replaced').length === 1, String(highlights('replaced').length))
  highlights('replaced')[0].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
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

console.log('вставка в середину текста')
{
  transcriptionAt = Date.now()
  const beforeCount = createdRanges.length
  await dictate('Начало конец', 'Начало GitHub конец')
  check('подсветка в середине вставки', highlights('replaced').length === 1, String(highlights('replaced').length))
  const middle = createdRanges.slice(beforeCount).filter((range) => range.startIndex === 'Начало '.length)
  check('диапазон вставки в середине', middle.length === 1, JSON.stringify(createdRanges.map((range) => range.startIndex)))
}

console.log('несколько диктовок подряд')
{
  transcriptionAt = Date.now()
  await dictate('Первый. ', 'Первый. GitHub')
  check('первая диктовка подсвечена', highlights('replaced').length === 1)
  await dictate('Первый. GitHub. ', 'Первый. GitHub. Ещё GitHub')
  check('вторая диктовка перерисовала подсветку', highlights('replaced').length === 1)
  const secondRanges = createdRanges.filter((range) => range.startIndex >= 'Первый. GitHub. '.length)
  check('подсветка относится ко второй вставке', secondRanges.length >= 1, JSON.stringify(createdRanges.map((range) => range.startIndex)))
}

console.log('переносы строк в тексте')
{
  transcriptionAt = Date.now()
  await dictate('Строка. ', 'Строка. Перенос GitHub\nвторая строка')
  check('подсветка с переносом строки', highlights('replaced').length === 1, String(highlights('replaced').length))
}

console.log('ввод гасит подсветку насовсем (P2)')
{
  transcriptionAt = Date.now()
  await dictate('Текст. ', 'Текст. GitHub')
  check('подсветка появилась', highlights('replaced').length === 1)
  documentStub.dispatch('input', {})
  check('ввод снял подсветку', highlights('replaced').length === 0)
  // Мутация после ввода не должна вернуть оверлеи.
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('после ввода подсветка не возвращается', highlights('replaced').length === 0, String(highlights('replaced').length))
}

console.log('observer не удаляет собственную подсветку (P1)')
{
  transcriptionAt = Date.now()
  await dictate('Текст. ', 'Текст. GitHub')
  check('подсветка после диктовки', highlights('replaced').length === 1, String(highlights('replaced').length))
  // Мутация от добавления оверлея: observer должен её игнорировать.
  const overlayNode = { nodeType: 1, getAttribute: () => 'replaced' }
  observerCallbacks[0]([{ addedNodes: [overlayNode], removedNodes: [] }])
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('overlay добавление не снимает подсветку', highlights('replaced').length === 1, String(highlights('replaced').length))
  // Обычная мутация текста без input (например, редактор перерисовался) тоже
  // не должна снимать уже нарисованную подсветку.
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('повторный observer не снимает подсветку', highlights('replaced').length === 1, String(highlights('replaced').length))
}

console.log('абзацы и переносы строк (реальная блочная DOM)')
{
  transcriptionAt = Date.now()
  editable.childNodes = [{ nodeType: 1, tagName: 'P', childNodes: [{ nodeType: 3, data: 'Строка. ' }] }]
  const recorder = new windowStub.MediaRecorder()
  recorder.stop()
  editable.childNodes = [
    { nodeType: 1, tagName: 'P', childNodes: [{ nodeType: 3, data: 'Строка. ' }] },
    { nodeType: 1, tagName: 'P', childNodes: [{ nodeType: 3, data: 'Перенос GitHub' }] },
  ]
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
  check('подсветка в абзаце', highlights('replaced').length === 1, String(highlights('replaced').length))
}

console.log('Escape убирает подсветку')
{
  transcriptionAt = Date.now()
  await dictate('Текст. ', 'Текст. GitHub')
  documentStub.dispatch('keydown', { key: 'Escape' })
  check('подсветка очищена', highlights('replaced').length === 0 && highlights('suggestion').length === 0)
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('после Escape подсветка не возвращается', highlights('replaced').length === 0)
}

for (const cleanup of cleanups.reverse()) cleanup()
if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки подсветки пройдены')
