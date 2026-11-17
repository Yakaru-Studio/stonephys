import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, AudioLines, Check, Download, FileAudio, LockKeyhole, Play, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { harrisonNarration } from '../scenes/time/harrisonWorkshop'
import { alignTranscriptToScript, toWebVtt, validateSubtitleSegments, type TimedSegment, type TimedWord } from './subtitleAlignment.mjs'
import './voice-studio.css'

const API = '/__voice-studio/api'
const COST_CONFIRMATION = 'I understand this may consume quota or be billed'
export const HARRISON_AUDITION_TEXT = 'Tempo... Estamos atravessando-o agora… Nesse exato momento, estou eu falando contigo...'
const defaultDirection = 'Comece contemplativo e íntimo, com uma pausa natural depois de “Tempo”. Transmita calor discreto ao falar das ideias que atravessaram séculos. No segundo parágrafo, aumente gradualmente a curiosidade. Faça uma pequena suspensão antes de “passado” e termine com serenidade e expectativa, sem dramatização.'
const identityAuditionDirection = 'Leia a amostra em português brasileiro a 75–85 palavras por minuto, com uma pausa contemplativa natural depois de “Tempo...”. Preserve dicção clara, timbre e identidade vocal sem atuação exagerada.'
type CandidateSample = { id: string; kind: string; url: string; voiceId: string; direction: string; createdAt: string }
type VoiceCandidate = { id: string; voiceId: string; displayName: string; type: string; language: string; voiceDescription: string; status: string; sampleUrl: string | null; samples: CandidateSample[] }
type PreviewAudio = { id: string; url: string; mimeType: string; bytes: number; kind: 'audition' | 'interpretation' | 'full' | 'local'; durationMs?: number; cached?: boolean; generatedText?: string; generatedDirection?: string }
type FullNarrationVersion = PreviewAudio & { kind: 'full'; text: string; direction: string; voiceId: string | null; createdAt: string; source: 'generated' | 'imported' | 'legacy'; originalName?: string }
const voiceDescription = 'Homem de aproximadamente 67 anos, voz bem grave e um pouco rouca, relojoeiro inglês experiente, voz madura e calorosa, falando português brasileiro neutro. Íntimo, humilde, meticuloso, curioso e reflexivo.'

function parseSubtitleFile(content: string, fileName: string): TimedSegment[] {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(content)
    return (parsed.segments || parsed).map((cue: any, index: number) => ({ id: cue.id || `caption-${index + 1}`, text: cue.text, startMs: Number(cue.startMs ?? cue.start_ms), endMs: Number(cue.endMs ?? cue.end_ms), wordTimings: cue.wordTimings || [] }))
  }
  const blocks = content.replace(/^WEBVTT[^\n]*\n/, '').trim().split(/\n\s*\n/)
  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/).filter(Boolean)
    const timing = lines.find((line) => line.includes('-->'))
    if (!timing) return null
    const stampMs = (stamp: string) => {
      const [hours, minutes, seconds] = stamp.replace(',', '.').split(':')
      return Math.round((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000)
    }
    const [start, end] = timing.split('-->').map((value) => value.trim().split(' ')[0])
    return { id: `imported-${index + 1}`, text: lines.slice(lines.indexOf(timing) + 1).join(' '), startMs: stampMs(start), endMs: stampMs(end), wordTimings: [] }
  }).filter(Boolean) as TimedSegment[]
}

function estimateSpeechSeconds(text: string) { return Math.max(5, (text.trim().match(/\S+/g)?.length || 0) / 2.1) }
function estimateAuditionSeconds(text: string) { return (text.trim().match(/\S+/g)?.length || 0) * 60 / 80 + 2 }
function estimateTtsUsd(text: string, durationSeconds = estimateSpeechSeconds(text)) {
  const postIncrease = new Date() >= new Date('2027-01-01T00:00:00Z')
  const inputRate = postIncrease ? 1 : .5
  const audioRate = postIncrease ? 18 : 9
  return (text.length / 4) * inputRate / 1_000_000 + durationSeconds * 25 * audioRate / 1_000_000
}

export default function VoiceStudio({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null)
  const [candidates, setCandidates] = useState<VoiceCandidate[]>([])
  const [fullVersions, setFullVersions] = useState<FullNarrationVersion[]>([])
  const [usageRequests, setUsageRequests] = useState<Array<{ estimatedUsd?: number | null; externalRequestMade?: boolean }>>([])
  const [apiConfigured, setApiConfigured] = useState(false)
  const [voiceAdjustments, setVoiceAdjustments] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [auditionTextValue, setAuditionTextValue] = useState(HARRISON_AUDITION_TEXT)
  const [auditionAdjustments, setAuditionAdjustments] = useState('')
  const [fullText, setFullText] = useState(harrisonNarration)
  const [fullDirection, setFullDirection] = useState(defaultDirection)
  const [currentAudio, setCurrentAudio] = useState<PreviewAudio | null>(null)
  const [segments, setSegments] = useState<TimedSegment[]>([])
  const [transcript, setTranscript] = useState('')
  const [match, setMatch] = useState<number | null>(null)
  const [needsReview, setNeedsReview] = useState(false)
  const [status, setStatus] = useState('Carregando o fluxo de produção…')
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const subtitleInput = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const selectedCandidate = candidates.find((item) => item.id === selectedCandidateId) ?? null
  const auditionTextChanged = auditionTextValue !== HARRISON_AUDITION_TEXT
  const hasIdentityApproval = profile?.status === 'approved' && Boolean(profile?.voiceId)
  const subtitleErrors = useMemo(() => currentAudio?.kind === 'full' ? validateSubtitleSegments(segments, currentAudio.durationMs ?? Infinity) : [], [currentAudio, segments])

  const refreshLocal = async () => {
    const result = await fetch(`${API}/status`).then((response) => response.json())
    setProfile(result.profile); setApiConfigured(result.apiConfigured); setUsageRequests(result.usage?.requests || [])
    setCandidates(result.candidates?.candidates || []); setFullVersions(result.fullNarrations || [])
    setSelectedCandidateId((current) => current || result.candidates?.candidates?.[0]?.id || '')
  }
  useEffect(() => {
    refreshLocal().then(() => setStatus('Voz selecionada carregada. Nenhuma chamada à API é feita automaticamente.'))
      .catch(() => setStatus('Não foi possível conectar ao servidor local do Voice Studio.'))
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' } }
  }, [])
  const api = async (route: string, body?: unknown) => {
    const response = await fetch(`${API}${route}`, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `Erro ${response.status}`)
    return result
  }
  const paidAction = (action: string, text: string, model = 'gemini-3.8-flash-tts', durationEstimate = estimateSpeechSeconds(text)) => {
    const estimate = estimateTtsUsd(text, durationEstimate)
    const seconds = durationEstimate
    const priceDate = new Date() < new Date('2027-01-01T00:00:00Z') ? 'tarifa padrão até 31/12/2026' : 'tarifa padrão a partir de 01/01/2027'
    return window.confirm(`${action}\n\nModelo: ${model}\nTexto: ${text.length} caracteres · duração prevista ~${seconds.toFixed(0)} s\nEstimativa de TTS: US$ ${estimate.toFixed(5)} (${priceDate}; estimativa, sem conversão cambial).\nA criação de uma identidade vocal não tem estimativa separada publicada no estúdio; o custo/cota da conta pode variar.\n\nCada nova geração pode consumir a cota/créditos da conta Gemini. Nada será gerado automaticamente. Continuar?`)
  }

  const createVoice = async (description = voiceDescription) => {
    if (!window.confirm(`Criar uma identidade vocal personalizada usando Gemini Voices API.\n\nDescrição: ${description.length} caracteres\nO Voice Design não tem uma tarifa separada publicada no estúdio. A chamada pode consumir cota ou saldo da conta; confira o faturamento do projeto antes de continuar.\n\nNenhum áudio completo será criado. Continuar?`)) return
    setBusy(true); setStatus('Criando um novo candidato de voz; a voz ainda não será aprovada nem usada na narração completa.')
    try {
      const result = await api('/gemini/design-voice', { description, authorization: COST_CONFIRMATION })
      await refreshLocal(); setSelectedCandidateId(result.candidate.id)
      if (result.candidate.sampleUrl) { setCurrentAudio({ id: 'voice-design-preview', url: result.candidate.sampleUrl, mimeType: 'audio/wav', bytes: 0, kind: 'audition' }); setStatus('Candidato salvo. Esta prévia automática é apenas uma referência da identidade. Gere a amostra de Harrison usando o texto editável acima.') }
      else setStatus('Candidato salvo. Gere uma amostra curta para ouvi-lo.')
    } catch (error) { setStatus((error as Error).message) } finally { setBusy(false) }
  }
  const createAdjustedVoice = () => {
    if (!selectedCandidate || !voiceAdjustments.trim()) return
    const baseDescription = selectedCandidate.voiceDescription || voiceDescription
    return createVoice(`${baseDescription}\n\nAjustes solicitados para uma nova identidade vocal: ${voiceAdjustments.trim()}`)
  }
  const synthesize = async (kind: 'audition' | 'full', directionOverride?: string, textOverride?: string) => {
    const voiceId = kind === 'full' ? profile.voiceId : selectedCandidate?.voiceId
    if (!voiceId) { setStatus('Selecione um candidato de voz primeiro.'); return }
    if (kind === 'full' && !hasIdentityApproval) { setStatus('Aprove a identidade vocal antes de gerar a narração completa.'); return }
    const text = kind === 'full' ? fullText : textOverride ?? auditionTextValue
    const expectedDuration = kind === 'full' ? estimateSpeechSeconds(text) : estimateAuditionSeconds(text)
    if (!paidAction(kind === 'full' ? 'Gerar a narração completa de Harrison' : 'Gerar amostra curta deste candidato', text, 'gemini-3.8-flash-tts', expectedDuration)) return
    setBusy(true); setStatus(kind === 'full' ? 'Gerando a versão completa em rascunho. O arquivo aprovado anterior será preservado.' : 'Gerando e salvando esta amostra para comparação futura…')
    try {
      const generatedDirection = kind === 'audition' ? directionOverride || identityAuditionDirection : fullDirection
      const result = await api('/gemini/synthesize', { kind, text, direction: generatedDirection, durationEstimate: expectedDuration, voiceId, profileVersion: profile?.profileVersion, model: 'gemini-3.8-flash-tts', language: 'pt-BR', authorization: COST_CONFIRMATION })
      setCurrentAudio({ id: result.id, url: result.url, mimeType: result.mimeType, bytes: result.bytes, kind, cached: result.cached, generatedText: text, generatedDirection })
      setSegments([]); setTranscript(''); setMatch(null); setNeedsReview(false); setValidation([])
      await refreshLocal()
      if (result.candidateId) setSelectedCandidateId(result.candidateId)
      setStatus(kind === 'full' ? 'Narração completa pronta para validação; revise o áudio e as legendas antes da integração.' : 'Amostra preservada na biblioteca local. Compare com as versões anteriores e aprove manualmente quando estiver satisfeito.')
    } catch (error) { setStatus((error as Error).message) } finally { setBusy(false) }
  }
  const approveIdentity = async () => {
    if (!selectedCandidate) return
    try {
      const result = await api('/identity/approve', { candidateId: selectedCandidate.id })
      setProfile(result.profile); await refreshLocal(); setStatus(`Identidade ${selectedCandidate.displayName} aprovada. A narração completa está liberada.`)
    } catch (error) { setStatus((error as Error).message) }
  }
  const importAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; if (!file) return
    if (!hasIdentityApproval) { setStatus('Aprove a identidade vocal antes de integrar uma narração completa.'); event.currentTarget.value = ''; return }
    setBusy(true); setStatus('Importando arquivo para a área local de rascunhos…')
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Falha ao ler o arquivo.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file) })
      const result = await api('/import', { name: file.name, mimeType: file.type || 'audio/wav', base64, text: fullText, direction: fullDirection }); setCurrentAudio({ ...result, kind: 'full', generatedText: fullText, generatedDirection: fullDirection }); setSegments([]); setMatch(null); setNeedsReview(false); setValidation([]); await refreshLocal()
      setStatus(`Importado ${file.name}. Faça a validação técnica e sincronize as legendas antes da aprovação.`)
    } catch (error) { setStatus((error as Error).message) } finally { setBusy(false); event.currentTarget.value = '' }
  }
  const validateAudio = async () => {
    if (!currentAudio) return
    try {
      const response = await fetch(currentAudio.url); const bytes = await response.arrayBuffer()
      const context = new AudioContext(); const decoded = await context.decodeAudioData(bytes.slice(0)); const channel = decoded.getChannelData(0)
      let peak = 0, clipped = 0, quiet = 0
      for (let i = 0; i < channel.length; i++) { const value = Math.abs(channel[i]); if (value > peak) peak = value; if (value >= .999) clipped++; if (value < .001) quiet++ }
      const durationMs = Math.round(decoded.duration * 1000); setCurrentAudio((current) => current ? { ...current, durationMs } : current)
      const findings = [`${decoded.duration.toFixed(2)} s · ${decoded.sampleRate} Hz · ${decoded.numberOfChannels} canal(is) · pico ${(peak * 100).toFixed(1)}%`, clipped ? `${clipped} amostras em clipping detectadas.` : 'Sem clipping digital detectável.', quiet / channel.length > .25 ? 'Mais de 25% das amostras estão quase em silêncio; confira pausas e cortes.' : 'Nível de silêncio amostral dentro do esperado.']
      const tail = channel.slice(Math.max(0, channel.length - Math.floor(decoded.sampleRate * .08)))
      if (tail.length && Math.abs(tail[tail.length - 1]) > .08) findings.push('O fim do arquivo tem energia alta; ouça para verificar corte abrupto.')
      setValidation(findings); setStatus('Validação técnica concluída. A naturalidade e a atuação continuam sob revisão humana.'); await context.close()
    } catch (error) { setValidation([`Arquivo não decodificado pelo navegador: ${(error as Error).message}`]); setStatus('Validação técnica encontrou um formato inválido ou não compatível.') }
  }
  const transcribe = async () => {
    if (!currentAudio || currentAudio.kind !== 'full') return
    const transcriptScript = currentAudio.generatedText || fullText
    const audioMinutes = (currentAudio.durationMs || estimateSpeechSeconds(transcriptScript) * 1000) / 60000
    const estimate = Math.max(.0001, audioMinutes * .005)
    if (!window.confirm(`Transcrever e pedir timestamps por palavra com gemini-3.5-transcribe.\n\nÁudio: ${audioMinutes.toFixed(1)} min.\nEstimativa padrão: US$ ${estimate.toFixed(5)} (taxa publicada aproximada de US$ 0.005/min). A cota e a cobrança podem variar.\n\nCada transcrição é uma nova chamada. Continuar?`)) return
    setBusy(true); setStatus('Enviando o áudio aprovado para transcrição com timestamps por palavra…')
    try {
      const result = await api('/gemini/transcribe', { id: currentAudio.id, mimeType: currentAudio.mimeType, durationMs: currentAudio.durationMs, authorization: COST_CONFIRMATION })
      setTranscript(result.transcript)
      const aligned = alignTranscriptToScript(transcriptScript, result.words as TimedWord[])
      setMatch(aligned.similarity); setNeedsReview(aligned.requiresReview); setSegments(aligned.segments)
      setStatus(aligned.requiresReview ? 'Há divergência entre a fala e o roteiro. O alinhamento foi interrompido para revisão humana.' : `Alinhamento textual ${(aligned.similarity * 100).toFixed(0)}%. Revise cada legenda e seus tempos antes da aprovação.`)
    } catch (error) { setStatus((error as Error).message) } finally { setBusy(false) }
  }
  const importSubtitles = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; if (!file) return
    try { setSegments(parseSubtitleFile(await file.text(), file.name)); setNeedsReview(false); setMatch(null); setStatus('Legendas importadas. Revise texto, intervalos e sincronização.') }
    catch (error) { setStatus(`Não foi possível importar as legendas: ${(error as Error).message}`) }
    finally { event.currentTarget.value = '' }
  }
  const approveAudio = async () => {
    if (!currentAudio || currentAudio.kind !== 'full' || needsReview || subtitleErrors.length || !segments.length || !hasIdentityApproval) return
    if (!currentAudio.durationMs || !Number.isFinite(currentAudio.durationMs)) { setStatus('Aguarde o carregamento da duração do áudio antes de aprovar.'); return }
    setBusy(true)
    try {
      const result = await api('/approve', { id: currentAudio.id, durationMs: currentAudio.durationMs, segments })
      setStatus(`Versão aprovada e gravada em ${result.manifest.audioUrl}. Reinicie a cena para reproduzi-la.`)
    } catch (error) { setStatus((error as Error).message) } finally { setBusy(false) }
  }
  const selectFullVersion = (version: FullNarrationVersion) => {
    setCurrentAudio({ id: version.id, url: version.url, mimeType: version.mimeType, bytes: version.bytes, kind: 'full', durationMs: version.durationMs, cached: version.cached, generatedText: version.text, generatedDirection: version.direction })
    setSegments([]); setTranscript(''); setMatch(null); setNeedsReview(false); setValidation([])
    setStatus(`Versão de ${new Date(version.createdAt).toLocaleString()} carregada para comparação e revisão.`)
  }
  const updateCue = (index: number, field: keyof TimedSegment, value: string) => setSegments((current) => current.map((cue, cueIndex) => cueIndex === index ? { ...cue, [field]: field === 'text' ? value : Number(value) } : cue))
  const exportVtt = () => {
    const blob = new Blob([toWebVtt(segments)], { type: 'text/vtt;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'harrison-intro.pt-BR.vtt'; link.click(); URL.revokeObjectURL(url)
  }
  const exportJson = () => {
    const content = { sceneId: 'harrison-workshop-1760', characterId: 'john-harrison', language: 'pt-BR', audioAssetId: currentAudio?.id ?? null, durationMs: currentAudio?.durationMs ?? null, status: 'pending-review', segments }
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'harrison-intro.pt-BR.json'; link.click(); URL.revokeObjectURL(url)
  }

  return <main className="voice-studio">
    <header className="voice-studio-header"><button onClick={onClose} aria-label="Fechar estúdio"><ArrowLeft size={18}/></button><div><span>SHARPSTONE PHYS · FERRAMENTA LOCAL DE DESENVOLVIMENTO</span><h1>Voice Studio <i>John Harrison</i></h1></div><a className="voice-studio-audio-link" href="/__audio-studio">Music Studio</a><AudioLines size={22}/></header>
    <div className="voice-studio-layout">
      <section className="voice-studio-card voice-studio-profile"><h2>Identidade vocal</h2><p>{hasIdentityApproval ? 'A identidade vocal escolhida está aprovada e é a única ativa. Ouça a prévia salva ou avance para a narração completa.' : 'A voz escolhida por você fica como única candidata ativa. Edite a fala curta abaixo para gerar uma amostra padronizada e aprovar a identidade.'}</p>
        <dl><dt>Personagem</dt><dd>John Harrison · aproximadamente 67 anos</dd><dt>Idioma</dt><dd>Português brasileiro</dd><dt>Identidade</dt><dd>{profile?.voiceId || 'Aguardando seleção humana'}</dd><dt>Aprovação</dt><dd>{hasIdentityApproval ? 'Aprovada pelo desenvolvedor' : 'Pendente'}</dd></dl>
        {!hasIdentityApproval && <><label>Texto falado na amostra<textarea value={auditionTextValue} onChange={(event) => setAuditionTextValue(event.target.value)} rows={4}/></label><p className="voice-studio-muted">Estimativa a 80 palavras/minuto, incluindo a pausa contemplativa: {estimateAuditionSeconds(auditionTextValue).toFixed(1)} s. A amostra deve ficar entre 10 e 20 segundos; use o mesmo texto ao comparar vozes.</p></>}
        <div className="voice-candidate-list">{candidates.map((item) => <article className={`voice-candidate ${selectedCandidateId === item.id ? 'is-selected' : ''}`} key={item.id}><header><button onClick={() => { setSelectedCandidateId(item.id); setStatus(`Selecionado ${item.displayName}.`) }}>{item.displayName} <small>{item.type} · {item.voiceId}</small></button><span>{item.status === 'approved' ? 'APROVADA' : `${item.samples?.length || 0} AMOSTRA(S)`}</span></header>{item.voiceDescription && <p>{item.voiceDescription}</p>}{item.sampleUrl && <div className="voice-sample"><small>Prévia automática da identidade escolhida.</small><audio controls preload="auto" src={item.sampleUrl} onError={() => setStatus('Não foi possível reproduzir a prévia. Gere uma amostra padronizada abaixo; o arquivo está salvo localmente.')}/></div>}{item.samples?.map((sample) => <div className="voice-sample" key={sample.id}><small>Amostra de identidade · {new Date(sample.createdAt).toLocaleString()}</small><audio controls preload="auto" src={sample.url}/></div>)}</article>)}</div>
        {selectedCandidate && !hasIdentityApproval && <div className="voice-candidate-adjustments"><label>Ajustes para esta voz<textarea value={voiceAdjustments} onChange={(event) => setVoiceAdjustments(event.target.value)} placeholder="Ex.: um pouco menos rouca, mantendo a voz grave e madura." rows={3}/></label><button disabled={!apiConfigured || busy || !voiceAdjustments.trim()} onClick={createAdjustedVoice}><RefreshCw size={15}/> Regerar identidade com ajustes</button><small>A nova versão substituirá esta como candidata ativa; o registro anterior ficará arquivado.</small></div>}
        {!hasIdentityApproval && <button className="voice-studio-approve" disabled={!selectedCandidate?.samples?.some((sample) => sample.kind === 'audition')} onClick={approveIdentity}><Check size={16}/> Aprovar identidade vocal selecionada</button>}
      </section>
      {!hasIdentityApproval && <section className="voice-studio-card voice-studio-production"><h2>Audição da identidade</h2>
        <p className="voice-audition-text">“{auditionTextValue}”</p>
        <>
            <label>Ajustes para a próxima amostra<textarea value={auditionAdjustments} onChange={(event) => setAuditionAdjustments(event.target.value)} placeholder="Ex.: mais serena e grave, com pausas mais naturais." rows={3}/></label>
            <div className="voice-studio-actions">
              <button className="voice-studio-approve" disabled={!apiConfigured || busy || !selectedCandidate || estimateAuditionSeconds(auditionTextValue) < 10 || estimateAuditionSeconds(auditionTextValue) > 20} onClick={() => synthesize('audition')}><Sparkles size={15}/> Gerar amostra</button>
              <button disabled={!apiConfigured || busy || !selectedCandidate || (!auditionTextChanged && !auditionAdjustments.trim()) || estimateAuditionSeconds(auditionTextValue) < 10 || estimateAuditionSeconds(auditionTextValue) > 20} onClick={() => synthesize('audition', `${identityAuditionDirection}${auditionAdjustments.trim() ? ` Ajustes pedidos: ${auditionAdjustments.trim()}` : ''}`, auditionTextValue)}><RefreshCw size={15}/> Regerar amostra</button>
            </div>
        </>
      </section>}
      <section className="voice-studio-card voice-studio-production"><h2>Narração completa</h2>{hasIdentityApproval ? <><p>Identidade vocal aprovada. Revise o roteiro e a direção de leitura antes de gerar cada versão; todas ficam salvas para comparação.</p><label>Texto completo que John vai ler<textarea className="voice-studio-script" value={fullText} onChange={(event) => setFullText(event.target.value)} maxLength={12000} rows={10}/></label><label>Ajustes de voz para a narração completa<textarea value={fullDirection} onChange={(event) => setFullDirection(event.target.value)} rows={4}/></label><div className="voice-studio-actions"><button disabled={!apiConfigured || busy || !fullText.trim()} onClick={() => synthesize('full')}><Sparkles size={15}/> Gerar nova versão completa</button><button disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15}/> Importar versão completa</button><input ref={fileInput} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg" onChange={importAudio}/></div><div className="voice-full-version-history"><h3>Histórico de versões · {fullVersions.length}</h3>{fullVersions.length ? fullVersions.map((version, index) => <article className={`voice-full-version ${currentAudio?.id === version.id ? 'is-current' : ''}`} key={version.id}><header><strong>Versão {fullVersions.length - index}{version.source === 'imported' ? ' · importada' : version.source === 'legacy' ? ' · anterior, sem metadados' : version.cached ? ' · reutilizada do cache' : ''}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></header><audio controls preload="metadata" src={version.url} onLoadedMetadata={(event) => { const durationMs = Math.round(event.currentTarget.duration * 1000); setFullVersions((items) => items.map((item) => item.id === version.id ? { ...item, durationMs } : item)); setCurrentAudio((current) => current?.id === version.id ? { ...current, durationMs } : current) }}/><details><summary>Texto e direção desta versão</summary><p><strong>Texto:</strong> {version.text || (version.source === 'legacy' ? 'Não registrado: esta versão é anterior ao histórico.' : 'Não registrado para esta versão importada.')}</p><p><strong>Direção:</strong> {version.direction || 'Sem direção registrada.'}</p></details><button onClick={() => selectFullVersion(version)}>{currentAudio?.id === version.id ? 'Versão selecionada para revisão' : 'Carregar para comparar e revisar'}</button></article>) : <p className="voice-studio-muted">As versões geradas a partir de agora serão guardadas aqui.</p>}</div></> : <p className="voice-studio-lock"><LockKeyhole size={17}/> Bloqueado. Aprove primeiro a identidade vocal após ouvir uma amostra curta.</p>}</section>
      <section className="voice-studio-card voice-studio-review"><h2>Revisão técnica e artística</h2>{currentAudio ? <><audio ref={audioRef} controls src={currentAudio.url} onLoadedMetadata={(event) => { const durationMs = Math.round(event.currentTarget.duration * 1000); setCurrentAudio((current) => current ? { ...current, durationMs } : current) }}/><p className="voice-studio-file"><FileAudio size={15}/>{currentAudio.id} · {(currentAudio.bytes / 1024).toFixed(0)} KB · {currentAudio.kind}</p><div className="voice-studio-actions"><button onClick={validateAudio}><RefreshCw size={15}/> Validar arquivo</button>{currentAudio.kind === 'full' && <button disabled={!apiConfigured || busy} onClick={transcribe}><AudioLines size={15}/> Transcrever / alinhar</button>}<button onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; audioRef.current?.play() }}><Play size={15}/> Ouvir novamente</button></div>{validation.map((item) => <p className="voice-studio-check" key={item}>{item}</p>)}</> : <p className="voice-studio-muted">Gere ou selecione um áudio para revisar.</p>}</section>
      <section className="voice-studio-card voice-studio-subtitles"><div className="voice-studio-section-title"><div><h2>Legendas · pt-BR</h2><p>{match === null ? 'Transcrição e timestamps são obtidos do áudio completo, não estimados pelo roteiro.' : `Correspondência com o roteiro: ${(match * 100).toFixed(0)}%`}</p></div><div className="voice-studio-actions"><button disabled={!segments.length} onClick={exportJson}><Download size={15}/> JSON</button><button disabled={!segments.length} onClick={exportVtt}><Download size={15}/> VTT</button></div></div>
        {transcript && <details><summary>Transcrição reconhecida · revisar divergências</summary><p>{transcript}</p></details>}
        <div className="voice-studio-actions"><button disabled={currentAudio?.kind !== 'full'} onClick={() => subtitleInput.current?.click()}><Upload size={15}/> Importar SRT / VTT / JSON</button><input ref={subtitleInput} hidden type="file" accept=".srt,.vtt,.json,text/vtt" onChange={importSubtitles}/></div>
        {needsReview && <p className="voice-studio-warning">A fala diverge do roteiro. Nenhum timestamp foi forçado; revise o áudio/transcrição antes de continuar.</p>}
        {segments.map((cue, index) => <div className="voice-studio-cue" key={cue.id}><textarea aria-label={`Texto da legenda ${index + 1}`} value={cue.text} onChange={(event) => updateCue(index, 'text', event.target.value)} rows={2}/><label>Início ms<input type="number" min="0" value={cue.startMs} onChange={(event) => updateCue(index, 'startMs', event.target.value)}/></label><label>Fim ms<input type="number" min="0" value={cue.endMs} onChange={(event) => updateCue(index, 'endMs', event.target.value)}/></label><button onClick={() => audioRef.current && (audioRef.current.currentTime = cue.startMs / 1000, audioRef.current.play())} aria-label={`Ouvir a partir da legenda ${index + 1}`}><Play size={14}/></button></div>)}
        {subtitleErrors.map((error) => <p className="voice-studio-warning" key={error}>{error}</p>)}
        {currentAudio?.kind === 'full' && <button className="voice-studio-approve" disabled={busy || !hasIdentityApproval || !currentAudio.durationMs || needsReview || !segments.length || subtitleErrors.length > 0} onClick={approveAudio}><Check size={16}/> Aprovar narração e integrar à cena</button>}
      </section>
      <aside className="voice-studio-status" role="status">{busy && <span className="voice-studio-spinner"/>}{status}<small>Registro local: {usageRequests.filter((request) => request.externalRequestMade).length} chamadas · estimativa acumulada US$ {usageRequests.reduce((sum, request) => sum + (request.estimatedUsd || 0), 0).toFixed(5)}. Voice Design sem tarifa separada publicada.</small></aside>
    </div>
  </main>
}
