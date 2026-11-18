import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Neuron from './Neuron'
import { initialModules, stageForProgress } from './data'
import ConstellationPage from './ConstellationPage'
import { constellations } from './constellations'
import AudioControls from './audio/AudioControls'
import { audioManager } from './audio/AudioManager'
import ArcMapPage, { type DevSceneTarget } from './ArcMapPage'
import { learningArcs } from './arcActs'
import { localizeModule, useLocale } from './i18n'
import BorderCaveArrival from './scenes/time/BorderCaveArrival'
import LebomboDiscoveryScene from './scenes/time/LebomboDiscoveryScene'

const HarrisonWorkshopExperience = lazy(() => import('./scenes/time/HarrisonWorkshopExperience'))
const VoiceStudio = lazy(() => import('./narration/VoiceStudio'))
const MusicStudio = lazy(() => import('./music/MusicStudio'))
const SoundEffectsStudio = lazy(() => import('./sound-effects/SoundEffectsStudio'))
const packagedMusic = import.meta.glob('../content/music/*/composition.json', { eager: true, import: 'default' }) as Record<string, Record<string, any>>
const workshopIntroStorageKey = 'stonephys.time.arc-one.workshop-intro-seen.v1'

function hasSeenWorkshopIntro() {
  try { return window.localStorage.getItem(workshopIntroStorageKey) === 'true' } catch { return false }
}

export default function App() {
  const { locale, t } = useLocale()
  const [pulse, setPulse] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, number>>({ time: 0 })
  const [currentModuleId, setCurrentModuleId] = useState(() => initialModules.find((module) => module.status === 'unlocked')?.id ?? initialModules[0].id)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedArc, setSelectedArc] = useState<{ moduleId: string; starId: string } | null>(null)
  const [harrisonSceneOpen, setHarrisonSceneOpen] = useState(false)
  const [borderCaveSceneOpen, setBorderCaveSceneOpen] = useState(false)
  const [devSceneOverride, setDevSceneOverride] = useState<DevSceneTarget | null>(null)
  const [workshopIntroSeen, setWorkshopIntroSeen] = useState(hasSeenWorkshopIntro)
  const [transitioningModuleId, setTransitioningModuleId] = useState<string | null>(null)
  const [homeTransition, setHomeTransition] = useState(false)
  const [stageProgress, setStageProgress] = useState<Record<string, { unlocked: string[]; completed: string[] }>>({
    time: { unlocked: ['sky'], completed: [] },
    distance: { unlocked: ['body'], completed: [] },
    velocity: { unlocked: ['motion'], completed: [] },
  })
  const [completedActs, setCompletedActs] = useState<Record<string, string[]>>({})
  const [music, setMusic] = useState<any[]>([])
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const loadMusic = () => { void fetch('/__voice-studio/api/music/status').then((response) => response.ok ? response.json() : null).then((result) => { if (result?.compositions) setMusic(result.compositions) }).catch(() => {}) }
    loadMusic()
    window.addEventListener('stonephys:music-preview-changed', loadMusic)
    return () => window.removeEventListener('stonephys:music-preview-changed', loadMusic)
  }, [])

  useEffect(() => {
    const loadEffects = async () => {
      try {
        let effects: Record<string, any> = {}
        if (import.meta.env.DEV) {
          const result = await fetch('/__voice-studio/api/sfx/status').then((response) => response.ok ? response.json() : null)
          for (const effect of result?.effects || []) {
            const version = effect.versions?.find((item: any) => item.id === effect.previewVersionId)
            const url = version ? effect.previewUrl : effect.approvedAssetUrl
            if (url) effects[effect.id] = { url, volume: version?.volume ?? effect.defaultVolume ?? .72, loop: version?.loop ?? effect.loop ?? false }
          }
        } else {
          const manifest = await fetch('/audio/sfx/approved/manifest.json').then((response) => response.ok ? response.json() : null)
          effects = manifest?.effects || {}
        }
        audioManager.setSoundEffectCatalog(effects)
      } catch { audioManager.setSoundEffectCatalog({}) }
    }
    void loadEffects()
    window.addEventListener('stonephys:sfx-preview-changed', loadEffects)
    return () => window.removeEventListener('stonephys:sfx-preview-changed', loadEffects)
  }, [])

  useEffect(() => {
    if (borderCaveSceneOpen || (import.meta.env.DEV && window.location.pathname === '/__border-cave-preview')) return
    const wisdomSanctuaryApproved = import.meta.env.DEV
      ? music.some((item) => item.id === 'the-sanctuary-of-wisdom' && item.approvedVersionId)
      : Object.entries(packagedMusic).some(([file, item]) => file.includes('/the-sanctuary-of-wisdom/composition.json') && item.approvedAssetUrl)
    const targetId = harrisonSceneOpen
      ? 'the-clockmaker-of-time'
      : selectedArc ? wisdomSanctuaryApproved ? 'the-sanctuary-of-wisdom' : 'paths-of-discovery' : selectedModuleId || audioUnlocked ? 'eternity-of-knowledge' : null
    if (!targetId) { audioManager.fadeMusicOut(900); return }
    const composition = music.find((item) => item.id === targetId)
    const packaged = Object.entries(packagedMusic).find(([file]) => file.includes(`/${targetId}/composition.json`))?.[1]
    const source = import.meta.env.DEV ? composition?.previewUrl : packaged?.approvedAssetUrl
    const settings = composition || packaged
    const loopSettings = import.meta.env.DEV ? composition?.previewLoop || composition?.loop : packaged?.approvedLoop || packaged?.loop
    const cropStartSeconds = import.meta.env.DEV ? composition?.previewCropStartSeconds ?? 0 : packaged?.approvedCropStartSeconds ?? 0
    const cropEndSeconds = import.meta.env.DEV ? composition?.previewCropEndSeconds ?? null : packaged?.approvedCropEndSeconds ?? null
    const volume = import.meta.env.DEV ? composition?.previewVolume ?? 1 : packaged?.approvedVolume ?? 1
    audioManager.setNarrationMusicLevel(settings?.ducking?.musicLevelDuringNarration ?? .42)
    if (!source) { audioManager.fadeMusicOut(900); return }
    // Loop behavior is configured in Music Studio; tracks default to looping.
    void audioManager.playMusicAsset(source, { loop: loopSettings?.enabled ?? true, fadeMs: loopSettings?.crossfadeMs ?? 1800, loopCrossfadeMs: loopSettings?.crossfadeMs ?? 1800, trackGain: settings?.defaultVolume ?? .2, volume, cropStartSeconds, cropEndSeconds }).catch(() => {})
  }, [music, selectedModuleId, selectedArc, harrisonSceneOpen, borderCaveSceneOpen, audioUnlocked])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${t('app.brand')} — ${t('app.title')}`
  }, [locale, t])

  if (import.meta.env.DEV && window.location.pathname === '/__voice-studio') {
    return <Suspense fallback={<div className="historical-scene-loading">Abrindo o estúdio de voz…</div>}><VoiceStudio onClose={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/></Suspense>
  }
  if (import.meta.env.DEV && window.location.pathname === '/__audio-studio') return <Suspense fallback={<div className="historical-scene-loading">Abrindo o estúdio de música…</div>}><MusicStudio onClose={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/></Suspense>
  if (import.meta.env.DEV && window.location.pathname === '/__sound-effects-studio') return <Suspense fallback={<div className="historical-scene-loading">Abrindo o estúdio de efeitos…</div>}><SoundEffectsStudio onClose={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/></Suspense>
  if (import.meta.env.DEV && window.location.pathname === '/__border-cave-preview') return <BorderCaveArrival locale={locale} onExit={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/>
  if (import.meta.env.DEV && window.location.pathname === '/__lebombo-discovery-preview') return <LebomboDiscoveryScene onExit={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/>
  if (import.meta.env.DEV && devSceneOverride === 'border-cave-cycle') return <BorderCaveArrival locale={locale} onExit={() => { setDevSceneOverride(null); setBorderCaveSceneOpen(false) }}/>
  if (import.meta.env.DEV && devSceneOverride === 'lebombo-discovery') return <LebomboDiscoveryScene onExit={() => { setDevSceneOverride(null); setBorderCaveSceneOpen(false) }}/>

  const selectedModule = selectedModuleId ? initialModules.find((module) => module.id === selectedModuleId) : null
  if (selectedModule && constellations[selectedModule.id]) {
    return <>
      <ConstellationPage
        moduleId={selectedModule.id}
        unlockedStarIds={stageProgress[selectedModule.id]?.unlocked ?? [constellations[selectedModule.id].stars[0].id]}
        completedStarIds={stageProgress[selectedModule.id]?.completed ?? []}
        onBack={() => {
          setHomeTransition(true)
          setSelectedArc(null)
          setSelectedModuleId(null)
        }}
        onOpenArc={learningArcs[selectedModule.id] ? (star) => {
          audioManager.play('navigation')
          setSelectedArc({ moduleId: selectedModule.id, starId: star.id })
          if (selectedModule.id === 'time' && star.id === 'sky' && !workshopIntroSeen) {
            setWorkshopIntroSeen(true)
            try { window.localStorage.setItem(workshopIntroStorageKey, 'true') } catch { /* Keep this visit working if storage is unavailable. */ }
            setHarrisonSceneOpen(true)
          }
        } : undefined}
        onUnlockStar={(starId) => {
          const config = constellations[selectedModule.id]
          const moduleProgress = stageProgress[selectedModule.id] ?? { unlocked: [config.stars[0].id], completed: [] }
          if (moduleProgress.unlocked.includes(starId) || moduleProgress.completed.includes(starId)) return
          const before = new Set([...moduleProgress.unlocked, ...moduleProgress.completed])
          const after = new Set([...before, starId])
          audioManager.play('starUnlock')
          if (config.edges.some((edge) => (edge.from === starId || edge.to === starId) && after.has(edge.from) && after.has(edge.to) && !(before.has(edge.from) && before.has(edge.to)))) {
            audioManager.play('connection')
          }
          setStageProgress((current) => {
            const currentProgress = current[selectedModule.id] ?? { unlocked: [config.stars[0].id], completed: [] }
            if (currentProgress.unlocked.includes(starId) || currentProgress.completed.includes(starId)) return current
            return { ...current, [selectedModule.id]: { ...currentProgress, unlocked: [...currentProgress.unlocked, starId] } }
          })
        }}
        onCompleteStar={(starId) => {
          const config = constellations[selectedModule.id]
          const moduleProgress = stageProgress[selectedModule.id] ?? { unlocked: [config.stars[0].id], completed: [] }
          if (moduleProgress.completed.includes(starId)) return
          const starIndex = config.stars.findIndex((star) => star.id === starId)
          const nextStar = config.stars[starIndex + 1]
          const completed = [...moduleProgress.completed, starId]
          const unlocked = nextStar && !moduleProgress.unlocked.includes(nextStar.id)
            ? [...moduleProgress.unlocked, nextStar.id]
            : moduleProgress.unlocked
          const before = new Set([...moduleProgress.unlocked, ...moduleProgress.completed])
          const after = new Set([...unlocked, ...completed])
          if (completed.length === config.stars.length) audioManager.play('moduleComplete')
          else if (nextStar && !moduleProgress.unlocked.includes(nextStar.id)) audioManager.play('starUnlock')
          if (config.edges.some((edge) => after.has(edge.from) && after.has(edge.to) && !(before.has(edge.from) && before.has(edge.to)))) {
            audioManager.play('connection')
          }
          setStageProgress((current) => ({ ...current, [selectedModule.id]: { unlocked, completed } }))
        }}
        onCompleteAll={import.meta.env.DEV ? () => {
          const config = constellations[selectedModule.id]
          const allStarIds = config.stars.map((star) => star.id)
          audioManager.play('moduleComplete')
          setStageProgress((current) => ({
            ...current,
            [selectedModule.id]: { unlocked: allStarIds, completed: allStarIds },
          }))
        } : undefined}
        onTestWorkshopIntro={import.meta.env.DEV && selectedModule.id === 'time' ? () => setHarrisonSceneOpen(true) : undefined}
      />
      {selectedArc && !harrisonSceneOpen && <ArcMapPage
        key={`${selectedArc.moduleId}-${selectedArc.starId}`}
        moduleId={selectedArc.moduleId}
        completedActIds={completedActs[selectedArc.moduleId] ?? []}
        onCompleteAct={(actId) => setCompletedActs((current) => {
          const existing = current[selectedArc.moduleId] ?? []
          if (existing.includes(actId)) return current
          return { ...current, [selectedArc.moduleId]: [...existing, actId] }
        })}
        onBack={() => {
          audioManager.play('navigation')
          setHarrisonSceneOpen(false)
          setBorderCaveSceneOpen(false)
          setSelectedArc(null)
        }}
        onStartAct={(act, devScene) => {
          if (import.meta.env.DEV && devScene) {
            audioManager.fadeMusicOut(500)
            setBorderCaveSceneOpen(true)
            setDevSceneOverride(devScene)
            return
          }
          const arc = learningArcs[selectedArc.moduleId]
          if (selectedArc.moduleId === 'time' && act.id === 'counting-marks') setBorderCaveSceneOpen(true)
          window.dispatchEvent(new CustomEvent('stonephys:start-act', {
            detail: {
              moduleId: selectedArc.moduleId,
              arcId: arc.id,
              actId: act.id,
              intent: act.status === 'completed' ? 'review' : 'start',
              sceneId: selectedArc.moduleId === 'time' && act.id === 'counting-marks' ? 'border-cave-42000-bce' : undefined,
            },
          }))
        }}
      />}
      {harrisonSceneOpen && <Suspense fallback={<div className="historical-scene-loading">{t('scene.loading')}</div>}><HarrisonWorkshopExperience onExit={() => setHarrisonSceneOpen(false)}/></Suspense>}
      {selectedArc && borderCaveSceneOpen && !harrisonSceneOpen && <BorderCaveArrival locale={locale} onExit={() => setBorderCaveSceneOpen(false)}/>}
    </>
  }

  return <main
    className={`map-screen ${transitioningModuleId ? 'map-transition-out' : ''} ${homeTransition ? 'home-transition-in' : ''}`}
    aria-label={t('app.universe')}
    onPointerDown={() => setAudioUnlocked(true)}
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && homeTransition) setHomeTransition(false)
    }}
  >
    <header className="map-header"><button className="back-button" onClick={()=>window.history.back()} aria-label={locale === 'en' ? 'Back' : 'Voltar'}><ArrowLeft size={18}/></button><h1>{t('app.modules')}</h1><AudioControls/></header>
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
      const module={...localizeModule(locale, source),progress:value,stage:stageForProgress(value)}
      return <Neuron key={module.id} module={module} locale={locale} pulse={pulse[module.id]??0} opening={transitioningModuleId===module.id} isCurrent={currentModuleId===module.id} onSelect={()=>{
        if (transitioningModuleId) return
        setAudioUnlocked(true)
        audioManager.play('neuronSelect')
        setPulse(current=>({...current,[module.id]:(current[module.id]??0)+1}))
        if(value<100)setCurrentModuleId(module.id)
        setProgress(current=>({...current,[module.id]:Math.min(100,(current[module.id]??source.progress)+25)}))
        setTransitioningModuleId(module.id)
        window.setTimeout(() => {
          audioManager.play('navigation')
          setSelectedModuleId(module.id)
          setTransitioningModuleId(null)
        }, 300)
      }}/>
    })}
  </main>
}
