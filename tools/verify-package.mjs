#!/usr/bin/env node
/**
 * Loads the built browser bundle the way the client module system does and
 * asserts the language, dictionaries, plural selection, and pass-through
 * behavior for other locales.
 *
 * Usage:
 *   node tools/verify-package.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const bundlePath = resolve(root, 'lib/client.js')

/** Minimal stand-in for the shipped LocaleRuntime, matching its lookup chain. */
class FakeLocale {
  constructor() {
    this.dicts = new Map()
    this.languages = []
    this.active = 'en'
    this.bound = new Map()
    this.fallback = new Map()
  }

  addLanguage(definition) {
    this.languages.push(definition)
    this.fallback.set(definition.id, definition.fallback)
    return () => {}
  }

  register(ns, localeOrDicts, maybeDict) {
    if (!this.dicts.has(ns)) this.dicts.set(ns, new Map())
    const target = this.dicts.get(ns)
    if (typeof localeOrDicts === 'string') {
      target.set(localeOrDicts, { ...(target.get(localeOrDicts) ?? {}), ...maybeDict })
      return () => {}
    }
    for (const [locale, dict] of Object.entries(localeOrDicts)) {
      target.set(locale, { ...(target.get(locale) ?? {}), ...dict })
    }
    return () => {}
  }

  getSnapshot() {
    return { active: this.active, locales: this.languages, revision: 0 }
  }

  subscribe() { return () => {} }

  bind(ns) {
    let t = this.bound.get(ns)
    if (!t) {
      t = (key, params) => this.translate(ns, key, params)
      this.bound.set(ns, t)
    }
    return t
  }

  fallbackChain(locale) {
    const chain = []
    let current = locale
    while (current !== undefined && !chain.includes(current)) {
      chain.push(current)
      current = this.fallback.get(current)
    }
    return chain
  }

  lookup(ns, key, chain) {
    const locales = this.dicts.get(ns)
    for (const locale of chain) {
      const value = locales?.get(locale)?.[key]
      if (value !== undefined) return value
    }
    return undefined
  }

  resolveText(text) {
    if (typeof text === 'string') return text
    return this.fallbackChain(this.active).reduceRight(
      (resolved, locale) => text[locale] ?? resolved,
      text.en,
    )
  }

  translate(ns, key, params) {
    const chain = this.fallbackChain(this.active)
    const template = this.lookup(ns, key, chain) ?? (ns !== 'common' ? this.lookup('common', key, chain) : undefined) ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match)
  }
}

/**
 * DSH 0.2.2 registers the Russian language and a few namespaces itself and
 * rejects duplicates: the pack must complement that catalog instead of failing.
 */
class StrictLocale extends FakeLocale {
  addLanguage(definition) {
    if (this.languages.some((language) => language.id === definition.id)) {
      throw new Error(`locale "${definition.id}" is already registered`)
    }
    return super.addLanguage(definition)
  }

  register(ns, localeOrDicts, maybeDict) {
    const locales = typeof localeOrDicts === 'string' ? [localeOrDicts] : Object.keys(localeOrDicts)
    const existing = this.dicts.get(ns)
    for (const locale of locales) {
      if (existing?.has(locale)) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`)
    }
    return super.register(ns, localeOrDicts, maybeDict)
  }
}

let captured
const windowStub = {
  __ModuleLoader__: {
    load(entry) { captured = entry },
  },
}
globalThis.window = windowStub
await import(`${bundlePath}?v=${Date.now()}`)
if (captured === undefined) throw new Error('bundle did not register a module')
const plugin = captured.factory(() => { throw new Error('the language pack requires no modules') })

const failures = []
const notes = []
const check = (condition, message) => {
  if (condition) notes.push(`ok   ${message}`)
  else failures.push(message)
}

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
check(captured.id === manifest.name, `module id equals the package name (${captured.id} vs ${manifest.name})`)
check(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'manifest declares the bundle patch')
check(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8').includes(`name: ${manifest.name}`), 'bundle patch names the package')
check(typeof plugin.apply === 'function', 'apply is exported')
check(Array.isArray(plugin.inject) && plugin.inject.includes('locale'), 'inject declares the locale service')

const locale = new FakeLocale()
const disposers = []
const ctx = {
  locale,
  effect(callback) {
    const disposer = callback()
    disposers.push(typeof disposer === 'function' ? disposer : () => {})
    return disposers[disposers.length - 1]
  },
}
plugin.apply(ctx)
// Клиентская половина регистрирует язык и словари на следующем тике: каталог
// локали и соседние клиентские плагины успевают активироваться (см. шаблон).
await new Promise((resolve) => setTimeout(resolve, 0))

const bundles = JSON.parse(readFileSync(resolve(root, 'dictionary/ru.json'), 'utf8'))
const bundleNamespaces = Object.keys(bundles).length
const bundleKeys = Object.values(bundles).reduce((sum, keys) => sum + Object.keys(keys).length, 0)
const registeredNamespaces = [...locale.dicts.keys()].filter((ns) => locale.dicts.get(ns).has('ru'))

check(locale.languages.some((language) => language.id === 'ru'), 'ru language is registered')
check(locale.fallback.get('ru') === 'en', 'ru falls back to en')
check(registeredNamespaces.length === bundleNamespaces, `registered ${registeredNamespaces.length}/${bundleNamespaces} namespaces`)

// English dictionaries stand in for the shipped built-ins of other namespaces.
locale.addLanguage({ id: 'zh', label: '中文', fallback: 'en' })
locale.register('common', { en: { cancel: 'Cancel', retry: 'Retry' }, zh: { cancel: '取消' } })
locale.register('demo', {
  en: { 'items.count.one': '{n} item', 'items.count.other': '{n} items', 'plain': 'Plain' },
})
locale.register('demo', 'ru', {
  'items.count.one': '{n} элемент',
  'items.count.other': '{n} элемента|{n} элементов',
  'plain': 'Обычный',
})

const t = locale.bind('demo')
locale.active = 'ru'
check(t('plain') === 'Обычный', 'plain copy uses the Russian dictionary')
check(t('items.count.one', { n: 1 }) === '1 элемент', 'one form for n=1')
check(t('items.count.one', { n: 21 }) === '21 элемент', 'one form for n=21')
check(t('items.count.other', { n: 2 }) === '2 элемента', 'few form for n=2')
check(t('items.count.other', { n: 4 }) === '4 элемента', 'few form for n=4')
check(t('items.count.other', { n: 5 }) === '5 элементов', 'many form for n=5')
check(t('items.count.other', { n: 21 }) === '21 элемент', 'other key borrows the one form for n=21')
check(t('items.count.other', { n: 22 }) === '22 элемента', 'few form for n=22')
check(t('items.count.other', { n: 11 }) === '11 элементов', 'many form for n=11')
check(t('items.count.other', { n: 101 }) === '101 элемент', 'one form for n=101')
check(t('items.count.other', { count: 3 }) === '3 элемента', 'a count parameter under another name is honored')
check(t('items.count.other', { count: '12.5K' }) === '12.5K элементов', 'a formatted count string selects the many form')
check(t('items.count.other', { count: '1' }) === '1 элемент', 'a formatted single count selects the one form')
check(t('items.count.other', {}) === '{n} элементов', 'a call without any count uses the many form and keeps the placeholder')
locale.register('demo', 'ru', { 'plain.multi': 'форма|формы|форм' })
check(t('plain.multi') === 'форм', 'a value with three forms and no call count uses the many form')
check(t('missing.key') === 'missing.key', 'unknown keys still render their key')

// Plugin display metadata: package descriptions arrive English-only and are
// resolved through resolveText, so the wrapper must translate them for ru and
// leave every other locale alone.
const pluginText = JSON.parse(readFileSync(resolve(root, 'dictionary/plugin-meta.json'), 'utf8'))
const sample = Object.entries(pluginText)[0]
if (sample === undefined) {
  notes.push('skip plugin display text: the table is empty')
} else {
  const [source, translated] = sample
  locale.active = 'ru'
  check(locale.resolveText(source) === translated, 'plugin description resolves to Russian')
  check(locale.resolveText({ en: source }) === translated, 'an English-only LocalizedText resolves to Russian')
  check(locale.resolveText({ en: source, ru: 'Своё описание' }) === 'Своё описание', 'a package-provided ru value wins')
  locale.active = 'en'
  check(locale.resolveText(source) === source, 'plugin description stays English while en is active')
}

locale.active = 'en'
check(t('items.count.other', { n: 5 }) === '5 items', 'English copy is untouched')
check(t('plain') === 'Plain', 'English dictionary wins while en is active')
locale.active = 'zh'
check(t('plain') === 'Plain', 'a locale without a dictionary falls back to en')

// DSH 0.2.2 ships its own Russian catalog: our plugin must not throw on the
// occupied slots, must override the built-in copy with its own translation, and
// must restore the built-in copy on dispose.
{
  const strict = new StrictLocale()
  strict.addLanguage({ id: 'en', label: 'English', fallback: 'en' })
  strict.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' })
  strict.register('common', { ru: { 'builtin.only': 'встроенный', cancel: 'Встроенная отмена' } })
  strict.active = 'ru'
  const strictDisposers = []
  let strictError
  try {
    plugin.apply({
      locale: strict,
      effect(callback) {
        const disposer = callback()
        strictDisposers.push(typeof disposer === 'function' ? disposer : () => {})
        return disposer
      },
    })
  } catch (error) {
    strictError = error
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
  check(strictError === undefined, 'activation does not throw when the built-in catalog occupies slots')
  check(strict.languages.filter((language) => language.id === 'ru').length === 1, 'the built-in ru language is not duplicated')
  check(strict.translate('common', 'cancel') === 'Отмена', 'our copy overrides the built-in dictionary in an occupied namespace')
  check(strict.translate('common', 'builtin.only') === 'встроенный', 'a key missing from our table still comes from the built-in dictionary')
  check(strict.dicts.get('chat')?.has('ru') === true, 'free namespaces register as usual')
  for (const disposer of strictDisposers.reverse()) disposer()
  check(strict.translate('common', 'cancel') === 'Встроенная отмена', 'dispose restores the built-in copy')
}

for (const disposer of disposers.reverse()) disposer()

for (const note of notes) console.log(note)
console.log(`\ndictionary: ${bundleNamespaces} namespaces, ${bundleKeys} keys`)
if (failures.length > 0) {
  console.error(`\nFAILED ${failures.length}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('all checks passed')
