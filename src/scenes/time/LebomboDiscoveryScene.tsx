import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { audioManager } from '../../audio/AudioManager'
import AudioControls from '../../audio/AudioControls'
import { useLocale } from '../../i18n'
import DistantBirdFlock from './DistantBirdFlock'
import type { NarrationManifest } from '../sceneTypes'
import { ARU_CURIOSITY_AUDIO_DIR } from '../../narration/harrisonScript'
import dawnOfHumanity from '../../../content/music/dawn-of-humanity/composition.json'
import wideLandscape from '../../assets/scenes/time/lebombo/border-cave-dusk-wide.png'
import portraitLandscape from '../../assets/scenes/time/lebombo/border-cave-dusk-portrait.png'
import baboonSkull from '../../assets/scenes/time/lebombo/baboon-skull-reference.png'
import lebomboFibula from '../../assets/scenes/time/lebombo/lebombo-fibula-reference.png'
import engravingFlake from '../../assets/scenes/time/lebombo/engraving-flake-low-poly.png'
import boneFragment from '../../assets/scenes/time/lebombo/bone-fragment-low-poly.png'
import naturalStone from '../../assets/scenes/time/lebombo/natural-stone-low-poly.png'
import './lebombo-scene.css'

const WORLD_REFERENCE_WIDTH_CM = 180
const PORTRAIT_WORLD_REFERENCE_WIDTH_CM = 145
type WildlifeFrame = { src: string; durationMs: number }

const loadWildlifeFrames = (files: Record<string, string>, durations: number[]): WildlifeFrame[] =>
  Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, src], index) => ({ src, durationMs: durations[index] ?? 180 }))

const zebraFrames = loadWildlifeFrames(
  import.meta.glob('../../assets/scenes/time/wildlife/frames/zebra/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  [350, 180, 180, 180, 180, 180, 180, 350, 350, 180, 180, 180, 180, 180, 180, 350],
)
const baboonFrames = loadWildlifeFrames(
  import.meta.glob('../../assets/scenes/time/wildlife/frames/baboon/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  [160, 160, 160, 160, 220, 220, 220, 160, 160, 160, 160, 160],
)
const antelopeGrazeFrames = loadWildlifeFrames(
  import.meta.glob('../../assets/scenes/time/wildlife/frames/antelope/pastando/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  [180, 130, 130, 130, 160, 450, 450, 180, 150, 130, 130, 350],
)
const antelopeLookFrames = loadWildlifeFrames(
  import.meta.glob('../../assets/scenes/time/wildlife/frames/antelope/observando/frame_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  [200, 130, 130, 130, 180, 200, 200, 200, 200, 130, 130, 130, 130, 130, 130, 300],
)

function loopingWildlifeFrame(frames: WildlifeFrame[], elapsedSeconds: number, offsetSeconds: number, pauseMs: number, rate = 1.55) {
  if (!frames.length) return null
  const animationMs = frames.reduce((total, frame) => total + frame.durationMs, 0)
  const cycleMs = animationMs + pauseMs
  const phaseMs = (((elapsedSeconds + offsetSeconds) * 1000 * rate) % cycleMs + cycleMs) % cycleMs
  const activeMs = Math.min(phaseMs, animationMs - 1)
  let cursor = 0
  for (const frame of frames) {
    cursor += frame.durationMs
    if (activeMs < cursor) return frame
  }
  return frames[frames.length - 1]
}

type SceneObject = {
  id: string
  image: string
  kind: 'skull' | 'fibula' | 'tool' | 'bone-fragment' | 'stone' | 'flake'
  x: number
  y: number
  width: string
  rotation: number
  depth: number
  label?: string
  realLengthCm?: number
}

// Every item is a separate image with independent placement and perspective.
// The physical measurements document the reference scale for future close-ups.
export const LEBOMBO_REFERENCE_MEASUREMENTS = {
  baboonSkullLengthCm: 22,
  baboonFibulaFragmentLengthCm: 16,
  estimatedCompleteFibulaLengthCm: 20,
  lebomboPreservedLengthMm: 76.01,
  lebomboWidthMm: 8.5,
  lebomboThicknessMm: 5.75,
  lebomboPreservedIncisions: 29,
} as const

const sceneObjects: SceneObject[] = [
  { id: 'baboon-skull', image: baboonSkull, kind: 'skull', x: 25, y: 76.8, width: 'clamp(102px, 13.2vw, 232px)', rotation: -8, depth: 1, label: 'Crânio de babuíno chacma, sem mandíbula', realLengthCm: 22 },
  { id: 'lebombo-fibula', image: lebomboFibula, kind: 'fibula', x: 70, y: 80.5, width: 'clamp(100px, 9.6vw, 176px)', rotation: 5, depth: 2, label: 'Fíbula de babuíno', realLengthCm: 16 },
  { id: 'engraving-flake', image: engravingFlake, kind: 'tool', x: 48, y: 84.5, width: 'clamp(54px, 5.8vw, 102px)', rotation: -22, depth: 3, label: 'Lasca de pedra usada como ferramenta' },
  { id: 'bone-chip-a', image: boneFragment, kind: 'bone-fragment', x: 36, y: 83, width: 'clamp(37px, 4vw, 72px)', rotation: 26, depth: 3 },
  { id: 'bone-chip-b', image: boneFragment, kind: 'bone-fragment', x: 59, y: 86, width: 'clamp(31px, 3.1vw, 56px)', rotation: -33, depth: 4 },
  { id: 'bone-chip-c', image: boneFragment, kind: 'bone-fragment', x: 83, y: 82, width: 'clamp(26px, 2.7vw, 48px)', rotation: 52, depth: 2 },
  { id: 'stone-a', image: naturalStone, kind: 'stone', x: 14, y: 85, width: 'clamp(36px, 4.1vw, 74px)', rotation: -11, depth: 3 },
  { id: 'stone-b', image: naturalStone, kind: 'stone', x: 31, y: 89, width: 'clamp(27px, 3vw, 54px)', rotation: 18, depth: 4 },
  { id: 'stone-c', image: naturalStone, kind: 'stone', x: 56, y: 80, width: 'clamp(28px, 3vw, 54px)', rotation: 35, depth: 1 },
  { id: 'stone-d', image: naturalStone, kind: 'stone', x: 78, y: 88, width: 'clamp(34px, 3.7vw, 66px)', rotation: -17, depth: 4 },
  { id: 'flake-a', image: engravingFlake, kind: 'flake', x: 43, y: 88.5, width: 'clamp(25px, 2.7vw, 48px)', rotation: 14, depth: 4 },
  { id: 'flake-b', image: engravingFlake, kind: 'flake', x: 88, y: 84.5, width: 'clamp(23px, 2.4vw, 43px)', rotation: 43, depth: 3 },
]

const distantAnimals = [
  { id: 'zebra-a', kind: 'zebra', x: 47.5, y: 50.4, size: 3.2, offset: 0 },
  { id: 'zebra-b', kind: 'zebra', x: 50, y: 51, size: 3, offset: .16 },
  { id: 'zebra-c', kind: 'zebra', x: 52.4, y: 50.6, size: 2.85, offset: .32 },
  { id: 'antelope-a', kind: 'antelope-graze', x: 56, y: 50.8, size: 2.9, offset: .22 },
  { id: 'antelope-b', kind: 'antelope-look', x: 60, y: 50.5, size: 3, offset: .42 },
  { id: 'baboon-a', kind: 'baboon', x: 25, y: 52.8, size: 3.6, offset: .12 },
] as const

export default function LebomboDiscoveryScene({ onExit, caption, preserveNarration = false, interactionEnabled = true, onEquipmentComplete }: { onExit: () => void; caption?: string; preserveNarration?: boolean; interactionEnabled?: boolean; onEquipmentComplete?: () => void }) {
  const { locale, t } = useLocale()
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [animalElapsed, setAnimalElapsed] = useState(0)
  const [selectedObject, setSelectedObject] = useState<SceneObject | null>(null)
  const [equippedItems, setEquippedItems] = useState<string[]>([])
  const [equipmentMessage, setEquipmentMessage] = useState('')
  const [standaloneManifest, setStandaloneManifest] = useState<NarrationManifest | null>(null)
  const [standaloneNarrationTime, setStandaloneNarrationTime] = useState(0)
  const [standaloneToolsReady, setStandaloneToolsReady] = useState(false)
  const english = locale === 'en'
  const equipmentComplete = equippedItems.includes('lebombo-fibula') && equippedItems.includes('engraving-flake')
  const canInteractWithObjects = (preserveNarration ? interactionEnabled : standaloneToolsReady) && !equipmentComplete
  const standaloneCaption = standaloneManifest?.segments.find((cue) => cue.startMs <= standaloneNarrationTime * 1000 && standaloneNarrationTime * 1000 < cue.endMs)?.text
  const visibleCaption = caption ?? standaloneCaption

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
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = Math.min(.2, (now - last) / 1000)
      last = now
      if (!document.hidden) setAnimalElapsed((elapsed) => elapsed + delta)
    }, 90)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!preserveNarration) audioManager.stopNarration()
    audioManager.stopClockTicks()
  }, [preserveNarration])

  useEffect(() => {
    if (preserveNarration) return
    const controller = new AbortController()
    let playbackFrame = 0
    let pausedForTools = false
    void fetch(`${ARU_CURIOSITY_AUDIO_DIR}/manifest.json`, { signal: controller.signal, cache: 'no-cache' })
      .then((response) => response.ok ? response.json() : null)
      .then((manifest: NarrationManifest | null) => {
        if (controller.signal.aborted || manifest?.status !== 'approved' || !manifest.audioUrl) return
        setStandaloneManifest(manifest)
        return audioManager.playNarration(manifest.audioUrl, controller.signal, 7.5).then((audio) => {
          const syncNarration = () => {
            if (controller.signal.aborted) return
            const time = audio.currentTime
            setStandaloneNarrationTime(time)
            if (!pausedForTools && time >= 10.5) {
              pausedForTools = true
              setStandaloneToolsReady(true)
              audioManager.pauseNarration()
            }
            playbackFrame = requestAnimationFrame(syncNarration)
          }
          audio.addEventListener('ended', () => {
            cancelAnimationFrame(playbackFrame)
            setStandaloneNarrationTime(audio.duration)
            audioManager.stopNarration()
          }, { once: true, signal: controller.signal })
          syncNarration()
        })
      })
      .catch(() => {})
    return () => {
      controller.abort()
      cancelAnimationFrame(playbackFrame)
      audioManager.stopNarration()
    }
  }, [preserveNarration])

  useEffect(() => {
    if (preserveNarration) return
    const composition = dawnOfHumanity as typeof dawnOfHumanity & { approvedAssetUrl?: string; approvedVolume?: number; approvedCropStartSeconds?: number; approvedCropEndSeconds?: number | null; introVolume?: { gain?: number }; loop?: { crossfadeMs?: number } }
    if (!composition.approvedAssetUrl) return
    audioManager.setNarrationMusicLevel(composition.ducking.musicLevelDuringNarration)
    void audioManager.playMusicAsset(composition.approvedAssetUrl, {
      fadeMs: 500,
      loop: true,
      loopCrossfadeMs: composition.loop?.crossfadeMs ?? 1800,
      trackGain: composition.introVolume?.gain ?? composition.defaultVolume,
      volume: composition.approvedVolume,
      cropStartSeconds: composition.approvedCropStartSeconds,
      cropEndSeconds: composition.approvedCropEndSeconds,
    }).catch(() => {})
    return () => audioManager.fadeMusicOut(900)
  }, [preserveNarration])

  useEffect(() => {
    if (preserveNarration) return
    const animalCalls = [
      { id: 'border-cave-crested-francolin', volume: 1.55, pan: .28 },
      { id: 'border-cave-ring-necked-dove', volume: 1.45, pan: -.25 },
      { id: 'border-cave-natal-spurfowl', volume: 1.55, pan: .52 },
      { id: 'border-cave-chacma-baboon', volume: .78, pan: -.76 },
      { id: 'border-cave-plains-zebra', volume: 1.45, pan: .36 },
    ]
    void audioManager.setNaturalAmbience([
      { id: 'border-cave-wind', volume: 1, pan: 0 },
      { id: 'border-cave-vegetation', volume: .82, pan: .2 },
      { id: 'border-cave-night-crickets', volume: .42, pan: -.16 },
    ])
    let callIndex = 0
    let previousId = ''
    let callTimer = 0
    const scheduleCall = () => {
      callTimer = window.setTimeout(() => {
        const available = animalCalls.filter((call) => call.id !== previousId)
        const call = available[callIndex % available.length]
        callIndex += 1
        previousId = call.id
        void audioManager.playSoundEffectById(call.id, { volume: call.volume, pan: call.pan, group: call.id }).catch(() => {})
        scheduleCall()
      }, callIndex === 0 ? 0 : 6500 + Math.random() * 4500)
    }
    scheduleCall()
    return () => {
      window.clearTimeout(callTimer)
      audioManager.pauseNaturalAmbience()
    }
  }, [preserveNarration])

  const sourceWidth = portrait ? 941 : 1672
  const sourceHeight = portrait ? 1672 : 941
  const coverScale = Math.max(viewport.width / sourceWidth, viewport.height / sourceHeight)
  const coverWidth = sourceWidth * coverScale
  const coverHeight = sourceHeight * coverScale
  const coverLeft = (viewport.width - coverWidth) / 2
  const coverTop = (viewport.height - coverHeight) / 2
  const landscapeStyle = { inset: 'auto', left: `${coverLeft}px`, top: `${coverTop}px`, width: `${coverWidth}px`, height: `${coverHeight}px` } as CSSProperties
  const distantPoint = (x: number, y: number) => ({
    left: `${coverLeft + coverWidth * x / 100}px`,
    top: `${coverTop + coverHeight * y / 100}px`,
  })
  const animalSource = (animal: typeof distantAnimals[number]) => {
    if (animal.kind === 'zebra') return loopingWildlifeFrame(zebraFrames, animalElapsed, animal.offset, 140)?.src ?? zebraFrames[0]?.src
    if (animal.kind === 'baboon') return loopingWildlifeFrame(baboonFrames, animalElapsed, animal.offset, 140)?.src ?? baboonFrames[0]?.src
    if (animal.kind === 'antelope-look') return loopingWildlifeFrame(antelopeLookFrames, animalElapsed, animal.offset, 140)?.src ?? antelopeLookFrames[0]?.src
    return loopingWildlifeFrame(antelopeGrazeFrames, animalElapsed, animal.offset, 140)?.src ?? antelopeGrazeFrames[0]?.src
  }
  const itemLabel = (object: SceneObject) => english
    ? object.id === 'baboon-skull' ? 'Chacma baboon skull (without lower jaw)'
      : object.id === 'lebombo-fibula' ? 'Lebombo bone (baboon fibula)'
      : object.kind === 'tool' ? 'Stone flake engraving tool'
      : object.kind === 'stone' ? 'Natural stone'
      : object.kind === 'flake' ? 'Knapped stone flake'
      : 'Bone fragment'
    : object.label ?? (object.kind === 'stone' ? 'Pedra natural' : object.kind === 'flake' ? 'Fragmento de pedra lascada' : 'Fragmento ósseo')
  const selectObject = (object: SceneObject) => {
    if (!canInteractWithObjects || equippedItems.includes(object.id)) return
    audioManager.play('starSelect')
    setSelectedObject(object)
    setEquipmentMessage('')
  }
  const equipSelected = () => {
    if (!selectedObject) return
    if (equippedItems.includes(selectedObject.id)) {
      setSelectedObject(null)
      return
    }
    const nextItems = [...equippedItems, selectedObject.id].slice(0, 2)
    setSelectedObject(null)
    setEquipmentMessage('')
    if (nextItems.length < 2) {
      setEquippedItems(nextItems)
      return
    }
    const correctPair = nextItems.includes('lebombo-fibula') && nextItems.includes('engraving-flake')
    if (correctPair) {
      setEquippedItems(nextItems)
      audioManager.play('equipmentSuccess')
      if (onEquipmentComplete) onEquipmentComplete()
      else void audioManager.resumeNarration()
      return
    }
    setEquippedItems([])
    setEquipmentMessage(english ? 'These items are not ideal for making a mark. Choose again.' : 'Estes itens não são ideais para fazer uma marcação, escolha novamente.')
    audioManager.play('equipmentError')
  }
  const handleItemKey = (event: KeyboardEvent<HTMLImageElement>, object: SceneObject) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectObject(object) }
  }

  return <main className={`lebombo-discovery-scene ${portrait ? 'is-portrait' : ''}`} aria-label={english ? 'Border Cave archaeological scene' : 'Cena arqueológica em Border Cave'}>
    <picture className="lebombo-landscape" style={landscapeStyle} aria-hidden="true">
      <source media="(orientation: portrait)" srcSet={portraitLandscape}/>
      <img src={wideLandscape} alt="" style={{ width: '100%', height: '100%' }}/>
    </picture>
    <div className="lebombo-atmosphere" aria-hidden="true"/>
    <DistantBirdFlock variant="lebombo"/>
    <div className="lebombo-fauna" aria-hidden="true">
      {distantAnimals.map((animal) => <div
        key={animal.id}
        className={`lebombo-animal lebombo-animal-${animal.kind}`}
        style={{
          ...distantPoint(animal.x, animal.y),
          width: `${coverWidth * animal.size / 100}px`,
          zIndex: Math.round(animal.y),
        } as CSSProperties}
      ><img src={animalSource(animal)} alt="" draggable={false}/></div>)}
    </div>
    <div className="lebombo-ground-objects" aria-label={english ? 'Archaeological objects on the cave floor' : 'Objetos arqueológicos no chão da caverna'}>
      {sceneObjects.map((object) => {
        const isEquipped = equippedItems.includes(object.id)
        const style = {
          left: `${object.x}%`,
          top: `${object.y}%`,
          width: object.realLengthCm
            ? `${object.realLengthCm / (portrait ? PORTRAIT_WORLD_REFERENCE_WIDTH_CM : WORLD_REFERENCE_WIDTH_CM) * 100}vw`
            : object.width,
          zIndex: object.depth,
          '--object-rotation': `${object.rotation}deg`,
        } as CSSProperties
        return <img
          key={object.id}
          id={object.id}
          className={`lebombo-object lebombo-object-${object.kind} ${canInteractWithObjects && !isEquipped ? '' : 'is-disabled'} ${isEquipped ? 'is-equipped' : ''}`}
          src={object.image}
          alt={itemLabel(object)}
          role="button"
          tabIndex={canInteractWithObjects && !isEquipped ? 0 : -1}
          aria-label={itemLabel(object)}
          aria-disabled={!canInteractWithObjects || isEquipped}
          onClick={() => selectObject(object)}
          onKeyDown={(event) => handleItemKey(event, object)}
          draggable={false}
          data-real-length-cm={object.realLengthCm}
          style={style}
        />
      })}
    </div>
    {canInteractWithObjects && <div className="lebombo-action-hint">{english ? 'Click the items to equip' : 'Clique nos itens para equipar'}</div>}
    {equipmentMessage && <div className="lebombo-equipment-feedback" role="status">{equipmentMessage}</div>}
    <div className="lebombo-equipment" aria-label={english ? 'Equipment slots' : 'Espaços de equipamento'}>
      {[0, 1].map((slot) => {
        const id = equippedItems[slot]
        const object = id ? sceneObjects.find((item) => item.id === id) : undefined
        return <div className={`lebombo-equipment-slot ${object ? 'is-filled' : ''}`} key={slot} title={object ? itemLabel(object) : english ? 'Empty slot' : 'Espaço vazio'}>
          {object ? <img src={object.image} alt={itemLabel(object)}/> : <span>{slot + 1}</span>}
        </div>
      })}
    </div>
    {selectedObject && <div className="lebombo-item-veil" role="presentation" onClick={() => setSelectedObject(null)}>
      <section className="lebombo-item-card" role="dialog" aria-modal="true" aria-label={itemLabel(selectedObject)} onClick={(event) => event.stopPropagation()}>
        <button className="lebombo-item-close" onClick={() => setSelectedObject(null)}>{english ? 'Exit' : 'Sair'}</button>
        <img className="lebombo-item-preview" src={selectedObject.image} alt={itemLabel(selectedObject)}/>
        <h2>{itemLabel(selectedObject)}</h2>
        <p>{english ? 'Choose this object for the two marking-tool slots.' : 'Escolha este objeto para os dois espaços de ferramentas de marcação.'}</p>
        <button className="lebombo-item-equip" onClick={equipSelected}>{english ? 'Equip' : 'Equipar'}</button>
      </section>
    </div>}
    <div className="lebombo-vignette" aria-hidden="true"/>
    <div className="lebombo-transition-cover" aria-hidden="true"/>
    {visibleCaption && <div className="historical-scene-caption" role="status"><p>{visibleCaption}</p></div>}
    <header className="lebombo-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label={t('scene.back')}><ArrowLeft size={19}/></button>
      <div className="lebombo-meta"><span>{english ? 'BORDER CAVE · SOUTHERN AFRICA' : 'BORDER CAVE · ÁFRICA AUSTRAL'}</span><b>{english ? 'ABOUT 42,000 YEARS AGO' : 'HÁ CERCA DE 42 MIL ANOS'}</b></div>
    </header>
    <div className="historical-scene-audio-control"><AudioControls/></div>
  </main>
}
