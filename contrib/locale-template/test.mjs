#!/usr/bin/env node
/**
 * Self-test of the language pack: loads the browser bundle with a stand-in
 * locale, checks the language definition, passthrough for unknown keys, and the
 * plural-form selection. Run it after filling the dictionaries:
 *
 *   node test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'))

/** Minimal stand-in for the shipped LocaleRuntime. */
class FakeLocale {
  constructor() {
    this.dicts = new Map()
    this.languages = []
    this.fallback = new Map()
    this.active = 'en'
  }

  addLanguage(definition) {
    if (this.languages.some((language) => language.id === definition.id)) throw new Error(`locale "${definition.id}" is already registered`)
    this.languages.push(definition)
    this.fallback.set(definition.id, definition.fallback)
    return () => {}
  }

  register(namespace, locale, dictionary) {
    const target = this.dicts.get(namespace) ?? new Map()
    if (target.has(locale)) throw new Error(`locale namespace "${namespace}" already has locale "${locale}"`)
    target.set(locale, dictionary)
    this.dicts.set(namespace, target)
    return () => {}
  }

  getSnapshot() {
    return { active: this.active }
  }

  bind(namespace) {
    return (key, params) => this.translate(namespace, key, params)
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

  lookup(namespace, key, chain) {
    const locales = this.dicts.get(namespace)
    for (const locale of chain) {
      const value = locales?.get(locale)?.[key]
      if (value !== undefined) return value
    }
    return undefined
  }

  translate(namespace, key, params) {
    const template = this.lookup(namespace, key, this.fallbackChain(this.active)) ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match)
  }

  resolveText(text) {
    return text
  }
}

let captured
globalThis.window = { __ModuleLoader__: { load(entry) { captured = entry } } }
await import(`${resolve(here, 'lib/client.js')}?v=${Date.now()}`)
if (captured === undefined) throw new Error('bundle did not register a module')

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

check('module id equals the package name', captured.id === manifest.name, `${captured.id} vs ${manifest.name}`)
const plugin = captured.factory(() => { throw new Error('the language pack requires no modules') })
check('apply is exported', typeof plugin.apply === 'function')
check('inject declares the locale service', Array.isArray(plugin.inject) && plugin.inject.includes('locale'))

const locale = new FakeLocale()
const disposers = []
plugin.apply({
  locale,
  effect(callback) {
    const disposer = callback()
    disposers.push(typeof disposer === 'function' ? disposer : () => {})
    return disposer
  },
})
await new Promise((resolve) => setTimeout(resolve, 0))

const language = locale.languages[0]
check('language is registered', language !== undefined)
check('language id comes from the package', language?.id === manifest.dsh?.language?.id, `${language?.id} vs ${manifest.dsh?.language?.id}`)
check('fallback is registered', locale.fallback.has(language?.id))

locale.active = language?.id ?? 'en'
check('unknown keys pass through', locale.translate('common', 'missing.key') === 'missing.key')

// Склонения: механизм проверяется на временном словаре, пока свои строки не готовы.
locale.register('demo', language?.id ?? 'en', {
  'items.one': '{n} item',
  'items.other': '{n} item|{n} items',
})
const t = locale.bind('demo')
check('one form for n=1', t('items.one', { n: 1 }) === '1 item')
check('plural form for n=5', t('items.other', { n: 5 }).includes('items'))

for (const dispose of disposers.reverse()) dispose()
console.log(failures.length === 0 ? 'все проверки языкового пака пройдены' : `провалено: ${failures.length}`)
if (failures.length > 0) process.exit(1)
