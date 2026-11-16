export type ModuleStatus = 'unlocked' | 'locked' | 'undiscovered' | 'forming'
export type Stage = 'initial' | 'developing' | 'developed' | 'mastered'
export interface KnowledgeModule {
  id: string; name: string; subtitle: string; description: string; status: ModuleStatus
  stage: Stage; progress: number; position: [number, number]; requires: string[]
}

export const initialModules: KnowledgeModule[] = [
  { id: 'time', name: 'TEMPO', subtitle: 'A primeira medida', description: 'Descubra como a humanidade aprendeu a observar, medir e compreender o tempo.', status: 'unlocked', stage: 'initial', progress: 0, position: [37, 34], requires: [] },
  { id: 'distance', name: 'DISTÂNCIA', subtitle: 'Dimensões do mundo', description: 'Explore como as civilizações desenvolveram métodos para medir comprimentos, distâncias e dimensões do mundo.', status: 'locked', stage: 'initial', progress: 0, position: [63, 66], requires: ['time'] },
  { id: 'velocity', name: 'VELOCIDADE', subtitle: 'O espaço em movimento', description: 'Uma nova grandeza nasce quando a distância encontra o tempo.', status: 'undiscovered', stage: 'initial', progress: 0, position: [50, 26], requires: ['time', 'distance'] },
]

export const stageForProgress = (value: number): Stage => value >= 100 ? 'mastered' : value >= 50 ? 'developed' : value > 0 ? 'developing' : 'initial'
