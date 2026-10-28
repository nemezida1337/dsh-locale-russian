#!/usr/bin/env node
/**
 * Offline smoke test for the host half: mounts the speech provider against a
 * fake cordis context and checks registration plus the failure paths that a user
 * sees before the engine and the model are prepared. The real recognition is
 * exercised by `install.sh` + the plugin card, which need the model on disk.
 *
 * Two activation scenarios matter: with the speech registry present (provider
 * registers) and without it (the voice-input bundle is disabled, so the plugin
 * must still activate — otherwise DSH refuses to boot the whole profile).
 *
 * Usage:
 *   node tools/test-speech-provider.mjs
 */
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as host from '../lib/index.js'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

// Пустые каталоги: тест не зависит от того, установлена ли модель на машине.
const workspace = mkdtempSync(join(tmpdir(), 'dsh-speech-test-'))
// Локальный сервер отвечает 404: тест не должен скачивать настоящий движок.
const unreachable = createServer((request, response) => {
  response.writeHead(404)
  response.end('not found')
})
await new Promise((resolve) => unreachable.listen(0, '127.0.0.1', resolve))
const unreachablePort = unreachable.address().port
const config = {
  binaryPath: join(workspace, 'missing-gigastt'),
  modelDir: join(workspace, 'models'),
  hotwordsFile: join(workspace, 'hotwords.txt'),
  engineBaseUrl: `http://127.0.0.1:${unreachablePort}`,
}

const cleanups = []
/** Минимальный контекст Cordis: effect и динамическая инъекция сервисов. */
const makeCtx = (services) => ({
  effect(fn) {
    cleanups.push(fn())
  },
  inject(deps, callback) {
    if (deps.every((dep) => services[dep] !== undefined)) callback(this)
  },
  ...services,
})

console.log('активация без сервиса распознавания')
let bareError
try {
  host.apply(makeCtx({}), config)
} catch (error) {
  bareError = error
}
check('активация без сервиса не падает', bareError === undefined, bareError?.message)
check('нет обязательной зависимости от сервиса', !('inject' in host))

console.log('регистрация провайдера')
const registrations = []
const ctx = makeCtx({
  speechToText: {
    register(provider) {
      registrations.push(provider)
      return async () => {}
    },
  },
})
host.apply(ctx, config)

const provider = registrations[0]
check('имя плагина совпадает с пакетом', host.name === 'dsh-locale-russian', host.name)
check('провайдер зарегистрирован', provider !== undefined)
check('идентификатор провайдера', provider?.info?.id === 'gigaam-local', provider?.info?.id)
check('провайдер помечен как локальный', provider?.info?.location === 'host-local', provider?.info?.location)
check('язык — автоопределение', JSON.stringify(provider?.info?.languages) === '["auto"]', JSON.stringify(provider?.info?.languages))
check('подготовка описана шагами', typeof provider?.preparation?.prepare === 'function')

console.log('состояния до подготовки')
check('начальная фаза — не подготовлено', provider?.preparation?.snapshot()?.phase === 'unprepared', provider?.preparation?.snapshot()?.phase)

console.log('отказ, когда движок недоступен')
await provider.preparation.prepare()
const deadline = Date.now() + 20_000
while (Date.now() < deadline) {
  const phase = provider.preparation.snapshot().phase
  if (phase === 'failed' || phase === 'ready') break
  await new Promise((resolve) => setTimeout(resolve, 50))
}
const failed = provider.preparation.snapshot()
check('подготовка завершилась отказом', failed.phase === 'failed', failed.phase)
check(
  'в отказе сказано, что движок не скачался',
  typeof failed.message === 'string' && failed.message.includes('Не удалось скачать движок'),
  failed.message,
)
check('отказ называет HTTP-статус и адрес', typeof failed.message === 'string' && failed.message.includes('HTTP 404') && failed.message.includes('gigastt-'), failed.message)

console.log('отказ при распознавании без модели')
let transcriptionError
try {
  await provider.transcribe({ audio: new Uint8Array(44), language: 'auto' }, new AbortController().signal)
} catch (error) {
  transcriptionError = error
}
check(
  'распознавание объясняет, что модель не подготовлена',
  transcriptionError instanceof Error && transcriptionError.message.includes('Модель GigaAM не подготовлена'),
  transcriptionError?.message,
)

await new Promise((resolve) => unreachable.close(resolve))
for (const cleanup of cleanups.reverse()) await cleanup()
rmSync(workspace, { recursive: true, force: true })
console.log('  ✓ провайдер выгружается без ошибок')

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки провайдера пройдены')
