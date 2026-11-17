import H4Watch from './H4Watch'
import type { HistoricalScene } from '../sceneTypes'

const workshopBackground = new URL('../../assets/scenes/time/harrison-workshop/workshop-background-no-cushion.png', import.meta.url).href

const narration = 'Tempo... Estamos atravessando ele agora, nesse exato momento estou eu, falando contigo.... Minhas ideias, criadas há séculos, chegaram até você.... Mas houve um tempo em que o tempo não tinha nome e devemos juntos, entender como ele foi definido, medido e mensurado. Vamos viajar no tempo então, mas dessa vez não ao futuro, mas sim ao passado....'

export const harrisonWorkshop: HistoricalScene = {
  id: 'harrison-workshop-1760',
  title: 'A oficina de John Harrison',
  location: 'Londres, Inglaterra',
  period: '1760',
  duration: 36,
  layers: [{ id: 'workshop', image: workshopBackground, depth: 0, parallax: .012, fit: 'cover' }],
  actors: [{ id: 'john-harrison', presentation: 'voice', narration }],
  props: [{ id: 'h4', kind: 'component', render: (time) => <H4Watch time={time}/> }],
  timeline: [
    { id: 'opening', start: 0, end: 2, cameraZoom: 1 },
    { id: 'present-time', start: 2, end: 8, subtitle: 'Tempo... Estamos atravessando ele agora, nesse exato momento estou eu, falando contigo....', cameraZoom: 1.015 },
    { id: 'legacy', start: 8, end: 13, subtitle: 'Minhas ideias, criadas há séculos, chegaram até você....', cameraZoom: 1.035 },
    { id: 'measure-time', start: 13, end: 22, subtitle: 'Mas houve um tempo em que o tempo não tinha nome e devemos juntos, entender como ele foi definido, medido e mensurado.', cameraZoom: 1.07 },
    { id: 'journey-back', start: 22, end: 30, subtitle: 'Vamos viajar no tempo então, mas dessa vez não ao futuro, mas sim ao passado....', cameraZoom: 1.12, rewind: true },
    { id: 'blackout', start: 30, end: 36, cameraZoom: 1.15, rewind: true, blackout: true },
  ],
  audio: { narration: null, ambience: null, clock: null, transition: null },
  nextScene: { id: 'border-cave-42000-bce', location: 'Border Cave, África Austral', period: 'cerca de 42 mil anos atrás' },
}
