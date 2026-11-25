export type ActStatus = 'locked' | 'available' | 'completed'
export type ActKind = 'main' | 'optional'
export type ActSymbol = 'telescope' | 'pyramid' | 'bull' | 'compass' | 'tally' | 'bone' | 'lock' | 'sun-moon' | 'gnomon' | 'wooden-bowl'
export type ActSiteEnvironment = 'lebombo-rock-shelter'
export type ActShelfArtifact = 'baboon-skull' | 'wooden-bowl'

export type ArcAct = {
  id: string
  number: number
  title: string
  description: string
  illustration: string
  status: ActStatus
  kind: ActKind
  symbol: ActSymbol
  topEmblem?: ActSymbol
  bottomEmblem?: ActSymbol
  siteEnvironment?: ActSiteEnvironment
  shelfArtifact?: ActShelfArtifact
  position: { x: number; y: number }
  prerequisites: string[]
  connections: string[]
}

export type ArcConnection = { from: string; to: string; kind: ActKind }

export type LearningArc = {
  id: string
  moduleId: string
  moduleName: string
  title: string
  acts: ArcAct[]
  connections: ArcConnection[]
}

const skyWatch = new URL('./assets/arcs/sky-watch.svg', import.meta.url).href
const shadowMeasure = new URL('./assets/arcs/shadow-measure.svg', import.meta.url).href
const starWayfinder = new URL('./assets/arcs/star-wayfinder.svg', import.meta.url).href
const borderCaveActBanner = new URL('./assets/arcs/border-cave-act-banner.png', import.meta.url).href
const taosiStaffActBanner = new URL('./assets/arcs/taosi-staff-act-banner.png', import.meta.url).href

const timeActs: ArcAct[] = [
  {
    id: 'first-observation', number: 3, title: 'O Primeiro Olhar',
    description: 'Antes dos relógios, o céu ensinou a reconhecer ciclos. Observe as estrelas e descubra como as primeiras comunidades encontraram referências para a passagem do tempo.',
    illustration: skyWatch, status: 'locked', kind: 'main', symbol: 'telescope',
    position: { x: 22, y: 35 }, prerequisites: ['age-of-sun'], connections: ['last-seal'],
  },
  {
    id: 'shadow-measure', number: 2, title: 'A Sombra que Mede',
    description: 'A altura do Sol transforma uma sombra em medida. Acompanhe a construção de calendários e os primeiros marcos que organizaram os dias.',
    illustration: shadowMeasure, status: 'locked', kind: 'optional', symbol: 'pyramid',
    position: { x: 61, y: 35 }, prerequisites: ['wayfinder'], connections: ['last-seal'],
  },
  {
    id: 'age-of-sun', number: 2, title: 'A Haste de Taosi',
    description: 'Em Taosi, uma haste vertical e sua sombra ajudavam a acompanhar o caminho do Sol. Uma tigela de madeira e uma colher completam os objetos desta antiga observação.',
    illustration: taosiStaffActBanner, status: 'locked', kind: 'main', symbol: 'gnomon', topEmblem: 'gnomon', bottomEmblem: 'wooden-bowl', shelfArtifact: 'wooden-bowl',
    position: { x: 34, y: 56 }, prerequisites: ['counting-marks'], connections: ['first-observation', 'wayfinder'],
  },
  {
    id: 'wayfinder', number: 1, title: 'A Rosa dos Ventos',
    description: 'A observação dos astros orienta jornadas por terra e mar. Descubra como direção e movimento ajudaram a medir distâncias e durações.',
    illustration: starWayfinder, status: 'locked', kind: 'optional', symbol: 'compass',
    position: { x: 73, y: 57 }, prerequisites: ['age-of-sun'], connections: ['shadow-measure'],
  },
  {
    id: 'counting-marks', number: 1, title: 'O osso de Lebombo',
    description: 'Riscos em pedra e osso guardaram contagens muito antes da escrita. Relembre os primeiros gestos usados para registrar os ciclos.',
    illustration: borderCaveActBanner, status: 'available', kind: 'main', symbol: 'bone', topEmblem: 'bone', bottomEmblem: 'sun-moon', siteEnvironment: 'lebombo-rock-shelter',
    position: { x: 34, y: 84 }, prerequisites: [], connections: ['age-of-sun'],
  },
  {
    id: 'last-seal', number: 4, title: 'O Ciclo Ainda Oculto',
    description: 'Uma última descoberta aguarda além dos caminhos já conhecidos.',
    illustration: skyWatch, status: 'locked', kind: 'main', symbol: 'lock',
    position: { x: 77, y: 19 }, prerequisites: ['first-observation'], connections: [],
  },
]

export const learningArcs: Record<string, LearningArc> = {
  time: {
    id: 'deuses-da-luz-e-escuridao',
    moduleId: 'time',
    moduleName: 'Tempo',
    title: 'Os Deuses da Luz e Escuridão',
    acts: timeActs,
    connections: timeActs.flatMap((act) => act.connections.map((to) => ({
      from: act.id,
      to,
      kind: timeActs.find((target) => target.id === to)?.kind ?? act.kind,
    }))),
  },
}
