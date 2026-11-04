#!/usr/bin/env node
/**
 * Stand-in engine for tests: records its argv when started with `serve`, answers
 * `/ready`, and returns a fixed transcript for `/v1/transcribe`.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const args = process.argv.slice(2)
if (args[0] === '--version') {
  console.log('gigastt 2.22.0')
  process.exit(0)
}
if (args[0] !== 'serve') process.exit(0)
if (process.env.ARGS_FILE) appendFileSync(process.env.ARGS_FILE, `${JSON.stringify(args)}\n`)

const port = Number(args[args.indexOf('--port') + 1])
const server = createServer((request, response) => {
  if (request.url === '/ready') {
    response.writeHead(200)
    response.end('ok')
    return
  }
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    if (process.env.FAKE_AUDIO_OUT) writeFileSync(process.env.FAKE_AUDIO_OUT, Buffer.concat(chunks))
    if (process.env.FAKE_FAIL === '1') {
      response.writeHead(500, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'fake failure' }))
      return
    }
    const text = process.env.FAKE_TRANSCRIPT ?? 'Проверка связи'
    // Синтетические тайминги: 0.4 с на слово, как у настоящего GigaAM.
    const words = process.env.FAKE_WORDS_JSON !== undefined
      ? JSON.parse(process.env.FAKE_WORDS_JSON)
      : text.split(/\s+/u).filter(Boolean).map((word, index) => ({
          word,
          start: Number((index * 0.4).toFixed(2)),
          end: Number((index * 0.4 + 0.35).toFixed(2)),
          confidence: 0.95,
        }))
    const duration = Number(process.env.FAKE_AUDIO_DURATION ?? 1)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ text, duration, words }))
  })
})
server.listen(port, '127.0.0.1')
process.on('SIGTERM', () => process.exit(0))
