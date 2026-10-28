#!/usr/bin/env node
/**
 * Checks translation coverage against the shipped desktop application, the build
 * users actually run.
 *
 * It reads the public update feed of the app, downloads the release archive for
 * this platform, verifies its sha512 from the feed, unpacks it, extracts the
 * client packages from `app.asar`, and runs the usual delta check in an isolated
 * copy of this repository (so the working tree stays clean).
 *
 * Usage:
 *   node tools/check-app.mjs [--work <dir>] [--asar <path>] [--feed <url>] [--keep]
 *
 * Without `--asar` the tool downloads the archive named by the feed and reuses
 * an already downloaded one on the next run.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option, flag } = createArgs()

const feedUrl = option('feed', 'https://download.deepseek.com/dsh-desk/feeds/mac-arm64/nightly-mac.yml')
const work = resolve(option('work', join(tmpdir(), 'dsh-app-check')))
const keep = flag('keep')

/** Reads a scalar that may be a plain value or a YAML block scalar (`>-`). */
function yamlScalar(text, name) {
  const match = new RegExp(`(?:^|\\n)\\s*(?:-\\s*)?${name}:\\s*(?:>-?\\s*\\n\\s*)?([^\\n]+)`, 'u').exec(text)
  return match === null ? undefined : match[1].trim()
}

/** Parses the update feed: version, archive URL and its sha512. */
export function parseFeed(text) {
  const version = yamlScalar(text, 'version')
  const url = yamlScalar(text, 'url')
  const sha512 = yamlScalar(text, 'sha512')
  if (version === undefined || url === undefined) {
    throw new Error('в фиде обновлений нет версии или ссылки на архив')
  }
  return { version, url, sha512 }
}

/** Downloads a URL to a file, following redirects. */
async function download(url, path) {
  console.log(`скачивание: ${url}`)
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(900_000) })
  if (!response.ok) throw new Error(`не удалось скачать архив: HTTP ${response.status}`)
  const total = Number(response.headers.get('content-length') ?? 0)
  const chunks = []
  let received = 0
  let lastReport = 0
  for await (const chunk of response.body) {
    chunks.push(chunk)
    received += chunk.length
    if (Date.now() - lastReport > 5_000) {
      lastReport = Date.now()
      const percent = total > 0 ? ` (${Math.round((received / total) * 100)}%)` : ''
      console.log(`  получено ${(received / 1048576).toFixed(0)} МБ${percent}`)
    }
  }
  writeFileSync(path, Buffer.concat(chunks))
  console.log(`  готово: ${(received / 1048576).toFixed(0)} МБ`)
}

/** Finds a file by name under a directory. */
function findFile(directory, name) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (entry === name) return path
    if (statSync(path).isDirectory()) {
      const found = findFile(path, name)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** Runs the delta check in an isolated copy of the repository. */
function checkCoverage(asarPath, version) {
  const copy = join(work, 'repo')
  rmSync(copy, { recursive: true, force: true })
  cpSync(root, copy, {
    recursive: true,
    filter: (path) => !/\/(\.git|node_modules|\.app-packages|reports|\.\w+-home)(\/|$)/u.test(path),
  })
  const result = spawnSync(process.execPath, ['tools/refresh.mjs', '--skip-install', '--asar', asarPath, '--check'], {
    cwd: copy,
    stdio: 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`покрытие приложения ${version} неполное: запустите npm run refresh и переведите дельту`)
  }
}

/** Entry point: feed, download, verify, unpack, check. */
async function main() {
  mkdirSync(work, { recursive: true })
  const feedText = await fetch(feedUrl, { signal: AbortSignal.timeout(60_000) }).then((response) => {
    if (!response.ok) throw new Error(`фид обновлений ответил HTTP ${response.status}`)
    return response.text()
  })
  const feed = parseFeed(feedText)
  console.log(`приложение: ${feed.version}`)

  const asarOption = option('asar')
  let asarPath = asarOption === undefined ? undefined : resolve(asarOption)

  // A previous run may have cached just the archive contents: reuse it instead of
  // downloading the whole application again.
  const cachedAsar = join(work, `app-${feed.version}.asar`)
  if (asarPath === undefined && existsSync(cachedAsar)) {
    asarPath = cachedAsar
    console.log(`app.asar из прошлого запуска: ${cachedAsar}`)
  }

  if (asarPath === undefined) {
    const zipPath = join(work, `app-${feed.version}.zip`)
    if (!existsSync(zipPath)) await download(feed.url, zipPath)
    else console.log(`архив уже скачан: ${zipPath}`)

    if (feed.sha512 !== undefined) {
      const actual = createHash('sha512').update(readFileSync(zipPath)).digest('base64')
      if (actual !== feed.sha512) {
        rmSync(zipPath, { force: true })
        throw new Error('sha512 архива не совпал с фидом — архив удалён, повторите загрузку')
      }
      console.log('sha512 совпал')
    }

    const dist = join(work, `app-${feed.version}`)
    if (!existsSync(dist)) {
      mkdirSync(dist, { recursive: true })
      const unzip = spawnSync('unzip', ['-q', zipPath, '-d', dist], { encoding: 'utf8' })
      if (unzip.status !== 0) throw new Error(`не удалось распаковать архив: ${unzip.stderr.slice(0, 300)}`)
    }
    const found = findFile(dist, 'app.asar')
    if (found === undefined) throw new Error('в архиве приложения нет app.asar')
    copyFileSync(found, cachedAsar)
    asarPath = cachedAsar
    // Оставляем только распакованный архив: кэш следующего запуска — один файл.
    rmSync(zipPath, { force: true })
    rmSync(dist, { recursive: true, force: true })
  }

  console.log(`app.asar: ${asarPath}`)
  checkCoverage(asarPath, feed.version)
  // Копия репозитория нужна только на время проверки.
  rmSync(join(work, 'repo'), { recursive: true, force: true })
  if (!keep) rmSync(work, { recursive: true, force: true })
  console.log(`приложение ${feed.version}: покрытие полное`)
  console.log(`для кэша: ${cachedAsar}`)
}

// Только при прямом запуске: модуль импортируется тестами без побочных эффектов.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
