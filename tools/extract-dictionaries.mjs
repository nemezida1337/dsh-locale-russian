#!/usr/bin/env node
/**
 * Extracts every locale dictionary the installed DSH client bundles register.
 *
 * The client bundles are factory closures: executing one only registers a
 * factory, so we execute every factory with recording stubs for `require` and
 * for the Cordis context, then collect the `ctx.locale.register(...)` calls.
 * The result is the ground truth for what the running GUI can display.
 *
 * Usage:
 *   node tools/extract-dictionaries.mjs [--only <package-name>] [--out <file>]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined
const outIndex = args.indexOf('--out')
const outFile = outIndex === -1
  ? resolve(here, '../strings/registered.json')
  : resolve(args[outIndex + 1])

const PKG_ROOT = process.env.DSH_CLIENT_PKG_ROOT
  ?? join(homedir(), '.dsh/profiles/node_modules/@deepseek-ai')

/** A callable, property-returning stub: absorbs any access and any call. */
function anyStub(label, seen = new Map()) {
  const fn = function () { return anyStub(`${label}()`, seen) }
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === 'then') return undefined // never look thenable
      if (prop === Symbol.toPrimitive) return () => label
      if (prop === 'toString') return () => label
      if (prop === Symbol.iterator) return undefined
      if (typeof prop === 'symbol') return undefined
      if (!Object.prototype.hasOwnProperty.call(target, prop)) {
        target[prop] = anyStub(`${label}.${prop}`, seen)
      }
      return target[prop]
    },
    apply() { return anyStub(`${label}()`, seen) },
    construct() { return anyStub(`new ${label}()`, seen) },
  })
}

const materialized = new Map()

/**
 * Executes one package's client bundle and materializes its exports.
 * @param packageDir - absolute package directory.
 * @returns the materialized module exports (or undefined when it throws).
 */
async function materialize(packageDir, report) {
  if (materialized.has(packageDir)) return materialized.get(packageDir)
  materialized.set(packageDir, undefined)

  const bundle = join(packageDir, 'lib/client.js')
  if (!existsSync(bundle)) return undefined

  let captured
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load(entry) { captured = entry },
      create() { return anyStub('moduleLoader.create') },
    },
  }
  try {
    await import(`${pathToFileURL(bundle).href}?v=${Date.now()}-${Math.random()}`)
  } catch (error) {
    report.bundleErrors.push(`${packageDir}: ${error.message}`)
    globalThis.window = previousWindow
    return undefined
  } finally {
    globalThis.window = previousWindow
  }
  if (captured === undefined) {
    report.bundleErrors.push(`${packageDir}: bundle registered no module`)
    return undefined
  }

  const requireFn = (spec) => {
    if (spec.startsWith('.')) {
      const target = resolve(packageDir, 'lib', spec)
      if (existsSync(target)) {
        try { return requireSync(target, report) } catch { return anyStub(spec) }
      }
      return anyStub(spec)
    }
    if (spec.startsWith('@deepseek-ai/')) {
      const dir = join(PKG_ROOT, spec.slice('@deepseek-ai/'.length))
      if (existsSync(join(dir, 'lib/client.js'))) {
        try { return requireSync(join(dir, 'lib/client.js'), report) } catch { return anyStub(spec) }
      }
      return anyStub(spec)
    }
    return anyStub(spec)
  }

  let exports
  try {
    exports = captured.factory(requireFn)
  } catch (error) {
    report.factoryErrors.push(`${packageDir}: ${error.message}`)
    return undefined
  }
  materialized.set(packageDir, exports)
  return exports
}

// The recursive require path is synchronous; dynamic import is not, so
// nested packages are materialized through a synchronous re-execution of the
// same bundle in a fresh module scope.
const syncCache = new Map()
function requireSync(bundlePath, report) {
  const cached = syncCache.get(bundlePath)
  if (cached !== undefined) return cached
  const code = readFileSync(bundlePath, 'utf8')
  let captured
  const sandboxWindow = {
    __ModuleLoader__: { load(entry) { captured = entry }, create() { return anyStub('create') } },
  }
  const module = { exports: {} }
  const factoryRequire = (spec) => {
    if (spec === 'react' || spec === 'react-dom' || spec.startsWith('react/')) return anyStub(spec)
    if (spec.startsWith('@deepseek-ai/')) {
      const dir = join(PKG_ROOT, spec.slice('@deepseek-ai/'.length))
      const nested = join(dir, 'lib/client.js')
      if (existsSync(nested)) {
        try { return requireSync(nested, report) } catch { return anyStub(spec) }
      }
    }
    return anyStub(spec)
  }
  try {
    new Function('window', 'module', 'exports', 'require', code)(
      sandboxWindow, module, module.exports, factoryRequire)
  } catch (error) {
    report.factoryErrors.push(`${bundlePath}: ${error.message}`)
    syncCache.set(bundlePath, undefined)
    return undefined
  }
  if (captured === undefined) {
    report.factoryErrors.push(`${bundlePath}: bundle registered no module`)
    syncCache.set(bundlePath, undefined)
    return undefined
  }
  const exports = module.exports
  try { captured.factory(factoryRequire) }
  catch { /* factory body already ran through the Function wrapper above */ }
  syncCache.set(bundlePath, exports)
  return exports
}

/** Collects every registered dictionary while one plugin applies. */
function createRecordingCtx(record, report) {
  const locale = {
    register(ns, localeOrDicts, maybeDict) {
      if (typeof localeOrDicts === 'string') record(ns, localeOrDicts, maybeDict ?? {})
      else if (localeOrDicts && typeof localeOrDicts === 'object') {
        for (const [loc, dict] of Object.entries(localeOrDicts)) record(ns, loc, dict)
      }
      return () => {}
    },
    addLanguage(definition) { report.languages.push(definition); return () => {} },
    bind() { return (key) => key },
    getSnapshot() { return { active: 'en', locales: [], revision: 0 } },
    subscribe() { return () => {} },
    resolveText() { return '' },
  }
  const slots = new Proxy({
    inject(_name, callback) {
      try {
        const result = callback()
        if (result && typeof result[Symbol.iterator] === 'function' && typeof result !== 'function') {
          for (const _ of result) { /* drain generator registrations */ }
        }
      } catch (error) {
        report.applyErrors.push(`slots.inject: ${error.message}`)
      }
      return () => {}
    },
    register() { return () => {} },
    registerFactory() { return () => {} },
    installLocale(face) { report.localeFaces.push(face); return () => {} },
  }, {
    get(target, prop) {
      if (prop in target) return target[prop]
      const stub = anyStub(`slots.${String(prop)}`)
      target[prop] = stub
      return stub
    },
  })
  const base = {
    locale,
    slots,
    effect(callback, label) {
      try {
        const disposer = callback()
        return typeof disposer === 'function' ? disposer : () => {}
      } catch (error) {
        report.applyErrors.push(`${String(label)}: ${error.message}`)
        return () => {}
      }
    },
    on() { return () => {} },
    provide() {},
    get() { return undefined },
    emit() {},
    settingsScope: anyStub('settingsScope'),
    configForms: anyStub('configForms'),
    remote: anyStub('remote'),
    connection: anyStub('connection'),
  }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      const stub = anyStub(String(prop))
      target[prop] = stub
      return stub
    },
  })
}

const namespaces = new Map()
const report = {
  generatedAt: new Date().toISOString(),
  packageRoot: PKG_ROOT,
  packages: [],
  bundleErrors: [],
  factoryErrors: [],
  applyErrors: [],
  languages: [],
  localeFaces: [],
}

function record(ns, locale, dict) {
  if (!namespaces.has(ns)) namespaces.set(ns, { en: {}, zh: {}, other: {}, sources: [] })
  const entry = namespaces.get(ns)
  if (locale === 'en') Object.assign(entry.en, dict)
  else if (locale === 'zh') Object.assign(entry.zh, dict)
  else Object.assign(entry.other, { [`${locale}`]: dict })
}

const packages = readdirSync(PKG_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
  .map((entry) => entry.name)
  .filter((name) => name.startsWith('dsh-'))
  .filter((name) => (only === undefined ? true : name === only))
  .sort()

for (const name of packages) {
  const dir = join(PKG_ROOT, name)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.dsh?.client === undefined) continue
  if (!existsSync(join(dir, 'lib/client.js'))) {
    report.packages.push({ package: name, version: manifest.version, status: 'no-bundle' })
    continue
  }
  const before = namespaces.size
  const exports = await materialize(dir, report)
  if (exports === undefined || typeof exports.apply !== 'function') {
    report.packages.push({ package: name, version: manifest.version, status: 'no-apply' })
    continue
  }
  const registered = []
  const ctx = createRecordingCtx((ns, locale, dict) => {
    record(ns, locale, dict)
    const entry = namespaces.get(ns)
    if (!entry.sources.includes(name)) entry.sources.push(name)
    registered.push(ns)
  }, report)
  try {
    const result = exports.apply(ctx)
    if (result && typeof result.then === 'function') await result
  } catch (error) {
    report.applyErrors.push(`${name}: ${error.message}`)
  }
  report.packages.push({
    package: name,
    version: manifest.version,
    status: 'ok',
    namespaces: [...new Set(registered)],
    newNamespaces: namespaces.size - before,
  })
}

const output = {
  ...report,
  namespaces: Object.fromEntries([...namespaces.entries()].sort(([a], [b]) => a.localeCompare(b))),
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`)

const totals = [...namespaces.values()].reduce((sum, entry) => sum + Object.keys(entry.en).length, 0)
console.log(`packages scanned: ${packages.length}`)
console.log(`namespaces: ${namespaces.size}`)
console.log(`english keys: ${totals}`)
console.log(`languages registered: ${JSON.stringify(report.languages)}`)
console.log(`bundle errors: ${report.bundleErrors.length}, factory errors: ${report.factoryErrors.length}, apply errors: ${report.applyErrors.length}`)
if (report.bundleErrors.length > 0) console.log(report.bundleErrors.slice(0, 10).join('\n'))
if (report.applyErrors.length > 0) console.log('--- apply errors ---\n' + report.applyErrors.slice(0, 20).join('\n'))
console.log(`written: ${outFile}`)
