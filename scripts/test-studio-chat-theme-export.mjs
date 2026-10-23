// FRONTEND-2 Pass 3: change the theme and export the deck from chat, Studio half (NEXT_PUBLIC_CHAT_THEME_CHANGE, NEXT_PUBLIC_CHAT_EXPORT;
// each exact "true", default off, independent of the other). Contract: streams/director2/theme-export/CONTRACT.md (Director !513).
//
//   node scripts/test-studio-chat-theme-export.mjs                 # everything, offline (recorded Director frames, no network)
//   node scripts/test-studio-chat-theme-export.mjs --print-hashes  # also prints the flag-off identity hashes
//
// What it proves (OPS-2's #388 bar, as the refine-element change did):
//  1. the wire half (lib/chat-theme-export-wire.ts): the caps per flag, exact "true" only, the frame kinds each flag takes;
//  2. the REAL Downloads path: lib/api/download-service.ts downloadPDF / downloadPPTX run with only fetch and the browser's anchor stubbed
//     (the network boundary); the runner's enable rule is the Download menu's own (components/presentation-download-controls.tsx and
//     components/builder/presentation-area.tsx, evaluated from their source over a matrix of inputs), and so is its default quality;
//  3. the REAL apply-theme path: the page's own deck-theme regions (themeSyncTargetRef, requestThemeSyncForPresentation, the deck-theme
//     effect, the theme_sync branch of the hook's onMessage option, handleBuildThemeChange), read by AST from app/builder/page.tsx and run
//     with the REAL Director socket hook (scripts/studio-chat-harness), plus this change's page regions (applyChatThemeSelection, the runner,
//     the hook option): set_theme is Studio's own, with its own request id, and the answer comes from that request's terminal theme_sync;
//  4. the 15 transcripts DIRECTOR-2 RECORDED from Director !513's real code (scripts/fixtures/chat-theme-export/director-frames.json, a
//     verbatim copy of streams/director2/theme-export/FRAMES.json) replayed through all of the above: what Studio sends (client_caps) and
//     what it answers (element_directive_result) equal the recorded inbound frames, ids and timestamps normalised;
//  5. flags off is identical: the strip module gives back the base files byte for byte; the reducer / cache / history-restore / send paths
//     and the theme picker's handlers hash-equal the base; the base hook and this hook, flags off, give the same socket bytes, transcript and
//     cache for every recorded frame; the picker's build-selection lock is unchanged with the flags on and off;
//  6. the page wires it only behind the flags, next to the K5 add runner; one directive of a kind at a time; a few mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment, SYNTHETIC_LAYOUT_URL } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import * as extract from './studio-chat-harness/page-extract.mjs'
import { pageThemeSources } from './studio-chat-harness/page-theme-sources.mjs'
import { pageSources } from './studio-chat-harness/page-sources.mjs'
import { stripChatThemeExport, BASE_COMMIT, CHAT_THEME_EXPORT_FILES, CHAT_THEME_EXPORT_CHANGES } from './studio-chat-theme-export-strip.mjs'
import { stripNarrationRouter } from './studio-narration-router-strip.mjs' // #475 (NARRATION_VIA_ROUTER) is stacked on #473 on this change: its .env.example block and package.json line come out first
import { sameAsBase } from './studio-env-append-tolerant.mjs' // stacked after #475: the .env.example rule that takes a later change's block (scripts/studio-env-append-tolerant.mjs)
import { stripModelCatalog } from './studio-model-catalog-strip.mjs' // #473 (NEXT_PUBLIC_STUDIO_MODEL_CATALOG) is stacked on this change: its .env.example block and package.json line come out first
import { STACK, stackFileTolerant, stackMutants, stackScope, sameOrTolerant, stripMutants } from './studio-stack-tolerant.mjs' // stacked after #475: a later PR's files are not this change's to answer for, and a shared file a later PR edits too keeps its base lines and this change's (scripts/studio-stack-tolerant.mjs)
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const FIXTURES = path.join(root, 'scripts/fixtures/chat-theme-export')
const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const PAGE = 'app/builder/page.tsx'
const THEME_FLAG = 'NEXT_PUBLIC_CHAT_THEME_CHANGE', EXPORT_FLAG = 'NEXT_PUBLIC_CHAT_EXPORT'

let passed = 0
const failed = []
async function check(label, fn) {
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, process.argv.includes('--verbose') ? 40 : 3).join(' | ') ?? error}`) }
}

// ---- TypeScript modules, plain (no React) -------------------------------------------------------------------------------------------
function loadPure(rel, env = {}, overrides = {}, globals = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? read(file)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    vm.runInNewContext(out, { module, exports: module.exports, process: { env }, console: { log() {}, info() {}, warn() {}, error() {} }, URL, Date, ...globals, require(spec) {
      if (spec.startsWith('@/')) {
        const base = spec.slice(2)
        for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return load(base + ext)
      }
      throw new Error(`unexpected dependency ${spec} of ${file}`)
    } }, { filename: file })
    return module.exports
  }
  return load(rel)
}
const ON = { [THEME_FLAG]: 'true', [EXPORT_FLAG]: 'true' }
const wireOf = env => loadPure('lib/chat-theme-export-wire.ts', env)
const runner = loadPure('lib/chat-theme-export.ts', ON)

// ---- recorded Director transcripts --------------------------------------------------------------------------------------------------
const RECORDED_FILE = path.join(FIXTURES, 'director-frames.json')
const transcripts = Object.fromEntries(JSON.parse(fs.readFileSync(RECORDED_FILE, 'utf8')).map(t => [t.scenario, t]))
// FRAMES.json as DIRECTOR-2 committed it to the workspace (1bef1bec6df, "!513 draft + theme/export contract and frames for Studio").
const RECORDED_SHA256 = '1181bec831f11e1a660f98301aba889fd717839402ce8d72b1bfee8ca84d092c'
const SCENARIOS = ['theme_preset', 'theme_brand_hex', 'theme_failed', 'theme_dismissed', 'theme_no_capability', 'theme_unknown_preset_asks',
  'theme_invented_colour_asks', 'theme_work_in_progress_g5', 'theme_no_deck_g6', 'export_pdf', 'export_pptx', 'export_failed', 'export_no_capability',
  'export_missing_format_asks', 'export_work_in_progress_g5']
const SESSION = 's_e2e', PRESENTATION = 'pres-e2e'
// message_id, directive_id, request_id and timestamp vary per recording run; everything else is compared as recorded.
function normalise(frame, ids = new Map()) {
  const walk = value => {
    if (Array.isArray(value)) return value.map(walk)
    if (!value || typeof value !== 'object') return value
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (['message_id', 'directive_id', 'request_id'].includes(key) && typeof item === 'string') {
        if (!ids.has(item)) ids.set(item, `<${key}:${[...ids.values()].filter(v => v.startsWith(`<${key}`)).length + 1}>`)
        out[key] = ids.get(item)
      } else if (key === 'timestamp' && typeof item === 'string') out[key] = '<timestamp>'
      else out[key] = walk(item)
    }
    return out
  }
  return walk(frame)
}
const directiveOf = t => t.turns[0].out.find(frame => frame.type === 'theme_directive' || frame.type === 'export_directive') ?? null

await check('fixtures: the 15 transcripts are DIRECTOR-2\'s recording, verbatim, with the contract\'s shapes', async () => {
  assert.equal(sha(fs.readFileSync(RECORDED_FILE, 'utf8')), RECORDED_SHA256, 'byte-identical to streams/director2/theme-export/FRAMES.json')
  assert.deepEqual(Object.keys(transcripts), SCENARIOS)
  for (const [name, t] of Object.entries(transcripts)) {
    const directive = directiveOf(t)
    assert.equal(Boolean(directive), ['theme_preset', 'theme_brand_hex', 'theme_failed', 'theme_dismissed', 'export_pdf', 'export_pptx', 'export_failed'].includes(name), name)
    assert.equal(t.turns[0].in.type, 'user_message')
    if (!directive) { assert.equal(t.turns.length, 1, name); continue }
    assert.equal(t.turns.length, 2, name)
    assert.equal(t.turns[1].in.type, 'element_directive_result')
    assert.equal(t.turns[1].in.data.directive_id, directive.payload.directive_id)
    assert.equal(directive.session_id, SESSION); assert.equal(directive.role, 'assistant'); assert.match(directive.timestamp, /Z$/)
    assert.equal(directive.payload.presentation_id, PRESENTATION)
    if (directive.type === 'theme_directive') {
      assert.match(directive.payload.directive_id, /^thm_[0-9a-f]{12}$/); assert.match(directive.message_id, /^msg_thmdir_[0-9a-f]{8}$/)
      assert.deepEqual(Object.keys(directive.payload).sort(), ['directive_id', 'label', 'presentation_id', 'selection'])
      const keys = Object.keys(directive.payload.selection).sort()
      assert.deepEqual(keys, directive.payload.selection.mode === 'preset' ? ['mode', 'preset_id'] : ['mode', 'primary_hex'])
    } else {
      assert.match(directive.payload.directive_id, /^exp_[0-9a-f]{12}$/); assert.match(directive.message_id, /^msg_expdir_[0-9a-f]{8}$/)
      assert.deepEqual(Object.keys(directive.payload).sort(), ['directive_id', 'format', 'presentation_id'])
      assert.ok(['pdf', 'pptx'].includes(directive.payload.format))
    }
    // The receipt line follows the directive in the same turn (it unlocks Studio's turn gate in the contract; Studio unlocks on the directive too).
    assert.deepEqual(t.turns[0].out.map(f => f.type), [directive.type, 'chat_message'], name)
  }
})

// ---- 1. the wire half --------------------------------------------------------------------------------------------------------------
await check('wire: theme1 / export1 per flag, exact "true" only, each independent; the kinds each flag takes out of band', async () => {
  const cases = [[{}, []], [{ [THEME_FLAG]: 'true' }, ['theme1']], [{ [EXPORT_FLAG]: 'true' }, ['export1']], [ON, ['theme1', 'export1']]]
  for (const [env, caps] of cases) {
    const wire = wireOf(env)
    assert.deepEqual(plain(wire.CHAT_THEME_EXPORT_CAPS), caps, JSON.stringify(env))
    assert.equal(wire.chatThemeExportDirectiveKind('theme_directive'), caps.includes('theme1') ? 'theme' : null)
    assert.equal(wire.chatThemeExportDirectiveKind('export_directive'), caps.includes('export1') ? 'export' : null)
    for (const other of ['element_directive', 'element_refine_directive', 'chat_message', 'theme_sync', undefined]) assert.equal(wire.chatThemeExportDirectiveKind(other), null)
  }
  for (const raw of ['1', 'TRUE', 'yes', 'false', '', ' true']) {
    const wire = wireOf({ [THEME_FLAG]: raw, [EXPORT_FLAG]: raw })
    assert.equal(wire.CHAT_THEME_CHANGE_ENABLED || wire.CHAT_EXPORT_ENABLED, false, `exact "true" only (${JSON.stringify(raw)})`)
    assert.deepEqual(plain(wire.CHAT_THEME_EXPORT_CAPS), [])
  }
  const wire = wireOf(ON)
  assert.equal(wire.themeExportDirectiveId({ payload: { directive_id: 'thm_f18a5ac0140c' } }), 'thm_f18a5ac0140c')
  for (const bad of [null, {}, { payload: null }, { payload: { directive_id: '' } }, { payload: { directive_id: '  ' } }, { payload: { directive_id: 7 } }]) assert.equal(wire.themeExportDirectiveId(bad), null)
  assert.match(read('lib/chat-theme-export-wire.ts'), /^(?![\s\S]*\bimport\b[^\n]*from)/, 'the wire lib imports nothing')
})

await check('selection: exactly {mode:preset, preset_id} (a picker preset) or {mode:custom, primary_hex} (#rrggbb), rebuilt from those keys', async () => {
  const sel = runner.chatThemeSelection
  assert.deepEqual(plain(sel({ mode: 'preset', preset_id: 'corporate_dark' })), { mode: 'preset', preset_id: 'corporate_dark' })
  assert.deepEqual(plain(sel({ mode: 'custom', primary_hex: '#1A73E8', palette_mode: 'dark' })), { mode: 'custom', primary_hex: '#1a73e8' }, 'extra keys dropped')
  for (const id of ['corporate_light', 'corporate_dark', 'minimal', 'vibrant', 'executive', 'pastel']) assert.ok(sel({ mode: 'preset', preset_id: id }), id)
  // Director sends a canon-only id only with DIRECTOR_CANON_PRESETS_ENABLED; Studio's picker offers it only with NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED.
  assert.equal(sel({ mode: 'preset', preset_id: 'gilded_noir' }), null)
  assert.ok(loadPure('lib/chat-theme-export.ts', { ...ON, NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED: 'true' }).chatThemeSelection({ mode: 'preset', preset_id: 'gilded_noir' }))
  for (const bad of [null, 'corporate_dark', { mode: 'auto' }, { mode: 'preset' }, { mode: 'preset', preset_id: 'dark-mode' }, { mode: 'preset', preset_id: 'Corporate Dark' },
    { mode: 'custom', primary_hex: '#abc' }, { mode: 'custom', primary_hex: '1a73e8' }, { mode: 'custom', primary_hex: 'blue' }, { mode: 'custom' }]) assert.equal(sel(bad), null, JSON.stringify(bad))
})

// ---- 2. the REAL Downloads path ----------------------------------------------------------------------------------------------------
const DOWNLOADS = 'https://downloads.synthetic.invalid'
const DECK_URL = `${SYNTHETIC_LAYOUT_URL}/p/${PRESENTATION}`
/** lib/api/download-service.ts as the browser runs it; fetch and the anchor are the only stand-ins (they only record). */
function downloadsWorld({ status = 200, throwOnFetch = false, env = {} } = {}) {
  const requests = [], clicks = [], revoked = []
  const document = {
    createElement(tag) { assert.equal(tag, 'a'); const link = { href: '', download: '', click() { clicks.push({ href: link.href, download: link.download }) } }; return link },
    body: { appendChild() {}, removeChild() {} },
  }
  const window = { URL: { createObjectURL: blob => `blob:synthetic/${blob.type}`, revokeObjectURL: url => revoked.push(url) } }
  const fetch = async (url, init) => {
    requests.push({ url: String(url), method: init?.method, accept: init?.headers?.Accept, body: JSON.parse(init.body) })
    if (throwOnFetch) throw new TypeError('Failed to fetch')
    if (status !== 200) return { ok: false, status, statusText: 'Synthetic', json: async () => ({ detail: 'synthetic refusal' }) }
    const type = String(url).endsWith('/pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    return { ok: true, status, blob: async () => ({ size: 1024, type }) }
  }
  const quiet = { log() {}, info() {}, debug() {}, warn() {}, error() {} }
  const loader = createModuleLoader({ root, globals: { console: quiet, process: { env: { NEXT_PUBLIC_DOWNLOAD_SERVICE_URL: DOWNLOADS, ...env } }, window, document, fetch, URL, Date } })
  return { service: loader.load('lib/api/download-service.ts'), requests, clicks, revoked }
}
const OWNER = { sessionId: SESSION, isCurrent: () => true }
const displayedDeck = (patch = {}) => () => ({ sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0, ...patch })
const BUILT = { presentationUrl: DECK_URL, slideCount: 4, stage: 6, hasFinalDeck: true, exportAfterBuild: false, partialArtifact: false, narrationActive: false, narrationPhase: 'idle' }
const exportDeps = (world, state = BUILT, patch = {}) => ({ displayed: displayedDeck(), exportState: () => state, downloadPDF: world.service.downloadPDF, downloadPPTX: world.service.downloadPPTX, ...patch })
const status = r => `${r.status}${r.error_code ? `:${r.error_code}` : ''}`

await check('export: the REAL downloadPDF / downloadPPTX run with the menu\'s default quality; done once the browser download is started', async () => {
  const pdf = directiveOf(transcripts.export_pdf), pptx = directiveOf(transcripts.export_pptx)
  const world = downloadsWorld()
  assert.deepEqual(plain(await runner.runExportDirective(pdf, OWNER, exportDeps(world))), { directive_id: pdf.payload.directive_id, status: 'done', error_code: null })
  assert.deepEqual(world.requests[0], { url: `${DOWNLOADS}/convert/pdf`, method: 'POST', accept: 'application/pdf', body: { presentation_url: DECK_URL, landscape: true, print_background: true, quality: 'high' } })
  assert.equal(world.clicks.length, 1); assert.match(world.clicks[0].download, /^pres-e2e_\d{4}-\d\d-\d\d\.pdf$/)
  assert.equal(status(await runner.runExportDirective(pptx, OWNER, exportDeps(world))), 'done')
  assert.deepEqual(world.requests[1].body, { presentation_url: DECK_URL, slide_count: 4, aspect_ratio: '16:9', quality: 'high' })
  assert.match(world.clicks[1].download, /\.pptx$/)
  // The menu's own fallback: no slide count -> 1 (the backend auto-detects).
  await runner.runExportDirective(pptx, OWNER, exportDeps(world, { ...BUILT, slideCount: null }))
  assert.equal(world.requests[2].body.slide_count, 1)
  // With NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED the same real request carries view_only (the menu's path; nothing of this change).
  const viewOnly = downloadsWorld({ env: { NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED: 'true' } })
  await runner.runExportDirective(pdf, OWNER, exportDeps(viewOnly))
  assert.equal(viewOnly.requests[0].body.view_only, true)
})

await check('export: a refusal or a network failure is failed / export_failed; nothing is clicked', async () => {
  const pdf = directiveOf(transcripts.export_failed)
  for (const options of [{ status: 500 }, { status: 503 }, { status: 422 }, { throwOnFetch: true }]) {
    const world = downloadsWorld(options)
    assert.equal(status(await runner.runExportDirective(pdf, OWNER, exportDeps(world))), 'failed:export_failed', JSON.stringify(options))
    assert.equal(world.clicks.length, 0)
  }
  const world = downloadsWorld()
  assert.equal(status(await runner.runExportDirective(pdf, OWNER, exportDeps(world, BUILT, { downloadPDF: async () => { throw new Error('boom') } }))), 'failed:export_failed')
  for (const format of ['docx', 'PDF', '', undefined]) {
    assert.equal(status(await runner.runExportDirective({ ...pdf, payload: { ...pdf.payload, format } }, OWNER, exportDeps(world))), 'failed:export_failed', String(format))
  }
  assert.equal(world.requests.length, 0)
})

await check('export: the owner rule (session, deck on screen, epoch) is the K5 add runner\'s: failed / not_owner, nothing downloaded', async () => {
  const pdf = directiveOf(transcripts.export_pdf)
  const world = downloadsWorld()
  const run = (message, owner = OWNER, patch = {}) => runner.runExportDirective(message, owner, exportDeps(world, BUILT, patch))
  assert.equal(status(await run({ ...pdf, payload: { ...pdf.payload, presentation_id: 'pres-other' } })), 'failed:not_owner')
  assert.equal(status(await run({ ...pdf, session_id: 's_other' })), 'failed:not_owner')
  assert.equal(status(await run(pdf, { sessionId: 's_other', isCurrent: () => true })), 'failed:not_owner')
  assert.equal(status(await run(pdf, { sessionId: null, isCurrent: () => true })), 'failed:not_owner')
  assert.equal(status(await run(pdf, OWNER, { displayed: displayedDeck({ deckOwnerSessionId: 's_other' }) })), 'failed:not_owner', 'a deck another session owns')
  assert.equal(status(await run(pdf, OWNER, { displayed: displayedDeck({ presentationId: null }) })), 'failed:not_owner')
  assert.equal(world.requests.length, 0)
})

// The Download menu's rule, from its own source: <PresentationArea> renders it only when exportsAllowed, and it is enabled when isDownloadEnabled.
const controlsSource = extract.parseSource(path.join(root, 'components/presentation-download-controls.tsx'))
const areaSource = extract.parseSource(path.join(root, 'components/builder/presentation-area.tsx'))
const controlsRule = {
  exportAfterBuild: extract.compile(extract.findVariableInitializer(controlsSource, 'exportAfterBuild'), controlsSource, 'controls.exportAfterBuild'),
  exportBlockedReason: extract.compile(extract.findVariableInitializer(controlsSource, 'exportBlockedReason'), controlsSource, 'controls.exportBlockedReason'),
  isDownloadEnabled: extract.compile(extract.findVariableInitializer(controlsSource, 'isDownloadEnabled'), controlsSource, 'controls.isDownloadEnabled'),
  exportsAllowed: extract.compile(extract.findVariableInitializer(areaSource, 'exportsAllowed'), areaSource, 'area.exportsAllowed'),
}
const exportGate = loadPure('lib/studio-export-gate.ts'), heuristics = loadPure('lib/build-narration-heuristics.ts')
const pageAst = extract.parseSource(path.join(root, PAGE))
const pageText = read(PAGE)
function findNode(predicate, node = pageAst) {
  if (predicate(node)) return node
  let hit = null
  ts.forEachChild(node, child => { if (!hit) hit = findNode(predicate, child) })
  return hit
}
const runnerAssign = findNode(node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(pageAst) === 'themeExportDirectiveRunnerRef.current')
const addRunnerAssign = findNode(node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(pageAst) === 'elementDirectiveRunnerRef.current')
const applyNode = extract.findVariableInitializer(pageAst, 'applyChatThemeSelection')
const hookCall = findNode(node => ts.isCallExpression(node) && node.expression.getText(pageAst) === 'useDecksterWebSocketV2')
const hookSpread = hookCall?.arguments[0].properties.find(p => ts.isSpreadAssignment(p) && p.getText(pageAst).includes('onThemeExportDirective'))
const exportStateNode = findNode(node => ts.isPropertyAssignment(node) && node.name.getText(pageAst) === 'exportState' && node.getStart(pageAst) > (runnerAssign?.getStart(pageAst) ?? Infinity))
const compiledPage = {
  runner: extract.compile(runnerAssign.right, pageAst, 'page.themeExportDirectiveRunnerRef.current'),
  apply: extract.compile(applyNode, pageAst, 'page.applyChatThemeSelection'),
  hookSpread: extract.compile(hookSpread.expression, pageAst, 'page.hookOption(...onThemeExportDirective)'),
  exportState: extract.compile(exportStateNode.initializer, pageAst, 'page.exportState'),
}

await check('export: the runner\'s enable rule, fed by the page, is the Download menu\'s own over every input; blocked -> failed / export_blocked', async () => {
  const pdf = directiveOf(transcripts.export_pdf)
  let compared = 0
  for (const shell of ['true', 'false']) for (const afterBuild of ['true', undefined]) for (const url of [DECK_URL, null, undefined]) for (const stage of [0, 3, 4, 5, 6])
    for (const final of [true, false]) for (const partial of [true, false]) for (const narration of [null, { active: false, phase: 'idle' }, { active: true, phase: 'writing' }, { active: true, phase: 'planning' }, { active: true, phase: 'complete' }, { active: true, phase: 'awaiting_user' }]) {
      const processEnv = { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, ...(afterBuild ? { NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD: afterBuild } : {}) } }
      const studioShell = shell === 'true'
      // The page's own values, as it hands them to <PresentationArea> (and on to the controls) and to the chat runner.
      const pageValues = { process: processEnv, Boolean, effectivePresentationUrl: url, effectiveSlideCount: 4, currentStage: stage,
        finalPresentationId: final ? PRESENTATION : null, finalPresentationUrl: final ? DECK_URL : null, studioShell, studioPartialMetadata: partial,
        effectiveBuildNarrationEnabled: Boolean(narration), buildNarration: narration ?? { active: true, phase: 'writing' } }
      const state = compiledPage.exportState(pageValues)()
      const areaNarration = pageValues.effectiveBuildNarrationEnabled ? pageValues.buildNarration : null
      const area = { studioPartialArtifact: studioShell ? partial : undefined, narrationActive: !!(areaNarration && areaNarration.active), narrationPhase: areaNarration?.phase ?? 'idle', exportControlsAllowed: heuristics.exportControlsAllowed }
      const exportsAllowed = controlsRule.exportsAllowed(area)
      const STUDIO_DELIVERY = studioShell
      const exportAfterBuild = controlsRule.exportAfterBuild({ STUDIO_DELIVERY, process: processEnv })
      const presentationUrl = url ?? null // the page passes `effectivePresentationUrl`; the controls compare with null
      const exportBlockedReason = controlsRule.exportBlockedReason({ studioExportBlockedReason: exportGate.studioExportBlockedReason, exportAfterBuild, stage, hasFinalDeck: Boolean(final) })
      // handleDownloadPDF / handleDownloadPPTX also refuse an empty URL ("Download Not Available"), so an undefined one never downloads either.
      const menu = exportsAllowed && controlsRule.isDownloadEnabled({ presentationUrl: url, stage, exportBlockedReason }) && Boolean(presentationUrl)
      assert.equal(runner.chatExportAllowed(state), menu, JSON.stringify({ shell, afterBuild, url, stage, final, partial, narration }))
      if (!menu && compared % 7 === 0) {
        const world = downloadsWorld()
        assert.equal(status(await runner.runExportDirective(pdf, OWNER, exportDeps(world, state))), 'failed:export_blocked')
        assert.equal(world.requests.length, 0)
      }
      compared++
    }
  assert.equal(compared, 2 * 2 * 3 * 5 * 2 * 2 * 6)
  // The menu's default quality and its two calls, as the runner uses them.
  const controls = read('components/presentation-download-controls.tsx')
  assert.ok(controls.includes("const [quality] = useState<DownloadQuality>('high');"))
  assert.ok(controls.includes('const result = await downloadPDF(presentationUrl, quality);'))
  assert.ok(controls.includes('const effectiveSlideCount = slideCount && slideCount > 0 ? slideCount : 1;\n      const result = await downloadPPTX(presentationUrl, effectiveSlideCount, quality);'))
  assert.equal(runner.CHAT_EXPORT_QUALITY, 'high')
  assert.ok(read('components/builder/presentation-area.tsx').includes('presentationUrl={presentationUrl}\n                    presentationId={presentationId}\n                    slideCount={slideCount}\n                    stage={currentStage}\n                    hasFinalDeck={hasFinalDeck}'))
})

// ---- 3 + 4. the REAL Director socket hook and the page's REAL deck-theme regions, replaying the recorded transcripts ------------------
const themeSources = pageThemeSources(root)
const chatSources = pageSources(root)
/** Read `rel` as `text` while `fn` loads modules (the harness loader reads files from disk): runs the BASE hook without a checkout. */
function withFileText(rel, text, fn) {
  if (text === null) return fn()
  const target = path.join(root, rel), original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? text : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}
const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
const loaderFor = (env, hookText = null) => withFileText(HOOK, hookText, () => {
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } })
  return { loader, hook: loader.load(HOOK) }
})
const flagEnv = (theme, exp, extra = {}) => ({ ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true',
  ...(theme ? { [THEME_FLAG]: 'true' } : {}), ...(exp ? { [EXPORT_FLAG]: 'true' } : {}), ...extra })

/**
 * The page, as far as this change reaches: the hook with the page's own onMessage option and this change's hook option, the page's deck-theme
 * state and regions (page-theme-sources.mjs, as the chat harness's elementPreflight fixtures run them), and this change's apply and runner.
 * `knobs` are the page values the cases vary (Template Mode, a build running, a directive already in flight, the downloads world).
 */
async function mountPage({ processEnv, knobs = {}, hookText = null, pageRunner = compiledPage.runner }) {
  const env = createEnvironment({ processEnv })
  const { loader, hook } = loaderFor(env, hookText)
  const themeLibs = {
    ...loader.load('lib/theme-sync.ts'), carryPaletteMode: loader.load('lib/studio-theme-dark-toggle.ts').carryPaletteMode,
    themeSelectionFingerprint: loader.load('lib/theme-builder.ts').themeSelectionFingerprint,
    composerThemeSyncBlocked: loader.load('lib/composer-theme-policy.ts').composerThemeSyncBlocked,
    getLayoutServiceUrl: loader.load('lib/layout-service-client.ts').getLayoutServiceUrl,
  }
  const lib = loader.load('lib/chat-theme-export.ts')
  const { resolveEffectivePresentation } = loader.load('lib/builder-presentation-ownership.ts')
  const T = themeSources.compiled
  const calls = []
  const probe = { latest: null }
  const inFlight = { current: knobs.inFlight ?? { theme: false, export: false } }
  const world = knobs.downloads ?? downloadsWorld()
  function Page() {
    const R = React
    const [buildThemeSelection, setBuildThemeSelection] = R.useState({ mode: 'auto' })
    const [activeBuildThemeProfile, setActiveBuildThemeProfile] = R.useState(null)
    const [themeSync, setThemeSync] = R.useState(themeLibs.IDLE_THEME_SYNC)
    const themeSyncRef = R.useRef(themeSync); themeSyncRef.current = themeSync
    const buildThemeSelectionRef = R.useRef(buildThemeSelection); buildThemeSelectionRef.current = buildThemeSelection
    const theme = {
      ...themeLibs, process: env.globals.process, crypto: env.crypto, console: env.console, setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout,
      buildThemeSelection, setBuildThemeSelection: next => { calls.push(['setBuildThemeSelection', plain(next)]); setBuildThemeSelection(next) }, buildThemeSelectionRef,
      activeBuildThemeProfile, setActiveBuildThemeProfile, themeSync, setThemeSync, themeSyncRef,
      latestThemeSyncRequestRef: R.useRef(null), latestThemeSyncKeyRef: R.useRef(null), themeSyncTimeoutRef: R.useRef(null),
      themeSelectionChangedLocallyRef: R.useRef(false), templateSelectionLockedRef: R.useRef(Boolean(knobs.pickerLocked)), templateModeOn: Boolean(knobs.templateModeOn),
      toast: value => calls.push(['toast', plain(value)]), saveSessionOnFirstAction: () => calls.push(['saveSessionOnFirstAction']),
    }
    theme.THEME_SYNC_TIMEOUT_MS = T.themeSyncTimeoutMs(theme)
    theme.buildThemeProfileMatchesSelection = T.buildThemeProfileMatchesSelection(theme)
    theme.composerLibraryEnabled = T.composerLibraryEnabled(theme)
    for (const name of ['getThemeSyncSnapshot', 'commitThemeSync', 'clearThemeSyncTimeout']) theme[name] = R.useCallback(T[name].fn(theme), T[name].deps(theme))
    const runnerRef = R.useRef(null)
    const isGeneratingFinalRef = R.useRef(Boolean(knobs.generating))
    // The page's onMessage option (extracted), with what its branches read.
    const onMessageScope = { process: env.globals.process, console: env.console, observeThemeRestoreFrame: () => false, isThemeSyncTerminal: themeLibs.isThemeSyncTerminal,
      applyThemeSyncResponse: themeLibs.applyThemeSyncResponse, latestThemeSyncRequestRef: theme.latestThemeSyncRequestRef, themeSyncRef, clearThemeSyncTimeout: theme.clearThemeSyncTimeout,
      commitThemeSync: theme.commitThemeSync, themeSelectionChangedLocallyRef: theme.themeSelectionChangedLocallyRef, isGeneratingFinalRef,
      setIsGeneratingFinal: () => {}, setTemplateReuseAwaitingInput: () => {} }
    const ws = hook.useDecksterWebSocketV2({
      autoConnect: false, existingSessionId: SESSION,
      onMessage: message => chatSources.compiled.onMessage(onMessageScope)(message),
      // This change's hook option, exactly as the page writes it (spread; {} with both flags off).
      ...compiledPage.hookSpread({ process: env.globals.process, themeExportDirectiveRunnerRef: runnerRef }),
    })
    Object.assign(theme, { composerAdoption: ws.composerAdoption, composerThemeResolved: ws.composerThemeResolved, isReady: ws.isReady, studioShell: true,
      sendThemeSelection: ws.sendThemeSelection,
      effectivePresentationId: resolveEffectivePresentation({ livePresentationUrl: ws.presentationUrl, livePresentationId: ws.presentationId, liveSlideCount: ws.slideCount, override: null }).presentationId })
    theme.composerThemeBlocked = T.composerThemeBlocked(theme)
    theme.composerThemeFrozen = T.composerThemeFrozen(theme)
    theme.themeSyncTargetRef = R.useRef(T.themeSyncTargetInitial(theme))
    theme.themeSyncTargetRef.current = T.themeSyncTargetCurrent(theme)
    for (const name of ['requestThemeSyncForPresentation', 'ensureThemeReady', 'handleBuildThemeChange']) theme[name] = R.useCallback(T[name].fn(theme), T[name].deps(theme))
    R.useEffect(T.themeSyncEffect.fn(theme), T.themeSyncEffect.deps(theme))
    // This change's page regions, bound to the page's names (strict scope: a name the region reads that is not here fails the run).
    theme.applyChatThemeSelection = compiledPage.apply(theme)
    runnerRef.current = pageRunner({
      ...theme, process: env.globals.process, Date: env.globals.Date, String, runThemeDirective: lib.runThemeDirective, runExportDirective: lib.runExportDirective,
      chatThemeExportInFlightRef: inFlight, sendElementDirectiveResult: ws.sendElementDirectiveResult,
      elementDirectiveGenerationOwnerRef: { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: theme.effectivePresentationId, epoch: 0 } },
      isGeneratingFinal: Boolean(knobs.generating), isGeneratingStrawman: false, templateReuseAwaitingInput: false,
      effectivePresentationUrl: ws.presentationUrl, effectiveSlideCount: ws.slideCount, currentStage: 6, finalPresentationId: ws.presentationId, finalPresentationUrl: ws.presentationUrl,
      studioPartialMetadata: false, effectiveBuildNarrationEnabled: false, buildNarration: null,
      downloadPDF: world.service.downloadPDF, downloadPPTX: world.service.downloadPPTX,
    })
    probe.latest = { ws, theme }
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 200) throw new Error('page did not settle'); await env.macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  rootNode.setElement(React.createElement(Page))
  await settle()
  probe.latest.ws.ensureConnected()
  await env.clock.advance(0, settle)
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  const sent = () => env.outbound.filter(item => item.data !== 'ping').map(item => item.data)
  let frameSeq = 0
  const acked = new Set() // the set_theme requests Director has answered
  const page = {
    env, probe, calls, world, inFlight, settle, sent,
    get ws() { return probe.latest.ws }, get theme() { return probe.latest.theme },
    async deliver(frame) { env.sockets[0].serverMessage(JSON.stringify(frame)); await env.clock.advance(0, settle) },
    async send(text) { const ok = probe.latest.ws.sendMessage(text); await env.clock.advance(0, settle); return ok },
    async advance(ms) { await env.clock.advance(ms, settle) },
    setThemes: () => sent().filter(data => data.startsWith('{"type":"set_theme"')).map(data => JSON.parse(data).data),
    results: () => sent().filter(data => data.startsWith('{"type":"element_directive_result"')).map(data => JSON.parse(data)),
    // Director's answer to a set_theme (its _handle_set_theme: `syncing`, then the terminal status, on the socket that asked).
    async themeSync(request, terminal = 'applied') {
      acked.add(request.request_id)
      for (const status of ['syncing', terminal]) {
        await page.deliver({ message_id: `msg_theme_sync_${++frameSeq}`, session_id: SESSION, timestamp: '2026-10-22T17:47:12.000000Z', type: 'theme_sync', role: 'assistant',
          payload: { request_id: request.request_id, status, presentation_id: request.presentation_id, theme: request.theme, ...(status === 'failed' ? { error: 'Synthetic Theme Builder refusal' } : {}) } })
      }
    },
    // The deck on screen: Director's presentation_url for pres-e2e, and the initial deck-theme sync it causes, acknowledged.
    async openDeck() {
      await page.deliver({ message_id: 'msg_url_final', session_id: SESSION, timestamp: '2026-10-22T17:47:10.000000Z', type: 'presentation_url', role: 'assistant',
        payload: { url: DECK_URL, presentation_id: PRESENTATION, slide_count: 4, message: 'Your presentation is ready.' } })
      assert.equal(page.theme.effectivePresentationId, PRESENTATION)
      const initial = page.setThemes()
      // Template Mode owns the deck: the deck-theme effect sends nothing (the page's own rule).
      if (knobs.templateModeOn) { assert.equal(initial.length, 0); return }
      assert.equal(initial.length, 1, 'the deck-theme effect syncs the open deck once')
      await page.themeSync(initial[0])
      assert.equal(page.theme.themeSyncRef.current.status, 'applied')
    },
    /** Waits (virtual time) until the answer to `directiveId` is on the socket, acknowledging a new set_theme with `terminal`. */
    async answerOf(directiveId, { terminal = 'applied', limitMs = 30_000 } = {}) {
      for (let waited = 0; waited <= limitMs; waited += 100) {
        const hit = page.results().find(r => r.data.directive_id === directiveId)
        if (hit) return hit
        if (terminal) for (const request of page.setThemes()) if (!acked.has(request.request_id)) await page.themeSync(request, terminal)
        await page.advance(100)
      }
      return null
    },
    unmount() { rootNode.unmount() },
  }
  return page
}

// The page values behind each recording's Studio answer (Studio can only produce what its state allows).
const CASE_KNOBS = {
  theme_failed: { templateModeOn: true },          // Template Mode owns the deck: failed / theme_locked, no set_theme
  theme_dismissed: { inFlight: { theme: true, export: false } }, // a chat theme change is already running: dismissed
  export_failed: { downloads: null },               // Downloads refuses (500): failed / export_failed (see below)
}
const STUDIO_SENDS = {}
for (const [name, transcript] of Object.entries(transcripts)) {
  await check(`replay ${name}: Studio's frames equal Director !513's recorded inbound frames`, async () => {
    const recordedUser = transcript.turns[0].in
    const caps = recordedUser.data.client_caps
    const knobs = { ...(CASE_KNOBS[name] ?? {}) }
    if (name === 'export_failed') knobs.downloads = downloadsWorld({ status: 500 })
    const page = await mountPage({ processEnv: flagEnv(caps.includes('theme1'), caps.includes('export1')), knobs })
    await page.openDeck()
    const setThemesBefore = page.setThemes().length
    assert.equal(await page.send(recordedUser.data.text), true)
    const sentUser = JSON.parse(page.sent().at(-1))
    assert.equal(sentUser.type, 'user_message')
    assert.deepEqual({ text: sentUser.data.text, client_caps: sentUser.data.client_caps }, recordedUser.data, 'the recorded user_message (text, client_caps)')
    STUDIO_SENDS[name] = sentUser.data.client_caps
    assert.equal(page.ws.awaitingDirectorReply, true)
    const ids = new Map()
    for (const frame of transcript.turns[0].out) {
      const before = plain({ messages: page.ws.messages, cache: page.env.sessionStorage.dump() })
      await page.deliver(frame)
      if (frame.type === 'chat_message') {
        assert.ok(page.ws.messages.some(m => m.message_id === frame.message_id), 'the receipt / reply line reaches the transcript as before')
        continue
      }
      // The directive: out of band, never in the transcript or the cache; it answers the turn.
      const after = plain({ messages: page.ws.messages, cache: page.env.sessionStorage.dump() })
      assert.deepEqual(after, before, 'the directive is not a chat message, nor cached')
      assert.equal(page.ws.awaitingDirectorReply, false, 'it unlocks the turn gate')
    }
    const directive = directiveOf(transcript)
    if (!directive) {
      assert.equal(page.results().length, 0, 'nothing to answer')
      assert.equal(page.setThemes().length, setThemesBefore, 'no theme change')
      assert.equal(page.world.requests.length, 0, 'no export')
      page.unmount()
      return
    }
    const answer = await page.answerOf(directive.payload.directive_id)
    assert.ok(answer, 'Studio answered')
    const recorded = transcript.turns[1].in
    // Director's harness leaves error_code out when it is null; Studio always sends the key (contract §4: optional). Studio never sends
    // free text (theme_failed's recorded `error` is the harness's, "accepted and ignored").
    const expected = { type: recorded.type, data: { directive_id: recorded.data.directive_id, status: recorded.data.status, error_code: recorded.data.error_code ?? null } }
    if (name === 'export_failed') {
      // Recorded with download_blocked, which Studio cannot detect (a blocked browser download leaves no trace in the page). Studio's
      // export_failed for the same transcript is a code from the same list; Director logs it and says the same closing line.
      assert.deepEqual(normalise(answer, ids), normalise({ ...expected, data: { ...expected.data, error_code: 'export_failed' } }, ids))
      assert.equal(recorded.data.error_code, 'download_blocked')
    } else assert.deepEqual(normalise(answer, ids), normalise(expected, ids))
    assert.equal(page.results().length, 1, 'answered once')
    // What the answer stands on.
    const newSetThemes = page.setThemes().slice(setThemesBefore)
    if (name === 'theme_preset' || name === 'theme_brand_hex') {
      assert.equal(newSetThemes.length, 1, 'one set_theme, Studio\'s own')
      assert.deepEqual(newSetThemes[0].theme, directive.payload.selection, 'the selection as Director sent it')
      assert.equal(newSetThemes[0].presentation_id, PRESENTATION)
      assert.match(newSetThemes[0].request_id, /^synthetic-uuid-\d{4}$/, 'Studio\'s own request id (crypto.randomUUID)')
      assert.deepEqual(plain(page.theme.buildThemeSelection), directive.payload.selection, 'the picker state follows')
      assert.equal(page.theme.themeSyncRef.current.status, 'applied')
      assert.equal(page.theme.themeSyncRef.current.requestId, newSetThemes[0].request_id)
      assert.equal(page.theme.themeSelectionChangedLocallyRef.current, false, 'settled as a user pick is')
    } else assert.equal(newSetThemes.length, 0, 'no set_theme')
    if (name === 'export_pdf' || name === 'export_pptx') {
      assert.equal(page.world.requests.length, 1); assert.equal(page.world.clicks.length, 1)
      assert.equal(page.world.requests[0].url, `${DOWNLOADS}/convert/${directive.payload.format}`)
      assert.equal(page.world.requests[0].body.presentation_url, DECK_URL)
    } else if (name === 'export_failed') assert.equal(page.world.clicks.length, 0)
    else assert.equal(page.world.requests.length, 0)
    page.unmount()
  })
}

await check('theme: Director refuses the set_theme -> failed / theme_failed; it never answers -> the page\'s own timeout -> failed / theme_failed', async () => {
  const directive = directiveOf(transcripts.theme_preset)
  const refused = await mountPage({ processEnv: flagEnv(true, false) })
  await refused.openDeck()
  await refused.deliver(directive)
  const answer = await refused.answerOf(directive.payload.directive_id, { terminal: 'failed' })
  assert.deepEqual(answer.data, { directive_id: directive.payload.directive_id, status: 'failed', error_code: 'theme_failed' })
  assert.equal(refused.theme.themeSyncRef.current.error, 'Synthetic Theme Builder refusal', 'Director\'s failed theme_sync, not a timeout')
  refused.unmount()
  const silent = await mountPage({ processEnv: flagEnv(true, false) })
  await silent.openDeck()
  await silent.deliver(directive)
  const late = await silent.answerOf(directive.payload.directive_id, { terminal: null, limitMs: 40_000 })
  assert.deepEqual(late.data, { directive_id: directive.payload.directive_id, status: 'failed', error_code: 'theme_failed' })
  assert.match(silent.theme.themeSyncRef.current.error, /timed out/, 'the page\'s THEME_SYNC_TIMEOUT_MS timer committed the failure')
  silent.unmount()
})

await check('theme: the deck already has the theme -> applied with no second set_theme; a build running -> failed / theme_locked', async () => {
  const directive = directiveOf(transcripts.theme_preset)
  const page = await mountPage({ processEnv: flagEnv(true, false) })
  await page.openDeck()
  await page.deliver(directive)
  assert.equal((await page.answerOf(directive.payload.directive_id)).data.status, 'applied')
  const count = page.setThemes().length
  const again = { ...directive, payload: { ...directive.payload, directive_id: 'thm_000000000002' } }
  await page.deliver(again)
  assert.equal((await page.answerOf('thm_000000000002')).data.status, 'applied')
  assert.equal(page.setThemes().length, count, 'nothing re-sent: the deck already uses it')
  page.unmount()
  const building = await mountPage({ processEnv: flagEnv(true, false), knobs: { generating: true } })
  await building.openDeck()
  await building.deliver(directive)
  assert.deepEqual((await building.answerOf(directive.payload.directive_id)).data, { directive_id: directive.payload.directive_id, status: 'failed', error_code: 'theme_locked' })
  building.unmount()
})

await check('theme runner: not_owner, the composer-frozen / pending templates, an invalid selection; every exit is a known status', async () => {
  const directive = directiveOf(transcripts.theme_preset)
  const idle = { status: 'applied', requestId: 'r0', presentationId: PRESENTATION, themeFingerprint: 'x', error: null }
  const fingerprint = loadPure('lib/theme-builder.ts').themeSelectionFingerprint
  const deps = (patch = {}) => {
    let sync = idle
    return { displayed: displayedDeck(), locks: () => ({ composerBlocked: false, composerFrozen: false, templateMode: false, generating: false }),
      apply: selection => { sync = { status: 'applied', requestId: 'r1', presentationId: PRESENTATION, themeFingerprint: fingerprint(selection), error: null }; return selection },
      themeSync: () => sync, wait: async () => {}, now: () => 0, timeoutMs: 1, ...patch }
  }
  const run = (patch, message = directive, owner = OWNER) => runner.runThemeDirective(message, owner, deps(patch))
  assert.equal(status(await run({})), 'applied')
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, presentation_id: 'pres-other' } })), 'failed:not_owner')
  assert.equal(status(await run({}, { ...directive, session_id: 's_other' })), 'failed:not_owner')
  assert.equal(status(await run({ displayed: displayedDeck({ deckOwnerSessionId: 's_other' }) })), 'failed:not_owner')
  const locks = value => ({ locks: () => ({ composerBlocked: false, composerFrozen: false, templateMode: false, generating: false, ...value }) })
  assert.equal(status(await run(locks({ composerBlocked: true, composerFrozen: true }))), 'failed:theme_locked', 'a composer template that keeps its theme')
  assert.equal(status(await run(locks({ composerBlocked: true }))), 'failed:theme_failed', 'the composer policy not resolved yet')
  assert.equal(status(await run(locks({ templateMode: true }))), 'failed:theme_locked')
  assert.equal(status(await run(locks({ generating: true }))), 'failed:theme_locked')
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, selection: { mode: 'auto' } } })), 'failed:theme_failed')
  // The deck changes under the wait: not_owner.
  let epoch = 0
  assert.equal(status(await run({ displayed: () => ({ ...displayedDeck()(), epoch: epoch++ }) })), 'failed:not_owner')
  // Nothing ever settles and the page's timer is gone (a newer request superseded it): the runner's own deadline -> timeout.
  let t = 0
  assert.equal(status(await run({ apply: s => s, themeSync: () => idle, now: () => (t += 50), timeoutMs: 1000 })), 'failed:timeout')
  assert.equal(status(await run({ apply: () => { throw new Error('boom') } })), 'failed:theme_failed')
  assert.equal(String((await run({}, { type: 'theme_directive', payload: null })).directive_id), 'undefined', 'no payload: still an answer (the hook drops such a frame first)')
})

// ---- 5. flags off is identical -----------------------------------------------------------------------------------------------------
const NEW = /^(lib\/chat-theme-export(-wire)?\.ts|scripts\/(test-studio-chat-theme-export|studio-chat-theme-export-strip)\.mjs|scripts\/fixtures\/chat-theme-export\/.+|docs\/pass3\/chat-theme-export\/LIVE-CHECK-PLAN\.md)$/
const STACKED_NARRATION_ROUTER = /^(lib\/narration\/(model-router|draft|tts|spoken)\.ts|app\/api\/narration\/(render|script|speak)\/route\.ts|app\/api\/narration\/voice\/sample\/\[voiceId\]\/route\.ts|scripts\/(test-studio-narration-router|studio-narration-router-strip)\.mjs)$/ // #475's own files (stacked on #473 on this change)
const STACKED_MODEL_CATALOG = /^(app\/\(app\)\/studio\/intelligence\/layout\.tsx|app\/api\/models\/catalogue\/route\.ts|components\/studio-personal\/intelligence-models\.(css|tsx)|lib\/studio-model-catalog\.ts|scripts\/(test-studio-model-catalog|studio-model-catalog-strip)\.mjs|scripts\/fixtures\/studio-model-catalog\/.+)$/ // #473's own files (stacked on this change)
const STACKED_KNOWN = rel => STACKED_MODEL_CATALOG.test(rel) || STACKED_NARRATION_ROUTER.test(rel) || /^scripts\/(test-)?studio-env-append-tolerant\.mjs$/.test(rel) // stacked after #475: the stack this test declares (#473, #475 and #480's rule), for scripts/studio-stack-tolerant.mjs
// Older pins and strip roots that now read through scripts/studio-chat-theme-export-strip.mjs (an import and one call each).
const READS_THROUGH_STRIP = ['scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs',
  'scripts/test-studio-director-transport.mjs', 'scripts/test-theme-font-selection.mjs',
  // After the fae96200 merge (#464 duplicate deck, #469 deck-mutation dedupe, #465 library manage): the merged Pass 3 pins see the hook through the strip / the stacked list.
  'scripts/test-studio-duplicate-deck.mjs', 'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/studio-library-manage-harness.mjs']
await check(`identity: stripping this change gives back ${BASE_COMMIT.slice(0, 7)}'s files byte for byte; every added literal occurs once`, async () => {
  assert.deepEqual(CHAT_THEME_EXPORT_FILES, ['.env.example', 'package.json', PAGE, HOOK])
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-chat-theme-export'], 'node scripts/test-studio-chat-theme-export.mjs', 'registered in package.json')
  // The block is present once and ends with the two flags. Stacked (8d5c494 + #470): after the refine block and before FRONTEND-1's PASS2 ADMIN / Docs
  // blocks, whose mutants find their own blocks with lastIndexOf, so those stay last.
  const env = read('.env.example'), block = `${THEME_FLAG}="false"\n${EXPORT_FLAG}="false"\n`
  assert.equal(env.split(block).length, 2, 'the two flags appear once, together')
  assert.equal(env.split('# PASS3 THEME CHANGE AND EXPORT FROM CHAT').length, 2, 'one block')
  const at = env.indexOf(block), admin = env.indexOf('# PASS2 ADMIN'), refine = env.indexOf('NEXT_PUBLIC_CHAT_ELEMENT_REFINE="false"')
  if (admin !== -1) assert.ok(at < admin, 'before FRONTEND-1\'s PASS2 ADMIN block')
  if (refine !== -1) assert.ok(at > refine, 'after the refine block')
  if (admin === -1) assert.ok(env.endsWith(block), 'no later block: it is last')
  for (const rel of CHAT_THEME_EXPORT_FILES) {
    const head = stripModelCatalog(rel, stripNarrationRouter(rel, read(rel))) // #475's block / registration out first (stacked), then #473's (stacked on this change)
    for (const [added] of CHAT_THEME_EXPORT_CHANGES[rel]) assert.equal(head.split(added).length, 2, `${rel}: one occurrence`)
    if (rel === '.env.example') { assert.ok(sameAsBase(rel, stripChatThemeExport(rel, head), baseFile(rel), new RegExp(`${THEME_FLAG}\\b|${EXPORT_FLAG}\\b`)), rel); continue } // stacked after #475: .env.example may take a later change's block; every other file stays byte for byte, below
    { const v = sameOrTolerant(rel, head, stripChatThemeExport(rel, head), baseFile(rel), CHAT_THEME_EXPORT_CHANGES[rel]); assert.ok(v.ok, `${rel}: ${v.reason}`); if (!v.exact) continue } // stacked after #475: when a later PR edited this shared file too, its base lines stay in order and this change's lines are all in HEAD and none is left (scripts/studio-stack-tolerant.mjs); otherwise byte for byte, below
    assert.equal(sha(stripChatThemeExport(rel, head)), sha(baseFile(rel)), rel)
  }
  // The committed tree against the base (not the working tree: a suite neighbour that rewrites docs/ while it runs must not count).
  const changed = git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\n').filter(Boolean)
  changed.splice(0, changed.length, ...changed.filter(rel => !/^(app\/api\/templates\/\[id\]\/route\.ts|components\/studio-libraries\/(library-manage|templates-workspace)\.tsx|hooks\/use-templates\.ts|lib\/studio-library-manage\.ts|scripts\/(studio-library-manage-strip|test-studio-route-params|test-studio-template-library-manage|test-studio-theme-library-manage)\.mjs|scripts\/fixtures\/template-rename\/.+)$/.test(rel))) // stacked after #475: the template rename's own files (PR #477) are not this change's to answer for
  for (const rel of READS_THROUGH_STRIP.filter(rel => changed.includes(rel))) {
    if (rel === 'scripts/studio-library-manage-harness.mjs') { const v = stackFileTolerant(git('show', `${STACK[475].head}:${rel}`), read(rel)); assert.ok(v.ok, `${rel}: ${v.reason}`); if (!v.exact) continue } // stacked after #475: a later PR's lines in the harness are taken, the stack's (#475's head) kept in order (scripts/studio-stack-tolerant.mjs); as the stack left it, it is checked below as before
    const diff = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n')
    const removed = diff.filter(line => line.startsWith('-') && !line.startsWith('---')), added = diff.filter(line => line.startsWith('+') && !line.startsWith('+++'))
    const stackedNarration = added.filter(line => /narration|NARRATION|FRONTEND-1 template rename|'app\/api\/templates\/\[id\]\/route\.ts'/.test(line)).length // #475's stacked lines in the harness (its extended comment line and its file list), and the template rename's two (PR #477, stacked after #475)
    assert.ok(added.length - stackedNarration <= 5 && removed.length <= 2, `${rel}: an import and one call (${added.length}+/${removed.length}-, ${stackedNarration} of the added lines are #475's, stacked)`)
    assert.ok(added.some(line => /stripChatThemeExport|CHAT_THEME_EXPORT_CAPS: \[\]|lib\/chat-theme-export-wire\.ts/.test(line)), rel)
  }
  // Stacked on #470: its own test reads the hook and its listed files through this change's strip first and lists this change's files as stacked.
  const STACKED_SIBLING_TESTS = ['scripts/test-studio-chat-element-refine.mjs']
  for (const rel of STACKED_SIBLING_TESTS.filter(rel => changed.includes(rel))) {
    const added = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
    for (const line of added) assert.match(line, /ThemeExport|THEME_EXPORT|chat-theme-export|#472|stacked|stripLaunchWording|STUDIO_LAUNCH_WORDING/i, `${rel}: ${line.slice(0, 160)}`)
  }
  { const scope = stackScope(changed, STACK[472], STACKED_KNOWN); assert.equal(STACK[472].base, BASE_COMMIT); assert.deepEqual(git('diff', '--name-only', STACK[472].base, STACK[472].head).split('\n').filter(Boolean), STACK[472].files, 'the frozen files are #472\'s own diff'); assert.deepEqual({ missing: scope.missing, stray: scope.stray }, { missing: [], stray: [] }, 'every frozen file is changed, no stray in its family'); console.log(scope.line); changed.splice(0, changed.length, ...scope.checked) } // stacked after #475: only this change's files, its family and its declared stack are checked below; a later PR's files are ignored, with a count
  for (const rel of changed) assert.ok(CHAT_THEME_EXPORT_FILES.includes(rel) || NEW.test(rel) || READS_THROUGH_STRIP.includes(rel) || STACKED_SIBLING_TESTS.includes(rel) || STACKED_MODEL_CATALOG.test(rel) || STACKED_NARRATION_ROUTER.test(rel) || /^scripts\/(test-)?studio-env-append-tolerant\.mjs$/.test(rel), `unexpected change: ${rel}`) // #475's files are stacked, and so are the append-tolerant .env.example rule and its test
})

await check('identity: this change\'s own head (72606f6) without its lines is its base (aa0cfee) byte for byte, file by file: fixed inputs, whatever later PRs put in HEAD or where (stacked after #475)', async () => { assert.equal(STACK[472].base, BASE_COMMIT); for (const rel of CHAT_THEME_EXPORT_FILES) assert.equal(sha(stripChatThemeExport(rel, git('show', `${STACK[472].head}:${rel}`))), sha(git('show', `${STACK[472].base}:${rel}`)), rel) }) // stacked after #475, scripts/studio-stack-tolerant.mjs
await check('identity: every added piece names a flag (or is the package.json registration / the .env.example documentation)', async () => {
  for (const rel of CHAT_THEME_EXPORT_FILES) for (const [added, original] of CHAT_THEME_EXPORT_CHANGES[rel]) {
    const addedLines = added.split('\n').filter(line => !original.split('\n').includes(line)).join('\n')
    const gated = rel === 'package.json' || /NEXT_PUBLIC_CHAT_THEME_CHANGE|NEXT_PUBLIC_CHAT_EXPORT|CHAT_THEME_EXPORT_CAPS|chatThemeExportDirectiveKind/.test(addedLines)
    assert.ok(gated, `${rel}: ${addedLines.slice(0, 200)}`)
  }
})

function declarations(text, names, file = HOOK) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = {}
  const visit = node => {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && names.includes(node.name?.getText(ast)) && !found[node.name.getText(ast)]) found[node.name.getText(ast)] = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const name of names) assert.ok(found[name], `${file} declares ${name}`)
  return found
}
const UNCHANGED_HOOK = ['setStateWithCache', 'clearAwaitReply', 'beginAwaitReply', 'sendMessageWhenConnected', 'sendElementDirectiveResult', 'sendControlMessage',
  'sendThemeSelection', 'restoreMessages', 'updateCacheUserMessages', 'clearMessages', 'ensureConnected', 'connect', 'disconnect', 'scheduleReconnect']
const STRIPPED_HOOK = ['buildUserMessage', 'sendMessage', 'startConnection']
// The page's send, reducer-facing and theme paths: the picker's handlers, the deck-theme sync, the K5 add runner's helpers.
const PAGE_PATHS = ['handleSendMessage', 'preflightDirectorTurn', 'handleActionClick', 'handleRefineElementRequested', 'handleBuildThemeChange',
  'handleActiveBuildThemeProfileChange', 'requestThemeSyncForPresentation', 'ensureThemeReady', 'commitThemeSync', 'observeThemeRestoreFrame', 'getTemplateSlotCatalog']
const identityHashes = {}
await check('identity: reducer / cache / history-restore / send / theme paths hash-equal the base (the hook stripped only where its flag branch sits)', async () => {
  const head = read(HOOK), base = baseFile(HOOK)
  const h = declarations(head, [...UNCHANGED_HOOK, ...STRIPPED_HOOK]), b = declarations(base, [...UNCHANGED_HOOK, ...STRIPPED_HOOK])
  for (const name of UNCHANGED_HOOK) { assert.equal(sha(h[name]), sha(b[name]), name); identityHashes[`hook.${name}`] = sha(h[name]) }
  const hs = declarations(stripChatThemeExport(HOOK, head), STRIPPED_HOOK)
  for (const name of STRIPPED_HOOK) { assert.notEqual(sha(h[name]), sha(b[name]), `${name} carries the flag branch`); assert.equal(sha(hs[name]), sha(b[name]), name); identityHashes[`hook.${name}(stripped)`] = sha(hs[name]) }
  const reducer = text => text.slice(text.indexOf('            // Turn gate: any reply-bearing frame unlocks the input.'), text.indexOf("            if ((message.type as string) === 'session_directive') {"))
  assert.ok(reducer(head).length > 2000); assert.equal(sha(reducer(head)), sha(reducer(base))); identityHashes['hook.reducer'] = sha(reducer(head))
  for (const rel of ['hooks/use-session-cache.ts', 'hooks/use-builder-session.ts', 'components/builder/message-list.tsx', 'lib/director-chat-history.ts', 'lib/theme-sync.ts',
    'lib/theme-builder.ts', 'lib/api/download-service.ts', 'components/presentation-download-controls.tsx', 'components/builder/presentation-area.tsx', 'components/theme-panel.tsx',
    'components/presentation-viewer.tsx', 'lib/studio-export-gate.ts', 'types/mdc.ts']) {
    assert.equal(sha(read(rel)), sha(baseFile(rel)), rel); identityHashes[rel] = sha(read(rel))
  }
  const page = read(PAGE), basePage = baseFile(PAGE)
  const p = declarations(page, PAGE_PATHS, PAGE), bp = declarations(basePage, PAGE_PATHS, PAGE)
  for (const name of PAGE_PATHS) { assert.equal(sha(p[name]), sha(bp[name]), `page ${name}`); identityHashes[`page.${name}`] = sha(p[name]) }
  // The deck-theme effect, the hook's onMessage option, the K5 add runner, the build-selection lock: the same text.
  const baseAst = ts.createSourceFile(PAGE, basePage, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const effectText = (ast, text) => extract.findCalls(ast, 'useEffect').map(c => c.getText(ast)).find(t => t.includes('requestThemeSyncForPresentation(effectivePresentationId)'))
  assert.equal(sha(effectText(pageAst)), sha(effectText(baseAst))); identityHashes['page.deckThemeEffect'] = sha(effectText(pageAst))
  const onMessage = ast => extract.hookOptionProperty(ast, 'useDecksterWebSocketV2', 'onMessage').getText(ast)
  assert.equal(sha(onMessage(pageAst)), sha(onMessage(baseAst))); identityHashes['page.hookOption.onMessage'] = sha(onMessage(pageAst))
  const addRunner = ast => findNode(node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(ast) === 'elementDirectiveRunnerRef.current', ast).getText(ast)
  assert.equal(sha(addRunner(pageAst)), sha(addRunner(baseAst))); identityHashes['page.elementDirectiveRunner'] = sha(addRunner(pageAst))
  const lock = text => text.slice(text.indexOf('  const buildSelectionsLocked = Boolean('), text.indexOf('  // Set strawman generation flag'))
  assert.ok(lock(page).length > 200); assert.equal(sha(lock(page)), sha(lock(basePage))); identityHashes['page.generationSelectionsLocked'] = sha(lock(page))
})

/** Every frame of every transcript, then sends and a result: what the hook alone does with them, as bytes and state. */
const userSends = trace => trace.sent.filter(data => data.startsWith('{"type":"user_message"')).map(data => JSON.parse(data))
async function hookTrace({ processEnv, hookText = null }) {
  const env = createEnvironment({ processEnv })
  const { hook } = loaderFor(env, hookText)
  const seen = { directives: 0, onMessage: [] }
  const probe = { api: null }
  function Probe() {
    probe.api = hook.useDecksterWebSocketV2({ autoConnect: false, existingSessionId: SESSION,
      onMessage: message => { seen.onMessage.push(message.message_id) },
      // What the page passes with a flag on; with both off it passes nothing, and the hook never calls it.
      onThemeExportDirective: () => { seen.directives++ } })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('hook did not settle'); await env.macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  rootNode.setElement(React.createElement(Probe))
  await settle()
  probe.api.ensureConnected(); await env.clock.advance(0, settle)
  env.sockets[0].serverOpen(); await env.clock.advance(0, settle)
  const trace = []
  const state = () => plain({ messages: probe.api.messages, awaiting: probe.api.awaitingDirectorReply, presentationId: probe.api.presentationId ?? null, cache: env.sessionStorage.dump() })
  probe.api.sendMessage('Switch the deck to the dark theme'); await env.clock.advance(0, settle)
  probe.api.sendMessage('@[Slide 1: Overview] export this as a PDF'); await env.clock.advance(0, settle)
  for (const [name, t] of Object.entries(transcripts)) for (const [turn, { out }] of t.turns.entries()) for (const [i, frame] of out.entries()) {
    env.sockets[0].serverMessage(JSON.stringify({ ...frame, message_id: `${name}-${turn}-${i}` })); await env.clock.advance(0, settle); trace.push(state())
  }
  probe.api.sendElementDirectiveResult({ directive_id: 'thm_synthetic', status: 'applied', error_code: null })
  probe.api.sendThemeSelection({ mode: 'preset', preset_id: 'minimal' }, 'synthetic-request', PRESENTATION)
  await settle()
  const result = { sent: env.outbound.filter(item => item.data !== 'ping').map(item => item.data), trace, directives: seen.directives, onMessage: seen.onMessage,
    consoleErrors: env.consoleEvents.filter(e => e.level === 'error').length }
  rootNode.unmount()
  return result
}
await check('identity: the base hook and this hook, flags off, give the same bytes, transcript, cache and callbacks for all 15 transcripts and the sends', async () => {
  for (const extra of [{}, { NEXT_PUBLIC_CHAT_MENTIONS: 'true' }, { NEXT_PUBLIC_CHAT_DIRECTIVES: 'false' }]) {
    const base = await hookTrace({ processEnv: flagEnv(false, false, extra), hookText: baseFile(HOOK) })
    for (const value of [undefined, 'false', '1', 'TRUE']) {
      const flags = value === undefined ? {} : { [THEME_FLAG]: value, [EXPORT_FLAG]: value }
      const head = await hookTrace({ processEnv: flagEnv(false, false, { ...extra, ...flags }) })
      assert.deepEqual(head, base, `${JSON.stringify(extra)} flags=${value}`)
    }
    assert.equal(base.directives, 0)
    for (const [index, data] of base.sent.entries()) if (data.startsWith('{"type":"user_message"')) identityHashes[`send.${JSON.stringify(extra)}.${index}`] = sha(data)
  }
  // Flags on: the sends differ only by the caps; the transcript and the cache are the same frame for frame.
  const on = await hookTrace({ processEnv: flagEnv(true, true) })
  const off = await hookTrace({ processEnv: flagEnv(false, false) })
  assert.equal(on.directives, 7, 'flags on: the seven recorded directives reach the page')
  const withoutCaps = data => { const frame = JSON.parse(data); if (frame.type === 'user_message') frame.data.client_caps = frame.data.client_caps.filter(c => c !== 'theme1' && c !== 'export1'); return JSON.stringify(frame) }
  assert.deepEqual(on.sent.map(withoutCaps), off.sent, 'sends')
  const view = trace => trace.map(({ messages, cache, presentationId }) => ({ messages, cache, presentationId }))
  assert.deepEqual(view(on.trace), view(off.trace), 'transcript and cache')
  // One flag on: only its own directives (the theme flag never takes an export_directive, and the reverse).
  assert.equal((await hookTrace({ processEnv: flagEnv(true, false) })).directives, 4)
  assert.equal((await hookTrace({ processEnv: flagEnv(false, true) })).directives, 3)
  // Mentions on: the caps still follow mdc1, the references are untouched.
  const mentions = await hookTrace({ processEnv: flagEnv(true, true, { NEXT_PUBLIC_CHAT_MENTIONS: 'true' }) })
  assert.deepEqual(userSends(mentions)[1].data.client_caps, ['mdc1', 'theme1', 'export1'])
  // Without NEXT_PUBLIC_CHAT_DIRECTIVES there is no mdc1, and the caps stand alone.
  assert.deepEqual(userSends(await hookTrace({ processEnv: flagEnv(false, true, { NEXT_PUBLIC_CHAT_DIRECTIVES: 'false' }) }))[0].data.client_caps, ['export1'])
})

await check('identity: the theme picker\'s build-selection lock is unchanged with the flags on and off (only the chat runner passes it)', async () => {
  for (const flags of [[false, false], [true, true]]) {
    const page = await mountPage({ processEnv: flagEnv(...flags), knobs: { pickerLocked: true } })
    await page.openDeck()
    const before = page.setThemes().length
    page.calls.length = 0
    page.theme.handleBuildThemeChange({ mode: 'preset', preset_id: 'minimal' })
    await page.advance(0)
    assert.deepEqual(page.calls.map(c => c[0]), ['toast'], 'the picker\'s handler only says it is locked')
    assert.equal(page.calls[0][1].title, 'Build selections locked')
    assert.equal(page.setThemes().length, before, 'and sends nothing')
    if (flags[0]) {
      // The same locked deck takes the chat directive (Director sends it only for a built deck: PROGRAM-1 E4a).
      const directive = directiveOf(transcripts.theme_preset)
      await page.deliver(directive)
      assert.equal((await page.answerOf(directive.payload.directive_id)).data.status, 'applied')
      assert.deepEqual(page.calls.map(c => c[0]), ['toast', 'saveSessionOnFirstAction', 'setBuildThemeSelection'], 'handleBuildThemeChange\'s body, without the lock')
    }
    page.unmount()
  }
})

// ---- 6. the page's own wiring ------------------------------------------------------------------------------------------------------
await check('page: wired only behind the flags (read inline), next to the K5 add runner, on the same owner record', async () => {
  assert.ok(runnerAssign && addRunnerAssign && hookSpread && applyNode)
  assert.ok(runnerAssign.getStart(pageAst) > addRunnerAssign.getEnd(), 'after the add runner')
  // Right beside it: only this change's own lines, or, stacked on #470, the refine runner's region (its selection effects and runner), sit between.
  const between = pageText.slice(addRunnerAssign.getEnd(), runnerAssign.getStart(pageAst))
  assert.ok(between.split('\n').length < 40 || (between.includes('elementRefineDirectiveRunnerRef.current =') && between.split('\n').length < 100), 'right beside it')
  const gate = "process.env.NEXT_PUBLIC_CHAT_THEME_CHANGE === 'true' || process.env.NEXT_PUBLIC_CHAT_EXPORT === 'true'"
  assert.ok(runnerAssign.right.getText(pageAst).startsWith(`!(${gate}) ? null : (message, owner) => {`))
  assert.match(hookSpread.expression.getText(pageAst), new RegExp(`^\\(${gate.replace(/[.|()]/g, '\\$&')} \\? \\{[\\s\\S]*\\} : \\{\\}\\)$`))
  assert.ok(runnerAssign.right.getText(pageAst).includes('displayed: () => elementDirectiveGenerationOwnerRef.current'), 'the K5 owner record')
  // The apply is handleBuildThemeChange's body after its lock check, statement for statement.
  const handler = extract.useCallbackFunction(pageAst, 'handleBuildThemeChange')
  const handlerStatements = handler.body.statements.map(s => s.getText(pageAst).replace(/\s+/g, ' ')).filter(s => !s.startsWith('//'))
  const applyStatements = applyNode.body.statements.map(s => s.getText(pageAst).replace(/\s+/g, ' '))
  assert.ok(handlerStatements[0].startsWith('if (templateSelectionLockedRef.current) {'), 'the lock is the handler\'s first statement')
  assert.deepEqual(applyStatements.slice(0, -1), handlerStatements.slice(1), 'the rest, unchanged')
  assert.equal(applyStatements.at(-1), 'return carried')
  for (const [env, expected] of [[{}, false], [{ [THEME_FLAG]: 'true' }, true], [{ [EXPORT_FLAG]: 'true' }, true], [{ [THEME_FLAG]: '1', [EXPORT_FLAG]: 'TRUE' }, false]]) {
    const options = compiledPage.hookSpread({ process: { env }, themeExportDirectiveRunnerRef: { current: null } })
    assert.equal(typeof options.onThemeExportDirective === 'function', expected, JSON.stringify(env))
    if (!expected) assert.deepEqual(Object.keys(options), [])
    const fn = compiledPage.runner({ process: { env } })
    assert.equal(fn === null, !expected, 'flag off: no runner')
  }
})

await check('page: one directive of a kind at a time (a second is dismissed); a retired socket gets no answer', async () => {
  const directive = directiveOf(transcripts.theme_preset), exportDirective = directiveOf(transcripts.export_pdf)
  const page = await mountPage({ processEnv: flagEnv(true, true) })
  await page.openDeck()
  await page.deliver(directive)
  const second = { ...directive, payload: { ...directive.payload, directive_id: 'thm_000000000002' } }
  await page.deliver(second)
  assert.deepEqual(page.results().map(r => r.data), [{ directive_id: 'thm_000000000002', status: 'dismissed', error_code: null }])
  // An export is its own kind: it runs while the theme waits.
  await page.deliver(exportDirective)
  await page.advance(0)
  assert.deepEqual(page.results().at(-1).data, { directive_id: exportDirective.payload.directive_id, status: 'done', error_code: null })
  assert.equal((await page.answerOf(directive.payload.directive_id)).data.status, 'applied')
  assert.deepEqual(plain(page.inFlight.current), { theme: false, export: false }, 'free again')
  page.unmount()
  // A socket that retired meanwhile: the runner finishes, nothing is sent on the next socket.
  const results = []
  const fn = compiledPage.runner({ process: { env: ON }, String, runExportDirective: runner.runExportDirective, runThemeDirective: runner.runThemeDirective,
    chatThemeExportInFlightRef: { current: { theme: false, export: false } }, sendElementDirectiveResult: data => { results.push(data); return true },
    elementDirectiveGenerationOwnerRef: { current: displayedDeck()() }, effectivePresentationUrl: DECK_URL, effectiveSlideCount: 4, currentStage: 6,
    finalPresentationId: PRESENTATION, finalPresentationUrl: DECK_URL, studioShell: true, studioPartialMetadata: false, effectiveBuildNarrationEnabled: false, buildNarration: null,
    downloadPDF: downloadsWorld().service.downloadPDF, downloadPPTX: downloadsWorld().service.downloadPPTX, Boolean })
  let current = true
  fn(exportDirective, { sessionId: SESSION, isCurrent: () => current })
  current = false
  for (let i = 0; i < 40; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(results.length, 0)
  fn(exportDirective, { sessionId: SESSION, isCurrent: () => true })
  for (let i = 0; i < 40 && !results.length; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(results[0].status, 'done')
})

// ---- negative controls: each piece is load-bearing --------------------------------------------------------------------------------
await check('mutation: without the hook interception the directive never reaches the runner (and is dropped as an unknown type)', async () => {
  const mutated = read(HOOK).replace('            if (chatThemeExportDirectiveKind(parsedMessage.type)) {', '            if (false) {')
  assert.notEqual(mutated, read(HOOK))
  const page = await mountPage({ processEnv: flagEnv(true, true), hookText: mutated })
  await page.openDeck()
  const directive = directiveOf(transcripts.theme_preset)
  await page.deliver(directive)
  assert.equal(await page.answerOf(directive.payload.directive_id, { limitMs: 1000 }), null)
  page.unmount()
})
await check('mutation: without the caps line there is no theme1 / export1', async () => {
  const mutated = read(HOOK).replace('          ...(CHAT_THEME_EXPORT_CAPS.length > 0 && {', '          ...(false && {')
  assert.notEqual(mutated, read(HOOK))
  const trace = await hookTrace({ processEnv: flagEnv(true, true), hookText: mutated })
  assert.deepEqual(userSends(trace)[0].data.client_caps, ['mdc1'])
})
await check('mutation: the picker\'s own handler (with its lock) in place of the apply refuses every built deck', async () => {
  const text = runnerAssign.right.getText(pageAst)
  const mutantText = text.replace('apply: applyChatThemeSelection,', 'apply: selection => { handleBuildThemeChange(selection); return selection },')
  assert.notEqual(mutantText, text)
  const mutated = extract.compile(mutantText, pageAst, 'mutant')
  const page = await mountPage({ processEnv: flagEnv(true, false), knobs: { pickerLocked: true }, pageRunner: mutated })
  await page.openDeck()
  const directive = directiveOf(transcripts.theme_preset)
  await page.deliver(directive)
  const answer = await page.answerOf(directive.payload.directive_id, { limitMs: 30_000 })
  assert.notEqual(answer.data.status, 'applied', 'the mutant cannot apply (it times out or fails)')
  assert.equal(page.calls.some(c => c[0] === 'setBuildThemeSelection'), false)
  page.unmount()
})
await check('mutation: dropping the build-running lock, or reading any Downloads answer as done, is caught', async () => {
  const text = read('lib/chat-theme-export.ts')
  const noLock = text.replace("    if (locks.generating) return answer(directiveId, 'failed', 'theme_locked')\n", '')
  assert.notEqual(noLock, text)
  const weak = loadPure('lib/chat-theme-export.ts', ON, { 'lib/chat-theme-export.ts': noLock })
  const directive = directiveOf(transcripts.theme_preset)
  const fingerprint = loadPure('lib/theme-builder.ts').themeSelectionFingerprint
  let sync = { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null }
  const deps = { displayed: displayedDeck(), locks: () => ({ composerBlocked: false, composerFrozen: false, templateMode: false, generating: true }),
    apply: s => { sync = { status: 'applied', requestId: 'r', presentationId: PRESENTATION, themeFingerprint: fingerprint(s), error: null }; return s },
    themeSync: () => sync, wait: async () => {}, now: () => 0, timeoutMs: 1 }
  assert.equal((await weak.runThemeDirective(directive, OWNER, deps)).status, 'applied', 'the mutant applies during a build')
  assert.equal(status(await runner.runThemeDirective(directive, OWNER, deps)), 'failed:theme_locked', 'the real rule does not')
  const anyDone = text.replace("result?.success === true ? answer(directiveId, 'done')", "true ? answer(directiveId, 'done')")
  assert.notEqual(anyDone, text)
  const lenient = loadPure('lib/chat-theme-export.ts', ON, { 'lib/chat-theme-export.ts': anyDone })
  const world = downloadsWorld({ status: 500 })
  assert.equal((await lenient.runExportDirective(directiveOf(transcripts.export_failed), OWNER, exportDeps(world))).status, 'done', 'the mutant says done for a refusal')
  assert.equal(status(await runner.runExportDirective(directiveOf(transcripts.export_failed), OWNER, exportDeps(world))), 'failed:export_failed')
})
await check('mutation: the .env.example rule refuses an edited base line and takes a later block of another flag (stacked after #475)', async () => { const base = baseFile('.env.example'), edited = base.replace(/^NEXTAUTH_URL=.*$/m, '$&x'), own = new RegExp(`${THEME_FLAG}\\b|${EXPORT_FLAG}\\b`); assert.ok(edited !== base && !sameAsBase('.env.example', edited, base, own) && sameAsBase('.env.example', `${base}\n# a later change\nNEXT_PUBLIC_SOME_OTHER_FLAG="false"\n`, base, own)) }) // stacked after #475, #473's rule
await check('mutation: the stack-tolerant rules refuse a base line dropped from a shared file, this change\'s line left after its strip or gone from HEAD, an own file missing and a stray in its family; they take a later PR\'s line and file (stacked after #475)', async () => { const shared = CHAT_THEME_EXPORT_FILES.filter(rel => rel !== '.env.example').map(rel => ({ rel, head: stripModelCatalog(rel, stripNarrationRouter(rel, read(rel))), strip: text => stripChatThemeExport(rel, text), base: baseFile(rel), changes: CHAT_THEME_EXPORT_CHANGES[rel] })); const results = stackMutants({ change: STACK[472], changed: git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\n').filter(Boolean), known: STACKED_KNOWN, shared, kept: [{ rel: 'scripts/studio-library-manage-harness.mjs', stack: git('show', `${STACK[475].head}:scripts/studio-library-manage-harness.mjs`), head: read('scripts/studio-library-manage-harness.mjs') }] }); for (const [label, held] of results) assert.ok(held, label); console.log(`stack-tolerant (#472): ${results.filter(([label]) => label.includes('mutant:')).length} mutants caught, ${results.filter(([label]) => label.includes('control:')).length} controls taken`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs
await check('mutation: the strip module edited fails on fixed inputs (this change\'s own head and base, and its package.json line in the middle of the base\'s list): its env block leaves its blank line, its last package.json entry keeps the comma, or a middle one stays (stacked after #475)', async () => { const head = rel => git('show', `${STACK[472].head}:${rel}`), base = rel => git('show', `${STACK[472].base}:${rel}`), prev = '    "test:studio-chat-element-refine": "node scripts/test-studio-chat-element-refine.mjs"', mine = '    "test:studio-chat-theme-export": "node scripts/test-studio-chat-theme-export.mjs"', later = '    "test:studio-later": "node scripts/test-studio-later.mjs"'; const holds = strip => CHAT_THEME_EXPORT_FILES.every(rel => strip(rel, head(rel)) === base(rel)) && strip('package.json', base('package.json').replace(`${prev}\n`, `${prev},\n${mine},\n${later}\n`)) === base('package.json').replace(`${prev}\n`, `${prev},\n${later}\n`); const results = stripMutants(read('scripts/studio-chat-theme-export-strip.mjs'), source => new Function(`${source.replace(/^export /gm, '')}\nreturn { stripChatThemeExport }`)().stripChatThemeExport, holds, [['NEXT_PUBLIC_CHAT_EXPORT=\\"false\\"\\n\\n", "\\n"]', 'NEXT_PUBLIC_CHAT_EXPORT=\\"false\\"\\n", "\\n"]', 'the env block strip leaves its blank line'], ["text.replace(last, '\\n')", "text.replace(last, ',\\n')", 'the entry before its last package.json line keeps the comma'], [": text.replace(`${PACKAGE_LINE},\\n`, '')", ': text', 'its package.json line in the middle of the list stays']]); for (const [label, held] of results) assert.ok(held, label); console.log(`strip mutants on fixed inputs (#472): ${results.length - 1} caught`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs

if (process.argv.includes('--print-hashes')) console.log(JSON.stringify(identityHashes, null, 2))
console.log(`${passed} chat theme/export checks passed; ${failed.length} failed. Recorded Director frames (Director !513), real hook + page theme regions + real Downloads client, offline, no network.`)
if (failed.length) process.exitCode = 1
