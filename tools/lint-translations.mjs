#!/usr/bin/env node
/**
 * Validates the Russian translations against the inventory and the glossary.
 *
 * Blocking errors: missing keys, unknown keys, duplicate translations,
 * placeholder mismatches, Chinese characters, forbidden terminology, and
 * malformed plural markers. Warnings: length growth, identical-to-English
 * copy, and suspicious single-form plurals.
 *
 * Usage:
 *   node tools/lint-translations.mjs [--priority p1|p2|all] [--limit 40]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const priorityIndex = args.indexOf('--priority')
const priority = priorityIndex === -1 ? 'all' : args[priorityIndex + 1]
const limitIndex = args.indexOf('--limit')
const limit = limitIndex === -1 ? 40 : Number(args[limitIndex + 1])
const skipMissing = args.includes('--skip-missing')

const inventory = JSON.parse(readFileSync(resolve(root, 'strings/inventory.json'), 'utf8'))
const forbidden = JSON.parse(readFileSync(resolve(here, 'glossary-forbidden.json'), 'utf8'))

/** Keys that legitimately stay identical to English. */
const keepAsIs = new Set([
  'MCP', 'API', 'CLI', 'SDK', 'JSON', 'JSONL', 'HMR', 'AI', 'CI', 'PR', 'SSE', 'RAG', 'ACP',
  'Bash', 'PowerShell', 'Cordis', 'Typert', 'DeepSeek', 'DeepSeek Harness', 'Harness', 'Git', 'GitHub',
])

const translationsDir = resolve(root, 'translations')
const ru = new Map()
const errors = []
const warnings = []
const seenIn = new Map()

if (!existsSync(translationsDir)) {
  console.error(`no translations directory: ${translationsDir}`)
  process.exit(1)
}

// Later precedence wins, matching tools/build-package.mjs: the app delta (p3)
// carries the newest English text, so it supersedes the shipped-build batches.
const precedence = (file) => (file.startsWith('p2-') ? 0 : file.startsWith('p1-') ? 1 : 2)
const files = readdirSync(translationsDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .sort((a, b) => precedence(a) - precedence(b) || a.localeCompare(b))
for (const file of files) {
  let payload
  try {
    payload = JSON.parse(readFileSync(join(translationsDir, file), 'utf8'))
  } catch (error) {
    errors.push({ kind: 'parse', file, detail: error.message })
    continue
  }
  for (const [key, value] of Object.entries(payload.translations ?? {})) {
    if (typeof value !== 'string') {
      errors.push({ kind: 'type', file, key, detail: `expected string, got ${typeof value}` })
      continue
    }
    const identity = `${payload.namespace}\u0000${key}`
    if (seenIn.has(identity) && seenIn.get(identity) !== file) {
      const previous = ru.get(identity)
      if (previous !== value) {
        warnings.push({ kind: 'shadowed', file, namespace: payload.namespace, key, detail: `${seenIn.get(identity)} superseded by ${file}` })
      }
    }
    seenIn.set(identity, file)
    ru.set(identity, value)
  }
}

// Editorial overrides participate in linting exactly like batch translations.
const overridesPath = resolve(root, 'dictionary/overrides.json')
if (existsSync(overridesPath)) {
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'))
  for (const [namespace, keys] of Object.entries(overrides)) {
    if (namespace.startsWith('_')) continue
    for (const [key, value] of Object.entries(keys)) {
      const identity = `${namespace}\u0000${key}`
      seenIn.set(identity, 'dictionary/overrides.json')
      ru.set(identity, value)
    }
  }
}

/** Returns the placeholders of a string in order. */
function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
}

const counts = { keys: 0, checked: 0, missing: 0, warnings: 0 }
for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    if (priority !== 'all' && value.origin === 'repo' && priority === 'p1') {
      counts.keys += 1
      continue
    }
    counts.keys += 1
    const identity = `${namespace}\u0000${key}`
    const translated = ru.get(identity)
    if (translated === undefined) {
      counts.missing += 1
      if (!skipMissing) errors.push({ kind: 'missing', namespace, key, detail: value.en })
      continue
    }
    counts.checked += 1
    const source = value.en

    // Command spellings are load-bearing: the picker inserts the localized
    // token, and only the built-in zh/en spellings resolve back to a command
    // (resolution.ts TOKEN_ALIASES). They must stay verbatim.
    if (namespace === 'command' && key.startsWith('token.') && translated !== source) {
      errors.push({ kind: 'command-token', namespace, key, detail: `${translated} → must stay "${source}"` })
    }

    // Glossary terminology, enforced against the English source word.
    if (/\bfolders?\b|\bfolders'\b/i.test(source) && !/\bdirector/i.test(source) && /каталог/i.test(translated)) {
      errors.push({ kind: 'terminology', namespace, key, detail: `folder → папка, не каталог: ${translated}` })
    }
    if (/\bdirector(y|ies)\b/i.test(source) && !/\bfolder/i.test(source) && /папк/i.test(translated)) {
      errors.push({ kind: 'terminology', namespace, key, detail: `directory → каталог, не папка: ${translated}` })
    }
    if (/\bowner\b/i.test(source) && /ответственн/i.test(translated)) {
      errors.push({ kind: 'terminology', namespace, key, detail: `owner → владелец: ${translated}` })
    }

    // An empty value is only acceptable where the source is empty as well.
    // Whitespace-only values are legitimate (number group separators), so they
    // are checked separately from truly empty ones.
    if (translated.length === 0 && source.length > 0) {
      errors.push({ kind: 'empty', namespace, key, detail: 'пустой перевод при непустом оригинале' })
    } else if (translated.trim().length === 0 && source.trim().length > 0) {
      warnings.push({ kind: 'whitespace-only', namespace, key, detail: `${JSON.stringify(source)} → ${JSON.stringify(translated)}` })
    }

    if (/[\u3000-\u9fff\uff00-\uffef]/.test(translated)) {
      errors.push({ kind: 'cjk', namespace, key, detail: translated })
    }

    const sortedSource = [...placeholders(source)].sort().join(',')
    for (const form of translated.split('|')) {
      const sortedForm = [...placeholders(form)].sort().join(',')
      if (sortedSource !== sortedForm) {
        errors.push({
          kind: 'placeholder',
          namespace,
          key,
          detail: `en={${sortedSource}} ru={${sortedForm}}`,
        })
        break
      }
    }

    const hasPluralMarker = translated.includes('|')
    // A plural value needs a number to agree with; any interpolation is
    // treated as a possible count, because components name it freely
    // (`{n}`, `{count}`, `{value}`, `{total}`).
    const expectsPlural = /\.(one|other|zero|two|few|many)$/.test(key) || /\{\w+\}/.test(source)
    if (hasPluralMarker && !expectsPlural) {
      errors.push({ kind: 'plural-unexpected', namespace, key, detail: translated })
    }
    if (hasPluralMarker) {
      const forms = translated.split('|')
      if (forms.length > 3) {
        errors.push({ kind: 'plural-forms', namespace, key, detail: `${forms.length} forms` })
      }
      if (forms.some((form) => form.trim().length === 0)) {
        errors.push({ kind: 'plural-empty', namespace, key, detail: translated })
      }
      if (key.endsWith('.other') && forms.length === 3) {
        warnings.push({ kind: 'plural-three-on-other', namespace, key, detail: translated })
      }
      // Two forms on `.other` mean "few|many": the singular for 1/21/31 comes
      // from the paired `.one` key. Without that sibling those counts would
      // render the "many" form.
      if (key.endsWith('.other') && forms.length === 2) {
        const siblingKey = `${key.slice(0, -'.other'.length)}.one`
        const sibling = ru.get(`${namespace}\u0000${siblingKey}`)
        if (sibling === undefined) {
          errors.push({ kind: 'plural-orphan', namespace, key, detail: `${translated} → нет парного ${siblingKey}` })
        }
      }
    }

    for (const rule of forbidden.rules) {
      if (rule.whenSource !== undefined && !new RegExp(rule.whenSource, 'iu').test(source)) continue
      const pattern = new RegExp(rule.pattern, rule.flags ?? 'iu')
      if (pattern.test(translated)) {
        const allowed = (rule.except ?? []).some((exception) => new RegExp(exception, 'iu').test(translated))
        if (!allowed) {
          errors.push({ kind: 'glossary', namespace, key, detail: `${translated} → ${rule.why}` })
        }
      }
    }

    const looksLikeToken = !/[\s]/.test(source.trim()) && source.trim().length <= 14
    if (translated === source && !keepAsIs.has(source.trim()) && !looksLikeToken && /[A-Za-z]{3}/.test(source) && !/^[\W\d]+$/.test(source)) {
      warnings.push({ kind: 'untranslated', namespace, key, detail: source })
    }

    const longestForm = translated.split('|').reduce((longest, form) => (form.length > longest.length ? form : longest), '')
    if (source.length <= 40 && longestForm.length > source.length * 1.5 + 6) {
      warnings.push({
        kind: 'length',
        namespace,
        key,
        detail: `${source.length} → ${longestForm.length}: ${longestForm}`,
      })
    }
  }
}

// Cross-namespace consistency: one English string should not gain two different
// Russian renderings unless a rule below explains the divergence.
const bySource = new Map()
for (const [namespace, entry] of Object.entries(inventory.namespaces)) {
  for (const [key, value] of Object.entries(entry.keys)) {
    const translated = ru.get(`${namespace}\u0000${key}`)
    if (translated === undefined) continue
    const bucket = bySource.get(value.en) ?? new Map()
    bucket.set(translated, [...(bucket.get(translated) ?? []), `${namespace}/${key}`])
    bySource.set(value.en, bucket)
  }
}
const divergent = [...bySource.entries()]
  .filter(([, renderings]) => renderings.size > 1)
  .map(([source, renderings]) => ({
    source,
    renderings: [...renderings.entries()].map(([text, keys]) => ({ text, keys: keys.slice(0, 4) })),
  }))

// Plugin display metadata is keyed by its English text; the pack resolves it
// through LocaleRuntime.resolveText, so it needs its own completeness check.
const pluginMetaPath = resolve(root, 'strings/plugin-meta.json')
const pluginText = new Map()
if (existsSync(pluginMetaPath)) {
  for (const file of files) {
    let payload
    try {
      payload = JSON.parse(readFileSync(join(translationsDir, file), 'utf8'))
    } catch {
      continue
    }
    if (payload.kind !== 'plugin-meta') continue
    for (const [source, translated] of Object.entries(payload.translations ?? {})) {
      if (typeof translated === 'string') pluginText.set(source, translated)
    }
  }
  // Editorial corrections win, exactly as they do at build time.
  const pluginOverridesPath = resolve(root, 'dictionary/plugin-meta-overrides.json')
  if (existsSync(pluginOverridesPath)) {
    const pluginOverrides = JSON.parse(readFileSync(pluginOverridesPath, 'utf8'))
    for (const [source, translated] of Object.entries(pluginOverrides)) {
      if (typeof translated === 'string') pluginText.set(source, translated)
    }
  }
  const meta = JSON.parse(readFileSync(pluginMetaPath, 'utf8'))
  const expected = new Set(meta.descriptions.map((entry) => entry.en))
  for (const entry of meta.packages) {
    if (typeof entry.title === 'string' && entry.title !== entry.name && /\s/.test(entry.title)) expected.add(entry.title)
  }
  let missingPluginText = 0
  for (const source of expected) {
    const translated = pluginText.get(source)
    if (translated === undefined) {
      missingPluginText += 1
      errors.push({ kind: 'plugin-meta-missing', namespace: 'plugin-meta', key: source.slice(0, 60), detail: source })
      continue
    }
    // An empty value is only acceptable where the source is empty as well.
    // Whitespace-only values are legitimate (number group separators), so they
    // are checked separately from truly empty ones.
    if (translated.length === 0 && source.length > 0) {
      errors.push({ kind: 'empty', namespace, key, detail: 'пустой перевод при непустом оригинале' })
    } else if (translated.trim().length === 0 && source.trim().length > 0) {
      warnings.push({ kind: 'whitespace-only', namespace, key, detail: `${JSON.stringify(source)} → ${JSON.stringify(translated)}` })
    }

    if (/[\u3000-\u9fff\uff00-\uffef]/.test(translated)) {
      errors.push({ kind: 'cjk', namespace: 'plugin-meta', key: source.slice(0, 40), detail: translated })
    }
  }
  console.log(`plugin display text: ${pluginText.size} / ${expected.size} strings${missingPluginText > 0 ? ` (не хватает ${missingPluginText})` : ''}`)
}

const report = {
  generatedAt: new Date().toISOString(),
  priority,
  counts: {
    inventoryKeys: counts.keys,
    checked: counts.checked,
    missing: counts.missing,
    errors: errors.length,
    warnings: warnings.length,
  },
  errors,
  warnings,
  divergentSources: divergent,
}
mkdirSync(resolve(root, 'reports'), { recursive: true })
writeFileSync(resolve(root, 'reports/lint.json'), `${JSON.stringify(report, null, 2)}\n`)

const byKind = (list) => list.reduce((accumulator, item) => {
  accumulator[item.kind] = (accumulator[item.kind] ?? 0) + 1
  return accumulator
}, {})

console.log(`priority: ${priority}`)
console.log(`inventory keys: ${counts.keys}, translated: ${counts.checked}, missing: ${counts.missing}`)
console.log(`errors: ${errors.length} ${JSON.stringify(byKind(errors))}`)
console.log(`warnings: ${warnings.length} ${JSON.stringify(byKind(warnings))}`)
for (const error of errors.slice(0, limit)) {
  console.log(`  ERROR ${error.kind} [${error.namespace ?? '-'}/${error.key ?? '-'}] ${error.detail ?? ''}`)
}
for (const warning of warnings.slice(0, Math.min(limit, 10))) {
  console.log(`  warn  ${warning.kind} [${warning.namespace}/${warning.key}] ${warning.detail}`)
}
console.log(`divergent renderings of one English string: ${divergent.length}`)
for (const item of divergent.slice(0, 8)) {
  console.log(`  ~ "${item.source}" → ${item.renderings.map((rendering) => `"${rendering.text}" (${rendering.keys[0]})`).join(' | ')}`)
}
console.log(`report: reports/lint.json`)
process.exitCode = errors.length === 0 ? 0 : 1
