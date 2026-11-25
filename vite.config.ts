// @ts-nocheck -- Node runtime types are not included in the browser-focused workspace dependencies.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { mkdir, readFile, writeFile, copyFile, readdir, rename, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { ARU_CURIOSITY_AUDIO_DIR, ARU_CURIOSITY_SPEECH_ID, BORDER_CAVE_ARRIVAL_AUDIO_DIR, BORDER_CAVE_ARRIVAL_SPEECH_ID, BORDER_CAVE_TITLE_AUDIO_DIR, BORDER_CAVE_TITLE_SPEECH_ID, HARRISON_INTRO_SPEECH_ID, harrisonNarration } from './src/narration/harrisonScript.ts'
import { validateAudioApproval, validateNarrationStage } from './src/narration/productionGates.mjs'
import { createMusicStudioMiddleware } from './tools/music/musicStudioApi.mjs'
import { createSoundEffectsMiddleware } from './tools/sound-effects/soundEffectsApi.mjs'

const root = process.cwd()
const studioPhrase = 'I understand this may consume quota or be billed'
const studioDir = path.join(root, 'tools', 'narration', 'data')
const profilePath = path.join(root, 'content', 'characters', 'john-harrison', 'voice-profile.json')
const candidatePath = path.join(root, 'content', 'characters', 'john-harrison', 'voice-candidates.json')
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))
const writeJson = async (file: string, value: unknown) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
const historyPath = path.join(studioDir, 'full-narrations.json')
const introSpeech = { id: HARRISON_INTRO_SPEECH_ID, title: 'Introdução · Viagem no tempo', text: harrisonNarration }
const readNarrationHistory = async () => {
  const history = await readJson(historyPath).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return { versions: [] }
  })
  return {
    ...history,
    speeches: history.speeches ?? [introSpeech],
    versions: (history.versions ?? []).map((version) => ({ ...version, speechId: version.speechId ?? introSpeech.id })),
  }
}

let historyWrite = Promise.resolve()
function updateNarrationHistory(update) {
  const pending = historyWrite.then(async () => {
    const history = await readNarrationHistory()
    const result = update(history)
    const temporaryPath = historyPath + '.' + randomUUID() + '.tmp'
    try {
      await writeJson(temporaryPath, history)
      await rename(temporaryPath, historyPath)
    } finally {
      await unlink(temporaryPath).catch(() => {})
    }
    return result
  })
  historyWrite = pending.catch(() => {})
  return pending
}

const toWebVtt = (segments: Array<{ startMs: number; endMs: number; text: string }>) => {
  const stamp = (milliseconds: number) => {
    const ms = Math.max(0, Math.round(milliseconds))
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
  }
  return `WEBVTT\n\n${segments.map((cue) => `${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}`).join('\n\n')}\n`
}

function voiceStudio() {
  let apiKey = ''
  let elevenLabsKey = ''
  let sfxSettings = { model: 'eleven_text_to_sound_v3', generationEnabled: 'false', allowPaidGeneration: 'false' }
  return {
    name: 'stonephys-voice-studio-local-api',
    configResolved(config: { mode: string }) {
      const env = loadEnv(config.mode, root, '')
      apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || ''
      elevenLabsKey = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY || ''
      sfxSettings = {
        model: process.env.ELEVENLABS_SFX_MODEL || env.ELEVENLABS_SFX_MODEL || 'eleven_text_to_sound_v3',
        generationEnabled: process.env.SFX_GENERATION_ENABLED || env.SFX_GENERATION_ENABLED || 'false',
        allowPaidGeneration: process.env.SFX_ALLOW_PAID_GENERATION || env.SFX_ALLOW_PAID_GENERATION || 'false',
      }
    },
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/__voice-studio/api/sfx', createSoundEffectsMiddleware({ root, getApiKey: () => elevenLabsKey, getSettings: () => sfxSettings }))
      server.middlewares.use('/__voice-studio/api', createMusicStudioMiddleware({ root, getApiKey: () => apiKey }))
      server.middlewares.use('/__voice-studio/api', async (req, res) => {
        const host = req.socket.remoteAddress
        if (host && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(host)) {
          res.statusCode = 403; res.end('Voice Studio só aceita conexões locais.'); return
        }
        const send = (status: number, payload: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(payload))
        }
        const body = await new Promise<any>((resolve, reject) => {
          let raw = ''
          req.setEncoding('utf8')
          req.on('data', (chunk: string) => { raw += chunk; if (raw.length > 24_000_000) reject(new Error('Arquivo acima do limite de 24 MB.')) })
          req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('JSON inválido.')) } })
          req.on('error', reject)
        }).catch((error: Error) => ({ __error: error.message }))
        if (body.__error) { send(400, { error: body.__error }); return }
        const route = (req.url || '/').split('?')[0]
        try {
          await mkdir(studioDir, { recursive: true })
          if (route === '/status' && req.method === 'GET') {
            const history = await readNarrationHistory()
            send(200, { speeches: history.speeches, apiConfigured: Boolean(apiKey), profile: await readJson(profilePath).catch(() => null), candidates: await readJson(candidatePath).catch(() => ({ candidates: [], interpretations: [] })), fullNarrations: history.versions, usage: await readJson(path.join(studioDir, 'usage.json')).catch(() => ({ requests: [] })) }); return
          }
          if (route === '/subtitle-draft' && req.method === 'POST') {
            const { id, draft } = body
            if (typeof id !== 'string' || !Array.isArray(draft?.segments)) {
              send(400, { error: 'Rascunho de legenda inválido.' }); return
            }
            if (!(await readNarrationHistory()).versions.some((version) => version.id === id)) {
              send(404, { error: 'Versão de áudio não encontrada.' }); return
            }
            await updateNarrationHistory((history) => {
              const version = history.versions.find((item) => item.id === id)
              version.subtitleDraft = draft
            })
            send(200, { saved: true }); return
          }
          if (route === '/speeches' && req.method === 'POST') {
            const text = typeof body.text === 'string' ? body.text : ''
            const title = typeof body.title === 'string' ? body.title.trim() : ''
            if (!text.trim() || text.length > 12000 || title.length > 100) {
              send(400, { error: 'Informe um texto de até 12.000 caracteres e um título de até 100 caracteres.' }); return
            }
            if (body.id && !(await readNarrationHistory()).speeches.some((speech) => speech.id === body.id)) {
              send(404, { error: 'Fala não encontrada.' }); return
            }
            const speech = await updateNarrationHistory((history) => {
              const existing = history.speeches.find((item) => item.id === body.id)
              const speech = { id: existing?.id ?? randomUUID(), title: title || text.trim().replace(/\s+/g, ' ').slice(0, 60), text }
              history.speeches = existing
                ? history.speeches.map((item) => item.id === speech.id ? speech : item)
                : [...history.speeches, speech]
              return speech
            })
            send(200, { speech }); return
          }
          const candidateFileMatch = route.match(/^\/candidate-file\/([a-zA-Z0-9._-]+)$/)
          if (candidateFileMatch && req.method === 'GET') {
            const fileName = candidateFileMatch[1]
            const candidatePathOnDisk = path.join(studioDir, 'candidates', fileName)
            const stagingPathOnDisk = path.join(root, 'public', 'audio', 'narration', 'staging', fileName)
            const data = await readFile(candidatePathOnDisk).catch(() => readFile(stagingPathOnDisk).catch(() => null))
            if (!data) { res.statusCode = 404; res.end(); return }
            const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/)
            const extension = path.extname(fileName).toLowerCase()
            const contentType = extension === '.mp3' ? 'audio/mpeg' : extension === '.m4a' ? 'audio/mp4' : extension === '.ogg' ? 'audio/ogg' : extension === '.webm' ? 'audio/webm' : 'audio/wav'
            res.setHeader('Content-Type', contentType); res.setHeader('Accept-Ranges', 'bytes')
            if (range) {
              const start = range[1] ? Number(range[1]) : 0
              const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
              if (start >= data.length || end < start) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${data.length}`); res.end(); return }
              res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`); res.setHeader('Content-Length', String(end - start + 1)); res.end(data.subarray(start, end + 1)); return
            }
            res.setHeader('Content-Length', String(data.length)); res.end(data); return
          }
          if (route === '/candidates/add' && req.method === 'POST') {
            const store = await readJson(candidatePath)
            let candidate = store.candidates.find((entry: any) => entry.voiceId === body.voiceId)
            if (!candidate) {
              candidate = { id: randomUUID(), voiceId: String(body.voiceId), displayName: String(body.displayName || body.voiceId), type: String(body.type || 'prebuilt'), language: String(body.language || 'pt-BR'), voiceDescription: String(body.description || ''), status: 'audition-pending', sampleUrl: null, createdAt: new Date().toISOString(), samples: [] }
              store.candidates.push(candidate); store.updatedAt = new Date().toISOString(); await writeJson(candidatePath, store)
            }
            send(200, { candidate }); return
          }
          if (route === '/identity/approve' && req.method === 'POST') {
            const store = await readJson(candidatePath)
            const candidate = store.candidates.find((entry: any) => entry.id === body.candidateId)
            if (!candidate || !candidate.samples?.some((sample: any) => sample.kind === 'audition')) { send(400, { error: 'Gere e ouça a amostra curta padronizada antes de aprovar a identidade vocal.' }); return }
            const profile = await readJson(profilePath)
            profile.voiceId = candidate.voiceId; profile.voiceDescription = candidate.voiceDescription || profile.voiceDescription; profile.displayName = candidate.displayName; profile.model = 'gemini-3.8-flash-tts'; profile.profileVersion = Number(profile.profileVersion || 0) + 1; profile.status = 'approved'; profile.approval = new Date().toISOString(); profile.referenceSampleUrl = candidate.samples.at(-1).url; profile.interpretationApproved = false; profile.approvedInterpretationId = null
            candidate.status = 'approved'; candidate.approvedAt = profile.approval
            for (const other of store.candidates) if (other.id !== candidate.id && other.status === 'approved') other.status = 'auditioned'
            await writeJson(profilePath, profile); store.updatedAt = new Date().toISOString(); await writeJson(candidatePath, store)
            send(200, { profile, candidate }); return
          }
          if (route === '/interpretations/approve' && req.method === 'POST') {
            const profile = await readJson(profilePath); const store = await readJson(candidatePath)
            if (profile.status !== 'approved' || !profile.voiceId) { send(409, { error: 'Aprove primeiro a identidade vocal de Harrison.' }); return }
            const interpretation = store.interpretations.find((entry: any) => entry.id === body.interpretationId && entry.voiceId === profile.voiceId)
            if (!interpretation) { send(404, { error: 'Interpretação dessa identidade não encontrada.' }); return }
            profile.interpretationApproved = true; profile.approvedInterpretationId = interpretation.id; profile.approvedDirection = interpretation.direction; profile.interpretationApproval = new Date().toISOString(); await writeJson(profilePath, profile)
            interpretation.status = 'approved'; interpretation.approvedAt = profile.interpretationApproval; store.updatedAt = new Date().toISOString(); await writeJson(candidatePath, store)
            send(200, { profile, interpretation }); return
          }
          if (route === '/local-files' && req.method === 'GET') {
            const directory = path.join(root, 'public', 'audio', 'narration', 'staging')
            const names = await readdir(directory).catch(() => [])
            send(200, { files: names }); return
          }
          if (!apiKey && route.startsWith('/gemini/')) { send(503, { error: 'Configure GEMINI_API_KEY ou GOOGLE_API_KEY no ambiente do servidor para usar recursos Gemini.' }); return }
          if (route === '/gemini/voices' && req.method === 'GET') {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/voices?language_code=pt-BR&gender=male&type=prebuilt', { headers: { 'x-goog-api-key': apiKey } })
            const result = await response.json(); send(response.status, result); return
          }
          if (route === '/gemini/design-voice' && req.method === 'POST') {
            if (body.authorization !== studioPhrase) { send(428, { error: 'Confirmação de possível cobrança/cota ausente.' }); return }
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/voices', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ store: true, voice: { model: 'gemini-3.8-flash-tts', type: 'prompted', display_name: 'John Harrison (Sharp Stone)', gender: 'male', language_code: 'pt-BR', prompted: { input: body.description } } }) })
            const result: any = await response.json()
            if (!response.ok) { send(response.status, { error: result.error?.message || 'Falha ao criar voz.' }); return }
            if (result.sample_audio?.data) await writeFile(path.join(studioDir, `voice-sample-${safeName(result.id)}.wav`), Buffer.from(result.sample_audio.data, 'base64'))
            const store = await readJson(candidatePath)
            const candidate = { id: randomUUID(), voiceId: result.id, displayName: result.display_name || 'Harrison · voz personalizada', type: 'prompted', language: 'pt-BR', voiceDescription: String(body.description || ''), status: 'audition-pending', createdAt: new Date().toISOString(), sampleUrl: null, samples: [] }
            if (result.sample_audio?.data) {
              const sampleName = `voice-design-${safeName(result.id)}-${candidate.id.slice(0, 8)}.wav`
              await mkdir(path.join(studioDir, 'candidates'), { recursive: true }); await writeFile(path.join(studioDir, 'candidates', sampleName), Buffer.from(result.sample_audio.data, 'base64'))
              candidate.sampleUrl = `/__voice-studio/api/candidate-file/${sampleName}`
            }
            store.candidates.push(candidate); store.updatedAt = new Date().toISOString(); await writeJson(candidatePath, store)
            const auditFile = path.join(studioDir, 'usage.json')
            const audit = await readJson(auditFile).catch(() => ({ requests: [] }))
            audit.requests.push({ at: candidate.createdAt, sceneId: 'harrison-workshop-1760', characterId: 'john-harrison', kind: 'voice-design', model: 'gemini-3.8-flash-tts', voiceId: result.id, estimatedUsd: null, externalRequestMade: true, note: 'Tarifa própria de voice design não publicada separadamente; conferir faturamento do projeto Google.' })
            await writeJson(auditFile, audit)
            send(200, { candidate }); return
          }
          if (route === '/gemini/synthesize' && req.method === 'POST') {
            if (body.authorization !== studioPhrase) { send(428, { error: 'Confirmação de possível cobrança/cota ausente.' }); return }
            const text = String(body.text || '')
            if (!text.trim() || text.length > 12000) { send(400, { error: 'Texto vazio ou acima do limite de 12.000 caracteres.' }); return }
            const profile = await readJson(profilePath)
            const candidateStore = await readJson(candidatePath)
            const kind = String(body.kind || 'audition')
            const speechId = body.speechId ?? introSpeech.id
            if (kind === 'full' && !(await readNarrationHistory()).speeches.some((speech) => speech.id === speechId)) {
              send(404, { error: 'Fala não encontrada.' }); return
            }
            const stageError = validateNarrationStage({ profile, kind, text, voiceId: body.voiceId })
            if (stageError) { send(409, { error: stageError }); return }
            const selectedCandidate = candidateStore.candidates.find((entry: any) => entry.voiceId === body.voiceId)
            if (!selectedCandidate) { send(400, { error: 'Adicione uma voz à lista de candidatos antes de gerar amostras.' }); return }
            const cacheKey = createHash('sha256').update(JSON.stringify([text, body.voiceId, body.profileVersion, body.model || 'gemini-3.8-flash-tts', body.language || 'pt-BR', body.direction])).digest('hex')
            const cacheFile = path.join(studioDir, 'cache', `${cacheKey}.wav`)
            let audio: Buffer
            let cached = false
            let providerUsage: unknown = null
            try { audio = await readFile(cacheFile); cached = true } catch {
              const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model || 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: String(body.direction || '').slice(0, 500) }] }] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: body.voiceId, language: 'pt-BR' }] } }) })
              const result: any = await response.json()
              if (!response.ok) {
                const errorMessage = result.error?.message || `Gemini TTS respondeu HTTP ${response.status}.`
                const attemptedSeconds = kind === 'full' ? Math.max(5, (text.match(/\S+/g)?.length || 0) / 2.1) : Math.min(20, Math.max(10, Number(body.durationEstimate) || 12))
                const nextPricing = new Date() >= new Date('2027-01-01T00:00:00Z')
                const auditFile = path.join(studioDir, 'usage.json')
                const audit = await readJson(auditFile).catch(() => ({ requests: [] }))
                audit.requests.push({ at: new Date().toISOString(), sceneId: 'harrison-workshop-1760', characterId: 'john-harrison', kind, model: body.model || 'gemini-3.8-flash-tts', voiceId: body.voiceId, textCharacters: text.length, estimatedSeconds: attemptedSeconds, estimatedUsd: (text.length / 4) * (nextPricing ? 1 : .5) / 1_000_000 + attemptedSeconds * 25 * (nextPricing ? 18 : 9) / 1_000_000, providerStatus: response.status, failed: true, billingStatus: 'unknown-provider-rejected', error: errorMessage, cached: false, externalRequestMade: true })
                await writeJson(auditFile, audit)
                throw new Error(errorMessage)
              }
              providerUsage = result.usage || result.usage_metadata || null
              const audioOutput = result.output_audio || result.steps?.flatMap((step: any) => step.content || []).filter((item: any) => item.type === 'audio').at(-1)
              if (!audioOutput?.data) throw new Error('Gemini não retornou áudio. Verifique o modelo, a voz e o status da API.')
              audio = Buffer.from(audioOutput.data, 'base64')
              if (audioOutput.mime_type && audioOutput.mime_type !== 'audio/wav') throw new Error(`Formato retornado (${audioOutput.mime_type}) não é WAV; conversão segura necessária.`)
              await mkdir(path.dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, audio)
            }
            const id = `harrison-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.wav`
            const durationEstimateMs = kind === 'full' ? undefined : Math.round(Math.min(20, Math.max(10, Number(body.durationEstimate) || 12)) * 1000)
            if (kind === 'full') {
              const stage = path.join(root, 'public', 'audio', 'narration', 'staging')
              await mkdir(stage, { recursive: true }); await writeFile(path.join(stage, id), audio)
              const version = { id, speechId, url: `/__voice-studio/api/candidate-file/${id}`, stageUrl: `/audio/narration/staging/${id}`, kind, mimeType: 'audio/wav', bytes: audio.length, text, direction: String(body.direction || ''), voiceId: body.voiceId, model: body.model || 'gemini-3.8-flash-tts', createdAt: new Date().toISOString(), cached, source: 'generated' }
              await updateNarrationHistory((history) => { history.versions.unshift(version) })
              send(200, version); return
            }
            const fileName = `${id}`
            const candidateDirectory = path.join(studioDir, 'candidates')
            await mkdir(candidateDirectory, { recursive: true }); await writeFile(path.join(candidateDirectory, fileName), audio)
            const sample = { id: randomUUID(), kind, fileName, url: `/__voice-studio/api/candidate-file/${fileName}`, voiceId: body.voiceId, direction: String(body.direction || ''), createdAt: new Date().toISOString(), cached, durationEstimateMs }
            if (kind === 'audition') selectedCandidate.samples.push(sample)
            else candidateStore.interpretations.push({ ...sample, candidateId: selectedCandidate.id, status: 'pending-review' })
            candidateStore.updatedAt = sample.createdAt; await writeJson(candidatePath, candidateStore)
            const auditFile = path.join(studioDir, 'usage.json')
            const audit = await readJson(auditFile).catch(() => ({ requests: [] }))
            const estimatedSeconds = kind === 'full' ? Math.max(5, (text.match(/\S+/g)?.length || 0) / 2.1) : durationEstimateMs / 1000
            const nextPricing = new Date() >= new Date('2027-01-01T00:00:00Z')
            audit.requests.push({ at: sample.createdAt, sceneId: 'harrison-workshop-1760', characterId: 'john-harrison', kind, model: body.model || 'gemini-3.8-flash-tts', voiceId: body.voiceId, textCharacters: text.length, estimatedSeconds, estimatedUsd: (text.length / 4) * (nextPricing ? 1 : .5) / 1_000_000 + estimatedSeconds * 25 * (nextPricing ? 18 : 9) / 1_000_000, providerUsage, cached, externalRequestMade: !cached })
            await writeJson(auditFile, audit)
            send(200, { id: sample.id, url: sample.url, candidateId: selectedCandidate.id, kind, cached, mimeType: 'audio/wav', bytes: audio.length }); return
          }
          if (route === '/import' && req.method === 'POST') {
            const speechId = body.speechId ?? introSpeech.id
            if (!(await readNarrationHistory()).speeches.some((speech) => speech.id === speechId)) {
              send(404, { error: 'Fala não encontrada.' }); return
            }
            const name = safeName(String(body.name || 'narration-audio'))
            const type = String(body.mimeType || 'application/octet-stream')
            if (!type.startsWith('audio/') || !body.base64) { send(400, { error: 'Envie um arquivo de áudio válido.' }); return }
            const bytes = Buffer.from(body.base64, 'base64')
            if (bytes.length > 18_000_000) { send(413, { error: 'Arquivo acima do limite de 18 MB.' }); return }
            const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '') || (type.includes('wav') ? '.wav' : type.includes('mpeg') ? '.mp3' : '.audio')
            const id = `harrison-local-${Date.now()}-${randomUUID().slice(0, 6)}${ext}`
            const stage = path.join(root, 'public', 'audio', 'narration', 'staging')
            await mkdir(stage, { recursive: true }); await writeFile(path.join(stage, id), bytes)
            const version = { id, speechId, url: `/__voice-studio/api/candidate-file/${id}`, stageUrl: `/audio/narration/staging/${id}`, kind: 'full', mimeType: type, bytes: bytes.length, text: String(body.text || ''), direction: String(body.direction || ''), voiceId: (await readJson(profilePath).catch(() => ({}))).voiceId || null, createdAt: new Date().toISOString(), cached: false, source: 'imported', originalName: name }
            await updateNarrationHistory((history) => { history.versions.unshift(version) })
            send(200, version); return
          }
          if (route === '/gemini/transcribe' && req.method === 'POST') {
            if (body.authorization !== studioPhrase) { send(428, { error: 'Confirmação de possível cobrança/cota ausente.' }); return }
            const audioPath = path.join(root, 'public', 'audio', 'narration', 'staging', safeName(body.id))
            const data = await readFile(audioPath)
            const mimeType = body.mimeType || 'audio/wav'
            const startUpload = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(data.length), 'X-Goog-Upload-Header-Content-Type': mimeType, 'content-type': 'application/json' }, body: JSON.stringify({ file: { display_name: path.basename(audioPath) } }) })
            if (!startUpload.ok) throw new Error(`Falha ao iniciar upload para transcrição (HTTP ${startUpload.status}).`)
            const uploadUrl = startUpload.headers.get('x-goog-upload-url')
            if (!uploadUrl) throw new Error('A API não forneceu uma URL para concluir o upload.')
            const uploadedResponse = await fetch(uploadUrl, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'content-length': String(data.length) }, body: data })
            const uploaded = await uploadedResponse.json() as any
            if (!uploadedResponse.ok) throw new Error(uploaded.error?.message || `Falha ao enviar áudio (HTTP ${uploadedResponse.status}).`)
            const file = uploaded.file || uploaded
            const transcriptionResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'gemini-3.5-transcribe', input: [{ type: 'audio', uri: file.uri, mime_type: file.mime_type || mimeType }], generation_config: { transcription_config: { mode: { type: 'verbatim', timestamp_granularities: ['word'] } } } }) })
            const interaction: any = await transcriptionResponse.json()
            if (!transcriptionResponse.ok) throw new Error(interaction.error?.message || `Falha de transcrição (HTTP ${transcriptionResponse.status}).`)
            const words: any[] = []
            for (const step of interaction.steps ?? []) for (const content of step.content ?? []) for (const annotation of content.annotations ?? []) if (annotation.type === 'word_info') words.push({ text: annotation.text, startMs: Math.round(parseFloat(annotation.start_offset) * 1000), endMs: Math.round(parseFloat(annotation.end_offset) * 1000) })
            const transcript = interaction.output_text || interaction.steps?.flatMap((step: any) => step.content || []).filter((content: any) => content.type === 'text').map((content: any) => content.text).join(' ') || ''
            const auditFile = path.join(studioDir, 'usage.json')
            const audit = await readJson(auditFile).catch(() => ({ requests: [] }))
            const durationMinutes = Number(body.durationMs || 0) / 60000
            audit.requests.push({ at: new Date().toISOString(), sceneId: 'harrison-workshop-1760', characterId: 'john-harrison', kind: 'transcription', model: 'gemini-3.5-transcribe', durationMs: body.durationMs || null, estimatedUsd: durationMinutes ? durationMinutes * .005 : null, providerUsage: interaction.usage || interaction.usage_metadata || null, cached: false, externalRequestMade: true })
            await writeJson(auditFile, audit)
            send(200, { transcript, words, bytes: data.length }); return
          }
          if (route === '/approve' && req.method === 'POST') {
            const profile = await readJson(profilePath)
            const approvalError = validateAudioApproval({ profile, durationMs: body.durationMs, segments: body.segments })
            if (approvalError) { send(409, { error: approvalError }); return }
            const id = safeName(String(body.id || ''))
            const version = (await readNarrationHistory()).versions.find((item) => item.id === id)
            const speechId = version?.speechId ?? introSpeech.id
            const isBorderCaveTitle = speechId === BORDER_CAVE_TITLE_SPEECH_ID
            const isBorderCaveArrival = speechId === BORDER_CAVE_ARRIVAL_SPEECH_ID
            const isAruCuriosity = speechId === ARU_CURIOSITY_SPEECH_ID
            const isBorderCave = isBorderCaveTitle || isBorderCaveArrival || isAruCuriosity
            if (!isBorderCave && speechId !== introSpeech.id) {
              send(409, { error: 'Esta fala ainda não está vinculada a uma cena.' }); return
            }
            const sceneId = isBorderCave ? 'border-cave-42000-bce' : 'harrison-workshop-1760'
            const assetDir = isAruCuriosity ? ARU_CURIOSITY_AUDIO_DIR : isBorderCaveArrival ? BORDER_CAVE_ARRIVAL_AUDIO_DIR : isBorderCaveTitle ? BORDER_CAVE_TITLE_AUDIO_DIR : '/audio/narration/pt-BR/time/harrison-intro'
            const filePrefix = isAruCuriosity ? 'aru-curiosity' : isBorderCaveArrival ? 'border-cave-arrival' : isBorderCaveTitle ? 'border-cave-title' : 'harrison-intro'
            const stagedPath = path.join(root, 'public', 'audio', 'narration', 'staging', id)
            const extension = path.extname(id) || '.wav'
            const approvedName = `${filePrefix}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}${extension}`
            const output = path.join(root, 'public', assetDir)
            await mkdir(output, { recursive: true }); await copyFile(stagedPath, path.join(output, approvedName))
            const manifest = { sceneId, characterId: 'john-harrison', language: 'pt-BR', audioUrl: `${assetDir}/${approvedName}`, durationMs: Math.round(Number(body.durationMs)), status: 'approved', approvedAt: new Date().toISOString(), segments: body.segments || [] }
            const vttName = `${path.basename(approvedName, extension)}.vtt`
            await writeFile(path.join(output, vttName), toWebVtt(manifest.segments))
            const manifestPath = path.join(output, 'manifest.json')
            if (isBorderCave) {
              const temporaryPath = manifestPath + '.' + randomUUID() + '.tmp'
              try {
                await writeJson(temporaryPath, { ...manifest, webVtt: `${assetDir}/${vttName}` })
                await rename(temporaryPath, manifestPath)
              } finally {
                await unlink(temporaryPath).catch(() => {})
              }
              send(200, { manifest }); return
            }
            await writeJson(manifestPath, manifest)
            const recordPath = path.join(root, 'content/narrations/time/harrison-intro/narration-manifest.json')
            const record = JSON.parse(await readFile(recordPath, 'utf8'))
            record.status = 'approved'; record.audioAssetId = approvedName; record.durationMs = manifest.durationMs
            record.segments = manifest.segments; record.webVtt = `/audio/narration/pt-BR/time/harrison-intro/${vttName}`; record.versions = [...(record.versions || []), { audioUrl: manifest.audioUrl, webVtt: record.webVtt, approvedAt: manifest.approvedAt, durationMs: manifest.durationMs }]
            await writeFile(recordPath, JSON.stringify(record, null, 2) + '\n')
            send(200, { manifest }); return
          }
          send(404, { error: 'Endpoint Voice Studio inexistente.' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro interno no Voice Studio.'
          send(500, { error: message.slice(0, 800) })
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), voiceStudio()] })
