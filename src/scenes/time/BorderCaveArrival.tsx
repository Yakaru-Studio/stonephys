import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { NarrationManifest, SceneLocale } from '../sceneTypes'
import { BORDER_CAVE_ARRIVAL_AUDIO_DIR, BORDER_CAVE_TITLE_AUDIO_DIR } from '../../narration/harrisonScript'
import SceneIntroTitle, { SCENE_TITLE_RISE_SECONDS } from './SceneIntroTitle'
import AudioControls from '../../audio/AudioControls'
import { audioManager } from '../../audio/AudioManager'
import dawnOfHumanity from '../../../content/music/dawn-of-humanity/composition.json'
import nightLandscape from '../../assets/scenes/time/border-cave-night-clean.png'
import dayLandscape from '../../assets/scenes/time/border-cave-day-clean.png'
import nightLandscapePortrait from '../../assets/scenes/time/border-cave-night-clean-portrait.png'
import dayLandscapePortrait from '../../assets/scenes/time/border-cave-day-clean-portrait.png'
import moonAsset from '../../assets/scenes/time/border-cave-moon-low-poly.png'
import '../historical-scene.css'

const INTRO_SECONDS = 7
const DAY_CYCLE_SECONDS = 150
const SOLAR_SPEED = 2.25
const NIGHTFALL_CUE_SECONDS = 21.7
const FULL_NIGHT_SECONDS = 25.3
const FULL_MOON_CUE_SECONDS = NIGHTFALL_CUE_SECONDS - .5
const WANING_MOON_CUE_SECONDS = 32.5
const MOON_RISE_SECONDS = 22
const MOON_TRANSITION_SECONDS = 5
const MOON_TRANSITION_OUT_SECONDS = 2
const NARRATION_END_SECONDS = 36.8
// The approved Harrison recording is 37.2 s; the sky follows its playback clock.
const sceneMusic: typeof dawnOfHumanity & {
  approvedVersionId?: string
  approvedAssetUrl?: string
  approvedCropStartSeconds?: number
  approvedCropEndSeconds?: number | null
  approvedVolume?: number
} = dawnOfHumanity
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t) }
const desktopNightRidge = [[0,68],[15,68.5],[30,70],[40,71],[50,71.5],[55,71.5],[60,69.5],[65,68.5],[70,67],[75,66],[80,65],[90,63.5],[100,61]]
const desktopRidge = [[0,68],[15,68.5],[30,70],[40,71],[50,73.2],[55,73.4],[58,70.8],[60,70.7],[62,69.7],[64,68.8],[66,68.8],[68,69.1],[70,69.3],[72,69.6],[75,69],[80,67.6],[90,63.5],[100,61]]
const portraitNightRidge = [[0,65],[20,66],[30,67],[40,66],[45,65],[50,65.5],[55,64.5],[60,64],[65,58],[70,57],[75,56.5],[80,56],[90,58],[100,64]]
const portraitRidge = [[0,66],[20,68],[30,69],[40,66],[45,65.2],[50,65.6],[55,64.5],[60,63.9],[62,63.6],[65,56.9],[70,56.5],[75,56.2],[80,55.8],[85,55.9],[90,58.3],[100,64]]
const ridgeHeightAt = (x: number, profile: number[][]) => {
  for (let index = 1; index < profile.length; index++) {
    const [rightX, rightY] = profile[index]
    const [leftX, leftY] = profile[index - 1]
    if (x <= rightX) return leftY + (rightY - leftY) * ((x - leftX) / (rightX - leftX))
  }
  return profile[profile.length - 1][1]
}
type SpriteFrame = { src: string; durationMs: number }
const loadSpriteFrames = (files: Record<string, string>, durations: number[]): SpriteFrame[] =>
  Object.entries(files).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([, src], index) => ({ src, durationMs: durations[index] ?? 180 }))
const zebraFrames = loadSpriteFrames(import.meta.glob('../../assets/scenes/time/wildlife/frames/zebra/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, [350,180,180,180,180,180,180,350,350,180,180,180,180,180,180,350])
const baboonFrames = loadSpriteFrames(import.meta.glob('../../assets/scenes/time/wildlife/frames/baboon/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, [160,160,160,160,220,220,220,160,160,160,160,160])
const antelopeGrazeFrames = loadSpriteFrames(import.meta.glob('../../assets/scenes/time/wildlife/frames/antelope/pastando/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, [180,130,130,130,160,450,450,180,150,130,130,350])
const antelopeLookFrames = loadSpriteFrames(import.meta.glob('../../assets/scenes/time/wildlife/frames/antelope/observando/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>, [200,130,130,130,180,200,200,200,200,130,130,130,130,130,130,300])

function frameAtTime(frames: SpriteFrame[], elapsedSeconds: number, startsAtMs: number, periodMs: number) {
  if (!frames.length) return null
  const elapsedMs = elapsedSeconds * 1000
  if (elapsedMs < startsAtMs) return null
  const cycleTime = (elapsedMs - startsAtMs) % periodMs
  let cursor = 0
  for (const frame of frames) {
    cursor += frame.durationMs
    if (cycleTime < cursor) return frame
  }
  return null
}

export default function BorderCaveArrival({ locale, onExit }: { locale: SceneLocale; onExit: () => void }) {
  const english = locale === 'en'
  const [elapsed, setElapsed] = useState(0)
  const narrationDirectory = english ? null : elapsed >= INTRO_SECONDS + 1
    ? BORDER_CAVE_ARRIVAL_AUDIO_DIR
    : elapsed >= SCENE_TITLE_RISE_SECONDS ? BORDER_CAVE_TITLE_AUDIO_DIR : null
  const [introNarrations, setIntroNarrations] = useState<Record<string, NarrationManifest | null>>({})
  const [introCaption, setIntroCaption] = useState('')
  const [lunarTransitionAt, setLunarTransitionAt] = useState<number | null>(null)
  const [fullMoonStartAt, setFullMoonStartAt] = useState<number | null>(null)
  const [laterMoonStartAt, setLaterMoonStartAt] = useState<number | null>(null)
  const [waningSpeechEndedAt, setWaningSpeechEndedAt] = useState<number | null>(null)
  const narration = narrationDirectory ? introNarrations[narrationDirectory] : undefined
  const [playing, setPlaying] = useState(true)
  const [wildlife, setWildlife] = useState(true)
  const [birds, setBirds] = useState(true)
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const elapsedRef = useRef(elapsed)
  const narrationAnchorRef = useRef<{ audioTime: number; sceneElapsed: number } | null>(null)
  const fullMoonStartedRef = useRef(false)
  const lunarTransitionStartedRef = useRef(false)
  const waningSpeechEndCapturedRef = useRef(false)
  const wildlifeRef = useRef(wildlife)
  const birdsRef = useRef(birds)
  elapsedRef.current = elapsed
  wildlifeRef.current = wildlife
  birdsRef.current = birds

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(.1, Math.max(0, (now - last) / 1000))
      last = now
      if (!document.hidden) setElapsed((time) => time + delta)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)')
    const update = () => setPortrait(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const { approvedVersionId, approvedAssetUrl } = sceneMusic
    if (!approvedVersionId || !approvedAssetUrl) {
      audioManager.fadeMusicOut(1100)
      return
    }
    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      audioManager.setNarrationMusicLevel(sceneMusic.ducking.musicLevelDuringNarration)
      void audioManager.playMusicAsset(approvedAssetUrl, {
        fadeMs: 350,
        loop: false,
        trackGain: sceneMusic.introVolume.gain,
        volume: sceneMusic.approvedVolume,
        cropStartSeconds: sceneMusic.approvedCropStartSeconds,
        cropEndSeconds: sceneMusic.approvedCropEndSeconds,
        signal: controller.signal,
      }).then(() => {
        if (controller.signal.aborted) return
        const track = audioManager.getMusicAudioElement()
        if (!track || track.src !== new URL(approvedAssetUrl, window.location.href).href) return

        const cropStart = sceneMusic.approvedCropStartSeconds ?? 0
        const introEnd = cropStart + sceneMusic.introVolume.durationSeconds
        const restoreDefaultAt = cropStart + 30
        const quieterTransitionGain = sceneMusic.defaultVolume * .78
        let musicPhase = ''
        const syncTransitionVolume = () => {
          if (audioManager.getMusicAudioElement() !== track) return
          const phase = track.currentTime < introEnd ? 'intro' : track.currentTime < restoreDefaultAt ? 'transition-dip' : 'default'
          if (phase === musicPhase) return
          musicPhase = phase
          const gain = phase === 'intro' ? sceneMusic.introVolume.gain : phase === 'transition-dip' ? quieterTransitionGain : sceneMusic.defaultVolume
          audioManager.setMusicTrackGain(gain, sceneMusic.introVolume.fadeMs)
        }
        track.addEventListener('timeupdate', syncTransitionVolume, { signal: controller.signal })
        syncTransitionVolume()
      }).catch(() => {})
    })
    return () => {
      controller.abort()
      audioManager.fadeMusicOut(1100)
    }
  }, [])

  useEffect(() => {
    if (english) return
    const controller = new AbortController()
    for (const directory of [BORDER_CAVE_TITLE_AUDIO_DIR, BORDER_CAVE_ARRIVAL_AUDIO_DIR]) {
      void fetch(`${directory}/manifest.json`, { signal: controller.signal, cache: 'no-cache' })
        .then((response) => response.ok && response.headers.get('content-type')?.includes('application/json') ? response.json() : null)
        .catch(() => null)
        .then((manifest: NarrationManifest | null) => {
          if (!controller.signal.aborted) {
            setIntroNarrations((items) => ({ ...items, [directory]: manifest?.status === 'approved' ? manifest : null }))
          }
        })
    }
    return () => controller.abort()
  }, [english])

  useEffect(() => {
    setIntroCaption('')
    narrationAnchorRef.current = null
    fullMoonStartedRef.current = false
    lunarTransitionStartedRef.current = false
    waningSpeechEndCapturedRef.current = false
    setLunarTransitionAt(null)
    setFullMoonStartAt(null)
    setLaterMoonStartAt(null)
    setWaningSpeechEndedAt(null)
    if (!narrationDirectory || narration === undefined) return
    const audioUrl = narration?.audioUrl ?? (narrationDirectory === BORDER_CAVE_TITLE_AUDIO_DIR ? `${narrationDirectory}/title.wav` : null)
    if (!audioUrl) return
    const controller = new AbortController()
    const { signal } = controller
    void audioManager.playNarration(audioUrl, signal).then((audio) => {
      if (signal.aborted) return
      if (narrationDirectory === BORDER_CAVE_ARRIVAL_AUDIO_DIR) {
        narrationAnchorRef.current = { audioTime: audio.currentTime, sceneElapsed: elapsedRef.current }
        fullMoonStartedRef.current = false
        lunarTransitionStartedRef.current = false
        waningSpeechEndCapturedRef.current = false
      }
      const syncCaption = () => {
        const timeMs = audio.currentTime * 1000
        if (narrationDirectory === BORDER_CAVE_ARRIVAL_AUDIO_DIR) {
          narrationAnchorRef.current = { audioTime: audio.currentTime, sceneElapsed: elapsedRef.current }
          if (!fullMoonStartedRef.current && audio.currentTime >= FULL_MOON_CUE_SECONDS) {
            fullMoonStartedRef.current = true
            setFullMoonStartAt(elapsedRef.current)
          }
          if (!lunarTransitionStartedRef.current && audio.currentTime >= WANING_MOON_CUE_SECONDS) {
            lunarTransitionStartedRef.current = true
            setLunarTransitionAt(elapsedRef.current)
            setLaterMoonStartAt(elapsedRef.current + MOON_TRANSITION_OUT_SECONDS)
          }
          if (!waningSpeechEndCapturedRef.current && audio.currentTime >= NARRATION_END_SECONDS) {
            waningSpeechEndCapturedRef.current = true
            setWaningSpeechEndedAt(elapsedRef.current)
          }
        }
        const active = narration?.segments.find((cue) => cue.startMs <= timeMs && timeMs < cue.endMs)
        setIntroCaption(active?.text ?? '')
      }
      audio.addEventListener('timeupdate', syncCaption, { signal })
      audio.addEventListener('ended', () => {
        setIntroCaption('')
        controller.abort()
        audioManager.stopNarration()
      }, { once: true, signal })
      syncCaption()
    }).catch(() => {})
    return () => {
      if (signal.aborted) return
      controller.abort()
      audioManager.stopNarration()
    }
  }, [narrationDirectory, narration])

  useEffect(() => {
    if (!english) return
    const fullMoonSceneTime = INTRO_SECONDS + 1 + FULL_MOON_CUE_SECONDS
    if (fullMoonStartAt === null && elapsed >= fullMoonSceneTime) setFullMoonStartAt(fullMoonSceneTime)
    const transitionSceneTime = INTRO_SECONDS + 1 + WANING_MOON_CUE_SECONDS
    if (lunarTransitionAt === null && elapsed >= transitionSceneTime) setLunarTransitionAt(transitionSceneTime)
    const waningSceneTime = transitionSceneTime + MOON_TRANSITION_OUT_SECONDS
    if (laterMoonStartAt === null && elapsed >= waningSceneTime) setLaterMoonStartAt(waningSceneTime)
    const speechEndSceneTime = INTRO_SECONDS + 1 + NARRATION_END_SECONDS
    if (waningSpeechEndedAt === null && elapsed >= speechEndSceneTime) setWaningSpeechEndedAt(speechEndSceneTime)
  }, [elapsed, english, fullMoonStartAt, laterMoonStartAt, lunarTransitionAt, waningSpeechEndedAt])

  useEffect(() => {
    if (!playing) { audioManager.pauseNaturalAmbience(); return }
    let eventTimer = 0
    let previousEvent = ''
    const updateAmbience = () => {
      const sceneTime = Math.max(0, elapsedRef.current - INTRO_SECONDS)
      const daytime = smoothstep((sceneTime - .25) / 3.8) * (1 - smoothstep((sceneTime - 17) / 5.5))
      const cricketLevel = .58 * (1 - daytime)
      void audioManager.setNaturalAmbience([
        { id: 'border-cave-wind', volume: 1, pan: 0 },
        { id: 'border-cave-vegetation', volume: .82, pan: .2 },
        { id: 'border-cave-night-crickets', volume: cricketLevel, pan: -.16 },
      ])
    }
    let wildlifeCues = 0
    const wildlifeOrder = [
      'border-cave-crested-francolin',
      'border-cave-ring-necked-dove',
      'border-cave-natal-spurfowl',
      'border-cave-chacma-baboon',
      'border-cave-plains-zebra',
    ]
    let nextWildlifeIndex = 0
    const playSparseWildlife = () => {
      const delay = wildlifeCues === 0 ? 0 : 7000 + Math.random() * 4500
      eventTimer = window.setTimeout(() => {
        if (wildlifeRef.current) {
          const dawn = clamp01((Math.max(0, elapsedRef.current - INTRO_SECONDS) - 1) / 5)
          const candidates: Array<{ id: string; volume: number; pan: number }> = []
          if (birdsRef.current && dawn < .96) {
            candidates.push({ id: 'border-cave-crested-francolin', volume: 1.8, pan: .28 })
            candidates.push({ id: 'border-cave-ring-necked-dove', volume: 1.65, pan: -.25 })
            candidates.push({ id: 'border-cave-natal-spurfowl', volume: 1.8, pan: .52 })
          }
          if (dawn > .08 && dawn < .98) candidates.push({ id: 'border-cave-chacma-baboon', volume: .85, pan: -.76 })
          if (dawn > .2 && dawn < .98) candidates.push({ id: 'border-cave-plains-zebra', volume: 1.8, pan: .36 })
          const available = candidates.filter((candidate) => candidate.id !== previousEvent)
          for (let offset = 0; offset < wildlifeOrder.length; offset += 1) {
            const index = (nextWildlifeIndex + offset) % wildlifeOrder.length
            const candidate = available.find((item) => item.id === wildlifeOrder[index])
            if (!candidate) continue
            nextWildlifeIndex = (index + 1) % wildlifeOrder.length
            previousEvent = candidate.id
            // Separate groups let distant calls overlap instead of cutting each other off.
            void audioManager.playSoundEffectById(candidate.id, { volume: candidate.volume, pan: candidate.pan, group: candidate.id }).catch(() => {})
            break
          }
        }
        wildlifeCues += 1
        playSparseWildlife()
      }, delay)
    }
    updateAmbience()
    const ambienceTimer = window.setInterval(updateAmbience, 1200)
    playSparseWildlife()
    return () => { window.clearInterval(ambienceTimer); window.clearTimeout(eventTimer); audioManager.pauseNaturalAmbience() }
  }, [playing])

  // Match the background's cover crop so actors and the mountain mask stay
  // anchored to the same points in the illustration at every viewport ratio.
  const sourceWidth = portrait ? 941 : 1672
  const sourceHeight = portrait ? 1672 : 944
  const coverScale = Math.max(viewport.width / sourceWidth, viewport.height / sourceHeight)
  const coverWidth = sourceWidth * coverScale
  const coverHeight = sourceHeight * coverScale
  const coverLeft = (viewport.width - coverWidth) / 2
  const coverTop = (viewport.height - coverHeight) / 2
  const imageLayerStyle = { inset: 'auto', left: `${coverLeft}px`, top: `${coverTop}px`, width: `${coverWidth}px`, height: `${coverHeight}px` } as CSSProperties
  const screenPoint = (x: number, y: number) => ({
    left: `${coverLeft + coverWidth * x / 100}px`,
    top: `${coverTop + coverHeight * y / 100}px`,
  })

  // The approved lines are the timeline: dawn, the sun's passage, sunset,
  // then moonlight and a later, visibly waning moon.
  const narrativeTime = narrationAnchorRef.current
    ? Math.max(0, narrationAnchorRef.current.audioTime + elapsed - narrationAnchorRef.current.sceneElapsed)
    : Math.max(0, elapsed - INTRO_SECONDS - 1)
  const solarElapsed = narrativeTime * SOLAR_SPEED
  const sunProgress = clamp01(solarElapsed / 49.5)
  const sunSizeProgress = smoothstep(sunProgress)
  const sunX = 52 + sunProgress * 23
  const sunArc = 1 - Math.cos(sunProgress * Math.PI / 2)
  const sunY = (portrait ? 71.5 : 80.2) - sunArc * 70
  const ridgeNightY = ridgeHeightAt(sunX, portrait ? portraitNightRidge : desktopNightRidge)
  const ridgeDayY = ridgeHeightAt(sunX, portrait ? portraitRidge : desktopRidge)
  const ridgeY = ridgeNightY + (ridgeDayY - ridgeNightY) * smoothstep(sunProgress / .42)
  const sunScreen = screenPoint(sunX, sunY)
  const sunScreenY = coverTop + coverHeight * sunY / 100
  const ridgeScreenY = coverTop + coverHeight * ridgeY / 100
  const sunCoreDiameter = Math.min(58, Math.max(38, viewport.width * .036))
  const visibleSunFraction = clamp01((ridgeScreenY - sunScreenY + sunCoreDiameter / 2) / sunCoreDiameter)
  const nightReturn = smoothstep((narrativeTime - NIGHTFALL_CUE_SECONDS) / (FULL_NIGHT_SECONDS - NIGHTFALL_CUE_SECONDS))
  const daylight = smoothstep((visibleSunFraction - .58) / .42) * (1 - nightReturn)
  const nightOpacity = Math.max(1 - daylight, nightReturn)
  const warmLight = daylight
  const skyLight = daylight * .92
  const emergenceGlow = .24 + smoothstep(visibleSunFraction) * .76
  const sunOpacity = smoothstep(sunProgress / .035) * (1 - smoothstep((sunProgress - .82) / .16)) * smoothstep(visibleSunFraction / .22) * emergenceGlow
  const horizonGlow = sunOpacity * visibleSunFraction * (1 - smoothstep((sunProgress - .035) / .4))
  const sunStyle = { ...sunScreen, opacity: sunOpacity, '--sun-scale': 1.18 - sunSizeProgress * .46, '--sun-yellow': 1 - sunProgress * .1, '--sun-aura-level': emergenceGlow * (1 - daylight * .45), '--sun-visible': `${visibleSunFraction * 100}%` } as CSSProperties
  const horizonStyle = { ...screenPoint(sunX, ridgeY), opacity: horizonGlow } as CSSProperties
  const moonProgress = fullMoonStartAt === null ? 0 : clamp01((elapsed - fullMoonStartAt) / MOON_RISE_SECONDS)
  const moonX = 52 + moonProgress * 23
  const moonArc = 1 - Math.cos(moonProgress * Math.PI / 2)
  const moonY = (portrait ? 71.5 : 80.2) - moonArc * 70
  const moonScreen = screenPoint(moonX, moonY)
  const moonScreenY = coverTop + coverHeight * moonY / 100
  const moonRidgeY = coverTop + coverHeight * ridgeHeightAt(moonX, portrait ? portraitNightRidge : desktopNightRidge) / 100
  const visibleMoonFraction = clamp01((moonRidgeY - moonScreenY + sunCoreDiameter / 2) / sunCoreDiameter)
  const moonProgressOpacity = smoothstep(moonProgress / .035) * (1 - smoothstep((moonProgress - .82) / .16)) * smoothstep(visibleMoonFraction / .22)
  const transitionElapsed = lunarTransitionAt === null ? -1 : elapsed - lunarTransitionAt
  const fullMoonHandoff = transitionElapsed < 0 ? 1 : 1 - smoothstep((transitionElapsed - .35) / (MOON_TRANSITION_OUT_SECONDS - .35))
  const initialMoonOpacity = moonProgressOpacity * fullMoonHandoff
  const laterMoonProgress = laterMoonStartAt === null ? 0 : clamp01((elapsed - laterMoonStartAt) / MOON_RISE_SECONDS)
  const laterMoonX = 52 + laterMoonProgress * 23
  const laterMoonArc = 1 - Math.cos(laterMoonProgress * Math.PI / 2)
  const laterMoonY = (portrait ? 71.5 : 80.2) - laterMoonArc * 70
  const laterMoonScreen = screenPoint(laterMoonX, laterMoonY)
  const laterMoonScreenY = coverTop + coverHeight * laterMoonY / 100
  const laterMoonRidgeY = coverTop + coverHeight * ridgeHeightAt(laterMoonX, portrait ? portraitNightRidge : desktopNightRidge) / 100
  const visibleLaterMoonFraction = clamp01((laterMoonRidgeY - laterMoonScreenY + sunCoreDiameter / 2) / sunCoreDiameter)
  const laterMoonOpacity = smoothstep(laterMoonProgress / .035) * (1 - smoothstep((laterMoonProgress - .82) / .16)) * smoothstep(visibleLaterMoonFraction / .22)
  const moonStyle = { ...moonScreen, width: `${sunCoreDiameter}px`, opacity: initialMoonOpacity, '--moon-visible': `${visibleMoonFraction * 100}%`, '--moon-phase': '0%', '--moon-shadow-opacity': 0 } as CSSProperties
  const laterMoonStyle = { ...laterMoonScreen, width: `${sunCoreDiameter}px`, opacity: laterMoonOpacity, '--moon-visible': `${visibleLaterMoonFraction * 100}%`, '--moon-phase': '18%', '--moon-shadow-opacity': .88 } as CSSProperties
  const lunarBlackoutOpacity = transitionElapsed < 0 ? 0 : smoothstep(transitionElapsed / MOON_TRANSITION_OUT_SECONDS) * (1 - smoothstep((transitionElapsed - MOON_TRANSITION_OUT_SECONDS) / (MOON_TRANSITION_SECONDS - MOON_TRANSITION_OUT_SECONDS)))
  const finalBlackoutStart = laterMoonStartAt === null || waningSpeechEndedAt === null
    ? null
    : Math.max(laterMoonStartAt, waningSpeechEndedAt)
  const finalBlackoutDuration = finalBlackoutStart === null || laterMoonStartAt === null
    ? 0
    : Math.max(.1, laterMoonStartAt + MOON_RISE_SECONDS - finalBlackoutStart)
  const finalBlackoutOpacity = finalBlackoutStart === null ? 0 : smoothstep((elapsed - finalBlackoutStart) / finalBlackoutDuration)
  const lunarBlackoutStyle = { opacity: Math.max(lunarBlackoutOpacity, finalBlackoutOpacity) } as CSSProperties
  const moonlightStyle = { opacity: Math.max(initialMoonOpacity, laterMoonOpacity) * .5 } as CSSProperties
  const skyStyle = { opacity: skyLight * .92 } as CSSProperties
  const lightStyle = { opacity: warmLight } as CSSProperties
  const sceneStyle = { '--sunlight': daylight } as CSSProperties
  const debugMode = import.meta.env.DEV
  const nightImage = portrait ? nightLandscapePortrait : nightLandscape
  const dayImage = portrait ? dayLandscapePortrait : dayLandscape
  const zebraSources = [2_000, 12_000, 22_000].map((start) => frameAtTime(zebraFrames, elapsed, start, 32_000)?.src ?? zebraFrames[0]?.src)
  const baboonSource = frameAtTime(baboonFrames, elapsed, 17_000, 29_000)?.src ?? baboonFrames[0]?.src
  const antelopeSource = frameAtTime(antelopeGrazeFrames, elapsed, 6_000, 32_000)?.src
    ?? frameAtTime(antelopeLookFrames, elapsed, 15_000, 32_000)?.src
    ?? antelopeGrazeFrames[0]?.src

  return <main className={`border-cave-arrival ${portrait ? 'is-portrait' : ''}`} aria-label={english ? 'Border Cave, Southern Africa' : 'Border Cave, África Austral'} style={sceneStyle}>
    <div className="border-cave-landscape-layer border-cave-landscape-night" style={{ backgroundImage: `url("${nightImage}")`, opacity: nightOpacity }}/>
    <div className="border-cave-landscape-layer border-cave-landscape-day" style={{ backgroundImage: `url("${dayImage}")`, opacity: daylight }}/>
    <div className="border-cave-sky-light" style={skyStyle} aria-hidden="true"/>
    <div className="border-cave-atmosphere" style={lightStyle} aria-hidden="true"/>
    <div className="border-cave-moonlight" style={moonlightStyle} aria-hidden="true"/>
    <div className="border-cave-horizon-glow" style={horizonStyle} aria-hidden="true"/>
    <div className="border-cave-sun-halo" style={sunStyle} aria-hidden="true"><i/></div>
    {[{ style: moonStyle, phase: 0 }, { style: laterMoonStyle, phase: 1 }].map(({ style, phase }) => <div key={phase} className="border-cave-moon" style={style} aria-hidden="true"><img src={moonAsset} alt=""/><i className="border-cave-moon-shadow"/></div>)}
    {wildlife && <div className="border-cave-fauna" style={imageLayerStyle} aria-hidden="true">
      {baboonSource && <img className="border-cave-animal border-cave-animal-baboon baboon-a" src={baboonSource} alt=""/>}
      {zebraSources.map((source, index) => source && <img key={index} className={`border-cave-animal border-cave-animal-zebra zebra-graze-${String.fromCharCode(97 + index)}`} src={source} alt=""/>)}
      {antelopeSource && <>
        <img className="border-cave-animal border-cave-animal-antelope antelope-a" src={antelopeGrazeFrames[0]?.src} alt=""/>
        <img className="border-cave-animal border-cave-animal-antelope antelope-b" src={antelopeSource} alt=""/>
        <img className="border-cave-animal border-cave-animal-antelope antelope-c" src={antelopeGrazeFrames[0]?.src} alt=""/>
      </>}
    </div>}
    {birds && <div className="border-cave-birds" aria-hidden="true">{[0, 1, 2].map((index) => <svg key={index} viewBox="0 0 42 18" style={{ animationDelay: `${-index * 7}s`, top: `${20 + index * 8}%` }}><path d="M1 13q10-12 20 0 10-12 20 0"/></svg>)}</div>}
    <div className="border-cave-shade" aria-hidden="true"/>
    <div className="border-cave-lunar-blackout" style={lunarBlackoutStyle} aria-hidden="true"/>
    <SceneIntroTitle
      place="Border Cave"
      temporal={english ? '42,000 years ago' : '42 mil anos atrás'}
      geographical={english ? 'Region of present-day South Africa and Eswatini' : 'Região da atual África do Sul e Essuatíni'}
      elapsed={elapsed}
      duration={INTRO_SECONDS}
    />
    {introCaption && <div className="historical-scene-caption" role="status"><p>{introCaption}</p></div>}
    <header className="historical-scene-header border-cave-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label={english ? 'Return to the act library' : 'Voltar à biblioteca de atos'}><ArrowLeft size={19}/></button>
      <div className="historical-scene-meta"><span>{english ? 'SOUTHERN AFRICA' : 'ÁFRICA AUSTRAL'}</span><b>{english ? 'AROUND 42,000 YEARS AGO' : 'HÁ CERCA DE 42 MIL ANOS'}</b></div>
    </header>
    <div className="historical-scene-audio-control"><AudioControls/></div>
    {debugMode && <details className="border-cave-debug"><summary>{english ? 'Scene controls' : 'Controles da cena'}</summary><label>{english ? 'Day cycle' : 'Ciclo do dia'}<input type="range" min="0" max={DAY_CYCLE_SECONDS} step=".1" value={Math.min(elapsed, DAY_CYCLE_SECONDS)} onChange={(event) => setElapsed(Number(event.target.value))}/></label><button onClick={() => setPlaying((value) => !value)}>{playing ? (english ? 'Pause' : 'Pausar') : (english ? 'Play' : 'Reproduzir')}</button><button onClick={() => { setElapsed(0); setPlaying(true) }}>{english ? 'Restart' : 'Reiniciar'}</button><label><input type="checkbox" checked={wildlife} onChange={(event) => setWildlife(event.target.checked)}/>{english ? 'Wildlife' : 'Animais'}</label><label><input type="checkbox" checked={birds} onChange={(event) => setBirds(event.target.checked)}/>{english ? 'Distant birds' : 'Aves distantes'}</label><output>{Math.floor(elapsed)}s</output></details>}
  </main>
}
