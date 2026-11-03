/**
 * Personal hotwords dictionary.
 *
 * The dictionary lives in a marked section of the engine hotwords file, so the
 * host half (the "add to dictionary" endpoint) and the installer CLI (bulk
 * initial fill) read and write the same format. Functions are pure: they take
 * the file text and return the new text, which keeps them easy to test.
 */

/** Start of the personal section. */
export const PERSONAL_MARKER = '# === личный словарь (dsh-locale-russian) ==='
/** End of the personal section. */
export const PERSONAL_END = '# === /личный словарь ==='
/** How many phrases the personal dictionary may hold. */
export const MAX_PERSONAL_HOTWORDS = 400
/** Longest phrase accepted by the engine. */
export const MAX_HOTWORD_LENGTH = 64

/** Normalizes a phrase typed or selected by the user. */
export function normalizePhrase(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim()
}

/**
 * Splits a hotwords file into the text around the personal section and its phrases.
 * @param text - file contents.
 * @returns the remaining text and the personal phrases.
 */
export function splitPersonal(text) {
  const source = String(text ?? '')
  const start = source.indexOf(PERSONAL_MARKER)
  const end = source.indexOf(PERSONAL_END)
  if (start === -1 || end === -1 || end < start) return { before: source, personal: [] }
  const before = source.slice(0, start) + source.slice(end + PERSONAL_END.length)
  const personal = source
    .slice(start + PERSONAL_MARKER.length, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  return { before, personal }
}

/**
 * Lists the personal phrases.
 * @param text - file contents.
 * @returns the phrases in order.
 */
export function readPersonalHotwords(text) {
  return splitPersonal(text).personal
}

/** Renders the file with the given personal phrases. */
function render(before, personal) {
  const trimmed = before.trimEnd()
  if (personal.length === 0) return `${trimmed}\n`
  const section = `${PERSONAL_MARKER}\n${personal.join('\n')}\n${PERSONAL_END}\n`
  return `${trimmed}\n\n${section}`
}

/**
 * Adds a phrase to the personal section.
 * @param text - file contents.
 * @param phrase - phrase to add.
 * @returns the result and the new file contents.
 */
export function addPersonalHotword(text, phrase) {
  const cleaned = normalizePhrase(phrase)
  if (cleaned === '' || cleaned.length > MAX_HOTWORD_LENGTH) return { ok: false, reason: 'bad-phrase' }
  const { before, personal } = splitPersonal(text)
  // «GitHub» и «github» — одно и то же слово: дубликат без учёта регистра.
  const lower = cleaned.toLowerCase()
  if (personal.some((entry) => entry.toLowerCase() === lower)) {
    return { ok: true, duplicate: true, count: personal.length, text: String(text ?? '') }
  }
  if (personal.length >= MAX_PERSONAL_HOTWORDS) return { ok: false, reason: 'full', count: personal.length }
  const next = [...personal, cleaned]
  return { ok: true, count: next.length, text: render(before, next) }
}

/**
 * Removes a phrase from the personal section.
 * @param text - file contents.
 * @param phrase - phrase to remove.
 * @returns the result and the new file contents.
 */
export function removePersonalHotword(text, phrase) {
  const cleaned = normalizePhrase(phrase)
  const { before, personal } = splitPersonal(text)
  const next = personal.filter((entry) => entry !== cleaned)
  if (next.length === personal.length) return { ok: false, reason: 'not-found', count: personal.length }
  return { ok: true, count: next.length, text: render(before, next) }
}

/**
 * Clears the personal section.
 * @param text - file contents.
 * @returns the new file contents.
 */
export function clearPersonalHotwords(text) {
  const { before } = splitPersonal(text)
  return { ok: true, text: render(before, []) }
}

/** Longest key or value accepted by the replacements map. */
export const MAX_REPLACEMENT_LENGTH = 64

/** Parses the replacements JSON, tolerating a missing or broken file. */
export function readReplacements(text) {
  try {
    const parsed = JSON.parse(String(text ?? '{}'))
    const entries = parsed !== null && typeof parsed === 'object' && parsed.replacements !== undefined ? parsed.replacements : {}
    if (entries === null || typeof entries !== 'object') return {}
    const result = {}
    for (const [heard, chosen] of Object.entries(entries)) {
      if (typeof heard !== 'string' || typeof chosen !== 'string') continue
      const from = heard.trim()
      const to = chosen.trim()
      if (from === '' || to === '' || from.length > MAX_REPLACEMENT_LENGTH || to.length > MAX_REPLACEMENT_LENGTH) continue
      result[from] = to
    }
    return result
  } catch {
    return {}
  }
}

/** Renders the replacements JSON with stable ordering. */
export function renderReplacements(replacements) {
  const entries = Object.entries(replacements).sort(([left], [right]) => left.localeCompare(right, 'ru'))
  return `${JSON.stringify({ replacements: Object.fromEntries(entries) }, null, 2)}\n`
}

/**
 * Adds or updates a heard → chosen pair.
 * @param text - replacements JSON.
 * @param heard - phrase as it was recognized.
 * @param chosen - phrase the user wants instead.
 * @returns the result and the new JSON.
 */
export function upsertReplacement(text, heard, chosen) {
  const from = normalizePhrase(heard)
  const to = normalizePhrase(chosen)
  if (from === '' || to === '' || from.length > MAX_REPLACEMENT_LENGTH || to.length > MAX_REPLACEMENT_LENGTH) {
    return { ok: false, reason: 'bad-phrase' }
  }
  const replacements = readReplacements(text)
  replacements[from] = to
  return { ok: true, count: Object.keys(replacements).length, text: renderReplacements(replacements) }
}

/**
 * Removes a heard phrase from the replacements map.
 * @param text - replacements JSON.
 * @param heard - phrase to remove.
 * @returns the result and the new JSON.
 */
export function removeReplacement(text, heard) {
  const from = normalizePhrase(heard)
  const replacements = readReplacements(text)
  if (replacements[from] === undefined) return { ok: false, reason: 'not-found', count: Object.keys(replacements).length }
  delete replacements[from]
  return { ok: true, count: Object.keys(replacements).length, text: renderReplacements(replacements) }
}

/** Russian case endings that may follow a heard form («гитхабе», «Опенаи»). */
const RU_ENDINGS = '(?:ами|ями|ах|ях|ам|ям|ов|ев|ой|ей|ом|ем|ия|ию|ии|ий|а|я|у|ю|е|о|ы|и)?'

/**
 * Applies heard → chosen replacements to a transcript. Matching is
 * case-insensitive and respects word boundaries, so "гитхаб" inside
 * "гитхабер" is not replaced. Cyrillic heard forms also match their Russian
 * case forms: «гитхабе» and «Опенаи» become GitHub and OpenAI.
 * @param text - recognized text.
 * @param replacements - heard → chosen map.
 * @returns the corrected text.
 */
export function applyReplacements(text, replacements) {
  let result = String(text ?? '')
  // Длинные фразы первыми: иначе «гит» съел бы начало «гитхаб».
  const entries = Object.entries(replacements ?? {})
    .filter(([heard, chosen]) => typeof heard === 'string' && typeof chosen === 'string' && heard !== '')
    .sort(([left], [right]) => right.length - left.length)
  for (const [heard, chosen] of entries) {
    const escaped = heard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Кириллические формы склоняются: «гитхаб» → «гитхабе», «Опена» → «Опенаи».
    const endings = /[а-яё]/iu.test(heard) ? RU_ENDINGS : ''
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}${endings}(?=$|[^\\p{L}\\p{N}])`, 'giu')
    result = result.replace(pattern, (match, prefix) => `${prefix}${chosen}`)
  }
  return result
}

/**
 * Forgets a phrase from the personal dictionary, matching case-insensitively.
 * @param text - hotwords file contents.
 * @param phrase - phrase to forget.
 * @returns the result and the new file contents.
 */
export function forgetPersonalHotword(text, phrase) {
  const cleaned = normalizePhrase(phrase)
  if (cleaned === '') return { ok: false, reason: 'bad-phrase' }
  const lower = cleaned.toLowerCase()
  const { before, personal } = splitPersonal(text)
  const next = personal.filter((entry) => entry.toLowerCase() !== lower)
  if (next.length === personal.length) return { ok: false, reason: 'not-found', count: personal.length }
  return { ok: true, count: next.length, text: render(before, next) }
}
