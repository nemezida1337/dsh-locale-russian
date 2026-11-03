#!/usr/bin/env node
/**
 * Stand-in engine for tests: records its argv when started with `serve`, answers
 * `/ready`, and returns a fixed transcript for `/v1/transcribe`.
 */
import { appendFileSync } from 'node:fs'
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
  request.on('data', () => {})
  request.on('end', () => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ text: process.env.FAKE_TRANSCRIPT ?? 'Проверка связи', duration: 1 }))
  })
})
server.listen(port, '127.0.0.1')
process.on('SIGTERM', () => process.exit(0))
