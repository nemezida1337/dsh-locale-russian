#!/usr/bin/env node
/**
 * Validates `market/index.json` with the official validator that ships inside
 * DSH (`@deepseek-ai/dsh-plugin-market-index`), so a broken index is caught
 * before it reaches GitHub Pages.
 *
 * The validator is looked up in this order:
 *   1. `--validator <path>` — explicit `lib/index.js` path;
 *   2. `node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js`;
 *   3. `.app-packages/dsh-plugin-market-index/lib/index.js` (packages extracted
 *      from the installed desktop app).
 *
 * Usage:
 *   node tools/validate-market.mjs [--index market/index.json] [--url https://…]
 */
import { readFileSync, existsSync } from 'node:fs'
import { createArgs } from './lib/cli.mjs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const { option, flag } = createArgs()

const indexPath = resolve(root, option('index', 'market/index.json'))
const indexUrl = option('url', 'https://example.github.io/dsh-locale-russian/index.json')

const candidates = [
  option('validator', undefined),
  resolve(root, 'node_modules/@deepseek-ai/dsh-plugin-market-index/lib/index.js'),
  resolve(root, '.app-packages/dsh-plugin-market-index/lib/index.js'),
].filter((candidate) => candidate !== undefined)

const validatorPath = candidates.find((candidate) => existsSync(candidate))
if (validatorPath === undefined) {
  console.error('валидатор не найден: укажите --validator <path> или установите @deepseek-ai/dsh')
  console.error(`проверенные пути:\n  ${candidates.join('\n  ')}`)
  process.exit(2)
}

const validator = await import(pathToFileURL(validatorPath).href)
const document = JSON.parse(readFileSync(indexPath, 'utf8'))

try {
  const parsed = validator.parseMarketIndex(document, indexUrl)
  console.log(`валидатор: ${validatorPath}`)
  console.log(`индекс принят: плагинов ${parsed.plugins.length}`)
  for (const plugin of parsed.plugins) {
    const latest = plugin.versions[0]
    const install = validator.marketInstallTarget(plugin.name, latest)
    console.log(`  ${plugin.name}@${latest.version}`)
    console.log(`    установка: ${install.spec}${install.registry === undefined ? '' : ` (реестр ${install.registry})`}`)
    console.log(`    engines.dsh: ${latest.engines.dsh} | иконка: ${plugin.icon ?? '—'}`)
  }
} catch (error) {
  console.error(`индекс отклонён: ${error.name}: ${error.message}`)
  process.exit(1)
}
