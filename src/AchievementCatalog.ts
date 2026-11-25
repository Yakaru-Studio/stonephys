import type { AppLocale } from './i18n'

export type AchievementItemDefinition = {
  id: string
  title: { 'pt-BR': string; en: string }
  description?: string
  icon: string
  unlock: 'counting-marks' | 'in-progress' | 'first-note' | 'ten-notes'
  /** Completing the Lebombo act begins progress toward this longer journey. */
  initialActProgress?: { actId: string; progress: number }
}

export type AchievementCategoryDefinition = {
  id: string
  title: { 'pt-BR': string; en: string }
  icon: string
  items: AchievementItemDefinition[]
}

export type AchievementView = Omit<AchievementItemDefinition, 'title'> & {
  title: string
  earned: boolean
  progress: number
  masked: boolean
}
export type AchievementGroupView = { id: string; title: string; icon: string; items: AchievementView[] }

const lebomboProgress = { actId: 'counting-marks', progress: .1 }
const item = (
  id: string,
  pt: string,
  en: string,
  icon: string,
  unlock: AchievementItemDefinition['unlock'],
  description?: string,
  initialActProgress?: AchievementItemDefinition['initialActProgress'],
): AchievementItemDefinition => ({
  id,
  title: { 'pt-BR': pt, en },
  icon,
  unlock,
  ...(description ? { description } : {}),
  ...(initialActProgress ? { initialActProgress } : {}),
})

/** Fixed achievement definitions and the single place that evaluates their state. */
export class AchievementCatalog {
  static readonly categories: AchievementCategoryDefinition[] = [
    { id: 'astros', title: { 'pt-BR': 'Astros', en: 'Celestial bodies' }, icon: 'astros', items: [
      item('sun', 'Sol', 'Sun', 'sol', 'in-progress', undefined, lebomboProgress),
      item('moon', 'Lua', 'Moon', 'lua', 'in-progress', undefined, lebomboProgress),
    ] },
    { id: 'module', title: { 'pt-BR': 'Módulo', en: 'Module' }, icon: 'modulos', items: [
      item('time', 'Tempo', 'Time', 'tempo', 'in-progress', undefined, lebomboProgress),
    ] },
    { id: 'artifacts', title: { 'pt-BR': 'Artefatos', en: 'Artifact trophies' }, icon: 'artefatos', items: [item('lebombo', 'Osso de Lebombo', 'Lebombo Bone', 'osso_de_lebombo', 'counting-marks')] },
    { id: 'tools', title: { 'pt-BR': 'Ferramentas', en: 'Tools' }, icon: 'ferramentas', items: [item('flaked-stone', 'Pedra Lascada', 'Flaked Stone', 'pedra_lascada', 'counting-marks')] },
    { id: 'measures', title: { 'pt-BR': 'Medidas', en: 'Measures' }, icon: 'medidas', items: [
      item('day', 'Dia', 'Day', 'unidade_tempo_dia', 'in-progress', undefined, lebomboProgress),
      item('month', 'Mês', 'Month', 'unidade_tempo_mes', 'in-progress', undefined, lebomboProgress),
    ] },
    { id: 'countries', title: { 'pt-BR': 'Países (anacrônico)', en: 'Countries (anachronistic)' }, icon: 'paises', items: [
      item('south-africa', 'África do Sul', 'South Africa', 'africa_do_sul', 'in-progress', undefined, lebomboProgress),
    ] },
    { id: 'fossils', title: { 'pt-BR': 'Fósseis', en: 'Fossils' }, icon: 'fosseis', items: [item('chacma-baboon-fossil', 'Babuíno-chacma', 'Chacma baboon', 'babuino_chacma_fossil', 'counting-marks', 'Papio ursinus')] },
    { id: 'fauna-sightings', title: { 'pt-BR': 'Avistamento de fauna', en: 'Fauna sightings' }, icon: 'avistamento_fauna', items: [
      item('chacma-baboon', 'Babuíno-chacma', 'Chacma baboon', 'babuino_chacma', 'counting-marks', 'Papio ursinus'),
      item('plains-zebra', 'Zebra-das-planícies', 'Plains zebra', 'zebra_das_planicies', 'counting-marks', 'Equus quagga'),
      item('impala', 'Antílope-impala', 'Impala', 'antilope_impala', 'counting-marks', 'Aepyceros melampus'),
      item('african-warthog', 'Javali-africano', 'African warthog', 'javali_africano', 'counting-marks', 'Phacochoerus africanus'),
      item('cape-vulture', 'Abutre-do-cabo', 'Cape vulture', 'abutre_do_cabo', 'counting-marks', 'Gyps coprotheres'),
    ] },
    { id: 'flora-sightings', title: { 'pt-BR': 'Avistamento de Flora', en: 'Flora sightings' }, icon: 'avistamento_flora', items: [item('sweet-thorn-acacia', 'Acácia-de-espinhos-doces', 'Sweet thorn acacia', 'acacia_espinhos_doces', 'counting-marks', 'Vachellia karroo')] },
    { id: 'characters', title: { 'pt-BR': 'Personagens', en: 'Characters' }, icon: 'personagens', items: [item('aru', 'Aru', 'Aru', 'aru', 'counting-marks')] },
    { id: 'historical-characters', title: { 'pt-BR': 'Personagens históricos', en: 'Historical figures' }, icon: 'personagens_historicos', items: [
      item('john-harrison', 'John Harrison', 'John Harrison', 'john_harrison', 'in-progress', undefined, lebomboProgress),
    ] },
    { id: 'places', title: { 'pt-BR': 'Locais', en: 'Places' }, icon: 'locais', items: [item('border-cave', 'Border Cave', 'Border Cave', 'border_cave', 'counting-marks')] },
    { id: 'human-milestones', title: { 'pt-BR': 'Marcos humanos', en: 'Human milestones' }, icon: 'marcos_humanos', items: [item('counting', 'Contagem', 'Counting', 'contagem', 'counting-marks')] },
    { id: 'traditional', title: { 'pt-BR': 'Marcos', en: 'Milestones' }, icon: 'feitos', items: [
      item('first-step', 'O primeiro passo', 'The First Step', 'o_primeiro_passo', 'counting-marks', 'Conclua sua primeira atividade interativa.'),
      item('time-guardian', 'Guardião do tempo', 'Guardian of Time', 'guardiao_do_tempo', 'in-progress', 'Conclua a experiência completa do Tempo.', lebomboProgress),
      item('curious-mind', 'Mente curiosa', 'Curious Mind', 'mente_curiosa', 'first-note', 'Leia sua primeira nota científica.'),
      item('thirst-for-knowledge', 'Sede de conhecimento', 'Thirst for Knowledge', 'sede_de_conhecimento', 'ten-notes', 'Leia 10 notas históricas ou científicas.'),
      item('world-explorer', 'Explorador do mundo', 'World Explorer', 'explorador_do_mundo', 'in-progress', 'Desbloqueie 10 países.', lebomboProgress),
      item('eyes-to-the-cosmos', 'Olhos para o cosmos', 'Eyes to the Cosmos', 'olhos_para_o_cosmos', 'in-progress', 'Conclua sua primeira coleção astronômica.'),
      item('stone-to-stars', 'Da pedra às estrelas', 'From Stone to Stars', 'da_pedra_as_estrelas', 'in-progress', 'Percorra toda a jornada da humanidade até a exploração espacial.', lebomboProgress),
    ] },
  ]

  static getGroups(locale: AppLocale, completedActIds: string[], noteCount: number, advancement: Record<string, number> = {}): AchievementGroupView[] {
    const completed = new Set(completedActIds)
    return AchievementCatalog.categories.map((category) => ({
      id: category.id,
      title: category.title[locale === 'en' ? 'en' : 'pt-BR'],
      icon: category.icon,
      items: category.items.flatMap((definition) => {
        const actProgress = definition.initialActProgress && completed.has(definition.initialActProgress.actId)
          ? definition.initialActProgress.progress
          : 0
        const advancementProgress = Math.max(0, Math.min(1, advancement[definition.id] ?? actProgress))
        const eligible = definition.unlock === 'counting-marks' ? completed.has('counting-marks')
          : definition.unlock === 'first-note' ? noteCount > 0
          : definition.unlock === 'ten-notes' ? noteCount > 0
          : category.id === 'traditional' || advancementProgress > 0
        if (!eligible) return []
        const earned = definition.unlock === 'counting-marks' ? completed.has('counting-marks')
          : definition.unlock === 'first-note' ? noteCount > 0
          : definition.unlock === 'ten-notes' ? noteCount >= 10
          : advancementProgress >= 1
        return [{
          ...definition,
          title: definition.title[locale === 'en' ? 'en' : 'pt-BR'],
          earned,
          progress: earned ? 1 : definition.unlock === 'ten-notes' ? Math.min(.92, noteCount / 10) : advancementProgress,
          masked: category.id === 'historical-characters' && !earned,
        }]
      }),
    })).filter((category) => category.items.length > 0)
  }

  static getUnlockedIds(completedActIds: string[], noteCount: number) {
    return AchievementCatalog.getGroups('pt-BR', completedActIds, noteCount)
      .flatMap((group) => group.items.filter((entry) => entry.earned).map((entry) => entry.id))
  }
}

export const achievementCatalog = AchievementCatalog.categories
export const getAchievementGroups = AchievementCatalog.getGroups
export const getUnlockedAchievementIds = AchievementCatalog.getUnlockedIds
