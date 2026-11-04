// FRONTEND-1 (W6 P4-21): proof of the voice call's two speech routes, POST /api/studio/voice/transcribe and /api/studio/voice/speak, and their pure server module lib/server/studio-voice-router.ts.
//   A. The module, function by function (flag, router address, headers, WAV header, request bodies, transcript parsing, the internal signal line, status mapping).
//   B. The handlers with a fake fetch: flag off is 404 and reads nothing, auth 401, router unset 503, type 415, size 413, timeout 504, router errors 429 / 502, no cost header ever (cost is internal, ROUTER-1 2026-11-04) while the router's signal figures are logged server-side, x-generation-id passed through.
//   C. The two route files, run with stub next-auth / auth options: the signed-in user's id reaches the router, nobody signed in is 401, flag off is 404.
//   D. Flag-off identity: the client seam (lib/studio-voice-call-router.ts) is unchanged, no existing app file imports the new module, and no browser file names the router key.
//   E. MUTANTS: each must be caught by A-C.
//   node scripts/test-studio-voice-speech-routes.mjs        Offline: every fetch is a fake; nothing reaches the network.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-speech-'))
let checks = 0
const ok = (c, m) => { checks++; assert.ok(c, m) }
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m) }
globalThis.fetch = () => { throw new Error('network is not allowed in this proof') }

let n = 0
async function load(source, replace = {}) {
  let js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [from, to] of Object.entries(replace)) js = js.split(`'${from}'`).join(`'${to}'`).split(`"${from}"`).join(`"${to}"`)
  const file = path.join(tmp, `m${n++}.mjs`)
  fs.writeFileSync(file, js)
  return import(pathToFileURL(file).href)
}

const MODULE_REL = 'lib/server/studio-voice-router.ts'
const SRC = read(MODULE_REL)

function wav({ rate = 16000, channels = 1, bits = 16, format = 1, samples = 1600 } = {}) {
  const data = samples * channels * (bits / 8)
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(format, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * channels * bits / 8, 28); b.writeUInt16LE(channels * bits / 8, 32); b.writeUInt16LE(bits, 34)
  b.write('data', 36); b.writeUInt32LE(data, 40)
  return new Uint8Array(b)
}
const ENV_ON = { NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true', MODEL_ROUTER_URL: 'https://router.test/v1/', MODEL_ROUTER_STUDIO_KEY: 'sk-test-key' }
const sttRequest = (bytes = wav(), type = 'audio/wav', extra = {}) => { const f = new FormData(); f.append('audio', new Blob([bytes], { type }), 'turn.wav'); f.append('label', 'studio.voice_stt'); return new Request('http://studio.test/api/studio/voice/transcribe', { method: 'POST', body: f, ...extra }) }
const ttsRequest = (body, type = 'application/json') => new Request('http://studio.test/api/studio/voice/speak', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': type } })
const routerJson = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const routerAudio = (headers = {}) => new Response(new Uint8Array([73, 68, 51, 1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'x-generation-id': 'gen-123', ...headers } })

function fakeFetch(answer) {
  const calls = []
  const fn = async (url, init) => { calls.push({ url, init }); return typeof answer === 'function' ? answer(url, init) : answer.clone() }
  fn.calls = calls
  return fn
}
const deps = (over = {}) => ({ env: ENV_ON, fetch: fakeFetch(routerJson({ choices: [{ message: { content: ' hello deck ' } }] })), userId: async () => 'user_1', traceId: () => 'trc_abc123abc123', timeoutMs: 200, log: () => {}, ...over })
const SIGNAL = { 'X-MR-Cost-USD': '0.000412', 'X-MR-Model-Served': 'google/gemini-3.5-flash-lite', 'X-MR-Fallback-Depth': '0', 'X-MR-Attempts': '1' }
const COSTY = /cost|usd|margin|0\.000412|0\.0004\b/i

async function suite(m) {
  // ---------- A. the module ----------
  ok(m.voiceSpeechOn({ NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' }) && !m.voiceSpeechOn({ NEXT_PUBLIC_STUDIO_VOICE_CALL: 'TRUE' }) && !m.voiceSpeechOn({}), 'A flag: exactly "true"')
  eq(m.routerAddress(ENV_ON), { baseUrl: 'https://router.test', key: 'sk-test-key' }, 'A address: /v1 and slashes dropped')
  eq(m.routerAddress({ MODEL_ROUTER_URL: 'https://r.test' }), null, 'A address: no key -> null')
  eq(m.routerAddress({ MODEL_ROUTER_URL: 'ftp://r.test', MODEL_ROUTER_STUDIO_KEY: 'k' }), null, 'A address: not http(s) -> null')
  eq(m.routerAddress({ MODEL_ROUTER_URL: 'https://r.test', MODEL_ROUTER_STUDIO_KEY: 'a b' }), null, 'A address: a key with a space -> null')
  const h = m.routerHeaders({ baseUrl: 'x', key: 'k1' }, 'studio.voice_stt', 'user_1', 'trc_1')
  eq([h.Authorization, h['X-MR-Service'], h['X-MR-Task'], h['X-MR-User-ID'], h['X-MR-Trace-ID'], h['X-MR-Signal'], 'X-MR-Group' in h], ['Bearer k1', 'studio', 'studio.voice_stt', 'user_1', 'trc_1', 'headers', false], 'A headers: key, service, task, identity, X-MR-Signal headers, no X-MR-Group')
  ok(!('X-MR-User-ID' in m.routerHeaders({ baseUrl: 'x', key: 'k' }, 't', 'a@b.c d', null)), 'A headers: an id that is not opaque is left out')
  eq(m.readWavHeader(wav()), { format: 1, channels: 1, sampleRate: 16000, bitsPerSample: 16 }, 'A wav: header read')
  ok(m.isCallWav(m.readWavHeader(wav())), 'A wav: the capture format passes')
  for (const bad of [{ rate: 44100 }, { channels: 2 }, { bits: 8 }, { format: 3 }]) ok(!m.isCallWav(m.readWavHeader(wav(bad))), `A wav: ${JSON.stringify(bad)} refused`)
  eq(m.readWavHeader(new Uint8Array(60)), null, 'A wav: not RIFF -> null')
  const sttBody = JSON.parse(m.buildTranscribeBody(wav()))
  const part = sttBody.messages[0].content.find(p => p.type === 'input_audio')
  ok(part && part.input_audio.format === 'wav' && Buffer.from(part.input_audio.data, 'base64').subarray(0, 4).toString() === 'RIFF', 'A stt body: input_audio is base64 WAV')
  ok(sttBody.model === m.VOICE_STT_MODEL && sttBody.temperature === 0, 'A stt body: model and temperature')
  eq(JSON.parse(m.buildSpeakBody('Hi.', 'ava')), { model: 'microsoft/mai-voice-2-flash', input: 'Hi.', voice: 'en-US-AvaNeural', response_format: 'mp3' }, 'A tts body')
  eq(m.parseTranscript({ choices: [{ message: { content: ' hi ' } }] }), 'hi', 'A transcript: string content')
  eq(m.parseTranscript({ choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] }), 'ab', 'A transcript: parts')
  eq(m.parseTranscript({ choices: [] }), null, 'A transcript: none -> null')
  eq(m.parseTranscript({ choices: [{ message: { content: '' } }] }), '', 'A transcript: empty is an answer, not an error')
  eq(m.VOICE_STT_MODEL, 'google/gemini-3.5-flash-lite', 'A stt model: ROUTER-1\'s slug')
  eq(Object.fromEntries(Object.entries(m.VOICE_TTS_VOICES).map(([k, v]) => [k, v.model])), { ava: 'microsoft/mai-voice-2-flash', andrew: 'microsoft/mai-voice-2-flash', alloy: 'fish-audio/s2.1-pro' }, 'A tts models')
  ok(!SRC.includes('TODO-ROUTER-LABEL'), 'A: no TODO-ROUTER-LABEL left')
  eq(m.internalSignalLine('studio.voice_stt', new Headers(SIGNAL), { usage: { cost: 0.0004 } }), '[VoiceCall] studio.voice_stt cost-usd=0.000412 model-served=google/gemini-3.5-flash-lite fallback-depth=0 attempts=1 usage-cost=0.0004', 'A signal: one server log line')
  eq(m.internalSignalLine('t', new Headers({}), {}), null, 'A signal: nothing said -> no line')
  eq(m.internalSignalLine('t', new Headers({ 'X-MR-Attempts': 'a\tb' }), {}), null, 'A signal: a value with control characters is not logged')
  eq([m.mapRouterStatus(429), m.mapRouterStatus(402), m.mapRouterStatus(500), m.mapRouterStatus(401), m.mapRouterStatus(400)], [429, 429, 502, 502, 502], 'A status mapping')

  // ---------- B. the handlers ----------
  for (const [name, handler, req] of [['stt', m.handleTranscribe, () => sttRequest()], ['tts', m.handleSpeak, () => ttsRequest({ text: 'Hi.' })]]) {
    let asked = false
    const off = await handler(req(), deps({ env: { ...ENV_ON, NEXT_PUBLIC_STUDIO_VOICE_CALL: 'false' }, userId: async () => { asked = true; return 'u' } }))
    ok(off.status === 404 && !asked, `B ${name}: flag off -> 404 before auth is read`)
    eq((await handler(req(), deps({ userId: async () => null }))).status, 401, `B ${name}: nobody signed in -> 401`)
    const unset = deps({ env: { NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' } })
    ok((await handler(req(), unset)).status === 503 && unset.fetch.calls.length === 0, `B ${name}: router unset -> 503, no call`)
    const hang = deps({ fetch: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))), timeoutMs: 20 })
    eq((await handler(req(), hang)).status, 504, `B ${name}: timeout -> 504`)
    eq((await handler(req(), deps({ fetch: fakeFetch(routerJson({ error: { message: 'slow down' } }, 429)) }))).status, 429, `B ${name}: router 429 -> 429`)
    eq((await handler(req(), deps({ fetch: fakeFetch(routerJson({ error: {} }, 500)) }))).status, 502, `B ${name}: router 500 -> 502`)
    eq((await handler(req(), deps({ fetch: async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }) } }))).status, 502, `B ${name}: unreachable -> 502`)
    const leak = await (await handler(req(), deps({ fetch: fakeFetch(routerJson({ error: { message: 'sk-test-key bad' } }, 401)) }))).text()
    ok(!leak.includes('sk-test-key'), `B ${name}: no error body names the key`)
  }
  // transcribe
  const logged = []
  const d = deps({ log: line => logged.push(line), fetch: fakeFetch(new Response(JSON.stringify({ choices: [{ message: { content: ' hello deck ' } }], usage: { cost: 0.0004 } }), { status: 200, headers: { 'Content-Type': 'application/json', ...SIGNAL } })) })
  const r = await m.handleTranscribe(sttRequest(), d)
  const rText = await r.text()
  eq([r.status, JSON.parse(rText), r.headers.get('X-Deckster-Cost-Usd')], [200, { text: 'hello deck' }, null], 'B stt: 200 {text}, no cost header even when the router said the cost')
  ok(![...r.headers].some(([k, v]) => COSTY.test(k) || COSTY.test(v) || /^x-mr-/i.test(k)) && !COSTY.test(rText), 'B stt: no cost, margin or router signal reaches the browser')
  eq(logged.length === 1 && logged[0].includes('cost-usd=0.000412') && logged[0].includes('usage-cost=0.0004'), true, 'B stt: the internal figures are logged server-side')
  eq(d.fetch.calls[0].init.headers['X-MR-Signal'], 'headers', 'B stt: X-MR-Signal headers sent')
  const call = d.fetch.calls[0]
  ok(call.url === 'https://router.test/v1/chat/completions' && call.init.headers['X-MR-Task'] === 'studio.voice_stt' && call.init.headers.Authorization === 'Bearer sk-test-key' && call.init.headers['X-MR-User-ID'] === 'user_1', 'B stt: chat/completions with the task, the key and the user')
  ok(!call.url.includes('transcriptions'), 'B stt: never /audio/transcriptions')
  const noCost = await m.handleTranscribe(sttRequest(), deps())
  ok(noCost.status === 200 && noCost.headers.get('X-Deckster-Cost-Usd') === null, 'B stt: cost unknown -> no header')
  eq((await m.handleTranscribe(new Request('http://s.test/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), deps())).status, 415, 'B stt: not multipart -> 415')
  eq((await m.handleTranscribe(sttRequest(wav(), 'audio/webm'), deps())).status, 415, 'B stt: a webm part -> 415')
  eq((await m.handleTranscribe(sttRequest(wav({ rate: 48000 })), deps())).status, 415, 'B stt: 48 kHz -> 415')
  eq((await m.handleTranscribe(sttRequest(new Uint8Array(100)), deps())).status, 415, 'B stt: not a WAV -> 415')
  const big = deps()
  ok((await m.handleTranscribe(sttRequest(wav({ samples: 510_000 })), big)).status === 413 && big.fetch.calls.length === 0, 'B stt: over ~30 s -> 413, no call')
  ok((await m.handleTranscribe(sttRequest(wav({ samples: 480_000 })), deps())).status === 200, 'B stt: 30 s exactly passes')
  const declared = new Request('http://s.test/x', { method: 'POST', body: 'x', headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(5_000_000) } })
  eq((await m.handleTranscribe(declared, deps())).status, 413, 'B stt: a declared length over the cap -> 413 before reading')
  eq((await m.handleTranscribe(sttRequest(), deps({ fetch: fakeFetch(routerJson({ nope: 1 })) }))).status, 502, 'B stt: an answer with no transcript -> 502')
  const empty = await m.handleTranscribe(sttRequest(), deps({ fetch: fakeFetch(routerJson({ choices: [{ message: { content: '' } }] })) }))
  eq([empty.status, await empty.json()], [200, { text: '' }], 'B stt: no words -> 200 empty text')
  // speak
  const sd = deps({ fetch: fakeFetch(routerAudio()) })
  const s = await m.handleSpeak(ttsRequest({ text: 'Your deck is ready.', label: 'studio.voice_tts' }), sd)
  eq([s.status, s.headers.get('content-type'), s.headers.get('x-generation-id'), s.headers.get('X-Deckster-Cost-Usd'), [...new Uint8Array(await s.arrayBuffer())]], [200, 'audio/mpeg', 'gen-123', null, [73, 68, 51, 1, 2, 3]], 'B tts: the audio, its type, x-generation-id, no cost header when unknown')
  const sc = sd.fetch.calls[0]
  ok(sc.url === 'https://router.test/v1/audio/speech' && sc.init.headers['X-MR-Task'] === 'studio.voice_tts' && JSON.parse(sc.init.body).voice === 'en-US-AvaNeural', 'B tts: audio/speech, the task, the default voice')
  const ttsLogged = []
  const costly = await m.handleSpeak(ttsRequest({ text: 'Hi.' }), deps({ log: line => ttsLogged.push(line), fetch: fakeFetch(routerAudio({ ...SIGNAL, 'X-Deckster-Cost-Usd': '0.0002' })) }))
  ok(costly.status === 200 && ![...costly.headers].some(([k, v]) => COSTY.test(k) || COSTY.test(v) || /^x-mr-/i.test(k)), 'B tts: no cost header or router signal passed through, whatever the router sends')
  ok(ttsLogged.length === 1 && ttsLogged[0].startsWith('[VoiceCall] studio.voice_tts cost-usd=0.000412'), 'B tts: the internal figures are logged server-side')
  eq(JSON.parse((await (async () => { const f = deps({ fetch: fakeFetch(routerAudio()) }); await m.handleSpeak(ttsRequest({ text: 'Hi.', voice: 'andrew' }), f); return f.fetch.calls[0].init.body })())).voice, 'en-US-AndrewNeural', 'B tts: an allowed voice')
  eq((await m.handleSpeak(ttsRequest({ text: 'Hi.', voice: 'zephyr' }), deps())).status, 400, 'B tts: a voice not on the list -> 400')
  eq((await m.handleSpeak(ttsRequest({ text: 'Hi.', voice: 'constructor' }), deps())).status, 400, 'B tts: a prototype name is not a voice')
  eq((await m.handleSpeak(ttsRequest({ text: '  ' }), deps())).status, 400, 'B tts: no text -> 400')
  eq((await m.handleSpeak(ttsRequest({ text: 'x'.repeat(601) }), deps())).status, 413, 'B tts: over the cap -> 413')
  eq((await m.handleSpeak(ttsRequest({ text: 'x'.repeat(600) }), deps({ fetch: fakeFetch(routerAudio()) }))).status, 200, 'B tts: the cap itself passes')
  eq((await m.handleSpeak(ttsRequest('text=hi', 'text/plain'), deps())).status, 415, 'B tts: not JSON -> 415')
  eq((await m.handleSpeak(ttsRequest('{bad', 'application/json'), deps())).status, 400, 'B tts: bad JSON -> 400')
  eq((await m.handleSpeak(ttsRequest({ text: 'Hi.' }), deps({ fetch: fakeFetch(routerJson({ ok: 1 })) }))).status, 502, 'B tts: an answer that is not audio -> 502')
}

const m = await load(SRC)
await suite(m)
const afterSuite = checks

// ---------- C. the route files ----------
const stub = (name, body) => { const f = path.join(tmp, name); fs.writeFileSync(f, body); return pathToFileURL(f).href }
const moduleUrl = pathToFileURL(path.join(tmp, 'm0.mjs')).href
for (const kind of ['transcribe', 'speak']) {
  const rel = `app/api/studio/voice/${kind}/route.ts`
  const text = read(rel)
  ok(text.includes("getServerSession(authOptions)") && text.includes("from '@/lib/server/studio-voice-router'"), `C ${kind}: session check and the module`)
  for (const [session, want] of [[{ user: { id: 'user_9', email: 'a@b.c' } }, 'routed'], [null, 401], [{ user: { email: 'a@b.c' } }, 401]]) {
    const route = await load(text, {
      'next-auth': stub(`na${n}.mjs`, `export async function getServerSession() { return ${JSON.stringify(session)} }`),
      '@/lib/auth-options': stub(`ao${n}.mjs`, 'export const authOptions = {}'),
      '@/lib/server/studio-voice-router': moduleUrl,
    })
    const saved = { ...process.env }
    Object.assign(process.env, ENV_ON)
    const seen = []
    globalThis.fetch = async (url, init) => { seen.push(init); return kind === 'speak' ? routerAudio() : routerJson({ choices: [{ message: { content: 'hi' } }] }) }
    const res = await route.POST(kind === 'speak' ? ttsRequest({ text: 'Hi.' }) : sttRequest())
    if (want === 'routed') ok(res.status === 200 && seen[0].headers['X-MR-User-ID'] === 'user_9' && /^trc_[0-9a-f]{12}$/.test(seen[0].headers['X-MR-Trace-ID']), `C ${kind}: signed in -> 200, the user's id reaches the router`)
    else ok(res.status === 401 && seen.length === 0, `C ${kind}: ${JSON.stringify(session)} -> 401, no router call`)
    process.env.NEXT_PUBLIC_STUDIO_VOICE_CALL = 'false'
    eq((await route.POST(kind === 'speak' ? ttsRequest({ text: 'Hi.' }) : sttRequest())).status, 404, `C ${kind}: flag off -> 404`)
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
    globalThis.fetch = () => { throw new Error('network is not allowed in this proof') }
  }
}

// ---------- D. flag-off identity ----------
const client = read('lib/studio-voice-call-router.ts')
ok(client.includes("transcribe: '/api/studio/voice/transcribe'") && client.includes("speak: '/api/studio/voice/speak'") && client.includes("VOICE_COST_HEADER = 'X-Deckster-Cost-Usd'"), 'D: the client seam names exactly these routes and this header')
ok(!/^import /m.test(SRC), 'D: the module is import-free')
const strip = await import(pathToFileURL(path.join(root, 'scripts/studio-voice-call-strip.mjs')).href)
for (const rel of [MODULE_REL, 'app/api/studio/voice/transcribe/route.ts', 'app/api/studio/voice/speak/route.ts', 'scripts/test-studio-voice-speech-routes.mjs']) ok(strip.VOICE_CALL_NEW_FILES.includes(rel), `D: ${rel} is registered as a new file of the voice call`)
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)])
const appFiles = ['app', 'lib', 'hooks', 'components'].flatMap(walk).filter(f => /\.(ts|tsx)$/.test(f))
const importers = appFiles.filter(f => !f.startsWith('app/api/studio/voice/') && read(f).includes('server/studio-voice-router'))
eq(importers, [], 'D: no other app file imports the server module (flag off, the rest of Studio is untouched)')
const browserKey = appFiles.filter(f => (f.startsWith('components/') || f.startsWith('hooks/') || f.includes('studio-voice-call')) && read(f).includes('MODEL_ROUTER_STUDIO_KEY'))
eq(browserKey, [], 'D: no browser file names the router key')

// ---------- D2. the call UI shows no cost ----------
const uiFiles = appFiles.filter(f => f.startsWith('components/builder/voice-call/') || f === 'hooks/use-studio-voice-call.ts')
eq(uiFiles.filter(f => /costUsd|CostMeter|meter\.|X-Deckster-Cost/i.test(read(f))), [], 'D: no call UI file reads or shows a cost')

// ---------- E. mutants ----------
const MUTANTS = [
  ["return env[VOICE_SPEECH_FLAG] === 'true'", 'return true'],
  ["if (!userId) return { error: json(401, 'Unauthorized') }", ''],
  ["if (!address) return { error: json(503, 'Speech is not connected') }", "if (!address) return { error: json(502, 'x') }"],
  ['export const VOICE_STT_MAX_BYTES = 1_000_000', 'export const VOICE_STT_MAX_BYTES = 100_000_000'],
  ['if (status === 402 || status === 429) return 429', ''],
  ["if (isAbort(error) || controller.signal.aborted) return { error: json(504, 'The speech service took too long') }", ''],
  ["  logSignal(deps, VOICE_TASKS.stt, routed.response.headers, body)\n", "  headers[VOICE_COST_HEADER] = String((body as any)?.usage?.cost)\n  logSignal(deps, VOICE_TASKS.stt, routed.response.headers, body)\n"],
  ["  logSignal(deps, VOICE_TASKS.tts, routed.response.headers)\n", "  for (const n of ROUTER_SIGNAL_HEADERS) { const v = routed.response.headers.get(n); if (v) headers[n] = v }\n"],
  ["'X-MR-Signal': 'headers' }", "}"],
  ["export const VOICE_STT_MODEL = 'google/gemini-3.5-flash-lite'", "export const VOICE_STT_MODEL = 'google/gemini-2.5-flash'"],
  ['if (v && /^[\\x20-\\x7e]{1,128}$/.test(v))', 'if (v)'],
  ["if (generation) headers['x-generation-id'] = generation", ''],
  ["'/v1/chat/completions'", "'/v1/audio/transcriptions'"],
  ["format: 'wav' }", "format: 'mp3' }"],
  ['info.sampleRate === 16_000 && ', ''],
  ['if (text.length > VOICE_TTS_MAX_CHARS) return json(413', 'if (false) return json(413'],
  ['!Object.prototype.hasOwnProperty.call(VOICE_TTS_VOICES, voice)', '!(voice in VOICE_TTS_VOICES)'],
  ["if (!contentType.toLowerCase().startsWith('audio/'))", 'if (false)'],
  ["'X-MR-Task': task", "'X-MR-Task': 'studio'"],
  [".replace(/\\/v1$/, '')", ''],
]
let caught = 0
const plain = checks
for (const [from, to] of MUTANTS) {
  if (!SRC.includes(from)) throw new Error(`mutant anchor missing: ${from}`)
  const mutated = await load(SRC.replace(from, to))
  let died = false
  try { await suite(mutated) } catch { died = true }
  if (!died) throw new Error(`mutant survived: ${from}`)
  caught++
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`studio voice speech routes: ${plain} checks (A+B ${afterSuite}, C+D ${plain - afterSuite}), ${caught}/${MUTANTS.length} mutants caught: PASS`)
