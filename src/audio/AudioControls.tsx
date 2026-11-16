import { useEffect, useState } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import { audioManager } from './AudioManager'
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from './audioSettings'
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

  useEffect(() => {
    audioManager.setSettings(settings)
    saveAudioSettings(settings)
  }, [settings])

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
  }

  return <div className="audio-control-root">
    <button className="audio-toggle" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar áudio' : 'Configurações de áudio'} aria-expanded={open}>
      {settings.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
    {open && <section className="audio-panel" aria-label="Configurações de áudio">
      <header className="audio-panel-header">
        <div><span>STONE PHYS</span><h2>Áudio</h2></div>
        <button className="audio-close" onClick={() => setOpen(false)} aria-label="Fechar configurações de áudio"><X size={17} /></button>
      </header>
      <label className="audio-switch">
        <span><Volume2 size={15} /> Efeitos sonoros</span>
        <input type="checkbox" checked={settings.enabled} onChange={(event) => updateSettings({ enabled: event.currentTarget.checked })} />
      </label>
      <div className="audio-volumes">
        <VolumeControl label="Volume geral" value={settings.masterVolume} disabled={!settings.enabled} onChange={(masterVolume) => updateSettings({ masterVolume })} />
        <VolumeControl label="Efeitos" value={settings.effectsVolume} disabled={!settings.enabled} onChange={(effectsVolume) => updateSettings({ effectsVolume })} />
        <VolumeControl label="Música ambiente" value={settings.musicVolume} disabled={!settings.enabled} onChange={(musicVolume) => updateSettings({ musicVolume })} />
      </div>
    </section>}
  </div>
}
