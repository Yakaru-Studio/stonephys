export function validateNarrationStage(args: { profile: Record<string, any>; kind: string; text: string; voiceId: string }): string | null
export function validateAudioApproval(args: { profile: Record<string, any>; durationMs: number; segments: Array<{ text: string; startMs: number; endMs: number }> }): string | null
