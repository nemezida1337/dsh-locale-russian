#!/usr/bin/env node
/**
 * Builds the static coverage dashboard served by GitHub Pages next to the market
 * index: version, coverage totals, per-namespace table, source breakdown, and
 * links. The page is generated from the repository data, so it never drifts from
 * the shipped dictionary.
 *
 * Usage:
 *   node tools/build-dashboard.mjs [--out market/index.html]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createArgs } from './lib/cli.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const { option } = createArgs()
const outPath = resolve(root, option('out', 'market/index.html'))

const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

const manifest = readJson('package.json')
const dictionary = readJson('dictionary/ru.json')
const pluginText = readJson('dictionary/plugin-meta.json')
const inventory = readJson('strings/inventory.json')
const market = readJson('market/index.json')
const history = existsSync(resolve(root, 'market/history.json')) ? readJson('market/history.json') : { versions: [] }

const namespaces = Object.entries(dictionary)
  .map(([namespace, keys]) => ({ namespace, keys: Object.keys(keys).length }))
  .sort((left, right) => right.keys - left.keys)
const totalKeys = namespaces.reduce((sum, entry) => sum + entry.keys, 0)
const pluginKeys = Object.keys(pluginText).length
const latestVersion = market.plugins[0]?.versions[0]

const sources = { app: 0, installed: 0, repo: 0 }
for (const entry of Object.values(inventory.namespaces)) {
  for (const value of Object.values(entry.keys)) {
    const origin = value.origin ?? 'repo'
    sources[origin] = (sources[origin] ?? 0) + 1
  }
}

/** Escapes text for HTML. */
const escape = (text) => String(text).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character])

const historyRows = (history.versions ?? [])
  .slice()
  .reverse()
  .map((entry) => `      <tr><td>v${escape(entry.version)}</td><td>${escape(String(entry.date ?? '').slice(0, 10))}</td><td class="num">${entry.strings}</td><td class="num">${entry.namespaces}</td><td class="num">${entry.pluginDescriptions}</td></tr>`)
  .join('\n')

const rows = namespaces
  .map((entry) => `      <tr><td><code>${escape(entry.namespace)}</code></td><td class="num">${entry.keys}</td></tr>`)
  .join('\n')

const generated = new Date().toISOString().replace('T', ' ').slice(0, 16)
const version = latestVersion?.version ?? manifest.version

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(manifest.description.split(':')[0])} — покрытие</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --fg: #1b1b1f; --muted: #5b5b66; --card: #f4f4f6; --line: #e2e2e8; --accent: #2b5cff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141416; --fg: #ececf1; --muted: #a0a0ab; --card: #1d1d21; --line: #2b2b31; --accent: #7aa2ff; } }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 64px; background: var(--bg); color: var(--fg); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 880px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .lead { color: var(--muted); margin: 0 0 24px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: 13px; color: var(--muted); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0 0 28px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
  .card .value { font-size: 24px; font-weight: 650; }
  .card .label { color: var(--muted); font-size: 13px; }
  h2 { font-size: 17px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .links a { color: var(--accent); text-decoration: none; margin-right: 14px; white-space: nowrap; }
  .links a:hover { text-decoration: underline; }
  footer { color: var(--muted); font-size: 13px; margin-top: 32px; border-top: 1px solid var(--line); padding-top: 12px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>Русская локализация DeepSeek Harness</h1>
  <p class="lead">Покрытие перевода в опубликованном пакете <span class="badge">v${escape(version)}</span></p>

  <div class="cards">
    <div class="card"><div class="value">${totalKeys}</div><div class="label">строк интерфейса</div></div>
    <div class="card"><div class="value">${namespaces.length}</div><div class="label">namespace</div></div>
    <div class="card"><div class="value">${pluginKeys}</div><div class="label">строк описаний плагинов</div></div>
    <div class="card"><div class="value">${escape(manifest.engines?.dsh ?? '—')}</div><div class="label">совместимость DSH</div></div>
  </div>

  <h2>Источники строк</h2>
  <table>
    <tr><th>Источник</th><th class="num">Строк</th></tr>
    <tr><td>Сборка установленного приложения (<code>app.asar</code>)</td><td class="num">${sources.app ?? 0}</td></tr>
    <tr><td>Пакеты CLI-сборки</td><td class="num">${sources.installed ?? 0}</td></tr>
    <tr><td>Исходники репозитория</td><td class="num">${sources.repo ?? 0}</td></tr>
  </table>

  <h2>По namespace</h2>
  <table>
    <tr><th>Namespace</th><th class="num">Строк</th></tr>
${rows}
  </table>

  <h2>История выпусков</h2>
  <table>
    <tr><th>Версия</th><th>Дата</th><th class="num">Строк</th><th class="num">Namespace</th><th class="num">Описаний</th></tr>
${historyRows}
  </table>

  <h2>Ссылки</h2>
  <p class="links">
    <a href="https://www.npmjs.com/package/${escape(manifest.name)}">npm</a>
    <a href="https://github.com/nemezida1337/dsh-locale-russian">GitHub</a>
    <a href="https://github.com/nemezida1337/dsh-locale-russian/releases">Релизы</a>
    <a href="https://github.com/nemezida1337/dsh-locale-russian#readme">README</a>
    <a href="index.json">Индекс маркета</a>
    <a href="https://github.com/deepseek-ai/deepseek-harness/discussions/10146">Обсуждение</a>
  </p>

  <footer>Страница собирается из данных репозитория при каждом обновлении индекса. Обновлено: ${escape(generated)} UTC.</footer>
</main>
</body>
</html>
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, html)
console.log(`dashboard: ${outPath.replace(`${root}/`, '')} | строк: ${totalKeys} | namespace: ${namespaces.length} | описаний: ${pluginKeys}`)
