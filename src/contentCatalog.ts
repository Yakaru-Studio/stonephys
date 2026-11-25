import { initialModules, stageForProgress } from './data'
import { constellations } from './constellations'
import { learningArcs } from './arcActs'

/** Fixed learning content. Player-specific completion belongs in gameProgress.ts. */
export const contentCatalog = { modules: initialModules, constellations, arcs: learningArcs, stageForProgress } as const

// Achievement definitions and evaluation live in one catalog class.
export {
  AchievementCatalog,
  achievementCatalog,
  getAchievementGroups,
  getUnlockedAchievementIds,
} from './AchievementCatalog'
export type {
  AchievementCategoryDefinition,
  AchievementGroupView,
  AchievementItemDefinition,
  AchievementView,
} from './AchievementCatalog'

const achievementImages = import.meta.glob('./assets/achievements/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export function achievementImage(folder: 'categorias' | 'conquistas', id: string) {
  return achievementImages[`./assets/achievements/${folder}/${id}.png`]
}
