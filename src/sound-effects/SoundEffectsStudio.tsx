import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, AudioLines, Check, Download, Music2, RefreshCw, Upload } from 'lucide-react'
import './sound-effects-studio.css'

const API = '/__voice-studio/api/sfx'
const AUTHORIZATION = 'I understand this may consume quota or be billed'
type Version = { id: string; source: string; status: string; durationSeconds?: number; requestedDurationSeconds?: number; estimatedCredits?: number; volume?: number; notes?: string; validation?: Record<string, any>; assetPath?: string; createdAt?: string; prompt?: string }
type Effect = { id: string; name: string; prompt: string; durationSeconds: number; promptInfluence: number; defaultVolume: number; versions: Version[]; previewVersionId: string | null; approvedVersionId: string | null; previewUrl: string | null; approvedAssetUrl: string | null; license: { plan: string; commercialRightsConfirmed: boolean; notes?: string } }
type Library = { apiConfigured: boolean; canGenerate: boolean; generationEnabled: boolean; paidGenerationAllowed: boolean; model: string; authorizedCredits: number; spentCredits: number; remainingCredits: number; maxPaidRequests: number; paidRequests: number; effects: Effect[]; requests: any[]; tooling: { ffmpeg: boolean; ffprobe: boolean } }

export default function SoundEffectsStudio({ onClose }: { onClose: () => void }) {
  const [library, setLibrary] = useState<Library | null>(null)
  const [selectedId, setSelectedId] = useState('library-scroll-unroll')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(.95)
  const [influence, setInfluence] = useState(.5)
  const [volume, setVolume] = useState(.72)
  const [plan, setPlan] = useState('')
  const [commercialRights, setCommercialRights] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Carregando catálogo local. Nenhuma geração ocorre ao abrir este estúdio.')
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = library?.effects.find((effect) => effect.id === selectedId)
  const activeVersion = selected?.versions.find((version) => version.id === selected.previewVersionId) || selected?.versions[0]

  useEffect(() => {
    document.documentElement.classList.add('sound-effects-studio-open')
    document.body.classList.add('sound-effects-studio-open')
    document.getElementById('root')?.classList.add('sound-effects-studio-open')
    return () => {
      document.documentElement.classList.remove('sound-effects-studio-open')
      document.body.classList.remove('sound-effects-studio-open')
      document.getElementById('root')?.classList.remove('sound-effects-studio-open')
    }
  }, [])

  const refresh = useCallback(async () => {
    const response = await fetch(`${API}/status`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Falha ao carregar Sound Effects Studio.')
    setLibrary(result)
    const effect = result.effects.find((item: Effect) => item.id === selectedId) || result.effects[0]
    if (effect) { setSelectedId(effect.id); setPrompt(effect.prompt); setDuration(effect.durationSeconds); setInfluence(effect.promptInfluence); setVolume(effect.defaultVolume); setPlan(effect.license?.plan === 'unknown' ? '' : effect.license?.plan || ''); setCommercialRights(Boolean(effect.license?.commercialRightsConfirmed)) }
  }, [selectedId])
  useEffect(() => { void refresh().then(() => setMessage('Catálogo pronto. Geração manual, limitada e separada da execução do jogo.')).catch((error) => setMessage(error.message)) }, [refresh])
  const call = async (route: string, body: any) => {
    const response = await fetch(`${API}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Ação não concluída.')
    return data
  }
  const run = async (action: () => Promise<any>, success: string, changed = false) => {
    setBusy(true)
    try { await action(); await refresh(); setMessage(success); if (changed) window.dispatchEvent(new Event('stonephys:sfx-preview-changed')) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na ação.') }
    finally { setBusy(false) }
  }
  const generate = () => selected && run(() => call('generate', { effectId: selected.id, prompt, durationSeconds: duration, promptInfluence: influence, loop: false, model: library?.model, requestId: crypto.randomUUID(), authorization: AUTHORIZATION }), 'Áudio gerado. Ouça e revise a versão antes de aprovar.', true)
  const importFile = async (file?: File) => {
    if (!selected || !file) return
    const reader = new FileReader()
    reader.onload = () => { const data = String(reader.result).split(',')[1]; void run(() => call('import', { effectId: selected.id, fileName: file.name, mimeType: file.type || 'audio/mpeg', data }), 'Áudio importado como versão local.', true) }
    reader.readAsDataURL(file)
  }
  const approve = () => selected && activeVersion && run(async () => {
    await call('license', { effectId: selected.id, plan: plan || 'unknown', commercialRightsConfirmed: commercialRights, notes })
    return call('review', { effectId: selected.id, versionId: activeVersion.id, status: 'approved', notes })
  }, commercialRights ? 'Versão aprovada e publicada para uso conforme a licença declarada.' : 'Versão aprovada apenas para avaliação; sem cópia para produção.', true)

  return <main className="sfx-studio">
    <header className="sfx-header"><button onClick={onClose} aria-label="Voltar"><ArrowLeft/></button><div><span>SHARPSTONE PHYS · ÁUDIO</span><h1>Sound Effects Studio</h1><p>Foley da Biblioteca do Conhecimento</p></div><nav><a href="/__voice-studio">Voice Studio</a><a href="/__audio-studio"><Music2 size={15}/> Music Studio</a></nav></header>
    <div className="sfx-budget"><span>ELEVENLABS · <b>{library?.model || 'eleven_text_to_sound_v3'}</b></span><span>Orçamento <b>{library?.spentCredits ?? 0} / {library?.authorizedCredits ?? 160} créditos</b></span><span>Gerações <b>{library?.paidRequests ?? 0} / {library?.maxPaidRequests ?? 2}</b></span><span>Chave <b>{library?.apiConfigured ? 'configurada' : 'ausente'}</b></span></div>
    <div className="sfx-layout">
      <aside className="sfx-catalog"><h2>Catálogo inicial</h2>{library?.effects.map((effect, index) => <button className={selectedId === effect.id ? 'active' : ''} key={effect.id} onClick={() => setSelectedId(effect.id)}><small>0{index + 1}</small><span>{effect.name}<em>{effect.versions.length} versões</em></span></button>)}<p>Estúdio local. A reprodução, importação e revisão não geram créditos.</p></aside>
      <section className="sfx-editor">
        {selected && <>
          <div className="sfx-title"><div><span>EVENTO · {selected.id === 'library-scroll-unroll' ? 'library.scroll.unroll' : 'library.scroll.roll'}</span><h2>{selected.name}</h2></div><AudioLines/></div>
          <label className="sfx-field">Prompt de geração<textarea value={prompt} maxLength={450} onChange={(event) => setPrompt(event.target.value)}/><small>{prompt.length}/450 · Histórico de versões de prompt mantido</small></label>
          <div className="sfx-parameters"><label>Duração <b>{duration.toFixed(2)} s</b><input type="range" min="0.5" max="3" step="0.05" value={duration} onChange={(event) => setDuration(Number(event.target.value))}/></label><label>Influência do prompt <b>{influence.toFixed(2)}</b><input type="range" min="0" max="1" step="0.01" value={influence} onChange={(event) => setInfluence(Number(event.target.value))}/></label><label>Volume padrão <b>{Math.round(volume * 100)}%</b><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/></label></div>
          <div className="sfx-generation"><div><b>Loop desativado · MP3 44.1 kHz</b><span>Estimativa desta versão: {Math.round(duration * 40)} créditos</span></div><button disabled={busy} onClick={() => void run(() => call('prompt', { effectId: selected.id, prompt, durationSeconds: duration, promptInfluence: influence, volume }), 'Prompt e parâmetros salvos localmente.')}><Check size={16}/> Salvar parâmetros</button><button className="primary" disabled={busy || !library?.canGenerate} title={!library?.canGenerate ? 'Configure a chave e ambas as flags locais para habilitar a geração.' : ''} onClick={generate}><AudioLines size={16}/> Gerar uma vez</button></div>
          {!library?.canGenerate && <p className="sfx-notice">Geração paga desabilitada: chave {library?.apiConfigured ? 'encontrada' : 'não configurada'} e as duas autorizações locais devem estar ativas. Nenhum áudio fictício será criado.</p>}
          <div className="sfx-versions"><div className="sfx-section-title"><h3>Versões e audição</h3><button onClick={() => void refresh()}><RefreshCw size={14}/> Atualizar</button><button onClick={() => fileRef.current?.click()}><Upload size={14}/> Importar áudio local</button><input ref={fileRef} type="file" accept="audio/*" hidden onChange={(event) => void importFile(event.currentTarget.files?.[0])}/></div>
            {!selected.versions.length && <div className="sfx-empty">Ainda não há áudio neste efeito. Gere com credenciais autorizadas ou importe um arquivo real para revisar.</div>}
            {selected.versions.map((version) => <article className={`sfx-version ${activeVersion?.id === version.id ? 'selected' : ''}`} key={version.id}><div className="sfx-version-head"><b>{version.source === 'generated' ? 'ElevenLabs' : version.source === 'processed' ? 'Processado localmente' : 'Importado localmente'}</b><span>{version.status} · {version.durationSeconds?.toFixed(2) ?? '—'} s · {version.estimatedCredits ?? 0} créditos</span></div><audio controls preload="none" src={`${API}/file/${selected.id}/${version.id}`}/><details><summary>Validação técnica e observações</summary><pre>{JSON.stringify({ validation: version.validation, notes: version.notes, id: version.id }, null, 2)}</pre></details><div className="sfx-version-actions"><button onClick={() => void run(() => call('preview', { effectId: selected.id, versionId: version.id }), 'Versão selecionada para prévia no jogo.', true)}>Prévia no jogo</button><a href={`${API}/file/${selected.id}/${version.id}?download=1`}><Download size={14}/> Baixar original</a><button className="danger" onClick={() => void run(() => call('review', { effectId: selected.id, versionId: version.id, status: 'rejected', notes }), 'Versão reprovada.')}>Reprovar</button></div></article>)}
          </div>
          {activeVersion && <section className="sfx-approval"><h3>Aprovação, publicação e licença</h3><p>O asset só é copiado para <code>public/audio/sfx/approved</code> quando você confirma direitos comerciais do plano ElevenLabs.</p><label>Plano utilizado<input value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Informe seu plano"/></label><label>Observações de licença<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: licença comercial incluída no plano…"/></label><label className="sfx-check"><input type="checkbox" checked={commercialRights} onChange={(event) => setCommercialRights(event.target.checked)}/> Confirmo que meu plano permite uso comercial deste áudio no jogo.</label><button disabled={busy} onClick={approve}><Check size={16}/> Aprovar versão selecionada</button></section>}
          <p className="sfx-message" role="status">{message}</p>
          <p className="sfx-footnote">FFmpeg: {library?.tooling.ffmpeg ? 'disponível' : 'não instalado'} · FFprobe: {library?.tooling.ffprobe ? 'disponível' : 'não instalado'} · A execução e os testes do jogo nunca chamam o provedor.</p>
        </>}
      </section>
    </div>
  </main>
}
