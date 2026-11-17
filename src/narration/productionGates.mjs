export function validateNarrationStage({ profile, kind, text, voiceId }) {
  if (!['audition', 'full'].includes(kind)) return 'Tipo de produção inválido.'
  if (kind !== 'full') {
    const words = text.trim().split(/\s+/u).filter(Boolean).length
    const estimatedSeconds = words * 60 / 80 + 2
    if (estimatedSeconds < 10 || estimatedSeconds > 20) return 'A amostra de voz precisa ter duração estimada entre 10 e 20 segundos.'
  }
  if (kind === 'full') {
    if (profile.status !== 'approved' || voiceId !== profile.voiceId) return 'A narração completa está bloqueada até aprovar a identidade vocal.'
    if (!text.trim()) return 'O texto da narração completa não pode ficar vazio.'
  }
  return null
}

export function validateAudioApproval({ profile, durationMs, segments }) {
  if (profile.status !== 'approved' || !profile.voiceId) return 'Aprove a identidade vocal de Harrison antes de integrar uma narração completa.'
  if (!Number.isFinite(Number(durationMs)) || Number(durationMs) <= 0 || !Array.isArray(segments) || segments.length === 0) return 'Áudio ou legendas sem duração válida.'
  let end = 0
  for (const [index, segment] of segments.entries()) {
    if (!segment.text || !Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.startMs < 0 || segment.endMs <= segment.startMs || segment.startMs < end || segment.endMs > Number(durationMs)) return `Legenda ${index + 1}: timestamps inválidos, sobrepostos ou fora da duração do áudio.`
    end = segment.endMs
  }
  return null
}
