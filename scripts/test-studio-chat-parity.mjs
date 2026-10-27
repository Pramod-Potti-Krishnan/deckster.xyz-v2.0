// FRONTEND-1 (P3-1 A chat parity, Studio half): proof of NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES / _THEMES / _IDENTITY / _TEMPLATES (the string "true", each default off, build-time).
//   lib/studio-chat-parity.ts (pure decisions: frames, caps, the request, the refusal, the result, notes_updated), lib/studio-chat-parity-runners.ts (owner check, executor, timeout),
//   marked lines in hooks/use-deckster-websocket-v2.ts, app/builder/page.tsx, components/slide-notes-panel.tsx and types/mdc.ts, the taught font-selection proof, and the .env.example block.
//
//   A. The lib, function by function, in THIS realm with a fake process (flag on / off / other strings).
//   B. The runners with a fake clock: unsupported, not the owner, the executor's own answer, a throw, a timeout; the THEMES executors with the click paths' functions faked.
//   C. The sources: every marked line is an insertion that carries the marker, stripping them gives the base's files byte for byte (and through the registry), the taught proof put back,
//      the gates, .env.example is the base plus the block, the registry gained its three lines, the committed diff is this change's files, no secrets.
//   D. MUTANTS: every one of them must be caught by A-C.
//
//   node scripts/test-studio-chat-parity.mjs
//
// Offline: no socket, fetch or timer of its own beyond fake timers in B; git is read only for C. Later changes stack on top of this one, so every source, diff and scope check reads THIS
// change's own newest commit (subject "Chat parity: ..."), not HEAD or the working tree.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-chat-parity-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const plain = value => JSON.parse(JSON.stringify(value))

const LIB = 'lib/studio-chat-parity.ts'
const RUNNERS = 'lib/studio-chat-parity-runners.ts'
const THEMES = 'lib/studio-chat-parity-themes.ts'
const IDENTITY = 'lib/studio-chat-parity-identity.ts'
const TEMPLATES = 'lib/studio-chat-parity-templates.ts'
const VIEWER = 'components/presentation-viewer.tsx'
const MASTER = 'components/presentation-settings-panel.tsx'
const COMPOSER = 'components/builder/chat-input.tsx'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const PAGE = 'app/builder/page.tsx'
const PANEL = 'components/slide-notes-panel.tsx'
const TYPES = 'types/mdc.ts'
const ENV = '.env.example'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const FONT_PROOF = 'scripts/test-theme-font-selection.mjs'
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', 'HEAD').trim() || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way)
const readOwn = rel => { if (!OWN) return read(rel); try { return git('show', `${OWN}:${rel}`) } catch { return read(rel) } }
const hasBase = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const baseOf = rel => git('show', `${strip.BASE_COMMIT}:${rel}`)

// ---- transpile a TS file into a bare function scope ---------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const ALL_ON = { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES: 'true' }
function loadLib(text = read(LIB), env = ALL_ON) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}
const FONTS = ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Lora']
/** lib/theme-fonts.ts and lib/theme-builder.ts, faked to their contracts (their own proofs cover them). */
function themeStubs(fontsOn = true) {
  const canonical = v => typeof v === 'string' ? FONTS.find(n => n.toLowerCase() === v.trim().toLowerCase()) : undefined
  const fields = sel => { const out = {}; if (!fontsOn || !sel) return out; for (const f of ['font_family', 'font_family_heading']) { const c = canonical(sel[f]); if (c) out[f] = c } return out }
  const withFonts = (sel, fonts) => { const { font_family: _a, font_family_heading: _b, ...rest } = sel; return { ...rest, ...fonts } }
  return {
    '@/lib/theme-fonts': {
      THEME_FONT_FAMILIES: FONTS, THEME_FONT_SELECTION_ENABLED: fontsOn,
      applyThemeFontPolicy: sel => { if (!sel || typeof sel !== 'object') return sel; if (!('font_family' in sel) && !('font_family_heading' in sel)) return sel; return withFonts(sel, fields(sel)) },
      setThemeFont: (sel, field, value) => { const cur = fields(sel); const fam = fontsOn ? canonical(value) : undefined; const next = {}; for (const n of ['font_family', 'font_family_heading']) { const c = n === field ? fam : cur[n]; if (c) next[n] = c } return withFonts(sel, next) },
    },
    '@/lib/theme-builder': { themeSelectionFingerprint: sel => JSON.stringify(sel) },
  }
}
function loadThemes(text = read(THEMES), lib = loadLib(), stubs = themeStubs()) {
  const module = { exports: {} }
  const require = name => { if (name === '@/lib/studio-chat-parity') return lib; if (stubs[name]) return stubs[name]; throw new Error(`unexpected import ${name}`) }
  new Function('module', 'exports', 'require', 'process', 'window', compile(text, THEMES))(module, module.exports, require, { env: {} }, globalThis.__chatParityWindow)
  return module.exports
}
/** lib/deck-identity.ts faked to its contract: a form in memory, the enabled flag. */
function identityStubs(enabled = true) {
  const store = { form: {} }
  const cleanLogoUrl = v => { if (typeof v !== 'string' || !v.trim()) return undefined; try { const u = new URL(v.trim()); if (u.protocol !== 'https:' || u.username || u.password) return undefined; return u.toString() } catch { return undefined } }
  return { store, '@/lib/deck-identity': { cleanLogoUrl, isDeckIdentityEnabled: () => enabled, readDeckIdentityForm: () => ({ ...store.form }), writeDeckIdentityForm: next => { const out = {}; for (const [k, v] of Object.entries(next ?? {})) if (typeof v === 'string' && v.trim()) out[k] = v.trim(); store.form = out; return { ...out } } } }
}
function loadIdentity(text = read(IDENTITY), lib = loadLib(), stubs = identityStubs()) {
  const module = { exports: {} }
  const require = name => { if (name === '@/lib/studio-chat-parity') return lib; if (stubs[name]) return stubs[name]; throw new Error(`unexpected import ${name}`) }
  new Function('module', 'exports', 'require', 'process', compile(text, IDENTITY))(module, module.exports, require, { env: {} })
  return module.exports
}
/** hooks/use-templates.ts faked to its contract: ready = blueprint_enrichment_status 'ready' with an llm method; optimizing as such. */
const templateStubs = { '@/hooks/use-templates': { templateGenerationStatus: t => !t ? 'needs_optimization' : t.blueprint_enrichment_status === 'ready' && t.blueprint_generation_method === 'llm' ? 'ready' : t.blueprint_enrichment_status === 'optimizing' ? 'optimizing' : t.blueprint_enrichment_status === 'failed' ? 'failed' : 'needs_optimization' } }
function loadTemplates(text = read(TEMPLATES), lib = loadLib()) {
  const module = { exports: {} }
  const require = name => { if (name === '@/lib/studio-chat-parity') return lib; if (templateStubs[name]) return templateStubs[name]; throw new Error(`unexpected import ${name}`) }
  new Function('module', 'exports', 'require', 'process', compile(text, TEMPLATES))(module, module.exports, require, { env: {} })
  return module.exports
}
function loadRunners(text = read(RUNNERS), lib = loadLib(), timers = null, themes = loadThemes(read(THEMES), lib), identity = loadIdentity(read(IDENTITY), lib), templates = loadTemplates(read(TEMPLATES), lib)) {
  const module = { exports: {} }
  const require = name => { if (name === '@/lib/studio-chat-parity') return lib; if (name === '@/lib/studio-chat-parity-themes') return themes; if (name === '@/lib/studio-chat-parity-identity') return identity; if (name === '@/lib/studio-chat-parity-templates') return templates; throw new Error(`unexpected import ${name}`) }
  const scope = timers ? { setTimeout: timers.set, clearTimeout: timers.clear } : { setTimeout, clearTimeout }
  new Function('module', 'exports', 'require', 'process', 'setTimeout', 'clearTimeout', compile(text, RUNNERS))(module, module.exports, require, { env: {} }, scope.setTimeout, scope.clearTimeout)
  return module.exports
}
/** A fake clock for B: timers fire only when advanced. */
function fakeTimers() {
  const pending = new Map(); let id = 0
  return {
    set: (fn, ms) => { const key = ++id; pending.set(key, { fn, at: ms }); return key },
    clear: key => { pending.delete(key) },
    fire: () => { for (const [key, timer] of [...pending]) { pending.delete(key); timer.fn() } },
    get count() { return pending.size },
  }
}

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- frames: one place -----------------------------------------------------------------------------------------------------------------
  eq({ ...lib.CHAT_PARITY_FRAMES }, { request: 'studio_action', result: 'studio_action_result' }, 'the frame names')
  ok(Object.isFrozen(lib.CHAT_PARITY_FRAMES), 'frozen')
  eq(lib.CHAT_PARITY_RESULT_ID_KEY, 'request_id', 'the result carries request_id')
  // -- flags -------------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['true', true]]) eq(lib.chatParityFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  const off = loadLib(libText, {})
  eq(off.STUDIO_CHAT_PARITY_THEMES_ENABLED, false, 'unset: themes off'); eq(off.STUDIO_CHAT_PARITY_ANY_ENABLED, false, 'unset: nothing on'); eq(off.CHAT_PARITY_CAPS, [], 'unset: no cap')
  eq(loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true' }).STUDIO_CHAT_PARITY_ANY_ENABLED, true, 'one on: any on')
  eq(loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'yes' }).CHAT_PARITY_CAPS, [], '"yes": off')
  eq(off.STUDIO_CHAT_PARITY_NOTES_ENABLED, undefined, 'no notes flag: rows 105 / 106 / 108 ride #522\'s single notes_updated path'); eq(Object.values({ ...lib.CHAT_PARITY_GROUP_CAPS }).includes('notes1'), false, 'notes1 is #522\'s cap, never ours (no duplicate in client_caps)')
  ok(Object.isFrozen(lib.CHAT_PARITY_FLAGS), 'the flags are frozen')
  // -- caps --------------------------------------------------------------------------------------------------------------------------------
  eq({ ...lib.CHAT_PARITY_GROUP_CAPS }, { themes: 'themes1', identity: 'identity1', templates: 'templates1' }, 'the group caps')
  eq(lib.chatParityCaps({ themes: true, identity: true, templates: true }), ['themes1', 'identity1', 'templates1'], 'all on: group order')
  eq(lib.chatParityCaps({ themes: true, identity: false, templates: true }), ['themes1', 'templates1'], 'two on')
  eq(lib.chatParityCaps({ themes: 1, identity: 'true', templates: false }), [], 'only boolean true counts')
  eq(lib.addChatParityCaps({ client_caps: ['mdc1', 'theme1', 'element_edit1', 'notes1'] }, ['themes1']), { client_caps: ['mdc1', 'theme1', 'element_edit1', 'notes1', 'themes1'] }, 'after the existing caps (#522\'s included)')
  eq(lib.addChatParityCaps({}, ['identity1', 'themes1']), { client_caps: ['identity1', 'themes1'] }, 'no caps yet')
  eq(lib.addChatParityCaps({ client_caps: ['themes1'] }, ['themes1']), { client_caps: ['themes1'] }, 'each once')
  eq(lib.addChatParityCaps({ client_caps: 'mdc1' }, ['themes1']), { client_caps: ['themes1'] }, 'a non-array is replaced')
  eq(lib.addChatParityCaps({ client_caps: ['mdc1', 7, null] }, ['themes1']), { client_caps: ['mdc1', 'themes1'] }, 'non-strings dropped')
  const data = { text: 'hi', client_caps: ['mdc1'] }; ok(lib.addChatParityCaps(data, ['themes1']) === data, 'in place'); eq(data.text, 'hi', 'other keys kept')
  // -- the request frame ------------------------------------------------------------------------------------------------------------------
  const frame = (payload, type = 'studio_action') => ({ type, message_id: 'm1', session_id: 's1', timestamp: 't', role: 'assistant', payload })
  ok(lib.isChatParityRequestFrame(frame({})), 'the type'); ok(!lib.isChatParityRequestFrame(frame({}, 'element_directive')), 'another type'); ok(!lib.isChatParityRequestFrame(null) && !lib.isChatParityRequestFrame('studio_action'), 'not an object')
  eq(lib.chatParityRequestId(frame({ request_id: 'sa_1' })), 'sa_1', 'the id'); eq(lib.chatParityRequestId(frame({ request_id: ' ' })), null, 'blank id'); eq(lib.chatParityRequestId(frame({})), null, 'no id'); eq(lib.chatParityRequestId({ type: 'studio_action' }), null, 'no payload')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_1', group: 'themes', action: 'x', presentation_id: 'p1', args: { a: 1 }, label: 'L' })), { requestId: 'sa_1', group: 'themes', action: 'x', presentationId: 'p1', args: { a: 1 }, label: 'L' }, 'a full request')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_2' })), { requestId: 'sa_2', group: '', action: '', presentationId: null, args: {}, label: '' }, 'a bare request still reads (answered honestly)')
  eq(lib.chatParityRequest(frame({ request_id: 'sa_3', args: [1], presentation_id: '', label: 4 })).args, {}, 'args must be an object'); eq(lib.chatParityRequest(frame({ request_id: 'sa_3', args: [1], presentation_id: '' })).presentationId, null, 'empty presentation = none')
  eq(lib.chatParityRequest(frame({})), null, 'no id: dropped'); eq(lib.chatParityRequest(frame({ request_id: 'x' }, 'deck_mutation')), null, 'another type: not ours')
  const args = { a: 1 }; ok(lib.chatParityRequest(frame({ request_id: 'sa', args })).args !== args, 'args are copied')
  // -- the refusal ------------------------------------------------------------------------------------------------------------------------
  const req = (group, action) => ({ requestId: 'r', group, action, presentationId: null, args: {}, label: '' })
  const flags = { themes: false, identity: true, templates: false }
  eq(lib.chatParityRefusal(req('themes', 'save_theme'), flags), 'flag_off', 'group off'); eq(lib.chatParityRefusal(req('nope', 'x'), flags), 'flag_off', 'unknown group'); eq(lib.chatParityRefusal(req('', ''), flags), 'flag_off', 'no group')
  eq(lib.chatParityRefusal(req('notes', 'set_speaker_notes'), { ...flags, themes: true }), 'flag_off', 'notes is not a group of ours (Director writes notes itself, #522 reflects them)')
  eq(lib.chatParityRefusal(req('identity', 'x'), { ...flags, identity: 'true' }), 'flag_off', 'only boolean true is on')
  eq(lib.chatParityRefusal(req('themes', 'nope'), { ...flags, themes: true }), 'unsupported', 'an action outside the group list')
  eq(Object.keys(lib.CHAT_PARITY_ACTIONS).sort(), ['identity', 'templates', 'themes'], 'every group has a list')
  // -- THEMES: the flag, the actions, the args --------------------------------------------------------------------------------------------
  const themesOnly = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true' })
  eq(themesOnly.STUDIO_CHAT_PARITY_THEMES_ENABLED, true, '"true": themes on'); eq(themesOnly.CHAT_PARITY_CAPS, ['themes1'], 'themes: themes1'); eq(themesOnly.CHAT_PARITY_FLAGS.identity, false, 'identity stays off')
  eq(lib.CHAT_PARITY_ACTIONS.themes, ['set_theme_fonts', 'save_theme', 'set_standard_theme', 'clear_standard_theme', 'rename_theme', 'apply_saved_theme'], 'rows 56 / 57 / 58 / 58 / 59 / 61')
  eq(lib.chatParityRefusal(req('themes', 'apply_saved_theme'), { ...flags, themes: true }), null, 'a theme action runs with the flag on')
  eq(lib.CHAT_PARITY_THEME_LIBRARY_EVENT, 'deckster:theme-library-changed'); eq(lib.CHAT_PARITY_THEME_NAME_MAX, 80)
  const targs = (action, args) => lib.chatParityThemeArgs(action, args, FONTS)
  eq(targs('set_theme_fonts', { font_family: ' lora ', font_family_heading: 'Playfair Display' }), { action: 'set_theme_fonts', font_family: 'Lora', font_family_heading: 'Playfair Display' }, 'fonts: canonical spelling, trimmed, case-insensitive')
  eq(targs('set_theme_fonts', { font_family_heading: 'Inter' }), { action: 'set_theme_fonts', font_family_heading: 'Inter' }, 'one font')
  eq(targs('set_theme_fonts', { font_family: 'Inter', font_family_heading: null }), { action: 'set_theme_fonts', font_family: 'Inter' }, 'null = not given')
  eq(targs('set_theme_fonts', {}), null, 'no font'); eq(targs('set_theme_fonts', { font_family: 'Comic Sans' }), null, 'an unknown family'); eq(targs('set_theme_fonts', { font_family: 'Inter', font_family_heading: 'Comic Sans' }), null, 'one unknown spoils it'); eq(targs('set_theme_fonts', { font_family: 7 }), null, 'not a string')
  eq(targs('save_theme', { name: '  Q3   brand ' }), { action: 'save_theme', name: 'Q3 brand', set_standard: false }, 'save: the name, spaces collapsed')
  eq(targs('save_theme', { name: 'x', set_standard: true }), { action: 'save_theme', name: 'x', set_standard: true }, 'save as standard'); eq(targs('save_theme', { name: 'x', set_standard: 'true' }), { action: 'save_theme', name: 'x', set_standard: false }, 'only boolean true')
  eq(targs('save_theme', { name: ' ' }), null, 'blank name'); eq(targs('save_theme', { name: 'a'.repeat(81) }), null, 'too long'); eq(targs('save_theme', {}), null, 'no name')
  eq(targs('set_standard_theme', { theme_id: ' t1 ' }), { action: 'set_standard_theme', theme_id: 't1' }, 'standard: the id'); eq(targs('set_standard_theme', { theme_id: '' }), null, 'no id'); eq(targs('set_standard_theme', { name: 'Blue' }), null, 'a name is never enough')
  eq(targs('clear_standard_theme', { anything: 1 }), { action: 'clear_standard_theme' }, 'clear: no args')
  eq(targs('rename_theme', { theme_id: 't1', name: 'New' }), { action: 'rename_theme', theme_id: 't1', name: 'New' }, 'rename'); eq(targs('rename_theme', { theme_id: 't1' }), null, 'rename needs a name'); eq(targs('rename_theme', { name: 'x' }), null, 'rename needs an id')
  eq(targs('apply_saved_theme', { theme_id: 't1' }), { action: 'apply_saved_theme', theme_id: 't1' }, 'apply'); eq(targs('apply_saved_theme', {}), null, 'apply needs an id')
  eq(targs('delete_theme', { theme_id: 't1' }), null, 'row 60 is declined: no delete action'); eq(targs('nope', {}), null, 'unknown action')
  // -- IDENTITY: the flag, the sub-flag, the actions, the args, the Master op -------------------------------------------------------------
  const identityOnly = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY: 'true' })
  eq(identityOnly.STUDIO_CHAT_PARITY_IDENTITY_ENABLED, true, '"true": identity on'); eq(identityOnly.CHAT_PARITY_CAPS, ['identity1'], 'identity: identity1'); eq(identityOnly.STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED, false, 'the paid sub-flag stays off')
  eq(loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO: 'true' }).STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED, false, 'the sub-flag alone is nothing (its group is off)')
  const paid = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO: 'true' }); eq(paid.STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED, true, 'both on: paid logo on')
  eq(lib.CHAT_PARITY_ACTIONS.identity, ['set_footer', 'clear_footer', 'set_logo', 'generate_logo', 'remove_logo', 'set_deck_identity'], 'rows 62 / 62 / 63 / 63 / 63 / 64')
  eq(lib.chatParityPaidBlocked('generate_logo', { generate_logo: false }), true, 'paid, sub-flag off: blocked'); eq(lib.chatParityPaidBlocked('generate_logo', { generate_logo: true }), false, 'paid, on'); eq(lib.chatParityPaidBlocked('set_footer', { generate_logo: false }), false, 'not paid')
  eq(identityOnly.CHAT_PARITY_PAID_ACTIONS.generate_logo, false, 'this build: the generate is blocked'); eq(paid.CHAT_PARITY_PAID_ACTIONS.generate_logo, true)
  const iargs = (action, args) => lib.chatParityIdentityArgs(action, args)
  eq(iargs('set_footer', { title: ' Q3  review ', author: 'PK' }), { action: 'set_footer', title: 'Q3 review', author: 'PK' }, 'footer: the given fields, one line each')
  eq(iargs('set_footer', { template: '{title} | Page {page}' }), { action: 'set_footer', template: '{title} | Page {page}' }, 'footer: a template'); eq(iargs('set_footer', {}), null, 'footer: nothing'); eq(iargs('set_footer', { title: 'a'.repeat(121) }), null, 'footer: too long'); eq(iargs('set_footer', { title: 7 }), null, 'footer: not text'); eq(iargs('set_footer', { title: 'x', date: null }), { action: 'set_footer', title: 'x' }, 'null = not given')
  eq(iargs('clear_footer', { anything: 1 }), { action: 'clear_footer' }); eq(iargs('remove_logo', {}), { action: 'remove_logo' })
  eq(iargs('set_logo', { image_url: ' https://x.example/logo.png ' }), { action: 'set_logo', image_url: 'https://x.example/logo.png' }, 'logo: an https URL'); eq(iargs('set_logo', { image_url: 'https://x.example/l.png', alt_text: 'Acme' }), { action: 'set_logo', image_url: 'https://x.example/l.png', alt_text: 'Acme' })
  for (const bad of ['http://x.example/l.png', 'data:image/png;base64,AAAA', 'ftp://x', 'logo.png', 'https://x.example/a b', '']) eq(iargs('set_logo', { image_url: bad }), null, `logo: refused ${bad.slice(0, 20)}`)
  eq(iargs('generate_logo', { prompt: ' a blue  owl ' }), { action: 'generate_logo', prompt: 'a blue owl' }, 'generate: the prompt'); eq(iargs('generate_logo', { prompt: '' }), null); eq(iargs('generate_logo', { prompt: 'a'.repeat(301) }), null, 'generate: too long')
  eq(iargs('set_deck_identity', { company: ' Acme ', confidentiality: 'Internal', logo_url: 'https://x.example/l.png' }), { action: 'set_deck_identity', company: 'Acme', confidentiality: 'Internal', logo_url: 'https://x.example/l.png' }, 'identity: the three fields')
  eq(iargs('set_deck_identity', { company: 'Acme' }), { action: 'set_deck_identity', company: 'Acme' }); eq(iargs('set_deck_identity', {}), null, 'identity: nothing'); eq(iargs('set_deck_identity', { logo_url: 'http://x' }), null, 'identity: a non-https logo'); eq(iargs('set_deck_identity', { company: 'a'.repeat(121) }), null, 'identity: too long')
  eq(iargs('upload_logo', { file: 'x' }), null, 'upload stays on the panel: no action')
  eq(lib.chatParityMasterOp(iargs('set_footer', { title: 'T', date: 'D' })), { kind: 'footer', title: 'T', date: 'D' }, 'the panel op: footer'); eq(lib.chatParityMasterOp(iargs('clear_footer', {})), { kind: 'clear_footer' }); eq(lib.chatParityMasterOp(iargs('remove_logo', {})), { kind: 'remove_logo' })
  eq(lib.chatParityMasterOp(iargs('set_logo', { image_url: 'https://x.example/l.png' })), { kind: 'logo', image_url: 'https://x.example/l.png' }); eq(lib.chatParityMasterOp(iargs('set_logo', { image_url: 'https://x.example/l.png', alt_text: 'A' })), { kind: 'logo', image_url: 'https://x.example/l.png', alt_text: 'A' })
  eq(lib.chatParityMasterOp(iargs('generate_logo', { prompt: 'owl' })), { kind: 'generate_logo', prompt: 'owl' }); eq(lib.chatParityMasterOp(iargs('set_deck_identity', { company: 'A' })), null, 'presenter details do not go through the panel')
  // -- TEMPLATES: the flag, the sub-flags, the actions, the args -----------------------------------------------------------------------
  const templatesOnly = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES: 'true' })
  eq(templatesOnly.STUDIO_CHAT_PARITY_TEMPLATES_ENABLED, true, '"true": templates on'); eq(templatesOnly.CHAT_PARITY_CAPS, ['templates1'], 'templates: templates1'); eq([templatesOnly.STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE_ENABLED, templatesOnly.STUDIO_CHAT_PARITY_PAID_OPTIMIZE_ENABLED], [false, false], 'the paid sub-flags stay off')
  eq(loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE: 'true' }).CHAT_PARITY_PAID_ACTIONS, { generate_logo: false, save_template: false, optimize_template: false }, 'sub-flags alone are nothing')
  const paidT = loadLib(libText, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE: 'true' }); eq(paidT.CHAT_PARITY_PAID_ACTIONS, { generate_logo: false, save_template: true, optimize_template: true }, 'both on: the two paid template actions on')
  eq(lib.CHAT_PARITY_ACTIONS.templates, ['select_template', 'composer_template_action', 'save_template', 'optimize_template', 'rename_template'], 'rows 65 / 67 / 70 / 75 / 76; 66 and 72 are not actions (no live click path)')
  eq(lib.chatParityRefusal(req('templates', 'template_start'), { ...flags, templates: true }), 'unsupported', 'row 66: unsupported, honestly'); eq(lib.chatParityRefusal(req('templates', 'apply_template'), { ...flags, templates: true }), 'unsupported', 'row 72: unsupported, honestly')
  eq(lib.CHAT_PARITY_TEMPLATE_NAME_MAX, 150); eq({ ...lib.CHAT_PARITY_COMPOSER_ACTIONS }, { use_original: 'use', rebuild: 'ditto', new_topic: 'new-topic' }, 'the library dialog\'s own action ids')
  const pargs = (action, args) => lib.chatParityTemplateArgs(action, args)
  eq(pargs('select_template', { template_id: ' t1 ' }), { action: 'select_template', template_id: 't1' }); eq(pargs('select_template', { name: 'Q3' }), null, 'a name is never enough')
  eq(pargs('composer_template_action', { template_id: 'c1', action: 'rebuild' }), { action: 'composer_template_action', template_id: 'c1', composer_action: 'ditto' }); eq(pargs('composer_template_action', { template_id: 'c1', action: 'delete' }), null, 'an unknown composer action'); eq(pargs('composer_template_action', { action: 'use_original' }), null, 'no id')
  eq(pargs('save_template', { name: '  Q3  deck ' }), { action: 'save_template', name: 'Q3 deck' }); eq(pargs('save_template', { name: 'a'.repeat(151) }), null, 'too long'); eq(pargs('save_template', {}), null)
  eq(pargs('optimize_template', { template_id: 't1' }), { action: 'optimize_template', template_id: 't1' }); eq(pargs('rename_template', { template_id: 't1', name: 'New' }), { action: 'rename_template', template_id: 't1', name: 'New' }); eq(pargs('rename_template', { template_id: 't1' }), null)
  eq(pargs('delete_template', { template_id: 't1' }), null, 'row 77 is declined: no delete action'); eq(pargs('template_start', { template_id: 't1', mode: 'as_is' }), null, 'row 66: no action')
  // -- the result -------------------------------------------------------------------------------------------------------------------------
  eq(lib.chatParityResult('sa_1', 'done'), { request_id: 'sa_1', status: 'done', error_code: null }, 'done')
  eq(lib.chatParityResult('sa_1', 'failed', 'not_owner'), { request_id: 'sa_1', status: 'failed', error_code: 'not_owner' }, 'failed + code')
  eq(lib.chatParityResult('sa_1', 'dismissed', 'not_owner'), { request_id: 'sa_1', status: 'dismissed', error_code: null }, 'a code only on failed')
  eq(lib.chatParityResult('sa_1', 'done', null, { theme_id: 't' }), { request_id: 'sa_1', status: 'done', error_code: null, detail: { theme_id: 't' } }, 'detail when given')
  eq(lib.chatParityResult('sa_1', 'done', null, {}), { request_id: 'sa_1', status: 'done', error_code: null }, 'an empty detail is left off')
  eq(lib.chatParityResultFrame(lib.chatParityResult('sa_1', 'done')), { type: 'studio_action_result', payload: { request_id: 'sa_1', status: 'done', error_code: null } }, 'the frame: data under payload')
  return lib
}

// ============================================================================================================================================
// B. The runners
// ============================================================================================================================================
async function runnersSuite(runnersText = read(RUNNERS), libText = read(LIB)) {
  const lib = loadLib(libText)
  const timers = fakeTimers()
  const runners = loadRunners(runnersText, lib, timers)
  eq(runners.CHAT_PARITY_DEFAULT_TIMEOUT_MS, 25_000, 'DIRECTOR-2: 25 s default')
  eq(plain(runners.CHAT_PARITY_EXECUTORS), {}, 'no executor until a group ships')
  const displayed = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  const owner = { sessionId: 's1', isCurrent: () => true }
  const deps = { displayed: () => displayed }
  const req = over => ({ requestId: 'r1', group: 'themes', action: 'act', presentationId: 'p1', args: {}, label: '', ...over })
  // the owner check
  const check = runners.chatParityOwnerCheck(req({}), { session_id: 's1' }, owner, deps.displayed)
  ok(check.ok && check.owns() && check.presentationId === 'p1', 'the owner: session, deck, epoch')
  ok(!runners.chatParityOwnerCheck(req({}), { session_id: 's2' }, owner, deps.displayed).ok, 'another session on the frame')
  ok(!runners.chatParityOwnerCheck(req({}), null, { sessionId: 's2', isCurrent: () => true }, deps.displayed).ok, 'another socket session')
  ok(!runners.chatParityOwnerCheck(req({ presentationId: 'p2' }), null, owner, deps.displayed).ok, 'another deck named')
  ok(runners.chatParityOwnerCheck(req({ presentationId: null }), null, owner, deps.displayed).ok, 'no deck named: a library action')
  ok(!runners.chatParityOwnerCheck(req({}), null, owner, () => ({ ...displayed, deckOwnerSessionId: 's0' })).ok, 'a deck another session owns')
  { let now = displayed; const c = runners.chatParityOwnerCheck(req({}), null, owner, () => now); now = { ...displayed, epoch: 2 }; ok(!c.owns(), 'owns() follows the screen') }
  // run: unsupported, not the owner, pass-through, throw, timeout
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'no executor: unsupported')
  lib.CHAT_PARITY_ACTIONS.themes.push('act')
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'listed but no executor: unsupported')
  runners.CHAT_PARITY_EXECUTORS.act = async (request, _owner, _deps, c) => lib.chatParityResult(request.requestId, c.owns() ? 'done' : 'failed', null, { seen: request.args.x })
  eq(await runners.runChatParityAction(req({ args: { x: 1 } }), owner, deps), { request_id: 'r1', status: 'done', error_code: null, detail: { seen: 1 } }, 'the executor\'s own answer')
  eq(await runners.runChatParityAction(req({ presentationId: 'p9' }), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'not_owner' }, 'not the owner: never run')
  eq(await runners.runChatParityAction(req({ group: 'identity' }), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'unsupported' }, 'an action under the wrong group')
  runners.CHAT_PARITY_EXECUTORS.act = async () => { throw new Error('boom') }
  eq(await runners.runChatParityAction(req({}), owner, deps), { request_id: 'r1', status: 'failed', error_code: 'write_failed' }, 'a throw: write_failed')
  eq(timers.count, 0, 'every timer cleared')
  runners.CHAT_PARITY_EXECUTORS.act = () => new Promise(() => {})
  const hung = runners.runChatParityAction(req({}), owner, deps)
  eq(timers.count, 1, 'one timer armed'); timers.fire()
  eq(await hung, { request_id: 'r1', status: 'failed', error_code: 'timeout' }, 'outlived its wait: timeout')
  runners.CHAT_PARITY_TIMEOUTS_MS.act = 60_000
  let armedMs = null; const t2 = fakeTimers(); const set = t2.set; t2.set = (fn, ms) => { armedMs = ms; return set(fn, ms) }
  const runners2 = loadRunners(runnersText, lib, t2); runners2.CHAT_PARITY_EXECUTORS.act = () => new Promise(() => {}); runners2.CHAT_PARITY_TIMEOUTS_MS.act = 60_000
  const hung2 = runners2.runChatParityAction(req({}), owner, deps); eq(armedMs, 60_000, 'a per-action wait'); t2.fire(); eq((await hung2).error_code, 'timeout')
  lib.CHAT_PARITY_ACTIONS.themes.pop()
  await themesSuite(runnersText, libText)
  await identitySuite(runnersText, libText)
  await templatesSuite(runnersText, libText)
}

/** The TEMPLATES executors against faked click-path functions. */
async function templatesSuite(runnersText = read(RUNNERS), libText = read(LIB), templatesText = read(TEMPLATES), paidOn = true) {
  const lib = loadLib(libText, { ...ALL_ON, NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE: paidOn ? 'true' : 'false', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE: paidOn ? 'true' : 'false' })
  const templates = loadTemplates(templatesText, lib)
  const runners = loadRunners(runnersText, lib, null, loadThemes(read(THEMES), lib), loadIdentity(read(IDENTITY), lib), templates)
  const library = [
    { id: 't1', name: 'Quarterly', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'ready', blueprint_enrichment_error: null, template_purity_status: 'pure', template_purity_error: null, extra: 'not a selection field' },
    { id: 't2', name: 'Draft', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'failed', blueprint_enrichment_error: 'x', template_purity_status: null, template_purity_error: null },
    { id: 't3', name: 'Busy', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'optimizing', blueprint_enrichment_error: null, template_purity_status: null, template_purity_error: null },
  ]
  const composerLibrary = [{ id: 'c1', name: 'Upload.pptx', slide_count: 9 }]
  const calls = []; let locked = false; let composerActions = ['use', 'ditto', 'new-topic']; let source = { sessionId: 's1', presentationId: 'p1' }; let renameAnswer = (id, name) => ({ ok: true, template: { id, name: name.toUpperCase() } })
  const deps = { displayed: () => ({ sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }), templates: {
    listTemplates: async () => { calls.push('list'); return { templates: library, count: library.length } },
    saveTemplate: async args => { calls.push(['save', args]); return args.name === 'refused' ? null : { id: 't9', name: args.name, slide_count: 5 } },
    reoptimizeTemplate: async id => { calls.push(['optimize', id]); return { ok: true } },
    renameTemplate: async (id, name) => { calls.push(['rename', id, name]); return renameAnswer(id, name) },
    select: template => { calls.push(['select', template]) }, selectionLocked: () => locked,
    composer: { list: async () => composerLibrary, run: request => { calls.push(['composer', request]) }, actions: () => composerActions },
    saveSource: () => source,
  } }
  const owner = { sessionId: 's1', isCurrent: () => true }
  const run = (action, args) => runners.runChatParityAction({ requestId: 'r', group: 'templates', action, presentationId: null, args, label: '' }, owner, deps, { session_id: 's1' })
  // select
  eq(await run('select_template', { template_id: 't1' }), { request_id: 'r', status: 'done', error_code: null, detail: { template_id: 't1', name: 'Quarterly' } }, 'select: done')
  eq(plain(calls.at(-1)), ['select', { id: 't1', name: 'Quarterly', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'ready', blueprint_enrichment_error: null, template_purity_status: 'pure', template_purity_error: null }], 'the picker\'s own selection record (its seven fields, nothing else)')
  eq(await run('select_template', { template_id: 't9' }), { request_id: 'r', status: 'failed', error_code: 'not_found' }, 'select: unknown id')
  locked = true; eq(await run('select_template', { template_id: 't1' }), { request_id: 'r', status: 'failed', error_code: 'locked' }, 'select: build selections locked'); locked = false
  // composer library action
  eq(await run('composer_template_action', { template_id: 'c1', action: 'rebuild' }), { request_id: 'r', status: 'done', error_code: null, detail: { template_id: 'c1', action: 'ditto' } }, 'composer: the dialog opened with the request'); eq(plain(calls.at(-1)), ['composer', { action: 'ditto', template: composerLibrary[0] }])
  eq(await run('composer_template_action', { template_id: 'c9', action: 'use_original' }), { request_id: 'r', status: 'failed', error_code: 'not_found' })
  composerActions = ['use']; eq(await run('composer_template_action', { template_id: 'c1', action: 'new_topic' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'an action the dialog\'s flags do not offer'); composerActions = ['use', 'ditto', 'new-topic']
  { const saved = deps.templates.composer; deps.templates.composer = null; eq(await run('composer_template_action', { template_id: 'c1', action: 'use_original' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'no composer library'); deps.templates.composer = saved }
  // rename
  eq(await run('rename_template', { template_id: 't1', name: 'Q3' }), { request_id: 'r', status: 'done', error_code: null, detail: { template_id: 't1', name: 'Q3' } }, 'rename: Director\'s spelling wins')
  eq(await run('rename_template', { template_id: 't9', name: 'x' }), { request_id: 'r', status: 'failed', error_code: 'not_found' })
  for (const [reason, code] of [['unavailable', 'flag_off'], ['gone', 'not_found'], ['taken', 'name_taken'], ['invalid', 'invalid_args'], ['sign_in', 'write_failed'], ['failed', 'write_failed']]) { renameAnswer = () => ({ ok: false, reason }); eq((await run('rename_template', { template_id: 't1', name: 'x' })).error_code, code, `rename refused: ${reason}`) }
  renameAnswer = (id, name) => ({ ok: true, template: { id, name } })
  // the paid pair
  const before = calls.length
  if (paidOn) {
    eq(await run('save_template', { name: 'Mine' }), { request_id: 'r', status: 'done', error_code: null, detail: { template_id: 't9', name: 'Mine' } }, 'save: the dialog\'s own save, no second confirm (the Director\'s cost card came first)'); eq(plain(calls.at(-1)), ['save', { name: 'Mine', sourceSessionId: 's1', sourcePresentationId: 'p1' }])
    eq(await run('save_template', { name: 'refused' }), { request_id: 'r', status: 'failed', error_code: 'write_failed' })
    source = { sessionId: 's1', presentationId: null }; eq(await run('save_template', { name: 'x' }), { request_id: 'r', status: 'failed', error_code: 'no_deck' }, 'save: no completed deck'); source = { sessionId: 's1', presentationId: 'p1' }
    eq(await run('optimize_template', { template_id: 't2' }), { request_id: 'r', status: 'done', error_code: null, detail: { template_id: 't2', name: 'Draft' } }, 'optimise: the page\'s own reoptimize'); eq(plain(calls.at(-1)), ['optimize', 't2'])
    eq(await run('optimize_template', { template_id: 't1' }), { request_id: 'r', status: 'failed', error_code: 'already_ready' }, 'optimise: already ready'); eq(await run('optimize_template', { template_id: 't3' }), { request_id: 'r', status: 'failed', error_code: 'already_ready' }, 'optimise: already optimising')
    eq(await run('optimize_template', { template_id: 't9' }), { request_id: 'r', status: 'failed', error_code: 'not_found' })
    library.push({ id: 't5', name: 'Upload.pptx', blueprint_generation_method: 'llm', blueprint_enrichment_status: 'failed', blueprint_enrichment_error: null, template_purity_status: null, template_purity_error: null, stage_template_summary: { slide_count: 9 } }); eq(await run('optimize_template', { template_id: 't5' }), { request_id: 'r', status: 'failed', error_code: 'composer_template' }, 'optimise: an uploaded (composer) template is refused, as the Templates page gates it'); library.pop()
  } else {
    eq(await run('save_template', { name: 'Mine' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'save: sub-flag off'); eq(await run('optimize_template', { template_id: 't2' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'optimise: sub-flag off'); eq(calls.length, before, 'nothing ran')
  }
  eq(await runners.runChatParityAction({ requestId: 'r', group: 'templates', action: 'select_template', presentationId: null, args: { template_id: 't1' }, label: '' }, owner, { displayed: deps.displayed }, null), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'no template deps: flag_off')
  eq(await run('template_start', { template_id: 't1', mode: 'as_is' }), { request_id: 'r', status: 'failed', error_code: 'unsupported' }, 'row 66 through the runner: unsupported'); eq(await run('apply_template', { template_id: 't1' }), { request_id: 'r', status: 'failed', error_code: 'unsupported' }, 'row 72: unsupported')
}

/** The IDENTITY executors against a faked bus (the viewer's opener and the Master panel's op runner) and a faked identity form. */
async function identitySuite(runnersText = read(RUNNERS), libText = read(LIB), identityText = read(IDENTITY), paidOn = true, deckIdentityOn = true) {
  const lib = loadLib(libText, { ...ALL_ON, NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO: paidOn ? 'true' : 'false' })
  const stubs = identityStubs(deckIdentityOn)
  const identity = loadIdentity(identityText, lib, stubs)
  const runners = loadRunners(runnersText, lib, null, loadThemes(read(THEMES), lib), identity)
  const ops = []; let opened = 0; let masterAnswer = { ok: true }
  lib.chatParityBus.openMaster = () => { opened++ }
  lib.chatParityBus.master = async (op, deadline) => { ops.push([op, deadline]); return masterAnswer }
  const owner = { sessionId: 's1', isCurrent: () => true }
  let displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  const deps = { displayed: () => displayedDeck, identity: { now: () => 1000, masterTimeoutMs: 20_000 } }
  const run = (action, args, over = {}) => runners.runChatParityAction({ requestId: 'r', group: 'identity', action, presentationId: 'p1', args, label: '', ...over }, owner, deps, { session_id: 's1' })
  eq(await run('set_footer', { title: 'Q3', author: 'PK' }), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'footer' } }, 'footer: done through the panel'); eq(plain(ops.at(-1)), [{ kind: 'footer', title: 'Q3', author: 'PK' }, 21000], 'the op and its deadline (now + the panel wait)')
  eq(await run('clear_footer', {}), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'clear_footer' } }, 'clear footer: no confirm')
  eq(await run('remove_logo', {}), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'remove_logo' } }, 'remove logo: no confirm')
  eq(await run('set_logo', { image_url: 'https://x.example/l.png' }), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'logo' } }, 'logo by URL'); eq(plain(ops.at(-1)[0]), { kind: 'logo', image_url: 'https://x.example/l.png' })
  eq(await run('set_logo', { image_url: 'http://x.example/l.png' }), { request_id: 'r', status: 'failed', error_code: 'invalid_url' }, 'logo: not https -> invalid_url (DIRECTOR-2 frame 28)'); eq(await run('set_logo', { image_url: 'https://user:pw@x.example/l.png' }), { request_id: 'r', status: 'failed', error_code: 'invalid_url' }, 'logo: embedded credentials (the dialog\'s own cleanLogoUrl rule)'); eq(opened, 0, 'the panel opens from the panel op runner, not here')
  eq(await run('set_logo', { image_url: 'https://x.example/l.png?a=1' }), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'logo' } }, 'logo: a query string is fine'); eq(plain(ops.at(-1)[0]).image_url, 'https://x.example/l.png?a=1', 'the cleaned URL reaches the panel')
  masterAnswer = { ok: false, error: 'viewer_unavailable' }; eq(await run('set_footer', { title: 'x' }), { request_id: 'r', status: 'failed', error_code: 'viewer_unavailable' }, 'the panel\'s own refusal is the answer')
  masterAnswer = { ok: false }; eq(await run('set_footer', { title: 'x' }), { request_id: 'r', status: 'failed', error_code: 'write_failed' }, 'a bare refusal: write_failed'); masterAnswer = { ok: true }
  eq(await run('set_footer', { title: 'x' }, { presentationId: null }), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'footer' } }, 'no deck named: the deck on screen is the target')
  displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: null, epoch: 1 }; eq(await run('set_footer', { title: 'x' }, { presentationId: null }), { request_id: 'r', status: 'failed', error_code: 'viewer_unavailable' }, 'no deck on screen: nothing to write on'); displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  { const saveMaster = lib.chatParityBus.master; lib.chatParityBus.master = null; eq(await run('set_footer', { title: 'x' }), { request_id: 'r', status: 'failed', error_code: 'viewer_unavailable' }, 'no panel mounted'); lib.chatParityBus.master = saveMaster }
  // the paid generate: the sub-flag is a kill switch; the Director's cost card confirmed before the frame (no Studio confirm, DIRECTOR-2 07:29Z)
  const opsBefore = ops.length
  if (paidOn) {
    eq(await run('generate_logo', { prompt: 'a blue owl' }), { request_id: 'r', status: 'done', error_code: null, detail: { kind: 'generate_logo' } }, 'generate: straight through the panel, no second confirm'); eq(plain(ops.at(-1)[0]), { kind: 'generate_logo', prompt: 'a blue owl' })
  } else {
    eq(await run('generate_logo', { prompt: 'a blue owl' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'sub-flag off: flag_off, nothing runs'); eq(ops.length, opsBefore)
  }
  // presenter details: the identity form's own writer
  if (deckIdentityOn) {
    eq(await run('set_deck_identity', { company: ' Acme ', confidentiality: 'Internal' }), { request_id: 'r', status: 'done', error_code: null, detail: { company: 'Acme', confidentiality: 'Internal', logo_url: null } }, 'identity: written')
    eq(stubs.store.form, { company: 'Acme', confidentiality: 'Internal' }, 'the form'); eq(ops.length, paidOn ? opsBefore + 1 : opsBefore, 'not a panel op')
    eq(await run('set_deck_identity', { logo_url: 'https://x.example/l.png' }), { request_id: 'r', status: 'done', error_code: null, detail: { company: 'Acme', confidentiality: 'Internal', logo_url: 'https://x.example/l.png' } }, 'identity: merged with what was there (logo_url -> logoUrl)')
    eq(stubs.store.form, { company: 'Acme', confidentiality: 'Internal', logoUrl: 'https://x.example/l.png' })
    eq(await run('set_deck_identity', {}), { request_id: 'r', status: 'failed', error_code: 'invalid_args' }, 'identity: nothing given'); eq(await run('set_deck_identity', { company: 'A', logo_url: 'http://x' }), { request_id: 'r', status: 'failed', error_code: 'invalid_url' }, 'identity: a non-https logo -> invalid_url')
  } else {
    eq(await run('set_deck_identity', { company: 'Acme' }), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'the identity feature off: flag_off'); eq(stubs.store.form, {}, 'nothing written')
  }
  eq(await runners.runChatParityAction({ requestId: 'r', group: 'identity', action: 'set_footer', presentationId: 'p1', args: { title: 'x' }, label: '' }, owner, { displayed: deps.displayed }, null), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'no identity deps: flag_off')
  eq(runners.CHAT_PARITY_TIMEOUTS_MS.generate_logo, 60_000, 'DIRECTOR-2: a logo generation waits 60 s')
  lib.chatParityBus.openMaster = null; lib.chatParityBus.master = null
}

/** The THEMES executors against faked click-path functions (the page's deps). */
async function themesSuite(runnersText = read(RUNNERS), libText = read(LIB), themesText = read(THEMES), fontsOn = true) {
  const lib = loadLib(libText)
  const events = []; globalThis.__chatParityWindow = { dispatchEvent: e => { events.push(e.type); return true } }
  const themes = loadThemes(themesText, lib, themeStubs(fontsOn))
  const runners = loadRunners(runnersText, lib, null, themes)
  const library = [{ id: 't1', name: 'Blue', theme_payload: { mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' }, is_standard: false }, { id: 't2', name: 'Brand', theme_payload: { mode: 'custom', primary_hex: '#1a73e8' }, is_standard: true }]
  const calls = []; let selection = { mode: 'preset', preset_id: 'minimal' }; let profile = 'untouched'; let sync = { status: 'idle', presentationId: null, themeFingerprint: null }; let locks = { composerBlocked: false, composerFrozen: false, templateMode: false, generating: false }; let clock = 0
  let displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  const deps = {
    displayed: () => displayedDeck,
    themes: {
      listThemes: async () => { calls.push('list'); return { themes: library, count: library.length } },
      saveTheme: async args => { calls.push(['save', args]); return args.name === 'refused' ? null : { id: 't3', name: args.name, theme_payload: { ...args.theme, font_family: 'Comic Sans' }, is_standard: args.setStandard } },
      setStandardTheme: async id => { calls.push(['standard', id]); return id === 't1' ? { id, name: 'Blue', is_standard: true } : null },
      clearStandardTheme: async () => { calls.push('clear'); return true },
      renameTheme: async (id, name) => { calls.push(['rename', id, name]); return name === 'refused' ? null : { id, name: name.toUpperCase() } },
      currentSelection: () => selection, apply: next => { calls.push(['apply', next]); selection = next; return next }, setActiveProfile: p => { profile = p },
      locks: () => locks, themeSync: () => sync, wait: async () => { clock += 100; await new Promise(r => setImmediate(r)) }, now: () => clock, timeoutMs: 1000,
    },
  }
  const owner = { sessionId: 's1', isCurrent: () => true }
  const run = (action, args, over = {}) => runners.runChatParityAction({ requestId: 'r', group: 'themes', action, presentationId: 'p1', args, label: '', ...over }, owner, deps, { session_id: 's1' })
  const settle = (sel, status = 'applied') => { sync = { status, presentationId: 'p1', themeFingerprint: JSON.stringify(sel) } }
  // save
  eq(await run('save_theme', { name: 'Mine' }), { request_id: 'r', status: 'done', error_code: null, detail: { theme_id: 't3', name: 'Mine', is_standard: false } }, 'save: the palette\'s saveTheme with the current selection')
  eq(plain(calls.at(-2)), ['save', { name: 'Mine', theme: { mode: 'preset', preset_id: 'minimal' }, setStandard: false }], 'save args'); eq(plain(calls.at(-1)), ['apply', { mode: 'preset', preset_id: 'minimal' }], 'the saved payload (an unsupported font dropped by the policy) is applied')
  eq(plain(profile), { id: 't3', name: 'Mine', theme_payload: { mode: 'preset', preset_id: 'minimal' } }, 'the active profile'); eq(events, ['deckster:theme-library-changed'], 'the palette is told')
  eq(await run('save_theme', { name: 'refused' }), { request_id: 'r', status: 'failed', error_code: 'write_failed' }, 'save refused')
  selection = { mode: 'auto' }; eq(await run('save_theme', { name: 'x' }), { request_id: 'r', status: 'failed', error_code: 'theme_auto' }, 'auto cannot be saved (the Save button is disabled then)'); selection = { mode: 'preset', preset_id: 'minimal' }
  eq(await run('save_theme', {}), { request_id: 'r', status: 'failed', error_code: 'invalid_args' }, 'no name: invalid_args')
  // standard
  events.length = 0
  eq(await run('set_standard_theme', { theme_id: 't1' }), { request_id: 'r', status: 'done', error_code: null, detail: { theme_id: 't1', name: 'Blue' } }, 'standard: done'); eq(events, ['deckster:theme-library-changed'])
  eq(await run('set_standard_theme', { theme_id: 't9' }), { request_id: 'r', status: 'failed', error_code: 'not_found' }, 'standard: unknown id (never written)'); ok(!calls.some(c => Array.isArray(c) && c[0] === 'standard' && c[1] === 't9'), 'not written')
  library.push({ id: 't4', name: 'Odd', theme_payload: { mode: 'preset', preset_id: 'x' } }); eq(await run('set_standard_theme', { theme_id: 't4' }), { request_id: 'r', status: 'failed', error_code: 'write_failed' }, 'standard: not confirmed'); library.pop()
  eq(await run('clear_standard_theme', {}), { request_id: 'r', status: 'done', error_code: null }, 'clear standard')
  deps.themes.clearStandardTheme = async () => false; eq(await run('clear_standard_theme', {}), { request_id: 'r', status: 'failed', error_code: 'write_failed' }, 'clear refused'); deps.themes.clearStandardTheme = async () => true
  // rename
  eq(await run('rename_theme', { theme_id: 't1', name: 'Navy' }), { request_id: 'r', status: 'done', error_code: null, detail: { theme_id: 't1', name: 'NAVY' } }, 'rename: Director\'s spelling wins')
  eq(await run('rename_theme', { theme_id: 't1', name: 'refused' }), { request_id: 'r', status: 'failed', error_code: 'write_failed' }, 'rename refused'); eq(await run('rename_theme', { theme_id: 't9', name: 'x' }), { request_id: 'r', status: 'failed', error_code: 'not_found' }, 'rename: unknown id')
  // apply a saved theme: a built deck waits for the sync; no deck answers at once; locks refuse
  calls.length = 0; profile = null
  const applying = run('apply_saved_theme', { theme_id: 't1' }); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r))
  eq(plain(calls.at(-1)), ['apply', { mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' }], 'the saved payload through the picker\'s apply'); eq(plain(profile), { id: 't1', name: 'Blue', theme_payload: { mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' } }, 'the profile is set before the apply')
  settle({ mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' }); eq(await applying, { request_id: 'r', status: 'done', error_code: null, detail: { theme_id: 't1', name: 'Blue' } }, 'applied: done')
  { sync = { status: 'idle', presentationId: null, themeFingerprint: null }; const failing = run('apply_saved_theme', { theme_id: 't1' }); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); settle({ mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' }, 'failed'); eq(await failing, { request_id: 'r', status: 'failed', error_code: 'theme_failed' }, 'a failed sync after the apply') }
  { settle({ mode: 'preset', preset_id: 'corporate_dark', font_family: 'Lora' }, 'failed'); clock = 0; eq((await run('apply_saved_theme', { theme_id: 't1' })).error_code, 'timeout', 'a failure committed BEFORE the apply is not this request\'s') }
  sync = { status: 'idle', presentationId: null, themeFingerprint: null }; clock = 0; eq(await run('apply_saved_theme', { theme_id: 't1' }), { request_id: 'r', status: 'failed', error_code: 'timeout' }, 'nothing settles: timeout'); ok(clock >= 1000, 'waited to the deadline')
  displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: null, epoch: 1 }; eq(await run('apply_saved_theme', { theme_id: 't1' }, { presentationId: null }), { request_id: 'r', status: 'done', error_code: null, detail: { theme_id: 't1', name: 'Blue' } }, 'no deck on screen: the coming build\'s theme, done at once'); displayedDeck = { sessionId: 's1', deckOwnerSessionId: 's1', presentationId: 'p1', epoch: 1 }
  eq(await run('apply_saved_theme', { theme_id: 't9' }), { request_id: 'r', status: 'failed', error_code: 'not_found' }, 'apply: unknown id')
  for (const [l, code] of [[{ generating: true }, 'theme_locked'], [{ templateMode: true }, 'theme_locked'], [{ composerBlocked: true, composerFrozen: true }, 'theme_locked'], [{ composerBlocked: true }, 'theme_failed']]) { locks = { composerBlocked: false, composerFrozen: false, templateMode: false, generating: false, ...l }; eq((await run('apply_saved_theme', { theme_id: 't1' })).error_code, code, `locked: ${JSON.stringify(l)}`) }
  locks = { composerBlocked: false, composerFrozen: false, templateMode: false, generating: false }
  // fonts
  selection = { mode: 'preset', preset_id: 'minimal' }; calls.length = 0
  const fonts = run('set_theme_fonts', { font_family_heading: 'playfair display' }); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r))
  eq(plain(calls.at(-1)), ['apply', { mode: 'preset', preset_id: 'minimal', font_family_heading: 'Playfair Display' }], 'fonts: the current selection with the family set, through the picker\'s apply')
  settle({ mode: 'preset', preset_id: 'minimal', font_family_heading: 'Playfair Display' }); eq(await fonts, { request_id: 'r', status: 'done', error_code: null, detail: { font_family: null, font_family_heading: 'Playfair Display' } }, 'fonts: done')
  eq(await run('set_theme_fonts', { font_family: 'Comic Sans' }), { request_id: 'r', status: 'failed', error_code: 'invalid_args' }, 'fonts: an unknown family')
  if (fontsOn) { const off = loadRunners(runnersText, lib, null, loadThemes(themesText, lib, themeStubs(false))); eq(await off.runChatParityAction({ requestId: 'r', group: 'themes', action: 'set_theme_fonts', presentationId: 'p1', args: { font_family: 'Inter' }, label: '' }, owner, deps, null), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'fonts: the font-selection flag off refuses') }
  // no theme deps (the flag is off on the page): flag_off
  eq(await runners.runChatParityAction({ requestId: 'r', group: 'themes', action: 'save_theme', presentationId: null, args: { name: 'x' }, label: '' }, owner, { displayed: deps.displayed }, null), { request_id: 'r', status: 'failed', error_code: 'flag_off' }, 'no theme deps: flag_off')
  delete globalThis.__chatParityWindow
}

// ============================================================================================================================================
// C. The sources
// ============================================================================================================================================
function sourcesSuite() {
  const marker = strip.CHAT_PARITY_MARKER_RE
  // every marked line is an insertion; stripping gives the base, byte for byte, in THIS change's newest commit
  for (const rel of strip.CHAT_PARITY_FILES) {
    const now = readOwn(rel)
    const marked = now.split('\n').filter(line => marker.test(line))
    ok(marked.length > 0, `${rel}: has marked lines`)
    if (hasBase) {
      eq(strip.stripChatParity(rel, now), baseOf(rel), `${rel}: stripped is the base's file`)
      eq(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, baseOf(rel)), `${rel}: through the registry too`)
    }
    eq(strip.stripChatParity(rel, strip.stripChatParity(rel, now)), strip.stripChatParity(rel, now), `${rel}: stripping twice changes nothing more`)
  }
  eq(strip.stripChatParity('lib/other.ts', 'abc'), 'abc', 'another file is untouched'); eq(strip.stripChatParity(HOOK, null), null, 'a non-string is returned as it is')
  // the taught proof
  if (hasBase) eq(strip.putBackChatParityEdits(FONT_PROOF, readOwn(FONT_PROOF)), baseOf(FONT_PROOF), 'the font-selection proof put back is the base')
  for (const [rel, edits] of Object.entries(strip.CHAT_PARITY_PIN_EDITS)) for (const [has] of edits) eq(readOwn(rel).split(has).length, 2, `${rel}: the taught line occurs once`)
  // the gates: the hook
  const hook = readOwn(HOOK)
  ok(hook.includes("if (CHAT_PARITY_CAPS.length > 0) addChatParityCaps(message.data as unknown as Record<string, unknown>); // CHAT-PARITY"), 'the caps line in buildUserMessage, after the bulk-edit caps')
  ok(hook.indexOf('addBulkEditUndoCaps(message.data') < hook.indexOf('addChatParityCaps(message.data'), 'after the bulk-edit caps line')
  ok(hook.includes('if (STUDIO_CHAT_PARITY_ANY_ENABLED && isChatParityRequestFrame(parsedMessage)) { // CHAT-PARITY'), 'the request branch is gated on any flag')
  ok(hook.indexOf('isChatParityRequestFrame(parsedMessage)') < hook.indexOf('if (!isKnownDirectorMessageType(parsedMessage.type))'), 'ahead of the allowlist')
  ok(!hook.split('\n').some(l => marker.test(l) && /routeNotesUpdatedFrame|notes1/.test(l.split('//')[0])), 'the hook routes no notes_updated and adds no notes1 of ours (code, not comments): #522\'s routeNotesUpdatedFrame / addChatElementEditCaps is the one path')
  ok(hook.includes("window.dispatchEvent(new CustomEvent(CHAT_PARITY_NOTES_FIELDS_EVENT, {") && hook.indexOf('CHAT_PARITY_NOTES_FIELDS_EVENT, {') < hook.indexOf('routeNotesUpdatedFrame(parsedMessage, {'), 'rows 106 / 108: the fields event is raised just before #522\'s route (whose reload follows), gated on #522\'s flag')
  ok(hook.includes("if (CHAT_ELEMENT_EDIT_ENABLED && typeof window !== 'undefined' && parsedMessage.session_id === socketSessionId && deckMutationOwnerRef.current.presentationId ==="), 'this session and the deck on screen only')
  ok(hook.indexOf('addChatElementEditCaps(message.data') < hook.indexOf('addChatParityCaps(message.data'), 'our caps line is the last caps line (after #522\'s)')
  ok(hook.indexOf('routeElementEditFrame(parsedMessage, {') < hook.indexOf('isChatParityRequestFrame(parsedMessage)) { // CHAT-PARITY'), 'our request branch sits after #522\'s')
  ok(hook.includes("chatParityBus.send = sendChatParityResult // CHAT-PARITY"), 'the sender is registered on the bus')
  ok(hook.includes('chatParityBus.request?.(parsedMessage'), 'frames go to the bus, never to a page callback (no page line before the older proofs\' regions)')
  ok(hook.includes("JSON.stringify(chatParityResultFrame(data))"), 'the result frame is the lib\'s')
  for (const line of hook.split('\n').filter(l => marker.test(l))) ok(!/KNOWN_DIRECTOR_MESSAGE_TYPES|REPLY_FRAME_TYPES/.test(line), 'no allowlist edit: the frames stay unknown with the flags off')
  // the gates: the page
  const page = readOwn(PAGE)
  ok(page.includes('chatParityBus.request = !STUDIO_CHAT_PARITY_ANY_ENABLED ? null : (message, owner) => { // CHAT-PARITY'), 'the runner is set only with a flag on')
  ok(!page.split('\n').some(l => marker.test(l) && /chatParityBus\.notes|NOTES_EVENT/.test(l)), 'the page sets no notes handler of ours (#522\'s onNotesUpdated is the one path)')
  ok(page.indexOf('elementEditDirectiveRunnerRef.current = ') < page.indexOf('chatParityBus.request = '), 'our runner sits after #522\'s runner')
  { const first = page.split('\n').findIndex(l => marker.test(l)); ok(first > page.slice(0, page.indexOf('void run.then(send).finally(() => { chatThemeExportInFlightRef.current[kind] = false })')).split('\n').length, 'every page line sits after the theme / export runner (the older proofs\' regions)') }
  ok(page.includes("chatParityBus.send?.(chatParityResult(request.requestId, 'failed', refusal))"), 'a refusal is answered at once')
  ok(page.includes('{ displayed: () => elementDirectiveGenerationOwnerRef.current, // CHAT-PARITY') && page.includes('} } : {}) }, message).then(result => { if (owner.isCurrent()) chatParityBus.send?.(result) }) // CHAT-PARITY'), 'the K5 owner record and the frame reach the runner')
  const pageImports = page.split('\n').filter(l => l.startsWith('import ') && marker.test(l))
  eq(pageImports.length, 3, 'three import lines (the lib, the runners, the composer library)'); ok(pageImports.every(l => page.indexOf(l) > page.indexOf("from '@/lib/studio-chat-clean' // CHAT-CLEAN")), 'placed at the end with the chat-clean import')
  // the gates: the panel and the types
  const panel = readOwn(PANEL)
  { const marked = panel.split('\n').filter(l => marker.test(l)); ok(marked.some(l => l.includes("window.addEventListener('deckster:chat-notes-fields', onNotesFields)")) && marked.some(l => l.includes("window.removeEventListener('deckster:chat-notes-fields', onNotesFields)")), 'rows 106 / 108: the panel listens for the fields event'); ok(!marked.some(l => /setReloadToken|import /.test(l)), 'no second reload, no new import (#522\'s handler reloads)'); ok(marked.some(l => l.includes("if (process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT !== 'true') return")), 'gated on #522\'s flag, read inline') }
  ok(panel.includes("for (const field of ['script', 'references'] as const) if (detail.fields.includes(field) && !saversRef.current.get(pid)?.pending.get(slideId)?.has(field)) editedFieldsRef.current.delete(`${slideId}:${field}`) // CHAT-PARITY"), 'only the fields the frame names, only a saved draft, as #522 does for the notes')
  ok(panel.indexOf('}, []) // CHAT-ELEMENT-EDIT') < panel.indexOf('useEffect(() => { // CHAT-PARITY'), 'after #522\'s effect')
  ok(readOwn(TYPES).includes("| 'notes_updated' // CHAT-PARITY"), 'the mutation kind is declared')
  // the gates: the composer (FRONTEND-2's file: marked lines only, their OK of 27 Oct 04:14Z)
  const composer = readOwn(COMPOSER)
  ok(composer.includes('if (!STUDIO_CHAT_PARITY_THEMES_ENABLED) return // CHAT-PARITY'), 'the palette listens only with the themes flag on')
  ok(composer.includes('const onLibraryChanged = () => { void refreshSavedThemes(true) } // CHAT-PARITY'), 'the palette\'s own refresh, selection kept')
  ok(composer.includes('window.addEventListener(CHAT_PARITY_THEME_LIBRARY_EVENT, onLibraryChanged) // CHAT-PARITY') && composer.includes('window.removeEventListener(CHAT_PARITY_THEME_LIBRARY_EVENT, onLibraryChanged) // CHAT-PARITY'), 'added and removed')
  ok(composer.indexOf('const refreshSavedThemes = useCallback') < composer.indexOf('const onLibraryChanged'), 'after the refresh it calls')
  // the gates: the viewer and the Master panel (IDENTITY)
  const viewer = readOwn(VIEWER)
  ok(viewer.includes("if (process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY !== 'true') return; let bus") && viewer.includes("bus.openMaster = () => setShowPresentationSettings(true)"), 'the viewer registers the Show menu\'s own Master opener, flag on only (read inline, the bus loaded in the effect)')
  ok(!viewer.split('\n').some(l => l.startsWith('import ') && marker.test(l)), 'the viewer gains no import line (its proofs allow-list imports)')
  const master = readOwn(MASTER)
  ok(master.includes("const chatParityOn = process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY === 'true' // CHAT-PARITY") && master.includes('if (!chatParityOn) return // CHAT-PARITY') && master.includes('bus.master = (op, deadline) => new Promise(resolve => {'), 'the panel registers its op runner, flag on only (read inline)')
  ok(master.split('\n').filter(l => l.startsWith('import ') && marker.test(l)).every(l => l.startsWith('import type ')), 'the panel gains a type-only import (its proof allow-lists imports; the bus is loaded in the gated effect)')
  ok(master.includes("run.stage = 'saving'; void handleSave()"), 'the Save button\'s own handler writes'); ok(master.includes("run.stage = 'generating'; void handleGenerateLogo()"), 'the Generate button\'s own handler generates'); ok(master.includes("else if (op.kind === 'remove_logo') { handleRemoveLogo(); run.stage = 'save' }"), 'the Remove button\'s own handler')
  ok(master.includes("studioMarkDraft('footerTemplate', 'footerTitle', 'footerDate', 'footerAuthor'); setFooterTemplate(op.template ?? (footerTemplate || FOOTER_TEMPLATES[3].template))"), 'footer fields set as if typed; a footer with no template yet gets the Professional one')
  ok(master.includes("if (Date.now() > run.deadline) { end({ ok: false, error: 'timeout' }); return }") && master.includes("if (chatReadFailed) { end({ ok: false, error: 'viewer_unavailable' }); return }"), 'the deadline and a read error end the op honestly')
  ok(master.indexOf('}) // CHAT-PARITY\n  if (!isOpen) return null') > 0, 'the effects sit before the panel\'s early return (hooks order)')
  ok(master.includes("if (!isOpen) end({ ok: true }); else if (!isSaving && hasChanges) end({ ok: false, error: 'write_failed' })"), 'saved = the panel closed itself')
  // the gates: the page's theme deps
  ok(page.includes('...(STUDIO_CHAT_PARITY_THEMES_ENABLED ? { themes: {'), 'theme deps only with the themes flag on')
  ok(page.includes('apply: applyChatThemeSelection, setActiveProfile: setActiveBuildThemeProfile') && page.includes('currentSelection: () => buildThemeSelectionRef.current'), 'the picker\'s own apply')
  ok(page.includes('const chatParityThemeProfiles = useThemeProfiles() // CHAT-PARITY'), 'the palette\'s own hook')
  ok(page.includes('timeoutMs: THEME_SYNC_TIMEOUT_MS + 5_000, // CHAT-PARITY'), 'the theme directive\'s wait')
  ok(page.includes('...(STUDIO_CHAT_PARITY_IDENTITY_ENABLED ? { identity: {'), 'identity deps only with the identity flag on')
  ok(page.includes('...(STUDIO_CHAT_PARITY_TEMPLATES_ENABLED ? { templates: {'), 'template deps only with the templates flag on')
  ok(page.includes('select: handleSelectTemplate, selectionLocked: () => templateSelectionLockedRef.current') && page.includes('run: runComposerTemplateAction'), 'the picker\'s own select and the library dialog\'s own runner')
  ok(page.includes('const chatParityTemplates = useTemplates() // CHAT-PARITY'), 'the templates hook, a second instance')
  ok(page.includes('presentationId: templateSavePresentationId ?? null'), 'the Save Template dialog\'s own source')
  ok(!page.split('\n').some(l => marker.test(l) && /ToastAction|chatParityConfirm/.test(l)), 'no Studio confirm toast: the Director\'s cost card confirms a paid action before the frame (DIRECTOR-2 07:29Z)')
  // the new files: the lib is import-free, the runners import the lib only
  ok(!/^import /m.test(readOwn(LIB)) && !/require\(/.test(readOwn(LIB)), 'the lib is import-free')
  eq([...readOwn(RUNNERS).matchAll(/from '([^']+)'/g)].map(m => m[1]), ['@/lib/studio-chat-parity', '@/lib/studio-chat-parity-themes', '@/lib/studio-chat-parity-identity', '@/lib/studio-chat-parity-templates'], 'the runners import the lib and the group files only')
  eq([...readOwn(TEMPLATES).matchAll(/from '([^']+)'/g)].map(m => m[1]).sort(), ['@/hooks/use-templates', '@/lib/composer-library', '@/lib/studio-chat-parity', '@/lib/studio-composer-popups'].sort(), 'the templates file imports the click paths\' own modules')
  eq([...readOwn(IDENTITY).matchAll(/from '([^']+)'/g)].map(m => m[1]).sort(), ['@/lib/deck-identity', '@/lib/studio-chat-parity'], 'the identity file imports the dialog\'s own writer and the lib')
  eq([...readOwn(THEMES).matchAll(/from '([^']+)'/g)].map(m => m[1]).sort(), ['@/hooks/use-theme-profiles', '@/lib/studio-chat-parity', '@/lib/theme-builder', '@/lib/theme-fonts', '@/lib/theme-sync'].sort(), 'the themes file imports the click paths\' own modules')
  // .env.example: the base plus the block, at the end
  const env = readOwn(ENV)
  ok(env.endsWith(`\n${strip.CHAT_PARITY_ENV_BLOCK}`), 'the block ends .env.example')
  if (hasBase) eq(env.slice(0, env.length - strip.CHAT_PARITY_ENV_BLOCK.length - 1), baseOf(ENV), 'append-only')
  ok(!strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES='), 'no notes flag of ours')
  ok(strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES="false"'), 'the themes flag, off')
  ok(strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY="false"') && strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO="false"'), 'the identity flag and the paid sub-flag, off')
  ok(strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES="false"') && strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE="false"') && strip.CHAT_PARITY_ENV_BLOCK.includes('NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE="false"'), 'the templates flag and its paid sub-flags, off')
  eq(registry.stripLaterEnvBlocks(ENV, env).includes('CHAT_PARITY'), false, 'the registry takes the block out')
  // the registry gained its three lines
  const reg = readOwn(REGISTRY)
  for (const name of ['CHAT_PARITY_SCOPE_FILES', 'CHAT_PARITY_ENV_BLOCK', 'stripChatParity']) eq(reg.split(`(await import('./studio-chat-parity-strip.mjs')).${name}`).length, 2, `${name}: registered once`)
  ok(registry.LATER_CHANGE_FILES.has(HOOK) && registry.LATER_CHANGE_FILES.has(LIB), 'the files are in the registry')
  ok(registry.LATER_STRIPS.includes(strip.stripChatParity), 'the strip is in the registry')
  // the committed diff is this change's files
  if (hasBase && OWN) {
    const changed = git('diff', '--name-only', strip.BASE_COMMIT, OWN).split('\n').filter(Boolean)
    ok(changed.length > 0, 'the commit changes something')
    eq(changed.filter(rel => !strip.CHAT_PARITY_SCOPE_FILES.has(rel)), [], 'every changed file is this change\'s')
    const text = git('show', OWN, '--', ...changed)
    ok(!/(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(text), 'no secret in the diff')
  }
}

// ============================================================================================================================================
// D. Mutants
// ============================================================================================================================================
async function mutantsSuite() {
  const libText = read(LIB); const runnersText = read(RUNNERS)
  const libMutants = [
    ['frame request renamed', t => t.replace("request: 'studio_action',", "request: 'studio_actions',")],
    ['result under data', t => t.replace('return { type: CHAT_PARITY_FRAMES.result, payload: data }', 'return { type: CHAT_PARITY_FRAMES.result, data }')],
    ['flag accepts TRUE', t => t.replace("return value === 'true'", "return String(value).toLowerCase() === 'true'")],
    ['caps always sent', t => t.replace("filter(group => flags[group] === true)", 'filter(() => true)')],
    ['caps duplicated', t => t.replace('for (const cap of caps) if (!next.includes(cap)) next.push(cap)', 'for (const cap of caps) next.push(cap)')],
    ['blank id accepted', t => t.replace("typeof id === 'string' && id.trim() ? id : null", "typeof id === 'string' ? id : null")],
    ['args not copied', t => t.replace('{ ...(payload.args as Record<string, unknown>) }', '(payload.args as Record<string, unknown>)')],
    ['off group runs', t => t.replace("flags[request.group] !== true) return 'flag_off'", "flags[request.group] === false) return 'flag_off'")],
    ['unknown action runs', t => t.replace("if (!CHAT_PARITY_ACTIONS[request.group].includes(request.action)) return 'unsupported'", '')],
    ['code on dismissed', t => t.replace("error_code: status === 'failed' ? errorCode : null", 'error_code: errorCode')],
    ['empty detail sent', t => t.replace('if (detail && Object.keys(detail).length > 0) data.detail = detail', 'if (detail) data.detail = detail')],
    ['themes: delete action listed', t => t.replace("'rename_theme', 'apply_saved_theme'],", "'rename_theme', 'apply_saved_theme', 'delete_theme'],")],
    ['themes: unknown font accepted', t => t.replace('if (!family) return null', 'if (!family) continue')],
    ['themes: a name alone', t => t.replace("case 'set_standard_theme': { const id = themeId(args.theme_id); return id ? { action, theme_id: id } : null }", "case 'set_standard_theme': { const id = themeId(args.theme_id) ?? themeId(args.name); return id ? { action, theme_id: id } : null }")],
    ['themes: long name', t => t.replace('name && name.length <= CHAT_PARITY_THEME_NAME_MAX ? name : null', 'name ? name : null')],
    ['themes: set_standard any truthy', t => t.replace("set_standard: args.set_standard === true", 'set_standard: Boolean(args.set_standard)')],
    ['identity: upload listed', t => t.replace("'remove_logo', 'set_deck_identity'],", "'remove_logo', 'set_deck_identity', 'upload_logo'],")],
    ['identity: http logo accepted', t => t.replace("/^https:\\/\\/[^\\s]+$/i.test(text)", "/^https?:\\/\\/[^\\s]+$/i.test(text)")],
    ['identity: paid sub-flag alone', t => t.replace('STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED = STUDIO_CHAT_PARITY_IDENTITY_ENABLED && chatParityFlagOn', 'STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED = chatParityFlagOn')],
    ['identity: paid never blocked', t => t.replace("return action in paid && paid[action] !== true", 'return false')],
    ['identity: empty footer accepted', t => t.replace('return out.template || out.title || out.date || out.author ? out : null', 'return out')],
    ['identity: presenter through the panel', t => t.replace("case 'remove_logo': return { kind: 'remove_logo' }\n    default: return null", "case 'remove_logo': return { kind: 'remove_logo' }\n    default: return { kind: 'clear_footer' }")],
    ['templates: delete listed', t => t.replace("'optimize_template', 'rename_template'],", "'optimize_template', 'rename_template', 'delete_template'],")],
    ['templates: paid save never blocked', t => t.replace('save_template: STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE_ENABLED,', 'save_template: true,')],
    ['templates: unknown composer action', t => t.replace('return id && composer ? { action, template_id: id, composer_action: composer } : null', "return id ? { action, template_id: id, composer_action: composer ?? 'use' } : null")],
  ]
  const templateMutants = [
    ['select while locked', t => t.replace("if (deps.selectionLocked()) return fail(id, 'locked')", '')],
    ['selection record leaks fields', t => t.replace("    template_purity_error: template.template_purity_error,\n  }", "    template_purity_error: template.template_purity_error,\n    ...template,\n  }")],
    ['composer action beyond its flags', t => t.replace("if (!deps.composer.actions().includes(args.composer_action)) return fail(id, 'flag_off')", '')],
    ['optimise a ready template', t => t.replace("if (status === 'ready' || status === 'optimizing') return fail(id, 'already_ready')", '')],
    ['paid block ignored', t => t.replace("if (chatParityPaidBlocked(args.action)) return fail(id, 'flag_off')", '')],
    ['composer template optimised', t => t.replace("if ('stage_template_summary' in template) return fail(id, 'composer_template')", '')],
    ['rename refusal read as done', t => t.replace("if (result.ok) return chatParityResult(id, 'done', null,", 'if (true) return chatParityResult(id, \'done\', null,')],
    ['save without a deck', t => t.replace("if (!source.sessionId || !source.presentationId) return fail(id, 'no_deck')", '')],
  ]
  for (const [name, mutate] of templateMutants) {
    const mutated = mutate(read(TEMPLATES)); assert.notEqual(mutated, read(TEMPLATES), `mutant applies: ${name}`)
    let caught = false; try { await templatesSuite(runnersText, libText, mutated); await templatesSuite(runnersText, libText, mutated, false) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  await templatesSuite(runnersText, libText, read(TEMPLATES), false)
  const identityMutants = [
    ['paid block ignored', t => t.replace("if (chatParityPaidBlocked(args.action)) return fail(id, 'flag_off')", '')],
    ['identity flag ignored', t => t.replace("if (!isDeckIdentityEnabled()) return fail(id, 'flag_off')", '')],
    ['logo url rule skipped', t => t.replace("if (!cleanLogoUrl(request.args[key])) return fail(id, 'invalid_url')", '')],
    ['no deck still writes', t => t.replace("if (!presentationId || !chatParityBus.master || !chatParityBus.openMaster) return fail(id, 'viewer_unavailable')", "if (!chatParityBus.master) return fail(id, 'viewer_unavailable')")],
    ['panel refusal read as done', t => t.replace("if (result.ok) return chatParityResult(id, 'done', null, { kind: op.kind })", "return chatParityResult(id, 'done', null, { kind: op.kind })")],
    ['form replaced not merged', t => t.replace('writeDeckIdentityForm({ ...readDeckIdentityForm(), ...rest,', 'writeDeckIdentityForm({ ...rest,')],
    ['deadline not passed', t => t.replace('chatParityBus.master(op, deps.now() + deps.masterTimeoutMs)', 'chatParityBus.master(op, deps.now())')],
  ]
  for (const [name, mutate] of identityMutants) {
    const mutated = mutate(read(IDENTITY)); assert.notEqual(mutated, read(IDENTITY), `mutant applies: ${name}`)
    let caught = false; try { await identitySuite(runnersText, libText, mutated); await identitySuite(runnersText, libText, mutated, false); await identitySuite(runnersText, libText, mutated, true, false) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  await identitySuite(runnersText, libText, read(IDENTITY), false); await identitySuite(runnersText, libText, read(IDENTITY), true, false)
  const themeMutants = [
    ['auto saved', t => t.replace("if (theme.mode === 'auto') return fail(id, 'theme_auto')", '')],
    ['standard written unseen', t => t.replace("if (!(await findTheme(deps, args.theme_id))) return fail(id, 'not_found')\n      const result = await deps.setStandardTheme", '      const result = await deps.setStandardTheme')],
    ['palette not told', t => t.replace('const libraryChanged = () => { if (typeof window !== \'undefined\') window.dispatchEvent(new Event(CHAT_PARITY_THEME_LIBRARY_EVENT)) }', 'const libraryChanged = () => {}')],
    ['no wait for the sync', t => t.replace("if (!presentationId) return chatParityResult(id, 'done', null, detail)", "return chatParityResult(id, 'done', null, detail)")],
    ['timeout reads done', t => t.replace("if (deps.now() >= deadline) return fail(id, 'timeout')", "if (deps.now() >= deadline) return chatParityResult(id, 'done', null, detail)")],
    ['locks ignored', t => t.replace("if (locks.generating) return 'theme_locked'", '')],
    ['fonts flag ignored', t => t.replace("if (!THEME_FONT_SELECTION_ENABLED) return fail(id, 'flag_off')", '')],
    ['profile after the apply', t => t.replace("deps.setActiveProfile({ id: profile.id, name: profile.name, theme_payload: payload })\n      return applyAndSettle", 'return applyAndSettle')],
    ['save policy skipped', t => t.replace('const payload = applyThemeFontPolicy(saved.theme_payload)', 'const payload = saved.theme_payload')],
  ]
  for (const [name, mutate] of themeMutants) {
    const mutated = mutate(read(THEMES)); assert.notEqual(mutated, read(THEMES), `mutant applies: ${name}`)
    let caught = false; try { await themesSuite(runnersText, libText, mutated) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  for (const [name, mutate] of libMutants) {
    const mutated = mutate(libText); assert.notEqual(mutated, libText, `mutant applies: ${name}`)
    let caught = false; try { libSuite(mutated) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  const runnerMutants = [
    ['default timeout', t => t.replace('CHAT_PARITY_DEFAULT_TIMEOUT_MS = 25_000', 'CHAT_PARITY_DEFAULT_TIMEOUT_MS = 20_000')],
    ['owner check skipped', t => t.replace("if (!check.ok) return fail('not_owner')", '')],
    ['throw rejects', t => t.replace("} catch {\n    return fail('write_failed')\n  }", '} catch (error) { throw error }')],
    ['timeout answers done', t => t.replace("() => fail('timeout')", "() => chatParityResult(request.requestId, 'done')")],
    ['per-action wait ignored', t => t.replace('CHAT_PARITY_TIMEOUTS_MS[request.action] ?? CHAT_PARITY_DEFAULT_TIMEOUT_MS', 'CHAT_PARITY_DEFAULT_TIMEOUT_MS')],
    ['timer not cleared', t => t.replace('if (!done) { done = true; clearTimeout(timer); resolve(value) }', 'if (!done) { done = true; resolve(value) }')],
    ['other deck accepted', t => t.replace('request.presentationId === start.presentationId && start.deckOwnerSessionId === start.sessionId', 'true')],
    ['wrong group runs', t => t.replace('CHAT_PARITY_ACTIONS[request.group]?.includes(request.action) ? CHAT_PARITY_EXECUTORS[request.action] : undefined', 'CHAT_PARITY_EXECUTORS[request.action]')],
  ]
  for (const [name, mutate] of runnerMutants) {
    const mutated = mutate(runnersText); assert.notEqual(mutated, runnersText, `mutant applies: ${name}`)
    let caught = false; try { await runnersSuite(mutated) } catch { caught = true }
    ok(caught, `mutant caught: ${name}`)
  }
  // a marked line that loses its marker is no longer a pure insertion
  if (hasBase) {
    const hook = readOwn(HOOK); const unmarked = hook.replace('chatParityBus.send = sendChatParityResult // CHAT-PARITY', 'chatParityBus.send = sendChatParityResult')
    ok(strip.stripChatParity(HOOK, unmarked) !== baseOf(HOOK), 'mutant caught: an unmarked line stays in the stripped file')
  }
  return libMutants.length + runnerMutants.length + themeMutants.length + identityMutants.length + templateMutants.length + (hasBase ? 1 : 0)
}

// ============================================================================================================================================
// E. DIRECTOR-2's recorded frames (streams/director2/<group>/examples in the deckster-workspace; skipped where that checkout is absent) through
//    the lib's read and refusal and the executors with faked click paths: every studio_action names one of our actions with args our readers
//    take, every notes_updated names fields we read, every recorded result uses a status / error_code of ours.
// ============================================================================================================================================
async function recordedFramesSuite() {
  const home = process.env.HOME || ''
  const base = path.join(home, 'Software', 'deckster-workspace', 'streams', 'director2')
  if (!fs.existsSync(base)) { console.log('NOTE recorded frames: deckster-workspace not present here, replay skipped'); return 0 }
  const lib = loadLib(read(LIB), { ...ALL_ON, NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE: 'true' })
  const OUR_CODES = new Set(['not_owner', 'viewer_unavailable', 'flag_off', 'not_found', 'locked', 'invalid_args', 'write_failed', 'timeout', 'unsupported', 'theme_auto', 'theme_locked', 'theme_failed', 'busy', 'generate_failed', 'declined', 'invalid_url', 'no_deck', 'already_ready', 'name_taken', 'composer_template'])
  const readers = { themes: (a, g) => lib.chatParityThemeArgs(a, g, FONTS), identity: (a, g) => lib.chatParityIdentityArgs(a, g), templates: (a, g) => lib.chatParityTemplateArgs(a, g) }
  let frames = 0, results = 0
  for (const group of ['theme-library', 'identity', 'templates']) {
    const dir = path.join(base, group, 'examples'); if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
      for (const turn of doc.turns ?? []) {
        for (const frame of turn.director_to_studio ?? []) {
          if (frame.type !== 'studio_action') continue
          frames++
          const request = lib.chatParityRequest(frame); ok(request, `${group}/${file}: a request we read`)
          eq(lib.chatParityRefusal(request), null, `${group}/${file}: ${request.action} is one of our ${request.group} actions`)
          ok(readers[request.group](request.action, request.args), `${group}/${file}: ${request.action} args ${JSON.stringify(request.args)} are read`)
          if (request.action === 'generate_logo' || request.action === 'save_template' || request.action === 'optimize_template') ok(!lib.chatParityPaidBlocked(request.action), `${group}/${file}: a paid action with its sub-flag on runs`)
        }
        const result = turn.studio_to_director
        if (result && result.type === 'studio_action_result') {
          results++
          const data = result.payload ?? result.data
          ok(['done', 'failed', 'dismissed'].includes(data.status), `${group}/${file}: a status of ours (${data.status})`)
          if (data.error_code) ok(OUR_CODES.has(data.error_code), `${group}/${file}: an error_code of ours (${data.error_code})`)
          eq(result.type, lib.CHAT_PARITY_FRAMES.result, 'the result frame name')
        }
      }
    }
  }
  const notes = path.join(base, 'notes-narration', 'examples', 'narration_frames.json')
  if (fs.existsSync(notes)) {
    const doc = JSON.parse(fs.readFileSync(notes, 'utf8')); let seen = 0
    for (const [name, record] of Object.entries(doc)) for (const group of record.frames ?? []) for (const frame of Array.isArray(group) ? group : [group]) {
      if (frame?.type !== 'deck_mutation' || frame.payload?.mutation !== 'notes_updated') continue
      seen++; const fields = lib.chatParityNotesFields(frame.payload)
      ok(Array.isArray(frame.payload.fields), `${name}: notes_updated carries fields`)
      eq(fields, frame.payload.fields.filter(f => f === 'script' || f === 'references'), `${name}: the script / references fields we raise (speaker_notes is #522's)`)
    }
    ok(seen >= 3, 'notes: the recorded rows 105 / 106 / 108 frames')
  }
  ok(frames >= 20 && results >= 20, `recorded frames replayed: ${frames} requests, ${results} results`)
  console.log(`recorded frames: ${frames} studio_action requests and ${results} results read as ours`)
  return frames
}

libSuite()
await runnersSuite()
sourcesSuite()
await recordedFramesSuite()
const mutants = await mutantsSuite()
console.log(`test-studio-chat-parity: ${checks} checks, ${mutants} mutants caught${OWN ? ` (own commit ${OWN.slice(0, 8)})` : ' (working tree)'}${hasBase ? '' : ' (base commit not in this clone: source pins skipped)'}`)
