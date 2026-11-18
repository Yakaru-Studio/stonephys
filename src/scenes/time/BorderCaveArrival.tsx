import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { SceneLocale } from '../sceneTypes'
import SceneIntroTitle from './SceneIntroTitle'
import nightLandscape from '../../assets/scenes/time/border-cave-night-clean.png'
import dayLandscape from '../../assets/scenes/time/border-cave-day-clean.png'
import nightLandscapePortrait from '../../assets/scenes/time/border-cave-night-clean-portrait.png'
import dayLandscapePortrait from '../../assets/scenes/time/border-cave-day-clean-portrait.png'
import '../historical-scene.css'

const INTRO_SECONDS = 7
const DAY_CYCLE_SECONDS = 150
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
  const [playing, setPlaying] = useState(true)
  const [wildlife, setWildlife] = useState(true)
  const [birds, setBirds] = useState(true)
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))

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

  // A fixed east-facing camera sees the sun rise ahead, climb diagonally
  // toward the zenith, then pass overhead and disappear behind the viewer.
  const sunProgress = clamp01((elapsed - 7) / 110)
  const sunArc = 1 - Math.cos(sunProgress * Math.PI / 2)
  const sunSizeProgress = smoothstep(sunProgress)
  const sunX = 52 + sunProgress * 23
  // The ridge is around 70% of the composition; start the disk behind it.
  const sunY = (portrait ? 71.5 : 80.2) - sunArc * 70
  const ridgeNightY = ridgeHeightAt(sunX, portrait ? portraitNightRidge : desktopNightRidge)
  const ridgeDayY = ridgeHeightAt(sunX, portrait ? portraitRidge : desktopRidge)
  const ridgeY = ridgeNightY + (ridgeDayY - ridgeNightY) * smoothstep(sunProgress / .42)
  const sunScreen = screenPoint(sunX, sunY)
  const sunScreenY = coverTop + coverHeight * sunY / 100
  const ridgeScreenY = coverTop + coverHeight * ridgeY / 100
  const sunCoreDiameter = Math.min(58, Math.max(38, viewport.width * .036))
  const visibleSunFraction = clamp01((ridgeScreenY - sunScreenY + sunCoreDiameter / 2) / sunCoreDiameter)
  const daylight = smoothstep((visibleSunFraction - .58) / .42) * (1 - smoothstep((elapsed - 112) / 25))
  const nightReturn = smoothstep((elapsed - 119) / 24)
  const nightOpacity = Math.max(1 - daylight, nightReturn)
  const warmLight = daylight
  const skyLight = daylight * .92
  const sunOpacity = smoothstep(sunProgress / .035) * (1 - smoothstep((sunProgress - .82) / .16)) * smoothstep(visibleSunFraction / .22)
  const horizonGlow = sunOpacity * visibleSunFraction * (1 - smoothstep((sunProgress - .035) / .4))
  const sunStyle = { ...sunScreen, opacity: sunOpacity, '--sun-scale': 1.18 - sunSizeProgress * .46, '--sun-yellow': 1 - sunProgress * .1, '--sun-aura-level': 1 - daylight * .45, '--sun-visible': `${visibleSunFraction * 100}%` } as CSSProperties
  const horizonStyle = { ...screenPoint(sunX, ridgeY), opacity: horizonGlow } as CSSProperties
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
    <div className="border-cave-horizon-glow" style={horizonStyle} aria-hidden="true"/>
    <div className="border-cave-sun-halo" style={sunStyle} aria-hidden="true"><i/></div>
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
    <SceneIntroTitle
      place="Border Cave"
      temporal={english ? '42,000 years ago' : '42 mil anos atrás'}
      geographical={english ? 'Region of present-day South Africa and Eswatini' : 'Região da atual África do Sul e Essuatíni'}
      elapsed={elapsed}
      duration={INTRO_SECONDS}
    />
    <header className="historical-scene-header border-cave-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label={english ? 'Return to the act library' : 'Voltar à biblioteca de atos'}><ArrowLeft size={19}/></button>
      <div className="historical-scene-meta"><span>{english ? 'SOUTHERN AFRICA' : 'ÁFRICA AUSTRAL'}</span><b>{english ? 'AROUND 42,000 YEARS AGO' : 'HÁ CERCA DE 42 MIL ANOS'}</b></div>
    </header>
    {debugMode && <details className="border-cave-debug"><summary>{english ? 'Scene controls' : 'Controles da cena'}</summary><label>{english ? 'Day cycle' : 'Ciclo do dia'}<input type="range" min="0" max={DAY_CYCLE_SECONDS} step=".1" value={Math.min(elapsed, DAY_CYCLE_SECONDS)} onChange={(event) => setElapsed(Number(event.target.value))}/></label><button onClick={() => setPlaying((value) => !value)}>{playing ? (english ? 'Pause' : 'Pausar') : (english ? 'Play' : 'Reproduzir')}</button><button onClick={() => { setElapsed(0); setPlaying(true) }}>{english ? 'Restart' : 'Reiniciar'}</button><label><input type="checkbox" checked={wildlife} onChange={(event) => setWildlife(event.target.checked)}/>{english ? 'Wildlife' : 'Animais'}</label><label><input type="checkbox" checked={birds} onChange={(event) => setBirds(event.target.checked)}/>{english ? 'Distant birds' : 'Aves distantes'}</label><output>{Math.floor(elapsed)}s</output></details>}
  </main>
}
