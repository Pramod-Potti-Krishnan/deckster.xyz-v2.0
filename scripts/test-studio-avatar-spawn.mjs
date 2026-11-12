// FRONTEND-2 (B66): proof of the Studio "Create my avatar" create / pick / delete MOCK: the page /studio/companions (app/(app)/studio/companions/page.tsx), its lib (lib/studio-avatar-spawn.ts: flag, types, SpawnClient, MockSpawnClient,
// pack ids, registry, resolvePackUrl and the fallback chain) and its components (components/studio-avatar-spawn/). Flag NEXT_PUBLIC_STUDIO_AVATAR_SPAWN (exact "true", only with NEXT_PUBLIC_STUDIO_V4_SHELL "true", build-time, default off).
//
//   node scripts/test-studio-avatar-spawn.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup, the repo's own mini-react host to drive the REAL container; no network, no browser, no .next, no Next runtime)
//
// What it proves:
//  A. the flag is the exact string "true" and only with the Studio shell (every other spelling of either is off), read as two literals; with it off the route calls notFound() (also with only the shell off, or only the flag on) and every new
//     component returns null; the lib and the components make no call to the network, to a file reader, to sessionStorage or IndexedDB, and have no console call at all (so no name, URL or file data can reach a log); only the lib reads localStorage;
//  B. consent: Continue is impossible until all four items are ticked (every one of the 16 tick sets, in the markup and in the REAL container); the text is marked PLACEHOLDER: needs legal review (BIPA, GDPR); no job can be made without
//     a complete consent record (version, time, four items) and it is kept on the job only;
//  C. the stages move on timers the test drives (and on manual stepping): consent, upload, intake, masters, pick (four candidates drawn from portraits that ARE committed), building, ready (a pack that IS committed); refusals;
//  D. the photo never reaches storage: its bytes are never read, and no value in a (wrapped) localStorage holds a data URL, image bytes, the file name or the display name outside the entry's own displayName field; sessionStorage is never
//     touched; the registry holds only { id, displayName, packBaseUrl, owner, createdAt } under a key with the user id; the photo is let go of FIRST when a look is picked, on a refusal, on cancel and on unmount (the REAL container);
//  E. the pack id matches ^u-[a-z0-9]{26}$ and is never derived from the name (the same random source gives the same ids whatever the names);
//  F. delete removes the entry (storage and listPacks), only that user's, only that pack; a confirm first, saying the pack and previews are deleted; storage that throws or is absent still works in memory;
//  G. a refusal code renders its own plain message, offers no continue and no appeal, for every code;
//  H. resolvePackUrl joins paths safely (".." can never leave the base; a scheme, a query, a backslash or a percent never gets through), and the fallback chain is the pack, then the portrait, then Felix;
//  I. every step and state renders (SSR), the styling adds no colour, no gradient and no purple;
//  J. the strip: put back = the base, byte for byte; idempotent; a file it does not own comes back unchanged; the registry holds exactly this change's three lines at the true end of each list; .env.example gains one block at its true end;
//  K. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin), each with the co-author line; NEW FILES ONLY: no existing app file changes
//     (their hashes are dev's, which is what flag off means); the whole-diff filter leaves a later REGISTERED file to its change;
//  L. ROBUST AFTER MERGE and a LINEAR STACK (a later change directly on this head adds registered-shape registry lines below ours and a subject-filter line beside ours in a taught proof): the scope still passes; an unregistered file still fails;
//  M. mutants are caught (each is one edit of the real sources, fed to the same checks).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Root, hostNodes, textOf as nodeText } from './studio-chat-harness/mini-react.mjs'
import {
  AVATAR_SPAWN_DRAFT, AVATAR_SPAWN_EDITS, AVATAR_SPAWN_ENV_BLOCK, AVATAR_SPAWN_FLAG, AVATAR_SPAWN_MARKER_RE, AVATAR_SPAWN_NEW_FILES, AVATAR_SPAWN_OWN_EDITS, AVATAR_SPAWN_PIN_AFTER, AVATAR_SPAWN_PIN_EDITS,
  AVATAR_SPAWN_PIN_FILES, AVATAR_SPAWN_PIN_MARK, AVATAR_SPAWN_SCOPE_FILES, AVATAR_SPAWN_SUBJECT, BASE_COMMIT, stripAvatarSpawn,
} from './studio-avatar-spawn-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripAvatarSpawn); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const count = (text, needle) => text.split(needle).length - 1
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
const tick = () => new Promise(resolve => setImmediate(resolve))

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}  [${String(error.message).replace(/\s+/g, ' ').slice(0, 100)}]`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources in a vm -------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-avatar-spawn.ts', STEPS = 'components/studio-avatar-spawn/steps.tsx', APP = 'components/studio-avatar-spawn/studio-avatar-spawn-app.tsx', CSS = 'components/studio-avatar-spawn/studio-avatar-spawn.css'
const PAGE = 'app/(app)/studio/companions/page.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP = 'scripts/studio-avatar-spawn-strip.mjs'
const FLAG = AVATAR_SPAWN_FLAG, SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const ENV_ON = { [SHELL]: 'true', [FLAG]: 'true' }
const MODULES = { '@/lib/studio-avatar-spawn': LIB, './steps': STEPS, '@/components/studio-avatar-spawn/studio-avatar-spawn-app': APP }
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
/** Load one real source in a new context. `texts` replaces a file's text (a mutant), `overrides` any import, `globals` what the browser would give it (URL, setInterval, localStorage ...). Everything else is the REAL source, loaded with the same environment. */
function load(rel, { env = {}, texts = {}, overrides = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (spec in overrides) return overrides[spec]
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec in MODULES) return load(MODULES[spec], { env, texts, overrides, globals })
    if (spec === 'next/navigation') return { notFound() { throw new Error('NEXT_NOT_FOUND') } }
    if (spec === '@/hooks/use-auth') return { useAuth: () => ({ user: { id: 'user-1' } }) }
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  const sandbox = { module, exports: module.exports, require: req, process: { env: { ...env } } }
  Object.defineProperties(sandbox, Object.getOwnPropertyDescriptors(globals)) // descriptors, so a getter (a tripwire) is not called until the source reads it
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), sandbox, { filename: rel })
  return module.exports
}
const libOf = (texts = {}, env = ENV_ON, globals = {}) => load(LIB, { env, texts, globals })
const stepsOf = (texts = {}, env = ENV_ON) => load(STEPS, { env, texts })
const html = (Component, props) => renderToStaticMarkup(h(Component, props))
const textOf = markup => markup.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim()
const buttonTag = (markup, label) => { const m = new RegExp(`<button\\b[^>]*>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</button>`).exec(markup.replace(/&#x27;/g, "'")); return m ? m[0] : null }
const isDisabled = tag => / disabled(=|\s|>)/.test(tag)
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
const SECRET_SHAPE = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/
const SPELLINGS = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']

// ---- fakes: a seeded random, a manual clock, a storage that records, a photo whose bytes must never be read --------------------------------------------
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
class FakeStorage {
  constructor() { this.map = new Map(); this.log = [] }
  getItem(key) { this.log.push(['get', key]); return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.log.push(['set', key, String(value)]); this.map.set(key, String(value)) }
  writes() { return this.log.filter(entry => entry[0] === 'set') }
}
const throwingStorage = () => ({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
function manualTimers() {
  const queue = []; let n = 0
  return { setTimeout(fn, ms) { const handle = ++n; queue.push({ handle, fn, ms }); return handle }, clearTimeout(handle) { const at = queue.findIndex(t => t.handle === handle); if (at >= 0) queue.splice(at, 1) }, pending: () => queue.length, delays: () => queue.map(t => t.ms), fire() { const t = queue.shift(); assert.ok(t, 'a timer is pending'); t.fn() } }
}
/** A photo whose bytes must never be read: every reader throws and is counted; its enumerable fields (a data URL, a name) would show in anything that serialised it. */
function fakePhoto({ size = 200_000, type = 'image/jpeg' } = {}) {
  const reads = [], file = { size, type, name: 'private-photo-name.jpg', preview: 'data:image/jpeg;base64,PHOTO-BYTES-SENTINEL' }
  for (const method of ['arrayBuffer', 'text', 'stream', 'slice', 'bytes']) file[method] = () => { reads.push(method); throw new Error('bytes read') }
  return { file, reads }
}
const CONSENT_IDS = ['photo_use', 'cartoon_result', 'adult', 'own_face']
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)
async function toPick(lib, client, { photo = fakePhoto(), consent } = {}) {
  let job = await client.createJob(consent ?? lib.buildConsentRecord(CONSENT_IDS, NOW))
  job = await client.submitPhoto(job.id, photo.file)
  client.advance(job.id); job = client.advance(job.id)
  return job
}
/** A whole create: consent, photo, masters, pick, build, name. Returns what the proofs look at. */
async function runFlow(texts = {}, { names = ['Quokka Rocket'], seed = 7, userId = 'user-a', storage = new FakeStorage(), clientOptions = {} } = {}) {
  const lib = libOf(texts), timers = manualTimers(), photos = [], jobs = [], entries = []
  const client = new lib.MockSpawnClient({ userId, storage, random: seeded(seed), now: () => NOW, timers, ...clientOptions })
  for (const name of names) {
    const photo = fakePhoto(); photos.push(photo)
    let job = await toPick(lib, client, { photo })
    job = await client.pickMaster(job.id, 'c2'); job = client.advance(job.id); jobs.push(job)
    entries.push(await client.saveDisplayName(job.id, name))
  }
  return { lib, client, storage, timers, photos, jobs, entries }
}

// ===== A. the flag, the route, the components, no leaks =============================================================================================
console.log('A. flag, route, components, leaks')
function proveFlag(texts = {}) {
  for (const value of SPELLINGS) {
    const flagEnv = value === undefined ? {} : { [FLAG]: value }, on = value === 'true'
    assert.equal(libOf(texts, { [SHELL]: 'true', ...flagEnv }).STUDIO_AVATAR_SPAWN_ENABLED, on, `flag ${JSON.stringify(value)} with the shell on`)
    assert.equal(libOf(texts, {}).studioAvatarSpawnOn({ [SHELL]: 'true', ...flagEnv }), on, `studioAvatarSpawnOn ${JSON.stringify(value)}`)
    assert.equal(libOf(texts, { ...flagEnv }).STUDIO_AVATAR_SPAWN_ENABLED, false, `flag ${JSON.stringify(value)} without the shell is off`)
    assert.equal(libOf(texts, { [SHELL]: value ?? '', [FLAG]: 'true' }).STUDIO_AVATAR_SPAWN_ENABLED, on, `the shell spelled ${JSON.stringify(value)} with the flag on`)
  }
  assert.equal(libOf(texts, {}).STUDIO_AVATAR_SPAWN_ENABLED, false, 'default: off')
  const code = stripComments(texts[LIB] ?? read(LIB))
  assert.equal(count(code, 'process.env'), 2, 'two environment reads, the shell and the flag, as literals Next inlines')
  assert.ok(code.includes('process.env.NEXT_PUBLIC_STUDIO_AVATAR_SPAWN === \'true\'') && code.includes('process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === \'true\''), 'the literal reads')
}
const NETWORK = /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|FormData|FileReader|readAsDataURL|toDataURL|indexedDB|sessionStorage|\.arrayBuffer\(|navigator\./
function proveNoLeaks(texts = {}) {
  const src = rel => stripComments(texts[rel] ?? read(rel))
  for (const rel of [LIB, STEPS, APP, PAGE]) {
    assert.doesNotMatch(src(rel), /\bconsole\b/, `${rel}: no console call at all (so no name, URL or file data is logged)`)
    assert.doesNotMatch(src(rel), NETWORK, `${rel}: no network, no file reader, no sessionStorage, no IndexedDB`)
    assert.doesNotMatch(texts[rel] ?? read(rel), SECRET_SHAPE, `${rel}: no secret-shaped literal`)
  }
  for (const rel of [STEPS, APP, PAGE]) assert.doesNotMatch(src(rel), /localStorage/, `${rel}: the components never touch storage (the lib's registry does, in try/catch)`)
  assert.equal((src(LIB).match(/\.localStorage\b/g) ?? []).length, 1, 'the lib reads localStorage in one place (browserStorage), inside try/catch')
  assert.doesNotMatch(src(LIB), /^\s*import\s|require\(/m, 'the lib is import-free')
}
await check('the flag is on only for the exact "true" and only with the Studio shell (spelling matrix of both, default off), read as two literals; no network, file reader, sessionStorage or IndexedDB anywhere; no console call in any new source; only the lib reads localStorage', () => { proveFlag(); proveNoLeaks() })

function proveRoute(texts = {}) {
  const page = env => load(PAGE, { env, texts }).default
  const renders = env => renderToStaticMarkup(h(page(env)))
  for (const env of [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [FLAG]: 'TRUE' }, { [SHELL]: 'true', [FLAG]: 'false' }, { [SHELL]: '1', [FLAG]: 'true' }]) assert.throws(() => renders(env), /NEXT_NOT_FOUND/, `${JSON.stringify(env)}: the route calls notFound()`)
  const on = renders(ENV_ON)
  assert.match(on, /<h1[^>]*>My companions<\/h1>/, 'flag on: the page draws "My companions"'); assert.match(on, /data-studio-avatar-spawn="true"/)
  assert.match(textOf(on), /You have no companions of your own yet\./)
  assert.equal((texts[PAGE] ?? read(PAGE)).split('\n')[0], '"use client"', 'a client component, as the sibling account pages')
  const app = env => renderToStaticMarkup(h(load(APP, { env, texts }).StudioAvatarSpawnApp, { userId: 'user-1' }))
  for (const env of [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [FLAG]: 'false' }]) assert.equal(app(env), '', `${JSON.stringify(env)}: <StudioAvatarSpawnApp /> returns null (the empty string)`)
  assert.match(app(ENV_ON), /^<main/, 'flag on: it draws')
  assert.match(renderToStaticMarkup(h(load(APP, { env: ENV_ON, texts }).StudioAvatarSpawnApp, { userId: null })), /Loading…/, 'no user yet: a quiet loading line')
}
await check('flag off the route calls notFound() (also with only the shell off, only the flag on, "1", "TRUE", "false") and <StudioAvatarSpawnApp /> returns null; flag on the page and the component draw', () => proveRoute())

// ===== B. consent ===================================================================================================================================
console.log('B. consent')
const subsets = items => items.reduce((all, item) => all.concat(all.map(set => [...set, item])), [[]])
function proveConsent(texts = {}) {
  const lib = libOf(texts), steps = stepsOf(texts)
  assert.equal(lib.CONSENT_ITEMS.length, 4); assert.deepEqual(plain(lib.CONSENT_ITEMS.map(i => i.id)), CONSENT_IDS)
  assert.equal(lib.CONSENT_PLACEHOLDER_NOTE, 'PLACEHOLDER: needs legal review (BIPA, GDPR)')
  for (const set of subsets(CONSENT_IDS)) {
    const all = set.length === 4, label = `ticked ${JSON.stringify(set)}`
    assert.equal(lib.allConsentTicked(set), all, label)
    assert.equal(lib.buildConsentRecord(set, NOW) === null, !all, `${label}: a consent record exists only when every item is ticked`)
    const markup = html(steps.ConsentStep, { ticked: set, onToggle() {}, onContinue() {}, onCancel() {} })
    const continueTag = buttonTag(markup, 'Continue'); assert.ok(continueTag, `${label}: a Continue button`)
    assert.equal(isDisabled(continueTag), !all, `${label}: Continue is ${all ? 'enabled' : 'disabled'}`)
    assert.equal(count(markup, 'type="checkbox"'), 4, `${label}: four checkboxes`); assert.equal(count(markup, 'checked=""'), set.length, `${label}: the ticked ones are checked`)
  }
  assert.equal(lib.allConsentTicked([...CONSENT_IDS, 'extra']), true); assert.equal(lib.allConsentTicked(['a', 'b', 'c', 'd']), false, 'four unknown ids are not consent')
  const record = lib.buildConsentRecord(CONSENT_IDS, NOW)
  assert.deepEqual(plain(record), { version: lib.CONSENT_VERSION, acceptedAt: '2026-11-08T12:00:00.000Z', items: CONSENT_IDS }, 'the version, the time and the four items')
  assert.equal(lib.buildConsentRecord(CONSENT_IDS, Number.NaN), null, 'no time, no record')
  const markup = html(steps.ConsentStep, { ticked: [], onToggle() {}, onContinue() {}, onCancel() {} }), words = textOf(markup)
  assert.ok(words.includes('PLACEHOLDER: needs legal review (BIPA, GDPR)'), 'the consent text says it is a placeholder needing legal review')
  assert.match(words, /my photo[^.]*deleted when I pick my look[^.]*never used for training/); assert.match(words, /cartoon of me/); assert.match(words, /18 or older/); assert.match(words, /my own face, or I have the permission of the adult/)
}
async function proveConsentClient(texts = {}) {
  const lib = libOf(texts), client = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(1), timers: manualTimers() })
  for (const set of subsets(CONSENT_IDS).filter(s => s.length < 4)) {
    await assert.rejects(client.createJob({ version: 'x', acceptedAt: '2026-11-08T12:00:00.000Z', items: set }), /consent_incomplete/, `consent with ${JSON.stringify(set)} is refused by the client too`)
  }
  for (const bad of [null, undefined, {}, { version: '', acceptedAt: '2026-11-08T12:00:00.000Z', items: CONSENT_IDS }, { version: 'x', acceptedAt: 'not a time', items: CONSENT_IDS }, { version: 'x', acceptedAt: '2026-11-08T12:00:00.000Z', items: 'adult' }]) await assert.rejects(client.createJob(bad), /consent_incomplete/, JSON.stringify(bad))
  await assert.rejects(client.submitPhoto('sj-nope', fakePhoto().file), /unknown_job/, 'there is no way to a photo without a job')
  const job = await client.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW))
  assert.equal(job.stage, 'upload'); assert.match(job.id, /^sj-[a-z0-9]{12}$/)
  assert.equal(Object.keys(plain(job)).includes('consent'), false, 'the consent is kept on the job, not handed back')
}
await check('consent: Continue is disabled for every tick set but all four (markup, 16 sets); a record (version, time, four items) exists only then; the text is PLACEHOLDER: needs legal review (BIPA, GDPR); the client refuses every incomplete consent and has no way to a photo without a job', async () => { proveConsent(); await proveConsentClient() })

// ===== C. the stages ================================================================================================================================
console.log('C. the stages')
async function proveStages(texts = {}) {
  const lib = libOf(texts), timers = manualTimers()
  assert.deepEqual(plain(lib.SPAWN_STAGES), ['consent', 'upload', 'intake', 'masters', 'pick', 'building', 'ready'])
  const client = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(3), now: () => NOW, timers, stageMs: 777 })
  let job = await client.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW))
  assert.equal(timers.pending(), 0, 'nothing is scheduled before a photo'); assert.deepEqual(plain({ stage: job.stage, p: job.progress, c: job.candidates }), { stage: 'upload', p: 10, c: [] })
  job = await client.submitPhoto(job.id, fakePhoto().file)
  assert.equal(job.stage, 'intake'); assert.deepEqual(timers.delays(), [777], 'the stage timer uses stageMs')
  timers.fire(); job = await client.getJob(job.id); assert.equal(job.stage, 'masters'); assert.equal(timers.pending(), 1)
  timers.fire(); job = await client.getJob(job.id); assert.equal(job.stage, 'pick'); assert.equal(timers.pending(), 0, 'the pick waits for the person, no timer'); assert.equal(job.progress, 55)
  assert.equal(job.candidates.length, 4, 'four candidates'); assert.equal(new Set(job.candidates.map(c => c.id)).size, 4)
  for (const c of job.candidates) { assert.match(c.previewUrl, /^\/companions\/(bob|felix|maya)\/portrait-(256|512)\.webp$/, 'a portrait from the cast'); assert.ok(fs.existsSync(path.join(root, 'public', c.previewUrl)), `${c.previewUrl} is committed under public/`) }
  await assert.rejects(client.pickMaster(job.id, 'c9'), /unknown_candidate/); await assert.rejects(client.saveDisplayName(job.id, 'Early'), /wrong_stage/, 'no name before ready')
  job = await client.pickMaster(job.id, 'c1'); assert.equal(job.stage, 'building'); assert.deepEqual(plain(job.candidates), [], 'the candidates are let go once one is picked'); assert.equal(timers.pending(), 1)
  await assert.rejects(client.pickMaster(job.id, 'c1'), /wrong_stage/, 'a second pick')
  timers.fire(); job = await client.getJob(job.id)
  assert.equal(job.stage, 'ready'); assert.match(job.packId, /^u-[a-z0-9]{26}$/); assert.equal(job.packBaseUrl, '/companions/felix', 'the stand-in pack is Felix by default'); assert.equal(job.progress, 100)
  assert.ok(fs.existsSync(path.join(root, 'public', job.packBaseUrl, 'motion/manifest.json')) && fs.existsSync(path.join(root, 'public', job.packBaseUrl, 'portrait-512.webp')), 'Felix is committed')
  for (const bad of ['', '   ', 'x'.repeat(41), '\u0000\u0007']) await assert.rejects(client.saveDisplayName(job.id, bad), /invalid_name/, JSON.stringify(bad))
  assert.equal(await client.getJob('sj-nope'), null)
  // manual stepping gives the same stages as the timers, and cancels the timer it replaces
  const other = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(4), timers: manualTimers() }), seen = []
  let j = await other.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW)); j = await other.submitPhoto(j.id, fakePhoto().file)
  for (let i = 0; i < 2; i++) { j = other.advance(j.id); seen.push(j.stage) }
  assert.deepEqual(seen, ['masters', 'pick']); assert.equal(other.advance(j.id).stage, 'pick', 'advance does not move a pick'); assert.equal(other.advance('sj-nope'), null)
  // a different stand-in pack, a standing pack that is unsafe falls back to Felix
  const custom = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(5), timers: manualTimers(), standInPackBaseUrl: '/companions/maya' }), cj = await toPick(lib, custom); assert.equal((custom.advance((await custom.pickMaster(cj.id, 'c1')).id)).packBaseUrl, '/companions/maya')
  const unsafe = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(5), timers: manualTimers(), standInPackBaseUrl: 'javascript:alert(1)' }), uj = await toPick(lib, unsafe); assert.equal((unsafe.advance((await unsafe.pickMaster(uj.id, 'c1')).id)).packBaseUrl, '/companions/felix')
  assert.throws(() => new lib.MockSpawnClient({ userId: '' }), /user_required/)
  for (const [stage, view] of [['upload', 'upload'], ['intake', 'progress'], ['masters', 'progress'], ['building', 'progress'], ['pick', 'pick'], ['ready', 'ready'], ['refused', 'refused']]) assert.equal(lib.viewOfJob({ stage }), view, `${stage} is the ${view} screen`)
}
await check('the stages move on timers the test drives (and on manual stepping): upload, intake, masters, pick (four candidates from committed portraits), building, ready (a committed pack, Felix by default); nothing scheduled before a photo; wrong-stage calls refused', () => proveStages())

// ===== D. the photo never reaches storage ===========================================================================================================
console.log('D. the photo, the registry, storage')
const ENTRY_KEYS = ['createdAt', 'displayName', 'id', 'owner', 'packBaseUrl']
async function provePrivacy(texts = {}) {
  const NAME = 'Quokka Rocket'
  const { lib, storage, photos, entries } = await runFlow(texts, { names: [NAME] })
  for (const p of photos) assert.deepEqual(p.reads, [], 'the photo\'s bytes were never read (no arrayBuffer, text, stream, slice, bytes)')
  assert.equal(storage.writes().length, 1, 'one write in the whole flow: the entry, when it is named (nothing at consent, upload, intake, masters, pick or build)')
  assert.deepEqual([...storage.map.keys()], ['deckster.studio.avatarSpawn.entries.user-a'], 'one key, with the user id in it')
  for (const [key, value] of storage.map) {
    assert.doesNotMatch(value, /data:|base64|PHOTO-BYTES-SENTINEL|private-photo-name|image\/jpeg|blob:/, `${key}: no data URL, no image bytes, no file name, no preview address`)
    assert.ok(!key.toLowerCase().includes('quokka') && !key.toLowerCase().includes(NAME.toLowerCase()), 'the key does not hold the name')
    const stored = JSON.parse(value); assert.equal(stored.length, 1)
    assert.deepEqual(Object.keys(stored[0]).sort(), ENTRY_KEYS, 'only { id, displayName, packBaseUrl, owner, createdAt }'); assert.deepEqual(Object.keys(stored[0].owner).sort(), ['app', 'tenantId', 'userId'])
    assert.equal(stored[0].displayName, NAME); const without = JSON.stringify({ ...stored[0], displayName: undefined }); assert.ok(!without.toLowerCase().includes('quokka'), 'the name is in the entry\'s displayName field and nowhere else in the value')
    assert.deepEqual(plain(stored[0].owner), { app: 'deckster', tenantId: 'mock-tenant', userId: 'user-a' }); assert.equal(stored[0].createdAt, '2026-11-08T12:00:00.000Z')
  }
  assert.deepEqual(plain(entries[0]).owner, { app: 'deckster', tenantId: 'mock-tenant', userId: 'user-a' })
  // the default storage is localStorage, and sessionStorage is never touched (a tripwire on the browser's globals)
  const touched = [], local = new FakeStorage(), globals = { localStorage: local }
  Object.defineProperty(globals, 'sessionStorage', { get() { touched.push('sessionStorage'); throw new Error('sessionStorage touched') } })
  const lib2 = libOf(texts, ENV_ON, globals), client2 = new lib2.MockSpawnClient({ userId: 'user-b', random: seeded(9), now: () => NOW, timers: manualTimers() })
  const photo = fakePhoto(); let job = await toPick(lib2, client2, { photo }); job = client2.advance((await client2.pickMaster(job.id, 'c3')).id); await client2.saveDisplayName(job.id, 'Default Storage')
  assert.deepEqual(touched, [], 'sessionStorage is never touched'); assert.deepEqual([...local.map.keys()], ['deckster.studio.avatarSpawn.entries.user-b'], 'the default storage is localStorage'); assert.deepEqual(photo.reads, [])
  assert.doesNotMatch([...local.map.values()].join(''), /data:|PHOTO-BYTES-SENTINEL|private-photo-name/)
  // a stored value that carries more than the six fields is read as the six (an extra field is never carried or written back)
  const poisoned = new FakeStorage(), good = JSON.parse(storage.map.get('deckster.studio.avatarSpawn.entries.user-a'))[0]
  poisoned.setItem('deckster.studio.avatarSpawn.entries.user-a', JSON.stringify([{ ...good, photo: 'data:image/png;base64,AAAA', note: 'extra' }]))
  const lib3 = libOf(texts), c3 = new lib3.MockSpawnClient({ userId: 'user-a', storage: poisoned, random: seeded(11), now: () => NOW, timers: manualTimers() })
  assert.deepEqual(Object.keys((await c3.listPacks())[0]).sort(), ENTRY_KEYS, 'extra fields are dropped on read')
  const j3 = await toPick(lib3, c3); await c3.saveDisplayName(c3.advance((await c3.pickMaster(j3.id, 'c1')).id).id, 'Second One')
  assert.doesNotMatch(poisoned.map.get('deckster.studio.avatarSpawn.entries.user-a'), /data:|extra/, 'and they are not written back')
}
function provePhotoHold(texts = {}) {
  const lib = libOf(texts), log = [], urls = { createObjectURL(blob) { log.push(['create']); return `blob:fake/${log.length}` }, revokeObjectURL(url) { log.push(['revoke', url]) } }
  const hold = new lib.PhotoHold(urls), a = { size: 1, type: 'image/png' }, b = { size: 2, type: 'image/png' }
  assert.equal(hold.has(), false); assert.equal(hold.hold(a), 'blob:fake/1'); assert.equal(hold.preview(), 'blob:fake/1'); assert.equal(hold.current(), a); assert.equal(hold.has(), true)
  assert.equal(hold.hold(b), 'blob:fake/3', 'a second photo lets go of the first (revoked) before it is held'); assert.deepEqual(log.slice(1, 2), [['revoke', 'blob:fake/1']])
  hold.discard(); assert.deepEqual([hold.has(), hold.preview(), hold.current()], [false, null, null], 'discard lets go of the file and the preview'); assert.deepEqual(log[log.length - 1], ['revoke', 'blob:fake/3'])
  const before = log.length; hold.discard(); assert.equal(log.length, before, 'discarding twice revokes once')
  assert.equal(new lib.PhotoHold(null).hold(a), null, 'no URL api: no preview'); assert.equal(new lib.PhotoHold({ createObjectURL() { throw new Error('x') }, revokeObjectURL() {} }).hold(a), null, 'a throwing URL api is no preview')
  assert.doesNotThrow(() => new lib.PhotoHold({ createObjectURL: () => 'blob:x', revokeObjectURL() { throw new Error('x') } }).discard())
}
async function provePickDiscards(texts = {}) {
  const lib = libOf(texts), events = [], urls = { createObjectURL: () => 'blob:fake/1', revokeObjectURL: url => events.push(`revoke ${url}`) }, hold = new lib.PhotoHold(urls)
  hold.hold({ size: 1, type: 'image/png' })
  const pending = lib.pickAndDiscard({ pickMaster: async () => { events.push(`pickMaster, photo held: ${hold.has()}`); return { stage: 'building' } } }, hold, 'sj-1', 'c1')
  assert.deepEqual(events.slice(0, 1), ['revoke blob:fake/1'], 'the photo is let go of before the pick is even made'); await pending
  assert.deepEqual(events, ['revoke blob:fake/1', 'pickMaster, photo held: false'])
}
await check('the photo never reaches storage: its bytes are never read; one write in the whole flow; no data URL, image bytes, file name or preview address in any key or value; the name only in the entry\'s displayName; only the six fields; sessionStorage untouched; extra stored fields dropped and never written back', () => provePrivacy())
await check('the photo is held in memory only and let go of: discard() revokes the preview once; a second photo releases the first; picking a look discards it FIRST', async () => { provePhotoHold(); await provePickDiscards() })

// ===== E. ids =======================================================================================================================================
console.log('E. ids')
async function proveIds(texts = {}) {
  const names = ['quokka rocket', 'Dottie', 'zebra stripes', 'Quokka Rocket'], a = await runFlow(texts, { names, seed: 21 }), b = await runFlow(texts, { names: ['Aaaa', 'Bbbb', 'Cccc', 'Dddd'], seed: 21 })
  const ids = a.entries.map(e => e.id)
  for (const [i, id] of ids.entries()) {
    assert.match(id, /^u-[a-z0-9]{26}$/, `id ${i}`); const slug = names[i].toLowerCase().replace(/[^a-z0-9]/g, '')
    assert.ok(!id.includes(slug) && !id.includes(slug.slice(0, 5)), `the id ${id} does not contain the name ${names[i]}`)
  }
  assert.equal(new Set(ids).size, 4, 'the same name twice (Quokka Rocket) is two different ids')
  assert.deepEqual(ids, b.entries.map(e => e.id), 'the same random source gives the same ids whatever the names: the id is not a function of the name')
  assert.equal(a.lib.newPackId.length <= 1, true, 'newPackId takes no name'); assert.match(a.lib.newPackId(seeded(2)), /^u-[a-z0-9]{26}$/)
  // the real random source (crypto): unique, in the alphabet
  const lib = libOf(texts, ENV_ON, { crypto: crypto.webcrypto }), many = new Set(Array.from({ length: 300 }, () => lib.newPackId()))
  assert.equal(many.size, 300); for (const id of many) assert.match(id, /^u-[a-z0-9]{26}$/)
  assert.match(libOf(texts).newPackId(), /^u-[a-z0-9]{26}$/, 'without crypto the fallback still gives a well-formed id')
  assert.match(lib.PACK_ID_PATTERN.source, /u-\[a-z0-9\]\{26\}/)
  for (const bad of ['u-' + 'a'.repeat(25), 'u-' + 'a'.repeat(27), 'U-' + 'a'.repeat(26), 'u-' + 'A'.repeat(26), 'x-' + 'a'.repeat(26), 'u-' + 'a'.repeat(25) + '-']) assert.equal(lib.PACK_ID_PATTERN.test(bad), false, bad)
  for (const entry of a.entries) assert.ok(lib.parseStoredEntry(plain(entry), 'user-a'), 'a made entry is a stored entry')
  assert.equal(lib.parseStoredEntry({ ...plain(a.entries[0]), id: 'quokka-rocket' }, 'user-a'), null, 'an id derived from a name does not parse')
}
await check('the pack id matches ^u-[a-z0-9]{26}$, is never derived from the name (same random source, same ids for different names; the same name twice, two ids), and a crypto source gives unique ids', () => proveIds())

// ===== F. delete ====================================================================================================================================
console.log('F. delete, per-user, storage that fails')
const listOf = async (client, field = 'id') => plain((await client.listPacks()).map(e => e[field]))
async function proveDelete(texts = {}) {
  const f = await runFlow(texts, { names: ['Quokka Rocket', 'Dottie Two'], seed: 5 }), [one, two] = f.entries, key = 'deckster.studio.avatarSpawn.entries.user-a'
  assert.deepEqual(await listOf(f.client, 'id'), [one.id, two.id])
  assert.deepEqual(plain(await f.client.deletePack(one.id)), { id: one.id, erased: true }, 'an erase receipt')
  assert.deepEqual(await listOf(f.client, 'id'), [two.id], 'listPacks no longer shows it')
  const stored = f.storage.map.get(key); assert.ok(!stored.includes(one.id) && !stored.includes('Quokka'), 'and it is gone from storage: no id, no name'); assert.ok(stored.includes(two.id), 'the other companion stays')
  assert.deepEqual(plain(await f.client.deletePack(one.id)), { id: one.id, erased: false }, 'deleting it again erases nothing'); assert.deepEqual(plain(await f.client.deletePack('u-' + 'z'.repeat(26))), { id: 'u-' + 'z'.repeat(26), erased: false })
  assert.deepEqual(await listOf(f.client, 'id'), [two.id])
  const writes = f.storage.writes().length; await f.client.deletePack('nothing'); assert.equal(f.storage.writes().length, writes, 'an erase of nothing writes nothing')
  await f.client.deletePack(two.id); assert.deepEqual(await listOf(f.client), [], 'all gone'); assert.equal(JSON.parse(f.storage.map.get(key)).length, 0)
  // per user: B shares the storage, sees none of A's, and A's delete does not touch B's
  const shared = new FakeStorage(), a = await runFlow(texts, { names: ['Alpha Name'], storage: shared, userId: 'user-a', seed: 1 }), b = await runFlow(texts, { names: ['Bravo Name'], storage: shared, userId: 'user-b', seed: 2 })
  assert.deepEqual(await listOf(a.client, 'displayName'), ['Alpha Name']); assert.deepEqual(await listOf(b.client, 'displayName'), ['Bravo Name'])
  assert.deepEqual([...shared.map.keys()].sort(), ['deckster.studio.avatarSpawn.entries.user-a', 'deckster.studio.avatarSpawn.entries.user-b'], 'one key per user')
  await a.client.deletePack(b.entries[0].id); assert.deepEqual(await listOf(b.client, 'displayName'), ['Bravo Name'], 'a delete of another user\'s pack id changes nothing')
  shared.setItem('deckster.studio.avatarSpawn.entries.user-a', JSON.stringify([{ ...plain(b.entries[0]) }])); assert.deepEqual(await listOf(a.client), [], 'an entry whose owner is another user is not this user\'s')
  // storage that throws, is absent, or holds junk: the client works in memory, never throws
  for (const storage of [throwingStorage(), null]) {
    const lib = libOf(texts), client = new lib.MockSpawnClient({ userId: 'user-a', storage, random: seeded(8), now: () => NOW, timers: manualTimers() })
    await assert.doesNotReject(() => client.listPacks(), 'a storage that throws reads as no companions, never as an error'); assert.deepEqual(await listOf(client), [])
    let job = await toPick(lib, client); job = client.advance((await client.pickMaster(job.id, 'c1')).id); const entry = await client.saveDisplayName(job.id, 'In Memory')
    assert.deepEqual(await listOf(client, 'id'), [entry.id], 'kept in memory when it cannot be stored'); await client.deletePack(entry.id); assert.deepEqual(await listOf(client), [])
  }
  for (const junk of ['not json', '{"a":1}', 'null', '[1,2,"x"]', '[{"id":"u-aaaaaaaaaaaaaaaaaaaaaaaaaa"}]']) {
    const storage = new FakeStorage(); storage.setItem('deckster.studio.avatarSpawn.entries.user-a', junk)
    const lib = libOf(texts), client = new lib.MockSpawnClient({ userId: 'user-a', storage, random: seeded(8), timers: manualTimers() }); assert.deepEqual(await listOf(client), [], `junk ${junk.slice(0, 20)} reads as no companions`)
  }
  // the registry helpers for a picker: none with the flag off
  const lib = libOf(texts)
  assert.deepEqual(plain(lib.myCompanionsGroup(shared, 'user-b')).map(e => e.displayName), ['Bravo Name'], 'the picker group: the user\'s own entries'); assert.deepEqual(plain(lib.myCompanionsGroup(shared, null)), []); assert.deepEqual(plain(lib.myCompanionsGroup(null, 'user-b')), [])
  assert.deepEqual(plain(libOf(texts, {}).myCompanionsGroup(shared, 'user-b')), [], 'flag off: no group')
}
await check('delete removes the entry (listPacks and storage: no id, no name), only that pack and only that user\'s; a repeat or an unknown id erases nothing; storage that throws or is absent keeps it in memory; junk reads as empty; the picker group is empty with the flag off', () => proveDelete())

// Storage where READING works and WRITING throws (quota full, Safari private mode). The review's MAJOR (605-review.md, finding 1): `entries()` never reached the memory store, so a save showed "Saved" and then an empty list, and a delete said erased:true while the entry came back.
// A write that fails now switches the session to the memory store, carrying what it had read, so reads and writes stay consistent. The storage itself is never changed (it cannot be written).
const REG_KEY_A = 'deckster.studio.avatarSpawn.entries.user-a'
const readOnlyStorage = text => { const map = new Map(text === undefined ? [] : [[REG_KEY_A, text]]); return { map, attempts: 0, getItem(key) { return map.has(key) ? map.get(key) : null }, setItem() { this.attempts++; throw new Error('QuotaExceededError') } } }
async function proveHalfFailingStorage(texts = {}, only = null) {
  const on = part => only === null || only === part
  // SAVE really shows: nothing stored, every write throws, and the list still has what was saved
  if (on('save')) {
    const s1 = readOnlyStorage(), f = await runFlow(texts, { names: ['Half One', 'Half Two'], storage: s1, seed: 31 })
    assert.ok(s1.attempts >= 1 && s1.map.size === 0, 'positive control: the writes were tried, threw, and nothing was stored')
    assert.deepEqual(await listOf(f.client, 'displayName'), ['Half One', 'Half Two'], 'a save shows its companion in the list although the write threw (not an empty list)')
    assert.deepEqual(await listOf(f.client, 'id'), f.entries.map(e => e.id))
  }
  // DELETE really removes: what storage holds is read, then a delete is not undone by the next read
  if (on('delete')) await proveHalfFailingDelete(texts)
  // the REAL container on the same kind of storage: Save shows the companion, Delete removes it
  if (on('page')) await proveHalfFailingPage(texts)
}
async function proveHalfFailingDelete(texts) {
  const stored = await runFlow(texts, { names: ['Stored One', 'Stored Two'], seed: 5 }), text = stored.storage.map.get(REG_KEY_A), [one, two] = stored.entries
  const s2 = readOnlyStorage(text), g = await runFlow(texts, { names: [], storage: s2, seed: 33 })
  assert.deepEqual(await listOf(g.client, 'id'), [one.id, two.id], 'positive control: the stored list is read')
  assert.deepEqual(plain(await g.client.deletePack(one.id)), { id: one.id, erased: true }, 'an erase receipt')
  assert.deepEqual(await listOf(g.client, 'id'), [two.id], 'the deleted entry does not come back'); assert.deepEqual(await listOf(g.client, 'id'), [two.id], 'not on a second read either')
  let job = await toPick(g.lib, g.client); job = g.client.advance((await g.client.pickMaster(job.id, 'c2')).id); const three = await g.client.saveDisplayName(job.id, 'Half Three')
  assert.deepEqual(await listOf(g.client, 'id'), [two.id, three.id], 'a save after the switch keeps the entries it carried over and does not bring the deleted one back')
  assert.deepEqual(plain(await g.client.deletePack(one.id)), { id: one.id, erased: false }, 'the deleted pack is not there to delete again')
  await g.client.deletePack(two.id); await g.client.deletePack(three.id); assert.deepEqual(await listOf(g.client), [], 'all gone, and they stay gone')
  assert.equal(s2.map.get(REG_KEY_A), text, 'the storage itself was never changed')
}
async function proveHalfFailingPage(texts) {
  const s3 = readOnlyStorage(), c3 = new (libOf(texts).MockSpawnClient)({ userId: 'user-a', storage: s3, random: seeded(35), now: () => NOW, timers: manualTimers() }), ev = [], ids = [], m = mountApp({ texts, client: spyClient(c3, ev, ids), events: ev })
  await toUpload(m, fakePhoto()); await m.click('Make my avatar'); c3.advance(ids[0]); await m.poll(); c3.advance(ids[0]); await m.poll()
  m.nodes('input', node => node.props.type === 'radio')[1].props.onChange(); m.root.flush(); await m.settle(); await m.click("That's me"); c3.advance(ids[0]); await m.poll()
  m.nodes('input', node => node.props.type === 'text')[0].props.onChange({ target: { value: 'Half Page' } }); m.root.flush(); await m.settle(); await m.click('Save companion')
  assert.ok(s3.attempts >= 1 && s3.map.size === 0, 'positive control: the page\'s write threw'); assert.ok(m.text().includes('Saved Half Page.') && m.text().includes('Half Page') && !m.text().includes('You have no companions of your own yet.'), 'the page shows the saved companion in the list, not "no companions"')
  await m.click('Delete'); await m.click('Delete companion')
  assert.ok(m.text().includes('Deleted Half Page.') && m.text().includes('You have no companions of your own yet.') && !m.text().includes('Pick'), 'the page shows the delete: the list is empty, not the companion again'); assert.equal((await c3.listPacks()).length, 0, 'and the client agrees'); m.unmount()
}
await check('storage that READS but cannot WRITE (setItem throws): a save shows its companion, a delete removes it and it does not come back, the entries read are carried over, the storage is never changed; the page shows the same', () => proveHalfFailingStorage())

// ===== G. refusals ==================================================================================================================================
console.log('G. refusals')
async function proveRefusal(texts = {}) {
  const lib = libOf(texts), steps = stepsOf(texts), seen = new Set()
  assert.deepEqual(plain(lib.REFUSAL_CODES), ['under_18_unconfirmed', 'public_figure', 'not_a_photo', 'quality'])
  for (const code of lib.REFUSAL_CODES) {
    const client = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(6), timers: manualTimers(), refuse: code })
    let job = await client.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW)); job = await client.submitPhoto(job.id, fakePhoto().file); assert.equal(job.stage, 'intake')
    job = client.advance(job.id); assert.deepEqual(plain({ stage: job.stage, refusal: job.refusal, packId: job.packId }), { stage: 'refused', refusal: code, packId: null })
    assert.equal(client.advance(job.id).stage, 'refused', 'a refused job does not move'); await assert.rejects(client.pickMaster(job.id, 'c1'), /wrong_stage/, 'and cannot be picked'); await assert.rejects(client.submitPhoto(job.id, fakePhoto().file), /wrong_stage/)
    const markup = html(steps.RefusedStep, { code, onBack() {} }), words = textOf(markup)
    assert.ok(words.includes(lib.REFUSAL_MESSAGES[code]), `${code}: its message is drawn`); assert.ok(lib.REFUSAL_MESSAGES[code].length > 40); seen.add(lib.REFUSAL_MESSAGES[code])
    assert.doesNotMatch(words, /continue|try again|appeal|retry|next/i, `${code}: no continue, no appeal`); assert.equal(count(markup, '<button'), 1, 'one button only'); assert.ok(buttonTag(markup, 'Back to my companions')); assert.equal(count(markup, '<input'), 0, 'nothing to upload or tick')
    assert.match(markup, /role="alert"/); assert.ok(!words.includes(code), 'the raw code is not shown'); assert.match(markup, new RegExp(`data-sas-refusal="${code}"`))
    assert.doesNotMatch(words, /\$|USD|cost|charge/i)
  }
  assert.equal(seen.size, 4, 'four different messages')
  // the intake's own checks
  const plainClient = type => new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(6), timers: manualTimers() })
  for (const [photo, want] of [[{ size: 200_000, type: 'application/pdf' }, 'not_a_photo'], [{ size: 200_000, type: '' }, 'not_a_photo'], [{ size: 10, type: 'image/jpeg' }, 'quality'], [{ size: 16 * 1024 * 1024, type: 'image/png' }, 'quality'], [{ size: Number.NaN, type: 'image/png' }, 'quality']]) {
    const client = plainClient(); let job = await client.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW)); job = await client.submitPhoto(job.id, photo); job = client.advance(job.id); assert.deepEqual(plain({ s: job.stage, r: job.refusal }), { s: 'refused', r: want }, JSON.stringify(photo))
  }
  for (const type of ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'IMAGE/JPEG']) { const client = plainClient(); let job = await client.createJob(lib.buildConsentRecord(CONSENT_IDS, NOW)); job = await client.submitPhoto(job.id, { size: 5000, type }); assert.equal(client.advance(job.id).stage, 'masters', type) }
  assert.equal(lib.refuseScenarioFrom('?refuse=quality'), 'quality'); assert.equal(lib.refuseScenarioFrom('?a=1&refuse=public_figure&b=2'), 'public_figure'); for (const bad of ['', '?refuse=nope', '?refuse=', '?xrefuse=quality', null, undefined, '?refuse=quality_x']) assert.equal(lib.refuseScenarioFrom(bad), null, String(bad))
}
await check('a refusal code renders its own plain message (four different ones), offers no continue, no appeal and no upload, and the job stops; the intake refuses a non-image and a too small or too large file; the demo hook reads only a known code', () => proveRefusal())

// ===== H. resolvePackUrl and the fallback chain =====================================================================================================
console.log('H. resolvePackUrl, fallback chain')
function proveResolve(texts = {}) {
  const lib = libOf(texts), entry = { packBaseUrl: '/companions/u-abcdefghijklmnopqrstuvwxyz' }, base = '/companions/u-abcdefghijklmnopqrstuvwxyz'
  const ok = [['motion/manifest.json', `${base}/motion/manifest.json`], ['/motion/manifest.json', `${base}/motion/manifest.json`], ['a/../b.webp', `${base}/b.webp`], ['./a//b.webp', `${base}/a/b.webp`], ['a/b/../../c.webp', `${base}/c.webp`], ['portrait-512.webp', `${base}/portrait-512.webp`]]
  for (const [rel, want] of ok) assert.equal(lib.resolvePackUrl(entry, rel), want, rel)
  assert.equal(lib.resolvePackUrl({ packBaseUrl: `${base}/` }, 'x.webp'), `${base}/x.webp`, 'a trailing slash on the base')
  assert.equal(lib.resolvePackUrl({ packBaseUrl: 'https://packs.example.test/u/abc' }, 'motion/manifest.json'), 'https://packs.example.test/u/abc/motion/manifest.json')
  const escapes = ['../x', '../../etc/x', 'a/../../x', '/../x', '..', 'a/..', '.', '', './', 'a/b/../../../c', '%2e%2e/x', 'a/%2E%2E/x', 'a%2fb', '..%5cx', 'a\\..\\b', 'a\\b', 'x?y=1', 'x#y', 'https://evil.test/x', '//evil.test/x', 'javascript:alert(1)', 'data:text/html,x', 'a:b', 'a\u0000b', 'a\nb', 'C:\\x']
  for (const rel of escapes) assert.equal(lib.resolvePackUrl(entry, rel), null, `${JSON.stringify(rel)} gets no URL`)
  // property: whatever comes out stays under the base, by the URL standard's own resolution
  const rand = seeded(99), parts = ['a', 'b', '..', '..', '.', '', 'motion', '%2e', 'x.webp']
  let resolved = 0
  for (let i = 0; i < 3000; i++) {
    const rel = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => parts[Math.floor(rand() * parts.length)]).join('/'), url = lib.resolvePackUrl(entry, rel)
    if (url === null) continue; resolved++
    const u = new URL(url, 'https://app.test'); assert.ok(u.pathname.startsWith(`${base}/`) && !u.pathname.split('/').includes('..') && u.origin === 'https://app.test', `${JSON.stringify(rel)} -> ${url}`)
  }
  assert.ok(resolved > 300, `the property run resolved ${resolved} paths`)
  for (const bad of ['javascript:alert(1)', '//evil.test/x', 'http://insecure.test/x', '/companions/../etc', '/a/../b', 'https://h.test/a/../b', '/a?b', '/a#b', '/a b', '/a\\b', '', '/', 'companions/felix', 'data:text/plain,x', 'https://user@h.test/x', null, undefined, 5]) {
    assert.equal(lib.safePackBaseUrl(bad), null, `${JSON.stringify(bad)} is no base`); assert.equal(lib.resolvePackUrl({ packBaseUrl: bad }, 'x.webp'), null)
  }
  assert.equal(lib.resolvePackUrl(null, 'x.webp'), null); assert.equal(lib.resolvePackUrl(entry, 5), null)
}
function proveFallback(texts = {}) {
  const lib = libOf(texts), entry = { packBaseUrl: '/companions/u-abcdefghijklmnopqrstuvwxyz' }, chain = plain(lib.companionFallbackChain(entry))
  assert.deepEqual(chain.map(s => s.kind), ['pack', 'portrait', 'felix'], 'the order: the pack, then the portrait, then Felix')
  assert.deepEqual(chain.map(s => s.url), ['/companions/u-abcdefghijklmnopqrstuvwxyz/motion/manifest.json', '/companions/u-abcdefghijklmnopqrstuvwxyz/portrait-512.webp', '/companions/felix/motion/manifest.json'])
  assert.deepEqual(chain.map(s => s.still), ['/companions/u-abcdefghijklmnopqrstuvwxyz/portrait-512.webp', '/companions/u-abcdefghijklmnopqrstuvwxyz/portrait-512.webp', '/companions/felix/portrait-512.webp'])
  const first = failing => lib.firstLoadable(lib.companionFallbackChain(entry), step => !failing.includes(step.kind)).kind
  assert.equal(first([]), 'pack'); assert.equal(first(['pack']), 'portrait', 'the pack cannot load: its portrait'); assert.equal(first(['pack', 'portrait']), 'felix', 'neither: Felix'); assert.equal(first(['pack', 'portrait', 'felix']), 'felix', 'nothing loads: still Felix, the last step')
  assert.deepEqual(plain(lib.companionFallbackChain({ packBaseUrl: 'javascript:alert(1)' })).map(s => s.kind), ['felix'], 'an unsafe base leaves only Felix'); assert.deepEqual(plain(lib.companionFallbackChain(null)).map(s => s.kind), ['felix'])
  assert.deepEqual(plain(lib.stillCandidates(lib.companionFallbackChain(entry))), ['/companions/u-abcdefghijklmnopqrstuvwxyz/portrait-512.webp', '/companions/felix/portrait-512.webp'], 'the distinct pictures, in order')
  for (const url of [chain[2].url, chain[2].still]) assert.ok(fs.existsSync(path.join(root, 'public', url)), `${url} is committed`)
  const steps = stepsOf(texts), thumb = html(steps.CompanionThumb, { entry }), felixThumb = html(steps.CompanionThumb, { entry: { packBaseUrl: '/companions/felix' } })
  assert.match(thumb, /src="\/companions\/u-abcdefghijklmnopqrstuvwxyz\/portrait-512\.webp"/, 'a thumbnail starts at the pack\'s own portrait'); assert.match(felixThumb, /src="\/companions\/felix\/portrait-512\.webp"/); assert.match(thumb, /referrerpolicy="no-referrer"/i, 'a thumbnail from a stored base sends no referrer')
  assert.match(html(steps.CompanionThumb, { entry: { packBaseUrl: 'javascript:alert(1)' } }), /src="\/companions\/felix\/portrait-512\.webp"/, 'an unsafe base shows Felix')
  assert.match(stepsOf(texts).CompanionThumb.toString(), /onError/, 'a failed picture steps to the next')
}
await check('resolvePackUrl joins safely: ".." stays inside the base (3000 generated paths, resolved by the URL standard), every escape, scheme, query, fragment, backslash, percent and control character gets null; unsafe bases are refused', () => proveResolve())
await check('the fallback chain is the pack, then the portrait, then Felix; firstLoadable walks it in that order and ends on Felix; an unsafe base leaves Felix only; the thumbnail starts at the pack\'s portrait', () => proveFallback())

// ===== I. every step and state, the styling ==========================================================================================================
console.log('I. steps (SSR), the real container, the styling')
const ENTRIES = [
  { id: 'u-aaaaaaaaaaaaaaaaaaaaaaaaaa', displayName: 'Quokka Rocket', packBaseUrl: '/companions/felix' },
  { id: 'u-bbbbbbbbbbbbbbbbbbbbbbbbbb', displayName: 'Dottie <b>Two</b>', packBaseUrl: '/companions/maya' },
]
const NO_OP = { onCreate() {}, onChoose() {}, onAskDelete() {}, onConfirmDelete() {}, onCancelDelete() {} }
function proveSteps(texts = {}) {
  const lib = libOf(texts), steps = stepsOf(texts)
  // upload: a file input, a preview only when there is one, the one privacy line, Make my avatar only once there is a photo
  const empty = html(steps.UploadStep, { previewUrl: null, hasFile: false, onFile() {}, onContinue() {}, onCancel() {} }), withFile = html(steps.UploadStep, { previewUrl: 'blob:fake/1', hasFile: true, onFile() {}, onContinue() {}, onCancel() {} })
  assert.match(empty, /<input id="sas-photo" type="file" accept="image\/jpeg,image\/png,image\/heic,image\/heif"/); assert.doesNotMatch(empty, /<img/); assert.equal(isDisabled(buttonTag(empty, 'Make my avatar')), true)
  assert.match(withFile, /<img class="sas-preview" src="blob:fake\/1" alt="Preview of your photo"/); assert.equal(isDisabled(buttonTag(withFile, 'Make my avatar')), false)
  assert.ok(textOf(empty).includes('Your photo stays in this tab. It is not saved, logged or sent anywhere.'), 'one short privacy line'); assert.equal(count(textOf(empty), 'not saved'), 1)
  assert.doesNotMatch(empty, /<form|capture=/, 'no form that could submit it, no camera capture')
  // progress: the stage names in plain words, the current one marked, the earlier ones done
  for (const [stage, at] of [['intake', 0], ['masters', 1], ['building', 3]]) {
    const markup = html(steps.ProgressStep, { job: { stage, progress: lib.STAGE_PROGRESS[stage] } }), items = [...markup.matchAll(/<li\b([^>]*)>([^<]*)<\/li>/g)]
    assert.deepEqual(items.map(m => m[2]), ['Checking your photo', 'Drawing your look', 'Choose your look', 'Building your companion', 'Ready'], 'the stage names in plain words')
    assert.deepEqual(items.map((m, i) => (m[1].includes('aria-current="step"') ? 'now' : m[1].includes('data-done="true"') ? 'done' : 'todo')), items.map((m, i) => (i === at ? 'now' : i < at ? 'done' : 'todo')), stage)
    assert.ok(textOf(markup).includes(`${lib.STAGE_WORDS[stage]}…`)); assert.match(markup, new RegExp(`aria-valuenow="${lib.STAGE_PROGRESS[stage]}"`))
  }
  // masters: four candidates, a pick enables "That's me"
  const cands = plain(libOf(texts).MASTER_CANDIDATES), none = html(steps.MastersStep, { candidates: cands, selectedId: null, onSelect() {}, onPick() {} }), some = html(steps.MastersStep, { candidates: cands, selectedId: 'c2', onSelect() {}, onPick() {} })
  assert.equal(count(none, 'type="radio"'), 4); assert.equal(isDisabled(buttonTag(none, "That's me")), true); assert.equal(isDisabled(buttonTag(some, "That's me")), false); assert.equal(count(some, 'checked=""'), 1)
  assert.ok(textOf(none).includes('These four looks are placeholders from our existing cast')); assert.ok(textOf(none).includes('your photo is let go of for good'))
  // ready: a name field; save only for a usable name
  const ready = name => html(steps.ReadyStep, { name, onName() {}, onSave() {} })
  for (const [name, off] of [['', true], ['   ', true], ['x'.repeat(41), true], ['Maya', false], ['  Mi  ', false]]) assert.equal(isDisabled(buttonTag(ready(name), 'Save companion')), off, JSON.stringify(name))
  assert.match(ready(''), /maxLength="40"|maxlength="40"/i); assert.ok(textOf(ready('')).includes('The name is kept only in this app\'s own record'), 'the name stays in the app\'s own record')
  // the list: empty, entries with Pick and Delete, a chosen one, a confirm, a notice
  const emptyList = html(steps.CompanionsList, { entries: [], chosenId: null, confirmingId: null, ...NO_OP })
  assert.ok(textOf(emptyList).includes('You have no companions of your own yet.')); assert.ok(buttonTag(emptyList, 'Create my avatar'))
  const list = html(steps.CompanionsList, { entries: ENTRIES, chosenId: null, confirmingId: null, notice: null, ...NO_OP })
  assert.equal(count(list, 'data-sas-companion='), 2); assert.equal(count(list, '>Pick</button>'), 2); assert.equal(count(list, '>Delete</button>'), 2); assert.ok(textOf(list).includes('Quokka Rocket')); assert.ok(list.includes('Dottie &lt;b&gt;Two&lt;/b&gt;'), 'a name is escaped, never markup')
  assert.doesNotMatch(list, /sas-confirm|alertdialog/, 'no confirm until Delete is asked')
  const chosen = html(steps.CompanionsList, { entries: ENTRIES, chosenId: ENTRIES[0].id, confirmingId: null, ...NO_OP })
  assert.equal(count(chosen, 'data-sas-part="chosen"'), 1); assert.ok(isDisabled(buttonTag(chosen, 'Picked')) && count(chosen, '>Pick</button>') === 1)
  const confirm = html(steps.CompanionsList, { entries: ENTRIES, chosenId: null, confirmingId: ENTRIES[1].id, notice: lib.deletedNotice('Gone Name'), ...NO_OP }), words = textOf(confirm)
  assert.equal(count(confirm, 'role="alertdialog"'), 1); assert.match(words, /Delete Dottie <b>Two<\/b>\? This deletes the companion's pack and its previews\. It cannot be undone\./); assert.ok(buttonTag(confirm, 'Delete companion') && buttonTag(confirm, 'Keep it'))
  assert.ok(words.includes('Deleted Gone Name. The companion\'s pack and its previews are deleted.'), 'the delete notice says the pack and previews are deleted'); assert.equal(lib.deletedNotice(null), "Deleted. The companion's pack and its previews are deleted."); assert.equal(lib.savedNotice('Zed'), 'Saved Zed.')
  assert.match(confirm, /role="status"/)
  for (const markup of [empty, withFile, none, ready('Maya'), list, confirm]) assert.doesNotMatch(textOf(markup), /\$|\bUSD\b|\btokens?\b/, 'no money or token words (the mock has no cost)')
}
await check('every step and state renders: upload (file input, preview only with a photo, one privacy line), progress (plain stage names, current marked), four looks, name, the list (empty, chosen, confirm, notice); a name is escaped', () => proveSteps())

// ---- the REAL container, driven through the repo's mini-react host --------------------------------------------------------------------------------
function mountApp({ texts = {}, client, events = [], userId = 'user-a' }) {
  let n = 0, hn = 0; const intervals = []
  const urls = { createObjectURL() { const url = `blob:fake/${++n}`; events.push(`create ${url}`); return url }, revokeObjectURL(url) { events.push(`revoke ${url}`) } }
  const globals = { URL: urls, setInterval: (fn, ms) => { const handle = ++hn; intervals.push({ handle, fn, ms }); return handle }, clearInterval: handle => { const i = intervals.findIndex(t => t.handle === handle); if (i >= 0) intervals.splice(i, 1) }, window: { location: { search: '' } } }
  const { StudioAvatarSpawnApp } = load(APP, { env: ENV_ON, texts, globals }), tree = new Root()
  tree.setElement(h(StudioAvatarSpawnApp, { userId, client })); tree.flush()
  const api = {
    root: tree, intervals, events,
    nodes: (type, pred = () => true) => hostNodes(tree.tree).filter(node => node.type === type && pred(node)),
    text: () => nodeText(tree.tree).replace(/\s+/g, ' '),
    button: label => api.nodes('button', node => nodeText(node).trim() === label)[0] ?? null,
    async settle() { for (let i = 0; i < 3; i++) { await tick(); tree.flush() } },
    async click(label) { const b = api.button(label); assert.ok(b, `a "${label}" button (page text: ${api.text().slice(0, 160)})`); assert.ok(!b.props.disabled, `"${label}" is enabled`); b.props.onClick(); tree.flush(); await api.settle() },
    async poll() { assert.equal(intervals.length, 1, 'one polling interval while a stage is moving'); intervals[0].fn(); await api.settle() },
    unmount() { tree.unmount() },
  }
  return api
}
/** A client for the container: the real mock, with its calls (and the photo's preview address) logged in one list, so ORDER can be checked. */
function spyClient(client, events, ids) {
  return {
    createJob: async consent => { const job = await client.createJob(consent); ids.push(job.id); return job }, submitPhoto: (id, file) => { events.push('submitPhoto'); return client.submitPhoto(id, file) }, getJob: id => client.getJob(id),
    pickMaster: (id, c) => { events.push('pickMaster'); return client.pickMaster(id, c) }, listPacks: () => client.listPacks(), deletePack: id => client.deletePack(id), saveDisplayName: (id, name) => client.saveDisplayName(id, name),
  }
}
async function toUpload(m, photo) {
  await m.settle(); await m.click('Create my avatar')
  for (let i = 0; i < 4; i++) { assert.equal(m.button('Continue').props.disabled, true, `Continue is disabled with ${i} items ticked`); m.nodes('input', node => node.props.type === 'checkbox')[i].props.onChange(); m.root.flush(); await m.settle() }
  await m.click('Continue'); assert.ok(m.text().includes('Add a photo'), 'the upload step')
  assert.equal(m.button('Make my avatar').props.disabled, true, 'no photo yet'); m.nodes('input', node => node.props.type === 'file')[0].props.onChange({ target: { files: [photo.file] } }); m.root.flush(); await m.settle()
}
async function proveContainer(texts = {}) {
  const lib = libOf(texts), events = [], ids = [], storage = new FakeStorage(), photo = fakePhoto()
  const client = new lib.MockSpawnClient({ userId: 'user-a', storage, random: seeded(13), now: () => NOW, timers: manualTimers() }), m = mountApp({ texts, client: spyClient(client, events, ids), events })
  await m.settle(); assert.ok(m.text().includes('My companions') && m.text().includes('You have no companions of your own yet.'), 'the list, empty')
  await toUpload(m, photo)
  assert.equal(m.nodes('img', node => node.props.className === 'sas-preview')[0]?.props.src, 'blob:fake/1', 'the preview is a blob address, never a data URL'); assert.equal(m.button('Make my avatar').props.disabled, false)
  assert.deepEqual(photo.reads, [], 'the page never read the photo\'s bytes'); assert.equal(storage.writes().length, 0, 'nothing is stored yet')
  await m.click('Make my avatar'); assert.ok(m.text().includes('Checking your photo…')); assert.ok(events.includes('submitPhoto'))
  client.advance(ids[0]); await m.poll(); assert.ok(m.text().includes('Drawing your look…'), 'masters')
  client.advance(ids[0]); await m.poll(); assert.ok(m.text().includes('Choose your look'), 'pick'); assert.equal(m.intervals.length, 0, 'no polling while the person chooses')
  assert.equal(m.nodes('input', node => node.props.type === 'radio').length, 4); assert.equal(m.button("That's me").props.disabled, true)
  m.nodes('input', node => node.props.type === 'radio')[1].props.onChange(); m.root.flush(); await m.settle(); assert.equal(m.button("That's me").props.disabled, false)
  const before = events.length; await m.click("That's me")
  assert.deepEqual(events.slice(before, before + 2), ['revoke blob:fake/1', 'pickMaster'], 'picking a look lets go of the photo FIRST, then picks'); assert.ok(m.text().includes('Building your companion…'))
  client.advance(ids[0]); await m.poll(); assert.ok(m.text().includes('Name your companion'), 'ready')
  assert.equal(m.button('Save companion').props.disabled, true, 'no name yet'); m.nodes('input', node => node.props.type === 'text')[0].props.onChange({ target: { value: 'Quokka Rocket' } }); m.root.flush(); await m.settle()
  await m.click('Save companion')
  assert.ok(m.text().includes('Saved Quokka Rocket.') && m.text().includes('Quokka Rocket'), 'back on the list with the new companion and a notice'); assert.equal(storage.writes().length, 1, 'the entry is the one write')
  const stored = JSON.parse([...storage.map.values()][0]); assert.equal(stored.length, 1); assert.deepEqual(Object.keys(stored[0]).sort(), ENTRY_KEYS); assert.doesNotMatch([...storage.map.values()].join(''), /data:|blob:|PHOTO-BYTES|private-photo-name/); assert.deepEqual(photo.reads, [])
  // pick marks the chosen companion; delete asks first, and says what goes
  await m.click('Pick'); assert.ok(m.text().includes('Chosen') && m.button('Picked')?.props.disabled === true, 'marked as the chosen companion')
  await m.click('Delete'); assert.ok(m.text().includes("Delete Quokka Rocket? This deletes the companion's pack and its previews."), 'a confirm first'); assert.equal((await client.listPacks()).length, 1, 'nothing is deleted yet')
  await m.click('Keep it'); assert.ok(!m.text().includes('This deletes the companion'), 'kept'); assert.equal((await client.listPacks()).length, 1)
  await m.click('Delete'); await m.click('Delete companion')
  assert.ok(m.text().includes("Deleted Quokka Rocket. The companion's pack and its previews are deleted.") && m.text().includes('You have no companions of your own yet.'), 'deleted, and it says the pack and previews are deleted'); assert.equal((await client.listPacks()).length, 0); assert.equal(JSON.parse([...storage.map.values()][0]).length, 0)
  assert.ok(!m.text().includes('Chosen'), 'the deleted companion is no longer chosen'); m.unmount()
  // a refusal lets go of the photo, shows its message, and offers no way on
  for (const code of ['public_figure', 'quality']) {
    const ev = [], ids2 = [], c2 = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(14), timers: manualTimers(), refuse: code }), r = mountApp({ texts, client: spyClient(c2, ev, ids2), events: ev }), ph = fakePhoto()
    await toUpload(r, ph); await r.click('Make my avatar'); c2.advance(ids2[0]); await r.poll()
    assert.ok(r.text().includes(lib.REFUSAL_MESSAGES[code]), `${code}: the message`); assert.ok(ev.includes('revoke blob:fake/1'), `${code}: the photo is let go of when the job is refused`)
    assert.deepEqual(r.nodes('button').map(b => nodeText(b).trim()), ['Back to my companions'], `${code}: nothing to continue with`); assert.equal(r.nodes('input').length, 0)
    await r.click('Back to my companions'); assert.ok(r.text().includes('Create my avatar')); r.unmount()
  }
  // cancel, at consent and at upload, and unmount, each let go of the photo
  const ev = [], ids3 = [], c3 = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(15), timers: manualTimers() }), cancel = mountApp({ texts, client: spyClient(c3, ev, ids3), events: ev })
  await cancel.settle(); await cancel.click('Create my avatar'); await cancel.click('Cancel'); assert.ok(cancel.text().includes('Create my avatar') && !cancel.text().includes('Before we start'), 'cancel at consent')
  await toUpload(cancel, fakePhoto()); await cancel.click('Cancel'); assert.ok(ev.includes('revoke blob:fake/1'), 'cancel at upload lets go of the photo'); assert.ok(cancel.text().includes('Create my avatar'))
  const ev4 = [], ids4 = [], c4 = new lib.MockSpawnClient({ userId: 'user-a', storage: new FakeStorage(), random: seeded(16), timers: manualTimers() }), gone = mountApp({ texts, client: spyClient(c4, ev4, ids4), events: ev4 })
  await toUpload(gone, fakePhoto()); assert.ok(!ev4.some(e => e.startsWith('revoke')), 'held while the page is open'); gone.unmount(); assert.ok(ev4.includes('revoke blob:fake/1'), 'leaving the page lets go of the photo')
}
await check('the REAL container, driven: Continue stays disabled until the fourth tick; photo -> progress -> four looks -> name -> list; the photo is never read or stored; picking discards it FIRST; Pick marks the chosen one; Delete asks, then says the pack and previews are deleted; a refusal, Cancel and leaving the page each let go of the photo', () => proveContainer())

const CSS_FILES = ['components/studio-usage-credits.css', 'components/layout/studio-shell.css', 'app/(app)/studio-v4-account.css']
function proveCss(cssText = read(CSS)) {
  const hex = text => new Set((text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(c => c.toLowerCase())), allowed = new Set(CSS_FILES.flatMap(rel => [...hex(read(rel))]))
  const code = cssText.replace(/\/\*[\s\S]*?\*\//g, ''), mine = hex(code); assert.ok(mine.size >= 8, `the stylesheet names its fallbacks (${mine.size} colours)`)
  for (const colour of mine) assert.ok(allowed.has(colour), `${colour} is a colour Studio already has (usage credits, shell or account tokens): no new colour`)
  assert.doesNotMatch(code, /gradient|purple|--ss-accent|--sa-accent|rgba?\(|hsla?\(/i, 'no gradient, no purple, no colour function')
  assert.match(cssText, /@media \(max-width: 520px\)/, 'a phone rule'); assert.match(cssText, /overflow-wrap: anywhere/); assert.match(cssText, /\.dark \[data-studio-avatar-spawn="true"\]/, 'a dark pair')
  assert.match(cssText, /focus-visible/, 'a visible focus')
}
await check('the styling adds no colour (every hex is already in the usage credits, shell or account stylesheets), no gradient, no purple; a phone rule, a dark pair, a visible focus', () => proveCss())

// ===== J. the strip, the registry, .env.example ======================================================================================================
console.log('J. the strip, the registry, the env block')
const SUBJECT_FILTER = /^ {2}shas\.splice\(0, shas\.length, \.\.\.shas\.filter\(sha => !\/\^Avatar spawn mock:\/\.test\(git\('log', '-1', '--format=%s', sha\)\)\)\) \/\/ LATER-CHANGES: registry read \(AVATAR-SPAWN\): /
const LEGACY_FILES = ['app/builder/page.tsx', 'app/(app)/layout.tsx', 'app/(app)/usage/page.tsx', 'components/layout/studio-rail.tsx', 'lib/studio-voice-call-ui.ts', 'hooks/use-studio-voice-call.ts', 'app/api/account/route.ts', REGISTRY, '.env.example', 'scripts/test-studio-usage-credits-page.mjs']
/** FRONTEND-1's voice-call proof: dev has the four lines FRONTEND-1 OK'd (#607, D94), so this change must not touch it. Named here for the lane guard's and the scope's mutants: any edit of it, however small, is refused. */
const VCALL = 'scripts/test-studio-voice-call.mjs'
/** ORDER, not adjacency: this change's taught line comes AFTER the dev line it was taught after (any position after it); whatever sits between the two is another change's registered subject filter (a subject filter carrying the registry-read mark); the line is there exactly once. A change that merges first lands its filter between the two. */
const FILTER_ANY = /shas\.filter\(sha => !\/\^/
function provePinOrder(rel, lines, a = m => m) {
  const mine = lines.findIndex(line => line.includes(AVATAR_SPAWN_PIN_MARK)), anchorAt = lines.findIndex(line => line.startsWith(AVATAR_SPAWN_PIN_AFTER))
  assert.equal(lines.filter(line => line.startsWith(AVATAR_SPAWN_PIN_AFTER)).length, 1, a(`${rel}: the dev line it is taught after is there exactly once`))
  assert.ok(anchorAt > 0 && FILTER_ANY.test(lines[anchorAt]) && baseText(rel).split('\n').includes(lines[anchorAt]), a(`${rel}: that line is a subject filter dev already has`))
  assert.ok(mine > anchorAt, a(`${rel}: after the agent mode shell's filter (dev's last), not above it`))
  for (const between of lines.slice(anchorAt + 1, mine)) assert.ok(FILTER_ANY.test(between) && between.includes('// LATER-CHANGES: registry read ('), a(`${rel}: between dev's filter and ours only another change's registered subject filter: ${between.slice(0, 90)}`))
  assert.equal(lines.filter(line => /shas\.filter\(sha => !\/\^Avatar spawn mock:\//.test(line)).length, 1, a(`${rel}: our line is there exactly once`))
}
function proveStrip(strip, readNow = read, later = laterStrips, at = '') {
  const laterOwn = later // LATER-CHANGES: registry read (WS-BQ-CLAIM)
  later = (rel, text) => laterStrips(rel, laterOwn(rel, text)) // LATER-CHANGES: registry read (WS-BQ-CLAIM): the strips of the changes registered after this one are applied too, whichever stand-in strip a control passes (idempotent when it is laterStrips)
  const a = m => (at ? `${at}: ${m}` : m)
  assert.deepEqual(Object.keys(AVATAR_SPAWN_EDITS).sort(), [...AVATAR_SPAWN_PIN_FILES].sort(), a('the strip edits the two older proofs it teaches and nothing else (no FRONTEND-1 file, voice-call proof included: dev has its four lines; no app file: new files only)'))
  for (const [rel, edits] of Object.entries(AVATAR_SPAWN_EDITS)) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(strip(rel, now), base, a(`${rel}: put back it is the base's, byte for byte`)); assert.equal(strip(rel, strip(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of edits) assert.equal(count(`\n${now}`, `\n${has}`), 1, a(`${rel}: an edited line is there exactly once`))
    const diff = lineDiff(base, now), has = edits.flatMap(([hasText]) => hasText.split('\n').filter(Boolean)), was = edits.flatMap(([, wasText]) => wasText.split('\n').filter(Boolean))
    assert.deepEqual(diff.filter(line => line.startsWith('+')), has.map(line => `+${line}`), a(`${rel}: exactly the taught lines are added`)); assert.deepEqual(diff.filter(line => line.startsWith('-')), was.map(line => `-${line}`), a(`${rel}: nothing of the base is gone`))
  }
  for (const rel of AVATAR_SPAWN_PIN_FILES) {
    const now = later(rel, readNow(rel)), lines = now.split('\n'), marked = lines.filter(line => line.includes(AVATAR_SPAWN_PIN_MARK))
    assert.equal(marked.length, 1, a(`${rel}: one taught line, carrying the registry-read mark`)); assert.equal(`${marked[0]}\n`, AVATAR_SPAWN_PIN_EDITS[rel][0][0]); assert.ok(SUBJECT_FILTER.test(marked[0]), a(`${rel}: the taught line is a subject filter for "Avatar spawn mock:"`))
    assert.ok(AVATAR_SPAWN_PIN_EDITS[rel].every(([, was]) => !was.includes(AVATAR_SPAWN_PIN_MARK)), a('the put-back text has no mark'))
    provePinOrder(rel, lines, a)
    assert.ok(AVATAR_SPAWN_MARKER_RE.test(marked[0]), a('and the line carries the marker as a whole token'))
  }
  // a file it does not own comes back unchanged (also with the lines in it); a longer line that merely ends with a line is not a line; a non-string is returned as it is
  for (const rel of LEGACY_FILES) { const text = readNow(rel); assert.equal(strip(rel, text), text, a(`${rel}: not this change's: returned as it is`)) }
  const [[line]] = AVATAR_SPAWN_PIN_EDITS[AVATAR_SPAWN_PIN_FILES[0]], P = AVATAR_SPAWN_PIN_FILES[0]
  assert.equal(strip('app/builder/page.tsx', `a\n${line}b\n`), `a\n${line}b\n`, a('the line in another file stays')); assert.equal(strip(P, 1), 1); assert.equal(strip(P, undefined), undefined)
  assert.equal(strip(P, `x${line}`), `x${line}`, a('a line that merely ends with it is not it')); assert.equal(strip(P, `${line.replace(/\n$/, '')}x\n`), `${line.replace(/\n$/, '')}x\n`)
  assert.equal(strip(P, `a\n${line}${line}b\n`), `a\n${line}b\n`, a('a line that is there twice is a merge mistake: only the first goes, the older pins still see the second')); assert.equal(strip(P, 'a\nb\n'), 'a\nb\n', a('a proof without the line is returned as it is'))
}
await check('the strip: the two taught proofs put back are the base\'s (dev after D94), byte for byte, idempotent; each taught line is one subject filter with the registry-read mark, after the agent mode shell\'s filter (dev\'s last; an order, another change\'s registered filter may sit between); a file it does not own (also with the line in it), a longer line, a non-string and a proof without the line come back as they are; a doubled line is not hidden', () => proveStrip(stripAvatarSpawn))

// LINEAR STACK-style control: a change that merges FIRST (#600) lands its registered subject filter between dev's last one and ours: the order pin still passes, and so does the whole strip once its own strip is told
const EARLIER = { mark: 'registry read (SYNTHETIC-EARLIER)', line: "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic earlier:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (SYNTHETIC-EARLIER): a made-up change merged before this one" }
const withEarlier = (rel, text, count = 1) => { if (!AVATAR_SPAWN_PIN_FILES.includes(rel)) return text; const lines = text.split('\n'); lines.splice(lines.findIndex(l => l.startsWith(AVATAR_SPAWN_PIN_AFTER)) + 1, 0, ...Array(count).fill(EARLIER.line)); return lines.join('\n') }
const earlierStrip = (rel, text) => (AVATAR_SPAWN_PIN_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(EARLIER.mark)).join('\n') : text)
await check('the taught-line pin is an ORDER check: another change\'s registered subject filter between dev\'s last filter and ours still passes (one or two, read as they are), and the whole strip passes once that change\'s own strip is told', () => {
  for (const rel of AVATAR_SPAWN_PIN_FILES) for (const count of [1, 2]) { const lines = withEarlier(rel, read(rel), count).split('\n'); assert.equal(lines.filter(l => l.includes(EARLIER.mark)).length, count, 'positive control: the synthetic filter is there'); provePinOrder(rel, lines) }
  proveStrip(stripAvatarSpawn, rel => withEarlier(rel, read(rel)), earlierStrip, 'an earlier change between')
})

function proveStripData(draft = AVATAR_SPAWN_DRAFT, stripText = read(STRIP)) {
  assert.doesNotMatch(stripText.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'the strip is plain data: no imports, nothing read from disk or git')
  assert.ok(AVATAR_SPAWN_MARKER_RE.test('a // AVATAR-SPAWN') && !AVATAR_SPAWN_MARKER_RE.test('a // AVATAR-SPAWN-X') && !AVATAR_SPAWN_MARKER_RE.test('a // X-AVATAR-SPAWN') && !AVATAR_SPAWN_MARKER_RE.test('a // AVATAR_SPAWN'), 'the marker is a whole token')
  assert.equal(AVATAR_SPAWN_SUBJECT, 'Avatar spawn mock:'); assert.equal(AVATAR_SPAWN_FLAG, 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN'); assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/); git('merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD')
  assert.equal(AVATAR_SPAWN_PIN_AFTER.includes('Agent mode shell:'), true)
  for (const rel of AVATAR_SPAWN_NEW_FILES) assert.doesNotMatch(read(rel), SECRET_SHAPE, `${rel}: no secret-shaped literal`)
  for (const rel of AVATAR_SPAWN_NEW_FILES) assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, ''), new RegExp(`-{2}std${'in'}`), `${rel}: no stdin pipe into git`)
  // the DRAFT lines for the owners: six, each anchored on the exact dev lines (quoted, with their numbers), each carrying the marker, none applied
  assert.equal(draft.length, 6, 'six draft lines'); assert.deepEqual([...new Set(draft.map(d => d.file))].sort(), ['app/api/account/route.ts', 'components/layout/studio-rail.tsx', 'hooks/use-studio-voice-call.ts', 'lib/studio-voice-call-ui.ts'])
  for (const d of draft) {
    const dev = baseText(d.file).split('\n'), rows = d.anchor.split('\n'); assert.ok(Number.isInteger(d.after) && d.after > 0 && d.topic && d.line, d.file)
    assert.equal(dev.slice(d.after - rows.length, d.after).join('\n'), d.anchor, `${d.file}: the anchor is dev's line ${d.after - rows.length + 1}${rows.length > 1 ? `-${d.after}` : ''}, quoted exactly`)
    assert.ok(AVATAR_SPAWN_MARKER_RE.test(d.line), `${d.file}: the draft line carries the marker`); assert.ok(!d.line.includes('\n') && !AVATAR_SPAWN_SCOPE_FILES.has(d.file), 'one line, in a file this change does not touch')
    assert.doesNotMatch(d.line, SECRET_SHAPE)
  }
  assert.ok(draft.some(d => /myCompanionsGroup/.test(d.line)) && draft.some(d => /STUDIO_AVATAR_SPAWN_ENABLED/.test(d.line)), 'they use what the lib exports'); const lib = libOf(); for (const name of ['myCompanionsGroup', 'STUDIO_AVATAR_SPAWN_ENABLED']) assert.ok(name in lib, `${name} is exported`)
}
await check('the strip is plain data (no imports, nothing read); its marker is a whole token; the six DRAFT lines for the owners are anchored on dev\'s exact lines, carry the marker, and name only what the lib exports; none is applied (their files are not in the scope)', () => proveStripData())

const END = '  // one line per later change, above this comment'
const OWN_NAME = 'studio-avatar-spawn-strip.mjs'
/** The list a registry line sits in (the nearest `export const LATER_...` above it). */
const sectionOf = (lines, at) => { for (let i = at; i >= 0; i--) { const m = /^export const (LATER_\w+)/.exec(lines[i]); if (m) return m[1] } return null }
function proveRegistryText(regText) {
  const reg = regText.split('\n'), baseReg = baseText(REGISTRY).split('\n')
  /** Registry lines a change registered AFTER this one added (in each list, below this change's line, in the registered shape): that change's, not this one's. A stray line is still counted. */
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of reg) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes(OWN_NAME)) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })()
  const diff = lineDiff(baseText(REGISTRY), regText).filter(line => !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes(OWN_NAME)); assert.equal(own.length, 3, 'the registry gains exactly this change\'s THREE lines')
  for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE: FRONTEND-2, ') && AVATAR_SPAWN_MARKER_RE.test(line) && line.includes('B66'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['AVATAR_SPAWN_SCOPE_FILES', 'AVATAR_SPAWN_ENV_BLOCK', 'stripAvatarSpawn'], 'one files line, one env block line, one strip line')
  assert.equal(diff.length, 3, 'and nothing else in the registry')
  assert.deepEqual(own.map(line => sectionOf(reg, reg.indexOf(line.slice(1)))), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list')
  for (const line of own) {
    const at = reg.indexOf(line.slice(1)); assert.ok(at > 0, line.slice(1, 80))
    // ORDER: the voice call's line comes BEFORE ours in the same list, and whatever sits between the two is a registered line of another change that dev already has (#607's agent mode shell, after D94)
    const list = sectionOf(reg, at), vAt = reg.findIndex((l, i) => i < at && sectionOf(reg, i) === list && l.includes('// LATER-CHANGE:') && l.includes('studio-voice-call-strip.mjs'))
    assert.ok(vAt >= 0 && vAt < at, `studio-voice-call-strip.mjs's line comes before ours in its list: ${line.slice(1, 80)}`)
    for (const between of reg.slice(vAt + 1, at)) assert.ok(baseReg.includes(between) && between.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(between), `between the voice call's line and ours only a registered line of another change that dev already has: ${between.slice(0, 80)}`)
    assert.ok(reg[at + 1] === END || laterRegistry.has(reg[at + 1]), 'the true end of its list (or followed only by a later change\'s registered line)')
  }
}
const laterEnvBlocksOut = text => { const at = registry.LATER_ENV_BLOCKS.indexOf(AVATAR_SPAWN_ENV_BLOCK); return (at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1)).reduce((out, registered) => { const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, ''); let i = out.indexOf(block); while (i !== -1 && !((i === 0 || out[i - 1] === '\n') && (i + block.length === out.length || out[i + block.length] === '\n'))) i = out.indexOf(block, i + 1); if (i === -1) return out; const before = out.slice(0, i), after = out.slice(i + block.length); return /^\n*$/.test(after) ? (before.endsWith('\n\n') ? before.slice(0, -1) : before) : after.startsWith('\n\n') ? before + after.slice(2) : before + after.slice(1) }, text) } // LATER-CHANGES: registry read (WS-BQ-CLAIM): the .env.example blocks of the changes registered AFTER this one (the registry's order) come out first, so the block is the last one as this change left the file
function proveEnv(envText, blockOk = true) {
  envText = laterEnvBlocksOut(envText) // LATER-CHANGES: registry read (WS-BQ-CLAIM)
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is dev\'s plus the registered blocks and nothing else')
  assert.equal(count(envText, AVATAR_SPAWN_ENV_BLOCK), 1, 'this change\'s block is there exactly once, verbatim'); assert.ok(envText.includes(`\n\n${AVATAR_SPAWN_ENV_BLOCK}`), 'a blank line before the block'); assert.ok(blockOk ? envText.endsWith(AVATAR_SPAWN_ENV_BLOCK) : true, 'the block is the last one')
  assert.ok(AVATAR_SPAWN_ENV_BLOCK.includes(`${AVATAR_SPAWN_FLAG}="false"`), 'the flag is documented as off'); assert.equal(AVATAR_SPAWN_ENV_BLOCK.split('\n').filter(l => /^[A-Z_]+=/.test(l)).length, 1, 'one variable'); assert.ok(AVATAR_SPAWN_MARKER_RE.test(AVATAR_SPAWN_ENV_BLOCK))
  assert.doesNotMatch(AVATAR_SPAWN_ENV_BLOCK, SECRET_SHAPE)
}
await check('the registry holds exactly this change\'s three lines (files, env block, strip) at the true end of each list, after the voice call\'s (only another change\'s registered line between), and loses none; .env.example is dev\'s plus one block (after one blank line, the last, flag "false"); every scope file is registered', () => {
  assert.ok(registry.LATER_STRIPS.includes(stripAvatarSpawn) && registry.LATER_ENV_BLOCKS.includes(AVATAR_SPAWN_ENV_BLOCK) && [...AVATAR_SPAWN_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry holds the strip, the block and every file')
  const regLines = read(REGISTRY).split('\n'); assert.equal(regLines.filter(line => line.includes(OWN_NAME)).length, 3, 'three lines name this change\'s strip module'); proveRegistryText(read(REGISTRY)); proveEnv(read('.env.example'))
  assert.ok(registry.LATER_STRIPS.indexOf(stripAvatarSpawn) > registry.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripVoiceCall'), 'the strip comes after the voice call\'s')
})

// ===== K. scope ======================================================================================================================================
console.log('K. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-08T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-08T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avs-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(AVATAR_SPAWN_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: on the gate's merge (dev first, this change's head second) the scope runs against HEAD^2; elsewhere HEAD itself. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
/** No older change's subject filter (the taught proofs' own `shas.filter(sha => !/^…/` lines at dev) matches this change's subject; this change's own filter is the one that does. */
const subjectFilters = text => text.split('\n').filter(line => /shas\.filter\(sha => !\//.test(line)).map(line => new RegExp(/shas\.filter\(sha => !\/(.+?)\/\.test\(git\(/.exec(line)[1]))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  const olderFilters = AVATAR_SPAWN_PIN_FILES.flatMap(rel => subjectFilters(baseText(rel)))
  assert.ok(olderFilters.length >= 20, 'the older subject filters are read from the taught proofs at dev')
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) { const subject = subjectOf(c); if (isOwnSubject(subject)) assert.ok(!olderFilters.some(re => re.test(subject)), `${c.slice(0, 8)} would be taken for an older change's own commit`) }
  return own
}
/** Lanes this change must not touch (FRONTEND-1's, COMPOSER-2's, the reconnect proof): none of their files changes, the lines they would need are DRAFTS. */
const LANES = /^(scripts\/test-studio-(p2-|billing-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|flow-control|voice-call)|scripts\/test-atlas-help-recovery|scripts\/test-director-websocket-reconnect|scripts\/test-(deck-card-thumbnail|first-paint)|lib\/studio-flow-control\.ts|hooks\/use-studio-flow-control\.ts|lib\/studio-voice-call|components\/builder\/voice-call\/|hooks\/use-studio-voice-call\.ts|components\/layout\/)/
/** The lane guard: no file of FRONTEND-1's, COMPOSER-2's or the reconnect proof's lane is touched, none excepted (the voice-call proof's four OK'd lines are dev's now, so an edit of it is a foreign edit too). */
const assertLanes = (touched, allowed = []) => { for (const rel of touched) assert.ok(!LANES.test(rel) || allowed.includes(rel), `${rel} is in FRONTEND-1's, COMPOSER-2's or the reconnect proof's lane: their lines are DRAFTS here`) }
const UNTOUCHED = ['lib/studio-voice-call-ui.ts', 'hooks/use-studio-voice-call.ts', 'components/layout/studio-rail.tsx', 'components/builder/voice-call/voice-call-stage.tsx', 'components/builder/voice-call/companion-player.tsx', 'app/api/account/route.ts', 'app/(app)/layout.tsx', 'app/(app)/studio-v4-account.css', 'app/(app)/usage/page.tsx', 'components/studio-usage-credits.css', 'components/layout/studio-shell.css', 'hooks/use-auth.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json']
const existsAt = (rev, rel) => { try { git('cat-file', '-e', `${rev}:${rel}`); return true } catch { return false } }
const scopeCommittedFiles = (head, { later = laterStrips, registered = registry.LATER_CHANGE_FILES } = {}) => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...AVATAR_SPAWN_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].filter(rel => AVATAR_SPAWN_SCOPE_FILES.has(rel) || !registered.has(rel)).sort(), [...AVATAR_SPAWN_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else (a file the registry names for a later change, stacked on this head, is left to that change; an unregistered file still fails)')
  // NEW FILES ONLY: of the files this change touches, the ones dev already has are the registry, .env.example, the two taught proofs, never an app file or a FRONTEND-1 file
  assert.deepEqual([...touched].filter(rel => existsAt(BASE_COMMIT, rel)).sort(), [...AVATAR_SPAWN_OWN_EDITS].sort(), 'new files only: the only existing files touched are .env.example, the registry and the two taught proofs')
  for (const rel of AVATAR_SPAWN_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.ok(!existsAt(BASE_COMMIT, rel), `${rel} is new: dev has none`) }
  for (const rel of AVATAR_SPAWN_PIN_FILES) assert.equal(stripAvatarSpawn(rel, later(rel, git('show', `${head}:${rel}`))), baseText(rel), `${rel}: an older proof taught: put back it is the base's (a later change's registered lines out first)`)
  for (const rel of UNTOUCHED) { assert.ok(!touched.has(rel), `${rel} is not touched by this change`); assert.equal(sha(git('show', `${head}:${rel}`)), sha(baseText(rel)), `${rel}: flag off, an existing app file is dev's, byte for byte`) }
  assertLanes(touched)
}
const scopeAll = (head, opts) => { scopeOwnCommits(head); scopeCommittedFiles(head, opts); proveRegistryText(git('show', `${head}:${REGISTRY}`)); proveEnv(git('show', `${head}:.env.example`)) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins (read past the later changes' strips) and every other section still run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
const scopeMutant = (label, fn) => (ON_OWN_LINE ? mutant(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${AVATAR_SPAWN_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's (the taught proofs' filters at dev do not match)`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s (the page, the lib, the components, the strip, this proof, .env.example, the registry, the two taught proofs); NEW FILES ONLY: no FRONTEND-1 file, voice-call proof included: no existing app file changes (FRONTEND-1\'s rail, call hook and picker lib, the account route, the layout and the Usage page are dev\'s, byte for byte)', () => scopeCommittedFiles(HEAD))
await scopeCheck('the registry gains exactly this change\'s three marked lines at the true end of each list, after the voice call\'s (only another change\'s registered line between), and loses none; .env.example is dev\'s plus one block (after one blank line, the last)', () => { proveRegistryText(git('show', `${HEAD}:${REGISTRY}`)); proveEnv(git('show', `${HEAD}:.env.example`)) })
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); proveRegistryText(git('show', `${GATE}:${REGISTRY}`)); proveEnv(git('show', `${GATE}:.env.example`))
  for (const rel of AVATAR_SPAWN_PIN_FILES) assert.equal(stripAvatarSpawn(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `the merged tree, without this change's taught line, is dev's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avs-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
const scopeBreakers = {
  'a stray file in an own commit': () => { const stray = commitWith(HEAD, { 'stray-avatar-spawn.txt': 'stray\n' }, `${AVATAR_SPAWN_SUBJECT} a stray file${TRAILER}`); assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); scopeCommittedFiles(stray) },
  'an own commit without the co-author line': () => { const c = commitWith(HEAD, {}, `${AVATAR_SPAWN_SUBJECT} no trailer`); assert.throws(() => scopeOwnCommits(c), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named'); scopeOwnCommits(c) },
}
const SNEAKY_FILES = ['components/layout/studio-rail.tsx', VCALL, 'hooks/use-studio-voice-call.ts', 'lib/studio-voice-call-ui.ts', 'app/api/account/route.ts', 'app/(app)/usage/page.tsx', 'scripts/test-studio-voice-call-replay.mjs']
await scopeCheck('scope: a stray file in an own commit fails the files check, an own commit without the co-author line is named, and a line added to any existing app file (the rail, the call hook, the picker lib, the account route, the Usage page: the DRAFT files; another voice-call proof) fails it, an edit of FRONTEND-1\'s voice-call proof fails it (dev has their four lines now: the lane guard refuses it too, with no exemption); a real own commit set still passes', () => {
  assert.throws(scopeBreakers['a stray file in an own commit'], /exactly its scope/); assert.throws(scopeBreakers['an own commit without the co-author line'], error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of SNEAKY_FILES) {
    const foreign = commitWith(HEAD, { [rel]: `${git('show', `${HEAD}:${rel}`)}\n// AVATAR-SPAWN: a draft line applied\n` }, `${AVATAR_SPAWN_SUBJECT} touches ${rel}${TRAILER}`)
    assert.notEqual(git('show', `${foreign}:${rel}`), git('show', `${HEAD}:${rel}`), `positive control: ${rel} is changed`); assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched|lane|new files only/, rel)
  }
  assert.throws(() => scopeCommittedFiles(commitWith(HEAD, { [VCALL]: `${git('show', `${HEAD}:${VCALL}`)}// a fifth line\n` }, `${AVATAR_SPAWN_SUBJECT} a line in the voice-call proof${TRAILER}`)), /exactly its scope/, 'any line in the voice-call proof')
  assert.doesNotThrow(() => assertLanes(new Set(AVATAR_SPAWN_SCOPE_FILES)), 'this change\'s own files pass the lane guard'); for (const rel of [VCALL, 'scripts/test-studio-voice-call-replay.mjs', 'scripts/test-studio-voice-call-mutants-2.mjs', 'scripts/test-studio-billing-usage.mjs']) assert.throws(() => assertLanes(new Set([...AVATAR_SPAWN_SCOPE_FILES, rel])), /lane/, `${rel}: refused, no FRONTEND-1 file is exempt`)
  scopeAll(HEAD)
})

// ===== L. robust after merge, and a linear stack ====================================================================================================
console.log('L. robust after merge; a linear stack')
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const SYN_FILTER = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`
const SYN_FILES = "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_SCOPE_FILES, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const SYN_ENV = "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_ENV_BLOCK, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const SYN_STRIP = "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLater, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const after = (lines, needle, line) => { const at = lines.findIndex(l => l.includes(needle)); assert.ok(at > 0, `${needle} is there`); lines.splice(at + 1, 0, line); return lines }
/** A later change stacked after this one: its subject filter beside this one's in a taught proof (and, with `registryLines`, its three registered-shape lines below ours in the registry). */
const laterCommit = (onto, { registryLines = false, extra = {} } = {}) => {
  const edits = { [SYN.file]: after(git('show', `${onto}:${SYN.file}`).split('\n'), 'registry read (AVATAR-SPAWN)', SYN_FILTER).join('\n'), ...extra }
  if (registryLines) edits[REGISTRY] = after(after(after(git('show', `${onto}:${REGISTRY}`).split('\n'), ').AVATAR_SPAWN_SCOPE_FILES, // LATER-CHANGE:', SYN_FILES), ').AVATAR_SPAWN_ENV_BLOCK, // LATER-CHANGE:', SYN_ENV), ').stripAvatarSpawn, // LATER-CHANGE:', SYN_STRIP).join('\n')
  return commitWith(onto, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const synLater = (rel, text) => synStrip(rel, laterStrips(rel, text))
await check('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, the scope stands down there, and the pins, read past the later change\'s strip, still pass', () => {
  const dev = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : HEAD, later = laterCommit(dev), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there (by the second parent)'); if (ON_OWN_LINE) assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line: the scope checks stand down there')
  proveStrip(stripAvatarSpawn, readAt, synLater, 'stacked after')
  assert.throws(() => proveStrip(stripAvatarSpawn, readAt, laterStrips, 'stacked after, not told'), /put back it is the base's|exactly the taught lines|exactly once|one taught line|no second filter/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})
await scopeCheck('LINEAR STACK: a later change directly on this head (registered-shape registry lines below ours in each list, a subject-filter line beside ours in a taught proof, removed by its own strip passed into laterStrips): this change\'s own commits are still on the first-parent line, the scope still passes, the registry check leaves its lines to it, and the pins pass', () => {
  const later = laterCommit(HEAD, { registryLines: true }), readAt = rel => git('show', `${later}:${rel}`)
  assert.deepEqual(parentsOf(later), [HEAD]); assert.equal(ownOnLine(later).length, ownOnLine(HEAD).length, 'this change\'s commits are on the first-parent line of the later head: the scope checks RUN there')
  assert.equal(scopeHead(later), later); scopeAll(later, { later: synLater }); proveStrip(stripAvatarSpawn, readAt, synLater, 'linear stack')
  assert.throws(() => proveRegistryText(after(git('show', `${later}:${REGISTRY}`).split('\n'), ').stripSyntheticLater, // LATER-CHANGE:', "  (await import('./studio-x-strip.mjs')).stripXToo, // stray: not in the registered shape").join('\n')), /nothing else in the registry/, 'a registry line that is not in the registered shape is still counted')
  const gate = gateMerge(BASE_COMMIT, later); assert.equal(scopeHead(gate), later); scopeAll(scopeHead(gate), { later: synLater })
})
await scopeCheck('LINEAR STACK: an unregistered file in the later commit still fails the whole-diff check; the same file once the registry names it (a later change\'s own file) is left to its change', () => {
  const stray = laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } })
  assert.throws(() => scopeCommittedFiles(stray, { later: synLater }), /nothing else/, 'an unregistered file fails')
  assert.doesNotThrow(() => scopeCommittedFiles(stray, { later: synLater, registered: new Set([...registry.LATER_CHANGE_FILES, 'stray-later-change.txt']) }), 'a registered one is that change\'s')
  const straySubject = commitWith(HEAD, { 'stray-later-change.txt': 'stray\n' }, `Proofs after merge: an unregistered file${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(straySubject), /nothing else/, 'a later commit with another subject that touches a file the registry does not name still fails')
})

// ===== M. mutants (each one edit of the real sources, fed to the same checks) ======================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const AREAS = {
  flag: t => proveFlag(t), leaks: t => proveNoLeaks(t), route: t => proveRoute(t), consent: t => proveConsent(t), consentClient: t => proveConsentClient(t), stages: t => proveStages(t), privacy: t => provePrivacy(t), hold: t => provePhotoHold(t), pick: t => provePickDiscards(t),
  ids: t => proveIds(t), del: t => proveDelete(t), half: t => proveHalfFailingStorage(t), refusal: t => proveRefusal(t), resolve: t => proveResolve(t), fallback: t => proveFallback(t), steps: t => proveSteps(t), container: t => proveContainer(t),
}
/** One edit of one real source (`from` must be there exactly once), fed to the named checks in turn: caught when any of them fails an assertion. */
const BEHAVIOUR = [
  // the flag, the route, the components
  ['flag: "1" is read as on', LIB, "process.env.NEXT_PUBLIC_STUDIO_AVATAR_SPAWN === 'true'", "(process.env.NEXT_PUBLIC_STUDIO_AVATAR_SPAWN === 'true' || process.env.NEXT_PUBLIC_STUDIO_AVATAR_SPAWN === '1')", 'flag'],
  ['flag: the Studio shell is not required', LIB, "process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && ", '', 'flag'],
  ['flag off: the route does not call notFound()', PAGE, '  if (!STUDIO_AVATAR_SPAWN_ENABLED) notFound()\n', '', 'route'],
  ['flag off: the component draws', APP, '  if (!STUDIO_AVATAR_SPAWN_ENABLED) return null\n', '', 'route'],
  // consent
  ['consent: the check is skipped in the page (Continue enabled with items unticked)', STEPS, 'disabled={!all || !!busy}', 'disabled={!!busy}', 'consent', 'container'],
  ['consent: three of four items are enough', LIB, 'return CONSENT_ITEMS.every(item => ticked.includes(item.id))', 'return CONSENT_ITEMS.slice(0, 3).every(item => ticked.includes(item.id))', 'consent'],
  ['consent: every set counts as ticked', LIB, 'return CONSENT_ITEMS.every(item => ticked.includes(item.id))', 'return true', 'consent', 'container'],
  ['consent: the client skips the check (a job without consent)', LIB, "    if (!consentComplete(consent)) throw new Error('consent_incomplete')\n", '', 'consentClient'],
  // the photo
  ['photo persisted: the photo is written to storage at upload', LIB, '    // Only the size and the type are looked at. The bytes are never read, kept or sent.\n', "    // Only the size and the type are looked at. The bytes are never read, kept or sent.\n    if (this.storage) this.storage.setItem('deckster.studio.avatarSpawn.photo', 'data:image/jpeg;base64,' + JSON.stringify(file))\n", 'privacy'],
  ['photo read: the client reads the photo\'s bytes', LIB, '    // Only the size and the type are looked at. The bytes are never read, kept or sent.\n', '    try { await (file as unknown as Blob).arrayBuffer() } catch { /* ignored */ }\n', 'privacy'],
  ['photo persisted: a preview address is stored with the entry', LIB, 'createdAt: e.createdAt }))', "createdAt: e.createdAt, preview: 'data:image/png;base64,AAAA' }))", 'privacy'],
  ['photo kept: an entry read back keeps its extra fields', LIB, 'return { id: v.id, displayName: name, packBaseUrl: base, owner: { app: owner.app, tenantId: owner.tenantId, userId }, createdAt: v.createdAt }', 'return { ...v, id: v.id } as unknown as StoredCompanionEntry', 'privacy'],
  ['photo kept: picking does not let go of it', LIB, '  hold.discard()\n  return client.pickMaster(jobId, candidateId)', '  return client.pickMaster(jobId, candidateId)', 'pick', 'container'],
  ['photo kept: it is let go of AFTER the pick', LIB, '  hold.discard()\n  return client.pickMaster(jobId, candidateId)', '  const next = client.pickMaster(jobId, candidateId)\n  hold.discard()\n  return next', 'pick'],
  ['photo kept: the page calls pickMaster itself (no discard)', APP, 'setJob(await pickAndDiscard(client, hold(), job.id, selectedId))', 'setJob(await client.pickMaster(job.id, selectedId))', 'container'],
  ['photo kept: a refused job keeps it', APP, "if (next.stage === 'refused') { hold().discard(); setPreviewUrl(null); setHasFile(false) }", "if (next.stage === 'refused') { setPreviewUrl(null); setHasFile(false) }", 'container'],
  ['photo kept: leaving the page keeps it', APP, 'useEffect(() => () => holdRef.current?.discard(), [])', 'useEffect(() => () => undefined, [])', 'container'],
  ['photo kept: cancel keeps it', APP, '  const reset = () => {\n    hold().discard()\n', '  const reset = () => {\n', 'container'],
  ['photo kept: discard() does not revoke the preview', LIB, 'if (url && this.urls) { try { this.urls.revokeObjectURL(url) } catch { /* nothing to release */ } }', '', 'hold'],
  ['photo: the page reads it with a FileReader', APP, 'onFile={file => { setPreviewUrl(hold().hold(file)); setHasFile(true) }}', 'onFile={file => { new FileReader().readAsDataURL(file); setPreviewUrl(hold().hold(file)); setHasFile(true) }}', 'leaks'],
  ['photo: the page writes to localStorage', APP, '  const refresh = () =>', "  const stash = () => localStorage.setItem('p', String(previewUrl))\n  const refresh = () =>", 'leaks'],
  ['no network: the page fetches', APP, '    const timer = setInterval(() => {', "    void fetch('/api/studio/companions')\n    const timer = setInterval(() => {", 'leaks'],
  ['logs: the client logs the photo', LIB, '    const size = Number(file?.size), type', '    console.log(file)\n    const size = Number(file?.size), type', 'leaks'],
  ['logs: a step logs a name', STEPS, 'onClick={() => onAskDelete(entry.id)}', 'onClick={() => { console.log(entry.displayName); onAskDelete(entry.id) }}', 'leaks'],
  // ids
  ['id: derived from the name', LIB, 'const entry: StoredCompanionEntry = { id: job.packId,', "const entry: StoredCompanionEntry = { id: 'u-' + name.toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(26, 'x').slice(0, 26),", 'ids'],
  ['id: 25 characters', LIB, 'return `u-${randomChars(26, random)}`', 'return `u-${randomChars(25, random)}`', 'ids'],
  ['id: upper-case letters in the alphabet', LIB, "const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'", "const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'", 'ids'],
  ['registry: the key has no user id', LIB, 'export const registryKey = (userId: string): string => `${REGISTRY_KEY_PREFIX}${userId}`', 'export const registryKey = (userId: string): string => REGISTRY_KEY_PREFIX', 'privacy', 'del'],
  ['registry: another user\'s entry is accepted', LIB, ' || owner.userId !== userId', '', 'del'],
  ['registry: a read is not inside try/catch', LIB, ': []\n  } catch { return null }\n}\n/** Writes', ': []\n  } finally { /* none */ }\n}\n/** Writes', 'del'],
  // delete
  ['delete: does not remove the entry', LIB, '    if (kept.length !== entries.length) this.save(kept)\n', '', 'del'],
  ['delete: removes every entry', LIB, 'kept = entries.filter(e => e.id !== packId)', 'kept = entries.filter(() => false)', 'del'],
  ['delete: without a confirm', STEPS, 'onClick={() => onAskDelete(entry.id)}', 'onClick={() => onConfirmDelete(entry.id)}', 'container'],
  ['delete: the notice does not say the pack and previews are deleted', LIB, "} The companion's pack and its previews are deleted.`", '}`', 'steps', 'container'],
  ['pick: does not mark the chosen companion', APP, 'onChoose={id => { setChosenId(id); setNotice(null) }}', 'onChoose={() => { setNotice(null) }}', 'container'],
  // refusal
  ['refusal: the screen offers a Continue', STEPS, '<button type="button" className="sas-secondary" onClick={onBack}>Back to my companions</button>', '<button type="button" className="sas-primary" onClick={onBack}>Continue</button><button type="button" className="sas-secondary" onClick={onBack}>Back to my companions</button>', 'refusal'],
  ['refusal: two codes share one message', LIB, "public_figure: 'We cannot make a companion that looks like a well-known public figure or an existing character.',", "public_figure: 'We could not make a good likeness from this photo. A bright, in-focus, front-on photo with only you in it works best.',", 'refusal'],
  ['refusal: the raw code is shown', STEPS, '<p data-sas-part="refusal-message">{REFUSAL_MESSAGES[code]}</p>', '<p data-sas-part="refusal-message">{code}: {REFUSAL_MESSAGES[code]}</p>', 'refusal'],
  ['refusal: the client never refuses', LIB, "      if (job.refuseWith) { job.stage = 'refused'; job.refusal = job.refuseWith; job.progress = 0; return }\n", '', 'refusal'],
  ['refusal: a refused job can still be picked', LIB, "    if (job.stage !== 'pick') throw new Error('wrong_stage')\n", '', 'stages'],
  // stages
  ['stages: three candidates', LIB, "  { id: 'c4', label: 'Option 4', previewUrl: '/companions/maya/portrait-256.webp' },\n", '', 'stages'],
  ['stages: a candidate that is not committed', LIB, "{ id: 'c1', label: 'Option 1', previewUrl: '/companions/maya/portrait-512.webp' }", "{ id: 'c1', label: 'Option 1', previewUrl: '/companions/maya/portrait-999.webp' }", 'stages'],
  ['stages: a client without a user', LIB, "    if (typeof options.userId !== 'string' || options.userId === '') throw new Error('user_required')\n", '', 'stages'],
  ['steps: Save companion enabled with no name', STEPS, 'disabled={cleanDisplayName(name) === null || !!busy}', 'disabled={!!busy}', 'steps'],
  // resolve and fallback
  ['resolve: ".." climbs out of the base', LIB, "if (part === '..') { if (kept.length === 0) return null; kept.pop(); continue }", "if (part === '..') { kept.pop(); continue }", 'resolve'],
  ['resolve: a percent gets through', LIB, String.raw`/[\u0000-\u001f\u007f\\?#%]/.test(manifestRelativePath)`, String.raw`/[\u0000-\u001f\u007f\\?#]/.test(manifestRelativePath)`, 'resolve'],
  ['resolve: a scheme gets through', LIB, ' || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(manifestRelativePath)', '', 'resolve'],
  ['resolve: a base with ".." is accepted', LIB, "  if (value.split('/').includes('..')) return null\n", '', 'resolve'],
  ['fallback: the portrait before the pack', LIB, "  if (manifest && portrait) chain.push({ kind: 'pack', url: manifest, still: portrait })\n  if (portrait) chain.push({ kind: 'portrait', url: portrait, still: portrait })\n", "  if (portrait) chain.push({ kind: 'portrait', url: portrait, still: portrait })\n  if (manifest && portrait) chain.push({ kind: 'pack', url: manifest, still: portrait })\n", 'fallback'],
  ['fallback: Felix first', LIB, "chain.push({ kind: 'felix'", "chain.unshift({ kind: 'felix'", 'fallback'],
  ['fallback: nothing loads, not Felix', LIB, 'return chain[chain.length - 1]', 'return chain[0]', 'fallback'],
  ['fallback: a thumbnail does not step to the next picture', STEPS, ' onError={() => setAt(current => Math.min(current + 1, stills.length - 1))}', '', 'fallback'],
  ['thumb: the picture is fetched with a referrer', STEPS, ' referrerPolicy="no-referrer"', '', 'fallback'],
  // storage that reads but cannot write: each half of the fix, alone (the old behaviour is both)
  ['storage: entries() ignores memory after a failed write (a save shows an empty list; a delete comes back)', LIB, '    if (this.memoryOnly) return this.memory\n', '', 'half'],
  ['storage: a failed write is not remembered (the session stays on storage)', LIB, 'if (!writeRegistry(this.storage, this.userId, entries)) this.memoryOnly = true', 'writeRegistry(this.storage, this.userId, entries)', 'half'],
  ['storage: the switch to memory drops the entries it had read (only the newest survives)', LIB, '    if (this.memoryOnly) return this.memory\n', '    if (this.memoryOnly) return this.memory.slice(-1)\n', 'half'],
]
for (const [label, rel, from, to, ...areas] of BEHAVIOUR) {
  await mutant(label, async () => { const texts = { [rel]: swap(read(rel), from, to) }; for (const area of areas) await AREAS[area](texts) })
}
await mutant('storage: the OLD behaviour (a failed write is ignored and entries() reads storage only): reads work, writes throw, and the list is wrong', async () => {
  const texts = { [LIB]: swap(swap(read(LIB), '    if (this.memoryOnly) return this.memory\n', ''), 'if (!writeRegistry(this.storage, this.userId, entries)) this.memoryOnly = true', 'writeRegistry(this.storage, this.userId, entries)') }
  const passed = []
  for (const part of ['save', 'delete', 'page']) { try { await proveHalfFailingStorage(texts, part); passed.push(part) } catch (error) { if (error?.code !== 'ERR_ASSERTION') throw error } }
  if (passed.length) throw new Error(`the old behaviour passed the ${passed.join(', ')} case`)
  assert.fail('the old behaviour fails the save case, the delete case and the page case, each alone')
})
await mutant('styling: a new colour', () => proveCss(swap(read(CSS), '--sas-danger: var(--sa-danger, #b03f35);', '--sas-danger: var(--sa-danger, #ff00aa);')))
await mutant('styling: a gradient', () => proveCss(swap(read(CSS), '.sas-fill { height: 100%; border-radius: 999px; background: var(--sas-teal); }', '.sas-fill { height: 100%; border-radius: 999px; background: linear-gradient(var(--sas-teal), var(--sas-line)); }')))
await mutant('styling: the purple accent token', () => proveCss(swap(read(CSS), '--sas-teal: var(--ss-teal, #1f6f72);', '--sas-teal: var(--ss-accent, #1f6f72);')))

// the strip, the registry, the env block
const REG_NOW = read(REGISTRY), regLinesOf = text => text.split('\n')
const PIN0 = AVATAR_SPAWN_PIN_FILES[0], PIN1 = AVATAR_SPAWN_PIN_FILES[1]
await mutant('strip: a strip that leaves a line (a taught proof is not put back)', () => proveStrip((rel, text) => (rel === PIN0 ? text : stripAvatarSpawn(rel, text))))
await mutant('strip: a strip that is not idempotent (it takes one more line away each time)', () => proveStrip((rel, text) => { const out = stripAvatarSpawn(rel, text); return rel === PIN1 && out === text ? out.replace(/^import [^\n]*\n/m, '') : out }))
await mutant('lanes: another voice-call proof that was NOT OK\'d is touched (the replay proof): the lane guard refuses it', () => assertLanes(new Set([...AVATAR_SPAWN_SCOPE_FILES, 'scripts/test-studio-voice-call-replay.mjs'])))
await mutant('lanes: FRONTEND-1\'s voice-call proof itself is touched (dev has its four lines now; no exemption): the lane guard refuses it', () => assertLanes(new Set([...AVATAR_SPAWN_SCOPE_FILES, VCALL])))
await mutant('strip: a strip that edits a file it does not own', () => proveStrip((rel, text) => (rel === 'app/builder/page.tsx' ? `${text}x` : stripAvatarSpawn(rel, text))))
await mutant('strip: a strip that takes the base\'s own filter too', () => proveStrip((rel, text) => stripAvatarSpawn(rel, text).replace(/^ {2}shas\.splice[^\n]*Chat caps:[^\n]*\n/m, '')))
await mutant('strip: a taught proof keeps a second, unmarked line', () => proveStrip(stripAvatarSpawn, rel => (rel === PIN0 ? read(rel).replace(AVATAR_SPAWN_PIN_EDITS[rel][0][0], `${AVATAR_SPAWN_PIN_EDITS[rel][0][0]}  // stray\n`) : read(rel))))
await mutant('strip: a taught line without the registry-read mark', () => proveStrip(stripAvatarSpawn, rel => (rel === PIN1 ? swap(read(rel), 'registry read (AVATAR-SPAWN): on a branch', 'on a branch') : read(rel))))
await mutant('strip: a taught line that is not a subject filter for this change', () => proveStrip(stripAvatarSpawn, rel => (rel === PIN1 ? swap(read(rel), '!/^Avatar spawn mock:/', '!/^Avatar spawn:/') : read(rel))))
await mutant('strip: a taught line put somewhere that is not after the agent mode shell\'s filter', () => proveStrip(stripAvatarSpawn, rel => {
  if (rel !== PIN0) return read(rel)
  const lines = read(rel).split('\n'), at = lines.findIndex(l => l.includes(AVATAR_SPAWN_PIN_MARK)), [line] = lines.splice(at, 1); lines.splice(lines.findIndex(l => l.includes('registry read (CHAT-CAPS-META)')) + 1, 0, line); return lines.join('\n')
}))
await mutant('strip: a taught line moved ABOVE the agent mode shell\'s filter (directly above it)', () => { const lines = read(PIN0).split('\n'), at = lines.findIndex(l => l.includes(AVATAR_SPAWN_PIN_MARK)), [line] = lines.splice(at, 1); lines.splice(lines.findIndex(l => l.startsWith(AVATAR_SPAWN_PIN_AFTER)), 0, line); provePinOrder(PIN0, lines) })
await mutant('strip: a line that is not another change\'s registered subject filter between dev\'s filter and ours', () => { const lines = read(PIN1).split('\n'); lines.splice(lines.findIndex(l => l.startsWith(AVATAR_SPAWN_PIN_AFTER)) + 1, 0, "  shas.splice(0, 1) // stray, no filter"); provePinOrder(PIN1, lines) })
await mutant('strip: a subject filter without the registry-read mark between dev\'s filter and ours', () => { const lines = read(PIN0).split('\n'); lines.splice(lines.findIndex(l => l.startsWith(AVATAR_SPAWN_PIN_AFTER)) + 1, 0, EARLIER.line.replace(' // LATER-CHANGES: registry read (SYNTHETIC-EARLIER)', ' //')); provePinOrder(PIN0, lines) })
await mutant('strip: our filter line twice (a second copy after the first)', () => { const lines = read(PIN0).split('\n'), at = lines.findIndex(l => l.includes(AVATAR_SPAWN_PIN_MARK)); lines.splice(at + 1, 0, lines[at]); provePinOrder(PIN0, lines) })
await mutant('strip: the dev line it is taught after is missing (not there to be after)', () => provePinOrder(PIN0, read(PIN0).split('\n').filter(l => !l.startsWith(AVATAR_SPAWN_PIN_AFTER))))
await mutant('draft: a draft anchor that is not dev\'s line', () => proveStripData(AVATAR_SPAWN_DRAFT.map((d, i) => (i === 3 ? { ...d, anchor: 'import { studioNavLabels } from "@/lib/studio-nav-labels" ' } : d))))
await mutant('draft: a draft line without the marker', () => proveStripData(AVATAR_SPAWN_DRAFT.map((d, i) => (i === 0 ? { ...d, line: d.line.replace(' // AVATAR-SPAWN', ' //') } : d))))
await mutant('draft: a draft applied (its file is in the scope)', () => { const d = AVATAR_SPAWN_DRAFT[0]; assert.ok(!AVATAR_SPAWN_SCOPE_FILES.has(d.file), 'positive control: not in scope'); proveStripData(AVATAR_SPAWN_DRAFT.map((x, i) => (i === 0 ? { ...x, file: 'scripts/studio-later-changes.mjs', after: 1 } : x))) })
await mutant('registry: the files line above the voice call\'s (not the true end of its list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('SCOPE_FILES')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('registry: the env block line above the voice call\'s (ours must come after it)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('ENV_BLOCK')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('ENV_BLOCK')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('registry: the strip line moved to just above the voice call\'s (ours must come after it)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripAvatarSpawn')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('stripVoiceCall')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('registry: a line that is not another change\'s registered line between the voice call\'s and ours', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')); reg.splice(at, 0, "  ...(await import('./studio-x-strip.mjs')).X_SCOPE_FILES, // between: not registered"); proveRegistryText(reg.join('\n')) })
await mutant('registry: the strip line moved above the usage credits page\'s', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripAvatarSpawn')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-usage-credits-page-strip.mjs') && l.includes('stripUsageCreditsPage')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('registry: the strip line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('stripAvatarSpawn'))).join('\n')))
await mutant('registry: the env block line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('ENV_BLOCK'))).join('\n')))
await mutant('registry: the files line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('SCOPE_FILES'))).join('\n')))
await mutant('registry: a line of dev\'s registry lost', () => { const reg = regLinesOf(REG_NOW); reg.splice(reg.findIndex(l => l.includes('studio-chat-caps-strip.mjs') && l.includes('stripChatCaps')), 1); proveRegistryText(reg.join('\n')) })
await mutant('registry: a second files line (two lines in one list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')); reg.splice(at + 1, 0, reg[at]); proveRegistryText(reg.join('\n')) })
await mutant('registry: a registry line that is not in the registered shape below ours', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripAvatarSpawn')); reg.splice(at + 1, 0, "  (await import('./studio-x-strip.mjs')).stripX, // not registered"); proveRegistryText(reg.join('\n')) })
await mutant('registry: the env block line in the files list', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('ENV_BLOCK')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')) + 1, 0, line); proveRegistryText(reg.join('\n')) })
const ENV_NOW = read('.env.example')
await mutant('env: .env.example without the block', () => proveEnv(swap(ENV_NOW, `\n${AVATAR_SPAWN_ENV_BLOCK}`, '')))
await mutant('env: the flag documented as on', () => proveEnv(swap(ENV_NOW, 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN="false"', 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN="true"')))
await mutant('env: no blank line before the block', () => proveEnv(swap(ENV_NOW, `\n\n${AVATAR_SPAWN_ENV_BLOCK}`, `\n${AVATAR_SPAWN_ENV_BLOCK}`)))
await mutant('env: another line added to .env.example', () => proveEnv(`${ENV_NOW}NEXT_PUBLIC_STUDIO_SOMETHING_ELSE="false"\n`))
await mutant('env: a line of dev\'s .env.example lost', () => proveEnv(swap(ENV_NOW, 'NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS="c"\n', '')))
if (ON_OWN_LINE) {
  await mutant('scope: a stray file in an own commit', () => scopeBreakers['a stray file in an own commit']())
  await mutant('scope: an own commit without the co-author line', () => scopeBreakers['an own commit without the co-author line']())
  await mutant('scope: the old first-parent query (finds no own commit on the gate-style merge)', () => scopeOwnCommits(GATE, { firstParentOnly: true }))
  await mutant('scope: the HEAD^2 rule dropped (the scope runs against the merge itself)', () => { assert.equal(scopeHead(GATE, { gateRule: false }), HEAD, 'the scope head is the change\'s head') })
  await mutant('scope: a DRAFT line applied to the rail (an existing app file edited in an own commit)', () => scopeCommittedFiles(commitWith(HEAD, { 'components/layout/studio-rail.tsx': swap(git('show', `${HEAD}:components/layout/studio-rail.tsx`), 'import { studioNavLabels } from "@/lib/studio-nav-labels"\n', 'import { studioNavLabels } from "@/lib/studio-nav-labels"\nimport { STUDIO_AVATAR_SPAWN_ENABLED } from "@/lib/studio-avatar-spawn" // AVATAR-SPAWN\n') }, `${AVATAR_SPAWN_SUBJECT} applies a draft line${TRAILER}`)))
  await mutant('scope: a line added to FRONTEND-1\'s voice-call proof in an own commit (dev has its four lines; this change touches none of theirs)', () => scopeCommittedFiles(commitWith(HEAD, { [VCALL]: `${git('show', `${HEAD}:${VCALL}`)}// a fifth line\n` }, `${AVATAR_SPAWN_SUBJECT} a fifth voice-call line${TRAILER}`)))
  await mutant('scope: another FRONTEND-1 voice-call proof touched in an own commit (the replay proof was not OK\'d)', () => scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-voice-call-replay.mjs': `${git('show', `${HEAD}:scripts/test-studio-voice-call-replay.mjs`)}\n` }, `${AVATAR_SPAWN_SUBJECT} touches the replay proof${TRAILER}`)))
  await mutant('scope: a stray line in the Usage page in an own commit', () => scopeCommittedFiles(commitWith(HEAD, { 'app/(app)/usage/page.tsx': `${git('show', `${HEAD}:app/(app)/usage/page.tsx`)}\n` }, `${AVATAR_SPAWN_SUBJECT} edits the Usage page${TRAILER}`)))
  await mutant('scope: a later commit with an unregistered file stacked on this head', () => scopeCommittedFiles(laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } }), { later: synLater }))
  await mutant('scope: the later change\'s strip not told to the pins (its line breaks the put-back)', () => proveStrip(stripAvatarSpawn, rel => git('show', `${laterCommit(HEAD, { registryLines: true })}:${rel}`), laterStrips, 'linear stack, not told'))
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { for (const label of failed) console.error(`  failed: ${label}`); for (const label of missed) console.error(`  missed: ${label}`); process.exit(1) }
