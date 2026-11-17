import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, Pause, Play, SkipForward } from 'lucide-react'
import type { HistoricalScene } from './sceneTypes'
import './historical-scene.css'

export default function HistoricalScenePlayer({ scene, onExit }: { scene: HistoricalScene; onExit: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [isVisible, setIsVisible] = useState(!document.hidden)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const debugMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const sceneEndNotified = useRef(false)
  const currentCue = useMemo(() => scene.timeline.find((cue) => elapsed >= cue.start && elapsed < cue.end) ?? scene.timeline[scene.timeline.length - 1], [scene.timeline, elapsed])
  const cameraZoom = currentCue.cameraZoom ?? 1
  const caption = currentCue.subtitle

  useEffect(() => {
    const updateVisibility = () => setIsVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    if (!playing || elapsed >= scene.duration || !isVisible) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setElapsed((value) => Math.min(scene.duration, Math.round((value + .1) * 10) / 10))
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, elapsed, scene.duration, isVisible])

  useEffect(() => {
    if (elapsed < scene.duration || sceneEndNotified.current) return
    sceneEndNotified.current = true
    window.dispatchEvent(new CustomEvent('stonephys:historical-scene-ready', { detail: { sceneId: scene.id, nextScene: scene.nextScene } }))
  }, [elapsed, scene.duration, scene.id, scene.nextScene])

  return <main className={`historical-scene ${reducedMotion ? 'historical-scene-reduced-motion' : ''}`} aria-label={`${scene.title}, ${scene.location}, ${scene.period}`}>
    <div className="historical-scene-camera" style={{ transform: `scale(${cameraZoom})` }}>
      {scene.layers.map((layer) => <div key={layer.id} className="historical-scene-layer" style={{ backgroundImage: `url("${layer.image}")`, backgroundSize: layer.fit ?? 'cover', opacity: layer.opacity ?? 1, zIndex: layer.depth }}/>) }
      <div className="historical-scene-window-light" aria-hidden="true"/>
      <div className="historical-scene-dust" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--dust-i': i, left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDuration: `${9 + i % 7}s` } as CSSProperties & { '--dust-i': number }}/>)}</div>
      <div className={`historical-scene-watch ${currentCue.rewind ? 'is-rewinding' : ''}`}>
        {scene.props.map((prop) => <div key={prop.id} className={`historical-scene-prop historical-scene-prop-${prop.id}`}>{prop.render(elapsed)}</div>)}
      </div>
    </div>
    <div className="historical-scene-vignette" aria-hidden="true"/>
    <div className="historical-scene-blackout" style={{ opacity: currentCue.blackout ? Math.min(1, Math.max(0, (elapsed - currentCue.start) / 4.8)) : 0 }} aria-hidden="true"/>
    <header className="historical-scene-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label="Voltar ao mapa"><ArrowLeft size={19}/></button>
      <div className="historical-scene-meta"><span>{scene.location}</span><b>{scene.period}</b></div>
      {elapsed < scene.duration && <button className="historical-scene-skip" onClick={() => { setPlaying(false); setElapsed(scene.duration) }}><span>Pular introdução</span><SkipForward size={15}/></button>}
    </header>
    {caption && elapsed < 30 && <div className="historical-scene-caption" role="status"><p>{caption}</p></div>}
    {elapsed < scene.duration && <footer className="historical-scene-controls">
      <button className="historical-scene-icon-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pausar cena' : 'Continuar cena'}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <div className="historical-scene-progress" aria-label={`Cena em ${Math.floor(elapsed)} de ${scene.duration} segundos`}><span style={{ width: `${elapsed / scene.duration * 100}%` }}/></div>
      <span className="historical-scene-time">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span>
    </footer>}
    {elapsed >= scene.duration && <section className="historical-scene-destination" aria-live="polite">
      <span>Próxima viagem</span>
      <h1>{scene.nextScene.location}</h1>
      <p>{scene.nextScene.period}</p>
      <button onClick={() => {
        window.dispatchEvent(new CustomEvent('stonephys:historical-scene-next', { detail: { sceneId: scene.id, nextScene: scene.nextScene } }))
        onExit()
      }}>Voltar ao primeiro ato</button>
    </section>}
    {debugMode && <details className="historical-scene-debug"><summary>Depuração da cena</summary><input type="range" min="0" max={scene.duration} step=".1" value={elapsed} onChange={(event) => { setElapsed(Number(event.target.value)); setPlaying(false) }}/><span>{elapsed.toFixed(1)}s / {scene.duration}s</span><button onClick={() => { sceneEndNotified.current = false; setElapsed(0); setPlaying(true) }}>Reiniciar</button></details>}
  </main>
}
