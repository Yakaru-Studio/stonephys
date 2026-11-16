import { useEffect, useState } from 'react'
import { ArrowLeft, Check, X } from 'lucide-react'
import { constellations, type ConstellationConfig, type ConstellationStar } from './constellations'
import './constellation.css'
import AudioControls from './audio/AudioControls'
import { audioManager } from './audio/AudioManager'

const backgroundStars = [
  [73, 83], [164, 146], [265, 93], [352, 202], [426, 119], [553, 78], [642, 169], [827, 115],
  [905, 262], [90, 328], [209, 386], [335, 315], [478, 380], [763, 357], [876, 444], [127, 542],
  [254, 604], [389, 566], [618, 633], [842, 570], [89, 769], [198, 858], [390, 817], [556, 905],
  [727, 816], [913, 742], [796, 945], [325, 951], [578, 264], [40, 681],
]

function getStarState(starId: string, unlockedStarIds: string[], completedStarIds: string[]) {
  if (completedStarIds.includes(starId)) return 'completed'
  if (unlockedStarIds.includes(starId)) return 'active'
  return 'locked'
}

function connectionPath(from: ConstellationStar, to: ConstellationStar) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
}

function StarButton({ star, state, onSelect, onUnlock }: {
  star: ConstellationStar
  state: string
  onSelect: () => void
  onUnlock: () => void
}) {
  const isLocked = state === 'locked'
  const activate = isLocked ? onUnlock : onSelect
  return <g
    className={`constellation-star star-${state}`}
    transform={`translate(${star.x} ${star.y})`}
    role="button"
    aria-label={`${star.title}${isLocked ? ', bloqueada, clique para desbloquear' : state === 'completed' ? ', concluída' : ', desbloqueada'}`}
    aria-disabled={false}
    tabIndex={0}
    onClick={activate}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    }}
  >
    <circle className="star-halo" r={star.radius ? star.radius * 3.2 : 38} />
    <circle className="star-orbit" r={star.radius ? star.radius * 2 : 25} />
    <path className="star-rays" d="M0 -35V35M-35 0H35M-23 -23L23 23M23 -23L-23 23" />
    <path className="star-diamond" d="M0 -14L10 0L0 14L-10 0Z" />
    <circle className="star-core" r={star.radius ? Math.min(star.radius / 3, 5) : 4} />
    {state === 'completed' && <g className="star-completion-sigil" aria-hidden="true">
      <circle className="sigil-ring" r="8.5" />
      <path className="sigil-glyph" d="M0 -6L2 -2L6 0L2 2L0 6L-2 2L-6 0L-2 -2Z M0 -2V2M-11 0H-8M8 0H11M0 -11V-8M0 8V11" />
      <circle className="sigil-center" r="1.15" />
    </g>}
    {isLocked && <g className="star-lock" transform="translate(0 0) scale(.8)">
      <path d="M-5 -1V-5a5 5 0 0 1 10 0v4M-7 -1h14v11H-7zM0 3v3" />
    </g>}
    <circle className="star-hit-area" r="34" />
    <title>{star.title}</title>
  </g>
}

type CompactLayout = 'portrait' | 'landscape' | null

function ConstellationMap({ config, unlockedStarIds, completedStarIds, compactLayout, onSelectStar, onUnlockStar }: {
  config: ConstellationConfig
  unlockedStarIds: string[]
  completedStarIds: string[]
  compactLayout: CompactLayout
  onSelectStar: (star: ConstellationStar) => void
  onUnlockStar: (star: ConstellationStar) => void
}) {
  const renderedStars = compactLayout === 'portrait'
    ? config.stars.map((star) => ({ ...star, x: 500 + (star.x - 500) * 0.6 }))
    : compactLayout === 'landscape'
      ? config.stars.map((star) => ({ ...star, y: 500 + (star.y - 500) * 0.72 }))
      : config.stars
  const starById = new Map(renderedStars.map((star) => [star.id, star]))
  const revealedStars = new Set([...unlockedStarIds, ...completedStarIds])
  const isComplete = config.stars.every((star) => completedStarIds.includes(star.id))
  return <svg className="constellation-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label={`Constelação de ${config.name}`}>
    <g className="constellation-lines" aria-hidden="true">
      {isComplete && <g className="constellation-watermark">
        {config.moduleId === 'time' ? <g className="watermark-icon-time" transform="translate(500 500) scale(10 8)">
          <path className="watermark-icon-outline" d="M-19 -32h38M-16 -28v8c0 13 14 14 16 20-2 7-16 8-16 20v8M16 -28v8c0 13-14 14-16 20 2 7 16 8 16 20v8M-19 32h38" />
          <path className="watermark-icon-fill" d="M-12 -23h24c0 9-5 12-12 17-7-5-12-8-12-17m0 46h24c0-9-5-12-12-17-7 5-12 8-12 17" />
        </g> : config.moduleId === 'distance' ? <g transform="translate(500 500) rotate(-34)">
          <rect className="watermark-body" x="-150" y="-45" width="300" height="90" rx="8" />
          <path className="watermark-detail" d="M-115 -45V-5M-80 -45V-20M-45 -45V-5M-10 -45V-20M25 -45V-5M60 -45V-20M95 -45V-5M130 -45V-20" />
        </g> : <g transform="translate(500 500)">
          <path className="watermark-detail" d="M-150 -60H-40M-130 0H-30M-150 60H-40M-20 0H100M45 -55L105 0L45 55" />
        </g>}
      </g>}
      {config.edges.map((edge) => {
        const from = starById.get(edge.from)!
        const to = starById.get(edge.to)!
        if (!revealedStars.has(edge.from) || !revealedStars.has(edge.to)) return null
        const path = connectionPath(from, to)
        return <g className="constellation-connection" key={`${edge.from}-${edge.to}`}>
          <path className="connection-glow" d={path} />
          <path className="connection-line" d={path} pathLength="1" />
          <circle className="connection-pulse" r="4">
            <animateMotion dur="1.1s" path={path} fill="freeze" />
          </circle>
        </g>
      })}
    </g>
    {renderedStars.map((star) => <StarButton
      key={star.id}
      star={star}
      state={getStarState(star.id, unlockedStarIds, completedStarIds)}
      onSelect={() => onSelectStar(star)}
      onUnlock={() => onUnlockStar(star)}
    />)}
  </svg>
}

export default function ConstellationPage({ moduleId, unlockedStarIds, completedStarIds, onBack, onUnlockStar, onCompleteStar }: {
  moduleId: string
  unlockedStarIds: string[]
  completedStarIds: string[]
  onBack: () => void
  onUnlockStar: (starId: string) => void
  onCompleteStar: (starId: string) => void
}) {
  const config = constellations[moduleId]
  const [selectedStar, setSelectedStar] = useState<ConstellationStar | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [compactLayout, setCompactLayout] = useState<CompactLayout>(() => {
    if (typeof window === 'undefined') return null
    if (window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches) return 'portrait'
    if (window.matchMedia('(max-width: 1100px) and (max-height: 500px) and (orientation: landscape)').matches) return 'landscape'
    return null
  })
  const selectedIndex = selectedStar ? config.stars.findIndex((star) => star.id === selectedStar.id) : -1
  const selectedIsCompleted = selectedStar ? completedStarIds.includes(selectedStar.id) : false
  const isFinished = config.stars.every((star) => completedStarIds.includes(star.id))
  const revealedCount = new Set([...unlockedStarIds, ...completedStarIds]).size
  const lockedCount = config.stars.length - revealedCount

  useEffect(() => {
    if (!selectedStar) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedStar(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedStar])

  useEffect(() => {
    const portraitQuery = window.matchMedia('(max-width: 700px) and (orientation: portrait)')
    const landscapeQuery = window.matchMedia('(max-width: 1100px) and (max-height: 500px) and (orientation: landscape)')
    const updateLayout = () => setCompactLayout(portraitQuery.matches ? 'portrait' : landscapeQuery.matches ? 'landscape' : null)
    updateLayout()
    portraitQuery.addEventListener('change', updateLayout)
    landscapeQuery.addEventListener('change', updateLayout)
    return () => {
      portraitQuery.removeEventListener('change', updateLayout)
      landscapeQuery.removeEventListener('change', updateLayout)
    }
  }, [])

  const completeStage = () => {
    if (selectedStar) onCompleteStar(selectedStar.id)
    setSelectedStar(null)
  }

  const handleBack = () => {
    if (!isLeaving) {
      audioManager.play('navigation')
      setIsLeaving(true)
    }
  }

  return <main
    className={`constellation-screen ${isLeaving ? 'is-leaving' : ''}`}
    aria-label={`Constelação do módulo ${config.name}`}
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && isLeaving) onBack()
    }}
  >
    <svg className="constellation-sky" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="constellation-space"><stop stopColor="#111a28"/><stop offset=".62" stopColor="#09111c"/><stop offset="1" stopColor="#050910"/></radialGradient>
        <radialGradient id="constellation-nebula"><stop stopColor="#4f6c91" stopOpacity=".2"/><stop offset=".5" stopColor="#273d59" stopOpacity=".09"/><stop offset="1" stopColor="#182537" stopOpacity="0"/></radialGradient>
        <radialGradient id="constellation-warm"><stop stopColor="#b87332" stopOpacity=".13"/><stop offset=".52" stopColor="#71482f" stopOpacity=".05"/><stop offset="1" stopColor="#362a2b" stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#constellation-space)" />
      <ellipse cx="815" cy="485" rx="380" ry="500" fill="url(#constellation-nebula)" />
      <ellipse cx="120" cy="150" rx="310" ry="260" fill="url(#constellation-warm)" />
      <ellipse cx="850" cy="900" rx="350" ry="280" fill="url(#constellation-warm)" />
      {backgroundStars.map(([x, y], index) => <circle key={`${x}-${y}`} cx={x} cy={y} r={index % 7 === 0 ? 1.5 : .9} className={index % 7 === 0 ? 'sky-star sky-star-bright' : 'sky-star'} />)}
    </svg>

    <header className="constellation-header">
      <button className="constellation-back" onClick={handleBack} disabled={isLeaving} aria-label="Voltar aos módulos"><ArrowLeft size={19} /></button>
      <div className="constellation-heading">
        <p>CONSTELAÇÃO</p>
        <h1>{config.name}</h1>
        <span>{config.eyebrow}</span>
      </div>
      <div className="constellation-header-tools">
        <div className="constellation-count" aria-label={`${completedStarIds.length} de ${config.stars.length} etapas concluídas`}>
          <strong>{completedStarIds.length.toString().padStart(2, '0')}</strong><span> / {config.stars.length.toString().padStart(2, '0')}</span>
        </div>
        <AudioControls />
      </div>
    </header>

    <ConstellationMap config={config} unlockedStarIds={unlockedStarIds} completedStarIds={completedStarIds} compactLayout={compactLayout} onSelectStar={(star) => {
      audioManager.play('starSelect')
      setSelectedStar(star)
    }} onUnlockStar={(star) => onUnlockStar(star.id)} />

    <div className="constellation-footer" aria-live="polite">
      {isFinished ? 'Constelação completa' : `${lockedCount} estrelas ainda aguardam descoberta`}
      <div className="constellation-progress" aria-label={`${completedStarIds.length} de ${config.stars.length} etapas concluídas`}>
        {config.stars.map((star) => <span key={star.id} className={completedStarIds.includes(star.id) ? 'filled' : unlockedStarIds.includes(star.id) ? 'current' : ''} />)}
      </div>
    </div>

    {selectedStar && <div className="stage-backdrop" onClick={() => setSelectedStar(null)}>
      <section className="stage-panel" role="dialog" aria-modal="true" aria-labelledby="stage-title" onClick={(event) => event.stopPropagation()}>
        <button className="stage-close" onClick={() => setSelectedStar(null)} aria-label="Fechar etapa"><X size={18} /></button>
        <p className="stage-eyebrow">{selectedIsCompleted ? 'ETAPA CONCLUÍDA' : isFinished ? 'CONSTELAÇÃO COMPLETA' : `ETAPA ${String(selectedIndex + 1).padStart(2, '0')}`}</p>
        <h2 id="stage-title">{selectedStar.title}</h2>
        <p className="stage-description">{selectedStar.description}</p>
        {selectedIsCompleted || isFinished
          ? <div className="stage-completed"><Check size={16} /> Descoberta registrada</div>
          : <button className="stage-complete" onClick={completeStage}>Concluir etapa <span aria-hidden="true">↗</span></button>}
      </section>
    </div>}
  </main>
}
