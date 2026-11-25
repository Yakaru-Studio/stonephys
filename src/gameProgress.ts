import { contentCatalog } from './contentCatalog'
const { modules: initialModules, constellations, arcs: learningArcs } = contentCatalog

export const GAME_PROGRESS_KEY = 'sharpstone.game-progress.v1'
export const LEGACY_JOURNEY_KEY = 'stonephys.journey.v1'
export const LEGACY_WORKSHOP_KEY = 'stonephys.time.arc-one.workshop-intro-seen.v1'
export const SCIENTIFIC_NOTES_KEY = 'sharpstone.scientific-notes-read.v1'

export type ArcLocation = { moduleId: string; starId: string }
export type CompletedActs = Record<string, string[]>
export type StarProgress = { unlocked: string[]; completed: string[] }
export type GameProgress = {
  version: 1
  updatedAt: string
  lastArc: ArcLocation | null
  modules: Record<string, { progress: number; status: string }>
  arcs: Record<string, StarProgress>
  acts: CompletedActs
  scenes: { completed: string[] }
  achievements: { unlocked: string[] }
}

export function createEmptyGameProgress(): GameProgress {
  const modules = Object.fromEntries(initialModules.map((module) => [module.id, { progress: 0, status: module.status }]))
  const arcs = Object.fromEntries(Object.entries(constellations).map(([moduleId, config]) => [moduleId, {
    unlocked: config.stars.length && initialModules.find((module) => module.id === moduleId)?.status === 'unlocked' ? [config.stars[0].id] : [],
    completed: [],
  }]))
  const acts = Object.fromEntries(Object.keys(learningArcs).map((moduleId) => [moduleId, []]))
  return { version: 1, updatedAt: new Date().toISOString(), lastArc: null, modules, arcs, acts, scenes: { completed: [] }, achievements: { unlocked: [] } }
}

export function saveGameProgress(progress: GameProgress) {
  try {
    window.localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }))
  } catch { /* Keep the current session usable when browser storage is disabled. */ }
}

export function readGameProgress(): GameProgress {
  try {
    const raw = window.localStorage.getItem(GAME_PROGRESS_KEY)
    if (!raw) return resetLocalProgress()
    const saved = JSON.parse(raw) as Partial<GameProgress>
    if (saved.version !== 1 || !saved.modules || !saved.arcs || !saved.acts) return resetLocalProgress()
    const clean = createEmptyGameProgress()
    for (const module of initialModules) {
      const record = saved.modules[module.id]
      if (record && Number.isFinite(record.progress)) clean.modules[module.id].progress = Math.max(0, Math.min(100, record.progress))
    }
    for (const [moduleId, config] of Object.entries(constellations)) {
      const record = saved.arcs[moduleId]
      if (!record) continue
      clean.arcs[moduleId] = {
        unlocked: config.stars.filter((star) => record.unlocked?.includes(star.id)).map((star) => star.id),
        completed: config.stars.filter((star) => record.completed?.includes(star.id)).map((star) => star.id),
      }
      if (!clean.arcs[moduleId].unlocked.length && !clean.arcs[moduleId].completed.length && config.stars[0] && initialModules.find((module) => module.id === moduleId)?.status === 'unlocked') clean.arcs[moduleId].unlocked = [config.stars[0].id]
    }
    clean.acts = Object.fromEntries(Object.entries(learningArcs).map(([moduleId, arc]) => {
      const validIds = new Set(arc.acts.map((act) => act.id))
      return [moduleId, Array.isArray(saved.acts?.[moduleId]) ? saved.acts[moduleId].filter((id) => validIds.has(id)) : []]
    }))
    clean.scenes.completed = Array.isArray(saved.scenes?.completed) ? [...new Set(saved.scenes.completed.filter((id) => typeof id === 'string'))] : []
    clean.achievements.unlocked = Array.isArray(saved.achievements?.unlocked) ? [...new Set(saved.achievements.unlocked.filter((id) => typeof id === 'string'))] : []
    const last = saved.lastArc
    if (last && constellations[last.moduleId]?.stars.some((star) => star.id === last.starId)) clean.lastArc = last
    clean.updatedAt = typeof saved.updatedAt === 'string' ? saved.updatedAt : clean.updatedAt
    return clean
  } catch { return createEmptyGameProgress() }
}

export function resetLocalProgress() {
  const empty = createEmptyGameProgress()
  try {
    window.localStorage.removeItem(LEGACY_JOURNEY_KEY)
    window.localStorage.removeItem(LEGACY_WORKSHOP_KEY)
    window.localStorage.removeItem(SCIENTIFIC_NOTES_KEY)
    window.localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(empty))
  } catch { /* React state still resets for this session. */ }
  return empty
}
