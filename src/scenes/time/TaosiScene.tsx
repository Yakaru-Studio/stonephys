import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import AudioControls from '../../audio/AudioControls'
import { useLocale } from '../../i18n'
import SceneIntroTitle from './SceneIntroTitle'
import './taosi-scene.css'

const WORLD_WIDTH = 1671
const WORLD_HEIGHT = 941
const MOUNTAIN_RIDGE: Array<[number, number]> = [
  [600, 235], [620, 238], [640, 242], [660, 245], [680, 249], [700, 250],
  [720, 244], [740, 236], [760, 226], [780, 224], [800, 220], [820, 216],
  [840, 210], [860, 210], [880, 212], [900, 218], [920, 223], [940, 223],
  [960, 218], [980, 216],
]
type Frame = { src: string }
type Point = { x: number; y: number; width: number; height: number }

function ridgeY(x: number) {
  const rightIndex = MOUNTAIN_RIDGE.findIndex(([ridgeX]) => ridgeX >= x)
  if (rightIndex === -1) return MOUNTAIN_RIDGE[MOUNTAIN_RIDGE.length - 1][1]
  if (rightIndex === 0) return MOUNTAIN_RIDGE[0][1]
  const [x1, y1] = MOUNTAIN_RIDGE[rightIndex - 1]
  const [x2, y2] = MOUNTAIN_RIDGE[rightIndex]
  return y1 + (y2 - y1) * ((x - x1) / (x2 - x1))
}

const framesFrom = (files: Record<string, string>): Frame[] => Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => ({ src }))

const manFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/man-millet-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const fieldWorkerFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/field-worker-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const childFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/child-bin-16/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const womanGrainFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/woman-grains-32/frames/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
const pigletFrames = framesFrom(import.meta.glob('../../assets/scenes/time/taosi/piglet-32/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)

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
  const place = (landscape: Point, mobile: Point = landscape, mobileXRatio?: number) => {
    if (portrait && mobileXRatio !== undefined && viewport.width) {
      return worldPoint({ ...mobile, x: (viewport.width * mobileXRatio - offsetX) / scale }, scale, offsetX, offsetY)
    }
    return worldPoint(portrait ? mobile : landscape, scale, offsetX, offsetY)
  }

  const sunProgress = .5 + Math.max(0, Math.min(1, elapsed / 65)) * .5
  const daylightProgress = Math.min(1, elapsed / 34)
  const smoothDawn = 1 - Math.pow(1 - daylightProgress, 3)
  const sunX = 460 + sunProgress * 320
  // Align the sun with the extracted ridge: it begins half-hidden and rises
  // clear of the mountain without changing that relationship on portrait screens.
  const sunY = 298 - sunProgress * 240
  const horizonCut = Math.max(0, Math.min(100, ((ridgeY(sunX + 70) - (sunY + 35)) / 70) * 100))
  const sunCoreStyle: CSSProperties = {
    clipPath: `polygon(0 0, 100% 0, 100% ${horizonCut}%, 0 ${horizonCut}%)`,
  }
  const sunStyle: CSSProperties = {
    ...worldPoint({ x: sunX, y: sunY, width: 140, height: 140 }, scale, offsetX, offsetY),
    opacity: 1,
    '--sun-glow': String(.7 + smoothDawn * .3),
  } as CSSProperties
  const dawnStyle = { '--dawn': String(smoothDawn) } as CSSProperties
  const pigX = 990 + Math.sin(elapsed * .28 + 1.1) * 5
  const smokePoint = portrait ? { x: 1020, y: 235, width: 90, height: 160 } : { x: 1075, y: 235, width: 90, height: 160 }

  const actors = useMemo(() => [
    { id: 'field-worker', frames: fieldWorkerFrames, fps: 9, phase: .15, point: { x: 76, y: 670, width: 210, height: 210 }, mobile: { x: 635, y: 670, width: 220, height: 220 }, mobileXRatio: .19 },
    { id: 'millet-man', frames: manFrames, fps: 9, phase: .4, point: { x: 390, y: 480, width: 44, height: 44 }, mobile: { x: 660, y: 480, width: 40, height: 40 }, mobileXRatio: .27 },
    { id: 'child-carrying-bin', frames: childFrames, fps: 4.5, phase: .5, point: { x: 910, y: 545, width: 130, height: 128 }, mobile: { x: 910, y: 545, width: 120, height: 118 } },
    { id: 'pig-and-piglet', frames: pigletFrames, fps: 12.5, phase: .92, point: { x: pigX, y: 540, width: 98, height: 75 }, mobile: { x: 990 + (pigX - 990), y: 540, width: 92, height: 70 } },
    { id: 'woman-sifting-grain', frames: womanGrainFrames, fps: 16, phase: 1.36, point: { x: 1145, y: 654, width: 228, height: 228 }, mobile: { x: 1035, y: 656, width: 210, height: 210 } },
  ], [pigX])

  return <main className="taosi-scene" aria-label={english ? 'Taosi at dawn' : 'Taosi ao amanhecer'} style={dawnStyle}>
    <img className="taosi-landscape" src={cleanLandscape} alt="" draggable={false}/>
    <div className="taosi-dawn-tone" aria-hidden="true"/>
    <div className="taosi-sun" style={sunStyle} aria-hidden="true"><i style={sunCoreStyle}/></div>
    <div className="taosi-smoke" style={worldPoint(smokePoint, scale, offsetX, offsetY)} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--smoke-index': index } as CSSProperties}/>) }
    </div>
    <div className="taosi-sprite-layer" aria-hidden="true">
      {actors.map((actor) => <img key={actor.id} className={`taosi-sprite taosi-${actor.id}`} src={currentFrame(actor.frames, elapsed, actor.fps, actor.phase)} alt="" draggable={false} style={place(actor.point, actor.mobile, 'mobileXRatio' in actor ? actor.mobileXRatio : undefined)}/>) }
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
