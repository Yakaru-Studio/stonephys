export type AudioSettings = {
  enabled: boolean
  masterVolume: number
  effectsVolume: number
  soundEffectsVolume: number
  ambienceVolume: number
  musicVolume: number
  voiceVolume: number
}

export const AUDIO_SETTINGS_KEY = 'stone-phys.audio-settings.v1'
const previousDefaultVoiceVolume = 0.82

export const defaultAudioSettings: AudioSettings = {
  enabled: true,
  masterVolume: 0.72,
  effectsVolume: 0.58,
  soundEffectsVolume: 0.58,
  ambienceVolume: 0.24,
  musicVolume: 0.28,
  voiceVolume: 0.74,
}

const clampVolume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return defaultAudioSettings
  try {
    const stored = window.localStorage.getItem(AUDIO_SETTINGS_KEY)
    if (!stored) return defaultAudioSettings
    const parsed = JSON.parse(stored) as Partial<AudioSettings>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultAudioSettings.enabled,
      masterVolume: clampVolume(parsed.masterVolume, defaultAudioSettings.masterVolume),
      effectsVolume: clampVolume(parsed.effectsVolume, defaultAudioSettings.effectsVolume),
      soundEffectsVolume: clampVolume(parsed.soundEffectsVolume, defaultAudioSettings.soundEffectsVolume),
      ambienceVolume: clampVolume(parsed.ambienceVolume, defaultAudioSettings.ambienceVolume),
      musicVolume: clampVolume(parsed.musicVolume, defaultAudioSettings.musicVolume),
      voiceVolume: clampVolume(parsed.voiceVolume === previousDefaultVoiceVolume ? defaultAudioSettings.voiceVolume : parsed.voiceVolume, defaultAudioSettings.voiceVolume),
    }
  } catch {
    return defaultAudioSettings
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
