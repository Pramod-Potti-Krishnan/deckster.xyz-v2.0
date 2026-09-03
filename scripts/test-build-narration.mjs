// Unit tests for lib/build-narration-heuristics.ts (Build Narration Phase 1).
// Run: pnpm test:build-narration   (plain node — transpile + vm, no test runner)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const helperPath = new URL('../lib/build-narration-heuristics.ts', import.meta.url);
const source = fs.readFileSync(helperPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require,
});

const controlHelperPath = new URL('../lib/build-control-helpers.ts', import.meta.url);
const controlHelperSource = fs.readFileSync(controlHelperPath, 'utf8');
const controlHelperCompiled = ts.transpileModule(controlHelperSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const controlHelperMod = { exports: {} };
vm.runInNewContext(controlHelperCompiled.outputText, {
  module: controlHelperMod,
  exports: controlHelperMod.exports,
  URL,
});

const stageDotsSource = fs.readFileSync(
  new URL('../components/build-narration/stage-dots.tsx', import.meta.url),
  'utf8',
);
const pauseStopControlSource = fs.readFileSync(
  new URL('../components/build-narration/pause-stop-control.tsx', import.meta.url),
  'utf8',
);
const websocketHookSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
  'utf8',
);
const narrationHookSource = fs.readFileSync(
  new URL('../hooks/use-build-narration.ts', import.meta.url),
  'utf8',
);
const sessionCacheSource = fs.readFileSync(
  new URL('../hooks/use-session-cache.ts', import.meta.url),
  'utf8',
);

const {
  initialNarrationState,
  narrationReducer,
  parseEphemeralText,
  interpretStatus,
  shouldRerouteEphemeral,
  effectiveNarrationEnabled,
  phaseLabelFor,
  serializeNarration,
  deserializeNarration,
  RETIRED_BUILD_ID_CAP,
  DECK_EVENT_CAP,
  SLIDE_EVENT_CAP,
} = mod.exports;
const {
  buildControlEndpointFromWsUrl,
  createBuildControlRequestId,
  expectedBuildControlAckPhase,
  isCurrentBuildControlTransportSnapshot,
  isBuildControlRequestPending,
  isRetiredBuildControlRequestId,
  isMatchingBuildControlBuild,
  isMatchingBuildControlAck,
  retireBuildControlRequestId,
  RETIRED_CONTROL_REQUEST_ID_CAP,
  scrubBuildControlCapabilityMessages,
  shouldIgnoreBuildControlPhaseCorrelation,
  shouldRetirePendingControl,
} = controlHelperMod.exports;

const T0 = 1_000_000;
let testCount = 0;
function step(state, action) {
  return narrationReducer(state, action);
}
// vm-created objects have a different realm prototype; deepStrictEqual rejects
// them. Compare by JSON structure instead.
function eqJson(actual, expected, msg) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
}
function run(name, fn) {
  testCount += 1;
  try {
    fn();
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// shouldRerouteEphemeral — THE flag-off parity contract for message-list
// ---------------------------------------------------------------------------
run('reroute: flag off NEVER reroutes (chat renders bubbles exactly as today)', () => {
  assert.equal(shouldRerouteEphemeral(false), false);
  assert.equal(shouldRerouteEphemeral(undefined), false);
  assert.equal(shouldRerouteEphemeral(null), false);
});
run('reroute: flag on reroutes', () => {
  assert.equal(shouldRerouteEphemeral(true), true);
});

run('effective flag: template builds keep ephemerals in chat', () => {
  assert.equal(effectiveNarrationEnabled(true, false), true);
  assert.equal(effectiveNarrationEnabled(true, true), false);
  assert.equal(effectiveNarrationEnabled(false, false), false);
});

run('blank placeholder (v2 R1 rev 2): contentless deck => placeholder; content/build/dismiss => never', () => {
  const { shouldShowBlankPlaceholder } = mod.exports;
  const landing = {
    dismissed: false, hasSlideStructure: false, isGenerating: false,
    narrationActive: false, hasPresentationUrl: true,
  };
  // flag off ⇒ never, regardless of everything else
  assert.equal(shouldShowBlankPlaceholder(false, landing), false);
  assert.equal(shouldShowBlankPlaceholder(undefined, landing), false);
  // the showing state: any contentless deck on stage, idle — INCLUDING one a
  // restore mislabelled 'final' (the gate no longer looks at activeVersion)
  assert.equal(shouldShowBlankPlaceholder(true, landing), true);
  // dismissal wins
  assert.equal(shouldShowBlankPlaceholder(true, { ...landing, dismissed: true }), false);
  // authored content is NEVER covered
  assert.equal(shouldShowBlankPlaceholder(true, { ...landing, hasSlideStructure: true }), false);
  // an in-flight legacy generation keeps its loader
  assert.equal(shouldShowBlankPlaceholder(true, { ...landing, isGenerating: true }), false);
  // active narration owns the stage
  assert.equal(shouldShowBlankPlaceholder(true, { ...landing, narrationActive: true }), false);
  // nothing on stage at all → the standalone branch handles it, not the overlay
  assert.equal(shouldShowBlankPlaceholder(true, { ...landing, hasPresentationUrl: false }), false);
});

run('control transport: derives HTTP endpoint from ws/wss URLs and drops query state', () => {
  assert.equal(
    buildControlEndpointFromWsUrl('wss://director.example/ws'),
    'https://director.example/api/v1/build-control',
  );
  assert.equal(
    buildControlEndpointFromWsUrl('ws://localhost:8000/ws/?session=old#fragment'),
    'http://localhost:8000/api/v1/build-control',
  );
  assert.equal(
    buildControlEndpointFromWsUrl('wss://director.example/prefix/ws?token=secret'),
    'https://director.example/prefix/api/v1/build-control',
  );
  assert.equal(buildControlEndpointFromWsUrl('not a URL'), null);
});

run('control transport: request id falls back when randomUUID is unavailable or throws', () => {
  assert.equal(createBuildControlRequestId(() => 'uuid-1', 1, 0.5), 'uuid-1');
  assert.match(createBuildControlRequestId(null, 1234, 0.25), /^bctl_/);
  assert.match(createBuildControlRequestId(() => { throw new Error('blocked'); }, 1234, 0.25), /^bctl_/);
});

run('control ack: phase and build identity must match the requested action', () => {
  assert.equal(expectedBuildControlAckPhase('pause'), 'paused');
  assert.equal(expectedBuildControlAckPhase('stop'), 'stopped');
  assert.equal(expectedBuildControlAckPhase('resume'), 'building');
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'paused', 'b1'), true);
  assert.equal(isMatchingBuildControlAck('stop', 'b1', 'stopped', 'b1'), true);
  assert.equal(isMatchingBuildControlAck('resume', 'b1', 'building', 'b1'), true);
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'building', 'b1'), false);
  assert.equal(isMatchingBuildControlAck('stop', 'b1', 'stopped', 'b2'), false);
  assert.equal(isMatchingBuildControlAck('resume', 'b1', 'building', undefined), false);
  assert.equal(isMatchingBuildControlAck('resume', null, 'building', 'b2'), true);
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'paused', 'b1', 'r1', 'r1'), true);
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'paused', 'b1', 'r1', 'r0'), false);
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'paused', 'b1', 'r1', null), false);
  // A missing control_request_id key is the round-2 Director shape.
  assert.equal(isMatchingBuildControlAck('pause', 'b1', 'paused', 'b1', 'r1', undefined), true);
});

run('control correlation: timed-out and settled request ids stay retired across later settlements', () => {
  let retired = [];
  // Sequence 1: r1 times out; its delayed pause acknowledgement is ignored.
  retired = retireBuildControlRequestId(retired, 'r1');
  assert.equal(isRetiredBuildControlRequestId(retired, 'r1'), true);
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, null, true, 'r1'), true);

  // Sequence 2: while r2 is pending and after r2 settles, delayed r1 still
  // cannot regress the UI; the matching r2 echo remains admissible.
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, 'r2', true, 'r1'), true);
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, 'r2', true, 'r2'), false);
  retired = retireBuildControlRequestId(retired, 'r2');
  assert.equal(isRetiredBuildControlRequestId(retired, 'r2'), true);
  assert.equal(isRetiredBuildControlRequestId(retired, 'r1'), true);
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, null, true, 'r1'), true);
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, null, false, undefined), false);
  // Null is not an ack, but ordinary Director phase frames serialize this
  // optional field as null and the underlying phase must still be processed.
  assert.equal(shouldIgnoreBuildControlPhaseCorrelation(retired, 'r3', true, null), false);

  for (let i = 0; i < RETIRED_CONTROL_REQUEST_ID_CAP + 4; i += 1) {
    retired = retireBuildControlRequestId(retired, `bounded-${i}`);
  }
  assert.equal(retired.length, RETIRED_CONTROL_REQUEST_ID_CAP);
  assert.equal(isRetiredBuildControlRequestId(retired, 'r1'), false);
  assert.equal(isRetiredBuildControlRequestId(retired, `bounded-${RETIRED_CONTROL_REQUEST_ID_CAP + 3}`), true);
});

run('control transport: fallback snapshot is immutable across socket, session, user, and token rotation', () => {
  const socket1 = {};
  const socket2 = {};
  const request = { sessionId: 's1', userId: 'u1', controlToken: 't1', socket: socket1 };
  assert.equal(isCurrentBuildControlTransportSnapshot(request, { ...request }), true);
  assert.equal(isCurrentBuildControlTransportSnapshot(request, { ...request, socket: socket2 }), false);
  assert.equal(isCurrentBuildControlTransportSnapshot(request, { ...request, sessionId: 's2' }), false);
  assert.equal(isCurrentBuildControlTransportSnapshot(request, { ...request, userId: 'u2' }), false);
  assert.equal(isCurrentBuildControlTransportSnapshot(request, { ...request, controlToken: 't2' }), false);
});

run('control capability: cache scrub removes only secret-bearing transport frames', () => {
  const ordinary = { type: 'chat_message', payload: { text: 'keep' } };
  const capability = { type: 'build_control_capability', payload: { control_token: 'never-cache' } };
  const scrubbed = scrubBuildControlCapabilityMessages([ordinary, capability]);
  assert.equal(scrubbed.length, 1);
  assert.equal(scrubbed[0], ordinary);
  assert.equal(JSON.stringify(scrubbed).includes('never-cache'), false);
  assert.match(sessionCacheSource, /scrubBuildControlCapabilityMessages\(parsed\.messages\)/);
  assert.match(sessionCacheSource, /message\.type === ['"]build_control_capability['"]\) return/);
  assert.match(websocketHookSource, /messages: scrubBuildControlCapabilityMessages\(safeHistoricalMessages\)/);
});

run('socket ingress: the allowlist admits every narration frame AND slide_built (port review F-1)', () => {
  const allowlist = websocketHookSource.match(/KNOWN_DIRECTOR_MESSAGE_TYPES[^[]*\[([\s\S]*?)\]\);/)[1];
  for (const type of ['slide_built', 'build_phase', 'build_event', 'build_control_capability']) {
    assert.equal(new RegExp(`['"]${type}['"]`).test(allowlist), true, `${type} missing from ingress allowlist`);
  }
});

run('control ownership: a new build cancels the old timer; retired frames do not cancel the new timer', () => {
  assert.equal(shouldRetirePendingControl('b1', 'b1', [], 'b2'), true);
  assert.equal(shouldRetirePendingControl('b2', 'b2', ['b1'], 'b1'), false);
  assert.equal(shouldRetirePendingControl(null, 'b1', [], 'b2'), true);
  assert.equal(shouldRetirePendingControl('b1', 'b1', [], 'b1'), false);
  assert.equal(isMatchingBuildControlBuild('b2', 'b1'), false);
  assert.equal(isMatchingBuildControlBuild('b2', 'b2'), true);
});

run('control pending: resume requests are pending alongside pause and stop', () => {
  assert.equal(isBuildControlRequestPending('pause_requested'), true);
  assert.equal(isBuildControlRequestPending('resume_requested'), true);
  assert.equal(isBuildControlRequestPending('stop_requested'), true);
  assert.equal(isBuildControlRequestPending('paused'), false);
  assert.equal(isBuildControlRequestPending('running'), false);
});

run('control UI: resume request stays visible and disables overlapping controls', () => {
  assert.match(pauseStopControlSource, /const resuming = control === ['"]resume_requested['"]/);
  assert.match(pauseStopControlSource, /\(paused \|\| stopped \|\| resuming\)/);
  assert.match(pauseStopControlSource, /disabled=\{resuming\}/);
  assert.match(pauseStopControlSource, /disabled=\{pending\}/);
});

run('control transport: HTTP timeout precedes ack timeout and fallback reuses request_id', () => {
  const httpTimeout = websocketHookSource.match(/BUILD_CONTROL_HTTP_TIMEOUT_MS\s*=\s*(\d+)/);
  const ackTimeout = narrationHookSource.match(/CONTROL_ACK_TIMEOUT_MS\s*=\s*(\d+)/);
  assert.ok(httpTimeout);
  assert.ok(ackTimeout);
  assert.ok(Number(httpTimeout[1]) > 0);
  assert.ok(Number(httpTimeout[1]) < Number(ackTimeout[1]));
  assert.match(websocketHookSource, /const requestId = createBuildControlRequestId\(/);
  assert.ok((websocketHookSource.match(/request_id: requestId/g) || []).length >= 2);
  assert.match(websocketHookSource, /controller\?\.abort\(\)/);
  assert.match(websocketHookSource, /sendWsFallbackOnce\(\)/);
  assert.match(websocketHookSource, /type === ['"]build_control_capability['"]/);
  assert.match(websocketHookSource, /build_control_capability=1/);
  assert.match(websocketHookSource, /control_token: requestControlToken/);
  assert.match(websocketHookSource, /user_id: requestUserId/);
  assert.match(websocketHookSource, /isCurrentBuildControlTransportSnapshot\(transportSnapshot/);
});

run('template exclusion: disabled narration advances the transcript cursor', () => {
  assert.match(
    narrationHookSource,
    /if \(!enabled\) \{\s*processedCountRef\.current = messages\.length\s*return\s*\}/,
  );
});

run('typed stage dots: matrix is exactly Plan -> Validate -> Render; style rides Render', () => {
  const match = stageDotsSource.match(/const TYPED_STAGES[^=]*=\s*\[([\s\S]*?)\n\]/);
  assert.ok(match, 'TYPED_STAGES declaration not found');
  const labels = [...match[1].matchAll(/label:\s*['"]([^'"]+)['"]/g)].map((item) => item[1]);
  eqJson(labels, ['Plan', 'Validate', 'Render']);
  // v2: the SB stage_d 'style' beat maps onto the Render dot — never a 4th dot.
  assert.match(match[1], /'style'/);
  assert.doesNotMatch(match[1], /label:\s*['"]Style['"]/);
});

run('stage icons (v2 R2): every documented slug has a key; unknowns default', () => {
  const { iconKeyForStage } = mod.exports;
  const slugs = ['framing', 'research', 'outline', 'slide_layouts', 'slide_research',
    'theme', 'package', 'plan', 'validate', 'render', 'insert', 'content', 'qa', 'style'];
  for (const slug of slugs) {
    assert.equal(iconKeyForStage(slug), slug, `${slug} must map to its own icon key`);
  }
  assert.equal(iconKeyForStage('progress'), 'default');
  assert.equal(iconKeyForStage('unknown-slug'), 'default');
  assert.equal(iconKeyForStage(null), 'default');
  assert.equal(iconKeyForStage(undefined), 'default');
});

// ---------------------------------------------------------------------------
// parseEphemeralText
// ---------------------------------------------------------------------------
run('parse: SB per-slide callback text -> slide scope, 0-based index', () => {
  const p = parseEphemeralText('Building slide 4/9 — chart…');
  assert.equal(p.scope, 'slide');
  assert.equal(p.slideIndex, 3);
  assert.equal(p.slideCount, 9);
  assert.equal(p.stage, 'render');
});
run('parse: "slide N of M" variant', () => {
  const p = parseEphemeralText('Composing slide 2 of 7');
  assert.equal(p.scope, 'slide');
  assert.equal(p.slideIndex, 1);
  assert.equal(p.slideCount, 7);
});
run('parse: canned Director progress lines map to stages', () => {
  assert.equal(parseEphemeralText('Reviewing your topic and audience…').stage, 'framing');
  assert.equal(parseEphemeralText('Researching the topic for context…').stage, 'research');
  assert.equal(parseEphemeralText('Drafting the deck outline…').stage, 'outline');
  assert.equal(parseEphemeralText('Choosing layouts for each slide…').stage, 'slide_layouts');
  assert.equal(parseEphemeralText('Researching each slide in detail…').stage, 'slide_research');
  assert.equal(parseEphemeralText('Packaging your outline and picking a theme…').stage, 'package');
});
run('parse: unknown text -> deck/progress', () => {
  const p = parseEphemeralText('Thinking about typography…');
  assert.equal(p.scope, 'deck');
  assert.equal(p.stage, 'progress');
});

// ---------------------------------------------------------------------------
// interpretStatus
// ---------------------------------------------------------------------------
run('status: outline gen -> planning', () => {
  const i = interpretStatus('Generating presentation outline...', 'generating');
  assert.equal(i.phase, 'planning');
});
run('status: standard-path content gen -> building (the ONLY standard-path build signal)', () => {
  const i = interpretStatus('Generating presentation content...', 'generating');
  assert.equal(i.phase, 'building');
  assert.equal(i.event.stage, 'content');
});
run('status: extended phase statuses -> building', () => {
  for (const t of [
    'Generating hero slides...',
    'Creating presentation layout...',
    'Composing content slides...',
    'Composing 9 slides (v2 path)...',
  ]) {
    assert.equal(interpretStatus(t, 'generating').phase, 'building', t);
  }
});

// ---------------------------------------------------------------------------
// Reducer — heuristic lifecycle (against today's production Director)
// ---------------------------------------------------------------------------
run('lifecycle: idle -> planning on thinking status; Q&A turn recedes to idle', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'status', status: 'thinking', text: 'Working…', ts: T0 });
  assert.equal(s.active, true);
  assert.equal(s.phase, 'planning');
  // Director answered with a question — no strawman; turn completes.
  s = step(s, { type: 'status', status: 'complete', text: '', ts: T0 + 5 });
  assert.equal(s.active, false);
  assert.equal(s.phase, 'idle');
});

run('lifecycle: full heuristic build — planning -> strawman -> awaiting -> building -> complete', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'ephemeral', id: 'e0', text: 'Reviewing your topic and audience…', ts: T0 + 1 });
  s = step(s, { type: 'ephemeral', id: 'e1', text: 'Drafting the deck outline…', ts: T0 + 2 });
  assert.equal(s.deckEvents.length, 2);
  const ghosts = [
    { index: 0, title: 'Why now', points: ['a', 'b'] },
    { index: 1, title: 'Market', points: ['c'] },
    { index: 2, title: 'Ask', points: [] },
  ];
  s = step(s, { type: 'strawman', ghosts, ts: T0 + 3 });
  assert.equal(s.phase, 'strawman');
  assert.equal(s.slideCount, 3);
  eqJson(s.slideStates, { 0: 'pending', 1: 'pending', 2: 'pending' });
  s = step(s, { type: 'awaiting_user', ts: T0 + 4 });
  assert.equal(s.phase, 'awaiting_user');
  s = step(s, { type: 'accepted', ts: T0 + 5 });
  assert.equal(s.phase, 'building');
  // Extended-path per-slide ephemeral
  s = step(s, { type: 'ephemeral', id: 'e2', text: 'Building slide 1/3 — text heavy…', ts: T0 + 6 });
  assert.equal(s.slideStates[0], 'building');
  assert.equal(s.focusSlide, 0);
  assert.equal(s.slideEvents[0].length, 1);
  s = step(s, { type: 'final_url', ts: T0 + 9 });
  assert.equal(s.phase, 'complete');
  assert.equal(s.slideStates[0], 'built');
  assert.equal(s.slidesDone, 3);
  s = step(s, { type: 'dismiss' });
  assert.equal(s.active, false);
});

run('lifecycle: standard path (no per-slide text) still narrates via status', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'strawman', ghosts: [{ index: 0, title: 'A', points: [] }], ts: T0 + 1 });
  s = step(s, { type: 'accepted', ts: T0 + 2 });
  s = step(s, { type: 'status', status: 'generating', text: 'Generating presentation content...', ts: T0 + 3 });
  assert.equal(s.phase, 'building');
  assert.equal(s.deckEvents.some((e) => e.stage === 'content'), true);
});

run('ephemeral: duplicate ids ignored; caps enforced', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'ephemeral', id: 'dup', text: 'X', ts: T0 });
  s = step(s, { type: 'ephemeral', id: 'dup', text: 'X', ts: T0 });
  assert.equal(s.deckEvents.length, 1);
  for (let i = 0; i < DECK_EVENT_CAP + 10; i++) {
    s = step(s, { type: 'ephemeral', id: `e${i}`, text: `Line ${i}`, ts: T0 + i });
  }
  assert.equal(s.deckEvents.length, DECK_EVENT_CAP);
  // slide event cap
  for (let i = 0; i < SLIDE_EVENT_CAP + 5; i++) {
    s = step(s, { type: 'ephemeral', id: `s${i}`, text: `Building slide 1/9 — pass ${i}`, ts: T0 + 100 + i });
  }
  assert.equal(s.slideEvents[0].length, SLIDE_EVENT_CAP);
});

run('status while building never regresses phase to planning', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'strawman', ghosts: [{ index: 0, title: 'A', points: [] }], ts: T0 + 1 });
  s = step(s, { type: 'accepted', ts: T0 + 2 });
  s = step(s, { type: 'status', status: 'generating', text: 'Generating presentation outline...', ts: T0 + 3 });
  assert.equal(s.phase, 'building');
});

// ---------------------------------------------------------------------------
// Typed frames supersede heuristics
// ---------------------------------------------------------------------------
run('typed: first typed frame flips source; later ephemeral ignored', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, {
    type: 'typed_phase',
    payload: { build_id: 'b1', phase: 'building', label: 'Building your slides…', slide_count: 5 },
    ts: T0 + 1,
  });
  assert.equal(s.source, 'typed');
  assert.equal(s.buildId, 'b1');
  assert.equal(s.slideCount, 5);
  const before = s.deckEvents.length;
  s = step(s, { type: 'ephemeral', id: 'e9', text: 'Building slide 2/5 — chart…', ts: T0 + 2 });
  assert.equal(s.deckEvents.length, before);
  assert.equal(s.slideEvents[1], undefined);
});

run('typed: slide events drive states incl. error + qa; seq dedupe on replay', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 1, scope: 'slide', slide_index: 2, stage: 'plan', status: 'done', text: 'Layout chosen: quad grid', detail: 'Four KPIs' },
    ts: T0,
  });
  assert.equal(s.slideStates[2], 'building');
  assert.equal(s.slideEvents[2][0].detail, 'Four KPIs');
  // replay same seq (reconnect)
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 1, scope: 'slide', slide_index: 2, stage: 'plan', status: 'done', text: 'Layout chosen: quad grid' },
    ts: T0 + 1,
  });
  assert.equal(s.slideEvents[2].length, 1);
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 2, scope: 'slide', slide_index: 3, stage: 'render', status: 'error', text: 'Chart atom failed' },
    ts: T0 + 2,
  });
  assert.equal(s.slideStates[3], 'error');
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 3, scope: 'slide', slide_index: 2, stage: 'qa', status: 'progress', text: 'Checking slide 3…' },
    ts: T0 + 3,
  });
  assert.equal(s.slideStates[2], 'qa');
});

run('typed: slide_built sets built + thumbnail + qa verdict; built never regresses', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_slide_built',
    payload: { session_id: 'x', presentation_id: 'p', slide_index: 1, slide_count: 4, build_id: 'b1', thumbnail_url: 'https://t/1.png', qa_verdict: 'green' },
    ts: T0,
  });
  assert.equal(s.slideStates[1], 'built');
  assert.equal(s.slidesDone, 1);
  assert.equal(s.thumbnails[1], 'https://t/1.png');
  assert.equal(s.qaVerdicts[1], 'green');
  assert.equal(s.slideCount, 4);
  // A late 'building' event must not regress the built state
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 9, scope: 'slide', slide_index: 1, stage: 'render', status: 'progress', text: 'late' },
    ts: T0 + 1,
  });
  assert.equal(s.slideStates[1], 'built');
});

run('typed: paused/stopped phases set control; building resumes it', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'x' }, ts: T0 });
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'paused', label: 'Paused' }, ts: T0 + 1 });
  assert.equal(s.control, 'paused');
  assert.equal(s.phase, 'paused');
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'x' }, ts: T0 + 2 });
  assert.equal(s.control, 'running');
  assert.equal(s.phase, 'building');
});

run('typed: new build_id resets completed/dismissed state and seq dedupe', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 0, scope: 'slide', slide_index: 2, stage: 'content', status: 'done', text: 'old build slide' },
    ts: T0,
  });
  s = step(s, { type: 'final_url', ts: T0 + 1 });
  s = step(s, { type: 'dismiss' });
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b2', seq: 0, scope: 'deck', stage: 'framing', status: 'started', text: 'new build starts' },
    ts: T0 + 2,
  });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.deckEvents.length, 1);
  assert.equal(s.deckEvents[0].text, 'new build starts');
  assert.equal(s.slideStates[2], undefined);
});

run('typed: retired b1 cannot resurrect after b2 via phase/event/sync/slide_built', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 0, scope: 'deck', stage: 'framing', status: 'started', text: 'b1 starts' },
    ts: T0,
  });
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b2', seq: 0, scope: 'deck', stage: 'framing', status: 'started', text: 'b2 starts' },
    ts: T0 + 1,
  });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.retiredBuildIds.includes('b1'), true);

  const staleActions = [
    {
      type: 'typed_phase',
      payload: { build_id: 'b1', phase: 'stopped', label: 'Old build stopped' },
      ts: T0 + 2,
    },
    {
      type: 'typed_event',
      payload: { build_id: 'b1', seq: 1, scope: 'deck', stage: 'outline', status: 'done', text: 'late b1 event' },
      ts: T0 + 3,
    },
    {
      type: 'typed_sync',
      buildState: { build_id: 'b1', phase: 'paused', slide_count: 9, slides: { 8: 'built' } },
      ts: T0 + 4,
    },
    {
      type: 'typed_slide_built',
      payload: { session_id: 'x', presentation_id: 'old', build_id: 'b1', slide_index: 8, slide_count: 9 },
      ts: T0 + 5,
    },
  ];
  for (const action of staleActions) {
    s = step(s, action);
    assert.equal(s.buildId, 'b2', action.type);
    assert.equal(s.phase, 'planning', action.type);
    assert.equal(s.deckEvents.length, 1, action.type);
    assert.equal(s.deckEvents[0].text, 'b2 starts', action.type);
    assert.equal(s.slideStates[8], undefined, action.type);
  }
});

run('typed: identity-less slide_built cannot contaminate an identified build', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_phase',
    payload: { build_id: 'b2', phase: 'building', label: 'Building', slide_count: 2 },
    ts: T0,
  });
  s = step(s, {
    type: 'typed_slide_built',
    payload: { session_id: 'x', presentation_id: 'old', slide_index: 1, slide_count: 9 },
    ts: T0 + 1,
  });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.slideCount, 2);
  assert.equal(s.slideStates[1], undefined);
});

run('typed: retired build ids are bounded and survive fresh build transitions', () => {
  let s = initialNarrationState();
  for (let i = 0; i < RETIRED_BUILD_ID_CAP + 5; i++) {
    s = step(s, {
      type: 'typed_phase',
      payload: { build_id: `b${i}`, phase: 'building', label: `Build ${i}` },
      ts: T0 + i,
    });
  }
  assert.equal(s.buildId, `b${RETIRED_BUILD_ID_CAP + 4}`);
  assert.equal(s.retiredBuildIds.length, RETIRED_BUILD_ID_CAP);
  assert.equal(s.retiredBuildIds.includes(`b${RETIRED_BUILD_ID_CAP + 3}`), true);
  assert.equal(s.retiredBuildIds.includes('b0'), false);
});

run('control timeout: optimistic request reverts only if ack never arrived', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'control', control: 'pause_requested', ts: T0 });
  s = step(s, { type: 'control_timeout', requested: 'pause_requested', fallback: 'running', ts: T0 + 1 });
  assert.equal(s.control, 'running');

  s = step(initialNarrationState(), { type: 'control', control: 'pause_requested', ts: T0 });
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'paused', label: 'Paused' }, ts: T0 + 1 });
  s = step(s, { type: 'control_timeout', requested: 'pause_requested', fallback: 'running', ts: T0 + 2 });
  assert.equal(s.control, 'paused');
});

run('control ack: ordinary building phase does not erase a pending pause/stop request', () => {
  for (const requested of ['pause_requested', 'stop_requested']) {
    let s = initialNarrationState();
    s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Building' }, ts: T0 });
    s = step(s, { type: 'control', control: requested, ts: T0 + 1 });
    s = step(s, {
      type: 'typed_phase',
      payload: { build_id: 'b1', phase: 'building', label: 'Still building' },
      pendingControl: requested,
      ts: T0 + 2,
    });
    assert.equal(s.control, requested);
  }
});

run('control ack: late old phase cannot hide a newer pending action', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Building' }, ts: T0 });
  s = step(s, { type: 'control', control: 'stop_requested', ts: T0 + 1 });
  s = step(s, {
    type: 'typed_phase',
    payload: { build_id: 'b1', phase: 'paused', label: 'Paused', control_request_id: 'old-pause' },
    pendingControl: 'stop_requested',
    ts: T0 + 2,
  });
  assert.equal(s.phase, 'paused');
  assert.equal(s.control, 'stop_requested');
  s = step(s, {
    type: 'typed_phase',
    payload: { build_id: 'b1', phase: 'stopped', label: 'Stopped', control_request_id: 'current-stop' },
    ts: T0 + 3,
  });
  assert.equal(s.phase, 'stopped');
  assert.equal(s.control, 'stopped');
});

// ---------------------------------------------------------------------------
// Pin / focus
// ---------------------------------------------------------------------------
run('focus auto-follows latest slide activity unless pinned', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'ephemeral', id: 'a', text: 'Building slide 1/3 — a', ts: T0 });
  s = step(s, { type: 'ephemeral', id: 'b', text: 'Building slide 2/3 — b', ts: T0 + 1 });
  assert.equal(s.focusSlide, 1);
  s = step(s, { type: 'pin', slideIndex: 0 });
  s = step(s, { type: 'ephemeral', id: 'c', text: 'Building slide 3/3 — c', ts: T0 + 2 });
  assert.equal(s.focusSlide, 0);
  s = step(s, { type: 'pin', slideIndex: null });
  s = step(s, { type: 'ephemeral', id: 'd', text: 'Building slide 3/3 — d', ts: T0 + 3 });
  assert.equal(s.focusSlide, 2);
});

// ---------------------------------------------------------------------------
// Snapshot round-trip
// ---------------------------------------------------------------------------
run('snapshot: active mid-build state round-trips; stale/complete snapshots rejected', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'session_start', ts: T0 });
  s = step(s, { type: 'strawman', ghosts: [{ index: 0, title: 'A', points: ['p'] }], ts: T0 + 1 });
  s = step(s, { type: 'accepted', ts: T0 + 2 });
  const raw = serializeNarration(s, T0 + 3);
  const restored = deserializeNarration(raw, T0 + 10, 60_000);
  assert.ok(restored);
  assert.equal(restored.phase, 'building');
  assert.equal(restored.ghosts[0].title, 'A');
  // stale
  assert.equal(deserializeNarration(raw, T0 + 3 + 120_000, 60_000), null);
  // completed states never resurrect
  let done = step(s, { type: 'final_url', ts: T0 + 4 });
  assert.equal(deserializeNarration(serializeNarration(done, T0 + 5), T0 + 6, 60_000), null);
  // garbage
  assert.equal(deserializeNarration('{not json', T0, 60_000), null);
  assert.equal(deserializeNarration(null, T0, 60_000), null);
});

run('snapshot: pre-retired-id snapshots hydrate compatibly', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Building' }, ts: T0 });
  const oldSnapshot = JSON.parse(serializeNarration(s, T0 + 1));
  delete oldSnapshot.state.retiredBuildIds;
  const restored = deserializeNarration(JSON.stringify(oldSnapshot), T0 + 2, 60_000);
  assert.ok(restored);
  eqJson(restored.retiredBuildIds, []);
});

run('snapshot: optimistic controls hydrate only as stable phase-derived controls', () => {
  const cases = [
    { phase: 'building', requested: 'pause_requested', expected: 'running' },
    { phase: 'building', requested: 'stop_requested', expected: 'running' },
    { phase: 'paused', requested: 'resume_requested', expected: 'paused' },
    { phase: 'stopped', requested: 'resume_requested', expected: 'stopped' },
  ];
  for (const item of cases) {
    let s = initialNarrationState();
    s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: item.phase, label: item.phase }, ts: T0 });
    s = step(s, { type: 'control', control: item.requested, ts: T0 + 1 });
    const restored = deserializeNarration(serializeNarration(s, T0 + 2), T0 + 3, 60_000);
    assert.ok(restored);
    assert.equal(restored.control, item.expected, `${item.phase}/${item.requested}`);
  }
});

run('typed: content/done marks built (standard-path per-slide completion)', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 1, scope: 'slide', slide_index: 0, stage: 'content', status: 'started', text: 'Writing slide 1' },
    ts: T0,
  });
  assert.equal(s.slideStates[0], 'building');
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 2, scope: 'slide', slide_index: 0, stage: 'content', status: 'done', text: 'Slide 1 written' },
    ts: T0 + 1,
  });
  assert.equal(s.slideStates[0], 'built');
  assert.equal(s.slidesDone, 1);
});

run('typed_sync: reconnect build_state authoritatively re-hydrates phase, slides, and control', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_sync',
    buildState: { build_id: 'b9', phase: 'building', slide_count: 4, slides: { 0: 'built', 1: 'building', 2: 'pending', 3: 'pending' } },
    ts: T0,
  });
  assert.equal(s.active, true);
  assert.equal(s.phase, 'building');
  assert.equal(s.source, 'typed');
  assert.equal(s.buildId, 'b9');
  assert.equal(s.slideCount, 4);
  assert.equal(s.slideStates[0], 'built');
  assert.equal(s.slidesDone, 1);
  // paused build_state sets control
  let p = step(initialNarrationState(), {
    type: 'typed_sync',
    buildState: { build_id: 'b9', phase: 'paused', slide_count: 2, slides: { 0: 'built', 1: 'pending' } },
    ts: T0,
  });
  assert.equal(p.phase, 'paused');
  assert.equal(p.control, 'paused');
  // Identity-less completed garbage never activates a cold reducer.
  assert.equal(step(initialNarrationState(), { type: 'typed_sync', buildState: { phase: 'complete' }, ts: T0 }).active, false);
  assert.equal(step(initialNarrationState(), { type: 'typed_sync', buildState: null, ts: T0 }).active, false);
  assert.equal(step(initialNarrationState(), { type: 'typed_sync', buildState: 'junk', ts: T0 }).active, false);

  // A live request is preserved only when the hook proves it owns a timer.
  let orphaned = step(s, { type: 'control', control: 'stop_requested', ts: T0 + 1 });
  orphaned = step(orphaned, {
    type: 'typed_sync',
    buildState: { build_id: 'b9', phase: 'building', slide_count: 4 },
    ts: T0 + 2,
  });
  assert.equal(orphaned.control, 'running');
  let live = step(s, { type: 'control', control: 'stop_requested', ts: T0 + 1 });
  live = step(live, {
    type: 'typed_sync',
    buildState: { build_id: 'b9', phase: 'building', slide_count: 4 },
    pendingControl: 'stop_requested',
    ts: T0 + 2,
  });
  assert.equal(live.control, 'stop_requested');
});

run('typed_sync: terminal snapshots reconcile build identity and terminal phase', () => {
  let s = initialNarrationState();
  s = step(s, {
    type: 'typed_sync',
    buildState: { build_id: 'b1', phase: 'building', slide_count: 2, slides: { 0: 'built', 1: 'pending' } },
    ts: T0,
  });
  s = step(s, {
    type: 'typed_sync',
    buildState: { build_id: 'b2', phase: 'error', slide_count: 3, slides: { 0: 'built', 1: 'error', 2: 'pending' } },
    ts: T0 + 1,
  });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.phase, 'error');
  assert.equal(s.active, true);
  assert.equal(s.retiredBuildIds.includes('b1'), true);
  assert.equal(s.slideCount, 3);
  assert.equal(s.slideStates[1], 'error');

  s = step(s, {
    type: 'typed_sync',
    buildState: { build_id: 'b2', phase: 'complete', slide_count: 3, slides: { 0: 'built', 1: 'built', 2: 'built' } },
    ts: T0 + 2,
  });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.phase, 'complete');
  assert.equal(s.active, false);
  assert.equal(s.slidesDone, 3);
});

run('no qa phase: building goes straight to complete when Stage F is absent', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'x', slide_count: 2 }, ts: T0 });
  s = step(s, { type: 'typed_slide_built', payload: { session_id: 'x', presentation_id: 'p', build_id: 'b1', slide_index: 0, slide_count: 2 }, ts: T0 + 1 });
  s = step(s, { type: 'typed_slide_built', payload: { session_id: 'x', presentation_id: 'p', build_id: 'b1', slide_index: 1, slide_count: 2 }, ts: T0 + 2 });
  s = step(s, { type: 'final_url', ts: T0 + 3 });
  assert.equal(s.phase, 'complete'); // never visited 'qa'
  assert.equal(s.slidesDone, 2);
});

run('qa phase: typed qa phase + slide qa events + verdicts flow', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'x', slide_count: 2 }, ts: T0 });
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'qa', label: 'Running quality checks…' }, ts: T0 + 1 });
  assert.equal(s.phase, 'qa');
  s = step(s, {
    type: 'typed_event',
    payload: { build_id: 'b1', seq: 5, scope: 'slide', slide_index: 0, stage: 'qa', status: 'progress', text: 'Checking slide 1 for overflow…' },
    ts: T0 + 2,
  });
  assert.equal(s.slideStates[0], 'qa');
  s = step(s, {
    type: 'typed_slide_built',
    payload: { session_id: 'x', presentation_id: 'p', build_id: 'b1', slide_index: 0, slide_count: 2, thumbnail_url: 'https://t/0.png', qa_verdict: 'green' },
    ts: T0 + 3,
  });
  assert.equal(s.slideStates[0], 'built');
  assert.equal(s.qaVerdicts[0], 'green');
});

run('phaseLabelFor covers every phase', () => {
  for (const p of ['planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error']) {
    assert.ok(phaseLabelFor(p).length > 0, p);
  }
});

// ---------------------------------------------------------------------------
// Canvas v2 R3 — center-stage policy, export gating, build-id adoption
// ---------------------------------------------------------------------------

run('v2 center stage: flag off / template / no id / settled phases => default', () => {
  const { centerStageFor } = mod.exports;
  const base = {
    narrationEnabled: true, templateOverride: false, phase: 'building',
    buildPresentationId: 'pres-1', finalPresentationUrl: null,
  };
  assert.equal(centerStageFor(base), 'final_fill');
  assert.equal(centerStageFor({ ...base, narrationEnabled: false }), 'default');
  assert.equal(centerStageFor({ ...base, templateOverride: true }), 'default');
  assert.equal(centerStageFor({ ...base, buildPresentationId: null }), 'default');
  assert.equal(centerStageFor({ ...base, finalPresentationUrl: 'https://layout/p/pres-1' }), 'default');
  for (const phase of ['idle', 'planning', 'strawman', 'awaiting_user', 'complete']) {
    assert.equal(centerStageFor({ ...base, phase }), 'default', phase);
  }
  // partial decks stay on stage through halts and errors (stop is non-destructive)
  for (const phase of ['qa', 'finalizing', 'paused', 'stopped', 'error']) {
    assert.equal(centerStageFor({ ...base, phase }), 'final_fill', phase);
  }
});

run('v2 export gating: settled artifacts only; inactive narration keeps legacy behavior', () => {
  const { exportControlsAllowed } = mod.exports;
  assert.equal(exportControlsAllowed(false, 'building'), true); // flag-off/legacy
  for (const phase of ['awaiting_user', 'complete', 'idle']) {
    assert.equal(exportControlsAllowed(true, phase), true, phase);
  }
  for (const phase of ['planning', 'strawman', 'building', 'qa', 'finalizing', 'paused', 'stopped', 'error']) {
    assert.equal(exportControlsAllowed(true, phase), false, phase);
  }
});

run('v2 build id: adopted from slide_built and build_phase; qa_skipped stored', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', presentation_id: 'pres-9' }, ts: T0 });
  assert.equal(s.buildPresentationId, 'pres-9');
  s = step(s, {
    type: 'typed_slide_built',
    payload: { presentation_id: 'pres-9', slide_index: 0, slide_count: 3, build_id: 'b1', qa_verdict: 'amber', qa_skipped_reason: 'screenshot timeout' },
    ts: T0 + 1,
  });
  assert.equal(s.buildPresentationId, 'pres-9');
  assert.equal(s.qaSkipped[0], 'screenshot timeout');
  assert.equal(s.qaVerdicts[0], 'amber');
});

run('v2 build id: a fresh build resets it; retired-build frames cannot set it', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', presentation_id: 'pres-old' }, ts: T0 });
  // new build id supersedes: state resets, old id must not leak
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b2', phase: 'planning' }, ts: T0 + 10 });
  assert.equal(s.buildId, 'b2');
  assert.equal(s.buildPresentationId, null);
  // a delayed frame from the retired b1 is ignored entirely
  const after = step(s, {
    type: 'typed_slide_built',
    payload: { presentation_id: 'pres-old', slide_index: 1, slide_count: 3, build_id: 'b1' },
    ts: T0 + 11,
  });
  assert.equal(after.buildPresentationId, null);
  assert.equal(after.slideStates[1], undefined);
});

run('v2 snapshot: v2 roundtrips the new fields; v1 payloads are rejected', () => {
  let s = initialNarrationState();
  s = step(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', presentation_id: 'pres-9' }, ts: T0 });
  s = step(s, {
    type: 'typed_slide_built',
    payload: { presentation_id: 'pres-9', slide_index: 0, slide_count: 3, build_id: 'b1', qa_skipped_reason: 'x' },
    ts: T0 + 1,
  });
  const raw = serializeNarration(s, T0 + 2);
  const restored = deserializeNarration(raw, T0 + 3, 60_000);
  assert.ok(restored);
  assert.equal(restored.buildPresentationId, 'pres-9');
  assert.equal(restored.qaSkipped[0], 'x');
  const v1 = JSON.stringify({ v: 1, savedAt: T0 + 2, state: s });
  assert.equal(deserializeNarration(v1, T0 + 3, 60_000), null);
  // forward-compat: a v2 snapshot missing the new fields normalizes them in
  const stripped = JSON.parse(raw);
  delete stripped.state.qaSkipped;
  delete stripped.state.buildPresentationId;
  const normalized = deserializeNarration(JSON.stringify(stripped), T0 + 3, 60_000);
  assert.ok(normalized);
  eqJson(normalized.qaSkipped, {});
  assert.equal(normalized.buildPresentationId, null);
});

// ---------------------------------------------------------------------------
// Canvas v2 P5 — load-bearing source pins for the stage rework
// ---------------------------------------------------------------------------

const pageSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8');
const presentationAreaSource = fs.readFileSync(
  new URL('../components/builder/presentation-area.tsx', import.meta.url),
  'utf8',
);
const viewerSource = fs.readFileSync(
  new URL('../components/presentation-viewer.tsx', import.meta.url),
  'utf8',
);
const frameGlowSource = fs.readFileSync(
  new URL('../components/build-narration/slide-frame-glow.tsx', import.meta.url),
  'utf8',
);

run('v2 pins: the D11 blank-URL guard is gone; centerStageFor drives the memo', () => {
  assert.ok(!/activeVersion === 'strawman'[\s\S]{0,120}blankPresentationUrl \|\| null/.test(pageSource),
    'old D11 blank-URL branch still present');
  assert.ok(pageSource.includes('centerStageFor({'), 'centerStageFor not consumed by the page');
  assert.ok(pageSource.includes('getPresentationViewerUrl(buildNarration.buildPresentationId)'),
    'final_fill URL derivation missing');
});

run('v2 pins: hiddenStrawman is gone; export gating + planning-only toolbar suppression', () => {
  assert.ok(!presentationAreaSource.includes('hiddenStrawman'), 'hiddenStrawman survives');
  assert.ok(presentationAreaSource.includes('exportControlsAllowed(narrationActive, narrationPhase)'));
  assert.ok(presentationAreaSource.includes("narrationPhase === 'planning'"), 'toolbar suppression changed');
  assert.ok(presentationAreaSource.includes('isGenerating={narrationActive ? false'),
    'legacy loader must never mount under narration');
});

run('v2 pins: viewer slots are conditional and fullscreen-suppressed', () => {
  for (const slot of ['stageChrome?.ribbon', 'stageChrome?.footer', 'stageChrome?.frame', 'stageChrome?.placeholder']) {
    assert.ok(viewerSource.includes(slot), `${slot} missing`);
  }
  assert.ok((viewerSource.match(/!isFullscreen && stageChrome\?\./g) || []).length >= 4,
    'every slot must be gated on !isFullscreen');
});

run('v2 pins: click-shield only during write phases; glow never intercepts', () => {
  assert.match(frameGlowSource, /SHIELD_PHASES[^=]*=\s*\['building',\s*'qa',\s*'finalizing'\]/);
  assert.ok(frameGlowSource.includes("'pointer-events-none absolute -inset-[3px]"), 'glow wrapper must be pointer-events-none');
});

console.log(`build-narration heuristics: ${testCount} tests passed`);
