#!/usr/bin/env node
/**
 * Verifies the published market index the way the desktop app reads it: fetches
 * the live URL, parses it with the official `@deepseek-ai/dsh-plugin-market-index`
 * package, checks that the pack is present and installable, and compares the
 * published index with the one committed in the repository.
 *
 * The live index is deployed by GitHub Pages after the commit, so the check
 * retries for a while before failing.
 *
 * Usage:
 *   node tools/market-live.mjs [--url <url>] [--local market/index.json] [--retry 120]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { option } = createArgs()
// `--root` нужен тестам: они подкладывают свой индекс и манифест.
const root = resolve(option('root', resolve(here, '..')))

const indexUrl = option('url', 'https://nemezida1337.github.io/dsh-locale-russian/index.json')
const localPath = resolve(root, option('local', 'market/index.json'))
const retrySeconds = Number(option('retry', '0'))
// `--registry` позволяет тестам подставить локальный реестр вместо npm.
const registryUrl = (option('registry', 'https://registry.npmjs.org') ?? '').replace(/\/+$/u, '')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const candidates = [
  option('validator', undefined),
  resolve(root, 'node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js'),
  resolve(root, '.app-packages/dsh-plugin-market-index/lib/index.js'),
].filter((candidate) => candidate !== undefined)
const validatorPath = candidates.find((candidate) => existsSync(candidate))
if (validatorPath === undefined) {
  console.error('валидатор не найден: укажите --validator <path> или установите @deepseek-ai/dsh-plugin-market-index')
  process.exit(2)
}
const validator = await import(pathToFileURL(validatorPath).href)

/** Fetches the live index, retrying while Pages finishes deploying. */
async function fetchLive() {
  const deadline = Date.now() + retrySeconds * 1_000
  let lastError
  for (;;) {
    try {
      const response = await fetch(indexUrl, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (Date.now() >= deadline) throw new Error(`живой индекс недоступен: ${lastError.message}`)
      await new Promise((resolve) => setTimeout(resolve, 5_000))
    }
  }
}

const problems = []

async function main() {
  const live = await fetchLive()
  const parsed = validator.parseMarketIndex(live, indexUrl)
  console.log(`живой индекс принят официальным валидатором: плагинов ${parsed.plugins.length}`)

  const plugin = parsed.plugins.find((entry) => entry.name === manifest.name)
  if (plugin === undefined) {
    problems.push(`в живом индексе нет пакета ${manifest.name}`)
  } else {
    const latest = plugin.versions[0]
    const install = validator.marketInstallTarget(plugin.name, latest)
    console.log(`  ${plugin.name}@${latest.version}`)
    console.log(`  установка: ${install.spec}`)
    console.log(`  engines.dsh: ${latest.engines.dsh}`)
    if (latest.version !== manifest.version) {
      problems.push(`живой индекс отдаёт ${latest.version}, а версия пакета ${manifest.version}`)
    }
    if (latest.engines?.dsh !== manifest.engines?.dsh) {
      problems.push(`живой индекс отдаёт диапазон ${latest.engines?.dsh}, а манифест ${manifest.engines?.dsh}`)
    }
    if (typeof plugin.icon !== 'string' || plugin.icon.length === 0) {
      problems.push('в живом индексе нет иконки')
    } else {
      const icon = await fetch(plugin.icon, { signal: AbortSignal.timeout(20_000) })
      if (!icon.ok) problems.push(`иконка недоступна: HTTP ${icon.status}`)
    }
    const registry = await fetch(`${registryUrl}/${manifest.name}`, { signal: AbortSignal.timeout(20_000) })
    if (registry.ok) {
      const packument = await registry.json()
      const npmLatest = packument['dist-tags']?.latest
      if (npmLatest !== latest.version) {
        problems.push(`npm отдаёт ${npmLatest}, а живой индекс ${latest.version}`)
      }
    }
  }

  // Опубликованный индекс должен совпадать с закоммиченным (кроме времени публикации).
  if (existsSync(localPath)) {
    const local = JSON.parse(readFileSync(localPath, 'utf8'))
    const strip = (index) => JSON.stringify({
      ...index,
      plugins: index.plugins.map((entry) => ({
        ...entry,
        versions: entry.versions.map(({ publishTimestamp, ...rest }) => rest),
      })),
    })
    if (strip(local) !== strip(live)) problems.push('живой индекс отличается от market/index.json')
  }

  if (problems.length > 0) {
    console.error(`проблем в живом индексе: ${problems.length}`)
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    process.exitCode = 1
    return
  }
  console.log('живой индекс совпадает с репозиторием и готов к установке')
  }

main().catch((error) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
