#!/usr/bin/env node
/**
 * Tests the voice keep-alive patch in the client bundle: the stock cancel-on-blur
 * and cancel-on-hidden listeners are suppressed (other blur listeners still run),
 * the recording indicator appears and is cleared, and everything is restored on
 * dispose.
 *
 * Runs with minimal DOM stubs: no browser and no microphone are needed.
 *
 * Usage:
 *   node tools/test-voice-keepalive.mjs
 */
import { readFileSync } from 'node:fs'
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

/** Minimal event target. */
class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    if (typeof listener !== 'function') return
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    this.listeners.set(type, list.filter((entry) => entry !== listener))
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event)
    return true
  }
}

/** Minimal MediaRecorder: `state` is controlled by the test. */
class FakeMediaRecorder extends FakeEventTarget {
  constructor() {
    super()
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.dispatchEvent({ type: 'stop' })
  }
}

/** Notification stub that records what was shown. */
const notifications = []
class FakeNotification {
  static permission = 'granted'
  constructor(title, options) {
    this.title = title
    this.options = options
    this.closed = false
    notifications.push(this)
  }

  close() {
    this.closed = true
  }
}

// Собираем окно и документ до загрузки бандла.
const windowStub = new FakeEventTarget()
windowStub.EventTarget = FakeEventTarget
windowStub.MediaRecorder = FakeMediaRecorder
windowStub.__ModuleLoader__ = { load(entry) { windowStub.entry = entry } }
const documentStub = new FakeEventTarget()
documentStub.title = 'DeepSeek Harness'
documentStub.hidden = false
// Минимальный DOM для бейджа.
const created = []
documentStub.createElement = () => {
  const element = {
    style: {},
    textContent: '',
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value },
    remove() { this.removed = true },
  }
  created.push(element)
  return element
}
documentStub.body = { children: [], appendChild(element) { this.children.push(element); element.parentNode = this } }

globalThis.window = windowStub
globalThis.document = documentStub
globalThis.Notification = FakeNotification
globalThis.EventTarget = FakeEventTarget

await import(`${bundle}?v=${Date.now()}`)
const plugin = windowStub.entry.factory(() => { throw new Error('no modules') })

/** Minimal locale so the bundle activates. */
const locale = {
  languages: [],
  addLanguage(definition) { this.languages.push(definition); return () => {} },
  register() { return () => {} },
  getSnapshot() { return { active: 'en' } },
  fallbackChain(locale) { return [locale] },
  resolveText(text) { return text },
  translate(ns, key) { return key },
  bind(ns) { return (key) => key },
}
const cleanups = []
const ctx = {
  locale,
  effect(callback) {
    const disposer = callback()
    cleanups.push(typeof disposer === 'function' ? disposer : () => {})
    return disposer
  },
}

console.log('установка патча')
plugin.apply(ctx)
check('MediaRecorder заменён', windowStub.MediaRecorder !== FakeMediaRecorder)
check('заголовок не изменён без записи', documentStub.title === 'DeepSeek Harness')

console.log('отмена на blur подавлена')
{
  const recorder = new windowStub.MediaRecorder()
  check('запись отслеживается', recorder.state === 'recording')
  let cancelled = false
  // Источник повторяет штатный обработчик из клиента голосового ввода.
  const stockBlur = () => {
    if (undefined?.phase === 'recording') cancelled = true
    cancel()
  }
  windowStub.addEventListener('blur', stockBlur)
  let otherCalled = false
  const otherBlur = () => { otherCalled = true }
  windowStub.addEventListener('blur', otherBlur)
  windowStub.dispatchEvent({ type: 'blur' })
  check('штатная отмена не сработала', cancelled === false)
  check('наш обработчик сработал', documentStub.title.startsWith('● Диктовка — '), documentStub.title)
  check('показано уведомление', notifications.length === 1 && notifications[0].title === 'Диктовка продолжается')
  check('показан бейдж в окне', created.length === 1 && created[0].textContent.includes('Диктовка идёт в фоне'))
  check('чужие blur-обработчики не тронуты', otherCalled)

  recorder.stop()
  check('индикатор снят после остановки', documentStub.title === 'DeepSeek Harness', documentStub.title)
  check('бейдж убран', created[0].removed === true)
  check('уведомление закрыто', notifications[0].closed === true)
}

console.log('скрытая страница подавлена')
{
  const recorder = new windowStub.MediaRecorder()
  let cancelled = false
  const stockVisibility = () => {
    if (documentStub.hidden && current && current.phase !== 'transcribing') cancelled = true
    cancel()
  }
  documentStub.addEventListener('visibilitychange', stockVisibility)
  documentStub.hidden = true
  documentStub.dispatchEvent({ type: 'visibilitychange' })
  check('отмена на скрытой странице не сработала', cancelled === false)
  check('индикатор показан', documentStub.title.startsWith('● Диктовка — '))
  documentStub.hidden = false
  recorder.stop()
  check('индикатор снят', documentStub.title === 'DeepSeek Harness')
}

console.log('снятие патча')
{
  for (const cleanup of cleanups.reverse()) cleanup()
  check('addEventListener восстановлен', windowStub.addEventListener === FakeEventTarget.prototype.addEventListener)
  check('MediaRecorder восстановлен', windowStub.MediaRecorder === FakeMediaRecorder)
  let called = false
  windowStub.addEventListener('blur', () => { called = true })
  windowStub.dispatchEvent({ type: 'blur' })
  check('после снятия обработчики снова работают', called)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки сохранения диктовки пройдены')
