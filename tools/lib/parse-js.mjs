/**
 * Minimal JavaScript data reader for DSH bundles and TypeScript dictionaries.
 *
 * Locale dictionaries are pure data: object literals whose values are strings,
 * numbers, or references to other module-scope constants. These helpers locate
 * such literals in a bundled or TypeScript source file and resolve them without
 * executing application code.
 */
export const state = {
  currentPackage: '',
  unresolvedKeys: [],
}

/** Returns the previous non-whitespace character before `index`. */
export function previousSignificant(text, index) {
  let i = index - 1
  while (i >= 0 && /\s/.test(text[i])) i -= 1
  return i >= 0 ? text[i] : undefined
}

/** Returns the end index of the regular-expression literal starting at `start`. */
export function regexEnd(text, start) {
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
export function scan(text, start, onChar) {
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
export function literalEnd(text, start) {
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
export function matchBracket(text, open, openChar, closeChar) {
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
export function splitArguments(text, openParen) {
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
export function splitTopLevel(body) {
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
export function topLevelColon(part) {
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
export function evaluate(expression) {
  try {
    // eslint-disable-next-line no-new-func -- the input is an extracted data literal
    return new Function(`return (${expression})`)()
  } catch {
    return undefined
  }
}

/** Resolves a template literal by substituting resolvable `${identifier}` parts. */
export function resolveTemplate(text, expression) {
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
export function resolveReference(text, reference) {
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
export function resolveValue(text, expression) {
  const trimmed = expression.trim()
  const direct = evaluate(trimmed)
  if (direct !== undefined) return direct
  if (trimmed.startsWith('{')) return resolveObjectExpression(text, trimmed)
  if (trimmed.startsWith('[')) {
    const end = matchBracket(trimmed, 0, '[', ']')
    if (end !== -1) {
      const literal = trimmed.slice(0, end + 1)
      const value = evaluate(literal)
      if (value !== undefined) return value
      const items = splitTopLevel(literal.slice(1, -1)).map((item) => resolveValue(text, item))
      if (items.every((item) => item !== undefined)) return items
    }
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
export function resolveObjectExpression(text, expression) {
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
        state.unresolvedKeys.push({ package: state.currentPackage, key: part, reason: 'shorthand' })
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
      state.unresolvedKeys.push({
        package: state.currentPackage,
        key,
        reason: 'value',
        expression: part.slice(colon + 1).trim().slice(0, 60),
      })
      continue
    }
    result[key] = value
    resolvedAny = true
  }
  return resolvedAny || Object.keys(result).length > 0 ? result : undefined
}

/** Resolves `const NAME = <expr>` inside one file to its data value. */
export function resolveDeclaration(text, name, options = {}) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=]+)?=`, 'g')
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
      const items = splitTopLevel(literal.slice(1, -1)).map((item) => resolveValue(text, item))
      if (items.every((item) => item !== undefined)) return items
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
    if (options.onUnresolved !== undefined) options.onUnresolved(name, text.slice(cursor, cursor + 40))
  }
  return undefined
}

/** Resolves an exported or module-scope dictionary object by name. */
