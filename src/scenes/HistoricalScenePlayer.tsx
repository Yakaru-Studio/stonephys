import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, Pause, Play, SkipForward } from 'lucide-react'
import type { HistoricalScene, NarrationManifest, SceneLocale } from './sceneTypes'
import { audioManager } from '../audio/AudioManager'
import { useLocale } from '../i18n'
import BorderCaveArrival from './time/BorderCaveArrival'
import './historical-scene.css'

type ScenePhase = 'opening' | 'narrating' | 'awaiting-clock-click' | 'rewinding' | 'cave'

export default function HistoricalScenePlayer({ scene, onExit }: { scene: HistoricalScene; onExit: () => void }) {
  const { locale, t } = useLocale()
  const [elapsed, setElapsed] = useState(0)
  const [clockElapsed, setClockElapsed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState<ScenePhase>('opening')
  const [transitionProgress, setTransitionProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(!document.hidden)
  const [narrationManifest, setNarrationManifest] = useState<NarrationManifest | null>(scene.audio.narrationManifest ?? null)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const debugMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const sceneEndNotified = useRef(false)
  const blackoutSoundPlayed = useRef(false)
  const sceneDuration = narrationManifest ? Math.max(1, narrationManifest.durationMs / 1000) : scene.duration
  const timeline = useMemo(() => {
    if (!narrationManifest) return scene.timeline
    const segments = narrationManifest.segments
    const at = (pattern: RegExp, fallback: number) => segments.find((segment) => pattern.test(segment.text))?.startMs! / 1000 || fallback
    const firstParagraph = at(/Tempo.../i, 0)
    const legacy = at(/minhas ideias/i, narrationManifest.durationMs / 5000)
    const measure = at(/Mas houve/i, narrationManifest.durationMs / 1000 * .36)
    const journey = at(/viajar no tempo/i, narrationManifest.durationMs / 1000 * .68)
    const spokenEnd = Math.min(narrationManifest.durationMs / 1000, Math.max(...segments.map((segment) => segment.endMs), narrationManifest.durationMs) / 1000)
    return [
      { id: 'present-time', start: firstParagraph, end: legacy, cameraZoom: 1.015 },
      { id: 'legacy', start: legacy, end: measure, cameraZoom: 1.035 },
      { id: 'measure-time', start: measure, end: journey, cameraZoom: 1.07 },
      { id: 'journey-back', start: journey, end: spokenEnd, cameraZoom: 1.12 },
    ]
  }, [narrationManifest, scene.timeline])
  const currentCue = useMemo(() => timeline.find((cue) => elapsed >= cue.start && elapsed < cue.end) ?? timeline[timeline.length - 1], [timeline, elapsed])
  const sceneTitle = scene.localized?.title?.[locale] ?? scene.title
  const sceneLocation = scene.localized?.location?.[locale] ?? scene.location
  const scenePeriod = scene.localized?.period?.[locale] ?? scene.period
  const approachProgress = Math.min(1, Math.max(0, transitionProgress / .2))
  // Continue accelerating the hands through the blackout instead of clamping
  // their reverse motion when the fade begins at .84.
  const rewindProgress = Math.max(0, transitionProgress / .84)
  const cameraZoomProgress = Math.min(1, Math.max(0, (transitionProgress - .2) / .58))
  const approachEase = approachProgress * approachProgress * (3 - 2 * approachProgress)
  const zoomEase = cameraZoomProgress * cameraZoomProgress * (3 - 2 * cameraZoomProgress)
  const reverseTickInterval = 1000 / (1 + 11 * rewindProgress * rewindProgress)
  const cameraZoom = phase === 'rewinding'
    ? transitionProgress < .2 ? 1.18 + approachEase * .32 : 1.5 + zoomEase * .98
    : phase === 'opening'
      ? 1
      : phase === 'narrating'
        ? 1 + .18 * Math.min(1, elapsed / sceneDuration)
        : 1.18
  const activeSegment = narrationManifest?.language === locale ? narrationManifest.segments.find((segment) => elapsed * 1000 >= segment.startMs && elapsed * 1000 < segment.endMs) : undefined
  const activeCaption = narrationManifest ? activeSegment?.text : currentCue?.subtitleByLocale?.[locale] ?? currentCue?.subtitle

  const finishNarration = () => {
    if (phase !== 'narrating') return
    const shouldNotify = !sceneEndNotified.current
    sceneEndNotified.current = true
    setPlaying(false)
    setPhase('awaiting-clock-click')
    setElapsed(sceneDuration)
    audioManager.stopNarration()
    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent('stonephys:historical-scene-ready', { detail: { sceneId: scene.id, nextScene: scene.nextScene } }))
    }
  }

  const beginRewind = () => {
    if (phase !== 'awaiting-clock-click') return
    blackoutSoundPlayed.current = false
    audioManager.fadeMusicOut(1400)
    audioManager.play('sceneTransition')
    setTransitionProgress(0)
    setPhase('rewinding')
  }

  useEffect(() => {
    const updateVisibility = () => setIsVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('narrating'), 1350)
    return () => window.clearTimeout(timer)
  }, [phase === 'opening'])

  useEffect(() => {
    let cancelled = false
    if (narrationManifest) return
    fetch(`/audio/narration/${locale}/time/harrison-intro/manifest.json`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<NarrationManifest> : null)
      .then((manifest) => { if (!cancelled && manifest?.status === 'approved' && manifest.sceneId === scene.id) setNarrationManifest(manifest) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [locale, narrationManifest, scene.id])

  useEffect(() => {
    if (!narrationManifest || narrationManifest.language === locale) return
    audioManager.stopNarration()
    audioManager.stopClockTicks()
    setNarrationManifest(null); setElapsed(0); setPlaying(true); setPhase('opening'); setTransitionProgress(0); sceneEndNotified.current = false
  }, [locale, narrationManifest])

  useEffect(() => {
    if (!narrationManifest || phase !== 'narrating') return
    let disposed = false
    let element: HTMLAudioElement | null = null
    const syncTime = () => { if (!sceneEndNotified.current && element && Number.isFinite(element.currentTime)) setElapsed(element.currentTime) }
    const onEnded = () => finishNarration()
    const start = async () => {
      if (!playing || !isVisible) { audioManager.pauseNarration(); return }
      try {
        element = await audioManager.playNarration(narrationManifest.audioUrl)
        if (disposed) { audioManager.stopNarration(); return }
        element.removeEventListener('timeupdate', syncTime)
        element.removeEventListener('ended', onEnded)
        element.addEventListener('timeupdate', syncTime)
        element.addEventListener('ended', onEnded)
        syncTime()
      } catch {
        setPlaying(false)
      }
    }
    void start()
    return () => {
      disposed = true
      if (element) { element.removeEventListener('timeupdate', syncTime); element.removeEventListener('ended', onEnded) }
    }
  }, [narrationManifest, phase, playing, isVisible])

  useEffect(() => {
    if (!isVisible || (phase === 'narrating' && !playing)) { audioManager.stopClockTicks(); return }
    if (phase === 'rewinding') {
      audioManager.setClockTickRate(reverseTickInterval)
      return
    }
    if (phase === 'narrating' || phase === 'awaiting-clock-click') {
      audioManager.startClockTicks(1000)
      return
    }
    audioManager.stopClockTicks()
  }, [phase, playing, isVisible, reverseTickInterval])

  useEffect(() => {
    if (!isVisible || (phase !== 'narrating' && phase !== 'awaiting-clock-click' && phase !== 'rewinding') || (phase === 'narrating' && !playing)) return
    let lastTime = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      setClockElapsed((value) => value + delta)
    }, 50)
    return () => window.clearInterval(timer)
  }, [phase, playing, isVisible])

  useEffect(() => () => { audioManager.stopNarration(); audioManager.stopClockTicks() }, [])

  useEffect(() => {
    if (phase !== 'narrating' || narrationManifest || !playing || !isVisible) return
    const timer = window.setInterval(() => setElapsed((value) => Math.min(sceneDuration, Math.round((value + .1) * 10) / 10)), 100)
    return () => window.clearInterval(timer)
  }, [phase, playing, isVisible, narrationManifest, sceneDuration])

  useEffect(() => {
    if (phase === 'narrating' && !narrationManifest && elapsed >= sceneDuration) finishNarration()
  }, [phase, narrationManifest, elapsed, sceneDuration])

  useEffect(() => {
    if (phase !== 'rewinding' || transitionProgress < .992 || blackoutSoundPlayed.current) return
    blackoutSoundPlayed.current = true
    audioManager.play('blackoutWhoosh')
  }, [phase, transitionProgress])

  useEffect(() => {
    if (phase !== 'rewinding') return
    const startedAt = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 11500)
      setTransitionProgress(progress)
      if (progress >= 1) setPhase('cave')
      else frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  if (phase === 'cave') return <BorderCaveArrival locale={locale as SceneLocale} onExit={onExit}/>

  const togglePlayback = () => {
    const next = !playing
    setPlaying(next)
    if (narrationManifest) {
      if (next) void audioManager.resumeNarration().catch(() => setPlaying(false))
      else audioManager.pauseNarration()
    }
  }
  const seek = (time: number) => {
    setElapsed(time)
    if (narrationManifest) audioManager.seekNarration(time)
    else setPlaying(false)
  }
  const skipNarration = () => {
    if (narrationManifest) audioManager.seekNarration(narrationManifest.durationMs / 1000)
    finishNarration()
  }

  return <main className={`historical-scene ${reducedMotion ? 'historical-scene-reduced-motion' : ''} ${phase === 'rewinding' ? 'historical-scene-rewinding' : ''}`} aria-label={`${sceneTitle}, ${sceneLocation}, ${scenePeriod}`}>
    <div className="historical-scene-camera" style={{ transform: `scale(${cameraZoom})` }}>
      {scene.layers.map((layer) => <div key={layer.id} className="historical-scene-layer" style={{ backgroundImage: `url("${layer.image}")`, backgroundSize: layer.fit ?? 'cover', opacity: layer.opacity ?? 1, zIndex: layer.depth }}/>) }
      <div className="historical-scene-window-light" aria-hidden="true"/>
      <div className="historical-scene-dust" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--dust-i': i, left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDuration: `${9 + i % 7}s` } as (CSSProperties & { '--dust-i': number })}/>)}</div>
      <div className={`historical-scene-watch ${phase === 'rewinding' ? 'is-rewinding' : ''}`}>
        {scene.props.map((prop) => <div key={prop.id} className={`historical-scene-prop historical-scene-prop-${prop.id}`}>{prop.render(clockElapsed, phase === 'rewinding' ? rewindProgress : 0)}</div>)}
        {phase === 'awaiting-clock-click' && <button className="historical-scene-watch-target" onClick={beginRewind} aria-label={locale === 'en' ? 'Click the clock to travel to Border Cave' : 'Clique no relógio para avançar até Border Cave'}/>}
      </div>
    </div>
    <div className="historical-scene-vignette" aria-hidden="true"/>
    <div className="historical-scene-blackout" style={{ opacity: phase === 'rewinding' ? Math.min(1, Math.max(0, (transitionProgress - .84) / .16)) : 0 }} aria-hidden="true"/>
    <header className="historical-scene-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label={t('scene.back')}><ArrowLeft size={19}/></button>
      <div className="historical-scene-meta"><span>{sceneLocation}</span><b>{scenePeriod}</b></div>
      {phase === 'narrating' && <button className="historical-scene-skip" onClick={skipNarration}><span>{t('scene.skip')}</span><SkipForward size={15}/></button>}
    </header>
    {phase === 'narrating' && activeCaption && <div className="historical-scene-caption" role="status"><p>{activeCaption}</p></div>}
    {phase === 'awaiting-clock-click' && <div className="historical-scene-action-hint" role="status">{locale === 'en' ? 'Click the clock to continue' : 'Clique no relógio para avançar'}</div>}
    {phase === 'narrating' && <footer className="historical-scene-controls">
      <button className="historical-scene-icon-button" onClick={togglePlayback} aria-label={playing ? t('scene.pause') : t('scene.resume')}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <div className="historical-scene-progress" aria-label={`Cena em ${Math.floor(elapsed)} de ${Math.floor(sceneDuration)} segundos`}><span style={{ width: `${elapsed / sceneDuration * 100}%` }}/></div>
      <span className="historical-scene-time">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span>
    </footer>}
    {debugMode && <details className="historical-scene-debug"><summary>{t('scene.debug')}</summary><input type="range" min="0" max={sceneDuration} step=".1" value={elapsed} onChange={(event) => seek(Number(event.target.value))}/><span>{elapsed.toFixed(1)}s / {sceneDuration.toFixed(1)}s</span><button onClick={() => { sceneEndNotified.current = false; setElapsed(0); setClockElapsed(0); setPlaying(true); setTransitionProgress(0); setPhase('opening'); audioManager.stopNarration(); audioManager.stopClockTicks() }}>{locale === 'en' ? 'Restart' : 'Reiniciar'}</button></details>}
  </main>
}
