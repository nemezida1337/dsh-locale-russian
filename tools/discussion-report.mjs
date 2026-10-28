#!/usr/bin/env node
/**
 * Builds a Markdown report from the GitHub Discussions of the upstream project
 * that this language pack follows (the showcase post and the two proposals).
 *
 * Reads the GraphQL answer of the workflow from a file or stdin and writes the
 * report to stdout; exits with code 10 when there are no comments at all, so the
 * workflow can skip creating an issue.
 *
 * Usage:
 *   gh api graphql -f query='…' | node tools/discussion-report.mjs
 *   node tools/discussion-report.mjs --input answer.json [--self nemezida1337]
 */
import { readFileSync } from 'node:fs'
import { createArgs } from './lib/cli.mjs'

const { option } = createArgs()
const inputPath = option('input')
const self = option('self', 'nemezida1337')
const raw = inputPath === undefined ? readFileSync(0, 'utf8') : readFileSync(inputPath, 'utf8')
const answer = JSON.parse(raw)

const repository = answer?.data?.repository ?? {}
// Запрос может вернуть список обсуждений или алиасы по номерам.
const discussions = repository.discussions?.nodes
  ?? Object.values(repository).filter((value) => value !== null && typeof value === 'object' && 'number' in value)
if (discussions.length === 0) {
  console.error('в ответе нет обсуждений — проверьте запрос')
  process.exit(2)
}

/** Shortens a comment body for the report. */
const shorten = (text, limit = 400) => {
  const single = String(text ?? '').replace(/\s+/gu, ' ').trim()
  return single.length > limit ? `${single.slice(0, limit)}…` : single
}

const withComments = discussions.filter((discussion) => (discussion.comments?.nodes ?? []).length > 0)
if (withComments.length === 0) {
  process.exit(10)
}

const lines = ['### Новые комментарии в обсуждениях DeepSeek Harness', '']
for (const discussion of withComments) {
  const comments = discussion.comments?.nodes ?? []
  lines.push(`#### [#${discussion.number}: ${discussion.title}](${discussion.url})`)
  lines.push('')
  for (const comment of comments.slice(-5)) {
    const author = comment.author?.login ?? 'неизвестный'
    const mine = author === self ? ' (наш)' : ''
    lines.push(`- **@${author}**${mine} · ${String(comment.createdAt ?? '').slice(0, 10)}: ${shorten(comment.body)}`)
  }
  lines.push('')
}
lines.push('---', '')
lines.push('Ответьте в обсуждении или обновите пакет, если требуется реакция на изменения.')
console.log(lines.join('\n'))
