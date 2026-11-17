import { defaultAudioSettings, type AudioSettings } from './audioSettings'

export type SoundEffect =
  | 'neuronSelect'
  | 'neuronUnlock'
  | 'starSelect'
  | 'starUnlock'
  | 'connection'
  | 'moduleComplete'
  | 'navigation'
  | 'sceneTransition'
  | 'blackoutWhoosh'

type Tone = {
  frequency: number
  endFrequency?: number
  start: number
  duration: number
  gain: number
  attack?: number
  release?: number
  type?: OscillatorType
}

type SoundPattern = { volume: number; tones: Tone[] }
type MusicDeck = { element: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; cropStart: number; cropEnd: number | null; loop: boolean; loopCrossfadeMs: number; loopCrossfading: boolean }

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
  sceneTransition: { volume: 1, tones: [
    // Keep the ominous sub-bass, but add audible harmonics for laptop and phone speakers.
    { frequency: 43, endFrequency: 29, start: 0, duration: 9.5, gain: .15, attack: .45, release: .8, type: 'sine' },
    { frequency: 82, endFrequency: 48, start: .02, duration: 9.45, gain: .12, attack: .5, release: .8, type: 'triangle' },
    { frequency: 123, endFrequency: 72, start: .08, duration: 9.35, gain: .1, attack: .55, release: .85, type: 'sine' },
    { frequency: 185, endFrequency: 108, start: .16, duration: 9.2, gain: .075, attack: .7, release: .9, type: 'triangle' },
    { frequency: 247, endFrequency: 144, start: .28, duration: 8.95, gain: .045, attack: .9, release: .95, type: 'sine' },
  ] },
  blackoutWhoosh: { volume: 0, tones: [] },
}

class AudioManager {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private voiceGain: GainNode | null = null
  private narrationElement: HTMLAudioElement | null = null
  private narrationSource: MediaElementAudioSourceNode | null = null
  private reverbInput: GainNode | null = null
  private settings: AudioSettings = defaultAudioSettings
  private narrationMusicLevel = .42
  private activeVoices = 0
  private readonly maxVoices = 6
  private musicDecks: MusicDeck[] = []
  private activeMusicDeck = 0
  private currentMusicUrl = ''
  private musicLoop = true
  private musicTrackGain = 1
  private musicFadeTimers: Array<number | null> = [null, null]
  private clockTickTimer: number | null = null
  private clockTickIndex = 0
  private clockTickIntervalMs = 1000
  private clockTickLastAt = 0

  setSettings(settings: AudioSettings) {
    this.settings = settings
    if (!this.context || !this.masterGain || !this.effectsGain || !this.musicGain || !this.voiceGain) return
    const now = this.context.currentTime
    this.masterGain.gain.setTargetAtTime(settings.enabled ? settings.masterVolume : 0, now, .025)
    this.effectsGain.gain.setTargetAtTime(settings.effectsVolume, now, .025)
    this.musicGain.gain.setTargetAtTime(this.narrationElement && !this.narrationElement.paused ? settings.musicVolume * this.narrationMusicLevel : settings.musicVolume, now, .04)
    this.voiceGain.gain.setTargetAtTime(settings.voiceVolume, now, .04)
  }

  async playNarration(source: string) {
    const context = this.getContext()
    if (context.state === 'suspended') await context.resume()
    if (!this.narrationElement) {
      this.narrationElement = new Audio()
      this.narrationElement.preload = 'auto'
      this.narrationSource = context.createMediaElementSource(this.narrationElement)
      this.narrationSource.connect(this.voiceGain!)
    }
    if (this.narrationElement.src !== new URL(source, window.location.href).href) this.narrationElement.src = source
    this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume * this.narrationMusicLevel, context.currentTime, .35)
    try {
      await this.narrationElement.play()
    } catch (error) {
      this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume, context.currentTime, .25)
      throw error
    }
    return this.narrationElement
  }

  setNarrationMusicLevel(value: number) {
    this.narrationMusicLevel = Math.max(.1, Math.min(.75, value))
    if (this.context && this.narrationElement && !this.narrationElement.paused) {
      this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume * this.narrationMusicLevel, this.context.currentTime, .35)
    }
  }

  pauseNarration() {
    this.narrationElement?.pause()
    if (this.context) this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume, this.context.currentTime, .35)
  }
  async resumeNarration() {
    if (!this.narrationElement) return
    if (this.context) this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume * this.narrationMusicLevel, this.context.currentTime, .35)
    try { await this.narrationElement.play() }
    catch (error) {
      if (this.context) this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume, this.context.currentTime, .25)
      throw error
    }
  }
  seekNarration(seconds: number) {
    if (this.narrationElement) this.narrationElement.currentTime = Math.max(0, seconds)
  }
  stopNarration() {
    if (this.narrationElement) {
      this.narrationElement.pause()
      this.narrationElement.removeAttribute('src')
      this.narrationElement.load()
    }
    if (this.context) this.musicGain?.gain.setTargetAtTime(this.settings.musicVolume, this.context.currentTime, .3)
  }

  startClockTicks(intervalMs = 1000) {
    if (this.clockTickTimer !== null) {
      this.setClockTickRate(intervalMs)
      return
    }
    this.clockTickIntervalMs = intervalMs
    this.playClockTick()
    this.clockTickLastAt = performance.now()
    this.scheduleClockTick()
  }

  setClockTickRate(intervalMs: number) {
    const nextInterval = Math.max(85, Math.min(1200, intervalMs))
    if (this.clockTickTimer === null) {
      this.startClockTicks(nextInterval)
      return
    }
    if (Math.abs(nextInterval - this.clockTickIntervalMs) < 45) return
    this.clockTickIntervalMs = nextInterval
    window.clearTimeout(this.clockTickTimer)
    const elapsedSinceTick = performance.now() - this.clockTickLastAt
    this.scheduleClockTick(Math.max(0, this.clockTickIntervalMs - elapsedSinceTick))
  }

  stopClockTicks() {
    if (this.clockTickTimer !== null) window.clearTimeout(this.clockTickTimer)
    this.clockTickTimer = null
    this.clockTickIntervalMs = 1000
  }

  private scheduleClockTick(delayMs = this.clockTickIntervalMs) {
    this.clockTickTimer = window.setTimeout(() => {
      this.playClockTick()
      this.clockTickLastAt = performance.now()
      this.scheduleClockTick()
    }, delayMs)
  }

  private playClockTick() {
    if (!this.settings.enabled || this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return
    const context = this.getContext()
    if (context.state !== 'running') return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    const send = context.createGain()
    const brighter = this.clockTickIndex++ % 2 === 0
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(brighter ? 1860 : 1320, now)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(brighter ? 2100 : 1550, now)
    filter.Q.setValueAtTime(2.3, now)
    envelope.gain.setValueAtTime(.0001, now)
    envelope.gain.exponentialRampToValueAtTime(brighter ? .055 : .043, now + .003)
    envelope.gain.exponentialRampToValueAtTime(.0001, now + .045)
    send.gain.value = .045
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(this.effectsGain!); envelope.connect(send); send.connect(this.reverbInput!)
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); send.disconnect() }
    oscillator.start(now); oscillator.stop(now + .052)
  }

  play(effect: SoundEffect) {
    if (effect === 'blackoutWhoosh') { this.playBlackoutWhoosh(); return }
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
      const attackDuration = Math.min(tone.attack ?? .025, tone.duration * .25)
      envelope.gain.exponentialRampToValueAtTime(Math.max(.001, tone.gain), startAt + attackDuration)
      const releaseDuration = Math.min(tone.release ?? tone.duration, tone.duration * .5)
      if (tone.release) envelope.gain.setValueAtTime(tone.gain, Math.max(startAt + attackDuration, endAt - releaseDuration))
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

  private playBlackoutWhoosh() {
    if (!this.settings.enabled || this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return
    const context = this.getContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const duration = 3.2
    const frames = Math.ceil(context.sampleRate * duration)
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < frames; index += 1) {
      const fade = 1 - index / frames
      samples[index] = (Math.random() * 2 - 1) * Math.sqrt(fade)
    }
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    const reverbSend = context.createGain()
    source.buffer = buffer
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(680, now)
    filter.frequency.exponentialRampToValueAtTime(115, now + duration)
    filter.Q.value = .48
    envelope.gain.setValueAtTime(.0001, now)
    envelope.gain.exponentialRampToValueAtTime(.052, now + .72)
    envelope.gain.setValueAtTime(.048, now + 1.25)
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration)
    reverbSend.gain.value = .07
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(this.effectsGain!)
    envelope.connect(reverbSend)
    reverbSend.connect(this.reverbInput!)
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); reverbSend.disconnect() }
    source.start(now)
    source.stop(now + duration + .02)
  }

  async playMusicAsset(source: string, options: { loop?: boolean; fadeMs?: number; loopCrossfadeMs?: number; trackGain?: number; volume?: number; cropStartSeconds?: number; cropEndSeconds?: number | null } = {}) {
    if (!this.settings.enabled || this.settings.musicVolume <= 0) return
    const context = this.getContext()
    if (context.state === 'suspended') await context.resume()
    this.ensureMusicDecks(context)
    const absoluteSource = new URL(source, window.location.href).href
    const fadeMs = Math.max(0, Math.min(10000, options.fadeMs ?? 1400))
    const sameTrack = absoluteSource === this.currentMusicUrl
    if (sameTrack) {
      const active = this.musicDecks[this.activeMusicDeck]
      this.configureMusicDeck(active, options)
      if (typeof options.trackGain === 'number') this.setMusicTrackGain(options.trackGain)
      this.musicLoop = options.loop ?? this.musicLoop
      if (active.element.paused) await active.element.play()
      return
    }
    const oldIndex = this.activeMusicDeck
    const nextIndex = 1 - oldIndex
    const previous = this.musicDecks[oldIndex]
    const next = this.musicDecks[nextIndex]
    if (this.musicFadeTimers[nextIndex] !== null) window.clearTimeout(this.musicFadeTimers[nextIndex]!)
    next.element.pause()
    next.gain.gain.cancelScheduledValues(context.currentTime)
    next.gain.gain.setValueAtTime(0, context.currentTime)
    next.cropStart = 0; next.cropEnd = null; next.loop = true; next.loopCrossfading = false; next.loopCrossfadeMs = 0
    next.element.src = absoluteSource
    this.configureMusicDeck(next, options)
    next.element.load()
    try { await next.element.play() }
    catch (error) { next.element.removeAttribute('src'); next.element.load(); throw error }

    this.activeMusicDeck = nextIndex
    this.currentMusicUrl = absoluteSource
    this.musicLoop = options.loop ?? true
    this.musicTrackGain = Math.max(0, Math.min(1, options.trackGain ?? 1))
    this.rampMusicDeck(next, this.musicTrackGain, fadeMs)
    if (previous.element.src) {
      this.rampMusicDeck(previous, 0, fadeMs)
      if (this.musicFadeTimers[oldIndex] !== null) window.clearTimeout(this.musicFadeTimers[oldIndex]!)
      this.musicFadeTimers[oldIndex] = window.setTimeout(() => {
        previous.element.pause()
        previous.element.removeAttribute('src')
        previous.element.load()
        this.musicFadeTimers[oldIndex] = null
      }, fadeMs + 80)
    }
  }

  pauseMusic() {
    for (const deck of this.musicDecks) deck.element.pause()
  }

  async resumeMusic() {
    const active = this.musicDecks[this.activeMusicDeck]
    if (!active?.element.src) return
    const context = this.getContext()
    if (context.state === 'suspended') await context.resume()
    await active.element.play()
  }

  seekMusic(seconds: number) {
    const element = this.musicDecks[this.activeMusicDeck]?.element
    if (element && Number.isFinite(seconds)) element.currentTime = Math.max(0, Math.min(element.duration || Infinity, seconds))
  }

  setMusicLoop(loop: boolean) {
    this.musicLoop = loop
    const active = this.musicDecks[this.activeMusicDeck]?.element
    if (active) active.loop = loop
  }

  setMusicTrackGain(value: number, fadeMs = 180) {
    this.musicTrackGain = Math.max(0, Math.min(1, value))
    const active = this.musicDecks[this.activeMusicDeck]
    if (active) this.rampMusicDeck(active, this.musicTrackGain, fadeMs)
  }

  getMusicAudioElement() {
    return this.musicDecks[this.activeMusicDeck]?.element ?? null
  }

  fadeMusicOut(fadeMs = 1200) {
    if (!this.musicDecks.some((deck) => deck.element.src)) return
    const context = this.context
    this.currentMusicUrl = ''
    this.musicDecks.forEach((deck, index) => {
      if (!deck.element.src) return
      if (this.musicFadeTimers[index] !== null) window.clearTimeout(this.musicFadeTimers[index]!)
      if (context) this.rampMusicDeck(deck, 0, fadeMs)
      deck.loopCrossfading = false
      this.musicFadeTimers[index] = window.setTimeout(() => {
        deck.element.pause()
        deck.element.removeAttribute('src')
        deck.element.load()
        deck.gain.gain.setValueAtTime(0, this.context?.currentTime ?? 0)
        this.musicFadeTimers[index] = null
      }, Math.max(0, fadeMs) + 80)
    })
  }

  stopMusic(fadeMs = 0) {
    this.fadeMusicOut(fadeMs)
  }

  private ensureMusicDecks(context: AudioContext) {
    if (this.musicDecks.length) return
    this.musicDecks = [0, 1].map(() => {
      const element = new Audio()
      element.preload = 'auto'
      const source = context.createMediaElementSource(element)
      const gain = context.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(this.musicGain!)
      return { element, source, gain, cropStart: 0, cropEnd: null, loop: true, loopCrossfadeMs: 0, loopCrossfading: false }
    })
  }

  private configureMusicDeck(deck: MusicDeck, options: { loop?: boolean; loopCrossfadeMs?: number; volume?: number; cropStartSeconds?: number; cropEndSeconds?: number | null }) {
    deck.loop = options.loop ?? deck.loop
    deck.loopCrossfadeMs = Math.max(0, Math.min(12000, options.loopCrossfadeMs ?? deck.loopCrossfadeMs))
    deck.cropStart = Math.max(0, options.cropStartSeconds ?? deck.cropStart)
    deck.cropEnd = options.cropEndSeconds === undefined ? deck.cropEnd : options.cropEndSeconds
    if (deck.cropEnd !== null) deck.cropEnd = Math.max(deck.cropStart + .05, deck.cropEnd)
    deck.element.volume = Math.max(0, Math.min(1, options.volume ?? 1))
    deck.element.ontimeupdate = () => {
      const end = deck.cropEnd ?? (Number.isFinite(deck.element.duration) ? deck.element.duration : null)
      if (end === null) return
      if (!deck.loop) {
        if (deck.element.currentTime >= end) { deck.element.pause(); deck.element.currentTime = end }
        return
      }
      const segmentLength = end - deck.cropStart
      const fadeSeconds = Math.min(deck.loopCrossfadeMs / 1000, segmentLength / 2)
      if (fadeSeconds <= 0) {
        if (deck.element.currentTime >= end) deck.element.currentTime = deck.cropStart
      } else if (end - deck.element.currentTime <= fadeSeconds && !deck.loopCrossfading) {
        void this.crossfadeMusicLoop(deck)
      }
    }
    deck.element.onended = () => {
      if (!deck.loop) return
      if (deck.loopCrossfading) return
      deck.element.currentTime = deck.cropStart
      void deck.element.play().catch(() => {})
    }
    deck.element.onloadedmetadata = () => {
      const end = Number.isFinite(deck.element.duration) ? deck.element.duration : null
      if (end !== null && deck.cropEnd !== null) deck.cropEnd = Math.min(deck.cropEnd, end)
      if (deck.element.currentTime < deck.cropStart || (deck.cropEnd !== null && deck.element.currentTime >= deck.cropEnd)) {
        deck.element.currentTime = Math.min(deck.cropStart, Math.max(0, (end ?? deck.cropStart + .01) - .01))
      }
    }
    if (deck.element.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (deck.cropEnd !== null && Number.isFinite(deck.element.duration)) deck.cropEnd = Math.min(deck.cropEnd, deck.element.duration)
      if (deck.element.currentTime < deck.cropStart || (deck.cropEnd !== null && deck.element.currentTime >= deck.cropEnd)) deck.element.currentTime = deck.cropStart
    }
  }

  private async crossfadeMusicLoop(outgoing: MusicDeck) {
    const outgoingIndex = this.musicDecks.indexOf(outgoing)
    if (outgoingIndex < 0 || outgoingIndex !== this.activeMusicDeck || !this.currentMusicUrl || !this.context) return
    const incomingIndex = 1 - outgoingIndex
    const incoming = this.musicDecks[incomingIndex]
    const source = this.currentMusicUrl
    const fadeMs = outgoing.loopCrossfadeMs
    if (!fadeMs || !source) return
    outgoing.loopCrossfading = true
    if (this.musicFadeTimers[incomingIndex] !== null) window.clearTimeout(this.musicFadeTimers[incomingIndex]!)
    incoming.element.pause()
    incoming.element.removeAttribute('src')
    incoming.element.load()
    incoming.gain.gain.cancelScheduledValues(this.context.currentTime)
    incoming.gain.gain.setValueAtTime(0, this.context.currentTime)
    incoming.cropStart = outgoing.cropStart
    incoming.cropEnd = outgoing.cropEnd
    incoming.loop = true
    incoming.loopCrossfading = false
    incoming.loopCrossfadeMs = outgoing.loopCrossfadeMs
    incoming.element.volume = outgoing.element.volume
    incoming.element.src = source
    this.configureMusicDeck(incoming, { loop: true, loopCrossfadeMs: fadeMs, volume: outgoing.element.volume, cropStartSeconds: outgoing.cropStart, cropEndSeconds: outgoing.cropEnd })
    incoming.element.load()
    try { await incoming.element.play() }
    catch {
      outgoing.loopCrossfading = false
      return
    }
    if (source !== this.currentMusicUrl || outgoingIndex !== this.activeMusicDeck) {
      incoming.element.pause(); incoming.element.removeAttribute('src'); incoming.element.load(); outgoing.loopCrossfading = false; return
    }
    this.activeMusicDeck = incomingIndex
    this.rampMusicDeck(incoming, this.musicTrackGain, fadeMs)
    this.rampMusicDeck(outgoing, 0, fadeMs)
    if (this.musicFadeTimers[outgoingIndex] !== null) window.clearTimeout(this.musicFadeTimers[outgoingIndex]!)
    this.musicFadeTimers[outgoingIndex] = window.setTimeout(() => {
      outgoing.element.pause()
      outgoing.element.removeAttribute('src')
      outgoing.element.load()
      outgoing.gain.gain.setValueAtTime(0, this.context?.currentTime ?? 0)
      outgoing.loopCrossfading = false
      this.musicFadeTimers[outgoingIndex] = null
    }, fadeMs + 80)
  }

  private rampMusicDeck(deck: MusicDeck, value: number, durationMs: number) {
    if (!this.context) return
    const now = this.context.currentTime
    const gain = deck.gain.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    if (durationMs <= 0) gain.setValueAtTime(value, now)
    else gain.linearRampToValueAtTime(value, now + durationMs / 1000)
  }

  private getContext() {
    if (this.context) return this.context

    const context = new AudioContext()
    const master = context.createGain()
    const effects = context.createGain()
    const music = context.createGain()
    const voice = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const reverbInput = context.createGain()
    const delay = context.createDelay(1)
    const lowpass = context.createBiquadFilter()
    const feedback = context.createGain()

    master.gain.value = this.settings.enabled ? this.settings.masterVolume : 0
    effects.gain.value = this.settings.effectsVolume
    music.gain.value = this.settings.musicVolume
    voice.gain.value = this.settings.voiceVolume
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
    voice.connect(master)
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
    this.voiceGain = voice
    this.reverbInput = reverbInput
    return context
  }
}

export const audioManager = new AudioManager()
