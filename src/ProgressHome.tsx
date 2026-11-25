import { ArrowRight, BookOpen, Layers3, RotateCcw, Sparkles } from 'lucide-react'
import AudioControls from './audio/AudioControls'
import { contentCatalog } from './contentCatalog'
import { type AppLocale } from './i18n'
import type { ArcLocation } from './gameProgress'

const { arcs: learningArcs, constellations, modules: initialModules } = contentCatalog

type StarProgress = { unlocked: string[]; completed: string[] }

export default function ProgressHome({ locale, completedActs, stageProgress, moduleProgress, lastArc, onContinue, onStartJourney, onResetProgress }: {
  locale: AppLocale
  completedActs: Record<string, string[]>
  stageProgress: Record<string, StarProgress>
  moduleProgress: Record<string, number>
  lastArc: ArcLocation | null
  onContinue: () => void
  onStartJourney: () => void
  onResetProgress?: () => void
}) {
  const english = locale === 'en'
  const implementedActIds = new Set(['counting-marks'])
  const completedModuleIds = initialModules.filter((module) => {
    const stars = constellations[module.id]?.stars ?? []
    return (moduleProgress[module.id] ?? 0) >= 100 || (stars.length > 0 && stars.every((star) => stageProgress[module.id]?.completed.includes(star.id)))
  }).map((module) => module.id)
  const unlockedModules = initialModules.filter((module) => module.status === 'unlocked' || (module.requires.length > 0 && module.requires.every((required) => completedModuleIds.includes(required))))
  const modulesCompleted = unlockedModules.filter((module) => completedModuleIds.includes(module.id)).length
  const reachableModuleIds = new Set(unlockedModules.map((module) => module.id))
  const reachableStars = Object.values(constellations).flatMap((config) => {
    if (!reachableModuleIds.has(config.moduleId)) return []
    const state = stageProgress[config.moduleId] ?? { unlocked: [], completed: [] }
    const validUnlocked = config.stars.filter((star) => state.unlocked.includes(star.id) || state.completed.includes(star.id))
    return validUnlocked.length ? validUnlocked.map((star) => ({ moduleId: config.moduleId, star })) : config.stars.slice(0, 1).map((star) => ({ moduleId: config.moduleId, star }))
  })
  const arcsCompleted = reachableStars.filter(({ moduleId, star }) => stageProgress[moduleId]?.completed.includes(star.id)).length
  const actsAvailable = Object.values(learningArcs).filter((arc) => reachableModuleIds.has(arc.moduleId)).flatMap((arc) => arc.acts
    .filter((act) => implementedActIds.has(act.id) && act.prerequisites.every((id) => completedActs[arc.moduleId]?.includes(id)))
    .map((act) => ({ moduleId: arc.moduleId, act })))
  const actsCompleted = actsAvailable.filter(({ moduleId, act }) => completedActs[moduleId]?.includes(act.id)).length
  const totalAvailable = unlockedModules.length + reachableStars.length + actsAvailable.length
  const totalCompleted = modulesCompleted + arcsCompleted + actsCompleted
  const journeyPercent = totalAvailable ? Math.round(totalCompleted / totalAvailable * 100) : 0
  const hasProgress = Boolean(lastArc)
    || Object.values(moduleProgress).some((value) => value > 0)
    || Object.values(stageProgress).some((state) => state.completed.length > 0)
    || Object.values(completedActs).some((actIds) => actIds.length > 0)

  return <main className="progress-home">
    <div className="progress-home-content">
      <header className="progress-home-heading">
        <h1>Sharp Stone</h1>
        <AudioControls/>
      </header>
      <section className="journey-card" aria-label={english ? 'Overall progress' : 'Progresso geral'}>
        <div className="journey-total">
          <span>{english ? 'Journey overview' : 'Visão da jornada'}</span>
          <strong>{journeyPercent}%</strong>
          <progress max={totalAvailable || 1} value={totalCompleted} aria-label={english ? 'Overall journey progress' : 'Progresso geral da jornada'}/>
        </div>
        <dl className="journey-stats journey-stats-no-modules">
          <div><dt><Layers3 size={16} aria-hidden="true"/>{english ? 'Modules completed' : 'Módulos concluídos'}</dt><dd>{modulesCompleted}<small> / {unlockedModules.length}</small></dd></div>
          <div><dt><Sparkles size={16} aria-hidden="true"/>{english ? 'Arcs completed' : 'Arcos concluídos'}</dt><dd>{arcsCompleted}<small> / {reachableStars.length}</small></dd></div>
          <div><dt><BookOpen size={16} aria-hidden="true"/>{english ? 'Acts completed' : 'Atos concluídos'}</dt><dd>{actsCompleted}<small> / {actsAvailable.length}</small></dd></div>
        </dl>
      </section>
      <button className="progress-continue-button" type="button" onClick={hasProgress ? onContinue : onStartJourney}>{hasProgress ? (english ? 'Continue where you left off' : 'Continuar de onde parou') : (english ? 'Start journey' : 'Iniciar jornada')}<ArrowRight size={17} aria-hidden="true"/></button>
      {import.meta.env.DEV && onResetProgress && <button className="progress-reset-button" type="button" onClick={onResetProgress}><RotateCcw size={16} aria-hidden="true"/>{english ? 'Reset all game progress' : 'Zerar todo o progresso'}</button>}
    </div>
  </main>
}
