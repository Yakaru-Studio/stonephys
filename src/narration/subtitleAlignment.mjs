const clean = (word) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]/gu, '')

export function alignTranscriptToScript(script, timedWords) {
  const tokens = script.match(/\S+/g) || []
  const left = tokens.map(clean)
  const right = timedWords.map((word) => clean(word.text))
  const rows = left.length + 1
  const cols = right.length + 1
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols))
  for (let i = 0; i < rows; i++) dp[i][0] = i
  for (let j = 0; j < cols; j++) dp[0][j] = j
  for (let i = 1; i < rows; i++) for (let j = 1; j < cols; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1))
  }
  const aligned = []
  let i = left.length, j = right.length, matches = 0
  while (i && j) {
    if (left[i - 1] === right[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      aligned.push({ tokenIndex: i - 1, wordIndex: j - 1 }); matches++; i--; j--
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j-- }
    else if (dp[i][j] === dp[i - 1][j] + 1) i--
    else j--
  }
  aligned.reverse()
  const similarity = tokens.length ? matches / Math.max(tokens.length, timedWords.length) : 0
  if (similarity < .82) return { similarity, requiresReview: true, segments: [], alignedWords: aligned }
  const timeByToken = new Map(aligned.map(({ tokenIndex, wordIndex }) => [tokenIndex, timedWords[wordIndex]]))
  const segments = []
  let start = 0
  while (start < tokens.length) {
    let end = start + 1
    while (end < tokens.length && end - start < 8) {
      const previous = timeByToken.get(end - 1)
      const next = timeByToken.get(end)
      const punctuationBreak = /[,;:.!?…]$/.test(tokens[end - 1]) && end - start >= 3
      const longPause = previous && next && next.startMs - previous.endMs > 480 && end - start >= 3
      if (punctuationBreak || longPause) break
      end++
    }
    const range = Array.from({ length: end - start }, (_, offset) => timeByToken.get(start + offset)).filter(Boolean)
    if (range.length) segments.push({ id: `harrison-caption-${segments.length + 1}`, text: tokens.slice(start, end).join(' '), startMs: range[0].startMs, endMs: range.at(-1).endMs, wordTimings: range })
    start = end
  }
  return { similarity, requiresReview: false, segments, alignedWords: aligned }
}

export function toWebVtt(segments) {
  const stamp = (milliseconds) => {
    const ms = Math.max(0, Math.round(milliseconds))
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor(ms % 3600000 / 60000)
    const seconds = Math.floor(ms % 60000 / 1000)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
  }
  return `WEBVTT\n\n${segments.map((cue) => `${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}`).join('\n\n')}\n`
}

export function validateSubtitleSegments(segments, durationMs) {
  const errors = []
  let previousEnd = -1
  for (const [index, cue] of segments.entries()) {
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs) || cue.startMs < 0 || cue.endMs <= cue.startMs) errors.push(`Legenda ${index + 1}: intervalo inválido.`)
    if (cue.startMs < previousEnd) errors.push(`Legenda ${index + 1}: sobrepõe a anterior.`)
    if (cue.endMs > durationMs) errors.push(`Legenda ${index + 1}: termina depois do áudio.`)
    previousEnd = cue.endMs
  }
  return errors
}
