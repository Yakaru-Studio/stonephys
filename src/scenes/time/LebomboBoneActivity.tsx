import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AudioLines, CheckCircle2, CircleAlert, Flag, Info, LibraryBig, RotateCcw, SkipForward, Speech, TrendingUp, Trophy, X } from 'lucide-react'
import type { SceneLocale } from '../sceneTypes'
import AudioControls from '../../audio/AudioControls'
import { audioManager } from '../../audio/AudioManager'
import { readScientificNotes, recordScientificNoteRead } from '../../scientificNotes'
import { achievementImage, getAchievementGroups } from '../../contentCatalog'
import engravingFlake from '../../assets/scenes/time/lebombo/engraving-flake-low-poly.png'
import trophyLebomboBone from '../../assets/achievements/conquistas/osso_de_lebombo.png'
import trophyFlakedStone from '../../assets/achievements/conquistas/pedra_lascada.png'
import trophyCounting from '../../assets/achievements/conquistas/contagem.png'
import trophyFirstStep from '../../assets/achievements/conquistas/o_primeiro_passo.png'
import trophyCuriousMind from '../../assets/achievements/conquistas/mente_curiosa.png'
import successMusic from '../../../content/music/a-future-among-the-stars/composition.json'
import './lebombo-bone-activity.css'
import TaskSuccessModal from './TaskSuccessModal'
import AllAchievementsModal from './AllAchievementsModal'

type SuccessMusicLoop = Omit<typeof successMusic.loop, 'endSeconds'> & { endSeconds: number | null }
type SuccessMusic = Omit<typeof successMusic, 'loop' | 'previewLoop'> & {
  loop: SuccessMusicLoop
  approvedAssetUrl?: string
  approvedCropStartSeconds?: number
  approvedCropEndSeconds?: number | null
  approvedVolume?: number
  approvedLoop?: SuccessMusicLoop
}

const LEBOMBO_SUCCESS_NARRATION_URL = '/audio/narration/pt-BR/time/lebombo-success/lebombo-success-act-1.wav'
const BORDER_CAVE_ANIMAL_EFFECTS = [
  'border-cave-crested-francolin',
  'border-cave-ring-necked-dove',
  'border-cave-natal-spurfowl',
  'border-cave-chacma-baboon',
  'border-cave-plains-zebra',
] as const

export const LEBOMBO_ACTIVITY_CONFIG = {
  minimumDays: 3,
  maximumDays: 7,
  dayDurationSeconds: 12,
  requiredCorrectRounds: 1,
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
  moonriseOffset: number
  roundId: number
  ready: boolean
  locale: SceneLocale
  onExit: () => void
  onRestartRound: (previousDays: number) => void
  onRoundEnded: () => void
  onComplete: () => void
  onRestartAct: () => void
  onNextAct?: () => void
}

export default function LebomboBoneActivity({ elapsed, roundDays, roundId, ready, locale, onExit, onRestartRound, onRoundEnded, onComplete, onRestartAct, onNextAct }: ActivityProps) {
  const english = locale === 'en'
  const [marks, setMarks] = useState<number[]>([])
  const [incising, setIncising] = useState(false)
  const [result, setResult] = useState<'wrong' | 'correct' | 'complete' | null>(null)
  const [completionStep, setCompletionStep] = useState<'task' | 'act' | 'success' | null>(null)
  const [successTab, setSuccessTab] = useState<'story' | 'info' | 'achievements' | 'advanced-achievements' | 'references'>('story')
  const [readSuccessTabs, setReadSuccessTabs] = useState<Set<'story' | 'info' | 'achievements' | 'advanced-achievements' | 'references'>>(() => new Set(['story']))
  const [showAchievementSequence, setShowAchievementSequence] = useState(false)
  const [achievementIndex, setAchievementIndex] = useState(0)
  const [showAllAchievements, setShowAllAchievements] = useState(false)
  const [hasReadScientificNote, setHasReadScientificNote] = useState(() => readScientificNotes().length > 0)
  const incisingRef = useRef(false)
  const roundClosedRef = useRef(false)
  const evaluatedRef = useRef(false)
  const markDaysRef = useRef<number[]>([])
  const scoreRef = useRef(0)
  const roundDuration = roundDays * LEBOMBO_ACTIVITY_CONFIG.dayDurationSeconds
  const successAchievements = [
    { id: 'lebombo-bone', icon: trophyLebomboBone, title: english ? 'Lebombo Bone' : 'Osso de Lebombo', description: english ? 'A baboon fibula used to record counts.' : 'Fíbula de babuíno usada para registrar contagens.' },
    { id: 'flaked-stone', icon: trophyFlakedStone, title: english ? 'Flaked Stone' : 'Pedra Lascada', description: english ? 'A tool used to cut materials and make incisions.' : 'Ferramenta utilizada para cortar materiais e produzir incisões.' },
    { id: 'counting', icon: trophyCounting, title: english ? 'Counting' : 'Contagem', description: english ? 'Humanity learned to count, establishing one of the foundations of mathematics and scientific knowledge.' : 'A humanidade aprendeu a contar, estabelecendo um dos fundamentos da matemática e do conhecimento científico.' },
    { id: 'first-step', icon: trophyFirstStep, title: english ? 'The First Step' : 'O Primeiro Passo', description: english ? 'Complete your first interactive activity.' : 'Conclua sua primeira atividade interativa.' },
    ...(hasReadScientificNote ? [{ id: 'curious-mind', icon: trophyCuriousMind, title: english ? 'Curious Mind' : 'Mente Curiosa', description: english ? 'Read your first scientific note.' : 'Leia sua primeira nota científica.' }] : []),
  ]
  const achievementGroups = getAchievementGroups(locale, ['counting-marks'], readScientificNotes().length)
  const earnedAchievementGroups = achievementGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.earned) })).filter((group) => group.items.length > 0)
  const advancedAchievementGroups = achievementGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.earned && item.progress > 0) })).filter((group) => group.items.length > 0)
  const allVisibleAchievementGroups = achievementGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.earned || item.progress > 0) })).filter((group) => group.items.length > 0)

  useEffect(() => { void preloadBoneFrames() }, [])
  useEffect(() => {
    if (result !== 'complete' || completionStep !== 'success') return
    const controller = new AbortController()
    audioManager.stopMusicImmediately()
    audioManager.pauseNaturalAmbience()
    audioManager.stopSoundEffectsById(BORDER_CAVE_ANIMAL_EFFECTS)

    const playSuccessMusic = async () => {
      const composition: SuccessMusic = successMusic
      audioManager.setNarrationMusicLevel(composition.ducking.musicLevelDuringNarration)
      if (!composition.approvedAssetUrl) return
      await audioManager.playMusicAsset(composition.approvedAssetUrl, {
        fadeMs: 0,
        loop: true,
        loopCrossfadeMs: (composition.approvedLoop ?? composition.loop).crossfadeMs,
        trackGain: composition.defaultVolume,
        volume: composition.approvedVolume,
        cropStartSeconds: composition.approvedCropStartSeconds,
        cropEndSeconds: composition.approvedCropEndSeconds,
        signal: controller.signal,
      })
    }
    const playSuccessNarration = async () => {
      if (!controller.signal.aborted && !english) {
        await audioManager.playNarration(LEBOMBO_SUCCESS_NARRATION_URL, controller.signal)
      }
    }
    void Promise.allSettled([playSuccessMusic(), playSuccessNarration()])
    return () => {
      controller.abort()
      audioManager.stopMusicImmediately()
      if (!english) audioManager.stopNarration()
    }
  }, [completionStep, english, result])
  useEffect(() => {
    setMarks([])
    markDaysRef.current = []
    setResult(null)
    setCompletionStep(null)
    setIncising(false)
    incisingRef.current = false
    roundClosedRef.current = false
    evaluatedRef.current = false
  }, [roundId])

  useEffect(() => {
    if (!ready || elapsed < roundDuration || roundClosedRef.current) return
    roundClosedRef.current = true
    onRoundEnded()
    if (!incisingRef.current) evaluateRound()
  // evaluateRound is intentionally held in a ref so each round closes once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, ready, roundDuration, roundId])

  function evaluateRound() {
    if (evaluatedRef.current) return
    evaluatedRef.current = true
    const correct = markDaysRef.current.length === roundDays
    if (!correct) {
      void audioManager.playSoundEvent('task.failure').catch(() => {})
      setResult('wrong')
      return
    }
    const nextScore = scoreRef.current + 1
    scoreRef.current = nextScore
    if (nextScore >= LEBOMBO_ACTIVITY_CONFIG.requiredCorrectRounds) {
      setSuccessTab('story')
      void audioManager.playSuccessCue()
      setCompletionStep('task')
      setResult('complete')
    } else setResult('correct')
  }

  const incise = () => {
    if (!ready || roundClosedRef.current || result || incisingRef.current || marks.length >= LEBOMBO_ACTIVITY_CONFIG.maximumMarks) return
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
  const restartActivity = () => {
    if (incisingRef.current) return
    if (result === 'complete') {
      scoreRef.current = Math.max(0, scoreRef.current - 1)
    }
    setMarks([])
    markDaysRef.current = []
    setResult(null)
    setCompletionStep(null)
    setShowAchievementSequence(false)
    setAchievementIndex(0)
    setReadSuccessTabs(new Set(['story']))
    onRestartRound(roundDays)
  }
  const skipToSuccess = () => {
    roundClosedRef.current = true
    evaluatedRef.current = true
    scoreRef.current = LEBOMBO_ACTIVITY_CONFIG.requiredCorrectRounds
    setSuccessTab('story')
    setReadSuccessTabs(new Set(['story']))
    setResult('complete')
    setCompletionStep('task')
    setShowAchievementSequence(false)
    setAchievementIndex(0)
    onRoundEnded()
  }
  const openSuccessTab = (tab: 'story' | 'info' | 'achievements' | 'advanced-achievements' | 'references') => {
    setSuccessTab(tab)
    setReadSuccessTabs((current) => new Set(current).add(tab))
    if (tab === 'info') recordScientificNoteRead('lebombo-artifact-note')
    if (tab === 'references') recordScientificNoteRead('lebombo-reference-list')
    if (tab === 'info' || tab === 'references') setHasReadScientificNote(readScientificNotes().length > 0)
  }
  const beginAchievementSequence = () => {
    audioManager.stopNarration()
    setAchievementIndex(0)
    setShowAchievementSequence(true)
  }
  const openAllAchievements = () => {
    setShowAllAchievements(true)
    void audioManager.play('achievementReveal')
  }
  const advanceAchievementSequence = () => {
    if (achievementIndex < successAchievements.length - 1) setAchievementIndex((index) => index + 1)
    else (onNextAct ?? onComplete)()
  }
  const advanceCompletion = () => {
    if (completionStep === 'task') {
      void audioManager.playSuccessCue()
      setCompletionStep('act')
    }
    else if (completionStep === 'act') setCompletionStep('success')
  }
  const replaySuccessNarration = () => {
    if (english) return
    audioManager.stopNarration()
    void audioManager.playNarration(LEBOMBO_SUCCESS_NARRATION_URL).catch(() => {})
  }

  return <section className="lebombo-bone-activity" aria-label={english ? 'Bone activity' : 'Atividade do osso'}>
    <div className="lebombo-bone-vignette" aria-hidden="true"/>
    <button className="lebombo-activity-exit" type="button" onClick={onExit} aria-label={english ? 'Exit activity' : 'Sair da atividade'}>‹</button>
    <button className="lebombo-activity-restart" type="button" onClick={restartActivity} disabled={incising} aria-label={english ? 'Restart activity' : 'Reiniciar atividade'} title={english ? 'Restart activity' : 'Reiniciar atividade'}><RotateCcw size={17}/></button>
    <div className="historical-scene-audio-control"><AudioControls/></div>
    <p className="lebombo-action-prompt">{english ? 'Mark the bone every time you see the moon rise in the sky' : 'Marque o osso toda vez que ver a lua subir no céu'}</p>
    {marks.length === 0 && !result && <div className="lebombo-bone-first-mark-hint" role="status">{english ? 'Click the bone to make marks' : 'Clique em cima do osso para fazer as marcações'}</div>}
    <p className="lebombo-mark-count" aria-live="polite">{english ? 'Marks' : 'Marcas'}: {marks.length}</p>
    <div className={`lebombo-marking-stage ${incising ? 'is-incising' : ''}`}>
      <button className="lebombo-bone-target" type="button" onClick={incise} disabled={!ready || roundClosedRef.current || !!result || incising || marks.length >= LEBOMBO_ACTIVITY_CONFIG.maximumMarks} aria-label={english ? 'Make an incision in the bone' : 'Fazer uma incisão no osso'}>
        <img className="lebombo-bone-image" src={boneFrames[Math.min(marks.length, LEBOMBO_ACTIVITY_CONFIG.maximumMarks)]} alt="" draggable={false}/>
      </button>
      <img className="lebombo-engraving-flake" src={engravingFlake} alt="" draggable={false}/>
    </div>
    {import.meta.env.DEV && <button className="lebombo-dev-success" type="button" onClick={skipToSuccess}>{english ? 'Skip to success' : 'Pular para o sucesso'}</button>}
    {result === 'complete' && completionStep === 'task' && <TaskSuccessModal
      english={english}
      titleId="lebombo-bone-task-success-title"
      kicker={english ? 'Task completed' : 'Tarefa concluída'}
      title={english ? 'Mark the Lebombo bone' : 'Marcação do osso de Lebombo'}
      description={english ? 'You recorded the days of the lunar cycle with marks on the bone.' : 'Você registrou os dias do ciclo lunar com marcas no osso.'}
      continueLabel={english ? 'Continue' : 'Avançar'}
      onContinue={advanceCompletion}
      restartLabel={english ? 'Restart task' : 'Reiniciar tarefa'}
      onRestart={restartActivity}
    />}
    {result === 'complete' && completionStep === 'act' && <TaskSuccessModal
      english={english}
      titleId="lebombo-act-success-title"
      kicker={english ? 'Act completed' : 'Ato concluído'}
      title={english ? 'The Lebombo Bone' : 'O osso de Lebombo'}
      description={english ? 'Arc I · The Gods of Light and Darkness' : 'Arco I · Os Deuses da Luz e Escuridão'}
      continueLabel={english ? 'Continue' : 'Avançar'}
      onContinue={advanceCompletion}
      icon={<Flag size={42} aria-hidden="true"/>}
    />}
    {result && !(result === 'complete' && (completionStep === 'task' || completionStep === 'act')) && <div className="lebombo-result-overlay" role="dialog" aria-modal="true" aria-labelledby="lebombo-result-title">
      {result === 'complete' ? <section className={`lebombo-result-card lebombo-success-card ${showAchievementSequence ? 'is-achievement-reveal' : ''}`}>
        {showAchievementSequence ? <>
          <div className="lebombo-achievement-reveal" key={successAchievements[achievementIndex].id}>
            <span className="lebombo-achievement-reveal-kicker"><CheckCircle2 size={16} aria-hidden="true"/>{english ? 'Achievement unlocked' : 'Conquista desbloqueada'}</span>
            <img className="lebombo-achievement-reveal-icon" src={successAchievements[achievementIndex].icon} alt=""/>
            <h1 id="lebombo-result-title">{successAchievements[achievementIndex].title}</h1>
            <p>{successAchievements[achievementIndex].description}</p>
            <button type="button" className="lebombo-view-all-achievements" onClick={openAllAchievements}>{english ? 'View all achievements' : 'Ver todas as conquistas'}</button>
            <span className="lebombo-achievement-reveal-count">{achievementIndex + 1} / {successAchievements.length}</span>
          </div>
          <footer className="lebombo-success-actions lebombo-achievement-reveal-actions">
            {achievementIndex === 0 && <button type="button" onClick={() => setAchievementIndex(successAchievements.length - 1)}><SkipForward size={16} aria-hidden="true"/>{english ? 'Skip all' : 'Pular todas'}</button>}
            {achievementIndex === successAchievements.length - 1 && <button type="button" onClick={onComplete}><X size={16} aria-hidden="true"/>{english ? 'Exit' : 'Sair'}</button>}
            <button type="button" className="is-primary" onClick={advanceAchievementSequence}>{english ? (achievementIndex === successAchievements.length - 1 ? 'Next Act' : 'Continue') : (achievementIndex === successAchievements.length - 1 ? 'Próximo Ato' : 'Avançar')}<ArrowRight size={17} aria-hidden="true"/></button>
          </footer>
          {showAllAchievements && <AllAchievementsModal groups={allVisibleAchievementGroups} english={english} onClose={() => setShowAllAchievements(false)}/>}
        </> : <>
        <nav className="lebombo-success-tabs" role="tablist" aria-orientation="vertical" aria-label={english ? 'Success message sections' : 'Seções da mensagem de sucesso'}>
          <button type="button" role="tab" aria-selected={successTab === 'story'} aria-controls="lebombo-success-message" id="lebombo-success-story-tab" className={successTab === 'story' ? 'is-active' : ''} onClick={() => openSuccessTab('story')} aria-label={english ? 'Narrator message' : 'Mensagem do narrador'} title={english ? 'Narrator message' : 'Mensagem do narrador'}><AudioLines size={21}/></button>
          <button type="button" role="tab" aria-selected={successTab === 'info'} aria-controls="lebombo-success-message" id="lebombo-success-info-tab" className={successTab === 'info' ? 'is-active' : ''} onClick={() => openSuccessTab('info')} aria-label={english ? 'Artifact information' : 'Informações sobre o artefato'} title={english ? 'Artifact information' : 'Informações sobre o artefato'}><Info size={21}/>{!readSuccessTabs.has('info') && <CircleAlert className="lebombo-tab-unread" size={15} aria-hidden="true"/>}</button>
          <button type="button" role="tab" aria-selected={successTab === 'achievements'} aria-controls="lebombo-success-message" id="lebombo-success-achievements-tab" className={successTab === 'achievements' ? 'is-active' : ''} onClick={() => openSuccessTab('achievements')} aria-label={english ? 'Achievements conquered' : 'Conquistas conquistadas'} title={english ? 'Achievements conquered' : 'Conquistas conquistadas'}><Trophy size={21}/>{!readSuccessTabs.has('achievements') && <CircleAlert className="lebombo-tab-unread" size={15} aria-hidden="true"/>}</button>
          <button type="button" role="tab" aria-selected={successTab === 'advanced-achievements'} aria-controls="lebombo-success-message" id="lebombo-success-advanced-achievements-tab" className={successTab === 'advanced-achievements' ? 'is-active' : ''} onClick={() => openSuccessTab('advanced-achievements')} aria-label={english ? 'Achievements in progress' : 'Conquistas avançadas'} title={english ? 'Achievements in progress' : 'Conquistas avançadas'}><TrendingUp size={21}/>{!readSuccessTabs.has('advanced-achievements') && <CircleAlert className="lebombo-tab-unread" size={15} aria-hidden="true"/>}</button>
          <button type="button" role="tab" aria-selected={successTab === 'references'} aria-controls="lebombo-success-message" id="lebombo-success-references-tab" className={successTab === 'references' ? 'is-active' : ''} onClick={() => openSuccessTab('references')} aria-label={english ? 'Bibliographic references' : 'Referências bibliográficas'} title={english ? 'Bibliographic references' : 'Referências bibliográficas'}><LibraryBig size={21}/>{!readSuccessTabs.has('references') && <CircleAlert className="lebombo-tab-unread" size={15} aria-hidden="true"/>}</button>
        </nav>
        <div className="lebombo-success-main">
          <div id="lebombo-success-message" className={`lebombo-success-message ${successTab === 'achievements' || successTab === 'advanced-achievements' ? 'is-achievements' : ''}`} role="tabpanel" aria-labelledby={successTab === 'story' ? 'lebombo-success-story-tab' : successTab === 'info' ? 'lebombo-success-info-tab' : successTab === 'achievements' ? 'lebombo-success-achievements-tab' : successTab === 'advanced-achievements' ? 'lebombo-success-advanced-achievements-tab' : 'lebombo-success-references-tab'} tabIndex={0}>
            {successTab === 'story' ? <>
              <h1 id="lebombo-result-title">{english ? 'You did it!' : 'Você conseguiu!'}</h1>
              <p>{english
                ? 'Extraordinary, isn’t it? A small bone, a few marks... and an idea that would endure for millennia. Humanity learned to count, and from that simple act something extraordinary would blossom: mathematics, the language we use to try to understand the universe.'
                : 'Extraordinário, não acha? Um pequeno osso, algumas marcas... e uma ideia que atravessaria milênios. A humanidade aprendeu a contar, e desse simples gesto floresceria algo extraordinário: a matemática, a linguagem com a qual buscamos compreender o universo.'}</p>
              <p>{english
                ? 'Recognizing patterns in nature was essential to everything that came next.'
                : 'Reconhecer padrões na natureza foi essencial para tudo o que viria depois.'}</p>
              <p>{english
                ? 'And to think we’re only getting started! Shall we find out how far this idea can take us?'
                : 'E pensar que estamos apenas começando! Vamos descobrir até onde essa ideia pode nos levar?'}</p>
              {!english && <div className="lebombo-success-replay-corner"><button type="button" className="lebombo-success-replay" onClick={replaySuccessNarration} aria-label="Ouvir narração novamente" title="Ouvir narração novamente"><Speech size={18} aria-hidden="true"/></button></div>}
            </> : successTab === 'info' ? <>
              <h1 id="lebombo-result-title">{english ? 'The Lebombo bone' : 'O osso de Lebombo'}</h1>
              {english ? <>
                <p>Found at Border Cave, near the Lebombo Mountains, this baboon fibula fragment bears 29 intentional incisions.</p>
                <p>One hypothesis is that the marks were used to track the passage of days or the phases of the Moon, whose cycle lasts about 29.5 days.</p>
                <p>Its true purpose, however, remains unknown. The incisions may also represent other forms of counting or record keeping.</p>
                <p>Whatever its original function, the artifact shows that people made material records long before writing emerged.</p>
                <p>In the experience you just completed, we explored one possible use: recording the passage of time with marks.</p>
              </> : <>
                <p>Encontrado em Border Cave, nas proximidades das montanhas Lebombo, este fragmento de fíbula de babuíno apresenta 29 incisões produzidas intencionalmente.</p>
                <p>Uma das hipóteses é que essas marcas tenham sido utilizadas para acompanhar a passagem dos dias ou as fases da Lua, cujo ciclo dura aproximadamente 29,5 dias.</p>
                <p>Entretanto, sua verdadeira finalidade permanece desconhecida. As incisões também poderiam representar outras formas de contagem ou registro.</p>
                <p>Independentemente de sua função original, o artefato revela a capacidade humana de produzir registros materiais muito antes do surgimento da escrita.</p>
                <p>Na experiência que você acabou de vivenciar, exploramos uma de suas possíveis utilizações: registrar a passagem do tempo por meio de marcas.</p>
              </>}
            </> : successTab === 'achievements' || successTab === 'advanced-achievements' ? <>
              <h1 id="lebombo-result-title">{successTab === 'achievements' ? (english ? 'Achievements conquered' : 'Conquistas conquistadas') : (english ? 'Achievements in progress' : 'Conquistas avançadas')}</h1>
              <p className="lebombo-achievement-tab-description">{successTab === 'achievements'
                ? (english ? 'Achievements already unlocked.' : 'Conquistas que já foram desbloqueadas.')
                : (english ? 'Achievements with progress underway.' : 'Conquistas que já têm progresso iniciado.')}</p>
              <div className="lebombo-success-achievement-categories">
                {(successTab === 'achievements' ? earnedAchievementGroups : advancedAchievementGroups).map((group) => <section key={group.id}>
                  <h2 className="lebombo-achievement-section-title"><img src={achievementImage('categorias', group.icon)} alt=""/>{group.title}</h2>
                  <div className="lebombo-achievement-grid">
                    {group.items.map((item) => <article className={`lebombo-achievement-item ${item.masked ? 'is-masked' : ''}`} key={item.id}>
                      <img src={achievementImage('conquistas', item.icon)} alt=""/>
                      <span>{item.masked ? (english ? 'Hidden achievement' : 'Conquista oculta') : item.title}</span>
                      {!item.masked && item.description && <small>{item.description}</small>}
                      {item.earned ? <small>{english ? 'Unlocked' : 'Conquistada'}</small> : <span className="lebombo-success-achievement-progress"><i style={{ width: `${item.progress * 100}%` }}/></span>}
                    </article>)}
                  </div>
                </section>)}
                {(successTab === 'achievements' ? earnedAchievementGroups : advancedAchievementGroups).length === 0 && <p className="lebombo-achievement-empty">{successTab === 'achievements'
                  ? (english ? 'No achievements unlocked yet.' : 'Ainda não há conquistas desbloqueadas.')
                  : (english ? 'No achievements have progress yet.' : 'Ainda não há conquistas com progresso iniciado.')}</p>}
              </div>
            </> : <>
              <h1 id="lebombo-result-title">{english ? 'Bibliographic references' : 'Referências bibliográficas'}</h1>
              {english ? <>
                <p><strong>Bogoshi, J., Naidoo, K. &amp; Webb, J. (1987).</strong> “The oldest mathematical artefact.” <em>The Mathematical Gazette, 71</em>(458), 294.</p>
                <p><strong>d’Errico, F. et al. (2018).</strong> <a href="https://doi.org/10.1098/rstb.2016.0518" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('derrico-number-symbols')}>“From number sense to number symbols: An archaeological perspective.”</a> <em>Philosophical Transactions of the Royal Society B, 373.</em></p>
                <p><strong>Overmann, K. A. (2024).</strong> <a href="https://doi.org/10.1017/S0959774324000106" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('overmann-beginning-time')}>“The Beginning of Time.”</a> <em>Cambridge Archaeological Journal, 34</em>(4), 693–709.</p>
                <p><strong>Collins, B. (2016).</strong> <a href="https://doi.org/10.1016/j.jasrep.2015.10.035" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('collins-foraging-sibudu')}>“Foraging strategies during the final Middle Stone Age occupation at Sibudu Cave, South Africa.”</a> <em>Journal of Archaeological Science: Reports, 5</em>, 61–70. p. 67, Table 6.</p>
              </> : <>
                <p><strong>Bogoshi, J., Naidoo, K. &amp; Webb, J. (1987).</strong> “The oldest mathematical artefact.” <em>The Mathematical Gazette, 71</em>(458), 294.</p>
                <p><strong>d’Errico, F. et al. (2018).</strong> <a href="https://doi.org/10.1098/rstb.2016.0518" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('derrico-number-symbols')}>“From number sense to number symbols: An archaeological perspective.”</a> <em>Philosophical Transactions of the Royal Society B, 373.</em></p>
                <p><strong>Overmann, K. A. (2024).</strong> <a href="https://doi.org/10.1017/S0959774324000106" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('overmann-beginning-time')}>“The Beginning of Time.”</a> <em>Cambridge Archaeological Journal, 34</em>(4), 693–709.</p>
                <p><strong>Collins, B. (2016).</strong> <a href="https://doi.org/10.1016/j.jasrep.2015.10.035" target="_blank" rel="noreferrer" onClick={() => recordScientificNoteRead('collins-foraging-sibudu')}>“Foraging strategies during the final Middle Stone Age occupation at Sibudu Cave, South Africa.”</a> <em>Journal of Archaeological Science: Reports, 5</em>, 61–70. p. 67, tabela 6.</p>
              </>}
            </>}
          </div>
          <footer className="lebombo-success-actions">
            <button type="button" onClick={onRestartAct} aria-label={english ? 'Restart the act from scene 1' : 'Reiniciar o ato desde a cena 1'} title={english ? 'Restart the act from scene 1' : 'Reiniciar o ato desde a cena 1'}><RotateCcw size={16} aria-hidden="true"/>{english ? 'Restart act' : 'Reiniciar ato'}</button>
            <button type="button" className="is-primary" onClick={beginAchievementSequence}>{english ? 'Continue' : 'Avançar'}<ArrowRight size={17} aria-hidden="true"/></button>
          </footer>
        </div>
        </>}
      </section> : <div className="lebombo-result-card">
        <h1 id="lebombo-result-title">{result === 'wrong'
          ? (english ? 'Something is not right...' : 'Algo não está certo...')
          : (english ? 'Well done!' : 'Muito bem!')}</h1>
        {result === 'wrong' && <p>{english ? 'Observe the sky carefully and try again.' : 'Observe atentamente o céu e tente novamente.'}</p>}
        <button type="button" onClick={continueRound}>{result === 'wrong' ? (english ? 'Try again' : 'Tentar novamente') : (english ? 'Continue' : 'Continuar')}</button>
      </div>}
    </div>}
  </section>
}
