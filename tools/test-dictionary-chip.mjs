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
let reviewPairs = [{ heard: 'ngine', chosen: 'engine' }]
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method ?? 'GET', body: options.body })
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

console.log('добавление слова через поле')
{
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

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки поповера словаря пройдены')
