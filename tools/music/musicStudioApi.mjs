import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MODEL = 'lyria-3.5'
const PRICE = 0.08
const MAX_BUDGET = 1.50
const IDS = ['eternity-of-knowledge', 'paths-of-discovery', 'the-clockmaker-of-time', 'the-sanctuary-of-wisdom', 'dawn-of-humanity']
const APPROVAL = 'I understand this may consume quota or be billed'
const safeName = (value) => String(value).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
const inFlight = new Set()

function paths(root) {
  return {
    root,
    content: path.join(root, 'content', 'music'),
    output: path.join(root, 'tools', 'music', 'generations'),
    libraryFile: path.join(root, 'tools', 'music', 'manifests', 'library.json'),
    budgetFile: path.join(root, 'tools', 'music', 'manifests', 'budget.json'),
    approved: path.join(root, 'public', 'audio', 'music', 'approved'),
  }
}

async function readLibrary(root) {
  const p = paths(root)
  const library = await readJson(p.libraryFile).catch(() => ({ schemaVersion: 1, updatedAt: null, requests: [], compositions: {} }))
  library.requests ||= []
  library.compositions ||= {}
  for (const id of IDS) {
    library.compositions[id] ||= { versions: [], previewVersionId: null, approvedVersionId: null }
    library.compositions[id].versions ||= []
  }
  return library
}

async function saveLibrary(root, library) {
  const p = paths(root)
  await mkdir(path.dirname(p.libraryFile), { recursive: true })
  library.updatedAt = new Date().toISOString()
  await writeJson(p.libraryFile, library)
}

async function compositions(root, library) {
  const p = paths(root)
  const output = []
  for (const id of IDS) {
    const definition = await readJson(path.join(p.content, id, 'composition.json'))
    const prompts = await readJson(path.join(p.content, id, 'prompts.json'))
    const record = library.compositions[id]
    const preview = record.versions.find((version) => version.id === record.previewVersionId)
    output.push({ ...definition, prompt: prompts.prompt, promptRevisions: prompts.revisions || [], versions: record.versions, previewVersionId: record.previewVersionId, approvedVersionId: record.approvedVersionId, previewUrl: preview?.fileName ? `/__voice-studio/api/music/file/${id}/${preview.id}` : null, previewCropStartSeconds: preview?.cropStartSeconds ?? 0, previewCropEndSeconds: preview?.cropEndSeconds ?? null, previewVolume: preview?.volume ?? 1, previewLoop: preview?.loop || definition.loop })
  }
  return output
}

function mediaInfo(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,format_name,bit_rate:stream=codec_name,sample_rate,channels,channel_layout', '-of', 'json', file], { encoding: 'utf8', timeout: 15000, windowsHide: true })
  if (result.error || result.status !== 0) return { ffprobe: false, ffprobeNote: result.error?.code === 'ENOENT' ? 'FFprobe não instalado; duração e codec podem ser lidos pelo navegador.' : result.stderr?.slice(0, 300) || 'FFprobe não conseguiu validar este arquivo.' }
  try {
    const probe = JSON.parse(result.stdout)
    const audio = probe.streams?.[0]
    return { ffprobe: true, durationMs: Math.round(Number(probe.format?.duration || 0) * 1000) || null, format: probe.format?.format_name || null, bitrate: Number(probe.format?.bit_rate) || null, codec: audio?.codec_name || null, sampleRate: Number(audio?.sample_rate) || null, channels: Number(audio?.channels) || null, channelLayout: audio?.channel_layout || null }
  } catch { return { ffprobe: false, ffprobeNote: 'Resposta do FFprobe inválida.' } }
}

function validatePeaks(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', timeout: 90000, windowsHide: true })
  if (result.error || result.status !== 0) return { ffmpeg: false, ffmpegNote: result.error?.code === 'ENOENT' ? 'FFmpeg não instalado; não foi possível medir clipping ou silêncios.' : result.stderr?.slice(-400) || 'FFmpeg não conseguiu validar este arquivo.' }
  const text = result.stderr || ''
  const peakDb = Number(text.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1])
  const meanDb = Number(text.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1])
  return { ffmpeg: true, peakDb: Number.isFinite(peakDb) ? peakDb : null, meanDb: Number.isFinite(meanDb) ? meanDb : null, clippingDetected: Number.isFinite(peakDb) && peakDb >= 0 }
}

async function bodyJson(req, maxBytes = 80_000_000) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk; if (raw.length > maxBytes) reject(new Error('Arquivo acima do limite local do Music Studio.')) })
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('JSON inválido.')) } })
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function serveAudio(req, res, file, asDownload = false) {
  const data = await readFile(file).catch(() => null)
  if (!data) { res.statusCode = 404; res.end('Arquivo local não encontrado.'); return }
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/)
  res.setHeader('Content-Type', path.extname(file).toLowerCase() === '.wav' ? 'audio/wav' : 'audio/mpeg')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="${path.basename(file)}"`)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
    if (start >= data.length || end < start) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${data.length}`); res.end(); return }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`); res.setHeader('Content-Length', String(end - start + 1)); res.end(data.subarray(start, end + 1)); return
  }
  res.setHeader('Content-Length', String(data.length)); res.end(data)
}

export function createMusicStudioMiddleware({ root, getApiKey }) {
  return async (req, res, next) => {
    const route = (req.url || '/').split('?')[0]
    if (!route.startsWith('/music/')) return next()
    const host = req.socket.remoteAddress
    if (host && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(host)) { send(res, 403, { error: 'Music Studio aceita somente conexões locais.' }); return }
    const p = paths(root)
    try {
      const library = await readLibrary(root)

      if (route === '/music/status' && req.method === 'GET') {
        const records = await compositions(root, library)
        const spentUsd = library.requests.reduce((sum, request) => sum + (request.estimatedUsd || 0), 0)
        const budget = await readJson(p.budgetFile).catch(() => ({ sessionLimitUsd: MAX_BUDGET, modelPriceUsd: PRICE, model: MODEL }))
        send(res, 200, { apiConfigured: Boolean(getApiKey()), model: MODEL, priceUsd: PRICE, spentUsd, sessionLimitUsd: Math.min(MAX_BUDGET, budget.sessionLimitUsd || MAX_BUDGET), callCount: library.requests.filter((request) => request.externalRequestMade || request.status === 'pending').length, compositions: records, requests: library.requests }); return
      }

      const fileMatch = route.match(/^\/music\/file\/([a-z0-9-]+)\/([a-zA-Z0-9._-]+)$/)
      if (fileMatch && req.method === 'GET') {
        const [, id, versionId] = fileMatch
        if (!IDS.includes(id)) { res.statusCode = 404; res.end(); return }
        const version = library.compositions[id].versions.find((item) => item.id === versionId)
        if (!version?.fileName) { res.statusCode = 404; res.end(); return }
        await serveAudio(req, res, path.join(p.output, id, version.fileName), new URL(req.url, 'http://localhost').searchParams.get('download') === '1'); return
      }

      if (route === '/music/prompt' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        if (!IDS.includes(body.compositionId)) { send(res, 400, { error: 'Composição desconhecida.' }); return }
        const prompt = String(body.prompt || '').trim()
        if (!prompt || prompt.length > 12000) { send(res, 400, { error: 'O prompt precisa ter entre 1 e 12.000 caracteres.' }); return }
        const file = path.join(p.content, body.compositionId, 'prompts.json')
        const prompts = await readJson(file)
        if (prompts.prompt !== prompt) prompts.revisions = [...(prompts.revisions || []), { prompt: prompts.prompt, savedAt: new Date().toISOString() }]
        prompts.prompt = prompt
        await writeJson(file, prompts)
        const records = await compositions(root, library)
        send(res, 200, { compositions: records }); return
      }

      if (route === '/music/generate' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        const apiKey = getApiKey()
        const compositionId = String(body.compositionId || '')
        const prompt = String(body.prompt || '').trim()
        const requestId = safeName(body.requestId)
        if (!apiKey) { send(res, 503, { error: 'Configure GEMINI_API_KEY ou GOOGLE_API_KEY no servidor local.' }); return }
        if (body.authorization !== APPROVAL) { send(res, 428, { error: 'Confirmação de geração e possível cobrança ausente.' }); return }
        if (!IDS.includes(compositionId) || !prompt || prompt.length > 12000) { send(res, 400, { error: 'Composição ou prompt inválido.' }); return }
        if (!/^[a-f0-9-]{30,40}$/i.test(requestId)) { send(res, 400, { error: 'Identificador de geração inválido.' }); return }
        if (inFlight.has(requestId) || library.requests.some((entry) => entry.requestId === requestId)) { send(res, 409, { error: 'Este pedido já foi enviado ou ainda está em andamento. Nenhuma repetição automática será feita.' }); return }
        const promptHash = createHash('sha256').update(prompt).digest('hex')
        const cached = library.compositions[compositionId].versions.find((version) => version.promptHash === promptHash && version.fileName && version.status !== 'failed')
        if (cached && !body.forceNewVersion) { send(res, 200, { cached: true, version: cached, reusedExisting: true }); return }
        const spent = library.requests.reduce((sum, entry) => sum + (entry.estimatedUsd || 0), 0)
        const sessionLimit = Math.min(MAX_BUDGET, Number((await readJson(p.budgetFile).catch(() => ({}))).sessionLimitUsd || MAX_BUDGET))
        if (spent + PRICE > sessionLimit + 1e-8) { send(res, 409, { error: `Limite de sessão atingido: US$ ${spent.toFixed(2)} de US$ ${sessionLimit.toFixed(2)} reservado.` }); return }

        const definition = await readJson(path.join(p.content, compositionId, 'composition.json'))
        inFlight.add(requestId)
        const now = new Date().toISOString()
        const versionId = randomUUID()
        const version = { id: versionId, requestId, model: MODEL, prompt, promptHash, createdAt: now, status: 'pending', source: 'generated', estimatedUsd: PRICE, externalRequestMade: true, fileName: null, durationMs: null, bytes: null, approval: 'pending', notes: '', loop: definition.loop }
        const requestRecord = { requestId, compositionId, versionId, model: MODEL, at: now, estimatedUsd: PRICE, externalRequestMade: true, status: 'pending', promptHash }
        library.requests.push(requestRecord)
        library.compositions[compositionId].versions.unshift(version)
        await saveLibrary(root, library)
        try {
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
            method: 'POST',
            headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json', 'Api-Revision': '2026-05-20' },
            body: JSON.stringify({ model: MODEL, input: prompt, response_format: { type: 'audio' } }),
            signal: AbortSignal.timeout(12 * 60 * 1000),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) throw Object.assign(new Error(result.error?.message || `Gemini Music respondeu HTTP ${response.status}.`), { statusCode: response.status })
          const audioBlock = result.output_audio || result.steps?.flatMap((step) => step.content || []).find((block) => block.type === 'audio')
          const audioBase64 = audioBlock?.data
          if (!audioBase64) throw new Error('A resposta da API não trouxe um bloco de áudio. O pedido foi registrado; confira o uso antes de tentar novamente.')
          const audio = Buffer.from(audioBase64, 'base64')
          if (!audio.length) throw new Error('A API devolveu um arquivo de áudio vazio.')
          const fileName = `${compositionId}-${versionId}.mp3`
          const directory = path.join(p.output, compositionId)
          await mkdir(directory, { recursive: true })
          const outputFile = path.join(directory, fileName)
          await writeFile(outputFile, audio)
          const probe = mediaInfo(outputFile)
          const peak = validatePeaks(outputFile)
          const fresh = await readLibrary(root)
          const savedVersion = fresh.compositions[compositionId].versions.find((item) => item.id === versionId)
          const savedRequest = fresh.requests.find((entry) => entry.requestId === requestId)
          Object.assign(savedVersion, { status: 'pending-review', fileName, bytes: audio.length, durationMs: probe.durationMs ?? null, generatedAt: new Date().toISOString(), interactionId: result.id || null, validation: { fileExists: true, sizeBytes: audio.length, ...probe, ...peak } })
          Object.assign(savedRequest, { status: 'completed', interactionId: result.id || null })
          await saveLibrary(root, fresh)
          send(res, 200, { cached: false, version: savedVersion, interactionId: result.id || null }); return
        } catch (error) {
          const fresh = await readLibrary(root)
          const savedVersion = fresh.compositions[compositionId].versions.find((item) => item.id === versionId)
          const savedRequest = fresh.requests.find((entry) => entry.requestId === requestId)
          const errorMessage = error instanceof Error ? error.message.slice(0, 700) : 'Falha desconhecida na geração.'
          Object.assign(savedVersion, { status: 'failed-review-usage-before-retry', error: errorMessage })
          Object.assign(savedRequest, { status: 'failed-billing-status-unknown', error: errorMessage })
          await saveLibrary(root, fresh)
          send(res, error.statusCode || 502, { error: `${errorMessage} A chamada foi contabilizada como US$ 0,08 por segurança; revise o histórico antes de qualquer nova geração.` }); return
        } finally { inFlight.delete(requestId) }
      }

      if (route === '/music/import' && req.method === 'POST') {
        const body = await bodyJson(req)
        const compositionId = String(body.compositionId || '')
        if (!IDS.includes(compositionId) || typeof body.data !== 'string' || body.data.length > 105_000_000) { send(res, 400, { error: 'Arquivo local ou composição inválida.' }); return }
        const audio = Buffer.from(body.data, 'base64')
        if (!audio.length || audio.length > 78_000_000) { send(res, 400, { error: 'O arquivo importado está vazio ou excede 78 MB.' }); return }
        const ext = String(body.fileName || '').toLowerCase().endsWith('.wav') ? '.wav' : '.mp3'
        const versionId = randomUUID()
        const fileName = `${compositionId}-${versionId}${ext}`
        const directory = path.join(p.output, compositionId)
        await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, fileName), audio)
        const version = { id: versionId, model: 'imported-local-file', prompt: '', promptHash: null, createdAt: new Date().toISOString(), status: 'pending-review', source: 'imported', originalName: safeName(body.fileName || fileName), estimatedUsd: 0, externalRequestMade: false, fileName, durationMs: null, bytes: audio.length, approval: 'pending', notes: '', loop: { enabled: true, startSeconds: 0, endSeconds: null, crossfadeMs: 2500 }, validation: { fileExists: true, sizeBytes: audio.length, ...mediaInfo(path.join(directory, fileName)), ...validatePeaks(path.join(directory, fileName)) } }
        library.compositions[compositionId].versions.unshift(version); await saveLibrary(root, library)
        send(res, 200, { version }); return
      }

      if (route === '/music/metadata' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        if (!IDS.includes(body.compositionId)) { send(res, 400, { error: 'Composição desconhecida.' }); return }
        const version = library.compositions[body.compositionId].versions.find((item) => item.id === body.versionId)
        if (!version) { send(res, 404, { error: 'Versão não encontrada.' }); return }
        if (Number.isFinite(Number(body.durationMs)) && Number(body.durationMs) > 0) version.durationMs = Math.round(Number(body.durationMs))
        if (body.loop && typeof body.loop === 'object') version.loop = { enabled: Boolean(body.loop.enabled), startSeconds: Math.max(0, Number(body.loop.startSeconds) || 0), endSeconds: Number.isFinite(Number(body.loop.endSeconds)) ? Number(body.loop.endSeconds) : null, crossfadeMs: Math.max(0, Math.min(12000, Number(body.loop.crossfadeMs) || 0)) }
        const mediaDuration = (version.durationMs || 0) / 1000
        const cropStartSeconds = Math.max(0, Math.min(mediaDuration || Infinity, Number(body.cropStartSeconds ?? version.cropStartSeconds ?? 0)))
        const cropEndSeconds = Math.max(0, Math.min(mediaDuration || Infinity, Number(body.cropEndSeconds ?? version.cropEndSeconds ?? mediaDuration)))
        if (!Number.isFinite(cropStartSeconds) || !Number.isFinite(cropEndSeconds) || cropEndSeconds - cropStartSeconds < .05) { send(res, 400, { error: 'O fim do recorte precisa ficar pelo menos 0,05 s depois do início.' }); return }
        version.cropStartSeconds = cropStartSeconds
        version.cropEndSeconds = cropEndSeconds
        version.volume = Math.max(0, Math.min(1, Number(body.volume ?? version.volume ?? 1)))
        if (typeof body.notes === 'string') version.notes = body.notes.slice(0, 2000)
        const definitionFile = path.join(p.content, body.compositionId, 'composition.json')
        const definition = await readJson(definitionFile)
        if (library.compositions[body.compositionId].previewVersionId === version.id) {
          definition.previewCropStartSeconds = cropStartSeconds; definition.previewCropEndSeconds = cropEndSeconds; definition.previewVolume = version.volume; definition.previewLoop = version.loop || definition.loop
        }
        if (library.compositions[body.compositionId].approvedVersionId === version.id) {
          definition.approvedCropStartSeconds = cropStartSeconds; definition.approvedCropEndSeconds = cropEndSeconds; definition.approvedVolume = version.volume; definition.approvedLoop = version.loop || definition.loop
        }
        await writeJson(definitionFile, definition)
        await saveLibrary(root, library); send(res, 200, { version }); return
      }

      if (route === '/music/review' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        if (!IDS.includes(body.compositionId) || !['approved', 'rejected', 'pending-review'].includes(body.status)) { send(res, 400, { error: 'Ação de revisão inválida.' }); return }
        const compositionId = body.compositionId
        const version = library.compositions[compositionId].versions.find((item) => item.id === body.versionId)
        if (!version?.fileName) { send(res, 404, { error: 'Versão local não encontrada.' }); return }
        if (body.status === 'approved') {
          if (library.compositions[compositionId].approvedVersionId && library.compositions[compositionId].approvedVersionId !== version.id) { send(res, 409, { error: 'Já existe uma versão aprovada para esta composição. A substituição exige autorização explícita.' }); return }
          await mkdir(p.approved, { recursive: true })
          await copyFile(path.join(p.output, compositionId, version.fileName), path.join(p.approved, `${compositionId}${path.extname(version.fileName)}`))
          library.compositions[compositionId].approvedVersionId = version.id
          version.approvedAt = new Date().toISOString()
          const compositionFile = path.join(p.content, compositionId, 'composition.json')
          const definition = await readJson(compositionFile)
          definition.approvedVersionId = version.id
          definition.approvedAssetUrl = `/audio/music/approved/${compositionId}${path.extname(version.fileName)}`
          definition.approvedCropStartSeconds = version.cropStartSeconds ?? 0
          definition.approvedCropEndSeconds = version.cropEndSeconds ?? (version.durationMs ? version.durationMs / 1000 : null)
          definition.approvedVolume = version.volume ?? 1
          definition.approvedLoop = version.loop || definition.loop
          await writeJson(compositionFile, definition)
        }
        version.status = body.status
        version.notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : version.notes
        await saveLibrary(root, library); send(res, 200, { version, compositions: await compositions(root, library) }); return
      }

      if (route === '/music/preview' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        if (!IDS.includes(body.compositionId)) { send(res, 400, { error: 'Composição desconhecida.' }); return }
        const compositionId = body.compositionId
        const version = body.versionId ? library.compositions[compositionId].versions.find((item) => item.id === body.versionId && item.fileName) : null
        if (body.versionId && !version) { send(res, 404, { error: 'Versão de preview não encontrada.' }); return }
        library.compositions[compositionId].previewVersionId = version?.id || null
        await writeJson(path.join(p.content, compositionId, 'composition.json'), { ...(await readJson(path.join(p.content, compositionId, 'composition.json'))), previewVersionId: version?.id || null })
        await saveLibrary(root, library); send(res, 200, { compositions: await compositions(root, library) }); return
      }

      send(res, 404, { error: 'Endpoint Music Studio inexistente.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno no Music Studio.'
      send(res, 500, { error: message.slice(0, 800) })
    }
  }
}
