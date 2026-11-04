import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Offline actual-source proof: every wire, Layout read and generator is a local
// counter/supplied value. These checks do not exercise a connected service.
const root = process.env.STUDIO_THEME_TEST_WORKTREE || fileURLToPath(new URL('../', import.meta.url));
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const baseline = 'c17cb12ba82517662a279b29db90d07e305bab77';
const read = (name, pinned = false) => pinned
  ? execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' })
  : fs.readFileSync(path.join(root, name), 'utf8');
const parse = (name, pinned = false) => ts.createSourceFile(name, read(name, pinned), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(node, predicate) {
  if (predicate(node)) return node;
  let result;
  ts.forEachChild(node, child => { if (!result) result = find(child, predicate); });
  return result;
}
const declaration = (tree, name) => {
  const node = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
  assert.ok(node, `actual declaration ${name}`);
  return node;
};
const callback = (tree, name) => declaration(tree, name).initializer.arguments[0].getText(tree);
const arrow = (tree, name) => declaration(tree, name).initializer.getText(tree);
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText;
const evaluate = (text, context) => vm.runInNewContext(compile(text), context);
const page = parse('app/builder/page.tsx');
const oldPage = parse('app/builder/page.tsx', true);
const hook = parse('hooks/use-deckster-websocket-v2.ts');
const panel = parse('components/theme-panel.tsx');
const generation = parse('hooks/use-textlabs-generation.ts');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
async function caseCheck(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const plain = value => JSON.parse(JSON.stringify(value));
function pure(name, context, pinned = false) {
  const module = { exports: {} };
  evaluate(read(name, pinned), { ...context, module, exports: module.exports });
  return module.exports;
}

// Reverse just the approved condition and compare actual callback executable
// bodies. This catches changes to fallback, payload, helper or authority policy.
const currentReady = callback(page, 'ensureThemeReady');
const reversedReady = currentReady.replace('(current.requestId === null || (studioShell && themeSelectionChangedLocallyRef.current))', 'current.requestId === null');
check('exact reverse of guard restores pinned readiness body', () => {
  assert.notEqual(reversedReady, currentReady);
  assert.equal(compile(`(${reversedReady})`), compile(`(${callback(oldPage, 'ensureThemeReady')})`));
});
for (const [name, file] of [
  ['requestThemeSyncForPresentation', 'app/builder/page.tsx'],
  ['handleBuildThemeChange', 'app/builder/page.tsx'],
  ['sendThemeSelection', 'hooks/use-deckster-websocket-v2.ts'],
  ['handleGenerate', 'hooks/use-textlabs-generation.ts'],
]) check(`native ${name} executable body unchanged`, () => assert.equal(compile(`(${callback(parse(file), name)})`), compile(`(${callback(parse(file, true), name)})`)));
check('native ThemePanel Apply and Retry callback unchanged', () => assert.equal(compile(`(${arrow(panel, 'applyTheme')})`), compile(`(${arrow(parse('components/theme-panel.tsx', true), 'applyTheme')})`)));

const custom = { mode: 'custom', primary_hex: '#991122', secondary_hex: '#445566', tertiary_hex: '#778899', neutral_hex: '#dddddd', palette_mode: 'both', harmony_preference: 'analogous', color_overrides: { surface: '#eeeeee', text: '#111111' } };
function harness(options = {}) {
  const { pinned = false, fetchMode = 'layout', sendMode = 'success' } = options;
  const flag = Object.hasOwn(options, 'flag') ? options.flag : 'true';
  const source = pinned ? oldPage : page;
  const events = [], timers = new Map();
  let sequence = 0, timerSequence = 0;
  const c = {
    ...pure('lib/theme-builder.ts', {}), URL, AbortController, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    COMPOSER_LIBRARY_ENABLED: false, WebSocket: { OPEN: 1 }, debugLog: () => {}, console: { error: () => {}, warn: () => {} },
    draft: plain(custom), selectionLocked: false, canApply: true,
    themeSync: { status: 'idle', requestId: null, presentationId: null, themeFingerprint: null, error: null },
    templateSelectionLockedRef: { current: false }, themeSelectionChangedLocallyRef: { current: false },
    themeSyncRef: { current: null }, latestThemeSyncRequestRef: { current: null }, latestThemeSyncKeyRef: { current: null }, themeSyncTimeoutRef: { current: null },
    activeBuildThemeProfile: null, buildThemeSelection: { mode: 'preset', preset_id: 'corporate_light' },
    isReady: true, effectivePresentationId: 'deck-A', templateModeOn: false, composerThemeBlocked: false, composerThemeFrozen: false,
    themeSyncTargetRef: { current: null }, THEME_SYNC_TIMEOUT_MS: 20_000, LAYOUT_SERVICE_URL: 'https://supplied.invalid',
    crypto: { randomUUID: () => `supplied-request-${++sequence}` },
    setSubmittedFromRequestId: value => events.push(['submitted', value]),
    setActiveBuildThemeProfile: update => { c.activeBuildThemeProfile = update(c.activeBuildThemeProfile); },
    setBuildThemeSelection: value => { c.buildThemeSelection = value; events.push(['selection', plain(value)]); },
    setThemeSync: value => { c.themeSync = value; events.push(['sync', value.status]); },
    toast: value => events.push(['toast', plain(value)]),
    setTimeout: (fn, delay) => { const id = ++timerSequence; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async url => { events.push(['layout-read', url]); return { ok: fetchMode !== 'neutral', json: async () => ({ '--theme-primary': '#1111aa', '--theme-background': '#ffffff' }) }; },
    wsRef: { current: { readyState: sendMode === 'disconnected' ? 0 : 1, send: text => { if (sendMode === 'throw') throw new Error('Supplied send refusal'); events.push(['wire', JSON.parse(text)]); } } },
  };
  Object.assign(c, pure('lib/theme-sync.ts', c));
  c.themeSyncRef.current = c.themeSync;
  const themeAssignment = find(source, node => ts.isBinaryExpression(node) && node.left.getText(source) === 'themeSyncTargetRef.current' && ts.isObjectLiteralExpression(node.right));
  const profile = find(source, node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildThemeProfileMatchesSelection');
  const onMessage = find(source, node => ts.isPropertyAssignment(node) && node.name.getText(source) === 'onMessage').initializer.getText(source);
  evaluate(`${profile.getText(source)}; globalThis.studioShell=${arrow(page, 'studioShell')};
    globalThis.renderTarget=()=>{${themeAssignment.getText(source)}};
    globalThis.commitThemeSync=${callback(source, 'commitThemeSync')};
    globalThis.clearThemeSyncTimeout=${callback(source, 'clearThemeSyncTimeout')};
    globalThis.handleBuildThemeChange=${callback(source, 'handleBuildThemeChange')};
    globalThis.sendThemeSelection=${callback(hook, 'sendThemeSelection')};
    globalThis.requestThemeSyncForPresentation=${callback(source, 'requestThemeSyncForPresentation')};
    globalThis.getThemeSyncSnapshot=${callback(source, 'getThemeSyncSnapshot')};
    globalThis.ensureThemeReady=${callback(source, 'ensureThemeReady')};
    globalThis.onBuildThemeChange=handleBuildThemeChange;
    globalThis.apply=${arrow(panel, 'applyTheme')}; globalThis.onMessage=${onMessage};`, c);
  c.renderTarget();
  return {
    c, events, timers,
    apply: () => { c.apply(); c.renderTarget(); },
    request: () => c.requestThemeSyncForPresentation('deck-A'),
    reply: (status, patch = {}) => c.onMessage({ type: 'theme_sync', payload: { request_id: c.themeSync.requestId, presentation_id: 'deck-A', status, ...(status === 'failed' ? { error: 'Supplied native refusal' } : {}), ...patch } }),
    failed: async () => { c.apply(); c.renderTarget(); c.requestThemeSyncForPresentation('deck-A'); c.onMessage({ type: 'theme_sync', payload: { request_id: c.themeSync.requestId, presentation_id: 'deck-A', status: 'failed', error: 'Supplied native refusal' } }); },
    reads: () => events.filter(e => e[0] === 'layout-read').length,
    wires: () => events.filter(e => e[0] === 'wire').map(e => e[1]),
  };
}
async function blocked(h, label) {
  const before = h.reads();
  const result = await h.c.ensureThemeReady('deck-A');
  assert.equal(result.ready, false, label); assert.equal(result.code, 'failed');
  assert.equal(h.reads(), before, 'no Layout probe on a refused local selection');
  return result;
}
await caseCheck('pinned actual refusal witness retains old Layout fallback', async () => { const h = harness({ pinned: true }); await h.failed(); const r = await h.c.ensureThemeReady('deck-A'); assert.equal(r.ready, true); assert.equal(r.source, 'layout'); assert.equal(h.reads(), 1); });
await caseCheck('local matching explicit refusal blocks before Layout probe', async () => { const h = harness(); await h.failed(); await blocked(h); assert.equal(h.c.themeSelectionChangedLocallyRef.current, true); assert.equal(h.c.themeSync.requestId, 'supplied-request-1'); });
for (const selection of [custom, { mode: 'preset', preset_id: 'corporate_light', palette_mode: 'dark', harmony_preference: 'triadic', color_overrides: { accent: '#abcdef' } }, { mode: 'auto', palette_mode: 'light', harmony_preference: 'complementary' }]) {
  await caseCheck(`native full ${selection.mode} selection and exact set_theme wire preserved`, async () => {
    const h = harness(); h.c.draft = plain(selection); h.apply(); const request = h.request();
    assert.equal(request.ok, true);
    assert.deepEqual(h.wires(), [{ type: 'set_theme', data: { request_id: 'supplied-request-1', theme: plain(h.c.normalizeThemePanelSelection(selection)), presentation_id: 'deck-A' } }]);
    h.reply('failed'); await blocked(h);
  });
}
await caseCheck('native Retry syncs a fresh request; stale response ignored; matching Applied releases', async () => {
  const h = harness(); await h.failed(); const old = h.c.themeSync.requestId;
  h.c.themeSync = h.c.themeSyncRef.current;
  Object.assign(h.c, { submittedFromRequestId: undefined, presentationId: 'deck-A', invalidCustomColor: false, invalidOverride: false });
  for (const name of ['hasChanges', 'syncBelongsToPresentation', 'visibleSyncStatus', 'canApply']) evaluate(`globalThis.${name}=${arrow(panel, name)}`, h.c);
  assert.equal(h.c.hasChanges, false); assert.equal(h.c.visibleSyncStatus, 'failed'); assert.equal(h.c.canApply, true);
  h.apply(); assert.equal(h.events.filter(e => e[0] === 'submitted').at(-1)[1], old);
  assert.equal(h.request().ok, true); assert.equal(h.c.themeSync.status, 'syncing'); assert.notEqual(h.c.themeSync.requestId, old);
  assert.deepEqual(h.wires()[0].data.theme, h.wires()[1].data.theme);
  h.reply('failed', { request_id: old }); assert.equal(h.c.themeSync.status, 'syncing');
  const waiting = h.c.ensureThemeReady('deck-A');
  const poll = [...h.timers.values()].find(timer => timer.delay === 50); assert.ok(poll, 'actual native syncing readiness waits');
  assert.equal(h.reads(), 0);
  h.reply('applied'); poll.fn();
  const waited = await waiting; assert.equal(waited.ready, true); assert.equal(waited.source, 'director');
  assert.equal(h.c.themeSelectionChangedLocallyRef.current, false);
  h.reply('syncing'); assert.equal(h.c.themeSync.status, 'applied');
  const r = await h.c.ensureThemeReady('deck-A'); assert.equal(r.ready, true); assert.equal(r.source, 'director'); assert.equal(h.reads(), 0);
});
for (const sendMode of ['disconnected', 'throw']) await caseCheck(`native ${sendMode} send failure stays retryable and blocks same local selection`, async () => {
  const h = harness({ sendMode }); h.apply(); const r = h.request(); assert.equal(r.ok, false); assert.equal(h.c.themeSync.status, 'failed'); assert.ok(h.c.themeSync.requestId); await blocked(h); assert.equal(h.wires().length, 0);
});
await caseCheck('actual request timeout blocks pending local selection without probing', async () => {
  const h = harness(); h.apply(); h.request(); const t = [...h.timers.values()].find(t => t.delay === h.c.THEME_SYNC_TIMEOUT_MS); assert.ok(t); t.fn(); assert.match(h.c.themeSync.error, /timed out/); await blocked(h);
});
await caseCheck('existing null-request local failure remains blocked', async () => { const h = harness(); await h.failed(); h.c.commitThemeSync({ ...h.c.themeSync, requestId: null }); await blocked(h); });
for (const fetchMode of ['layout', 'neutral']) for (const status of ['idle', 'failed']) await caseCheck(`unchanged ${status}/disconnected ${fetchMode} fallback equals baseline`, async () => {
  const result = [];
  for (const pinned of [false, true]) {
    const h = harness({ pinned, fetchMode }); h.c.isReady = false; h.c.renderTarget();
    if (status === 'failed') h.c.commitThemeSync({ status, requestId: 'saved-request', presentationId: 'deck-A', themeFingerprint: h.c.themeSelectionFingerprint(h.c.buildThemeSelection), error: 'Supplied prior failure' });
    result.push(plain(await h.c.ensureThemeReady('deck-A'))); assert.equal(h.reads(), 1); assert.equal(h.c.themeSelectionChangedLocallyRef.current, false);
  }
  assert.deepEqual(result[0], result[1]); assert.equal(result[0].source, fetchMode);
});
for (const flag of [undefined, 'false', 'TRUE', '1', true]) await caseCheck(`nonliteral flag ${String(flag)} retains exact classic refusal fallback`, async () => {
  const h = harness({ flag }); assert.equal(h.c.studioShell, false); await h.failed(); const r = await h.c.ensureThemeReady('deck-A'); assert.equal(r.ready, true); assert.equal(r.source, 'layout');
});
for (const mismatch of ['target', 'fingerprint']) await caseCheck(`nonmatching ${mismatch} failure retains pinned fallback`, async () => {
  const results = [];
  for (const pinned of [false, true]) {
    const h = harness({ pinned }); await h.failed(); h.c.isReady = false; h.c.renderTarget();
    h.c.commitThemeSync({ ...h.c.themeSync, ...(mismatch === 'target' ? { presentationId: 'deck-B' } : { themeFingerprint: 'supplied-other-fingerprint' }) });
    results.push(plain(await h.c.ensureThemeReady('deck-A')));
  }
  assert.deepEqual(results[0], results[1]); assert.equal(results[0].ready, true);
});
await caseCheck('wrong target Applied response does not release matching deck readiness', async () => {
  const h = harness(); await h.failed(); h.apply(); h.request(); h.reply('applied', { presentation_id: 'deck-B' });
  assert.equal(h.c.isThemeAppliedToPresentation(h.c.themeSync, 'deck-A', h.c.themeSelectionFingerprint(h.c.buildThemeSelection)), false);
});
await caseCheck('native locked Apply changes neither selection nor wire', async () => { const h = harness(); h.c.selectionLocked = true; h.apply(); assert.equal(h.c.themeSelectionChangedLocallyRef.current, false); assert.equal(h.wires().length, 0); assert.equal(h.events.length, 0); });

await caseCheck('actual full generation callback refuses before Layout probe or generator dispatch and unlocks Retry', async () => {
  const h = harness(); await h.failed(); const c = h.c;
  const calls = { dispatch: 0, layout: 0 }, errors = [], busy = [];
  Object.assign(c, pure('lib/element-generation-retry.ts', {}), {
    retryCandidateRef: { current: null }, activeGenerationKeysRef: { current: new Set() }, generationHookMountedRef: { current: true },
    renderPresentationTarget: { presentationId: 'deck-A', epoch: 0 }, activePresentationTargetRef: { current: { presentationId: 'deck-A', epoch: 0 } },
    generationPanel: { mode: 'generate', refineContext: null, blankElementId: null, setIsGenerating: value => busy.push(value), setError: value => errors.push(value) },
    blankElements: { getElement: () => { throw new Error('Unexpected blank lookup'); } },
    layoutServiceApis: { sendElementCommand: () => { calls.layout++; throw new Error('Forbidden local mutation path'); } },
    textLabsSession: { ensureSession: () => { calls.dispatch++; throw new Error('Forbidden generator path'); } },
    sendTextLabsMessage: () => { calls.dispatch++; throw new Error('Forbidden generator path'); },
  });
  evaluate(`globalThis.actualGenerate=${callback(generation, 'handleGenerate')}`, c);
  const form = { componentType: 'TEXT_BOX', prompt: 'Supplied themed element', useDeckTheme: true, presentationId: 'deck-A' };
  await c.actualGenerate(form);
  assert.deepEqual(calls, { dispatch: 0, layout: 0 }); assert.equal(h.reads(), 0);
  assert.deepEqual(busy, [true, false]); assert.deepEqual(errors, [null, 'Supplied native refusal']);
  assert.equal(c.activeGenerationKeysRef.current.size, 0); assert.equal(form.prompt, 'Supplied themed element'); assert.equal(form.useDeckTheme, true);
  assert.equal(h.events.filter(e => e[0] === 'toast').at(-1)[1].title, 'Deck theme not ready');
  await c.actualGenerate({ ...form }); assert.deepEqual(busy, [true, false, true, false]); assert.equal(calls.dispatch, 0);
});
console.log(`PASS ${checks} focused actual-source checks; baseline ${baseline}; supplied local values only, no connected service/generator/browser proof.`);
