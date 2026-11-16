import { defaultAudioSettings, type AudioSettings } from './audioSettings'

export type SoundEffect =
  | 'neuronSelect'
  | 'neuronUnlock'
  | 'starSelect'
  | 'starUnlock'
  | 'connection'
  | 'moduleComplete'
  | 'navigation'

type Tone = {
  frequency: number
  endFrequency?: number
  start: number
  duration: number
  gain: number
  type?: OscillatorType
}

type SoundPattern = { volume: number; tones: Tone[] }

const soundPatterns: Record<SoundEffect, SoundPattern> = {
  neuronSelect: { volume: .8, tones: [
    { frequency: 660, start: 0, duration: .16, gain: .1 },
    { frequency: 990, start: .035, duration: .23, gain: .045 },
  ] },
  neuronUnlock: { volume: .9, tones: [
    { frequency: 392, start: 0, duration: .36, gain: .075 },
    { frequency: 523.25, start: .11, duration: .42, gain: .07 },
    { frequency: 659.25, start: .23, duration: .52, gain: .065 },
    { frequency: 783.99, start: .35, duration: .65, gain: .06 },
    { frequency: 1174.66, start: .48, duration: .7, gain: .025 },
  ] },
  starSelect: { volume: .76, tones: [
    { frequency: 880, start: 0, duration: .13, gain: .085 },
    { frequency: 1318.51, start: .02, duration: .22, gain: .04 },
  ] },
  starUnlock: { volume: .84, tones: [
    { frequency: 440, start: 0, duration: .22, gain: .065 },
    { frequency: 587.33, start: .09, duration: .27, gain: .065 },
    { frequency: 783.99, start: .19, duration: .34, gain: .06 },
    { frequency: 1174.66, start: .31, duration: .54, gain: .04 },
  ] },
  connection: { volume: .62, tones: [
    { frequency: 360, endFrequency: 720, start: 0, duration: .72, gain: .045 },
    { frequency: 540, endFrequency: 810, start: .08, duration: .53, gain: .024 },
  ] },
  moduleComplete: { volume: .86, tones: [
    { frequency: 392, start: 0, duration: 1.15, gain: .048 },
    { frequency: 493.88, start: .12, duration: 1.2, gain: .045 },
    { frequency: 587.33, start: .25, duration: 1.25, gain: .04 },
    { frequency: 783.99, start: .4, duration: 1.35, gain: .038 },
    { frequency: 987.77, start: .55, duration: 1.45, gain: .026 },
  ] },
  navigation: { volume: .58, tones: [
    { frequency: 330, endFrequency: 495, start: 0, duration: .22, gain: .04 },
    { frequency: 660, start: .07, duration: .18, gain: .018 },
  ] },
}

class AudioManager {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private reverbInput: GainNode | null = null
  private settings: AudioSettings = defaultAudioSettings
  private activeVoices = 0
  private readonly maxVoices = 6
  private musicElement: HTMLAudioElement | null = null
  private musicSource: MediaElementAudioSourceNode | null = null

  setSettings(settings: AudioSettings) {
    this.settings = settings
    if (!this.context || !this.masterGain || !this.effectsGain || !this.musicGain) return
    const now = this.context.currentTime
    this.masterGain.gain.setTargetAtTime(settings.enabled ? settings.masterVolume : 0, now, .025)
    this.effectsGain.gain.setTargetAtTime(settings.effectsVolume, now, .025)
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, now, .04)
  }

  play(effect: SoundEffect) {
    if (!this.settings.enabled || this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return
    if (this.activeVoices >= this.maxVoices) return

    const context = this.getContext()
    if (context.state === 'suspended') void context.resume()
    const pattern = soundPatterns[effect]
    const voice = context.createGain()
    voice.gain.value = pattern.volume
    voice.connect(this.effectsGain!)

    let longestTone = 0
    for (const tone of pattern.tones) {
      const startAt = context.currentTime + tone.start
      const endAt = startAt + tone.duration
      longestTone = Math.max(longestTone, tone.start + tone.duration)

      const oscillator = context.createOscillator()
      const filter = context.createBiquadFilter()
      const envelope = context.createGain()
      const reverbSend = context.createGain()
      oscillator.type = tone.type ?? 'sine'
      oscillator.frequency.setValueAtTime(tone.frequency, startAt)
      if (tone.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, endAt)
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(Math.min(4800, Math.max(1100, tone.frequency * 4)), startAt)
      filter.Q.setValueAtTime(.45, startAt)
      envelope.gain.setValueAtTime(.0001, startAt)
      envelope.gain.exponentialRampToValueAtTime(Math.max(.001, tone.gain), startAt + Math.min(.025, tone.duration * .25))
      envelope.gain.exponentialRampToValueAtTime(.0001, endAt)
      reverbSend.gain.value = .13

      oscillator.connect(filter)
      filter.connect(envelope)
      envelope.connect(voice)
      envelope.connect(reverbSend)
      reverbSend.connect(this.reverbInput!)
      oscillator.onended = () => {
        oscillator.disconnect()
        filter.disconnect()
        envelope.disconnect()
        reverbSend.disconnect()
      }
      oscillator.start(startAt)
      oscillator.stop(endAt + .035)
    }

    this.activeVoices += 1
    window.setTimeout(() => {
      voice.disconnect()
      this.activeVoices = Math.max(0, this.activeVoices - 1)
    }, (longestTone + .9) * 1000)
  }

  async playMusicAsset(source: string) {
    if (!this.settings.enabled || this.settings.musicVolume <= 0) return
    const context = this.getContext()
    if (context.state === 'suspended') await context.resume()
    if (!this.musicElement) {
      this.musicElement = new Audio()
      this.musicElement.loop = true
      this.musicSource = context.createMediaElementSource(this.musicElement)
      this.musicSource.connect(this.musicGain!)
    }
    if (this.musicElement.src !== new URL(source, window.location.href).href) this.musicElement.src = source
    await this.musicElement.play()
  }

  stopMusic() {
    this.musicElement?.pause()
  }

  private getContext() {
    if (this.context) return this.context

    const context = new AudioContext()
    const master = context.createGain()
    const effects = context.createGain()
    const music = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const reverbInput = context.createGain()
    const delay = context.createDelay(1)
    const lowpass = context.createBiquadFilter()
    const feedback = context.createGain()

    master.gain.value = this.settings.enabled ? this.settings.masterVolume : 0
    effects.gain.value = this.settings.effectsVolume
    music.gain.value = this.settings.musicVolume
    compressor.threshold.value = -16
    compressor.knee.value = 18
    compressor.ratio.value = 3
    compressor.attack.value = .004
    compressor.release.value = .24
    delay.delayTime.value = .28
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 3200
    feedback.gain.value = .16

    effects.connect(master)
    music.connect(master)
    master.connect(compressor)
    compressor.connect(context.destination)
    reverbInput.connect(delay)
    delay.connect(lowpass)
    lowpass.connect(master)
    lowpass.connect(feedback)
    feedback.connect(delay)

    this.context = context
    this.masterGain = master
    this.effectsGain = effects
    this.musicGain = music
    this.reverbInput = reverbInput
    return context
  }
}

export const audioManager = new AudioManager()
