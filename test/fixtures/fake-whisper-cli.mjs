#!/usr/bin/env node
/** Stand-in whisper-cli for tests: prints FAKE_WHISPER_TRANSCRIPT or a default phrase. */
console.log(process.env.FAKE_WHISPER_TRANSCRIPT ?? 'Проверка связи')
