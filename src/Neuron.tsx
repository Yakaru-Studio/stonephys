import type { KnowledgeModule } from './data'
import type { AppLocale } from './i18n'
import NeuronScene from './NeuronScene'

const currentFire = new URL('./assets/arcs/current-fire-fluid.png', import.meta.url).href

export default function Neuron({ module, pulse, opening, isCurrent, onSelect, locale }: {module:KnowledgeModule;pulse:number;opening:boolean;isCurrent:boolean;onSelect:()=>void;locale:AppLocale}) {
  const active=module.status==='unlocked'
  const accessibleLabel = active ? locale === 'en' ? `${module.name}, ${module.progress}% complete${isCurrent ? ', current module' : ''}` : `${module.name}, ${module.progress}% concluído${isCurrent ? ', módulo atual' : ''}` : `${module.name}, ${locale === 'en' ? 'locked' : 'bloqueado'}`
  return <button className={`neuron neuron-${module.id} ${active?'active':'locked'} ${isCurrent?'is-current':''} ${pulse?'tap-pulse':''} ${opening?'opening':''}`} style={{left:`${module.position[0]}%`,top:`${module.position[1]}%`}} onClick={active?onSelect:undefined} disabled={!active} aria-label={accessibleLabel}>
    <NeuronScene active={active} pulse={pulse} progress={module.progress}/>
    <svg className="neuron-overlay" viewBox="-160 -160 320 320" aria-hidden="true">
      {module.id==='time'?<g className="module-symbol"><path className="symbol-outline" d="M-19 -32h38M-16 -28v8c0 13 14 14 16 20-2 7-16 8-16 20v8M16 -28v8c0 13-14 14-16 20 2 7 16 8 16 20v8M-19 32h38"/><path className="symbol-fill" d="M-12 -23h24c0 9-5 12-12 17-7-5-12-8-12-17m0 46h24c0-9-5-12-12-17-7 5-12 8-12 17"/></g>:<g className="module-symbol ruler" transform="rotate(-34)"><rect className="symbol-outline" x="-28" y="-8" width="56" height="16" rx="1"/><path d="M-19 -8v7m8-7v4m8-4v7m8-7v4m8-4v7"/></g>}
      <text className="node-letter" x="0" y="14">{module.id==='time'?'t':'d'}</text>
      {isCurrent&&active&&<image className="current-module-flame" href={currentFire} x="82" y="-119" width="20" height="31" preserveAspectRatio="xMidYMid meet"/>}
      {active&&<circle className="node-beacon" cx="0" cy="-78" r="2.2"/>}
      {!active&&<g className="lock-mark"><circle className="lock-shadow" r="24"/><path d="M-9 -4v-8a9 9 0 0 1 18 0v8"/><rect x="-15" y="-4" width="30" height="24" rx="3"/><circle className="lock-keyhole" cy="6" r="2"/><path d="M0 8v5"/></g>}
    </svg>
  </button>
}
