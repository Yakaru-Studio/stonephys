import test from 'node:test'
import assert from 'node:assert/strict'
import { alignTranscriptToScript, toWebVtt, validateSubtitleSegments } from '../../src/narration/subtitleAlignment.mjs'

test('alinha roteiro acentuado com palavras cronometradas e mantém o texto aprovado', () => {
  const result = alignTranscriptToScript('Tempo... estamos juntos.', [
    { text: 'Tempo', startMs: 100, endMs: 420 },
    { text: 'estamos', startMs: 600, endMs: 900 },
    { text: 'juntos', startMs: 950, endMs: 1250 },
  ])
  assert.equal(result.requiresReview, false)
  assert.equal(result.similarity, 1)
  assert.equal(result.segments[0].text, 'Tempo... estamos juntos.')
  assert.equal(result.segments[0].startMs, 100)
  assert.equal(result.segments[0].endMs, 1250)
})

test('não inventa timestamps quando a transcrição diverge do roteiro', () => {
  const result = alignTranscriptToScript('A lua iluminava o caminho antigo.', [
    { text: 'O', startMs: 0, endMs: 80 },
    { text: 'relógio', startMs: 90, endMs: 500 },
    { text: 'marca', startMs: 510, endMs: 740 },
    { text: 'o', startMs: 750, endMs: 790 },
    { text: 'tempo', startMs: 800, endMs: 1200 },
  ])
  assert.equal(result.requiresReview, true)
  assert.deepEqual(result.segments, [])
})

test('gera WebVTT e encontra sobreposição ou intervalos inválidos', () => {
  const cues = [
    { id: 'a', text: 'Tempo.', startMs: 250, endMs: 900, wordTimings: [] },
    { id: 'b', text: 'Continua.', startMs: 800, endMs: 1200, wordTimings: [] },
    { id: 'c', text: 'Inválido.', startMs: 1400, endMs: 1300, wordTimings: [] },
  ]
  assert.match(toWebVtt(cues), /00:00:00\.250 --> 00:00:00\.900\nTempo\./)
  assert.deepEqual(validateSubtitleSegments(cues, 1250), [
    'Legenda 2: sobrepõe a anterior.',
    'Legenda 3: intervalo inválido.',
    'Legenda 3: termina depois do áudio.',
  ])
})
