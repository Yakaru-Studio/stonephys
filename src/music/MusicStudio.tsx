import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Check, Download, Music2, Pause, Play, Save, Upload } from 'lucide-react'
import './music-studio.css'

const API = '/__voice-studio/api/music'
const AUTHORIZATION = 'I understand this may consume quota or be billed'
const PROMPT_LIMIT = 12000
const NOTES_LIMIT = 2000
type Version = { id: string; model: string; prompt: string; status: string; source?: string; createdAt: string; generatedAt?: string; durationMs?: number; cropStartSeconds?: number; cropEndSeconds?: number | null; volume?: number; bytes?: number; estimatedUsd?: number; fileName?: string; error?: string; notes?: string; validation?: Record<string, any>; loop?: { enabled: boolean; startSeconds: number; endSeconds: number | null; crossfadeMs: number } }
type TrackSettings = { startSeconds: number; endSeconds: number; volume: number }
type Composition = { id: string; name: Record<string, string>; description: Record<string, string>; application: string[]; targetDurationSeconds: number; targetBpm: string; defaultVolume: number; loop: NonNullable<Version['loop']>; versions: Version[]; previewVersionId: string | null; approvedVersionId: string | null; prompt: string }
type Library = { apiConfigured: boolean; model: string; priceUsd: number; spentUsd: number; sessionLimitUsd: number; callCount: number; compositions: Composition[] }

export default function MusicStudio({ onClose }: { onClose: () => void }) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('composition') || 'eternity-of-knowledge')
  const [prompt, setPrompt] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})
  const [loop, setLoop] = useState(true)
  const [crossfadeMs, setCrossfadeMs] = useState(2500)
  const [playingId, setPlayingId] = useState('')
  const [trackSettings, setTrackSettings] = useState<Record<string, TrackSettings>>({})
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Carregando biblioteca de música. Nenhuma chamada de geração acontece ao abrir esta tela.')
  const audio = useRef<HTMLAudioElement>(null)
  const activeVersionId = useRef('')
  const fileInput = useRef<HTMLInputElement>(null)
  const locale = document.documentElement.lang === 'en' ? 'en' : 'pt-BR'
  const selected = library?.compositions.find((item) => item.id === selectedId)
  const nextAdjustments = adjustments[selectedId] ?? ''
  const notesFor = (version: Version) => notes[version.id] ?? version.notes ?? ''
  const settingsFor = (version: Version): TrackSettings => {
    const mediaDuration = Math.max(.1, (version.durationMs ?? (playingId === version.id ? duration * 1000 : 0) ?? 0) / 1000 || selected?.targetDurationSeconds || 1)
    const saved = trackSettings[version.id]
    return { startSeconds: saved?.startSeconds ?? version.cropStartSeconds ?? 0, endSeconds: saved?.endSeconds ?? version.cropEndSeconds ?? mediaDuration, volume: saved?.volume ?? version.volume ?? 1 }
  }

  const refresh = useCallback(async () => {
    const response = await fetch(`${API}/status`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o Music Studio.')
    setLibrary(result)
    const composition = result.compositions.find((item: Composition) => item.id === selectedId) || result.compositions[0]
    if (composition) setSelectedId(composition.id)
  }, [selectedId])

  useEffect(() => { refresh().then(() => setStatus('Biblioteca local pronta. O estúdio não gera áudio automaticamente.')).catch((error) => setStatus(error.message)) }, [refresh])
  const savedPrompt = selected?.prompt
  useEffect(() => { setPrompt(savedPrompt ?? '') }, [selectedId, savedPrompt])
  useEffect(() => { if (!selected) return; setLoop(selected.loop.enabled); setCrossfadeMs(selected.loop.crossfadeMs) }, [selectedId, library])
  useEffect(() => {
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load() }
    activeVersionId.current = ''; setPlayingId(''); setCurrentTime(0); setDuration(0)
  }, [selectedId])
  useEffect(() => {
    const element = audio.current
    if (!element) return
    const update = () => { setCurrentTime(element.currentTime); setDuration(Number.isFinite(element.duration) ? element.duration : 0) }
    element.addEventListener('timeupdate', update); element.addEventListener('loadedmetadata', update)
    return () => { element.removeEventListener('timeupdate', update); element.removeEventListener('loadedmetadata', update) }
  }, [])
  useEffect(() => {
    const element = audio.current
    if (!element) return
    const cropPlayback = () => {
      const version = selected?.versions.find((item) => item.id === activeVersionId.current)
      if (!version) return
      const crop = settingsFor(version)
      element.volume = crop.volume
      if (element.currentTime < crop.startSeconds) element.currentTime = crop.startSeconds
      if (element.currentTime >= crop.endSeconds) {
        if (loop) element.currentTime = crop.startSeconds
        else { element.pause(); element.currentTime = crop.endSeconds }
      }
    }
    element.addEventListener('timeupdate', cropPlayback)
    return () => element.removeEventListener('timeupdate', cropPlayback)
  }, [selected, trackSettings, loop, duration, playingId])

  const api = async (route: string, body?: unknown) => {
    const response = await fetch(`${API}${route}`, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `Falha local: ${response.status}`)
    return result
  }
  const perform = async (label: string, operation: () => Promise<void>) => {
    setBusy(true); setStatus(label)
    try { await operation(); await refresh() }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Ocorreu um erro.') }
    finally { setBusy(false) }
  }
  const savePrompt = async () => {
    if (!selected) return
    await api('/prompt', { compositionId: selected.id, prompt })
    setStatus('Prompt salvo no histórico de versões.')
    await refresh()
  }
  const generate = async () => {
    if (!selected || !library) return
    const instructions = nextAdjustments.trim()
    const basePrompt = prompt.trim()
    const generationPrompt = instructions ? `${basePrompt}\n\nRevision instructions (take precedence where they conflict with the base brief):\n${instructions}` : basePrompt
    if (!basePrompt || generationPrompt.length > PROMPT_LIMIT) {
      setStatus('Preencha o prompt musical. O prompt e os ajustes juntos podem ter até 12.000 caracteres.')
      return
    }
    const remaining = Math.max(0, library.sessionLimitUsd - library.spentUsd)
    if (remaining + 1e-8 < library.priceUsd) { setStatus(`O limite autorizado de US$ ${library.sessionLimitUsd.toFixed(2)} foi alcançado.`); return }
    if (!window.confirm(`Gerar uma música completa com ${library.model}?\n\nComposição: ${selected.name[locale]}\nDuração pretendida: ~${Math.round(selected.targetDurationSeconds / 60)} min\nCusto estimado: US$ ${library.priceUsd.toFixed(2)}\nJá reservado: US$ ${library.spentUsd.toFixed(2)} de US$ ${library.sessionLimitUsd.toFixed(2)}\nApós esta chamada: até US$ ${(library.spentUsd + library.priceUsd).toFixed(2)}\n\nA geração pode levar alguns minutos. Nenhuma repetição será feita automaticamente. Continuar?`)) return
    await perform('Gerando a faixa completa. Esta chamada pode levar alguns minutos; não feche o servidor local.', async () => {
      await api('/prompt', { compositionId: selected.id, prompt })
      await api('/generate', { authorization: AUTHORIZATION, compositionId: selected.id, prompt: generationPrompt, requestId: crypto.randomUUID(), forceNewVersion: true })
      setAdjustments((current) => ({ ...current, [selected.id]: '' }))
      setStatus('Faixa gerada e adicionada ao histórico. Ouça e revise antes de aprovar.')
    })
  }
  const playVersion = async (version: Version) => {
    if (!selected || !audio.current) return
    const element = audio.current
    const url = `${API}/file/${selected.id}/${version.id}`
    if (playingId === version.id && !element.paused) { element.pause(); setPlayingId(''); return }
    const crop = settingsFor(version)
    element.pause(); activeVersionId.current = version.id; element.src = url; element.loop = false; element.volume = crop.volume; setPlayingId(version.id)
    try { element.currentTime = crop.startSeconds } catch { /* metadata will apply the crop once loaded */ }
    try { await element.play() } catch (error) { setPlayingId(''); setStatus(error instanceof Error ? error.message : 'Não foi possível reproduzir o áudio.') }
  }
  const saveMetadata = async (version: Version) => {
    if (!selected) return
    const crop = settingsFor(version)
    const nextLoop = { enabled: loop, startSeconds: crop.startSeconds, endSeconds: crop.endSeconds, crossfadeMs }
    await api('/metadata', { compositionId: selected.id, versionId: version.id, durationMs: duration ? Math.round(duration * 1000) : version.durationMs, cropStartSeconds: crop.startSeconds, cropEndSeconds: crop.endSeconds, volume: crop.volume, loop: nextLoop })
    if (playingId === version.id && audio.current) { audio.current.volume = crop.volume; if (audio.current.currentTime < crop.startSeconds || audio.current.currentTime >= crop.endSeconds) audio.current.currentTime = crop.startSeconds }
    window.dispatchEvent(new CustomEvent('stonephys:music-preview-changed'))
    setStatus('Recorte, volume e loop salvos para esta versão. Você pode alterá-los novamente quando quiser.')
    await refresh()
  }
  const review = async (version: Version, state: 'approved' | 'rejected') => {
    if (!selected) return
    if (state === 'approved' && !window.confirm('Aprovar esta versão artisticamente e copiá-la para assets/audio/music/approved? A aprovação é uma ação humana explícita.')) return
    const reviewNotes = notesFor(version).trim()
    await perform(state === 'approved' ? 'Registrando aprovação e copiando para assets do projeto…' : 'Registrando rejeição…', async () => {
      await api('/review', { compositionId: selected.id, versionId: version.id, status: state, notes: reviewNotes })
      setNotes((current) => ({ ...current, [version.id]: reviewNotes }))
      if (state === 'rejected' && reviewNotes) {
        setAdjustments((current) => ({ ...current, [selected.id]: current[selected.id]?.trim() ? current[selected.id] : reviewNotes }))
      }
      setStatus(state === 'approved' ? 'Versão aprovada.' : 'Versão rejeitada. Você pode editar os ajustes antes de gerar outra faixa.')
    })
  }
  const selectPreview = async (version: Version | null) => {
    if (!selected) return
    await perform('Salvando faixa de prévia…', async () => {
      await api('/preview', { compositionId: selected.id, versionId: version?.id || null })
      window.dispatchEvent(new CustomEvent('stonephys:music-preview-changed'))
    })
  }
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    if (!file.type.startsWith('audio/')) { setStatus('Escolha um arquivo de áudio.'); return }
    await perform('Importando áudio local para revisão…', async () => {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); reader.readAsDataURL(file) })
      await api('/import', { compositionId: selected.id, fileName: file.name, data: dataUrl.split(',')[1] })
    })
    event.target.value = ''
  }
  const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  const targetLength = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const date = (value: string) => new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR')

  return <main className="music-studio">
    <header className="music-studio-header"><button onClick={onClose} aria-label={locale === 'en' ? 'Back' : 'Voltar'}><ArrowLeft size={18}/></button><div><span>SHARPSTONE PHYS · AUDIO LAB</span><h1>{locale === 'en' ? 'Original music' : 'Músicas originais'}</h1></div><Music2 size={22}/><a href="/__voice-studio">Voice Studio</a></header>
    <section className="music-studio-summary"><div><strong>{library?.model || 'lyria-3.5'}</strong><span> · US$ {library?.priceUsd.toFixed(2) || '0.08'} / faixa completa</span></div><div className="music-budget"><span>US$ {(library?.spentUsd || 0).toFixed(2)} / US$ {(library?.sessionLimitUsd || 1.50).toFixed(2)}</span><progress max={library?.sessionLimitUsd || 1.50} value={library?.spentUsd || 0}/><small>{library?.callCount || 0} chamadas reservadas · teto validado no servidor</small></div></section>
    <aside className="music-studio-notice"><strong>Revisão e direitos</strong><p>Geração não significa aprovação artística. Os termos consultados do Gemini API não concedem uma licença comercial clara de redistribuição do áudio gerado. Mantenha as versões locais até esclarecer os direitos para lançamento comercial.</p></aside>
    <div className="music-studio-layout"><nav className="music-compositions" aria-label="Composições">{library?.compositions.map((item) => <button key={item.id} className={selectedId === item.id ? 'selected' : ''} disabled={busy} onClick={() => setSelectedId(item.id)}><strong>{item.name[locale]}</strong><small>{item.versions.length} {locale === 'en' ? 'versions' : 'versões'} · ~{targetLength(item.targetDurationSeconds)}</small><span>{item.approvedVersionId ? 'Aprovada' : 'Aguardando revisão'}</span></button>)}</nav>
      {selected && <article className="music-composition"><header><div><span>COMPOSIÇÃO ORIGINAL</span><h2>{selected.name[locale]}</h2><p>{selected.description[locale]}</p></div><div className="music-tags"><span>{selected.targetBpm} BPM</span><span>~{targetLength(selected.targetDurationSeconds)}</span></div></header>
        <label>Prompt musical<textarea value={prompt} maxLength={PROMPT_LIMIT} disabled={busy} onChange={(event) => setPrompt(event.target.value)} rows={7}/></label>
        {selected.versions.length > 0 && <label>Ajustes para a próxima geração<textarea rows={3} value={nextAdjustments} maxLength={NOTES_LIMIT} disabled={busy} onChange={(event) => setAdjustments({ ...adjustments, [selected.id]: event.target.value })} placeholder="Ex.: antecipar o chamado vocal e suavizar a percussão."/></label>}
        <div className="music-actions"><button onClick={() => void perform('Salvando prompt…', savePrompt)} disabled={busy}><Save size={15}/>Salvar prompt</button><button className="primary" onClick={() => void generate()} disabled={busy || !library?.apiConfigured || (library.spentUsd + library.priceUsd > library.sessionLimitUsd + .000001)}><Music2 size={15}/>{selected.versions.length ? 'Gerar nova versão' : 'Gerar faixa'} · US$ {library?.priceUsd.toFixed(2) || '0.08'}</button><button onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={15}/>Importar áudio</button><input ref={fileInput} type="file" accept="audio/*" hidden onChange={(event) => void importFile(event)}/></div>
        {!library?.apiConfigured && <p className="music-warning">Configure GEMINI_API_KEY no .env.local e reinicie o servidor Vite para habilitar geração.</p>}
        <div className="music-loop-controls"><label><input type="checkbox" checked={loop} onChange={(event) => { setLoop(event.target.checked); if (audio.current) audio.current.loop = event.target.checked }}/> Repetir a faixa automaticamente</label><label>Transição entre repetições <input type="number" min="0" max="12000" step="250" value={crossfadeMs} onChange={(event) => setCrossfadeMs(Math.max(0, Math.min(12000, Number(event.target.value))))}/> ms</label><small>Personalize se a faixa repete e a duração da transição. Salve junto aos ajustes da versão para aplicar no app.</small></div>
        <section className="music-history"><h3>Histórico de versões</h3>{selected.versions.length === 0 && <p>Nenhuma versão ainda. Os prompts podem ser ajustados antes de cada geração.</p>}{selected.versions.map((version, index) => { const crop = settingsFor(version); const mediaDuration = Math.max(.1, (version.durationMs || (playingId === version.id ? duration * 1000 : 0) || selected.targetDurationSeconds * 1000) / 1000); return <div className={`music-version ${version.status === 'approved' ? 'approved' : ''}`} key={version.id}><div className="music-version-heading"><strong>Versão {selected.versions.length - index} · {version.source === 'imported' ? 'Importada' : version.model}</strong><span>{version.status}</span><small>{date(version.generatedAt || version.createdAt)} · {version.durationMs ? fmt(version.durationMs / 1000) : 'duração aguardando leitura'}</small></div>
          {version.fileName ? <><div className="music-player"><button className="music-play-button" onClick={() => void playVersion(version)} aria-label={playingId === version.id ? 'Pausar faixa' : 'Ouvir faixa'}>{playingId === version.id ? <Pause size={15}/> : <Play size={15}/>}<span>{playingId === version.id ? 'Pausar' : 'Ouvir faixa'}</span></button><input aria-label="Posição no recorte" type="range" min={crop.startSeconds} max={crop.endSeconds} value={playingId === version.id ? Math.min(currentTime, crop.endSeconds) : crop.startSeconds} disabled={playingId !== version.id} onChange={(event) => { if (audio.current) audio.current.currentTime = Number(event.target.value) }}/><small>{fmt(playingId === version.id ? currentTime : crop.startSeconds)} / {fmt(crop.endSeconds)}</small><a href={`${API}/file/${selected.id}/${version.id}?download=1`} aria-label="Baixar faixa"><Download size={15}/></a></div><div className="music-edit-controls"><label>Início do recorte (s)<input type="number" min="0" max={Math.max(0, crop.endSeconds - .05)} step="0.1" value={crop.startSeconds} onChange={(event) => { const value = Math.max(0, Math.min(crop.endSeconds - .05, Number(event.target.value))); setTrackSettings((current) => ({ ...current, [version.id]: { ...crop, startSeconds: value } })) }}/></label><input aria-label="Ajustar início do recorte" type="range" min="0" max={mediaDuration} step="0.1" value={crop.startSeconds} onChange={(event) => { const value = Math.min(mediaDuration - .05, Number(event.target.value)); setTrackSettings((current) => ({ ...current, [version.id]: { ...crop, startSeconds: value } })) }}/><label>Fim do recorte (s)<input type="number" min={crop.startSeconds + .05} max={mediaDuration} step="0.1" value={crop.endSeconds} onChange={(event) => { const value = Math.max(crop.startSeconds + .05, Math.min(mediaDuration, Number(event.target.value))); setTrackSettings((current) => ({ ...current, [version.id]: { ...crop, endSeconds: value } })) }}/></label><input aria-label="Ajustar fim do recorte" type="range" min="0.05" max={mediaDuration} step="any" value={crop.endSeconds} onChange={(event) => { const value = Math.max(crop.startSeconds + .05, Number(event.target.value)); setTrackSettings((current) => ({ ...current, [version.id]: { ...crop, endSeconds: value } })) }}/><label className="music-volume-control">Volume da faixa · {Math.round(crop.volume * 100)}%<input type="range" min="0" max="1" step="0.01" value={crop.volume} onChange={(event) => { const value = Number(event.target.value); setTrackSettings((current) => ({ ...current, [version.id]: { ...crop, volume: value } })); if (playingId === version.id && audio.current) audio.current.volume = value }}/></label><small>O recorte e o volume podem ser salvos e alterados novamente a qualquer momento.</small></div><p className="music-validation">{version.bytes ? `${(version.bytes / 1024 / 1024).toFixed(1)} MB` : ''} {version.validation?.ffprobe ? `· ${version.validation.sampleRate} Hz · ${version.validation.channels} canais` : '· formato/duração conferidos no navegador'} {version.validation?.clippingDetected ? '· pico acima de 0 dB: revisar' : ''}</p></> : version.error ? <p className="music-warning">{version.error}</p> : null}
          {version.fileName && version.status !== 'approved' && version.status !== 'rejected' && <label>Motivo da rejeição ou notas de aprovação<textarea rows={2} maxLength={NOTES_LIMIT} value={notesFor(version)} disabled={busy} onChange={(event) => setNotes({ ...notes, [version.id]: event.target.value })} placeholder="Descreva o que deve mudar ou o que funcionou nesta versão."/></label>}
          {version.notes && <details open={version.status === 'rejected'}><summary>Notas de revisão salvas</summary><p>{version.notes}</p>{version.status === 'rejected' && <div className="music-actions"><button type="button" disabled={busy} onClick={() => { setAdjustments({ ...adjustments, [selected.id]: version.notes ?? '' }); setStatus('Notas copiadas para os ajustes da próxima geração.') }}>Usar notas como ajustes</button></div>}</details>}
          <details><summary>Prompt usado nesta versão</summary><p>{version.prompt || 'Arquivo importado localmente.'}</p></details><div className="music-actions"><button onClick={() => void selectPreview(version)} disabled={busy || selected.previewVersionId === version.id}><Check size={14}/>{selected.previewVersionId === version.id ? 'Prévia selecionada' : 'Usar no app'}</button><button onClick={() => void perform('Salvando metadados de áudio…', () => saveMetadata(version))} disabled={busy}>Salvar recorte, volume e loop</button>{version.status !== 'approved' && <button className="primary" onClick={() => void review(version, 'approved')} disabled={busy || !version.fileName}><Check size={14}/>Aprovar</button>}{version.fileName && version.status !== 'rejected' && version.status !== 'approved' && <button onClick={() => void review(version, 'rejected')} disabled={busy}>Rejeitar</button>}</div></div>})}</section>
      </article>}
    </div><div className="music-status" role="status">{busy && <i/>}{status}</div><audio ref={audio} className="music-audio-engine" onLoadedMetadata={(event) => { const seconds = event.currentTarget.duration; setDuration(Number.isFinite(seconds) ? seconds : 0); if (Number.isFinite(seconds) && seconds > 0 && selected && activeVersionId.current) void api('/metadata', { compositionId: selected.id, versionId: activeVersionId.current, durationMs: Math.round(seconds * 1000) }).then(refresh).catch(() => {}) }} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onEnded={(event) => { const version = selected?.versions.find((item) => item.id === activeVersionId.current); const crop = version ? settingsFor(version) : null; if (loop && crop) { event.currentTarget.currentTime = crop.startSeconds; void event.currentTarget.play().catch(() => {}) } else setPlayingId('') }} onPause={() => setPlayingId('')} onPlay={() => { if (activeVersionId.current) setPlayingId(activeVersionId.current) }} />
  </main>
}
