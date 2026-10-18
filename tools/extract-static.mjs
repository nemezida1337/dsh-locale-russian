#!/usr/bin/env node
/**
 * Statically extracts every locale dictionary from the installed DSH client
 * bundles. Bundles keep their original object literals, so each
 * `locale.register(ns, { zh, en })` call resolves to pure data that can be
 * evaluated without running the plugin. Property values that reference another
 * module-scope constant are resolved one property at a time, so one
 * unresolvable value never discards a whole dictionary.
 *
 * Usage:
 *   node tools/extract-static.mjs [--only <package>] [--out <file>]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { displayPath } from './lib/paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined
const outIndex = args.indexOf('--out')
const outFile = outIndex === -1
  ? resolve(here, '../strings/registered.json')
  : resolve(args[outIndex + 1])
const PKG_ROOT = process.env.DSH_CLIENT_PKG_ROOT
  ?? join(homedir(), '.dsh/profiles/node_modules/@deepseek-ai')

let currentPackage = ''
const unresolvedKeys = []

/** Returns the previous non-whitespace character before `index`. */
function previousSignificant(text, index) {
  let i = index - 1
  while (i >= 0 && /\s/.test(text[i])) i -= 1
  return i >= 0 ? text[i] : undefined
}

/** Returns the end index of the regular-expression literal starting at `start`. */
function regexEnd(text, start) {
  let i = start + 1
  let inClass = false
  while (i < text.length) {
    const char = text[i]
    if (char === '\\') { i += 2; continue }
    if (char === '\n') return -1
    if (char === '[') inClass = true
    else if (char === ']') inClass = false
    else if (char === '/' && !inClass) {
      i += 1
      while (i < text.length && /[a-z]/i.test(text[i])) i += 1
      return i - 1
    }
    i += 1
  }
  return -1
}

/** Walks source text, calling `onChar` for characters outside strings and comments. */
function scan(text, start, onChar) {
  let i = start
  let quote
  let blockComment = false
  let lineComment = false
  while (i < text.length) {
    const char = text[i]
    const next = text[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      i += 1
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i += 2; continue }
      i += 1
      continue
    }
    if (quote !== undefined) {
      if (char === '\\') { i += 2; continue }
      if (char === quote) { quote = undefined; i += 1; continue }
      i += 1
      continue
    }
    if (char === '/' && next === '/') { lineComment = true; i += 2; continue }
    if (char === '/' && next === '*') { blockComment = true; i += 2; continue }
    if (char === '/') {
      const previous = previousSignificant(text, i)
      if (previous === undefined || /[([{,;:=!&|?+\-*%~^<>]/.test(previous)) {
        const end = regexEnd(text, i)
        if (end !== -1) { i = end + 1; continue }
      }
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; i += 1; continue }
    if (onChar(char, i) === true) return i
    i += 1
  }
  return -1
}

/** Returns the index of the closing quote of the literal starting at `start`. */
function literalEnd(text, start) {
  const quote = text[start]
  let i = start + 1
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue }
    if (text[i] === quote) return i
    i += 1
  }
  return -1
}

/** Returns the index of the bracket closing the one at `open`. */
function matchBracket(text, open, openChar, closeChar) {
  let depth = 0
  return scan(text, open, (char) => {
    if (char === openChar) { depth += 1; return }
    if (char === closeChar) {
      depth -= 1
      if (depth === 0) return true
    }
  })
}

/** Splits one call's argument list into top-level argument texts. */
function splitArguments(text, openParen) {
  const result = []
  let depth = 0
  let start = openParen + 1
  const end = scan(text, openParen + 1, (char, index) => {
    if (char === '(' || char === '[' || char === '{') { depth += 1; return }
    if (char === ')' || char === ']' || char === '}') {
      if (depth === 0 && char === ')') return true
      depth -= 1
      return
    }
    if (char === ',' && depth === 0) {
      result.push(text.slice(start, index))
      start = index + 1
    }
  })
  if (end === -1) return []
  result.push(text.slice(start, end))
  return result.map((item) => item.trim()).filter((item) => item.length > 0)
}

/** Splits an object body into its top-level property texts. */
function splitTopLevel(body) {
  const parts = []
  let depth = 0
  let start = 0
  scan(body, 0, (char, index) => {
    if (char === '(' || char === '[' || char === '{') { depth += 1; return }
    if (char === ')' || char === ']' || char === '}') { depth -= 1; return }
    if (char === ',' && depth === 0) {
      parts.push(body.slice(start, index))
      start = index + 1
    }
  })
  parts.push(body.slice(start))
  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

/** Finds the top-level `:` separating an object property key from its value. */
function topLevelColon(part) {
  let result = -1
  let depth = 0
  scan(part, 0, (char, index) => {
    if (char === '(' || char === '[' || char === '{') { depth += 1; return }
    if (char === ')' || char === ']' || char === '}') { depth -= 1; return }
    if (char === ':' && depth === 0) { result = index; return true }
  })
  return result
}

/** Evaluates one pure expression; returns undefined when it is not data. */
function evaluate(expression) {
  try {
    return new Function(`return (${expression})`)()
  } catch {
    return undefined
  }
}

/** Resolves a template literal by substituting resolvable `${identifier}` parts. */
function resolveTemplate(text, expression) {
  const substituted = expression.replace(/\$\{([^}]*)\}/g, (whole, inner) => {
    const trimmed = inner.trim()
    if (!/^[A-Za-z_$][\w$.]*$/.test(trimmed)) return whole
    const value = resolveReference(text, trimmed)
    return value === undefined ? whole : String(value).replace(/`/g, '\\`')
  })
  return substituted === expression ? undefined : evaluate(substituted)
}

/**
 * Resolves an identifier with member access to a declaration value.
 * Keys may contain dots, so `name["a.b"]` is read as one property.
 */
function resolveReference(text, reference) {
  const trimmed = reference.trim()
  const base = /^([A-Za-z_$][\w$]*)/.exec(trimmed)
  if (base === null) return undefined
  let value = resolveDeclaration(text, base[1])
  let rest = trimmed.slice(base[1].length)
  const accessor = /^\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|(\d+))\s*\])/
  while (rest.trim().length > 0) {
    const access = accessor.exec(rest)
    if (access === null) return undefined
    const key = access[1] ?? access[2] ?? access[3] ?? access[4] ?? access[5]
    if (value === null || typeof value !== 'object') return undefined
    value = value[key]
    rest = rest.slice(access[0].length)
  }
  return value
}

/** Resolves the value expression of one property. */
function resolveValue(text, expression) {
  const trimmed = expression.trim()
  const direct = evaluate(trimmed)
  if (direct !== undefined) return direct
  if (trimmed.startsWith('{')) return resolveObjectExpression(text, trimmed)
  if (trimmed.startsWith('[')) {
    const end = matchBracket(trimmed, 0, '[', ']')
    if (end !== -1) return evaluate(trimmed.slice(0, end + 1))
  }
  if (trimmed.startsWith('`')) return resolveTemplate(text, trimmed)
  if (/^[A-Za-z_$]/.test(trimmed)) {
    const referenced = resolveReference(text, trimmed)
    if (referenced !== undefined) return referenced
  }
  if (/^\w[\w.]*\(/s.test(trimmed)) {
    for (const candidate of splitArguments(trimmed, trimmed.indexOf('('))) {
      const value = resolveValue(text, candidate)
      if (value !== undefined) return value
    }
  }
  return undefined
}

/** Resolves an object literal whose values may be identifiers or literals. */
function resolveObjectExpression(text, expression) {
  const expr = expression.trim()
  if (!expr.startsWith('{')) return undefined
  const end = matchBracket(expr, 0, '{', '}')
  if (end === -1) return undefined
  const result = {}
  let resolvedAny = false
  for (const part of splitTopLevel(expr.slice(1, end))) {
    if (part.startsWith('...')) {
      const spread = resolveValue(text, part.slice(3))
      if (spread !== null && typeof spread === 'object') {
        Object.assign(result, spread)
        resolvedAny = true
      }
      continue
    }
    const colon = topLevelColon(part)
    if (colon === -1) {
      if (!/^[A-Za-z_$][\w$]*$/.test(part)) continue
      const value = resolveDeclaration(text, part)
      if (value === undefined) {
        unresolvedKeys.push({ package: currentPackage, key: part, reason: 'shorthand' })
        continue
      }
      result[part] = value
      resolvedAny = true
      continue
    }
    const keyText = part.slice(0, colon).trim()
    const key = /^['"`]/.test(keyText) ? evaluate(keyText) : keyText
    if (typeof key !== 'string') continue
    const value = resolveValue(text, part.slice(colon + 1))
    if (value === undefined) {
      unresolvedKeys.push({ package: currentPackage, key, reason: 'value', expression: part.slice(colon + 1).trim().slice(0, 60) })
      continue
    }
    result[key] = value
    resolvedAny = true
  }
  return resolvedAny || Object.keys(result).length > 0 ? result : (resolvedAny ? result : undefined)
}

/** Resolves `const NAME = <expr>` inside one bundle to its data value. */
function resolveDeclaration(text, name) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=`, 'g')
  let match
  while ((match = pattern.exec(text)) !== null) {
    let cursor = match.index + match[0].length
    while (text[cursor] === ' ' || text[cursor] === '\n' || text[cursor] === '\t') cursor += 1
    const char = text[cursor]
    if (char === '{') {
      const end = matchBracket(text, cursor, '{', '}')
      if (end === -1) continue
      const value = resolveObjectExpression(text, text.slice(cursor, end + 1))
      if (value !== undefined) return value
      continue
    }
    if (char === '[') {
      const end = matchBracket(text, cursor, '[', ']')
      if (end === -1) continue
      const literal = text.slice(cursor, end + 1)
      const direct = evaluate(literal)
      if (direct !== undefined) return direct
      const items = splitTopLevel(literal.slice(1, -1))
      const value = items.map((item) => resolveValue(text, item))
      if (value.every((item) => item !== undefined)) return value
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const end = literalEnd(text, cursor)
      if (end === -1) continue
      const value = evaluate(text.slice(cursor, end + 1))
      if (value !== undefined) return value
      continue
    }
    if (/^[A-Za-z_$]/.test(char)) {
      let end = cursor
      while (end < text.length && /[\w$.]/.test(text[end])) end += 1
      const value = resolveReference(text, text.slice(cursor, end))
      if (value !== undefined) return value
      continue
    }
    // Anything else (call, arithmetic) stays unresolved.
  }
  return undefined
}

const namespaces = new Map()
const report = {
  generatedAt: new Date().toISOString(),
  packageRoot: displayPath(PKG_ROOT),
  packages: [],
  unresolved: [],
}

function record(ns, locale, dict, source) {
  if (!namespaces.has(ns)) namespaces.set(ns, { en: {}, zh: {}, other: {}, sources: [] })
  const entry = namespaces.get(ns)
  if (locale === 'en') Object.assign(entry.en, dict)
  else if (locale === 'zh') Object.assign(entry.zh, dict)
  else entry.other[locale] = { ...(entry.other[locale] ?? {}), ...dict }
  if (!entry.sources.includes(source)) entry.sources.push(source)
}

const packages = readdirSync(PKG_ROOT, { withFileTypes: true })
  .map((entry) => entry.name)
  .filter((name) => name.startsWith('dsh-'))
  .filter((name) => (only === undefined ? true : name === only))
  .sort()

for (const name of packages) {
  const dir = join(PKG_ROOT, name)
  const manifestPath = join(dir, 'package.json')
  const bundlePath = join(dir, 'lib/client.js')
  if (!existsSync(manifestPath) || !existsSync(bundlePath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.dsh?.client === undefined) continue
  currentPackage = name
  const text = readFileSync(bundlePath, 'utf8')
  const found = []

  const callPattern = /locale\.register\(/g
  let match
  while ((match = callPattern.exec(text)) !== null) {
    const openParen = text.indexOf('(', match.index)
    const callArgs = splitArguments(text, openParen)
    if (callArgs.length < 2) {
      report.unresolved.push({ package: name, reason: 'arity' })
      continue
    }
    const ns = resolveValue(text, callArgs[0])
    if (typeof ns !== 'string') {
      report.unresolved.push({ package: name, reason: 'namespace', call: callArgs[0].slice(0, 80) })
      continue
    }
    if (callArgs.length === 2) {
      const dicts = resolveValue(text, callArgs[1])
      if (dicts === undefined || typeof dicts !== 'object') {
        report.unresolved.push({ package: name, namespace: ns, reason: 'dictionary', call: callArgs[1].slice(0, 120) })
        continue
      }
      for (const [locale, dict] of Object.entries(dicts)) {
        if (dict === null || typeof dict !== 'object') continue
        record(ns, locale, dict, name)
      }
      found.push(ns)
    } else {
      const locale = resolveValue(text, callArgs[1])
      const dict = resolveValue(text, callArgs[2])
      if (typeof locale === 'string' && dict !== undefined && typeof dict === 'object') {
        record(ns, locale, dict, name)
        found.push(ns)
        continue
      }
      // `for (const [locale, dict] of <collection>)` — resolve the collection.
      const loop = /for\s*\(\s*const\s*\[\s*\w+\s*,\s*\w+\s*\]\s*of\s+([A-Za-z_$][\w$.]*)\s*\)/g
      let loopMatch
      let collection
      while ((loopMatch = loop.exec(text)) !== null) {
        if (loopMatch.index > match.index) break
        collection = resolveValue(text, loopMatch[1])
      }
      if (Array.isArray(collection)) {
        let recorded = 0
        for (const pair of collection) {
          if (!Array.isArray(pair) || pair.length !== 2) continue
          const [pairLocale, pairDict] = pair
          if (typeof pairLocale !== 'string' || pairDict === null || typeof pairDict !== 'object') continue
          record(ns, pairLocale, pairDict, name)
          recorded += 1
        }
        if (recorded > 0) {
          found.push(ns)
          continue
        }
      }
      report.unresolved.push({ package: name, namespace: ns, reason: 'per-locale', call: callArgs.slice(1).join(',').slice(0, 80) })
    }
  }
  report.packages.push({ package: name, version: manifest.version, namespaces: [...new Set(found)] })
}

const output = {
  ...report,
  unresolvedKeys,
  namespaces: Object.fromEntries([...namespaces.entries()].sort(([a], [b]) => a.localeCompare(b))),
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`)

const enTotal = [...namespaces.values()].reduce((sum, entry) => sum + Object.keys(entry.en).length, 0)
console.log(`packages with dictionaries: ${report.packages.length} / candidates ${packages.length}`)
console.log(`namespaces: ${namespaces.size}`)
console.log(`en keys: ${enTotal}`)
console.log(`unresolved registrations: ${report.unresolved.length}, unresolved keys: ${unresolvedKeys.length}`)
for (const item of report.unresolved.slice(0, 10)) console.log('  -', JSON.stringify(item))
for (const item of unresolvedKeys.slice(0, 10)) console.log('  *', JSON.stringify(item))
console.log(`written: ${outFile}`)
