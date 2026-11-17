import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAudioApproval, validateNarrationStage } from '../../src/narration/productionGates.mjs'

const profile = { status: 'voice-not-created', voiceId: null, interpretationApproved: false, approvedInterpretationId: null }
const short = 'Tempo... Estamos atravessando-o agora… Nesse exato momento, estou eu falando contigo...'
const full = 'Roteiro completo aprovado.'

test('amostras de identidade aceitam texto editado dentro de 10–20 segundos', () => {
  assert.equal(validateNarrationStage({ profile, kind: 'audition', text: short, voiceId: 'voice-a', direction: 'sample', auditionText: short, approvedScript: full }), null)
  const edited = 'Tempo... Há séculos, minhas ideias atravessam o tempo e chegam até você. Juntos, vamos descobrir como ele foi medido e compreendido.'
  assert.equal(validateNarrationStage({ profile, kind: 'audition', text: edited, voiceId: 'voice-a', direction: 'sample', auditionText: short, approvedScript: full }), null)
  assert.match(validateNarrationStage({ profile, kind: 'audition', text: 'Tempo.', voiceId: 'voice-a', direction: 'sample', auditionText: short, approvedScript: full }), /10 e 20 segundos/)
})

test('fluxo de amostra de interpretação foi removido', () => {
  const approvedVoice = { status: 'approved', voiceId: 'voice-a', interpretationApproved: false, approvedInterpretationId: null }
  assert.match(validateNarrationStage({ profile: approvedVoice, kind: 'interpretation', text: short, voiceId: 'voice-a' }), /Tipo de produção inválido/)
})

test('narração completa exige identidade aprovada e permite conteúdo/direção revisados', () => {
  const voiceApproved = { status: 'approved', voiceId: 'voice-a', interpretationApproved: false, approvedInterpretationId: null }
  const identityPending = { status: 'identity-selection-pending', voiceId: null }
  assert.match(validateNarrationStage({ profile: identityPending, kind: 'full', text: full, voiceId: 'voice-a' }), /bloqueada/)
  assert.equal(validateNarrationStage({ profile: voiceApproved, kind: 'full', text: `${full}! Texto revisado pelo desenvolvedor.`, voiceId: 'voice-a' }), null)
  assert.match(validateNarrationStage({ profile: voiceApproved, kind: 'full', text: '  ', voiceId: 'voice-a' }), /não pode ficar vazio/)
})

test('integração exige identidade aprovada e timestamps dentro da duração do áudio', () => {
  const identityApproved = { status: 'approved', voiceId: 'voice-a', interpretationApproved: false }
  const validCues = [{ text: 'Tempo', startMs: 0, endMs: 400 }, { text: 'agora', startMs: 450, endMs: 800 }]
  assert.match(validateAudioApproval({ profile, durationMs: 1000, segments: validCues }), /Aprove a identidade/)
  assert.equal(validateAudioApproval({ profile: identityApproved, durationMs: 1000, segments: validCues }), null)
  assert.match(validateAudioApproval({ profile: identityApproved, durationMs: 700, segments: validCues }), /timestamps inválidos/)
})
