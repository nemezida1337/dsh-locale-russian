/**
 * Small filesystem helpers shared by the tools.
 */
import { existsSync, readFileSync } from 'node:fs'

/**
 * Reads a JSON file.
 * @param path - file to read.
 * @param fallback - value returned when the file is absent.
 * @returns the parsed content or the fallback.
 */
export function readJson(path, fallback = undefined) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}
