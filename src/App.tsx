import { lazy, Suspense, useEffect, useState } from 'react'
import { Compass, ChartNoAxesColumnIncreasing, Trophy } from 'lucide-react'
import Neuron from './Neuron'
import { contentCatalog, getUnlockedAchievementIds } from './contentCatalog'
import ConstellationPage from './ConstellationPage'
import AudioControls from './audio/AudioControls'
import { audioManager } from './audio/AudioManager'
import ArcMapPage, { type DevSceneTarget } from './ArcMapPage'
import { localizeModule, useLocale } from './i18n'
import BorderCaveArrival from './scenes/time/BorderCaveArrival'
import dawnOfHumanity from '../content/music/dawn-of-humanity/composition.json'
import ProgressHome from './ProgressHome'
import AchievementsHome from './AchievementsHome'
import './home-tabs.css'
import { readGameProgress, resetLocalProgress, saveGameProgress, type ArcLocation } from './gameProgress'
import { readScientificNotes, scientificNoteReadEvent } from './scientificNotes'

const { modules: initialModules, stageForProgress, constellations, arcs: learningArcs } = contentCatalog

const HarrisonWorkshopExperience = lazy(() => import('./scenes/time/HarrisonWorkshopExperience'))
const TaosiScene = lazy(() => import('./scenes/time/TaosiScene'))
const VoiceStudio = lazy(() => import('./narration/VoiceStudio'))
const MusicStudio = lazy(() => import('./music/MusicStudio'))
const SoundEffectsStudio = lazy(() => import('./sound-effects/SoundEffectsStudio'))
const studioRoutes = new Map([
  ['/__voice-studio', { Component: VoiceStudio, loading: 'Abrindo o estúdio de voz…' }],
  ['/__audio-studio', { Component: MusicStudio, loading: 'Abrindo o estúdio de música…' }],
  ['/__sound-effects-studio', { Component: SoundEffectsStudio, loading: 'Abrindo o estúdio de efeitos…' }],
])
const packagedMusic = import.meta.glob('../content/music/*/composition.json', { eager: true, import: 'default' }) as Record<string, Record<string, any>>
const workshopIntroStorageKey = 'stonephys.time.arc-one.workshop-intro-seen.v1'
function hasSeenWorkshopIntro() {
  try { return window.localStorage.getItem(workshopIntroStorageKey) === 'true' } catch { return false }
}

function startLebomboDiscoveryMusic() {
  const composition = dawnOfHumanity as typeof dawnOfHumanity & { approvedAssetUrl?: string; approvedVolume?: number; approvedCropStartSeconds?: number; approvedCropEndSeconds?: number | null; introVolume?: { gain?: number }; loop?: { crossfadeMs?: number } }
  if (!composition.approvedAssetUrl) return Promise.resolve()
  audioManager.setNarrationMusicLevel(composition.ducking.musicLevelDuringNarration)
  return audioManager.playMusicAsset(composition.approvedAssetUrl, {
    fadeMs: 0,
    loop: true,
    loopCrossfadeMs: composition.loop?.crossfadeMs ?? 1800,
    trackGain: composition.introVolume?.gain ?? composition.defaultVolume,
    volume: composition.approvedVolume,
    cropStartSeconds: composition.approvedCropStartSeconds,
    cropEndSeconds: composition.approvedCropEndSeconds,
  })
}

export default function App() {
  const studio = import.meta.env.DEV ? studioRoutes.get(window.location.pathname) : undefined
  const { locale, t } = useLocale()
  const [initialGameProgress] = useState(readGameProgress)
  const [pulse, setPulse] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, number>>(() => Object.fromEntries(Object.entries(initialGameProgress.modules).map(([id, item]) => [id, item.progress])))
  const [currentModuleId, setCurrentModuleId] = useState(() => initialModules.find((module) => module.status === 'unlocked')?.id ?? initialModules[0].id)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [homeTab, setHomeTab] = useState<'progress' | 'explore' | 'achievements'>('progress')
  const [selectedArc, setSelectedArc] = useState<ArcLocation | null>(null)
  const [harrisonSceneOpen, setHarrisonSceneOpen] = useState(false)
  const [borderCaveSceneOpen, setBorderCaveSceneOpen] = useState(false)
  const [taosiSceneOpen, setTaosiSceneOpen] = useState(false)
  const [devSceneOverride, setDevSceneOverride] = useState<DevSceneTarget | null>(null)
  const [workshopIntroSeen, setWorkshopIntroSeen] = useState(hasSeenWorkshopIntro)
  const [transitioningModuleId, setTransitioningModuleId] = useState<string | null>(null)
  const [homeTransition, setHomeTransition] = useState(false)
  const [stageProgress, setStageProgress] = useState<Record<string, { unlocked: string[]; completed: string[] }>>(initialGameProgress.arcs)
  const [journey, setJourney] = useState(() => ({ lastArc: initialGameProgress.lastArc, completedActs: initialGameProgress.acts }))
  const [completedScenes, setCompletedScenes] = useState<string[]>(initialGameProgress.scenes.completed)
  const [scientificNoteCount, setScientificNoteCount] = useState(() => readScientificNotes().length)
  const { completedActs, lastArc } = journey
  const [music, setMusic] = useState<any[]>([])
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    const achieved = getUnlockedAchievementIds(completedActs.time ?? [], scientificNoteCount)
    saveGameProgress({
      version: 1,
      updatedAt: new Date().toISOString(),
      lastArc,
      modules: Object.fromEntries(initialModules.map((module) => [module.id, { progress: progress[module.id] ?? 0, status: module.status }])),
      arcs: stageProgress,
      acts: completedActs,
      scenes: { completed: completedScenes },
      achievements: { unlocked: achieved },
    })
  }, [lastArc, completedActs, progress, stageProgress, completedScenes, scientificNoteCount])

  useEffect(() => {
    const onNoteRead = () => setScientificNoteCount(readScientificNotes().length)
    window.addEventListener(scientificNoteReadEvent, onNoteRead)
    return () => window.removeEventListener(scientificNoteReadEvent, onNoteRead)
  }, [])

  useEffect(() => {
    if (!borderCaveSceneOpen || selectedArc?.moduleId !== 'time') return
    const completeLebombo = () => {
      setJourney((current) => {
        const existing = current.completedActs.time ?? []
        return existing.includes('counting-marks') ? current : { ...current, completedActs: { ...current.completedActs, time: [...existing, 'counting-marks'] } }
      })
      setCompletedScenes((current) => current.includes('lebombo-bone-activity') ? current : [...current, 'lebombo-bone-activity'])
    }
    window.addEventListener('stonephys:lebombo-activity-complete', completeLebombo)
    return () => window.removeEventListener('stonephys:lebombo-activity-complete', completeLebombo)
  }, [borderCaveSceneOpen, selectedArc])

  const openArc = (location: ArcLocation) => {
    setSelectedArc(location)
    setJourney((current) => ({ ...current, lastArc: location }))
  }

  const resetProgress = () => {
    const empty = resetLocalProgress()
    setProgress(Object.fromEntries(Object.entries(empty.modules).map(([id, item]) => [id, item.progress])))
    setStageProgress(empty.arcs)
    setJourney({ lastArc: empty.lastArc, completedActs: empty.acts })
    setCompletedScenes(empty.scenes.completed)
    setScientificNoteCount(0)
    setWorkshopIntroSeen(false)
    setSelectedArc(null)
    setSelectedModuleId(null)
    setHarrisonSceneOpen(false)
    setBorderCaveSceneOpen(false)
    setTaosiSceneOpen(false)
    setDevSceneOverride(null)
  }

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
            const version = effect.versions?.find((item: any) => item.id === effect.approvedVersionId)
              ?? effect.versions?.find((item: any) => item.id === effect.previewVersionId)
            const url = version
              ? `/__voice-studio/api/sfx/file/${effect.id}/${version.id}`
              : effect.approvedAssetUrl
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
    if (studio) {
      audioManager.stopMusic()
      return
    }
    if (taosiSceneOpen) {
      audioManager.stopMusicImmediately()
      return
    }
    if (borderCaveSceneOpen || (import.meta.env.DEV && ['/__border-cave-preview', '/__lebombo-discovery-preview'].includes(window.location.pathname))) return
    const wisdomSanctuaryApproved = import.meta.env.DEV
      ? music.some((item) => item.id === 'the-sanctuary-of-wisdom' && item.approvedVersionId)
      : Object.entries(packagedMusic).some(([file, item]) => file.includes('/the-sanctuary-of-wisdom/composition.json') && item.approvedAssetUrl)
    const targetId = harrisonSceneOpen
      ? 'the-clockmaker-of-time'
      : selectedArc ? wisdomSanctuaryApproved ? 'the-sanctuary-of-wisdom' : 'paths-of-discovery' : 'eternity-of-knowledge'
    if (!targetId) { audioManager.stopMusicImmediately(); return }
    const composition = music.find((item) => item.id === targetId)
    const packaged = Object.entries(packagedMusic).find(([file]) => file.includes(`/${targetId}/composition.json`))?.[1]
    const source = import.meta.env.DEV ? composition?.previewUrl : packaged?.approvedAssetUrl
    const settings = composition || packaged
    const loopSettings = import.meta.env.DEV ? composition?.previewLoop || composition?.loop : packaged?.approvedLoop || packaged?.loop
    const cropStartSeconds = import.meta.env.DEV ? composition?.previewCropStartSeconds ?? 0 : packaged?.approvedCropStartSeconds ?? 0
    const cropEndSeconds = import.meta.env.DEV ? composition?.previewCropEndSeconds ?? null : packaged?.approvedCropEndSeconds ?? null
    const volume = import.meta.env.DEV ? composition?.previewVolume ?? 1 : packaged?.approvedVolume ?? 1
    audioManager.setNarrationMusicLevel(settings?.ducking?.musicLevelDuringNarration ?? .42)
    if (!source) { audioManager.stopMusicImmediately(); return }
    // Loop behavior is configured in Music Studio; tracks default to looping.
    const fadeMs = selectedArc || harrisonSceneOpen ? 0 : loopSettings?.crossfadeMs ?? 1800
    void audioManager.playMusicAsset(source, { loop: loopSettings?.enabled ?? true, fadeMs, loopCrossfadeMs: loopSettings?.crossfadeMs ?? 1800, trackGain: settings?.defaultVolume ?? .2, volume, cropStartSeconds, cropEndSeconds }).catch(() => {})
  }, [studio, music, selectedModuleId, selectedArc, harrisonSceneOpen, borderCaveSceneOpen, taosiSceneOpen, audioUnlocked])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${t('app.brand')} — ${t('app.title')}`
  }, [locale, t])

  if (studio) {
    const { Component, loading } = studio
    return <Suspense fallback={<div className="historical-scene-loading">{loading}</div>}><Component onClose={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/></Suspense>
  }
  if (import.meta.env.DEV && window.location.pathname === '/__border-cave-preview') return <BorderCaveArrival locale={locale} onExit={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/>
  if (import.meta.env.DEV && window.location.pathname === '/__lebombo-discovery-preview') return <BorderCaveArrival locale={locale} startInDiscovery onExit={() => { window.history.replaceState(null, '', '/'); window.location.reload() }}/>
  if (import.meta.env.DEV && devSceneOverride === 'border-cave-cycle') return <BorderCaveArrival locale={locale} onExit={() => { setDevSceneOverride(null); setBorderCaveSceneOpen(false) }}/>
  if (import.meta.env.DEV && devSceneOverride === 'lebombo-discovery') return <BorderCaveArrival locale={locale} startInDiscovery onExit={() => { setDevSceneOverride(null); setBorderCaveSceneOpen(false) }}/>
  if (import.meta.env.DEV && devSceneOverride === 'lebombo-bone-activity') return <BorderCaveArrival locale={locale} startInBoneActivity onExit={() => { setDevSceneOverride(null); setBorderCaveSceneOpen(false) }}/>
  if (taosiSceneOpen) return <Suspense fallback={<div className="historical-scene-loading">{t('scene.loading')}</div>}><TaosiScene onExit={() => { audioManager.stopMusicImmediately(); setTaosiSceneOpen(false) }}/></Suspense>

  const selectedModule = selectedModuleId ? initialModules.find((module) => module.id === selectedModuleId) : null
  if (selectedModule && constellations[selectedModule.id]) {
    return <>
      {homeTab === 'explore' && <ConstellationPage
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
          openArc({ moduleId: selectedModule.id, starId: star.id })
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
      />}
      {selectedArc && !harrisonSceneOpen && <ArcMapPage
        key={`${selectedArc.moduleId}-${selectedArc.starId}`}
        moduleId={selectedArc.moduleId}
        backToProgress={homeTab === 'progress'}
        completedActIds={completedActs[selectedArc.moduleId] ?? []}
        onCompleteAct={(actId) => setJourney((current) => {
          const existing = current.completedActs[selectedArc.moduleId] ?? []
          return existing.includes(actId) ? current : { ...current, completedActs: { ...current.completedActs, [selectedArc.moduleId]: [...existing, actId] } }
        })}
        onBack={() => {
          audioManager.play('navigation')
          audioManager.stopMusicImmediately()
          setHarrisonSceneOpen(false)
          setBorderCaveSceneOpen(false)
          setTaosiSceneOpen(false)
          setSelectedArc(null)
          if (homeTab === 'progress') setSelectedModuleId(null)
        }}
        onStartAct={(act, devScene) => {
          // Starting a scene is a direct user gesture; unlock audio here so
          // browser autoplay restrictions do not silently suppress ambience.
          void audioManager.resumeAudioContext().catch(() => {})
          if (import.meta.env.DEV && devScene) {
            audioManager.stopMusicImmediately()
            if (devScene === 'lebombo-discovery') void startLebomboDiscoveryMusic().catch(() => {})
            setBorderCaveSceneOpen(true)
            setDevSceneOverride(devScene)
            return
          }
          const arc = learningArcs[selectedArc.moduleId]
          if (selectedArc.moduleId === 'time' && act.id === 'counting-marks') {
            audioManager.stopMusicImmediately()
            setBorderCaveSceneOpen(true)
          }
          if (selectedArc.moduleId === 'time' && act.id === 'age-of-sun') {
            audioManager.stopMusicImmediately()
            setTaosiSceneOpen(true)
          }
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
      {selectedArc && borderCaveSceneOpen && !harrisonSceneOpen && <BorderCaveArrival locale={locale} onExit={() => { audioManager.stopMusicImmediately(); setBorderCaveSceneOpen(false) }}/>}
    </>
  }

  const english = locale === 'en'
  const selectHomeTab = (tab: 'progress' | 'explore' | 'achievements') => {
    setAudioUnlocked(true)
    void audioManager.resumeAudioContext().catch(() => {})
    audioManager.play('navigation')
    setHomeTab(tab)
  }
  return <>
  {homeTab === 'progress' ? <ProgressHome
    locale={locale}
    completedActs={completedActs}
    stageProgress={stageProgress}
    moduleProgress={progress}
    lastArc={lastArc}
    onContinue={() => {
      const location = lastArc ?? { moduleId: 'time', starId: 'sky' }
      setAudioUnlocked(true)
      void audioManager.resumeAudioContext().catch(() => {})
      audioManager.play('navigation')
      setSelectedModuleId(location.moduleId)
      openArc(location)
    }}
    onStartJourney={() => {
      const firstArc: ArcLocation = { moduleId: 'time', starId: 'sky' }
      setAudioUnlocked(true)
      void audioManager.resumeAudioContext().catch(() => {})
      audioManager.play('navigation')
      setSelectedModuleId(firstArc.moduleId)
      openArc(firstArc)
      setWorkshopIntroSeen(true)
      try { window.localStorage.setItem(workshopIntroStorageKey, 'true') } catch { /* Keep the intro available for this session. */ }
      setHarrisonSceneOpen(true)
    }}
    onResetProgress={import.meta.env.DEV ? resetProgress : undefined}
  /> : homeTab === 'achievements' ? <AchievementsHome locale={locale} lebomboComplete={completedActs.time?.includes('counting-marks') ?? false}/> : <main
    className={`map-screen ${transitioningModuleId ? 'map-transition-out' : ''} ${homeTransition ? 'home-transition-in' : ''}`}
    aria-label={t('app.universe')}
    onPointerDown={() => setAudioUnlocked(true)}
    onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && homeTransition) setHomeTransition(false)
    }}
  >
    <header className="map-header"><AudioControls/></header>
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
  </main>}
  <nav className="home-tabs" aria-label={english ? 'Main navigation' : 'Navegação principal'}>
    <button type="button" aria-current={homeTab === 'progress' ? 'page' : undefined} disabled={Boolean(transitioningModuleId)} onClick={() => selectHomeTab('progress')}>
      <ChartNoAxesColumnIncreasing size={21} aria-hidden="true"/>{english ? 'Progress' : 'Progresso'}
    </button>
    <button type="button" aria-current={homeTab === 'explore' ? 'page' : undefined} disabled={Boolean(transitioningModuleId)} onClick={() => selectHomeTab('explore')}>
      <Compass size={21} aria-hidden="true"/>{english ? 'Explore' : 'Explorar'}
    </button>
    <button type="button" aria-current={homeTab === 'achievements' ? 'page' : undefined} disabled={Boolean(transitioningModuleId)} onClick={() => selectHomeTab('achievements')}>
      <Trophy size={21} aria-hidden="true"/>{english ? 'Achievements' : 'Conquistas'}
    </button>
  </nav>
  </>
}
