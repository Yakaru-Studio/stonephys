import { useEffect, useState } from 'react'
import { AudioLines, Music2, Volume2, VolumeX, X } from 'lucide-react'
import { audioManager } from './AudioManager'
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from './audioSettings'
import { useLocale } from '../i18n'
import './audio.css'

function VolumeControl({ label, value, disabled, onChange }: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return <label className="audio-slider">
    <span>{label}<strong>{Math.round(value * 100)}%</strong></span>
    <input type="range" min="0" max="1" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.currentTarget.value))} />
  </label>
}

export default function AudioControls() {
  const [settings, setSettings] = useState<AudioSettings>(loadAudioSettings)
  const [open, setOpen] = useState(false)
  const { locale, setLocale, t } = useLocale()

  useEffect(() => {
    audioManager.setSettings(settings)
    saveAudioSettings(settings)
  }, [settings])

  useEffect(() => {
    const syncSettings = (event: Event) => {
      const detail = (event as CustomEvent<AudioSettings>).detail
      setSettings(detail ?? loadAudioSettings())
    }
    const syncFromStorage = () => setSettings(loadAudioSettings())
    window.addEventListener('stonephys:audio-settings-changed', syncSettings)
    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.removeEventListener('stonephys:audio-settings-changed', syncSettings)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const updateSettings = (changes: Partial<AudioSettings>) => {
    const next = { ...settings, ...changes }
    setSettings(next)
    audioManager.setSettings(next)
    saveAudioSettings(next)
    window.dispatchEvent(new CustomEvent<AudioSettings>('stonephys:audio-settings-changed', { detail: next }))
  }

  return <div className="audio-control-root">
    <button className="audio-toggle" onClick={() => { void audioManager.resumeAudioContext().catch(() => {}); setOpen((value) => !value) }} aria-label={open ? t('audio.close') : t('audio.open')} aria-expanded={open}>
      {settings.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
    {open && <section className="audio-panel" aria-label={t('audio.title')}>
      <header className="audio-panel-header">
        <div><span>SHARP STONE</span><h2>{t('audio.title')}</h2></div>
        <button className="audio-close" onClick={() => setOpen(false)} aria-label={t('audio.close')}><X size={17} /></button>
      </header>
      <label className="audio-switch">
        <span><Volume2 size={15} /> {t('audio.effects')}</span>
        <input type="checkbox" checked={settings.enabled} onChange={(event) => updateSettings({ enabled: event.currentTarget.checked })} />
      </label>
      <label className="audio-switch audio-music-switch">
        <span><Music2 size={15} /> {t('audio.musicToggle')}</span>
        <input type="checkbox" checked={settings.musicEnabled} onChange={(event) => updateSettings({ musicEnabled: event.currentTarget.checked })} />
      </label>
      <div className="audio-volumes">
        <VolumeControl label={t('audio.master')} value={settings.masterVolume} disabled={!settings.enabled} onChange={(masterVolume) => updateSettings({ masterVolume })} />
        <VolumeControl label={t('audio.effects')} value={settings.effectsVolume} disabled={!settings.enabled} onChange={(effectsVolume) => updateSettings({ effectsVolume })} />
        <VolumeControl label={locale === 'en' ? 'Ambience' : 'Ambiência'} value={settings.ambienceVolume} disabled={!settings.enabled} onChange={(ambienceVolume) => updateSettings({ ambienceVolume })} />
        <VolumeControl label={t('audio.music')} value={settings.musicVolume} disabled={!settings.enabled || !settings.musicEnabled} onChange={(musicVolume) => updateSettings({ musicVolume })} />
        <VolumeControl label={t('audio.voice')} value={settings.voiceVolume} disabled={!settings.enabled} onChange={(voiceVolume) => updateSettings({ voiceVolume })} />
      </div>
      <label className="audio-language"><span>{t('audio.language')}</span><select value={locale} onChange={(event) => setLocale(event.currentTarget.value as 'pt-BR' | 'en')}><option value="pt-BR">{t('audio.portuguese')}</option><option value="en">{t('audio.english')}</option></select></label>
      {import.meta.env.DEV && <nav className="audio-studio-links" aria-label={locale === 'en' ? 'Audio studios' : 'Estúdios de áudio'}>
        <span>{locale === 'en' ? 'Audio studios' : 'Estúdios de áudio'}</span>
        <a href="/__voice-studio">Voice Studio <small>{locale === 'en' ? 'Narration' : 'Narração'}</small></a>
        <a href="/__audio-studio"><Music2 size={14}/> Music Studio <small>{locale === 'en' ? 'Original soundtracks' : 'Trilhas originais'}</small></a>
        <a href="/__sound-effects-studio"><AudioLines size={14}/> Sound Effects Studio <small>{locale === 'en' ? 'Foley and effects' : 'Foley e efeitos'}</small></a>
      </nav>}
    </section>}
  </div>
}
