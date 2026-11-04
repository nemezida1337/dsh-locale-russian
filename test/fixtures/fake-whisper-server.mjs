#!/usr/bin/env node
/**
 * Stand-in for whisper-server: answers /ready and /inference so the warm
 * HTTP path can be tested without the real model.
 */
import { appendFileSync } from 'node:fs'
import { createServer } from 'node:http'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1])
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200)
    response.end('ok')
    return
  }
  if (request.url !== '/inference') {
    response.writeHead(404)
    response.end('not found')
    return
  }
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    if (process.env.FAKE_SERVER_MARKER) appendFileSync(process.env.FAKE_SERVER_MARKER, `${chunks.reduce((sum, chunk) => sum + chunk.length, 0)}\n`)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ text: process.env.FAKE_WHISPER_TRANSCRIPT ?? 'Проверка связи' }))
  })
})
server.listen(port, '127.0.0.1')
process.on('SIGTERM', () => process.exit(0))
