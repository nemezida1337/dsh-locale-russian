#!/usr/bin/env node
/**
 * Generates the plugin market index for this package.
 *
 * The index is a separate JSON document (market/index.json) that DSH readers
 * fetch from any https URL; it carries the display metadata a list page needs
 * so the client does not have to resolve the package manifest. Publishing the
 * `market/` directory next to the package (GitHub Pages, a CDN, any static
 * host) is enough to make the plugin discoverable.
 *
 * Usage:
 *   node tools/build-market.mjs [--timestamp <unix-seconds>]
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)
const timestampIndex = args.indexOf('--timestamp')
const publishTimestamp = timestampIndex === -1
  ? Math.floor(Date.now() / 1000)
  : Number(args[timestampIndex + 1])

const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const repositoryUrl = (manifest.repository?.url ?? '').replace(/^git\+/u, '').replace(/\.git$/u, '')

/**
 * Resolves the version's real publish time from the registry, so a regenerated
 * index (for example by the Pages workflow) keeps an honest timestamp instead
 * of recording when the index was built.
 * @param name - published package name.
 * @param version - exact version in the manifest.
 * @returns Unix seconds, or undefined when the version is not published yet.
 */
async function publishedAt(name, version) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}`)
    if (!response.ok) return undefined
    const packument = await response.json()
    const time = packument.time?.[version]
    if (typeof time !== 'string') return undefined
    const parsed = Date.parse(time)
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined
  } catch {
    return undefined
  }
}

const registryTimestamp = timestampIndex === -1
  ? await publishedAt(manifest.name, manifest.version)
  : undefined
const effectiveTimestamp = registryTimestamp ?? publishTimestamp
if (timestampIndex === -1) {
  console.log(registryTimestamp === undefined
    ? `время публикации неизвестно (версия ${manifest.version} ещё не в реестре) — берём текущее`
    : `время публикации ${manifest.version} из реестра`)
}

const index = {
  format: 1,
  title: {
    en: 'DSH community plugins',
    ru: 'Плагины сообщества DSH',
  },
  description: {
    en: 'Community-published DeepSeek Harness bundles. Add this index URL in the Plugins page to browse and install them.',
    ru: 'Наборы плагинов DeepSeek Harness от сообщества. Добавьте адрес этого индекса на странице «Плагины», чтобы просматривать и устанавливать их.',
  },
  metadata: {
    categories: {
      localization: { title: { en: 'Localization', ru: 'Локализация' } },
      interface: { title: { en: 'Interface', ru: 'Интерфейс' } },
    },
    labels: {
      community: { title: { en: 'Community', ru: 'Сообщество' } },
      'no-telemetry': { title: { en: 'No telemetry', ru: 'Без телеметрии' } },
    },
  },
  plugins: [
    {
      name: manifest.name,
      title: {
        en: 'Russian localization',
        ru: 'Русская локализация',
      },
      description: {
        en: manifest.description,
        ru: 'Полный перевод интерфейса DeepSeek Harness на русский язык: панели, настройки, диалоги, карточки инструментов, форматы дат и русские склонения.',
      },
      icon: 'icon.svg',
      author: typeof manifest.author === 'string' ? manifest.author : 'dsh-locale-ru contributors',
      ...(manifest.homepage === undefined ? {} : { homepage: manifest.homepage }),
      ...(repositoryUrl.length === 0 ? {} : { repository: { url: repositoryUrl } }),
      metadata: {
        category: 'localization',
        labels: ['community', 'no-telemetry'],
        keywords: manifest.keywords ?? [],
      },
      'dist-tags': { latest: manifest.version },
      versions: [
        {
          version: manifest.version,
          publishTimestamp: effectiveTimestamp,
          source: { type: 'npm' },
          engines: { dsh: manifest.engines?.dsh ?? '*' },
        },
      ],
    },
  ],
}

const marketDir = resolve(root, 'market')
mkdirSync(marketDir, { recursive: true })
writeFileSync(resolve(marketDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
copyFileSync(resolve(root, 'icon.svg'), resolve(marketDir, 'icon.svg'))

console.log(`market index: ${manifest.name}@${manifest.version}`)
console.log(`engines.dsh: ${manifest.engines?.dsh ?? '*'}`)
console.log(`written: market/index.json, market/icon.svg`)
