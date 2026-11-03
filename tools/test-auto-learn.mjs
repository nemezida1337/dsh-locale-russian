#!/usr/bin/env node
/**
 * Tests auto-learning of dictation corrections: after a dictation the bundle
 * captures the inserted text, and when the user edits a word inside it the
 * heard → chosen pair is posted to the host. Links, numbers and whole-phrase
 * rewrites are not learned.
 *
 * Usage:
 *   node tools/test-auto-learn.mjs
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
    this.innerText = ''
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

  closest() {
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

class FakeRecorder extends FakeEventTarget {
  stop() {
    this.dispatch('stop')
  }
}

const observerCallbacks = []
class FakeMutationObserver {
  constructor(callback) {
    observerCallbacks.push(callback)
  }

  observe() {}

  disconnect() {}
}

const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.createElement = (tag) => new FakeElement(tag)
documentStub.body = new FakeElement('body')
documentStub.activeElement = null
documentStub.createRange = () => ({ selectNodeContents() {}, collapse() {} })
documentStub.getSelection = () => ({ removeAllRanges() {}, addRange() {} })
documentStub.execCommand = () => true

const windowStub = new FakeEventTarget()
windowStub.innerWidth = 1200
windowStub.EventTarget = FakeEventTarget
windowStub.MediaRecorder = FakeRecorder
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.EventTarget = FakeEventTarget
globalThis.MutationObserver = FakeMutationObserver
globalThis.MediaRecorder = FakeRecorder
globalThis.AbortSignal = { timeout: () => undefined }

const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), method: options.method ?? 'GET', body: options.body })
  if (String(url).endsWith('/dictionary')) return { ok: true, json: async () => ({ words: [], replacements: {} }) }
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
const learnRequests = () => requests.filter((request) => request.url.endsWith('/learn'))

/** Runs one dictation: stop the recorder, then insert text and fire a mutation. */
async function dictate(before, after) {
  editable.innerText = before
  const recorder = new windowStub.MediaRecorder()
  recorder.stop()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 5))
  editable.innerText = after
  observerCallbacks[observerCallbacks.length - 1]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
}

/** Edits the composer and lets the learning debounce fire. */
async function edit(text) {
  editable.innerText = text
  observerCallbacks[observerCallbacks.length - 1]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1100))
}

console.log('правка слова после диктовки учит пару')
{
  requests.length = 0
  await dictate('Проверка ', 'Проверка гитхаб')
  await edit('Проверка GitHub')
  const learn = learnRequests()
  check('пара отправлена на /learn', learn.length === 1, JSON.stringify(requests))
  check('heard и chosen верные', learn[0] !== undefined && JSON.parse(learn[0].body).heard === 'гитхаб' && JSON.parse(learn[0].body).chosen === 'GitHub', learn[0]?.body)
  check('тост «Выучено»', documentStub.body.children.some((element) => String(element.textContent).includes('Выучено')), JSON.stringify(documentStub.body.children.map((element) => element.textContent)))
}

console.log('склейка двух слов в одно учится')
{
  requests.length = 0
  await dictate('Проверка ', 'Проверка гит хаб')
  await edit('Проверка GitHub')
  const learn = learnRequests()
  check('пара «гит хаб → GitHub»', learn.length === 1 && JSON.parse(learn[0].body).heard === 'гит хаб' && JSON.parse(learn[0].body).chosen === 'GitHub', JSON.stringify(learn.map((request) => request.body)))
}

console.log('грамматика и смысловые правки не учатся')
{
  requests.length = 0
  await dictate('Проверка ', 'Проверка сделал')
  await edit('Проверка сделала')
  check('склонение не учится', learnRequests().length === 0, JSON.stringify(learnRequests()))
  await dictate('Проверка ', 'Проверка и слово')
  await edit('Проверка а слово')
  check('служебные слова не учатся', learnRequests().length === 0, JSON.stringify(learnRequests()))
  await dictate('Проверка ', 'Проверка кот')
  await edit('Проверка пёс')
  check('другое слово не учится', learnRequests().length === 0, JSON.stringify(learnRequests()))
}

console.log('ссылки и числа не учатся')
{
  requests.length = 0
  await dictate('Смотри ', 'Смотри https://x.io')
  await edit('Смотри https://y.io')
  check('ссылка не выучена', learnRequests().length === 0, JSON.stringify(requests))
}

console.log('переписанная фраза не учится')
{
  requests.length = 0
  await dictate('Проверка ', 'Проверка гитхаб')
  await edit('Проверка GitHub и ещё')
  check('разное число слов — не учим', learnRequests().length === 0, JSON.stringify(requests))
}

console.log('без диктовки обучение не срабатывает')
{
  requests.length = 0
  editable.innerText = 'Проверка гитхаб'
  observerCallbacks[0]()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1100))
  check('без диктовки запросов нет', learnRequests().length === 0, JSON.stringify(requests))
}

console.log('выгрузка')
{
  for (const cleanup of cleanups.reverse()) cleanup()
  check('плагин выгружен без ошибок', true)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки авто-обучения пройдены')
