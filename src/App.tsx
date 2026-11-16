import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Neuron from './Neuron'
import { initialModules, stageForProgress } from './data'

export default function App() {
  const [pulse, setPulse] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, number>>({ time: 0 })
  return <main className="map-screen" aria-label="Universo de módulos científicos">
    <header className="map-header"><button className="back-button" onClick={()=>window.history.back()} aria-label="Voltar"><ArrowLeft size={18}/></button><h1>Módulos</h1><span className="header-balance" aria-hidden="true"/></header>
    <svg className="cosmos" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="space"><stop stopColor="#111a28"/><stop offset=".58" stopColor="#0a111b"/><stop offset="1" stopColor="#050910"/></radialGradient>
        <radialGradient id="mind-mist"><stop stopColor="#536c91" stopOpacity=".2"/><stop offset=".48" stopColor="#283d59" stopOpacity=".1"/><stop offset="1" stopColor="#182537" stopOpacity="0"/></radialGradient>
        <radialGradient id="mind-warmth"><stop stopColor="#bb7937" stopOpacity=".12"/><stop offset=".55" stopColor="#764d34" stopOpacity=".055"/><stop offset="1" stopColor="#362a2b" stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#space)"/>
      <ellipse className="mind-cloud cool" cx="720" cy="355" rx="410" ry="260" fill="url(#mind-mist)"/>
      <ellipse className="mind-cloud warm" cx="285" cy="660" rx="360" ry="240" fill="url(#mind-warmth)"/>
      <ellipse className="mind-cloud cool" cx="170" cy="195" rx="300" ry="220" fill="url(#mind-mist)"/>
      {Array.from({length:38},(_,i)=>{
        const random=(seed:number)=>{const value=Math.sin((i+1)*seed)*43758.5453;return value-Math.floor(value)}
        return <circle key={i} className={`star ${i%9===0?'star-bright':''}`} cx={random(12.9898)*1000} cy={random(78.233)*1000} r={i%9===0?1.35:.55+random(45.164)*.42} style={{opacity:.13+random(31.71)*.16,animationDelay:`${random(9.73)*-9}s`,animationDuration:`${9+random(5.83)*9}s`}}/>
      })}
      {Array.from({length:30},(_,i)=>{
        const random=(seed:number)=>{const value=Math.sin((i+43)*seed)*43758.5453;return value-Math.floor(value)}
        const misty=i%5===0
        return <circle key={`m${i}`} className={`memory-mote ${misty?'memory-mote-soft':'memory-mote-clear'} ${i%7===0?'memory-mote-glow':''}`} cx={random(17.31)*1000} cy={random(51.73)*1000} r={misty?2.4+random(28.13)*1.5:1.05+random(63.91)*1.1} style={{opacity:misty?.12+random(12.3)*.1:.25+random(91.7)*.22,animationDelay:`${random(41.19)*-18}s`,animationDuration:`${14+random(8.71)*14}s`}}/>
      })}
      <circle className="dust-cloud" cx="290" cy="440" r="185"/><circle className="dust-cloud cool" cx="740" cy="610" r="210"/>
    </svg>
    {initialModules.filter(module=>module.status!=='undiscovered').map(source=>{
      const value=progress[source.id]??source.progress
      const module={...source,progress:value,stage:stageForProgress(value)}
      return <Neuron key={module.id} module={module} pulse={pulse[module.id]??0} onSelect={()=>{
        setPulse(current=>({...current,[module.id]:(current[module.id]??0)+1}))
        setProgress(current=>({...current,[module.id]:Math.min(100,(current[module.id]??source.progress)+25)}))
      }}/>
    })}
  </main>
}
