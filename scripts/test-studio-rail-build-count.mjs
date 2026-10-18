// RAIL-SLIDES-1-MIDBUILD: during a build the rail kept "Slides 1" from the first built slide until completion.
// Flag NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT, default off. Run: node scripts/test-studio-rail-build-count.mjs   (plain node: transpile + vm, no network)
//
// Replays the REAL recorded Director frames of a 3-slide build (scripts/fixtures/studio-rail-build-count/director-frames-dark-build.json: theme_sync,
// build_phase x6, slide_built x3, presentation_url; recorded 2026-10-16 on UAT) through the REAL narration reducer (lib/build-narration-heuristics.ts) and
// the import-free helper under test (lib/studio-rail-build-count.ts). The recording has no strawman slide_update, so the three strawman titles are
// synthesized (the reducer's own `strawman` action). The frame model below is the one measured with the real Layout viewer
// (Reveal.getTotalSlides through getCurrentSlideInfo): a frame reports the slides persisted when it loaded and keeps reporting that until it reloads.
// The same suite then runs against mutated copies of the helper and of the call sites: every mutant must be killed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const frames = JSON.parse(fs.readFileSync(new URL('fixtures/studio-rail-build-count/director-frames-dark-build.json', import.meta.url), 'utf8'));

function load(source, env = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const mod = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env }, URL });
  return mod.exports;
}

// Values built inside the vm context have another Array prototype: compare their JSON.
const same = (actual, expected, message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), message);

const libSource = read('lib/studio-rail-build-count.ts');
const narration = load(read('lib/build-narration-heuristics.ts'));
const sources = {
  area: read('components/builder/presentation-area.tsx'),
  viewer: read('components/presentation-viewer.tsx'),
  strip: read('components/slide-thumbnail-strip.tsx'),
  card: read('components/studio-rail-build-placeholder.tsx'),
  css: read('components/studio-rail-build-placeholder.css'),
  baseCss: read('components/studio-thumbnails.css'),
};
const MARK = 'RAIL-SLIDES-1-MIDBUILD';

// ---- the recording, played through the real reducer ------------------------------------------------------------------------------------------
const TITLES = ['Quarterly business review', 'Three wins this quarter', "Next quarter's priorities", 'Appendix', 'Risks', 'Asks'];
const ghostsFor = count => Array.from({ length: count }, (_, index) => ({ index, title: TITLES[index], points: [], slideType: 'content' }));

/** Each step: the reducer state after the frame, plus what the stage shows and what the Layout frame holds (the measured model). */
function replay(planCount, finalCount = planCount) {
  const recorded = frames.filter(f => ['build_phase', 'slide_built', 'presentation_url'].includes(f.type));
  const builtTemplate = recorded.find(f => f.type === 'slide_built').payload;
  let state = narration.initialNarrationState();
  let ts = 1;
  state = narration.narrationReducer(state, { type: 'strawman', ghosts: ghostsFor(planCount), ts: ts++ });
  const steps = [{ label: 'strawman', state, deckShown: 'strawman', frameCount: planCount }];
  let persisted = 0;
  let frameCount = planCount; // the strawman deck: every planned slide exists
  let deckShown = 'strawman';
  const push = label => steps.push({ label, state, deckShown, frameCount });
  const buildPhases = recorded.filter(f => f.type === 'build_phase' && f.payload.phase !== 'complete' && f.payload.phase !== 'finalizing' && f.payload.phase !== 'qa');
  for (const f of buildPhases) {
    state = narration.narrationReducer(state, { type: 'typed_phase', payload: { ...f.payload, slide_count: planCount }, ts: ts++ });
    push(`build_phase ${f.payload.phase}`);
  }
  const qa = recorded.find(f => f.type === 'build_phase' && f.payload.phase === 'qa');
  state = narration.narrationReducer(state, { type: 'typed_phase', payload: { ...qa.payload, slide_count: planCount }, ts: ts++ });
  push('build_phase qa');
  for (let index = 0; index < planCount; index += 1) {
    persisted += 1; // Slide Builder persists the slide, then Director reports it built
    state = narration.narrationReducer(state, { type: 'typed_slide_built', payload: { ...builtTemplate, slide_index: index, slide_count: planCount }, ts: ts++ });
    if (index === 0) { deckShown = 'filling'; frameCount = persisted } // the stage swaps to the filling deck: a new frame, loaded with 1 slide
    push(`slide_built ${index + 1}/${planCount}`);
  }
  const fin = recorded.find(f => f.type === 'build_phase' && f.payload.phase === 'finalizing');
  state = narration.narrationReducer(state, { type: 'typed_phase', payload: { ...fin.payload, slide_count: planCount, slides_done: planCount }, ts: ts++ });
  push('build_phase finalizing');
  const url = recorded.find(f => f.type === 'presentation_url').payload;
  state = narration.narrationReducer(state, { type: 'final_url', presentationId: url.presentation_id, ts: ts++ });
  const done = recorded.find(f => f.type === 'build_phase' && f.payload.phase === 'complete');
  state = narration.narrationReducer(state, { type: 'typed_phase', payload: { ...done.payload, slide_count: finalCount }, ts: ts++ });
  deckShown = 'final'; frameCount = finalCount; // the completion reload: the frame now holds the whole deck
  push('build_phase complete');
  return steps;
}

const planInput = (step, overrides = {}) => ({
  enabled: true, studioShell: true,
  partialArtifact: step.deckShown === 'filling',
  narrationActive: step.state.active, phase: step.state.phase, slideCount: step.state.slideCount,
  buildPresentationId: step.state.buildPresentationId,
  presentationId: step.deckShown === 'filling' || step.deckShown === 'final' ? step.state.buildPresentationId : 'strawman-deck',
  ghosts: step.state.ghosts, slideStates: step.state.slideStates,
  ...overrides,
});

let testCount = 0;
function run(name, fn) {
  testCount += 1;
  try { fn(); } catch (err) { console.error(`FAIL: ${name}`); throw err; }
}

/** The rail the strip would draw: real rows (the frame's), then the placeholders; heading as the viewer passes it. */
function railOf(lib, step, thumbs = {}, flagOn = true) {
  const plan = flagOn ? lib.railBuildPlanFor(planInput(step)) : null;
  const rows = step.frameCount;
  const placeholders = lib.railBuildPlaceholders({ rows, plan, thumbnailUrlsBySlide: thumbs });
  return { plan, rows, placeholders, heading: lib.railBuildHeadingTotal({ totalSlides: rows, rows, plan }) };
}

function suite(lib, source, calls) {
  run('flag is the exact string "true" and defaults off', () => {
    assert.equal(load(source, {}).STUDIO_RAIL_BUILD_COUNT_ENABLED, false);
    for (const value of ['', 'false', '1', 'TRUE', 'True', ' true', 'yes']) {
      assert.equal(load(source, { NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT: value }).STUDIO_RAIL_BUILD_COUNT_ENABLED, false, JSON.stringify(value));
    }
    assert.equal(load(source, { NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT: 'true' }).STUDIO_RAIL_BUILD_COUNT_ENABLED, true);
    assert.match(source, /process\.env\.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT === 'true'/);
  });

  run('the recording replays through the real reducer: plan 3, three slides built, phase complete', () => {
    const steps = replay(3);
    const last = steps[steps.length - 1];
    assert.equal(last.state.phase, 'complete');
    assert.equal(last.state.slideCount, 3);
    assert.equal(last.state.buildPresentationId, '47c27752-153b-4e45-85e7-427d207b069f');
    const built = steps.find(s => s.label === 'slide_built 3/3').state;
    assert.equal(built.slidesDone, 3);
    same(Object.values(built.slideStates), ['built', 'built', 'built']);
  });

  run('BASE (flag off): the rail drops to the frame count at the first built slide and stays there (the J1 defect)', () => {
    const steps = replay(3);
    const heading = label => railOf(lib, steps.find(s => s.label === label), {}, false).heading;
    assert.equal(heading('build_phase building'), 3, 'strawman deck on stage: every slide a row');
    assert.equal(heading('slide_built 1/3'), 1, 'filling deck frame holds 1 slide');
    assert.equal(heading('slide_built 3/3'), 1, 'still 1 at "3 of 3 built"');
    assert.equal(heading('build_phase finalizing'), 1);
    assert.equal(heading('build_phase complete'), 3, 'back at completion');
  });

  run('flag on: the rail never shows fewer slides than the plan from the first built slide to the finalizing phase', () => {
    for (const planCount of [3, 6]) {
      const steps = replay(planCount);
      for (const step of steps) {
        const rail = railOf(lib, step);
        if (['building', 'qa', 'finalizing'].includes(step.state.phase) && step.deckShown === 'filling') {
          assert.ok(rail.heading >= planCount, `${planCount}: ${step.label} heading ${rail.heading}`);
          assert.equal(rail.rows + rail.placeholders.length, planCount, `${planCount}: ${step.label} rows + placeholders`);
        }
      }
    }
  });

  run('flag on: built slides replace placeholders one by one (real rows from the frame, the rest planned, titles from the strawman)', () => {
    const steps = replay(6);
    const afterFirst = railOf(lib, steps.find(s => s.label === 'slide_built 1/6'));
    assert.equal(afterFirst.rows, 1);
    same(afterFirst.placeholders.map(p => p.slideNumber), [2, 3, 4, 5, 6]);
    same(afterFirst.placeholders.map(p => p.built), [false, false, false, false, false]);
    same(afterFirst.placeholders.map(p => p.title), TITLES.slice(1));
    const afterFour = railOf(lib, steps.find(s => s.label === 'slide_built 4/6'));
    same(afterFour.placeholders.map(p => p.built), [true, true, true, false, false]);
    const afterSix = railOf(lib, steps.find(s => s.label === 'slide_built 6/6'));
    same(afterSix.placeholders.map(p => p.built), [true, true, true, true, true]);
    assert.equal(afterSix.heading, 6);
  });

  run('flag on: a built slide shows its Stage F preview as soon as that frame arrives, and only then', () => {
    const steps = replay(6);
    const step = steps.find(s => s.label === 'slide_built 3/6');
    const without = railOf(lib, step).placeholders;
    same(without.map(p => p.thumbnailUrl), [null, null, null, null, null]);
    const withThumbs = railOf(lib, step, { 1: 'https://img.example/s2.png', 2: ' https://img.example/s3.png ', 4: '' }).placeholders;
    same(withThumbs.map(p => p.thumbnailUrl), ['https://img.example/s2.png', 'https://img.example/s3.png', null, null, null]);
  });

  run('flag on: the final count wins at completion (plan 3 = 3, plan 6 with 5 persisted = 5, plan 3 with 4 = 4)', () => {
    for (const [plan, final] of [[3, 3], [6, 5], [3, 4]]) {
      const last = replay(plan, final).at(-1);
      const rail = railOf(lib, last);
      assert.equal(rail.plan, null, `${plan}/${final}: no floor after completion`);
      assert.equal(rail.placeholders.length, 0);
      assert.equal(rail.heading, final);
    }
  });

  run('flag on: stopped and error phases hand the rail back to the deck, paused keeps the floor', () => {
    const step = replay(6).find(s => s.label === 'slide_built 2/6');
    const plan = phase => lib.railBuildPlanFor(planInput(step, { phase }));
    assert.equal(plan('stopped'), null);
    assert.equal(plan('error'), null);
    assert.equal(plan('complete'), null);
    assert.equal(plan('idle'), null);
    assert.equal(plan('planning'), null);
    assert.equal(plan('strawman'), null);
    assert.equal(plan('awaiting_user'), null);
    for (const phase of ['building', 'qa', 'finalizing', 'paused']) assert.equal(plan(phase).slideCount, 6, phase);
  });

  run('flag on: the floor applies only to this build\'s filling deck, in the Studio shell, with the flag on', () => {
    const step = replay(6).find(s => s.label === 'slide_built 2/6');
    assert.equal(lib.railBuildPlanFor(planInput(step)).slideCount, 6);
    assert.equal(lib.railBuildPlanFor(planInput(step, { enabled: false })), null, 'flag off');
    assert.equal(lib.railBuildPlanFor(planInput(step, { studioShell: false })), null, 'classic shell');
    assert.equal(lib.railBuildPlanFor(planInput(step, { partialArtifact: false })), null, 'strawman / settled deck on stage');
    assert.equal(lib.railBuildPlanFor(planInput(step, { narrationActive: false })), null, 'no running build');
    assert.equal(lib.railBuildPlanFor(planInput(step, { presentationId: 'some-other-deck' })), null, 'another deck on stage');
    assert.equal(lib.railBuildPlanFor(planInput(step, { presentationId: null })), null);
    assert.equal(lib.railBuildPlanFor(planInput(step, { buildPresentationId: null, presentationId: null })), null);
    assert.equal(lib.railBuildPlanFor(planInput(step, { slideCount: 0 })), null, 'no plan count yet');
    assert.equal(lib.railBuildPlanFor(planInput(step, { slideCount: NaN })), null);
  });

  run('heading and placeholders never go below what is already on screen, and are inert without a plan', () => {
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 4, rows: 4, plan: null }), 4, 'no plan: the real total, untouched');
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 0, rows: 0, plan: null }), 0);
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 1, rows: 4, plan: null }), 1, 'no plan: today\'s heading even when identity rows are ahead of it');
    const plan = { slideCount: 3, titles: [null, null, null], built: [false, false, false] };
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 1, rows: 1, plan }), 3);
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 5, rows: 5, plan }), 5, 'frame already holds more than the plan');
    assert.equal(lib.railBuildHeadingTotal({ totalSlides: 1, rows: 4, plan }), 4, 'identity rows ahead of the count');
    same(lib.railBuildPlaceholders({ rows: 5, plan, thumbnailUrlsBySlide: {} }), []);
    same(lib.railBuildPlaceholders({ rows: 0, plan: null, thumbnailUrlsBySlide: {} }), []);
    same(lib.railBuildPlaceholders({ rows: 0, plan, thumbnailUrlsBySlide: null }).map(p => p.slideNumber), [1, 2, 3], 'the swap moment: the frame has no rows yet');
    same(lib.railBuildPlaceholders({ rows: -2, plan, thumbnailUrlsBySlide: undefined }).map(p => p.slideNumber), [1, 2, 3]);
  });

  run('plan titles: by ghost index, trimmed, out-of-range and blank ignored', () => {
    const step = replay(3).find(s => s.label === 'slide_built 1/3');
    const plan = lib.railBuildPlanFor(planInput(step, {
      ghosts: [{ index: 0, title: '  First ' }, { index: 2, title: 'Third' }, { index: 1, title: '   ' }, { index: 9, title: 'Out' }, { index: -1, title: 'Neg' }, { index: 1.5, title: 'Frac' }],
    }));
    same(plan.titles, ['First', null, 'Third']);
    same(lib.railBuildPlanFor(planInput(step, { ghosts: null })).titles, [null, null, null]);
  });

  if (!calls) return;

  run('call site: presentation-area hands the viewer a plan only when there is one (flag off = no extra prop)', () => {
    assert.ok(sources.area.includes(`import { STUDIO_RAIL_BUILD_COUNT_ENABLED, railBuildPlanFor } from '@/lib/studio-rail-build-count' // ${MARK}`));
    assert.match(sources.area, /railBuildPlanFor\(\{ enabled: STUDIO_RAIL_BUILD_COUNT_ENABLED, studioShell, partialArtifact: Boolean\(studioPartialArtifact\), narrationActive, phase: narrationPhase,/);
    assert.match(sources.area, /buildPresentationId: buildNarration\?\.buildPresentationId, presentationId, ghosts: buildNarration\?\.ghosts, slideStates: buildNarration\?\.slideStates \}\)/);
    assert.ok(sources.area.includes(`{...(railBuildPlan ? { railBuildPlan } : {})} // ${MARK}`));
    assert.ok(!/railBuildPlan=\{/.test(sources.area), 'never passed as a bare prop');
    // every line this feature adds to the area carries its marker (the pin tests of earlier features filter on it)
    const lines = sources.area.split('\n').filter(line => /railBuild|RailBuild|rail-build-count/.test(line) && !line.trimStart().startsWith('//'));
    assert.equal(lines.length, 3);
    for (const line of lines) assert.ok(line.includes(MARK), line);
  });

  run('call site: the viewer keeps the rail up across the swap and gives the strip the plan only while it applies', () => {
    assert.ok(sources.viewer.includes('railBuildPlan?: RailBuildPlan | null'));
    assert.ok(sources.viewer.includes(`  railBuildPlan = null, // ${MARK}\n`));
    assert.ok(sources.viewer.includes(`showThumbnails && (slideThumbnails.length > 0 || composeJobs.length > 0 || Boolean(railBuildRows?.length)) && ( // ${MARK}`));
    assert.ok(sources.viewer.includes(`const railBuildRows = useMemo(() => railBuildPlan ? railBuildPlaceholders({ rows: slideThumbnails.length, plan: railBuildPlan, thumbnailUrlsBySlide }) : null,`));
    assert.ok(sources.viewer.includes(`{...(railBuildPlan && railBuildRows ? { buildPlaceholders: railBuildRows, headingTotal: railBuildHeadingTotal({ totalSlides, rows: slideThumbnails.length, plan: railBuildPlan }) } : {})} // ${MARK}`));
    // The viewer's own counters, the strip's total prop and the footer are untouched.
    assert.ok(sources.viewer.includes('                totalSlides={totalSlides}\n                composeJobs={composeJobs}'));
    assert.ok(sources.viewer.includes(": visualTotalSlides || totalSlides || slideCount || (studioPartialArtifact ? '—' : 1)}</span>"));
    assert.ok(sources.viewer.includes('setTotalSlides(0); setVisualTotalSlides(0); setCurrentSlide(1)'));
    for (const line of sources.viewer.split('\n').filter(l => /railBuild|RailBuild|rail-build-count/.test(l) && !l.trimStart().startsWith('//'))) assert.ok(line.includes(MARK) || line.includes('railBuildPlan?: RailBuildPlan'), line);
  });

  run('call site: the strip adds nothing without the new props, and a placeholder cannot be acted on', () => {
    assert.ok(sources.strip.includes('const slidesTotal = totalSlides ?? slides.length'));
    assert.ok(sources.strip.includes('headingTotal ?? slidesTotal'));
    assert.ok(sources.strip.includes(`if (slides.length === 0 && composeJobs.length === 0 && !buildPlaceholders?.length) { // ${MARK}`));
    // Guards still read the real total, never the heading's.
    assert.ok(sources.strip.includes('if (slidesTotal <= 1 || isProcessing !== null) return'));
    assert.ok(sources.strip.includes('if (selectedSlides.length >= slidesTotal) return'));
    assert.ok(sources.strip.includes('deleteOne: Boolean(onDeleteSlide) && slidesTotal > 1,'));
    // The inert rows ride in the one rendered list (same child shape as today) and are drawn by their own card, before any real-row code runs.
    assert.ok(sources.strip.includes('        {orderedItems.map(item =>\n          item.kind === \'compose\''), 'the rendered list is still the one orderedItems.map child');
    assert.match(sources.strip, /if \(buildPlaceholders\?\.length\) orderedItems\.push\(\.\.\.buildPlaceholders\.map\(\(placeholder, offset\) => \(\{ kind: 'slide' as const, slide: \{ slideNumber: placeholder\.slideNumber, buildPlaceholder: placeholder \}/);
    const body = sources.strip.slice(sources.strip.indexOf('const renderThumbnail = (slide: SlideThumbnail, visualNumber: number) => {'));
    assert.ok(body.split('\n')[1].startsWith('    if (slide.buildPlaceholder) return <RailBuildPlaceholderCard'), 'first statement of renderThumbnail');
    for (const line of sources.strip.split('\n').filter(l => /buildPlaceholder|headingTotal|RailBuild|rail-build/.test(l))) {
      assert.ok(line.includes(MARK) || line.includes('headingTotal ?? slidesTotal'), line);
    }
    const card = sources.card;
    for (const forbidden of ['onClick', 'onDragStart', 'onDrop', 'draggable', 'ContextMenu', 'DropdownMenu', 'onSlideClick', 'onRefineSlide', 'handleSlideSelect', 'data-studio-thumbnail-navigation']) {
      assert.ok(!card.includes(forbidden), `placeholder card has no ${forbidden}`);
    }
    assert.ok(card.includes('aria-disabled="true"') && card.includes('disabled tabIndex={-1}'));
    assert.ok(card.includes('data-studio-thumbnail-card={studio}') && card.includes('data-studio-thumbnail-preview={studio}') && card.includes('data-studio-thumbnail-caption={studio}'), 'same hooks as a real row');
  });

  run('css: the inert hover rules live in their own file, scoped to the placeholder, and studio-thumbnails.css is untouched', () => {
    const rules = sources.css.split('\n').filter(line => /\{/.test(line));
    assert.equal(rules.length, 2);
    for (const line of rules) assert.ok(line.startsWith('[data-studio-thumbnail-strip="true"] [data-studio-thumbnail-card="true"][data-studio-thumbnail-build-placeholder="true"]'), line);
    assert.ok(sources.css.includes(`/* ${MARK} (NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT)`));
    assert.ok(!sources.baseCss.includes('build-placeholder'), 'the rail\'s own CSS is not touched');
    assert.ok(sources.card.includes("import './studio-rail-build-placeholder.css'"), 'the card imports its CSS');
  });
}

// ---- 1. the suite against the real helper and call sites ---------------------------------------------------------------------------------------
const real = load(libSource, { NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT: 'true' });
suite(real, libSource, true);
const realTests = testCount;

// ---- 2. mutation checks: every mutant must make the suite fail ----------------------------------------------------------------------------------
function mutate(text, from, to) {
  assert.equal(text.split(from).length - 1, 1, `mutant anchor must occur once: ${from.slice(0, 60)}`);
  return text.replace(from, to);
}
const helperMutants = {
  'floor never applies': ['  const slideCount = whole(input.slideCount)\n  if (slideCount < 1) return null', '  const slideCount = whole(input.slideCount)\n  if (slideCount < 1 || true) return null'],
  'floor kept after completion (phase gate gone)': ["  if (!FLOOR_PHASES.includes(input.phase)) return null\n", ''],
  'floor kept when stopped': ["const FLOOR_PHASES = ['building', 'qa', 'finalizing', 'paused']", "const FLOOR_PHASES = ['building', 'qa', 'finalizing', 'paused', 'stopped']"],
  'floor not kept while paused': ["const FLOOR_PHASES = ['building', 'qa', 'finalizing', 'paused']", "const FLOOR_PHASES = ['building', 'qa', 'finalizing']"],
  'any deck on stage gets the floor': ['  if (!input.buildPresentationId || input.buildPresentationId !== input.presentationId) return null\n', ''],
  'strawman / settled deck gets the floor': ['  if (!input.enabled || !input.studioShell || !input.partialArtifact || !input.narrationActive) return null', '  if (!input.enabled || !input.studioShell || !input.narrationActive) return null'],
  'classic shell gets the floor': ['  if (!input.enabled || !input.studioShell || !input.partialArtifact || !input.narrationActive) return null', '  if (!input.enabled || !input.partialArtifact || !input.narrationActive) return null'],
  'floor ignores the enabled flag': ['  if (!input.enabled || !input.studioShell || !input.partialArtifact || !input.narrationActive) return null', '  if (!input.studioShell || !input.partialArtifact || !input.narrationActive) return null'],
  'floor ignores a finished build (not active)': ['  if (!input.enabled || !input.studioShell || !input.partialArtifact || !input.narrationActive) return null', '  if (!input.enabled || !input.studioShell || !input.partialArtifact) return null'],
  'heading ignores the plan': ['return Math.max(whole(input.totalSlides), whole(input.rows), input.plan.slideCount)', 'return Math.max(whole(input.totalSlides), whole(input.rows))'],
  'heading ignores the rows on screen': ['return Math.max(whole(input.totalSlides), whole(input.rows), input.plan.slideCount)', 'return Math.max(whole(input.totalSlides), input.plan.slideCount)'],
  'heading changed without a plan': ['if (!input.plan) return input.totalSlides', 'if (!input.plan) return Math.max(input.totalSlides, input.rows)'],
  'placeholders restart at the first slide (duplicate rows)': ['for (let index = rows; index < plan.slideCount; index += 1) {', 'for (let index = 0; index < plan.slideCount; index += 1) {'],
  'placeholders stop one short': ['for (let index = rows; index < plan.slideCount; index += 1) {', 'for (let index = rows; index < plan.slideCount - 1; index += 1) {'],
  'placeholders ignore built state': ['built: plan.built[index] === true,', 'built: false,'],
  'plan never records built slides': ["input.slideStates?.[index] === 'built'", 'false'],
  'placeholders ignore the Stage F preview': ["thumbnailUrl: typeof url === 'string' && url.trim() ? url.trim() : null,", 'thumbnailUrl: null,'],
  'preview not trimmed / blank accepted': ["typeof url === 'string' && url.trim() ? url.trim() : null", "typeof url === 'string' ? url : null"],
  'titles taken from the wrong index': ['if (index >= 0 && index < slideCount && title) titles[index] = title', 'if (index >= 0 && index < slideCount && title) titles[index + 1 < slideCount ? index + 1 : index] = title'],
  'titles not trimmed': ["typeof ghost?.title === 'string' ? ghost.title.trim() : ''", "typeof ghost?.title === 'string' ? ghost.title : ''"],
  'flag read loosely': ["process.env.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT !== undefined"],
  'flag default on': ["process.env.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT !== 'false'"],
};
const callSiteMutants = {
  'area passes the plan as a bare prop (flag off would still send it)': ['area', `{...(railBuildPlan ? { railBuildPlan } : {})} // ${MARK}`, `railBuildPlan={railBuildPlan} // ${MARK}`],
  'area ignores the partial-artifact gate': ['area', 'partialArtifact: Boolean(studioPartialArtifact), narrationActive,', 'partialArtifact: true, narrationActive,'],
  'area drops its marker (earlier pins would see an unlisted line)': ['area', `slideStates: buildNarration?.slideStates }) // ${MARK}`, 'slideStates: buildNarration?.slideStates })'],
  'viewer drops the rail when the frame has no rows (the swap flash)': ['viewer', ' || Boolean(railBuildRows?.length)) && ( //', ') && ( //'],
  'viewer pads the strip total (guards would read the plan)': ['viewer', '                totalSlides={totalSlides}\n                composeJobs={composeJobs}', '                totalSlides={Math.max(totalSlides, railBuildPlan?.slideCount ?? 0)}\n                composeJobs={composeJobs}'],
  'viewer gives the strip props without a plan': ['viewer', '{...(railBuildPlan && railBuildRows ? {', '{...(railBuildRows ? {'],
  'viewer builds the rows without the frame\'s real count': ['viewer', 'railBuildPlaceholders({ rows: slideThumbnails.length, plan: railBuildPlan, thumbnailUrlsBySlide })', 'railBuildPlaceholders({ rows: 0, plan: railBuildPlan, thumbnailUrlsBySlide })'],
  'strip gives the placeholder a second child expression (the flag-off tree changes shape)': ['strip', "        {orderedItems.map(item =>\n          item.kind === 'compose'", "        {[].map(() => null)}{orderedItems.map(item =>\n          item.kind === 'compose'"],
  'strip placeholder is drawn after real-row code': ['strip', 'if (slide.buildPlaceholder) return <RailBuildPlaceholderCard', 'const x = 1; if (slide.buildPlaceholder) return <RailBuildPlaceholderCard'],
  'strip guards read the heading total': ['strip', 'const slidesTotal = totalSlides ?? slides.length', 'const slidesTotal = headingTotal ?? totalSlides ?? slides.length'],
  'strip renders nothing when only placeholders exist': ['strip', ' && !buildPlaceholders?.length) { //', ') { //'],
  'card becomes clickable': ['card', '<button type="button" disabled tabIndex={-1}', '<button type="button" onClick={() => undefined} disabled tabIndex={-1}'],
  'card gains a drag handle': ['card', 'aria-disabled="true"', 'aria-disabled="true" draggable'],
  'card drops its row hooks (the Studio CSS would not style it)': ['card', 'data-studio-thumbnail-preview={studio}', 'data-preview={studio}'],
  'css hover rule loses its card scope (could lose to the card rule)': ['css', '[data-studio-thumbnail-card="true"][data-studio-thumbnail-build-placeholder="true"]:hover', '[data-studio-thumbnail-build-placeholder="true"]:hover'],
  'card stops importing its CSS': ['card', "import './studio-rail-build-placeholder.css'\n", ''],
};

const killed = [];
const survived = [];
function attempt(name, runSuite) {
  const before = testCount;
  let failed = false;
  const originalError = console.error;
  console.error = () => {};
  try { runSuite(); } catch { failed = true; } finally { console.error = originalError; }
  testCount = before; // mutant runs do not count as tests
  (failed ? killed : survived).push(name);
}
for (const [name, [from, to]] of Object.entries(helperMutants)) {
  const mutatedSource = mutate(libSource, from, to);
  const mutated = load(mutatedSource, { NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT: 'true' });
  attempt(`helper: ${name}`, () => suite(mutated, mutatedSource, false));
}
for (const [name, [key, from, to]] of Object.entries(callSiteMutants)) {
  const original = sources[key];
  sources[key] = mutate(original, from, to);
  attempt(`call site: ${name}`, () => suite(real, libSource, true));
  sources[key] = original;
}
same(survived, [], `mutants that survived: ${survived.join('; ')}`);
const mutantCount = killed.length;

console.log(`studio-rail-build-count: ${realTests} tests passed, ${mutantCount} mutants killed`);
