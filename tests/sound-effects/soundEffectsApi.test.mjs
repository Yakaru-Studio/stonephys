import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSoundEffectsMiddleware } from '../../tools/sound-effects/soundEffectsApi.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
async function invoke(middleware, method, url, body) {
  const req = new EventEmitter()
  req.method = method; req.url = url; req.socket = { remoteAddress: '127.0.0.1' }; req.headers = {}
  const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value }, end(value = '') { this.body = value } }
  const pending = middleware(req, response, () => { throw new Error('Unexpected next()') })
  const delivery = body === undefined ? null : (async () => {
    while (!req.listenerCount('data')) await new Promise((resolve) => setImmediate(resolve))
    req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end')
  })()
  await pending
  await delivery
  return { status: response.statusCode, json: JSON.parse(response.body || '{}') }
}

test('status lists exactly two local effects and keeps paid generation off by default', async () => {
  const middleware = createSoundEffectsMiddleware({ root, getApiKey: () => '', getSettings: () => ({ model: 'eleven_text_to_sound_v3', generationEnabled: 'false', allowPaidGeneration: 'false' }) })
  {
    const response = await invoke(middleware, 'GET', '/status')
    const status = response.json
    assert.equal(response.status, 200)
    assert.deepEqual(status.effects.map((effect) => effect.id), ['library-scroll-unroll', 'library-scroll-roll'])
    assert.equal(status.canGenerate, false)
    assert.equal(status.apiConfigured, false)
    assert.equal(status.paidRequests, 0)
    assert.equal(status.spentCredits, 0)
  }
})

test('generation is refused without credentials and authorization flags before any external request', async () => {
  const middleware = createSoundEffectsMiddleware({ root, getApiKey: () => '', getSettings: () => ({ model: 'eleven_text_to_sound_v3', generationEnabled: 'false', allowPaidGeneration: 'false' }) })
  {
    const response = await invoke(middleware, 'POST', '/generate', { effectId: 'library-scroll-unroll', prompt: 'test prompt', model: 'eleven_text_to_sound_v3', durationSeconds: .95, promptInfluence: .5, loop: false, requestId: 'no-credential-test', authorization: 'I understand this may consume quota or be billed' })
    const result = response.json
    assert.equal(response.status, 409)
    assert.match(result.error, /ELEVENLABS_API_KEY/)
  }
})
