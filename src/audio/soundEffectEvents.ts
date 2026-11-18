export const soundEffectEventBindings = {
  'library.scroll.unroll': 'library-scroll-unroll',
  'library.scroll.roll': 'library-scroll-roll',
} as const

export type SoundEffectEvent = keyof typeof soundEffectEventBindings
export type SoundEffectAsset = { url: string; volume?: number; source?: 'approved' | 'development-preview' }
export type SoundEffectCatalog = Partial<Record<(typeof soundEffectEventBindings)[SoundEffectEvent], SoundEffectAsset>>
