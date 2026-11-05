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
    this.value = ''
  }

  focus() {}

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child)
    child.parentNode = null
  }

  get firstChild() {
    return this.children[0] ?? null
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

  contains(node) {
    if (node === this) return true
    for (const child of this.children) {
      if (child === node) return true
      if (typeof child.contains === 'function' && child.contains(node)) return true
    }
    return false
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
const clipboardWrites = []
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: {
    readText: async () => 'Kubernetes\nPodman',
    writeText: async (text) => { clipboardWrites.push(text) },
  } },
  configurable: true,
})
let dictionaryWords = ['GitHub', 'Lifeshare', 'GigaAM']
let autoLearnSetting = true
let profilesState = {
  active: 'default',
  autoSwitch: true,
  profiles: [
    { id: 'default', name: 'Основной', words: 3, replacements: 1, updatedAt: 1 },
    { id: 'project', name: 'Проект', words: 10, replacements: 2, updatedAt: 2 },
  ],
  suggestion: null,
  mode: 'suggest',
  switched: null,
}
let statsState = {
  dictations: 40,
  minDictations: 30,
  words: [{ word: 'GitHub', hits: 3, lastAt: Date.now() }],
  replacements: [{ heard: 'гитхаб', chosen: 'GitHub', applied: 2, lastAt: Date.now() }],
  stale: [{ word: 'Мёртвое', hits: 0, lastAt: 0 }],
}
let reviewPairs = [{ heard: 'ngine', chosen: 'engine' }]
let modelReady = true
let doctorDelayMs = 0
const storage = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  configurable: true,
})
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method ?? 'GET', body: options.body, headers: options.headers ?? {} })
  if (url.endsWith('/profiles')) {
    return { ok: true, json: async () => ({ ...profilesState }) }
  }
  if (url.endsWith('/stats')) {
    return { ok: true, json: async () => ({ ...statsState }) }
  }
  if (url.endsWith('/stats/prune')) {
    const body = JSON.parse(options.body ?? '{}')
    if (body.dryRun === false) {
      const removed = statsState.stale.map((entry) => entry.word)
      statsState = { ...statsState, stale: [] }
      return { ok: true, json: async () => ({ ok: true, removed }) }
    }
    return { ok: true, json: async () => ({ ok: true, dryRun: true, stale: statsState.stale }) }
  }
  if (url.endsWith('/dictionary/import-url')) {
    return { ok: true, json: async () => ({ ok: true, words: 2, replacements: 1, total: 3 }) }
  }
  if (url.endsWith('/profiles/switch')) {
    try {
      const body = JSON.parse(options.body ?? '{}')
      profilesState.active = body.id
      return { ok: true, json: async () => ({ ok: true, active: body.id }) }
    } catch {
      return { ok: true, json: async () => ({ ok: true }) }
    }
  }
  if (url.endsWith('/profiles/create')) {
    const body = JSON.parse(options.body ?? '{}')
    const id = `new-${profilesState.profiles.length}`
    profilesState.profiles.push({ id, name: String(body.name ?? ''), words: 3, replacements: 1, updatedAt: Date.now() })
    profilesState.active = id
    return { ok: true, json: async () => ({ ok: true, id, name: body.name }) }
  }
  if (url.endsWith('/profiles/delete')) {
    const body = JSON.parse(options.body ?? '{}')
    profilesState.profiles = profilesState.profiles.filter((profile) => profile.id !== body.id)
    return { ok: true, json: async () => ({ ok: true }) }
  }
  if (url.endsWith('/settings')) {
    if ((options.method ?? 'GET') === 'POST') {
      const body = JSON.parse(options.body ?? '{}')
      autoLearnSetting = body.autoLearn !== false
      return { ok: true, json: async () => ({ ok: true, settings: { autoLearn: autoLearnSetting } }) }
    }
    return { ok: true, json: async () => ({ autoLearn: autoLearnSetting }) }
  }
  if (url.endsWith('/status')) {
    return { ok: true, json: async () => ({
      engine: 'gigaam',
      merge: 'sentences',
      gigaam: { binary: true, model: modelReady, modelDir: '/tmp/models' },
      whisper: { binary: true, model: true },
      dictionary: { words: 3, replacements: 1, review: 1, corrupt: false },
      settings: { autoLearn: autoLearnSetting },
      preparation: { phase: 'ready' },
    }) }
  }
  if (url.endsWith('/doctor')) {
    if (doctorDelayMs > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, doctorDelayMs));
    return { ok: true, json: async () => ({ ok: true, items: [
      { id: 'gigaam-binary', label: 'Движок GigaAM', ok: true, detail: '' },
      { id: 'gigaam-model', label: 'Модель GigaAM', ok: true, detail: '' },
    ] }) }
  }
  if (url.endsWith('/model/prepare')) {
    return { ok: true, json: async () => ({ ok: true }) }
  }
  if (url.endsWith('/review/keep') || url.endsWith('/review/forget')) {
    try {
      const heard = JSON.parse(options.body ?? '{}').heard
      reviewPairs = reviewPairs.filter((pair) => pair.heard !== heard)
    } catch {
      // оставляем очередь как есть
    }
    return { ok: true, json: async () => ({ ok: true }) }
  }
  if (url.endsWith('/review')) {
    return { ok: true, json: async () => ({ pairs: reviewPairs }) }
  }
  if (url.endsWith('/suggestions')) {
    return { ok: true, json: async () => ({ suggestions: [
      { heard: 'ngine', chosen: 'engine', score: 0.83, count: 2 },
      { heard: 'gighab', chosen: 'GitHub', score: 0.72, count: 1 },
    ] }) }
  }
  if (url.endsWith('/engine')) {
    if ((options.method ?? 'GET') === 'POST') return { ok: true, json: async () => ({ ok: true, restartRequired: true }) }
    return { ok: true, json: async () => ({ engine: 'gigaam', merge: 'auto', whisper: true }) }
  }
  if (url.endsWith('/dictionary')) {
    return { ok: true, json: async () => ({
      words: dictionaryWords,
      replacements: { 'гитхаб': 'GitHub' },
      sources: {
        words: Object.fromEntries(dictionaryWords.map((word) => [word, word === 'GitHub' ? 'project' : 'manual'])),
        replacements: { 'гитхаб': 'auto' },
      },
    }) }
  }
  return { ok: true, json: async () => ({ ok: true, count: 1 }) }
}

await import(`${bundle}?v=${Date.now()}`)
const plugin = windowStub.entry.factory(() => { throw new Error('no modules') })
let registeredNamespaces = 0
const locale = {
  addLanguage() { return () => {} },
  register() { registeredNamespaces += 1; return () => {} },
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
check('без нативного ru словари регистрируются', registeredNamespaces > 0, String(registeredNamespaces))
check('режим локали отмечен как own', globalThis.__dshLocaleRuLocaleMode === 'own', String(globalThis.__dshLocaleRuLocaleMode))

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
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 220))
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
  // Повторное событие с той же фразой не должно пересоздавать панель:
  // иначе клик по кнопке теряется.
  const before = panel()
  documentStub.dispatch('selectionchange')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 220))
  check('панель не пересоздаётся для той же фразы', panel() === before)
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

console.log('слово из словаря можно убрать')
{
  const editable = new FakeElement('div')
  editable.editable = true
  await select('GitHub', editable)
  check('есть пункт «убрать из словаря»', rows().some((text) => text.includes('убрать из словаря')), JSON.stringify(rows()))
  requests.length = 0
  row('− убрать из словаря').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  const forget = requests.find((request) => request.url.endsWith('/forget'))
  check('запрос на /forget', forget !== undefined && forget.method === 'POST', JSON.stringify(requests))
  check('тело — слово', forget !== undefined && JSON.parse(forget.body) === 'GitHub', forget?.body)
  check('тост об удалении', documentStub.body.children.some((element) => element.textContent.includes('Удалено из словаря')))
}

const modalPanel = () => {
  for (const child of documentStub.body.children) {
    const panel = (child.children ?? []).find((entry) => entry.getAttribute('data-dsh-locale-ru-modal') !== null)
    if (panel !== undefined) return panel
  }
  return undefined
}
const collectText = (element, out = []) => {
  if (element === undefined) return out
  if (typeof element.textContent === 'string' && element.textContent !== '') out.push(element.textContent)
  for (const child of element.children ?? []) collectText(child, out)
  return out
}
const modalTexts = () => collectText(modalPanel())
const modalInputs = () => {
  const inputs = []
  const walk = (element) => {
    if (element === undefined) return
    if (element.tagName === 'INPUT') inputs.push(element)
    for (const child of element.children ?? []) walk(child)
  }
  walk(modalPanel())
  return inputs
}
const findRow = (label) => {
  const walk = (element) => {
    if (element === undefined) return undefined
    if ((element.children?.[0]?.textContent ?? '') === label) return element
    for (const child of element.children ?? []) {
      const found = walk(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(modalPanel())
}
const findByText = (text) => {
  const walk = (element) => {
    if (element === undefined) return undefined
    if (String(element.textContent ?? '') === text) return element
    for (const child of element.children ?? []) {
      const found = walk(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(modalPanel())
}
const openModal = async () => {
  documentStub.dispatch('keydown', { key: 'd', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
}
const closeModal = () => {
  documentStub.dispatch('keydown', { key: 'Escape' })
}

const settingsPanel = () => {
  for (const child of documentStub.body.children) {
    const panel = (child.children ?? []).find((entry) => entry.getAttribute('data-dsh-locale-ru-settings') !== null)
    if (panel !== undefined) return panel
  }
  return undefined
}
const settingsTexts = () => {
  const texts = []
  const walk = (element) => {
    if (element === undefined) return
    if (typeof element.textContent === 'string' && element.textContent !== '') texts.push(element.textContent)
    for (const child of element.children ?? []) walk(child)
  }
  walk(settingsPanel())
  return texts
}
const findInSettings = (text) => {
  const walk = (element) => {
    if (element === undefined) return undefined
    if (String(element.textContent ?? '') === text) return element
    for (const child of element.children ?? []) {
      const found = walk(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(settingsPanel())
}
const findLineWithChild = (text) => {
  const walk = (element) => {
    if (element === undefined) return undefined
    for (const child of element.children ?? []) {
      if (String(child.textContent ?? '') === text) return element
    }
    for (const child of element.children ?? []) {
      const found = walk(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(settingsPanel())
}

console.log('модальное окно словаря')
{
  await openModal()
  check('окно открыто по Cmd+Shift+D', modalPanel() !== undefined)
  check('заголовок', modalTexts().some((text) => text.includes('Словарь распознавания')), JSON.stringify(modalTexts()))
  const inputs = modalInputs()
  check('поля добавления и поиска', inputs.length >= 2, String(inputs.length))
  check('секции слова и замен', modalTexts().some((text) => text.startsWith('Слова')) && modalTexts().some((text) => text.startsWith('Замены')), JSON.stringify(modalTexts()))
}

console.log('секция движка в модалке')
{
  const texts = modalTexts()
  check('секция «Движок»', texts.some((text) => text.includes('Движок')), JSON.stringify(texts))
  check('кнопки движков', texts.includes('GigaAM') && texts.includes('Гибрид'), JSON.stringify(texts))
  requests.length = 0
  findByText('Гибрид').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  const saved = requests.find((request) => request.url.endsWith('/engine') && request.method === 'POST')
  check('выбор движка отправлен', saved !== undefined && JSON.parse(saved.body).engine === 'hybrid', JSON.stringify(requests))
}

const toastAction = (label) => documentStub.body.children
  .flatMap((element) => element.children ?? [])
  .find((child) => String(child.textContent ?? '').includes(label))

console.log('предложения терминов и агент')
{
  const texts = modalTexts()
  check('секция «Предложения»', texts.some((text) => text.includes('Предложения')), JSON.stringify(texts))
  check('пара ngine → engine', texts.some((text) => text.includes('ngine → engine')), JSON.stringify(texts))
  requests.length = 0
  findByText('Запомнить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  const learned = requests.find((request) => request.url.endsWith('/learn') && request.method === 'POST')
  check('предложение запомнено', learned !== undefined && JSON.parse(learned.body).heard === 'ngine' && JSON.parse(learned.body).chosen === 'engine', JSON.stringify(requests))
  requests.length = 0
  const rememberAll = modalTexts().find((text) => text.startsWith('Запомнить все'))
  check('есть «Запомнить все»', rememberAll !== undefined, JSON.stringify(modalTexts()))
  findByText(rememberAll).dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  const allLearned = requests.filter((request) => request.url.endsWith('/learn') && request.method === 'POST')
  check('«Запомнить все» учит все подсказки', allLearned.length === 2, JSON.stringify(requests))
  clipboardWrites.length = 0
  findByText('Попросить агента дообучить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
  check('запрос агенту скопирован', clipboardWrites.length === 1 && clipboardWrites[0].includes('transcripts.json'), JSON.stringify(clipboardWrites))
}

console.log('очередь авто-обучения')
{
  closeModal()
  await openModal()
  check('секция «Авто-выучено»', modalTexts().some((text) => text.includes('Авто-выучено')), JSON.stringify(modalTexts()))
  requests.length = 0
  findByText('Оставить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('«Оставить» шлёт /review/keep', requests.some((request) => request.url.endsWith('/review/keep')), JSON.stringify(requests))
  reviewPairs = [{ heard: 'ngine', chosen: 'engine' }]
  closeModal()
  await openModal()
  requests.length = 0
  findByText('Убрать').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('«Убрать» шлёт /review/forget', requests.some((request) => request.url.endsWith('/review/forget')), JSON.stringify(requests))
  reviewPairs = [{ heard: 'ngine', chosen: 'engine' }]
}

console.log('фильтр по источнику')
{
  closeModal()
  await openModal()
  findByText('Из проекта').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 40))
  check('фильтр оставил слово из проекта', findRow('GitHub') !== undefined, JSON.stringify(modalTexts()))
  check('фильтр скрыл ручное слово', findRow('Lifeshare') === undefined, JSON.stringify(modalTexts()))
  findByText('Все').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 40))
}

console.log('предупреждение об обрывках')
{
  closeModal()
  dictionaryWords = ['GitHub', 'Lifeshare', 'GigaAM', 'Harness', 'DeepSeek Harness']
  await openModal()
  // Сбрасываем 30-секундный кэш словаря: «Запомнить» инвалидирует его и перечитывает.
  findByText('Запомнить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('секция «Похожие слова»', modalTexts().some((text) => text.includes('Похожие слова')), JSON.stringify(modalTexts()))
  check('обрывок показан', modalTexts().some((text) => text.includes('Harness ⊂ DeepSeek Harness')), JSON.stringify(modalTexts()))
  closeModal()
  dictionaryWords = ['GitHub', 'Lifeshare', 'GigaAM']
}

console.log('редактирование замены')
{
  await openModal()
  const pairRow = findRow('гитхаб → GitHub')
  pairRow.children[0].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const input = pairRow.children.find((child) => child.tagName === 'INPUT')
  check('появилось поле редактирования', input !== undefined, JSON.stringify(pairRow.children.map((child) => child.tagName)))
  input.value = 'GitHub Enterprise'
  requests.length = 0
  input.dispatch('keydown', { key: 'Enter', preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('изменение пары отправлено', requests.some((request) => request.url.endsWith('/learn') && JSON.parse(request.body).chosen === 'GitHub Enterprise'), JSON.stringify(requests))
}

console.log('Escape в inline-редактировании')
{
  closeModal()
  await openModal()
  const pairRow = findRow('гитхаб → GitHub')
  pairRow.children[0].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const input = pairRow.children.find((child) => child.tagName === 'INPUT')
  input.value = 'Другое'
  requests.length = 0
  input.dispatch('keydown', { key: 'Escape', preventDefault() {}, stopPropagation() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  check('Escape не закрывает модалку', modalPanel() !== undefined)
  check('Escape не сохраняет замену', !requests.some((request) => request.url.endsWith('/learn')), JSON.stringify(requests))
  closeModal()
  await openModal()
  const again = findRow('гитхаб → GitHub')
  again.children[0].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const input2 = again.children.find((child) => child.tagName === 'INPUT')
  input2.value = 'GitHub Enterprise'
  requests.length = 0
  input2.dispatch('keydown', { key: 'Enter', preventDefault() {} })
  input2.dispatch('blur')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  const saves = requests.filter((request) => request.url.endsWith('/learn') && JSON.parse(request.body).chosen === 'GitHub Enterprise')
  check('Enter+blur сохраняют один раз', saves.length === 1, String(saves.length))
}

console.log('некорректный JSON при импорте')
{
  closeModal()
  class BadReader {
    readAsText() { this.result = '{"words": ['; this.onload?.() }
  }
  const original = globalThis.FileReader
  globalThis.FileReader = BadReader
  await openModal()
  requests.length = 0
  findByText('Импорт').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const fileInput = documentStub.body.children.find((element) => element.tagName === 'INPUT' && element.type === 'file')
  fileInput.files = [{ name: 'broken.json', size: 20 }]
  fileInput.dispatch('change', { target: fileInput })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('битый JSON не импортируется', !requests.some((request) => request.url.endsWith('/hotwords')), JSON.stringify(requests))
  check('показан тост об ошибке JSON', documentStub.body.children.some((element) => String(element.textContent ?? '').includes('Некорректный JSON')))
  globalThis.FileReader = original
}

console.log('лимит импорта')
{
  closeModal()
  class ManyReader {
    readAsText() { this.result = JSON.stringify({ words: Array.from({ length: 150 }, (_, index) => `Слово${index}`) }); this.onload?.() }
  }
  const original = globalThis.FileReader
  globalThis.FileReader = ManyReader
  await openModal()
  requests.length = 0
  findByText('Импорт').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const fileInput = documentStub.body.children.find((element) => element.tagName === 'INPUT' && element.type === 'file')
  fileInput.files = [{ name: 'many.json', size: 4000 }]
  fileInput.dispatch('change', { target: fileInput })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400))
  const added = requests.filter((request) => request.url.endsWith('/hotwords'))
  check('импорт ограничен 100 словами', added.length === 100, String(added.length))
  globalThis.FileReader = original
}

console.log('обрывки: составные термины не считаются обрывками')
{
  closeModal()
  dictionaryWords = ['GitHub', 'GitHub Actions', 'DeepSeek', 'DeepSeek Harness', 'Harness']
  await openModal()
  findByText('Запомнить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  const texts = modalTexts()
  check('нет ложного обрывка GitHub ⊂ GitHub Actions', !texts.some((text) => text.includes('GitHub ⊂ GitHub Actions')), JSON.stringify(texts))
  check('настоящий обрывок Harness найден', texts.some((text) => text.includes('Harness ⊂ DeepSeek Harness')), JSON.stringify(texts))
  closeModal()
  dictionaryWords = ['GitHub', 'Lifeshare', 'GigaAM']
}

console.log('импорт из файла')
{
  closeModal()
  class FakeFileReader {
    readAsText() {
      this.result = JSON.stringify({ words: ['Kubernetes'], replacements: { 'куб': 'Kubernetes' } })
      this.onload?.()
    }
  }
  const originalFileReader = globalThis.FileReader
  globalThis.FileReader = FakeFileReader
  await openModal()
  requests.length = 0
  findByText('Импорт').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30))
  const fileInput = documentStub.body.children.find((element) => element.tagName === 'INPUT' && element.type === 'file')
  check('поле выбора файла создано', fileInput !== undefined)
  fileInput.files = [{ name: 'terms.json' }]
  fileInput.dispatch('change', { target: fileInput })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
  check('слова импортированы', requests.some((request) => request.url.endsWith('/hotwords') && JSON.parse(request.body) === 'Kubernetes'), JSON.stringify(requests))
  check('замены импортированы', requests.some((request) => request.url.endsWith('/learn') && JSON.parse(request.body).heard === 'куб'), JSON.stringify(requests))
  globalThis.FileReader = originalFileReader
}

console.log('окно настроек диктовки')
{
  closeModal()
  await openModal()
  findByText('Настройки диктовки').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('окно настроек открыто', settingsPanel() !== undefined)
  const texts = settingsTexts()
  check('секции настроек', ['Движок', 'Авто-обучение', 'Модель', 'Доктор', 'Лимиты'].every((title) => texts.some((text) => text.includes(title))), JSON.stringify(texts))
  check('статус модели', texts.some((text) => text.includes('Модель GigaAM')), JSON.stringify(texts))
  // Авто-обучение: клик по строке выключает и отправляет настройку.
  requests.length = 0
  const toggleLine = findLineWithChild('Запоминать исправления после диктовки')
  check('строка авто-обучения найдена', toggleLine !== undefined)
  toggleLine.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('авто-обучение выключено', autoLearnSetting === false && requests.some((request) => request.url.endsWith('/settings') && request.method === 'POST'), JSON.stringify(requests))
  // Динамические словари.
  const profileTexts = settingsTexts()
  check('секция «Динамические словари»', profileTexts.some((text) => text.includes('Динамические словари')), JSON.stringify(profileTexts))
  check('список словарей', profileTexts.some((text) => text.includes('Основной')) && profileTexts.some((text) => text.includes('Проект')), JSON.stringify(profileTexts))
  requests.length = 0
  const switchButton = findInSettings('Переключить')
  check('кнопка переключения словаря', switchButton !== undefined)
  switchButton.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('переключение словаря отправлено', requests.some((request) => request.url.endsWith('/profiles/switch')), JSON.stringify(requests))
  // Создание словаря.
  const findInput = (element) => {
    if (element === undefined) return undefined
    if (element.tagName === 'INPUT' && String(element.getAttribute('placeholder') ?? '').includes('Новый словарь')) return element
    for (const child of element.children ?? []) {
      const found = findInput(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  const createInput = findInput(settingsPanel())
  check('поле нового словаря', createInput !== undefined)
  createInput.value = 'Работа'
  requests.length = 0
  findInSettings('Создать').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('создание словаря отправлено', requests.some((request) => request.url.endsWith('/profiles/create') && JSON.parse(request.body).name === 'Работа'), JSON.stringify(requests))
  // Доктор.
  requests.length = 0
  findInSettings('Проверить диктовку').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('доктор запущен', requests.some((request) => request.url.endsWith('/doctor')), JSON.stringify(requests))
  check('результаты доктора', settingsTexts().some((text) => text.includes('Движок GigaAM')), JSON.stringify(settingsTexts()))
  findInSettings('Готово').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 40))
  check('окно настроек закрыто', settingsPanel() === undefined)
}

console.log('горячая клавиша настроек')
{
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('Cmd+Shift+, открывает настройки', settingsPanel() !== undefined)
  documentStub.dispatch('keydown', { key: 'Escape' })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
}

console.log('словарь: профиль, статистика, ретенция, импорт по URL')
{
  closeModal()
  await openModal()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  const texts = modalTexts()
  const activeName = profilesState.profiles.find((profile) => profile.id === profilesState.active)?.name ?? ''
  check('профиль виден в окне словаря', activeName !== '' && texts.some((text) => text.includes(activeName)), JSON.stringify(texts.filter((text) => text.includes(activeName))))
  check('счётчики статистики видны', texts.some((text) => text.includes('×3')) || requests.some((request) => request.url.endsWith('/stats')), JSON.stringify(texts.filter((text) => text.includes('×'))))
  // Переключение профиля прямо из окна словаря.
  requests.length = 0
  findByText('Сменить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  const pick = findByText('Включить')
  check('список профилей раскрылся', pick !== undefined)
  pick.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('переключение профиля из словаря отправлено', requests.some((request) => request.url.endsWith('/profiles/switch')), JSON.stringify(requests))
  // Retention: предпросмотр и удаление.
  requests.length = 0
  findByText('Неиспользуемые').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  const removeAction = toastAction('Удалить')
  check('ретенция показала кандидатов', removeAction !== undefined, JSON.stringify(modalTexts()))
  removeAction.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('ретенция удалила слова', requests.some((request) => request.url.endsWith('/stats/prune') && JSON.parse(request.body).dryRun === false), JSON.stringify(requests))
  // Импорт по URL.
  const urlInput = modalInputs().find((input) => String(input.getAttribute('placeholder') ?? '').includes('URL словаря'))
  check('поле URL импорта', urlInput !== undefined)
  urlInput.value = 'https://example.com/dict.json'
  requests.length = 0
  findByText('Импорт по URL').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('импорт по URL отправлен', requests.some((request) => request.url.endsWith('/dictionary/import-url') && JSON.parse(request.body).url === 'https://example.com/dict.json'), JSON.stringify(requests))
  closeModal()
}

console.log('настройки: двойное открытие и подготовка модели')
{
  closeModal()
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
  let panels = 0
  for (const child of documentStub.body.children) {
    if ((child.children ?? []).some((entry) => entry.getAttribute('data-dsh-locale-ru-settings') !== null)) panels += 1
  }
  check('одно окно настроек при двойном нажатии', panels === 1, String(panels))
  documentStub.dispatch('keydown', { key: 'Escape' })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
}

console.log('гонки: закрытие окон во время запросов')
{
  // Настройки: закрыть до ответа /doctor.
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  doctorDelayMs = 180
  findInSettings('Проверить диктовку').dispatch('click')
  documentStub.dispatch('keydown', { key: 'Escape' })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 320))
  doctorDelayMs = 0
  check('закрытие настроек во время /doctor не роняет', settingsPanel() === undefined)
  // Словарь: закрыть до ответа /engine.
  closeModal()
  await openModal()
  findByText('Гибрид').dispatch('click')
  documentStub.dispatch('keydown', { key: 'Escape' })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('закрытие словаря во время /engine не роняет', modalPanel() === undefined)
  // Мост закрытия окон доступен и закрывает настройки.
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('настройки открылись перед выгрузкой', settingsPanel() !== undefined)
  globalThis.__dshLocaleRuCloseWindows?.()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  check('окна закрываются при выгрузке', settingsPanel() === undefined)
}

console.log('настройки: автопереключение словаря')
{
  documentStub.dispatch('keydown', { key: ',', metaKey: true, shiftKey: true, preventDefault() {} })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  const modeLine = findLineWithChild('Переключать словарь без вопроса')
  check('строка автопереключения есть', modeLine !== undefined)
  requests.length = 0
  modeLine.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120))
  check('режим авто отправлен', requests.some((request) => request.url.endsWith('/settings') && JSON.parse(request.body).autoSwitchMode === 'auto'), JSON.stringify(requests))
  documentStub.dispatch('keydown', { key: 'Escape' })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
}

console.log('восстановление потерянной диктовки')
{
  closeModal()
  await openModal()
  const editor = documentStub.body.children.find((child) => child.getAttribute?.('contenteditable') === 'true') ?? null
  globalThis.__dshLocaleRuRecovery.show('Потерянный текст диктовки', Date.now())
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  const panel = documentStub.body.children.find((child) => child.getAttribute?.('data-dsh-locale-ru-recovery') !== null)
  check('панель восстановления появилась', panel !== undefined)
  check('текст восстановления сохранён', (storage.get('dsh-locale-ru-recovery') ?? '').includes('Потерянный текст'))
  clipboardWrites.length = 0
  const copy = [...(panel?.children ?? [])].flatMap((child) => child.children ?? []).find((child) => child.textContent === 'Скопировать')
  copy.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 60))
  check('копирование восстановленного текста', clipboardWrites.some((text) => text.includes('Потерянный текст')), JSON.stringify(clipboardWrites))
  globalThis.__dshLocaleRuRecovery.hide()
  check('панель восстановления закрывается', !documentStub.body.children.some((child) => child.getAttribute?.('data-dsh-locale-ru-recovery') !== null))
  storage.clear()
}

console.log('добавление слова через поле')
{
  closeModal()
  await openModal()
  const inputs = modalInputs()
  const addInput = inputs[0]
  addInput.value = 'Kubernetes, Podman'
  requests.length = 0
  findByText('Добавить').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  const added = requests.filter((request) => request.url.endsWith('/hotwords'))
  check('два слова добавлены', added.length === 2 && JSON.parse(added[0].body) === 'Kubernetes' && JSON.parse(added[1].body) === 'Podman', JSON.stringify(requests))
}

console.log('поиск по словарю')
{
  const inputs = modalInputs()
  const searchInput = inputs[1]
  searchInput.value = 'Giga'
  searchInput.dispatch('input')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20))
  const texts = modalTexts()
  check('фильтр работает', texts.some((text) => text.includes('GigaAM')) && !texts.some((text) => text.includes('Lifeshare')), JSON.stringify(texts))
  searchInput.value = ''
  searchInput.dispatch('input')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20))
}

console.log('удаление слова и пары из модалки')
{
  requests.length = 0
  const wordRow = findRow('GitHub')
  const removeButton = wordRow.children[wordRow.children.length - 1]
  removeButton.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('удаление слова', requests.some((request) => request.url.endsWith('/forget')), JSON.stringify(requests))
  const undoWord = toastAction('Вернуть')
  check('тост с «Вернуть» после удаления', undoWord !== undefined)
  requests.length = 0
  undoWord.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('слово возвращено', requests.some((request) => request.url.endsWith('/hotwords') && JSON.parse(request.body) === 'GitHub'), JSON.stringify(requests))
  requests.length = 0
  const pairRow = findRow('гитхаб → GitHub')
  check('строка замены найдена', pairRow !== undefined, JSON.stringify(modalTexts()))
  pairRow.children[pairRow.children.length - 1].dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('удаление пары', requests.some((request) => request.url.endsWith('/forget-pair')), JSON.stringify(requests))
  const undoPair = toastAction('Вернуть')
  check('тост с «Вернуть» после удаления пары', undoPair !== undefined)
  requests.length = 0
  undoPair.dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 80))
  check('пара возвращена', requests.some((request) => request.url.endsWith('/learn') && JSON.parse(request.body).heard === 'гитхаб'), JSON.stringify(requests))
}

console.log('экспорт словаря')
{
  // В тестовом окружении нет DOM-скачивания — проверяем clipboard-fallback.
  const originalCreate = URL.createObjectURL
  URL.createObjectURL = undefined
  clipboardWrites.length = 0
  findByText('Экспорт').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  const exported = clipboardWrites.find((text) => text.includes('"words"') && text.includes('"replacements"'))
  check('словарь экспортирован в буфер (fallback)', exported !== undefined, JSON.stringify(clipboardWrites.map((text) => text.slice(0, 40))))
  URL.createObjectURL = originalCreate
}

console.log('буфер обмена в модалке')
{
  requests.length = 0
  findByText('＋ из буфера обмена').dispatch('click')
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  const added = requests.filter((request) => request.url.endsWith('/hotwords'))
  check('слова из буфера', added.length === 2, JSON.stringify(requests))
}

console.log('Escape закрывает модалку')
{
  closeModal()
  check('модалка закрыта', modalPanel() === undefined)
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
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 220))
  check('после выгрузки поповер не появляется', panel() === undefined)
}

console.log('нативный русский: свои словари не регистрируются')
{
  let nativeRegistrations = 0
  const nativeLocale = {
    addLanguage() { throw new Error('locale "ru" is already registered') },
    register() { nativeRegistrations += 1; return () => {} },
    getSnapshot() { return { active: 'ru' } },
    fallbackChain: (value) => [value],
    resolveText: (text) => text,
    translate: () => '',
    bind: () => () => '',
  }
  await import(`${bundle}?v=${Date.now() + 1}`)
  const nativePlugin = windowStub.entry.factory(() => { throw new Error('no modules') })
  const nativeCleanups = []
  nativePlugin.apply({
    locale: nativeLocale,
    effect(callback) {
      const disposer = callback()
      nativeCleanups.push(typeof disposer === 'function' ? disposer : () => {})
      return disposer
    },
  })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0))
  check('при нативном ru нет чужих регистраций', nativeRegistrations === 0, String(nativeRegistrations))
  check('режим локали отмечен как native', globalThis.__dshLocaleRuLocaleMode === 'native', String(globalThis.__dshLocaleRuLocaleMode))
  for (const cleanup of nativeCleanups.reverse()) cleanup()
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки поповера словаря пройдены')
