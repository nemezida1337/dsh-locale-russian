#!/usr/bin/env node
/**
 * Stand-in for whisper-server: answers / and /inference so the warm HTTP path
 * can be tested without the real model.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1])
if (process.env.FAKE_SERVER_PID) writeFileSync(process.env.FAKE_SERVER_PID, String(process.pid))
if (process.env.FAKE_SERVER_STARTS) appendFileSync(process.env.FAKE_SERVER_STARTS, `${process.pid}\n`)
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
    const body = Buffer.concat(chunks)
    if (process.env.FAKE_SERVER_BODY) writeFileSync(process.env.FAKE_SERVER_BODY, body)
    if (process.env.FAKE_SERVER_MARKER) appendFileSync(process.env.FAKE_SERVER_MARKER, `${body.length}\n`)
    const delay = Number(process.env.FAKE_INFERENCE_DELAY ?? 0)
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ text: process.env.FAKE_WHISPER_TRANSCRIPT ?? 'Проверка связи' }))
    }, delay)
  })
})
const delay = Number(process.env.FAKE_SERVER_DELAY ?? 0)
setTimeout(() => server.listen(port, '127.0.0.1'), delay)
process.on('SIGTERM', () => process.exit(0))
