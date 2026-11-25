import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import AudioControls from '../../audio/AudioControls'
import { useLocale } from '../../i18n'
import SceneIntroTitle from './SceneIntroTitle'
import './taosi-scene.css'

const WORLD_WIDTH = 1672
const WORLD_HEIGHT = 940
type Frame = { src: string }
type Point = { x: number; y: number; width: number; height: number }

const framesFrom = (files: Record<string, string>): Frame[] => Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => ({ src }))

const manFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/man-millet-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const womanAdultFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/woman-adult-millet-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const fieldWorkerFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/field-worker-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const womanMilletFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/woman-millet-32/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const womanGrainFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/woman-grains-32/frames/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const pigletFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/piglet-32/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const childFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/child-pot-32/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)

const cleanLandscape = new URL('../../assets/scenes/time/taosi/taosi-landscape-clean.png', import.meta.url).href

function currentFrame(frames: Frame[], elapsed: number, fps: number, offsetSeconds = 0) {
  if (!frames.length) return ''
  const index = Math.floor(Math.max(0, elapsed + offsetSeconds) * fps) % frames.length
  return frames[index]?.src ?? frames[0].src
}

function worldPoint(point: Point, scale: number, offsetX: number, offsetY: number): CSSProperties {
  return {
    left: offsetX + point.x * scale,
    top: offsetY + point.y * scale,
    width: point.width * scale,
    height: point.height * scale,
  }
}

export default function TaosiScene({ onExit }: { onExit: () => void }) {
  const { locale } = useLocale()
  const english = locale === 'en'
  const [elapsed, setElapsed] = useState(0)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // One scene clock drives the sun, the dawn light, the title and every sprite.
  useEffect(() => {
    let raf = 0
    let startAt: number | null = null
    let lastUpdateAt = 0
    const tick = (now: number) => {
      startAt ??= now
      if (now - lastUpdateAt >= 32) {
        setElapsed((now - startAt) / 1000)
        lastUpdateAt = now
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const scale = viewport.width && viewport.height ? Math.max(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT) : 1
  const offsetX = (viewport.width - WORLD_WIDTH * scale) / 2
  const offsetY = (viewport.height - WORLD_HEIGHT * scale) / 2
  const portrait = viewport.height > viewport.width
  const place = (landscape: Point, mobile: Point = landscape) => worldPoint(portrait ? mobile : landscape, scale, offsetX, offsetY)

  const dawn = Math.max(0, Math.min(1, elapsed / 68))
  const smoothDawn = dawn * dawn * (3 - 2 * dawn)
  const sunProgress = Math.max(0, Math.min(1, elapsed / 66))
  const sunX = 641 + sunProgress * 132
  const sunY = 244 - sunProgress * 121
  const sunVisible = Math.max(.42, Math.min(1, .42 + sunProgress * 1.7))
  const sunStyle: CSSProperties = {
    ...worldPoint({ x: sunX, y: sunY, width: 140, height: 140 }, scale, offsetX, offsetY),
    opacity: Math.min(1, elapsed / 2.4),
    clipPath: `inset(0 0 ${(1 - sunVisible) * 100}% 0)`,
    '--sun-glow': String(1 - smoothDawn * .25),
  } as CSSProperties
  const dawnStyle = { '--dawn': String(smoothDawn) } as CSSProperties
  const childX = 915 + Math.sin(elapsed * .34) * 26
  const pigX = 754 + Math.sin(elapsed * .28 + 1.1) * 9
  const smokePoint = portrait ? { x: 1020, y: 235, width: 90, height: 160 } : { x: 1075, y: 235, width: 90, height: 160 }

  const actors = useMemo(() => [
    { id: 'field-worker', frames: fieldWorkerFrames, fps: 9, phase: .15, point: { x: 274, y: 746, width: 322, height: 322 }, mobile: { x: 618, y: 745, width: 300, height: 300 } },
    { id: 'millet-woman', frames: womanMilletFrames, fps: 16, phase: .72, point: { x: 492, y: 588, width: 152, height: 196 }, mobile: { x: 710, y: 590, width: 145, height: 185 } },
    { id: 'millet-man', frames: manFrames, fps: 9, phase: .4, point: { x: 654, y: 635, width: 205, height: 205 }, mobile: { x: 797, y: 628, width: 190, height: 190 } },
    { id: 'millet-woman-adult', frames: womanAdultFrames, fps: 9, phase: 1.18, point: { x: 432, y: 610, width: 146, height: 146 }, mobile: { x: 681, y: 609, width: 138, height: 138 } },
    { id: 'child-carrying-pot', frames: childFrames, fps: 16, phase: .5, point: { x: childX, y: 622, width: 112, height: 198 }, mobile: { x: 918 + (childX - 915), y: 620, width: 104, height: 185 } },
    { id: 'pig-and-piglet', frames: pigletFrames, fps: 12.5, phase: .92, point: { x: pigX, y: 644, width: 204, height: 156 }, mobile: { x: 845 + (pigX - 754), y: 642, width: 192, height: 146 } },
    { id: 'woman-sifting-grain', frames: womanGrainFrames, fps: 16, phase: 1.36, point: { x: 1145, y: 654, width: 228, height: 228 }, mobile: { x: 1035, y: 656, width: 210, height: 210 } },
  ], [childX, pigX])

  return <main className="taosi-scene" aria-label={english ? 'Taosi at dawn' : 'Taosi ao amanhecer'} style={dawnStyle}>
    <img className="taosi-landscape" src={cleanLandscape} alt="" draggable={false}/>
    <div className="taosi-dawn-tone" aria-hidden="true"/>
    <div className="taosi-sun" style={sunStyle} aria-hidden="true"><i/></div>
    <div className="taosi-smoke" style={worldPoint(smokePoint, scale, offsetX, offsetY)} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--smoke-index': index } as CSSProperties}/>) }
    </div>
    <div className="taosi-sprite-layer" aria-hidden="true">
      {actors.map((actor) => <img key={actor.id} className={`taosi-sprite taosi-${actor.id}`} src={currentFrame(actor.frames, elapsed, actor.fps, actor.phase)} alt="" draggable={false} style={place(actor.point, actor.mobile)}/>) }
    </div>
    <div className="taosi-vignette" aria-hidden="true"/>
    <header className="taosi-header">
      <button type="button" className="taosi-back" onClick={onExit} aria-label={english ? 'Back to the act library' : 'Voltar à biblioteca de atos'}><ArrowLeft size={21}/></button>
      <AudioControls/>
    </header>
    <SceneIntroTitle
      place="Taosi"
      temporal={english ? '2,300 BCE' : '2.300 a.C.'}
      geographical={english ? 'Present-day China' : 'Região da China Atual'}
      elapsed={elapsed}
      position={{ x: '50%', y: '28%' }}
      duration={7}
    />
  </main>
}
