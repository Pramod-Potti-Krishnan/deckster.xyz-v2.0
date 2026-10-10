// D-A5 (Studio half): the "N of M built" counter and the built-terminal rule.
// Run: pnpm test:build-counter-built-terminal   (plain node — transpile + vm, no test runner, no git)
//
// What this pins:
//   1. The EXACT frame sequence Director UAT sent for build bld_2a991ea3f638 (deck e28fdbec, 10 Oct 2026; per-frame log in
//      streams/slide/RESULT-D-A5.md), replayed through the REAL useBuildNarration hook and reducer the way the page feeds them.
//      The counter goes 1, 2, 3 and never drops, with the flag on AND off: that sequence never needed the flag.
//   2. The two reducer paths that CAN drop the count (a late per-slide qa event; a reconnect snapshot behind the live state)
//      are closed by NEXT_PUBLIC_STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED, and behave exactly as before with it off.
//   3. built -> error still shows; a new build id resets the count.
//   4. Mutation checks: each rule is re-run against a deliberately broken copy of the source and must be caught.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const SRC = {
  heuristics: read('lib/build-narration-heuristics.ts'),
  controlHelpers: read('lib/build-control-helpers.ts'),
  hook: read('hooks/use-build-narration.ts'),
  page: read('app/builder/page.tsx'),
  wsHook: read('hooks/use-deckster-websocket-v2.ts'),
  flagModule: read('lib/studio-build-counter.ts'),
  envExample: read('.env.example'),
};
const COMPILER = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 };
const transpile = (source) => ts.transpileModule(source, { compilerOptions: COMPILER }).outputText;

function evalModule(source, sandbox = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(transpile(source), { module: mod, exports: mod.exports, URL, ...sandbox });
  return mod.exports;
}

const T0 = 1_000_000;

// The real hook, run in a bare vm with a deterministic React shim (same approach as test-build-narration.mjs).
function makeEnv(mutate = {}) {
  const heuristicsSource = (mutate.heuristics || ((s) => s))(SRC.heuristics);
  const hookSource = (mutate.hook || ((s) => s))(SRC.hook);
  const reducerExports = evalModule(heuristicsSource);
  const controlExports = evalModule(SRC.controlHelpers);

  function createHarness(initial = {}) {
    let inputs = {
      enabled: true, sessionId: 'sess-e28fdbec', messages: [], currentStatus: null, slideStructure: null,
      isGeneratingFinal: false, isGeneratingStrawman: false, finalPresentationUrl: null, ...initial,
    };
    let index = 0, dirty = false, time = T0, api;
    const slots = [], effects = [], storage = new Map();
    const memo = (value, deps) => {
      const i = index++, old = slots[i];
      if (!old || deps.some((dep, j) => dep !== old.deps[j])) slots[i] = { value: value(), deps };
      return slots[i].value;
    };
    const react = {
      useRef(value) { return slots[index++] ||= { current: value }; },
      useMemo: memo,
      useCallback(callback, deps) { return memo(() => callback, deps); },
      useReducer(reducer, value, init) {
        const i = index++;
        slots[i] ||= { value: init ? init(value) : value };
        return [slots[i].value, (action) => {
          const next = reducer(slots[i].value, action);
          if (next !== slots[i].value) { slots[i].value = next; dirty = true; }
        }];
      },
      useEffect(setup, deps) {
        const i = index++, old = slots[i];
        if (!old || deps.some((dep, j) => dep !== old.deps[j])) effects.push(() => {
          old?.cleanup?.(); slots[i].cleanup = setup();
        });
        slots[i] = { deps, cleanup: old?.cleanup };
      },
    };
    const hook = { exports: {} };
    vm.runInNewContext(transpile(hookSource), {
      module: hook, exports: hook.exports,
      require(name) {
        if (name === 'react') return react;
        if (name === '@/lib/build-narration-heuristics') return reducerExports;
        if (name === '@/lib/build-control-helpers') return controlExports;
        if (name === '@/hooks/use-toast') return { toast() {} };
        throw Error(`Unexpected dependency ${name}`);
      },
      window: { sessionStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) } },
      Date: class extends Date { static now() { return time; } },
      setTimeout() { return 1; },
      clearTimeout() {},
    });
    function render() {
      index = 0; dirty = false; api = hook.exports.useBuildNarration(inputs);
      while (effects.length) effects.shift()();
    }
    function flush() { let n = 0; while (dirty) { assert.ok(++n < 30, 'hook settles'); render(); } }
    render(); flush();
    return {
      get api() { return api; },
      update(next) { inputs = { ...inputs, ...next }; render(); flush(); },
      // The page routes Director frames: build_phase -> onBuildPhase, build_event -> onBuildEvent, slide_built -> onSlideBuilt
      // (hooks/use-deckster-websocket-v2.ts options.* -> app/builder/page.tsx ref forwarders; both pinned below).
      deliver(message) {
        const method = { build_phase: 'onBuildPhase', build_event: 'onBuildEvent', slide_built: 'onSlideBuilt' }[message.type];
        assert.ok(method, `unrouted frame type ${message.type}`);
        api[method](message.payload); flush();
      },
      sync(buildState) { api.syncBuildState(buildState); flush(); },
      get narration() { return api.narration; },
      unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
  }
  return { reducer: reducerExports, createHarness };
}

// --- Director wire frames (backend/director src/models/websocket_messages.py create_build_phase / create_build_event /
//     create_slide_built; narrator src/services/build_narrator.py). The build id is the one on every frame of e28fdbec. ---
const SESSION = 'e28fdbec-8a40-491a-9d57-bd4c528101a6';
const PRESENTATION = '9cddb53f-7e12-4209-99fc-50da348f3c10';
const BUILD = 'bld_2a991ea3f638';
let wireCounter = 0;
const envelope = (type, payload) => ({ message_id: `msg_${type}_${(wireCounter++).toString(16).padStart(8, '0')}`, session_id: SESSION, timestamp: '2026-10-10T04:51:00Z', type, payload });
const phaseFrame = (phase, slidesDone, label, build = BUILD, slideCount = 3) => envelope('build_phase', {
  build_id: build, phase, label, slide_count: slideCount, slides_done: slidesDone, auto_proceed: null, presentation_id: PRESENTATION, control_request_id: null,
});
let seqCounter = 0;
const eventFrame = (slide, stage, status, build = BUILD, seq = seqCounter++) => envelope('build_event', {
  build_id: build, seq, scope: 'slide', stage, status, text: `Slide ${slide + 1}: ${stage} ${status}`, detail: null, slide_index: slide, ts: '2026-10-10T04:51:05Z',
});
const builtFrame = (slide, build = BUILD, slideCount = 3) => envelope('slide_built', {
  session_id: SESSION, presentation_id: PRESENTATION, slide_index: slide, slide_count: slideCount, build_id: build,
  thumbnail_url: null, qa_verdict: null, qa_skipped_reason: null,
});

// Per slide (RESULT-D-A5.md "Follow-up"): plan done, validate done, render started, render done, then (slide 0 only, phase is
// then 'qa') build_phase qa 0/3 with NO slide_index, then slide_built N/3. Deck end: finalizing 3/3, complete 3/3.
function exactBuildFrames({ qaPhaseEverySlide = false, build = BUILD } = {}) {
  seqCounter = 0;
  const frames = [['build_phase building 0/3', phaseFrame('building', 0, 'Building your slides…', build)]];
  for (let slide = 0; slide < 3; slide++) {
    frames.push([`slide ${slide}: build_event plan done`, eventFrame(slide, 'plan', 'done', build)]);
    frames.push([`slide ${slide}: build_event validate done`, eventFrame(slide, 'validate', 'done', build)]);
    frames.push([`slide ${slide}: build_event render started`, eventFrame(slide, 'render', 'started', build)]);
    frames.push([`slide ${slide}: build_event render done`, eventFrame(slide, 'render', 'done', build)]);
    if (slide === 0 || qaPhaseEverySlide) frames.push([`slide ${slide}: build_phase qa 0/3 (deck-level)`, phaseFrame('qa', 0, 'Running quality checks…', build)]);
    frames.push([`slide ${slide}: slide_built ${slide + 1}/3`, builtFrame(slide, build)]);
  }
  frames.push(['build_phase finalizing 3/3', phaseFrame('finalizing', 3, 'Finishing your deck…', build)]);
  frames.push(['build_phase complete 3/3', phaseFrame('complete', 3, 'Your deck is ready', build)]);
  return frames;
}

function replay(h, frames, trace) {
  for (const [label, message] of frames) {
    h.deliver(message);
    trace?.push({ label, phase: h.narration.phase, slidesDone: h.narration.slidesDone, states: JSON.stringify(h.narration.slideStates) });
  }
}

function printTrace(title, trace) {
  console.log(`\n${title}`);
  console.log(`  ${'frame'.padEnd(44)} ${'phase'.padEnd(11)} slidesDone  slideStates`);
  for (const row of trace) console.log(`  ${row.label.padEnd(44)} ${row.phase.padEnd(11)} ${String(row.slidesDone).padEnd(10)}  ${row.states}`);
}

const FLAG = { builtTerminal: true };

// ---------------------------------------------------------------------------------------------------------------------
// Checks. Each takes an env (real or mutated sources) so the mutation section can re-run them.
// ---------------------------------------------------------------------------------------------------------------------
const checks = {
  // 1. The exact Director sequence, flag on and off.
  exactSequenceCountsOneTwoThree(env, { print = false, inputs = FLAG } = {}) {
    for (const variant of [{}, { qaPhaseEverySlide: true }]) {
      const h = env.createHarness(inputs);
      const trace = [];
      replay(h, exactBuildFrames(variant), trace);
      if (print && !variant.qaPhaseEverySlide) printTrace(`Exact e28fdbec sequence (hook inputs ${JSON.stringify(inputs)})`, trace);
      // After each slide_built the counter is exactly slide+1.
      trace.filter((r) => r.label.includes('slide_built')).forEach((r, i) => assert.equal(r.slidesDone, i + 1, `${r.label}`));
      // It never drops anywhere in the build, and ends at 3 through finalizing and complete.
      trace.reduce((prev, r) => { assert.ok(r.slidesDone >= prev, `${r.label}: ${prev} -> ${r.slidesDone}`); return r.slidesDone; }, 0);
      assert.equal(trace.at(-1).slidesDone, 3);
      assert.equal(h.narration.phase, 'complete');
      // The ribbon shows "N of M built" while building/qa/finalizing and slideCount is known.
      assert.equal(h.narration.slideCount, 3);
      h.unmount();
    }
  },

  // 1b. The page also feeds the hook a strawman and the accept edge before the typed frames; same result.
  exactSequenceWithPageEdges(env) {
    const h = env.createHarness(FLAG);
    h.update({ slideStructure: { slides: [1, 2, 3].map((n) => ({ slide_number: n, title: `Slide ${n}`, key_points: [] })) } });
    h.update({ isGeneratingFinal: true });
    assert.deepEqual(Object.values(h.narration.slideStates).map(String), ['pending', 'pending', 'pending']);
    const trace = [];
    replay(h, exactBuildFrames(), trace);
    trace.filter((r) => r.label.includes('slide_built')).forEach((r, i) => assert.equal(r.slidesDone, i + 1));
    assert.equal(h.narration.slidesDone, 3);
    h.unmount();
  },

  // 2a. A late per-slide qa event (not seen in the e28fdbec log; a synthetic stress of the reducer) after slide_built.
  lateQaEventDoesNotUnbuild(env, { flagOn }) {
    const h = env.createHarness(flagOn ? FLAG : {});
    replay(h, exactBuildFrames().slice(0, -2));
    assert.equal(h.narration.slidesDone, 3);
    const counts = [];
    for (let slide = 0; slide < 3; slide++) {
      h.deliver(eventFrame(slide, 'qa', 'progress'));
      counts.push(h.narration.slidesDone);
    }
    if (flagOn) {
      assert.deepEqual(counts, [3, 3, 3]);
      assert.deepEqual(Object.values(h.narration.slideStates).map(String), ['built', 'built', 'built']);
    } else {
      // Flag off = today's behaviour, kept: each late qa event flips a built slide back to 'qa' and the counter falls.
      assert.deepEqual(counts, [2, 1, 0]);
    }
    h.unmount();
  },

  // 2b. A reconnect snapshot that is behind the live state (typed_sync overwrites slide states wholesale).
  staleSyncDoesNotRewind(env, { flagOn }) {
    const h = env.createHarness(flagOn ? FLAG : {});
    replay(h, exactBuildFrames().slice(0, 11)); // through slide 1 built
    assert.equal(h.narration.slidesDone, 2);
    h.sync({ build_id: BUILD, phase: 'qa', slide_count: 3, slides: { 0: 'built', 1: 'building', 2: 'pending' } });
    assert.equal(h.narration.slidesDone, flagOn ? 2 : 1);
    // A snapshot that is AHEAD still upgrades the slide, with the flag on or off.
    h.sync({ build_id: BUILD, phase: 'qa', slide_count: 3, slides: { 0: 'built', 1: 'built', 2: 'built' } });
    assert.equal(h.narration.slidesDone, 3);
    h.unmount();
  },

  // 2c. 'skipped' is terminal too (it only arrives through a snapshot).
  skippedIsTerminal(env, { flagOn }) {
    const h = env.createHarness(flagOn ? FLAG : {});
    h.deliver(phaseFrame('building', 0, 'Building your slides…'));
    h.sync({ build_id: BUILD, phase: 'building', slide_count: 3, slides: { 0: 'skipped', 1: 'pending', 2: 'pending' } });
    assert.equal(h.narration.slideStates[0], 'skipped');
    h.deliver(eventFrame(0, 'qa', 'progress'));
    assert.equal(h.narration.slideStates[0], flagOn ? 'skipped' : 'qa');
    h.sync({ build_id: BUILD, phase: 'building', slide_count: 3, slides: { 0: 'building' } });
    assert.equal(h.narration.slideStates[0], flagOn ? 'skipped' : 'building');
    h.unmount();
  },

  // 3a. A real failure after build must still show, flag on or off.
  builtThenErrorShowsError(env, { flagOn }) {
    const h = env.createHarness(flagOn ? FLAG : {});
    replay(h, exactBuildFrames().slice(0, 11)); // slides 0 and 1 built
    assert.equal(h.narration.slidesDone, 2);
    h.deliver(eventFrame(1, 'render', 'error'));
    assert.equal(h.narration.slideStates[1], 'error');
    assert.equal(h.narration.slidesDone, 1);
    // ... and a snapshot that says error does the same.
    h.sync({ build_id: BUILD, phase: 'qa', slide_count: 3, slides: { 0: 'error' } });
    assert.equal(h.narration.slideStates[0], 'error');
    assert.equal(h.narration.slidesDone, 0);
    h.unmount();
  },

  // 3b. A new build id starts from an empty state (finished build, and a build replaced mid-flight).
  newBuildResets(env) {
    for (const finishFirst of [true, false]) {
      const h = env.createHarness(FLAG);
      const first = exactBuildFrames();
      replay(h, finishFirst ? first : first.slice(0, 11));
      assert.equal(h.narration.slidesDone, finishFirst ? 3 : 2);
      const NEXT = 'bld_0123456789ab';
      h.deliver(phaseFrame('building', 0, 'Building your slides…', NEXT, 2));
      assert.equal(h.narration.buildId, NEXT);
      assert.equal(h.narration.slidesDone, 0);
      assert.equal(JSON.stringify(h.narration.slideStates), '{}');
      assert.equal(h.narration.slideCount, 2);
      const counts = [];
      for (let slide = 0; slide < 2; slide++) {
        h.deliver(eventFrame(slide, 'render', 'done', NEXT, 100 + slide));
        h.deliver(builtFrame(slide, NEXT, 2));
        counts.push(h.narration.slidesDone);
      }
      assert.deepEqual(counts, [1, 2]);
      // Late frames of the retired build cannot touch the new one.
      h.deliver(eventFrame(0, 'qa', 'progress', BUILD, 900));
      h.deliver(builtFrame(2, BUILD));
      assert.equal(h.narration.slidesDone, 2);
      assert.equal(h.narration.buildId, NEXT);
      h.unmount();
    }
  },

  // 4. Flag off is identical: the hook adds nothing to its dispatches, and the reducer ignores a missing/false flag.
  flagOffIdentity(env) {
    const frames = exactBuildFrames();
    const off = env.createHarness({}); replay(off, frames);
    const explicitOff = env.createHarness({ builtTerminal: false }); replay(explicitOff, frames);
    const on = env.createHarness(FLAG); replay(on, frames);
    assert.equal(JSON.stringify(off.narration), JSON.stringify(explicitOff.narration));
    assert.equal(JSON.stringify(off.narration), JSON.stringify(on.narration), 'the exact sequence never needed the flag');
    // Reducer level: a typed_event/typed_sync action without the field or with false is the same action.
    const { reducer } = env;
    let s = reducer.initialNarrationState();
    s = reducer.narrationReducer(s, { type: 'typed_phase', payload: { build_id: BUILD, phase: 'building', label: 'b', slide_count: 3 }, ts: 1 });
    s = reducer.narrationReducer(s, { type: 'typed_slide_built', payload: { session_id: SESSION, presentation_id: PRESENTATION, slide_index: 0, slide_count: 3, build_id: BUILD }, ts: 2 });
    const qa = { type: 'typed_event', payload: { build_id: BUILD, seq: 5, scope: 'slide', stage: 'qa', slide_index: 0, text: 'qa' }, ts: 3 };
    assert.equal(JSON.stringify(reducer.narrationReducer(s, qa)), JSON.stringify(reducer.narrationReducer(s, { ...qa, builtTerminal: false })));
    assert.equal(reducer.narrationReducer(s, qa).slideStates[0], 'qa');
    assert.equal(reducer.narrationReducer(s, { ...qa, builtTerminal: true }).slideStates[0], 'built');
    // 'building' / 'pending' were already blocked without the flag; unchanged.
    const building = { type: 'typed_event', payload: { build_id: BUILD, seq: 6, scope: 'slide', stage: 'render', status: 'started', slide_index: 0, text: 'r' }, ts: 4 };
    assert.equal(reducer.narrationReducer(s, building).slideStates[0], 'built');
    for (const h of [off, explicitOff, on]) h.unmount();
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Run against the real source.
// ---------------------------------------------------------------------------------------------------------------------
let passed = 0;
function run(name, fn) {
  try { fn(); passed += 1; } catch (error) { console.error(`FAIL: ${name}`); throw error; }
}

const real = makeEnv();
run('exact e28fdbec sequence counts 1, 2, 3 and never drops (flag on)', () => checks.exactSequenceCountsOneTwoThree(real, { print: true }));
run('exact e28fdbec sequence counts 1, 2, 3 and never drops (flag off)', () => checks.exactSequenceCountsOneTwoThree(real, { print: true, inputs: {} }));
run('exact sequence with the page strawman/accept edges counts 1, 2, 3', () => checks.exactSequenceWithPageEdges(real));
run('late per-slide qa event: flag on keeps built; flag off keeps today\'s drop', () => {
  checks.lateQaEventDoesNotUnbuild(real, { flagOn: true });
  checks.lateQaEventDoesNotUnbuild(real, { flagOn: false });
});
run('stale reconnect snapshot: flag on keeps built, ahead snapshot still upgrades; flag off keeps today\'s rewind', () => {
  checks.staleSyncDoesNotRewind(real, { flagOn: true });
  checks.staleSyncDoesNotRewind(real, { flagOn: false });
});
run('skipped is terminal with the flag, unchanged without', () => {
  checks.skippedIsTerminal(real, { flagOn: true });
  checks.skippedIsTerminal(real, { flagOn: false });
});
run('built then error still shows the error (flag on and off)', () => {
  checks.builtThenErrorShowsError(real, { flagOn: true });
  checks.builtThenErrorShowsError(real, { flagOn: false });
});
run('a new build id resets the count (finished and mid-flight)', () => checks.newBuildResets(real));
run('flag off is identical', () => checks.flagOffIdentity(real));

// Wiring pins: the flag is read once (exact "true"), handed to the hook, and added to the dispatches only when on.
run('wiring: flag module reads the exact string "true"', () => {
  assert.match(SRC.flagModule, /export const STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED =\s*process\.env\.NEXT_PUBLIC_STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED === 'true'/);
});
run('wiring: .env.example documents the flag, default "false"', () => {
  assert.match(SRC.envExample, /^NEXT_PUBLIC_STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED="false"$/m);
});
run('wiring: page passes the flag into useBuildNarration', () => {
  assert.match(SRC.page, /import \{ STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED \} from '@\/lib\/studio-build-counter'/);
  assert.match(SRC.page, /builtTerminal: STUDIO_BUILD_COUNTER_BUILT_TERMINAL_ENABLED,/);
});
run('wiring: hook adds builtTerminal to typed_event and typed_sync only when on', () => {
  assert.match(SRC.hook, /dispatch\(\{ type: 'typed_event', payload, ts: Date\.now\(\), \.\.\.\(builtTerminal \? \{ builtTerminal: true \} : \{\}\) \}\)/);
  assert.match(SRC.hook, /\.\.\.\(builtTerminal \? \{ builtTerminal: true \} : \{\}\),\n    \}\)\n  \}, \[clearPendingControl, pendingControlForBuild, builtTerminal\]\)/);
});
run('routing pins: Director frames reach the hook (websocket hook options -> page ref forwarders -> useBuildNarration)', () => {
  assert.match(SRC.wsHook, /message\.type === 'slide_built'\)[^]*?options\.onSlideBuilt\?\.\(message,/);
  assert.match(SRC.wsHook, /message\.type === 'build_phase'\) \{\n\s*options\.onBuildPhase\?\.\(\(message as any\)\.payload, message\.session_id\);/);
  assert.match(SRC.wsHook, /message\.type === 'build_event'\) \{\n\s*options\.onBuildEvent\?\.\(\(message as any\)\.payload\);/);
  assert.match(SRC.page, /buildNarrationHandlersRef\.current\.onSlideBuilt\?\.\(message\.payload\)/);
  assert.match(SRC.page, /onBuildEvent: \(payload\) => buildNarrationHandlersRef\.current\.onBuildEvent\?\.\(payload\)/);
  assert.match(SRC.page, /onBuildPhase: \(payload, ownerSessionId\) => buildNarrationHandlersRef\.current\.onBuildPhase\?\.\(payload, ownerSessionId\)/);
  // The counter is slidesDone and nothing reads build_phase.slides_done into it.
  assert.match(read('components/build-narration/stage-ribbon.tsx'), /\{n\.slidesDone\} of \{n\.slideCount\} built/);
  assert.ok(!/slides_done/.test(SRC.heuristics.replace(/\/\/.*$/gm, '')), 'the reducer must not read build_phase.slides_done');
});

// ---------------------------------------------------------------------------------------------------------------------
// Mutation checks: break one rule in a copy of the source; the check that pins it must now fail.
// ---------------------------------------------------------------------------------------------------------------------
function mutated(name, key, from, to) {
  assert.ok(SRC[key].includes(from), `mutation "${name}": anchor not found in ${key}`);
  const next = SRC[key].replace(from, to);
  assert.notEqual(next, SRC[key], `mutation "${name}" did not change the source`);
  return (source) => source.replace(from, to);
}
function mustFail(name, mutate, target) {
  let caught = null;
  try { target(makeEnv(mutate)); } catch (error) { caught = error; }
  assert.ok(caught, `mutant survived: ${name}`);
  // A mutant must be killed by the pinned assertion, not by a crash in the broken source.
  assert.ok(caught instanceof assert.AssertionError, `mutant "${name}" died of ${caught?.name}: ${caught?.message}`);
  if (process.env.MUTANT_VERBOSE) console.log(`  killed: ${name} -> ${String(caught.message).split('\n')[0].slice(0, 110)}`);
  passed += 1;
}

const GUARD = "if (builtTerminal && (prev === 'built' || prev === 'skipped') && s === 'qa') return state;";
mustFail('drop the built-terminal qa guard in setSlideState', { heuristics: mutated('guard', 'heuristics', GUARD, '') },
  (env) => checks.lateQaEventDoesNotUnbuild(env, { flagOn: true }));
mustFail('built-terminal guard always on (ignores the flag)', { heuristics: mutated('always', 'heuristics', GUARD, "if ((prev === 'built' || prev === 'skipped') && s === 'qa') return state;") },
  (env) => checks.lateQaEventDoesNotUnbuild(env, { flagOn: false }));
mustFail('guard also blocks built -> error', { heuristics: mutated('error', 'heuristics', GUARD, "if (builtTerminal && (prev === 'built' || prev === 'skipped') && (s === 'qa' || s === 'error')) return state;") },
  (env) => checks.builtThenErrorShowsError(env, { flagOn: true }));
mustFail('typed_sync ignores built-terminal', { heuristics: mutated('sync', 'heuristics', "action.builtTerminal === true &&\n            (prevState", "false &&\n            (prevState") },
  (env) => checks.staleSyncDoesNotRewind(env, { flagOn: true }));
mustFail('typed_sync built-terminal is always on', { heuristics: mutated('sync-on', 'heuristics', "action.builtTerminal === true &&\n            (prevState", "true &&\n            (prevState") },
  (env) => checks.staleSyncDoesNotRewind(env, { flagOn: false }));
mustFail('skipped is not terminal', { heuristics: mutated('skipped', 'heuristics', "if (builtTerminal && (prev === 'built' || prev === 'skipped') && s === 'qa') return state;", "if (builtTerminal && prev === 'built' && s === 'qa') return state;") },
  (env) => checks.skippedIsTerminal(env, { flagOn: true }));
mustFail('hook does not pass the flag on typed_event', { hook: mutated('hook-event', 'hook', "dispatch({ type: 'typed_event', payload, ts: Date.now(), ...(builtTerminal ? { builtTerminal: true } : {}) })", "dispatch({ type: 'typed_event', payload, ts: Date.now() })") },
  (env) => checks.lateQaEventDoesNotUnbuild(env, { flagOn: true }));
mustFail('hook does not pass the flag on typed_sync', { hook: mutated('hook-sync', 'hook', "...(builtTerminal ? { builtTerminal: true } : {}),\n    })", "})") },
  (env) => checks.staleSyncDoesNotRewind(env, { flagOn: true }));
// slide_built and the render-done mapping each count a slide on their own; only losing BOTH empties the counter.
mustFail('render done no longer marks built AND slide_built counts nothing', {
  heuristics: (source) => source
    .replace("next = setSlideState(next, p.slide_index, 'built');\n      if (p.thumbnail_url)", 'if (p.thumbnail_url)')
    .replace("p.status === 'done' && (p.stage === 'content' || p.stage === 'render' || p.stage === 'insert')", 'false'),
}, (env) => checks.exactSequenceCountsOneTwoThree(env, { inputs: FLAG }));
mustFail('a phase frame resets the slide states (the candidate cause the replay rules out)', {
  heuristics: mutated('phase-reset', 'heuristics', "      next = toPhase(next, p.phase as NarrationPhase, action.ts, p.label);\n      if (typeof p.slide_count", "      next = toPhase({ ...next, slideStates: {}, slidesDone: 0 }, p.phase as NarrationPhase, action.ts, p.label);\n      if (typeof p.slide_count"),
}, (env) => checks.exactSequenceCountsOneTwoThree(env));
mustFail('a new build id does not reset', {
  heuristics: mutated('no-reset', 'heuristics', "if (buildId && state.buildId !== buildId && (state.buildId || state.phase === 'complete')) {", "if (false) {"),
}, (env) => checks.newBuildResets(env));

console.log(`\nbuild counter built-terminal: ${passed} checks passed (incl. mutation checks)`);
