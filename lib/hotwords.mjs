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
  if (personal.includes(cleaned)) return { ok: true, duplicate: true, count: personal.length, text: String(text ?? '') }
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
