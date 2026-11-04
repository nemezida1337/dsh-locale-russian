#!/usr/bin/env node
/** Stand-in whisper-cli for tests: prints FAKE_WHISPER_TRANSCRIPT or a default phrase. */
import { appendFileSync } from 'node:fs'

if (process.env.FAKE_WHISPER_ARGS) appendFileSync(process.env.FAKE_WHISPER_ARGS, `${JSON.stringify(process.argv.slice(2))}\n`)
const delay = Number(process.env.FAKE_WHISPER_DELAY ?? 0)
setTimeout(() => console.log(process.env.FAKE_WHISPER_TRANSCRIPT ?? 'Проверка связи'), delay)
