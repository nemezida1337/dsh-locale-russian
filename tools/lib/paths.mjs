/**
 * Machine paths inside committed artifacts.
 *
 * The extraction dumps record where they read from, which is useful when
 * reading a report — but a committed file must not carry an absolute path of
 * the maintainer's machine. Home directories collapse to `~`.
 */
import { homedir } from 'node:os'

/**
 * Shortens a machine path for a committed artifact.
 * @param path - absolute path to display.
 * @returns the same path with the home directory replaced by `~`.
 */
export function displayPath(path) {
  const home = homedir()
  if (path === home) return '~'
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`
  return path
}
