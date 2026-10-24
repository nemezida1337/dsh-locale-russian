#!/usr/bin/env node
/**
 * Offline smoke test for the host half: mounts the speech provider against a
 * fake cordis context and checks registration plus the failure paths that a user
 * sees before the engine and the model are prepared. The real recognition is
 * exercised by `install.sh` + the plugin card, which need the model on disk.
 *
 * Usage:
 *   node tools/test-speech-provider.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject, name } from '../lib/index.js'

const failures = []
const check = (label, condition, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(label)
    console.log(`  ✗ ${label}${detail === undefined ? '' : `: ${detail}`}`)
  }
}

console.log('регистрация провайдера')
check('имя плагина совпадает с пакетом', name === 'dsh-locale-russian', name)
check('плагин ждёт сервис распознавания', Array.isArray(inject) && inject.includes('speechToText'))

const registrations = []
const cleanups = []
const ctx = {
  effect(fn) {
    cleanups.push(fn())
  },
  speechToText: {
    register(provider) {
      registrations.push(provider)
      return async () => {}
    },
  },
}

// Пустые каталоги: тест не зависит от того, установлена ли модель на машине.
const workspace = mkdtempSync(join(tmpdir(), 'dsh-speech-test-'))
apply(ctx, {
  binaryPath: join(workspace, 'missing-gigastt'),
  modelDir: join(workspace, 'models'),
  hotwordsFile: join(workspace, 'hotwords.txt'),
})

const provider = registrations[0]
check('провайдер зарегистрирован', provider !== undefined)
check('идентификатор провайдера', provider?.info?.id === 'gigaam-local', provider?.info?.id)
check('провайдер помечен как локальный', provider?.info?.location === 'host-local', provider?.info?.location)
check('язык — автоопределение', JSON.stringify(provider?.info?.languages) === '["auto"]', JSON.stringify(provider?.info?.languages))
check('подготовка описана шагами', typeof provider?.preparation?.prepare === 'function')

console.log('состояния до подготовки')
check('начальная фаза — не подготовлено', provider?.preparation?.snapshot()?.phase === 'unprepared', provider?.preparation?.snapshot()?.phase)

console.log('отказ без движка распознавания')
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
  'в отказе сказано, что установить движок',
  typeof failed.message === 'string' && failed.message.includes('Движок распознавания не установлен'),
  failed.message,
)
check('отказ упоминает install.sh', typeof failed.message === 'string' && failed.message.includes('install.sh'))

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

for (const cleanup of cleanups.reverse()) await cleanup()
rmSync(workspace, { recursive: true, force: true })
console.log('  ✓ провайдер выгружается без ошибок')

if (failures.length > 0) {
  console.error(`провалено проверок: ${failures.length}`)
  process.exit(1)
}
console.log('все проверки провайдера пройдены')
