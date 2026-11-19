import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { audioManager } from './audio/AudioManager'
import AudioControls from './audio/AudioControls'
import { learningArcs, type ArcAct } from './arcActs'
import './arc-map.css'
import { localizeArc, useLocale, type AppLocale } from './i18n'

const libraryShelfArtwork = new URL('./assets/arcs/library-cabinet-cutout.png', import.meta.url).href
const libraryBackgroundArtwork = new URL('./assets/arcs/knowledge-library-background.jpg', import.meta.url).href
const libraryScrollArtwork = new URL('./assets/arcs/library-scroll-blank-small.png', import.meta.url).href
const libraryLampArtwork = new URL('./assets/arcs/library-oil-lamp-small.png', import.meta.url).href
const baboonSkullArtwork = new URL('./assets/arcs/library-baboon-skull-front.png', import.meta.url).href
const boneSealArtwork = new URL('./assets/arcs/library-bone-seal.png', import.meta.url).href
const lockSealArtwork = new URL('./assets/arcs/library-lock-seal.png', import.meta.url).href
const completedSealArtwork = new URL('./assets/arcs/library-completed-seal.png', import.meta.url).href
const parchmentScrollArtwork = new URL('./assets/arcs/act-parchment-scroll.png', import.meta.url).href

function ParchmentEmblem({ symbol, position }: { symbol: ArcAct['symbol']; position: 'top' | 'bottom' }) {
  return <span className={`parchment-emblem parchment-emblem-${position} emblem-${symbol}`} aria-hidden="true">
    {symbol === 'bone' ? <img src={boneSealArtwork} alt="" draggable={false}/> : <svg viewBox="0 0 64 64" focusable="false">
      {symbol === 'sun-moon' && <g transform="translate(5.5 0)"><circle cx="23" cy="31" r="10"/><path d="M41 14a18 18 0 1 0 8 34 16 16 0 0 1-8-34Z"/><path d="M23 14v-6m0 46v-5m-17-18H1m44 0h7M11 19l-4-4m31 31 4 4"/></g>}
      {symbol === 'tally' && <><path d="M13 14v36m10-36v36m10-36v36m10-36v36m-31-7 34-24"/></>}
      {symbol === 'compass' && <><circle cx="32" cy="32" r="24"/><path d="m42 21-7 16-14 6 7-16 14-6Z"/><circle cx="32" cy="32" r="2"/></>}
      {symbol === 'telescope' && <><path d="m18 13 31 31-11 11-31-31 11-11Zm-5 14 9-9m15 26 9-9M13 48l-6 9m40-5 8 5"/><circle cx="19" cy="14" r="5"/></>}
      {symbol === 'pyramid' && <><path d="m8 51 24-39 24 39H8Zm24-39v39m-15-12h30"/></>}
      {symbol === 'bull' && <><path d="M19 24 8 15l1 18 10 4m26-13 11-9-1 18-10 4M19 25c4-8 22-8 26 0l-2 22c-5 8-17 8-22 0l-2-22Zm6 11h.1m14 0h.1M27 47h10"/></>}
      {symbol === 'lock' && <><rect x="15" y="28" width="34" height="27" rx="4"/><path d="M22 28v-8a10 10 0 0 1 20 0v8m-10 10v8"/></>}
    </svg>}
  </span>
}

function Parchment({ act, closing, onClose, onStart, onComplete, starting, locale, devScene, onDevSceneChange }: {
  act: ArcAct
  closing: boolean
  onClose: () => void
  onStart: () => void
  onComplete: () => void
  starting: boolean
  locale: AppLocale
  devScene: DevSceneTarget
  onDevSceneChange: (scene: DevSceneTarget) => void
}) {
  const completed = act.status === 'completed'
  return <div className={`arc-parchment-backdrop ${closing ? 'is-closing' : 'is-opening'}`} onClick={onClose}>
    <div className="parchment-audio-control"><AudioControls/></div>
    <section className="arc-parchment" role="dialog" aria-modal="true" aria-labelledby="act-parchment-title" onClick={(event) => event.stopPropagation()}>
      <img className="parchment-scroll-artwork" src={parchmentScrollArtwork} alt="" draggable={false}/>
      <ParchmentEmblem symbol={act.topEmblem ?? act.symbol} position="top"/>
      <ParchmentEmblem symbol={act.bottomEmblem ?? act.symbol} position="bottom"/>
      <button className="parchment-close" onClick={onClose} aria-label={locale === 'en' ? 'Close scroll' : 'Fechar pergaminho'}><X size={20}/></button>
      <article className="parchment-paper">
        <h2 id="act-parchment-title">{act.title}</h2>
        <figure className="parchment-illustration">
          <img src={act.illustration} alt={`${locale === 'en' ? 'Illustration of' : 'Ilustração de'} ${act.title}`} />
        </figure>
        <div className="parchment-divider" aria-hidden="true"><span/><b>✦</b><span/></div>
        <p className="parchment-description">{act.description}</p>
        <div className={`parchment-state ${completed ? 'is-completed' : ''}`}>{completed ? (locale === 'en' ? 'Completed' : 'Concluído') : (locale === 'en' ? 'Available' : 'Disponível')}</div>
        {import.meta.env.DEV && <label className="parchment-dev-scene-control">
          <span>{locale === 'en' ? 'Start directly in scene' : 'Iniciar diretamente na cena'}</span>
          <select value={devScene} onChange={(event) => onDevSceneChange(event.currentTarget.value as DevSceneTarget)}>
            <option value="border-cave-cycle">{locale === 'en' ? 'Scene 1 · Sun and Moon' : 'Cena 1 · Sol e Lua'}</option>
            <option value="lebombo-discovery">{locale === 'en' ? 'Scene 2 · Lebombo discovery' : 'Cena 2 · Descoberta do Lebombo'}</option>
            <option value="lebombo-bone-activity">{locale === 'en' ? 'Scene 3 · Bone activity' : 'Cena 3 · Atividade do osso'}</option>
          </select>
        </label>}
        <div className="parchment-actions">
        <button className="parchment-start" onClick={onStart} disabled={starting}>
          <svg viewBox="0 0 66 44" aria-hidden="true"><path d="M32 39Q13 28 7 9q14-1 22 15Q25 7 31 3q8 8 5 21Q43 9 57 8q-2 18-23 31M12 15q9 0 13 10m18-5q3-9 11-9M24 26l-4 8m21-8 5 8"/></svg>
          <span>{completed ? (locale === 'en' ? 'REVIEW ACT' : 'REVER ATO') : (locale === 'en' ? 'START ACT' : 'INICIAR ATO')}</span>
          <svg className="laurel-end" viewBox="0 0 66 44" aria-hidden="true"><path d="M32 39Q13 28 7 9q14-1 22 15Q25 7 31 3q8 8 5 21Q43 9 57 8q-2 18-23 31M12 15q9 0 13 10m18-5q3-9 11-9M24 26l-4 8m21-8 5 8"/></svg>
        </button>
        <button className={`parchment-start parchment-complete ${completed ? 'is-complete' : ''}`} onClick={onComplete} disabled={completed}>
          <span>{completed ? (locale === 'en' ? 'ACT COMPLETED' : 'ATO CONCLUÍDO') : (locale === 'en' ? 'COMPLETE ACT' : 'CONCLUIR ATO')}</span>
        </button>
        </div>
      </article>
    </section>
  </div>
}

export type DevSceneTarget = 'border-cave-cycle' | 'lebombo-discovery' | 'lebombo-bone-activity'

function LibraryScroll({ act, current, onSelect }: { act: ArcAct; current: boolean; onSelect: () => void }) {
  const sealArtwork = act.status === 'locked' ? lockSealArtwork : act.status === 'completed' ? completedSealArtwork : act.symbol === 'bone' ? boneSealArtwork : null
  return <button className={`library-scroll ${act.status} ${current ? 'is-current' : ''}`} onClick={onSelect} disabled={act.status === 'locked'} aria-label={act.title}>
    <img className="scroll-artwork" src={libraryScrollArtwork} alt="" draggable={false}/>
    <span className={`scroll-wax ${sealArtwork ? 'has-artwork' : ''} ${act.status === 'completed' ? 'is-completed' : ''}`}>
      {sealArtwork && <img src={sealArtwork} alt="" draggable={false}/>}
    </span>
  </button>
}

function LibraryShelf({ acts, currentActId, onSelect, locale }: { acts: ArcAct[]; currentActId: string | null; onSelect: (act: ArcAct) => void; locale: AppLocale }) {
  const tracks = [...new Set(acts.map((act) => act.kind))]
  const [trackIndex, setTrackIndex] = useState(Math.max(0, tracks.indexOf('main')))
  const [trackMotion, setTrackMotion] = useState(0)
  const touchStart = useRef<number | null>(null)
  const track = tracks[trackIndex] ?? 'main'
  const shelfActs = acts.filter((act) => act.kind === track).sort((a, b) => a.number - b.number).slice(0, 4)
  const navigate = (direction: number) => {
    const next = Math.max(0, Math.min(tracks.length - 1, trackIndex + direction))
    if (next !== trackIndex) { setTrackMotion(direction); setTrackIndex(next) }
  }
  const trackName = track === 'main' ? (locale === 'en' ? 'Main Path' : 'Trilha Principal') : (locale === 'en' ? 'Optional Path' : 'Trilha Opcional')
  return <div className="library-room" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => {
    if (touchStart.current === null) return
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current
    if (Math.abs(delta) > 64) navigate(delta < 0 ? 1 : -1)
    touchStart.current = null
  }}>
    <div className="library-depth library-depth-left"/><div className="library-depth library-depth-right"/>
    {tracks.length > 1 && <button className="library-track-nav library-track-prev" onClick={() => navigate(-1)} disabled={trackIndex === 0} aria-label={locale === 'en' ? 'Previous shelf' : 'Estante anterior'}><ChevronLeft/></button>}
    <section className={`knowledge-shelf motion-${trackMotion}`} aria-label={trackName} key={track}>
      <img className="shelf-cabinet-artwork" src={libraryShelfArtwork} alt="" draggable={false}/>
      <div className="shelf-crown"><span className="shelf-emblem" aria-hidden="true"><svg viewBox="-20 -14 40 28"><g className="sun-moon-mark"><circle className="sun-moon-sun" cx="-6" cy="0" r="5"/><path className="sun-moon-rays" d="M-6-9v-2m0 22v-2m9-9h2m-22 0h2m15.4-6.4 1.5-1.5m-15.8 15.8L-17.4 8m11.4 3v2m0-24v2m-6.4 15.4-1.5-1.5m15.8-15.8L3.4-8"/><path className="sun-moon-crescent" d="M10-8a9 9 0 1 0 0 16A6.8 6.8 0 0 1 10-8Z"/><circle className="sun-moon-star" cx="14" cy="-8" r="1.2"/></g></svg></span></div>
      <div className="shelf-columns"><i/><i/></div>
      <div className="shelf-content">
        {shelfActs.map((act) => <div className={`shelf-row ${act.status}`} key={act.id}>
          <div className="shelf-artifact">{act.siteEnvironment && <img src={baboonSkullArtwork} alt="Crânio de babuíno" draggable={false}/>}</div>
          <LibraryScroll act={act} current={act.id === currentActId} onSelect={() => onSelect(act)}/>
          <div className={`shelf-lamp ${act.id === currentActId ? 'lit' : ''} ${act.id === 'counting-marks' ? 'bone-act-lamp' : ''}`} aria-hidden="true"><img src={libraryLampArtwork} alt=""/><span className="lamp-flame"/></div>
        </div>)}
        {!shelfActs.length && <div className="library-empty">{locale === 'en' ? 'This shelf awaits its scrolls.' : 'Esta estante ainda aguarda seus pergaminhos.'}</div>}
      </div>
      <footer className="shelf-footer">{track === 'main' ? (locale === 'en' ? 'Main Path' : 'Trilha Principal') : (locale === 'en' ? 'Optional Path' : 'Trilha Opcional')}</footer>
    </section>
    {tracks.length > 1 && <button className="library-track-nav library-track-next" onClick={() => navigate(1)} disabled={trackIndex >= tracks.length - 1} aria-label={locale === 'en' ? 'Next shelf' : 'Próxima estante'}><ChevronRight/></button>}
  </div>
}

export default function ArcMapPage({ moduleId, completedActIds, backToProgress, onBack, onStartAct, onCompleteAct }: {
  moduleId: string
  completedActIds: string[]
  backToProgress?: boolean
  onBack: () => void
  onStartAct: (act: ArcAct, devScene?: DevSceneTarget) => void
  onCompleteAct: (actId: string) => void
}) {
  const { locale } = useLocale()
  const arc = localizeArc(locale, learningArcs[moduleId])
  const [selectedActId, setSelectedActId] = useState<string | null>(null)
  const [closingParchment, setClosingParchment] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const startTimer = useRef<number | null>(null)
  const [flameActId, setFlameActId] = useState<string | null>(null)
  const [startingAct, setStartingAct] = useState(false)
  const [devScene, setDevScene] = useState<DevSceneTarget>('border-cave-cycle')
  const acts = useMemo(() => arc.acts.filter((act) => moduleId !== 'time' || act.id === 'counting-marks').map((act) => {
    const completed = completedActIds.includes(act.id)
    const available = !completed && act.prerequisites.every((prerequisite) => completedActIds.includes(prerequisite))
    return { ...act, status: completed ? 'completed' as const : available ? 'available' as const : 'locked' as const }
  }), [arc.acts, completedActIds, moduleId])
  const actsById = new Map(acts.map((act) => [act.id, act]))
  const currentActId = acts.find((act) => act.kind === 'main' && act.status === 'available')?.id
    ?? acts.find((act) => act.status === 'available')?.id
    ?? null
  const selectedAct = selectedActId ? actsById.get(selectedActId) ?? null : null
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    if (startTimer.current !== null) window.clearTimeout(startTimer.current)
  }, [])

  useEffect(() => {
    if (!selectedAct) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeParchment()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAct])

  function closeParchment() {
    if (!selectedActId || closingParchment) return
    void audioManager.playSoundEvent('library.scroll.roll')
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    setSelectedActId(null)
    setClosingParchment(false)
  }

  const openAct = (act: ArcAct) => {
    if (act.status === 'locked') return
    void audioManager.playSoundEvent('library.scroll.unroll')
    setStartingAct(false)
    setClosingParchment(false)
    setSelectedActId(act.id)
  }

  const startAct = () => {
    if (!selectedAct || startingAct) return
    audioManager.play('navigation')
    const actToStart = selectedAct
    setFlameActId(actToStart.id)
    setStartingAct(true)
    const begin = () => onStartAct(actToStart, import.meta.env.DEV ? devScene : undefined)
    if (reducedMotion) {
      begin()
      return
    }
    startTimer.current = window.setTimeout(begin, 850)
  }

  const completeAct = () => {
    if (!selectedAct || selectedAct.status !== 'available') return
    audioManager.play('starUnlock')
    onCompleteAct(selectedAct.id)
    setFlameActId(null)
  }

  return <main className="arc-map-screen knowledge-library-screen" aria-label={locale === 'en' ? `Knowledge Library: ${arc.title}` : `Biblioteca do Conhecimento: ${arc.title}`}>
    <div className="library-background" aria-hidden="true" style={{ backgroundImage: `url("${libraryBackgroundArtwork}")` }}/>
    <header className="arc-map-header library-header">
      <button className="arc-map-back" onClick={() => { if (!selectedAct) onBack() }} disabled={Boolean(selectedAct)} aria-label={backToProgress ? (locale === 'en' ? 'Back to progress' : 'Voltar ao progresso') : (locale === 'en' ? 'Back to constellation' : 'Voltar à constelação')}><ArrowLeft size={22}/></button>
      <div className="library-heading"><p>{locale === 'en' ? 'Arc:' : 'Arco:'} {arc.title}</p></div>
      <AudioControls/>
    </header>
    <LibraryShelf acts={acts} currentActId={flameActId ?? currentActId} onSelect={openAct} locale={locale}/>
    {selectedAct && <Parchment act={selectedAct} closing={closingParchment} onClose={closeParchment} onStart={startAct} onComplete={completeAct} starting={startingAct} locale={locale} devScene={devScene} onDevSceneChange={setDevScene}/ >}
  </main>
}
