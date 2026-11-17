export type TimedWord = { text: string; startMs: number; endMs: number }
export type TimedSegment = { id: string; text: string; startMs: number; endMs: number; wordTimings: TimedWord[] }
export function alignTranscriptToScript(script: string, words: TimedWord[]): { similarity: number; requiresReview: boolean; segments: TimedSegment[]; alignedWords: Array<{ tokenIndex: number; wordIndex: number }> }
export function toWebVtt(segments: TimedSegment[]): string
export function validateSubtitleSegments(segments: TimedSegment[], durationMs: number): string[]
