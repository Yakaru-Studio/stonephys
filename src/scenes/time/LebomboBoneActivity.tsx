import { useEffect, useRef, useState } from 'react'
import type { SceneLocale } from '../sceneTypes'
import AudioControls from '../../audio/AudioControls'
import { audioManager } from '../../audio/AudioManager'
import engravingFlake from '../../assets/scenes/time/lebombo/engraving-flake-low-poly.png'
import './lebombo-bone-activity.css'

export const LEBOMBO_ACTIVITY_CONFIG = {
  minimumDays: 3,
  maximumDays: 10,
  dayDurationSeconds: 2,
  requiredCorrectRounds: 3,
  maximumMarks: 29,
  lunarCycleDays: 29.53,
} as const

const boneFrames = Object.entries(import.meta.glob('../../assets/scenes/time/lebombo/bone-engraving-frames/bone_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => src)

let preloadPromise: Promise<void> | null = null
export function preloadBoneFrames() {
  if (!preloadPromise) preloadPromise = Promise.all(boneFrames.map((src) => new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
  }))).then(() => undefined)
  return preloadPromise
}

type ActivityProps = {
  elapsed: number
  roundDays: number
  lunarStart: number
  roundId: number
  locale: SceneLocale
  onExit: () => void
  onRestartRound: (previousDays: number) => void
  onRoundEnded: () => void
  onComplete: () => void
}

export default function LebomboBoneActivity({ elapsed, roundDays, roundId, locale, onExit, onRestartRound, onRoundEnded, onComplete }: ActivityProps) {
  const english = locale === 'en'
  const [marks, setMarks] = useState<number[]>([])
  const [correctRounds, setCorrectRounds] = useState(0)
  const [incising, setIncising] = useState(false)
  const [result, setResult] = useState<'wrong' | 'correct' | 'complete' | null>(null)
  const incisingRef = useRef(false)
  const roundClosedRef = useRef(false)
  const evaluatedRef = useRef(false)
  const markDaysRef = useRef<number[]>([])
  const scoreRef = useRef(0)
  const roundDuration = roundDays * LEBOMBO_ACTIVITY_CONFIG.dayDurationSeconds

  useEffect(() => { void preloadBoneFrames() }, [])
  useEffect(() => {
    setMarks([])
    markDaysRef.current = []
    setResult(null)
    setIncising(false)
    incisingRef.current = false
    roundClosedRef.current = false
    evaluatedRef.current = false
  }, [roundId])

  useEffect(() => {
    if (elapsed < roundDuration || roundClosedRef.current) return
    roundClosedRef.current = true
    onRoundEnded()
    if (!incisingRef.current) evaluateRound()
  // evaluateRound is intentionally held in a ref so each round closes once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, roundDuration, roundId])

  function evaluateRound() {
    if (evaluatedRef.current) return
    evaluatedRef.current = true
    const correct = markDaysRef.current.length === roundDays
    if (!correct) {
      setResult('wrong')
      return
    }
    const nextScore = scoreRef.current + 1
    scoreRef.current = nextScore
    setCorrectRounds(nextScore)
    setResult(nextScore >= LEBOMBO_ACTIVITY_CONFIG.requiredCorrectRounds ? 'complete' : 'correct')
  }

  const incise = () => {
    if (roundClosedRef.current || result || incisingRef.current || marks.length >= LEBOMBO_ACTIVITY_CONFIG.maximumMarks) return
    incisingRef.current = true
    setIncising(true)
    void audioManager.resumeAudioContext().catch(() => {})
    // The frame swap lands at the stone's contact with the bone.
    window.setTimeout(() => {
      if (marks.length >= LEBOMBO_ACTIVITY_CONFIG.maximumMarks) return
      const markDay = Math.min(roundDays - 1, Math.floor(elapsed / LEBOMBO_ACTIVITY_CONFIG.dayDurationSeconds))
      markDaysRef.current = [...markDaysRef.current, markDay]
      setMarks((current) => [...current, markDay])
      void audioManager.playSoundEffectById('lebombo-bone-engraving', { restart: true }).catch(() => {})
    }, 185)
    window.setTimeout(() => {
      incisingRef.current = false
      setIncising(false)
      if (roundClosedRef.current) evaluateRound()
    }, 540)
  }

  const continueRound = () => {
    if (result === 'complete') {
      onComplete()
      return
    }
    onRestartRound(roundDays)
  }

  return <section className="lebombo-bone-activity" aria-label={english ? 'Bone activity' : 'Atividade do osso'}>
    <div className="lebombo-bone-vignette" aria-hidden="true"/>
    <button className="lebombo-activity-exit" type="button" onClick={onExit} aria-label={english ? 'Exit activity' : 'Sair da atividade'}>‹</button>
    <div className="historical-scene-audio-control"><AudioControls/></div>
    <p className="lebombo-mark-count" aria-live="polite">{english ? 'Marks' : 'Marcas'}: {marks.length}</p>
    <div className="lebombo-round-progress" aria-label={english ? `Rounds completed: ${correctRounds} of 3` : `Rodadas corretas: ${correctRounds} de 3`}>
      {[0, 1, 2].map((index) => <i key={index} className={index < correctRounds ? 'is-filled' : ''}/>) }
    </div>
    <div className={`lebombo-marking-stage ${incising ? 'is-incising' : ''}`}>
      <button className="lebombo-bone-target" type="button" onClick={incise} disabled={roundClosedRef.current || !!result || incising || marks.length >= LEBOMBO_ACTIVITY_CONFIG.maximumMarks} aria-label={english ? 'Make an incision in the bone' : 'Fazer uma incisão no osso'}>
        <img className="lebombo-bone-image" src={boneFrames[Math.min(marks.length, LEBOMBO_ACTIVITY_CONFIG.maximumMarks)]} alt="" draggable={false}/>
      </button>
      <img className="lebombo-engraving-flake" src={engravingFlake} alt="" draggable={false}/>
    </div>
    {result && <div className="lebombo-result-overlay" role="dialog" aria-modal="true" aria-labelledby="lebombo-result-title">
      <div className="lebombo-result-card">
        <h1 id="lebombo-result-title">{result === 'wrong'
          ? (english ? 'Something is not right...' : 'Algo não está certo...')
          : result === 'complete' ? (english ? 'You did it!' : 'Você conseguiu!')
            : (english ? 'Well done!' : 'Muito bem!')}</h1>
        {result === 'wrong' && <p>{english ? 'Observe the sky carefully and try again.' : 'Observe atentamente o céu e tente novamente.'}</p>}
        <button type="button" onClick={continueRound}>{result === 'wrong' ? (english ? 'Try again' : 'Tentar novamente') : (english ? 'Continue' : 'Continuar')}</button>
      </div>
    </div>}
  </section>
}
