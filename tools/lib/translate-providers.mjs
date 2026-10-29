/**
 * Providers for the translation tools: one interface over a model endpoint, an
 * external command, or a deterministic mock.
 *
 * A provider exposes `complete(system, payload)`, where `system` is the prompt
 * and `payload` is the tool's JSON-serialisable request. The answer is the raw
 * text; each tool parses its own JSON shape out of it.
 */
import { spawnSync } from 'node:child_process'

/**
 * Creates a provider.
 * @param options - provider name plus its settings.
 * @returns a provider with an id and `complete`.
 */
export function createProvider({ name, command, baseUrl, model, apiKeyEnv, mockResponse }) {
  if (name === 'mock') {
    if (typeof mockResponse !== 'function') throw new Error('провайдеру mock нужен mockResponse')
    return {
      id: 'mock',
      async complete(system, payload) {
        return JSON.stringify(mockResponse(payload))
      },
    }
  }

  if (name === 'command') {
    if (typeof command !== 'string' || command.trim().length === 0) {
      throw new Error('провайдеру command нужен --command')
    }
    return {
      id: `command:${command}`,
      async complete(system, payload) {
        const request = JSON.stringify({ system, payload })
        const result = spawnSync(command, { shell: true, input: request, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
        if (result.error !== undefined) throw new Error(`провайдер не запустился: ${result.error.message}`)
        if (result.status !== 0) throw new Error(`провайдер завершился с кодом ${result.status}: ${String(result.stderr).slice(0, 500)}`)
        return result.stdout
      },
    }
  }

  if (name === 'openai') {
    const endpoint = (baseUrl ?? 'https://api.deepseek.com/v1').replace(/\/+$/u, '')
    const chosenModel = model ?? 'deepseek-chat'
    const keyVariable = apiKeyEnv ?? 'DEEPSEEK_API_KEY'
    const apiKey = process.env[keyVariable]
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error(`провайдер openai требует ключ в переменной ${keyVariable}`)
    }
    return {
      id: `openai:${chosenModel}`,
      async complete(system, payload) {
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: chosenModel,
            temperature: 0.2,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: JSON.stringify(payload) },
            ],
          }),
          signal: AbortSignal.timeout(180_000),
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`провайдер ответил HTTP ${response.status}: ${body.slice(0, 300)}`)
        }
        const answer = await response.json()
        const content = answer?.choices?.[0]?.message?.content
        if (typeof content !== 'string') throw new Error('в ответе провайдера нет текста')
        return content
      },
    }
  }

  throw new Error(`неизвестный провайдер: ${name}`)
}

/**
 * Parses a JSON array out of a model answer, tolerating code fences and prose
 * around it.
 * @param text - raw answer.
 * @returns the parsed array.
 */
export function parseJsonArray(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?/u, '').replace(/```$/u, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error(`провайдер вернул не JSON-массив: ${cleaned.slice(0, 300)}`)
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('провайдер вернул не массив')
  return parsed
}
