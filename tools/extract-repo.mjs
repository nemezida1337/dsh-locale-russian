#!/usr/bin/env node
/**
 * Extracts locale dictionaries from the DeepSeek Harness repository sources.
 *
 * Repository dictionaries live in `locales.ts` files under each package's
 * `src` tree as typed object literals, and are consumed by
 * `ctx.locale.register(NS, { zh, en })` calls that import them by name. This
 * reader resolves both the namespace constant and the imported dictionaries,
 * so every key keeps its source file for context.
 *
 * Usage:
 *   node tools/extract-repo.mjs [--repo <path>] [--out <file>]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  state, resolveDeclaration, splitArguments, resolveValue,
} from './lib/parse-js.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const repoIndex = args.indexOf('--repo')
const repoRoot = repoIndex === -1 ? resolve(here, '../../deepseek-harness') : resolve(args[repoIndex + 1])
const outIndex = args.indexOf('--out')
const outFile = outIndex === -1 ? resolve(here, '../strings/repo.json') : resolve(args[outIndex + 1])

/** Lists every file under `dir` matching one of the extensions. */
function walk(dir, extensions, result = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'tests') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, extensions, result)
    else if (extensions.some((extension) => entry.name.endsWith(extension))) result.push(full)
  }
  return result
}

/** Reads every `const NAME = 'literal'` in a file into a namespace lookup. */
function collectStringConstants(files) {
  const constants = new Map()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const pattern = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(['"`])([^'"`]*)\2/g
    let match
    while ((match = pattern.exec(text)) !== null) constants.set(match[1], match[3])
  }
  return constants
}

/** Resolves a declaration through `export ... from './x.ts'` re-exports. */
function resolveAcrossFiles(file, text, name, depth = 0) {
  if (depth > 3) return undefined
  const direct = resolveDeclaration(text, name)
  if (direct !== undefined) return direct
  const reexport = /export\s*(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g
  let match
  while ((match = reexport.exec(text)) !== null) {
    const base = resolve(dirname(file), match[1])
    const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
    const target = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    if (target === undefined) continue
    const value = resolveAcrossFiles(target, readFileSync(target, 'utf8'), name, depth + 1)
    if (value !== undefined) return value
  }
  return undefined
}

/** Resolves `import { a, b } from './x.ts'` statements of one file. */
function collectImports(file, text) {
  const imports = new Map()
  const pattern = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const target = match[2]
    if (!target.startsWith('.')) continue
    const base = resolve(dirname(file), target)
    const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
    const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    if (found === undefined) continue
    for (const name of match[1].split(',')) {
      const parts = name.trim().split(/\s+as\s+/).map((item) => item.trim())
      const original = parts[0].replace(/^type\s+/, '')
      if (original.length === 0) continue
      const alias = parts.length === 2 ? parts[1] : original
      imports.set(alias, { file: found, original })
    }
  }
  return imports
}

const packagesRoot = join(repoRoot, 'packages')
const groups = ['client', 'extensions', 'experimental']
const namespaces = new Map()
const report = { generatedAt: new Date().toISOString(), repoRoot, packages: [], unresolved: [] }

function record(ns, locale, dict, source) {
  if (!namespaces.has(ns)) namespaces.set(ns, { en: {}, zh: {}, other: {}, sources: [] })
  const entry = namespaces.get(ns)
  if (locale === 'en') Object.assign(entry.en, dict)
  else if (locale === 'zh') Object.assign(entry.zh, dict)
  else entry.other[locale] = { ...(entry.other[locale] ?? {}), ...dict }
  if (!entry.sources.includes(source)) entry.sources.push(source)
}

for (const group of groups) {
  const groupDir = join(packagesRoot, group)
  if (!existsSync(groupDir)) continue
  for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packageDir = join(groupDir, entry.name)
    const sourceDir = join(packageDir, 'src')
    if (!existsSync(sourceDir)) continue
    const sourceFiles = walk(sourceDir, ['.ts', '.tsx'])
    const constants = collectStringConstants(sourceFiles)
    const found = []

    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8')
      if (!text.includes('locale.register(')) continue
      const imports = collectImports(file, text)
      const callPattern = /locale\.register\(/g
      let match
      while ((match = callPattern.exec(text)) !== null) {
        const openParen = text.indexOf('(', match.index)
        const callArgs = splitArguments(text, openParen)
        if (callArgs.length < 2) continue
        const nsExpression = callArgs[0].trim()
        const ns = /^['"`]/.test(nsExpression)
          ? resolveValue(text, nsExpression)
          : (constants.get(nsExpression) ?? resolveValue(text, nsExpression))
        if (typeof ns !== 'string') {
          report.unresolved.push({ package: entry.name, reason: 'namespace', call: nsExpression.slice(0, 60) })
          continue
        }
        const dictExpression = callArgs[1].trim()
        const inline = resolveValue(text, dictExpression)
        if (inline !== undefined && typeof inline === 'object' && !Array.isArray(inline)) {
          for (const [locale, dict] of Object.entries(inline)) {
            if (dict === null || typeof dict !== 'object') continue
            record(ns, locale, dict, relative(repoRoot, file))
          }
          found.push(ns)
          continue
        }
        // `{ zh, en }` with imported dictionaries.
        const inner = dictExpression.replace(/^\{|\}$/g, '')
        let recorded = false
        for (const part of inner.split(',')) {
          const trimmed = part.trim()
          if (trimmed.length === 0) continue
          const colon = trimmed.indexOf(':')
          const name = colon === -1 ? trimmed : trimmed.slice(colon + 1).trim()
          const target = imports.get(name)
          if (target === undefined) continue
          const targetText = readFileSync(target.file, 'utf8')
          const dict = resolveAcrossFiles(target.file, targetText, target.original)
            ?? resolveAcrossFiles(target.file, targetText, name)
          if (dict === undefined || typeof dict !== 'object') continue
          const locale = colon === -1 ? name : trimmed.slice(0, colon).trim()
          record(ns, locale, dict, relative(repoRoot, target.file))
          recorded = true
        }
        if (recorded) {
          found.push(ns)
          continue
        }
        // `for (const [locale, dict] of <collection>)` — resolve the collection.
        const loop = /for\s*\(\s*const\s*\[\s*\w+\s*,\s*\w+\s*\]\s*of\s+([A-Za-z_$][\w$.]*)\s*\)/g
        let loopMatch
        let collection
        while ((loopMatch = loop.exec(text)) !== null) {
          if (loopMatch.index > match.index) break
          collection = resolveDeclaration(text, loopMatch[1])
        }
        if (Array.isArray(collection)) {
          let pairCount = 0
          for (const pair of collection) {
            if (!Array.isArray(pair) || pair.length !== 2) continue
            const [pairLocale, pairDict] = pair
            if (typeof pairLocale !== 'string' || pairDict === null || typeof pairDict !== 'object') continue
            record(ns, pairLocale, pairDict, relative(repoRoot, file))
            pairCount += 1
          }
          if (pairCount > 0) {
            found.push(ns)
            continue
          }
        }
        report.unresolved.push({ package: entry.name, namespace: ns, reason: 'dictionary', call: dictExpression.slice(0, 80) })
      }
    }
    if (found.length > 0) report.packages.push({ package: `dsh-${group === 'client' ? 'client-' : ''}${entry.name}`, namespaces: [...new Set(found)] })
  }
}

const output = {
  ...report,
  unresolvedKeys: state.unresolvedKeys,
  namespaces: Object.fromEntries([...namespaces.entries()].sort(([a], [b]) => a.localeCompare(b))),
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`)

const enTotal = [...namespaces.values()].reduce((sum, entry) => sum + Object.keys(entry.en).length, 0)
console.log(`repo: ${repoRoot}`)
console.log(`packages with dictionaries: ${report.packages.length}`)
console.log(`namespaces: ${namespaces.size}`)
console.log(`en keys: ${enTotal}`)
console.log(`unresolved: ${report.unresolved.length}, unresolved keys: ${state.unresolvedKeys.length}`)
for (const item of report.unresolved.slice(0, 12)) console.log('  -', JSON.stringify(item))
for (const item of state.unresolvedKeys.slice(0, 12)) console.log('  *', JSON.stringify(item))
console.log(`written: ${outFile}`)
