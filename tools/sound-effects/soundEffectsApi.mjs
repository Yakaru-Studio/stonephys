import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EFFECT_IDS = ['library-scroll-unroll', 'library-scroll-roll', 'border-cave-wind', 'border-cave-vegetation', 'border-cave-night-crickets', 'border-cave-ring-necked-dove', 'border-cave-crested-francolin', 'border-cave-natal-spurfowl', 'border-cave-chacma-baboon', 'border-cave-plains-zebra', 'lebombo-bone-engraving', 'magical-discovery', 'task-failure']
const definitionName = (id) => id.startsWith('library-scroll-') ? id.replace('library-scroll-', 'scroll-') : id
const APPROVAL = 'I understand this may consume quota or be billed'
const MAX_IMPORT_BYTES = 24 * 1024 * 1024
const inFlight = new Set()
const safeName = (value) => String(value).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const writeJson = async (file, data) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(data, null, 2)}\n`) }
const isOn = (value) => String(value ?? '').trim().toLowerCase() === 'true'

function paths(root) {
  return {
    root,
    definitions: path.join(root, 'content', 'sound-effects', 'library'),
    libraryFile: path.join(root, 'tools', 'sound-effects', 'manifests', 'library.json'),
    budgetFile: path.join(root, 'tools', 'sound-effects', 'manifests', 'budget.json'),
    generations: path.join(root, 'tools', 'sound-effects', 'generations'),
    imports: path.join(root, 'tools', 'sound-effects', 'imports'),
    processed: path.join(root, 'tools', 'sound-effects', 'processed'),
    approved: path.join(root, 'public', 'audio', 'sfx', 'approved'),
    approvedManifest: path.join(root, 'public', 'audio', 'sfx', 'approved', 'manifest.json'),
  }
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function bodyJson(req, maxBytes = MAX_IMPORT_BYTES * 1.4) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk; if (Buffer.byteLength(raw) > maxBytes) reject(new Error('A solicitação excede o limite local de tamanho.')) })
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('JSON inválido.')) } })
    req.on('error', reject)
  })
}

async function readLibrary(root) {
  const p = paths(root)
  const store = await readJson(p.libraryFile).catch(() => ({ schemaVersion: 1, updatedAt: null, effects: {}, requests: [] }))
  store.effects ||= {}; store.requests ||= []
  for (const id of EFFECT_IDS) store.effects[id] ||= { versions: [], previewVersionId: null, approvedVersionId: null }
  return store
}

async function saveLibrary(root, store) {
  store.updatedAt = new Date().toISOString()
  await writeJson(paths(root).libraryFile, store)
}

async function definitions(root, store) {
  const p = paths(root)
  return Promise.all(EFFECT_IDS.map(async (id) => {
    const definition = await readJson(path.join(p.definitions, `${definitionName(id)}.json`))
    const record = store.effects[id]
    const preview = record.versions.find((version) => version.id === record.previewVersionId)
    const approved = record.versions.find((version) => version.id === record.approvedVersionId)
    return {
      ...definition,
      versions: record.versions,
      previewVersionId: record.previewVersionId,
      approvedVersionId: record.approvedVersionId,
      previewUrl: preview ? `/__voice-studio/api/sfx/file/${id}/${preview.id}` : null,
      approvedAssetUrl: approved?.assetUrl || null,
    }
  }))
}

function mediaInfo(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,format_name,bit_rate:stream=codec_name,sample_rate,channels,channel_layout', '-of', 'json', file], { encoding: 'utf8', timeout: 15000, windowsHide: true })
  if (result.error || result.status !== 0) return { ffprobe: false, ffprobeNote: result.error?.code === 'ENOENT' ? 'FFprobe não instalado; o navegador fará a leitura da duração.' : result.stderr?.slice(0, 300) || 'FFprobe não conseguiu validar o áudio.' }
  try {
    const resultJson = JSON.parse(result.stdout); const stream = resultJson.streams?.[0]
    const durationSeconds = Number(resultJson.format?.duration) || null
    return { ffprobe: true, durationSeconds, durationMs: durationSeconds ? Math.round(durationSeconds * 1000) : null, format: resultJson.format?.format_name || null, bitrate: Number(resultJson.format?.bit_rate) || null, codec: stream?.codec_name || null, sampleRate: Number(stream?.sample_rate) || null, channels: Number(stream?.channels) || null, channelLayout: stream?.channel_layout || null }
  } catch { return { ffprobe: false, ffprobeNote: 'Resposta do FFprobe inválida.' } }
}

function validateSignal(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect,silencedetect=noise=-48dB:d=0.05', '-f', 'null', '-'], { encoding: 'utf8', timeout: 30000, windowsHide: true })
  if (result.error || result.status !== 0) return { ffmpeg: false, note: result.error?.code === 'ENOENT' ? 'FFmpeg não instalado; os demais dados técnicos permanecem disponíveis.' : result.stderr?.slice(-300) || 'FFmpeg não conseguiu analisar o sinal.' }
  const text = result.stderr || ''
  const peakDb = Number(text.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1])
  const meanDb = Number(text.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1])
  const leadingSilence = Number(text.match(/silence_start:\s*([\d.]+)/)?.[1]) || 0
  const trailing = [...text.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)].at(-1)
  return { ffmpeg: true, peakDb: Number.isFinite(peakDb) ? peakDb : null, meanDb: Number.isFinite(meanDb) ? meanDb : null, clippingDetected: Number.isFinite(peakDb) && peakDb >= 0, leadingSilenceSeconds: leadingSilence, trailingSilenceSeconds: trailing ? Number(trailing[2]) : 0 }
}

async function serveAudio(req, res, file, download = false) {
  const data = await readFile(file).catch(() => null)
  if (!data) { res.statusCode = 404; res.end('Arquivo local não encontrado.'); return }
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/)
  res.setHeader('Content-Type', path.extname(file).toLowerCase() === '.wav' ? 'audio/wav' : 'audio/mpeg')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${path.basename(file)}"`)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
    if (start >= data.length || end < start) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${data.length}`); res.end(); return }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`); res.setHeader('Content-Length', String(end - start + 1)); res.end(data.subarray(start, end + 1)); return
  }
  res.setHeader('Content-Length', String(data.length)); res.end(data)
}

function probeBinary(binary) {
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
  return !result.error && result.status === 0
}

function validateAssetPath(root, relative) {
  if (typeof relative !== 'string' || !relative.startsWith('tools/sound-effects/')) return null
  const full = path.resolve(root, relative)
  const base = path.resolve(root, 'tools', 'sound-effects') + path.sep
  return full.startsWith(base) ? full : null
}

async function processAudio(root, version, input, body) {
  const p = paths(root)
  const source = validateAssetPath(root, version.assetPath)
  if (!source) throw new Error('O arquivo de origem não pode ser processado por este estúdio.')
  const originalInfo = version.validation || mediaInfo(source)
  const duration = originalInfo.durationSeconds || version.requestedDurationSeconds || 2
  const start = Math.max(0, Math.min(duration - .05, Number(body.cropStartSeconds) || 0))
  const end = Math.max(start + .05, Math.min(duration, Number(body.cropEndSeconds) || duration))
  const volume = Math.max(0, Math.min(2, Number(body.volume ?? 1)))
  const fadeIn = Math.max(0, Math.min((end - start) / 2, Number(body.fadeInSeconds) || 0))
  const fadeOut = Math.max(0, Math.min((end - start) / 2, Number(body.fadeOutSeconds) || 0))
  const speed = Math.max(.5, Math.min(2, Number(body.speed) || 1))
  const pitch = Math.max(.5, Math.min(2, Number(body.pitch) || 1))
  const filters = []
  if (volume !== 1) filters.push(`volume=${volume}`)
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`)
  if (fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, end - start - fadeOut)}:d=${fadeOut}`)
  if (speed !== 1) filters.push(`atempo=${speed}`)
  if (pitch !== 1) filters.push(`asetrate=44100*${pitch},aresample=44100`)
  if (body.removeSilence) filters.push('silenceremove=start_periods=1:start_duration=0.04:start_threshold=-48dB:stop_periods=-1:stop_duration=0.06:stop_threshold=-48dB')
  if (body.reverse) filters.push('areverse')
  const fileName = `${version.id}-processed-${randomUUID().slice(0, 8)}.mp3`
  const output = path.join(p.processed, version.effectId, fileName)
  await mkdir(path.dirname(output), { recursive: true })
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-ss', String(start), '-to', String(end)]
  if (filters.length) args.push('-af', filters.join(','))
  args.push('-codec:a', 'libmp3lame', '-q:a', '3', output)
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 90000, windowsHide: true })
  if (result.error?.code === 'ENOENT') throw new Error('FFmpeg não está instalado; importe ou valide no navegador, ou instale FFmpeg para processar localmente.')
  if (result.error || result.status !== 0) throw new Error((result.stderr || 'FFmpeg falhou no processamento.').slice(-700))
  return { fileName, assetPath: path.relative(root, output).replaceAll(path.sep, '/'), info: mediaInfo(output), signal: validateSignal(output), processing: { cropStartSeconds: start, cropEndSeconds: end, volume, fadeInSeconds: fadeIn, fadeOutSeconds: fadeOut, speed, pitch, reverse: Boolean(body.reverse), removeSilence: Boolean(body.removeSilence) } }
}

export function createSoundEffectsMiddleware({ root, getApiKey, getSettings }) {
  return async (req, res, next) => {
    const route = (req.url || '/').split('?')[0]
    if (!route.startsWith('/')) return next()
    const host = req.socket.remoteAddress
    if (host && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(host)) { send(res, 403, { error: 'Sound Effects Studio aceita somente conexões locais.' }); return }
    const p = paths(root)
    const settings = getSettings()
    const apiKey = getApiKey()
    const model = settings.model || 'eleven_text_to_sound_v3'
    try {
      const store = await readLibrary(root)
      if (route === '/status' && req.method === 'GET') {
        const budget = await readJson(p.budgetFile)
        const allDefinitions = await definitions(root, store)
        const externalRequests = store.requests.filter((item) => item.externalRequestMade)
        const spentCredits = externalRequests.reduce((sum, item) => sum + Number(item.estimatedCredits || 0), 0)
        const paidGenerationEnabled = isOn(settings.generationEnabled) && isOn(settings.allowPaidGeneration)
        const reviewInfo = { ffmpeg: probeBinary('ffmpeg'), ffprobe: probeBinary('ffprobe') }
        send(res, 200, { apiConfigured: Boolean(apiKey), model, generationEnabled: isOn(settings.generationEnabled), paidGenerationAllowed: isOn(settings.allowPaidGeneration), canGenerate: Boolean(apiKey) && model === 'eleven_text_to_sound_v3' && paidGenerationEnabled && externalRequests.length < budget.maxPaidRequests, providerPriceUsdPerMinute: .12, creditsPerSecond: budget.creditsPerSecond, authorizedCredits: budget.authorizedCredits, spentCredits, remainingCredits: Math.max(0, budget.authorizedCredits - spentCredits), maxPaidRequests: budget.maxPaidRequests, paidRequests: externalRequests.length, effects: allDefinitions, requests: store.requests, tooling: reviewInfo, studioLocalOnly: true })
        return
      }

      const fileMatch = route.match(/^\/file\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/)
      if (fileMatch && req.method === 'GET') {
        const [, effectId, versionId] = fileMatch
        const version = store.effects[effectId].versions.find((item) => item.id === versionId)
        const file = version && validateAssetPath(root, version.assetPath)
        if (!file) { res.statusCode = 404; res.end(); return }
        await serveAudio(req, res, file, new URL(req.url, 'http://localhost').searchParams.get('download') === '1')
        return
      }

      if (route === '/prompt' && req.method === 'POST') {
        const body = await bodyJson(req, 100_000)
        if (!EFFECT_IDS.includes(body.effectId)) { send(res, 400, { error: 'Efeito desconhecido.' }); return }
        const prompt = String(body.prompt || '').trim()
        if (!prompt || prompt.length > 450) { send(res, 400, { error: 'O prompt precisa ter de 1 a 450 caracteres.' }); return }
        const file = path.join(p.definitions, `${definitionName(body.effectId)}.json`)
        const definition = await readJson(file)
        definition.promptRevisions ||= []
        if (definition.prompt !== prompt) definition.promptRevisions.unshift({ prompt: definition.prompt, savedAt: new Date().toISOString() })
        definition.prompt = prompt
        if (body.durationSeconds !== undefined) definition.durationSeconds = Math.max(.5, Math.min(30, Number(body.durationSeconds)))
        if (body.promptInfluence !== undefined) definition.promptInfluence = Math.max(0, Math.min(1, Number(body.promptInfluence)))
        if (body.volume !== undefined) definition.defaultVolume = Math.max(0, Math.min(1, Number(body.volume)))
        definition.loop = Boolean(body.loop)
        await writeJson(file, definition)
        send(res, 200, { ok: true }); return
      }

      if (route === '/license' && req.method === 'POST') {
        const body = await bodyJson(req, 30_000)
        if (!EFFECT_IDS.includes(body.effectId)) { send(res, 400, { error: 'Efeito desconhecido.' }); return }
        const file = path.join(p.definitions, `${definitionName(body.effectId)}.json`)
        const definition = await readJson(file)
        definition.license = { plan: String(body.plan || 'unknown').slice(0, 80), commercialRightsConfirmed: Boolean(body.commercialRightsConfirmed), evaluationOnly: !body.commercialRightsConfirmed, notes: String(body.notes || '').slice(0, 600), updatedAt: new Date().toISOString() }
        await writeJson(file, definition)
        send(res, 200, { ok: true }); return
      }

      if (route === '/preview' && req.method === 'POST') {
        const body = await bodyJson(req, 20_000)
        if (!EFFECT_IDS.includes(body.effectId)) { send(res, 400, { error: 'Efeito desconhecido.' }); return }
        const record = store.effects[body.effectId]
        if (body.versionId && !record.versions.some((version) => version.id === body.versionId)) { send(res, 404, { error: 'Versão não encontrada.' }); return }
        record.previewVersionId = body.versionId || null
        await saveLibrary(root, store)
        send(res, 200, { ok: true }); return
      }

      if (route === '/metadata' && req.method === 'POST') {
        const body = await bodyJson(req, 30_000)
        const version = store.effects[body.effectId]?.versions.find((item) => item.id === body.versionId)
        if (!version) { send(res, 404, { error: 'Versão não encontrada.' }); return }
        version.volume = Math.max(0, Math.min(1, Number(body.volume ?? version.volume ?? .72)))
        version.cropStartSeconds = Math.max(0, Number(body.cropStartSeconds ?? version.cropStartSeconds ?? 0))
        version.cropEndSeconds = body.cropEndSeconds == null ? null : Math.max(version.cropStartSeconds + .01, Number(body.cropEndSeconds))
        version.syncOffsetMs = Math.max(-2000, Math.min(2000, Number(body.syncOffsetMs ?? version.syncOffsetMs ?? 0)))
        version.notes = String(body.notes ?? version.notes ?? '').slice(0, 1000)
        version.playback = { loop: false, ...version.playback }
        const approved = store.effects[body.effectId]?.approvedVersionId === version.id
        if (approved && version.productionEligible) {
          const catalog = await readJson(p.approvedManifest).catch(() => ({ schemaVersion: 1, effects: {} }))
          if (catalog.effects?.[body.effectId]) { catalog.effects[body.effectId].volume = version.volume; await writeJson(p.approvedManifest, catalog) }
        }
        await saveLibrary(root, store)
        send(res, 200, { ok: true }); return
      }

      if (route === '/import' && req.method === 'POST') {
        const body = await bodyJson(req, MAX_IMPORT_BYTES * 1.45)
        if (!EFFECT_IDS.includes(body.effectId) || !/^audio\/(mpeg|mp3|wav|x-wav|ogg|mp4|webm|flac)/i.test(String(body.mimeType || ''))) { send(res, 400, { error: 'Escolha um arquivo de áudio válido e um efeito do catálogo.' }); return }
        const data = Buffer.from(String(body.data || ''), 'base64')
        if (!data.length || data.length > MAX_IMPORT_BYTES) { send(res, 400, { error: 'O arquivo de áudio está vazio ou excede 24 MB.' }); return }
        const versionId = `import-${randomUUID()}`
        const extension = String(body.fileName || '').match(/\.(mp3|wav|ogg|m4a|webm|flac)$/i)?.[0].toLowerCase() || '.audio'
        const fileName = `${versionId}${extension}`
        const fullPath = path.join(p.imports, body.effectId, fileName)
        await mkdir(path.dirname(fullPath), { recursive: true }); await writeFile(fullPath, data)
        const info = mediaInfo(fullPath); const signal = validateSignal(fullPath)
        const version = { id: versionId, effectId: body.effectId, name: String(body.fileName || 'Áudio importado').slice(0, 160), source: 'imported', provider: 'local', model: null, prompt: '', requestedDurationSeconds: null, durationSeconds: info.durationSeconds, generatedAt: null, createdAt: new Date().toISOString(), estimatedCredits: 0, actualCredits: null, status: 'generated', assetPath: path.relative(root, fullPath).replaceAll(path.sep, '/'), bytes: data.length, mimeType: body.mimeType, validation: { ...info, signal }, volume: .72, cropStartSeconds: 0, cropEndSeconds: info.durationSeconds, notes: '' }
        store.effects[body.effectId].versions.unshift(version); store.effects[body.effectId].previewVersionId = version.id
        await saveLibrary(root, store); send(res, 200, { version }); return
      }

      if (route === '/generate' && req.method === 'POST') {
        const body = await bodyJson(req, 30_000)
        if (!EFFECT_IDS.includes(body.effectId)) { send(res, 400, { error: 'Efeito desconhecido.' }); return }
        if (body.authorization !== APPROVAL) { send(res, 428, { error: 'Confirme a solicitação de geração paga no estúdio antes de prosseguir.' }); return }
        if (!apiKey) { send(res, 409, { error: 'ELEVENLABS_API_KEY não configurada no ambiente local.' }); return }
        if (!isOn(settings.generationEnabled) || !isOn(settings.allowPaidGeneration)) { send(res, 409, { error: 'Geração bloqueada. Ative SFX_GENERATION_ENABLED e SFX_ALLOW_PAID_GENERATION no ambiente local para usar o orçamento autorizado.' }); return }
        if (model !== 'eleven_text_to_sound_v3' || body.model !== model) { send(res, 400, { error: 'A geração desta tarefa usa exclusivamente eleven_text_to_sound_v3.' }); return }
        const definitionPath = path.join(p.definitions, `${definitionName(body.effectId)}.json`)
        const definition = await readJson(definitionPath)
        const prompt = String(body.prompt || '').trim()
        if (!prompt || prompt.length > 450) { send(res, 400, { error: 'O prompt precisa ter de 1 a 450 caracteres.' }); return }
        const durationSeconds = Number(body.durationSeconds)
        const promptInfluence = Number(body.promptInfluence)
        if (!Number.isFinite(durationSeconds) || durationSeconds < .5 || durationSeconds > 30 || !Number.isFinite(promptInfluence) || promptInfluence < 0 || promptInfluence > 1 || Boolean(body.loop) !== Boolean(definition.loop)) { send(res, 400, { error: 'Duração deve estar entre 0,5 e 30 s, influência entre 0 e 1 e loop deve corresponder à definição.' }); return }
        const budget = await readJson(p.budgetFile)
        const estimatedCredits = durationSeconds * budget.creditsPerSecond
        const externalRequests = store.requests.filter((item) => item.externalRequestMade)
        const configHash = createHash('sha256').update(JSON.stringify({ effectId: body.effectId, prompt, model, durationSeconds, promptInfluence, loop: Boolean(body.loop), outputFormat: 'mp3_44100_128' })).digest('hex')
        const duplicate = store.requests.find((item) => item.requestId === body.requestId)
        if (duplicate) { send(res, 200, { duplicate: true, request: duplicate }); return }
        if (inFlight.has(body.effectId)) { send(res, 409, { error: 'Este efeito já está sendo gerado. Aguarde o resultado da única solicitação.' }); return }
        const spentCredits = externalRequests.reduce((sum, item) => sum + Number(item.estimatedCredits || 0), 0)
        if (externalRequests.length >= budget.maxPaidRequests || spentCredits + estimatedCredits > budget.authorizedCredits) { send(res, 409, { error: `A solicitação excederia o limite autorizado de ${budget.maxPaidRequests} gerações ou ${budget.authorizedCredits} créditos.` }); return }
        inFlight.add(body.effectId)
        const request = { requestId: String(body.requestId || randomUUID()), effectId: body.effectId, configHash, model, durationRequestedSeconds: durationSeconds, estimatedCredits, actualCredits: null, status: 'pending', startedAt: new Date().toISOString(), externalRequestMade: true, outputFormat: 'mp3_44100_128' }
        store.requests.push(request); await saveLibrary(root, store)
        try {
          const params = new URLSearchParams({ output_format: 'mp3_44100_128' })
          const response = await fetch(`https://api.elevenlabs.io/v1/sound-generation?${params}`, { method: 'POST', headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify({ text: prompt, model_id: model, duration_seconds: durationSeconds, prompt_influence: promptInfluence, loop: Boolean(body.loop) }), signal: AbortSignal.timeout(180_000) })
          if (!response.ok) {
            const message = (await response.text()).slice(0, 600)
            request.status = 'failed'; request.httpStatus = response.status; request.error = `ElevenLabs HTTP ${response.status}: ${message}`; request.completedAt = new Date().toISOString()
            await saveLibrary(root, store); send(res, 502, { error: request.error, request }); return
          }
          const data = Buffer.from(await response.arrayBuffer())
          if (!data.length || data.length > MAX_IMPORT_BYTES) throw new Error('A API retornou um arquivo vazio ou acima de 24 MB; a solicitação paga não será repetida automaticamente.')
          const versionId = `gen-${randomUUID()}`
          const fileName = `${versionId}.mp3`
          const fullPath = path.join(p.generations, body.effectId, fileName)
          await mkdir(path.dirname(fullPath), { recursive: true }); await writeFile(fullPath, data)
          const info = mediaInfo(fullPath); const signal = validateSignal(fullPath)
          const version = { id: versionId, effectId: body.effectId, name: definition.name, source: 'generated', provider: 'elevenlabs', model, prompt, requestedDurationSeconds: durationSeconds, promptInfluence, loop: Boolean(body.loop), outputFormat: 'mp3_44100_128', durationSeconds: info.durationSeconds, generatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), estimatedCredits, actualCredits: null, providerCostHeader: response.headers.get('character-cost') || null, status: 'generated', assetPath: path.relative(root, fullPath).replaceAll(path.sep, '/'), bytes: data.length, validation: { ...info, signal }, volume: definition.defaultVolume ?? .72, cropStartSeconds: 0, cropEndSeconds: info.durationSeconds, synchronization: { event: definition.eventBindings?.[0] || null, offsetMs: 0 }, license: { ...definition.license }, notes: '' }
          store.effects[body.effectId].versions.unshift(version); store.effects[body.effectId].previewVersionId = version.id
          request.status = 'generated'; request.versionId = version.id; request.durationActualSeconds = info.durationSeconds; request.bytes = data.length; request.completedAt = new Date().toISOString(); request.providerUsage = { characterCostHeader: version.providerCostHeader }
          await saveLibrary(root, store); send(res, 200, { version, request }); return
        } catch (error) {
          request.status = 'failed'; request.error = error instanceof Error ? error.message.slice(0, 700) : 'Erro desconhecido do provedor.'; request.completedAt = new Date().toISOString(); await saveLibrary(root, store)
          send(res, 502, { error: request.error, request }); return
        } finally { inFlight.delete(body.effectId) }
      }

      if (route === '/process' && req.method === 'POST') {
        const body = await bodyJson(req, 30_000)
        const version = store.effects[body.effectId]?.versions.find((item) => item.id === body.versionId)
        if (!version) { send(res, 404, { error: 'Versão não encontrada.' }); return }
        if (!probeBinary('ffmpeg')) { send(res, 409, { error: 'FFmpeg não está instalado. Os ajustes de reprodução continuam disponíveis; o processamento local requer FFmpeg.' }); return }
        const processed = await processAudio(root, version, body)
        const next = { ...version, ...processed, id: `proc-${randomUUID()}`, parentVersionId: version.id, source: 'processed', status: 'generated', createdAt: new Date().toISOString(), generatedAt: null, actualCredits: 0, estimatedCredits: 0, notes: String(body.notes || 'Processado localmente sem créditos.').slice(0, 1000) }
        store.effects[body.effectId].versions.unshift(next); store.effects[body.effectId].previewVersionId = next.id
        await saveLibrary(root, store); send(res, 200, { version: next }); return
      }

      if (route === '/review' && req.method === 'POST') {
        const body = await bodyJson(req, 30_000)
        const record = store.effects[body.effectId]
        const version = record?.versions.find((item) => item.id === body.versionId)
        if (!version) { send(res, 404, { error: 'Versão não encontrada.' }); return }
        if (!['approved', 'rejected'].includes(body.status)) { send(res, 400, { error: 'Estado de revisão inválido.' }); return }
        version.status = body.status; version.reviewedAt = new Date().toISOString(); version.notes = String(body.notes || version.notes || '').slice(0, 1000)
        if (body.status === 'approved') {
          record.approvedVersionId = version.id
          const definition = await readJson(path.join(p.definitions, `${definitionName(body.effectId)}.json`))
          if (definition.license?.commercialRightsConfirmed && body.publish === true) {
            const source = validateAssetPath(root, version.assetPath)
            if (!source) { send(res, 409, { error: 'Esta versão não pode ser copiada como asset aprovado.' }); return }
            const basename = `${definitionName(body.effectId)}.mp3`
            const directory = path.join(p.approved, 'library')
            await mkdir(directory, { recursive: true }); await copyFile(source, path.join(directory, basename))
            version.assetUrl = `/audio/sfx/approved/library/${basename}`; version.productionEligible = true
            const catalog = await readJson(p.approvedManifest).catch(() => ({ schemaVersion: 1, effects: {} }))
            catalog.effects[body.effectId] = { url: version.assetUrl, volume: version.volume ?? definition.defaultVolume, durationSeconds: version.durationSeconds, loop: version.loop ?? definition.loop, versionId: version.id, approvedAt: version.reviewedAt, provider: version.provider, model: version.model, license: definition.license }
            await writeJson(p.approvedManifest, catalog)
          } else { version.productionEligible = false; version.assetUrl = null; version.evaluationOnly = true }
        } else if (record.approvedVersionId === version.id) record.approvedVersionId = null
        await saveLibrary(root, store); send(res, 200, { ok: true, productionEligible: Boolean(version.productionEligible), version }); return
      }

      send(res, 404, { error: 'Rota do Sound Effects Studio inexistente.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno no Sound Effects Studio.'
      send(res, 500, { error: message.slice(0, 800) })
    }
  }
}
