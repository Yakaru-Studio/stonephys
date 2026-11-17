import H4Watch from './H4Watch'
import type { HistoricalScene } from '../sceneTypes'

const workshopBackground = new URL('../../assets/scenes/time/harrison-workshop/workshop-background-no-cushion.png', import.meta.url).href

export const harrisonNarration = 'Tempo... Estamos atravessando-o agora…\n\nNesse exato momento, estou eu falando contigo, e minhas ideias, criadas há séculos, chegaram até ti…\n\nMas houve um tempo em que o tempo não tinha nome…\n\nE vamos, juntos, descobrir como ele foi percebido, definido e medido.\n\nVamos viajar no tempo, então. Mas, dessa vez, não ao futuro... e sim ao passado…'

export const harrisonWorkshop: HistoricalScene = {
  id: 'harrison-workshop-1760',
  title: 'A oficina de John Harrison',
  location: 'Londres, Inglaterra',
  period: '1760',
  localized: {
    title: { 'pt-BR': 'A oficina de John Harrison', en: 'John Harrison’s Workshop' },
    location: { 'pt-BR': 'Londres, Inglaterra', en: 'London, England' },
    period: { 'pt-BR': '1760', en: '1760' },
    nextLocation: { 'pt-BR': 'Border Cave, África Austral', en: 'Border Cave, Southern Africa' },
    nextPeriod: { 'pt-BR': 'cerca de 42 mil anos atrás', en: 'around 42,000 years ago' },
  },
  duration: 36,
  layers: [{ id: 'workshop', image: workshopBackground, depth: 0, parallax: .012, fit: 'cover' }],
  actors: [{ id: 'john-harrison', presentation: 'voice', narration: harrisonNarration, narrationByLocale: { 'pt-BR': harrisonNarration, en: 'Time... We are crossing it now…\n\nAt this very moment, I am speaking to you, and my ideas, created centuries ago, have reached you…\n\nBut there was a time when time had no name…\n\nAnd together, we will discover how it was perceived, defined, and measured.\n\nLet us travel through time, then. But this time, not to the future... rather, to the past…' } }],
  props: [{ id: 'h4', kind: 'component', render: (time, reverseProgress) => <H4Watch time={time} reverseProgress={reverseProgress}/> }],
  timeline: [
    { id: 'opening', start: 0, end: 2, cameraZoom: 1 },
    { id: 'present-time', start: 2, end: 8, subtitle: 'Tempo... Estamos atravessando-o agora…', subtitleByLocale: { 'pt-BR': 'Tempo... Estamos atravessando-o agora…', en: 'Time... We are crossing it now…' }, cameraZoom: 1.015 },
    { id: 'legacy', start: 8, end: 13, subtitle: 'Nesse exato momento, estou eu falando contigo, e minhas ideias, criadas há séculos, chegaram até você...', subtitleByLocale: { 'pt-BR': 'Nesse exato momento, estou eu falando contigo, e minhas ideias, criadas há séculos, chegaram até você...', en: 'At this very moment, I am speaking to you, and my ideas, created centuries ago, have reached you...' }, cameraZoom: 1.035 },
    { id: 'measure-time', start: 13, end: 22, subtitle: 'Mas houve um tempo em que o tempo não tinha nome, e devemos, juntos, entender como ele foi definido, medido e mensurado.', subtitleByLocale: { 'pt-BR': 'Mas houve um tempo em que o tempo não tinha nome, e devemos, juntos, entender como ele foi definido, medido e mensurado.', en: 'But there was a time when time had no name, and we must, together, understand how it was defined, measured, and quantified.' }, cameraZoom: 1.07 },
    { id: 'journey-back', start: 22, end: 36, subtitle: 'Vamos viajar no tempo, então, mas, dessa vez, não ao futuro, mas sim ao passado...', subtitleByLocale: { 'pt-BR': 'Vamos viajar no tempo, então, mas, dessa vez, não ao futuro, mas sim ao passado...', en: 'Let us travel through time, then, but this time not to the future, but rather to the past...' }, cameraZoom: 1.12 },
  ],
  audio: { narration: null, narrationManifest: null, ambience: null, clock: null, transition: null },
  nextScene: { id: 'border-cave-42000-bce', location: 'Border Cave, África Austral', period: 'cerca de 42 mil anos atrás' },
}
