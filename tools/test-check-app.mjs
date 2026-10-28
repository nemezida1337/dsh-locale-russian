#!/usr/bin/env node
/**
 * Unit tests for the update-feed parser behind `tools/check-app.mjs`: the feed
 * uses YAML block scalars, and a silent parsing mistake would make the CI job
 * download the wrong archive.
 *
 * Usage:
 *   node tools/test-check-app.mjs
 */
import { parseFeed } from './check-app.mjs'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

const blockScalarFeed = `version: 0.2.1-rc.3
files:
  - url: >-
      https://download.deepseek.com/dsh-desk/bin/mac-arm64/deepseek-harness-0.2.1-rc.3-mac-arm64.zip
    sha512: >-
      0tCeP/zLGLtsH+S4BD4TIyRJ8TwRhh7xaJprTMOUoEfj7hYJFC3G5l6nl/2zCTS41MeE9k+KRN19RE9sqX6goQ==
    size: 347702586
path: >-
  https://download.deepseek.com/dsh-desk/bin/mac-arm64/deepseek-harness-0.2.1-rc.3-mac-arm64.zip
sha512: >-
  0tCeP/zLGLtsH+S4BD4TIyRJ8TwRhh7xaJprTMOUoEfj7hYJFC3G5l6nl/2zCTS41MeE9k+KRN19RE9sqX6goQ==
releaseDate: '2026-10-23T07:59:26.844Z'
`

const plainFeed = `version: 1.2.3
files:
  - url: https://example.com/app.zip
    sha512: abc
`

console.log('разбор фида обновлений')
{
  const feed = parseFeed(blockScalarFeed)
  check('версия из блочного скаляра', feed.version === '0.2.1-rc.3', feed.version)
  check('ссылка из блочного скаляра', feed.url === 'https://download.deepseek.com/dsh-desk/bin/mac-arm64/deepseek-harness-0.2.1-rc.3-mac-arm64.zip', feed.url)
  check('sha512 из блочного скаляра', feed.sha512.startsWith('0tCeP/') && feed.sha512.length === 88, feed.sha512)
}
{
  const feed = parseFeed(plainFeed)
  check('простой скаляр разбирается', feed.url === 'https://example.com/app.zip' && feed.version === '1.2.3')
}
{
  let error
  try {
    parseFeed('files: []\n')
  } catch (caught) {
    error = caught
  }
  check('фид без версии и ссылки — ошибка', error instanceof Error && error.message.includes('нет версии'), error?.message)
}

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки разбора фида пройдены')
