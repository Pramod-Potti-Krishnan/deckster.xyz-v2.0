// J2-F4 (R-20261007-frontend-9): header (rail) count and footer "Slide x / y" must not disagree after a
// slide CRUD acknowledgement. Flag NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED, default off.
// Run: node scripts/test-studio-slide-count-sync.mjs   (plain node: transpile + vm, no network)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

function loadSync(env) {
  const compiled = ts.transpileModule(read('lib/studio-slide-count-sync.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env } });
  return mod.exports;
}

let testCount = 0;
function run(name, fn) {
  testCount += 1;
  try { fn(); } catch (err) { console.error(`FAIL: ${name}`); throw err; }
}

const viewer = read('components/presentation-viewer.tsx');
const off = loadSync({});
const on = loadSync({ NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED: 'true' });

run('flag is read as the exact string "true" and defaults off', () => {
  assert.equal(off.STUDIO_SLIDE_COUNT_SYNC_ENABLED, false);
  for (const value of ['', 'false', '1', 'TRUE', 'True', ' true', 'yes']) {
    assert.equal(loadSync({ NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED: value }).STUDIO_SLIDE_COUNT_SYNC_ENABLED, false, JSON.stringify(value));
  }
  assert.equal(on.STUDIO_SLIDE_COUNT_SYNC_ENABLED, true);
  assert.match(read('lib/studio-slide-count-sync.ts'), /process\.env\.NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED === 'true'/);
});

run('visualTotalAfterCommit: Add moves the visual total with the real total', () => {
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 7, visualBefore: 7, totalAfter: 8 }), 8);
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 12, visualBefore: 12, totalAfter: 13 }), 13);
});

run('visualTotalAfterCommit: pending Composer sections stay counted', () => {
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 7, visualBefore: 8, totalAfter: 8 }), 9);
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 7, visualBefore: 9, totalAfter: 6 }), 8);
});

run('visualTotalAfterCommit: a visual total that fell behind never lands below the real total', () => {
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 8, visualBefore: 7, totalAfter: 9 }), 9);
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 8, visualBefore: 0, totalAfter: 9 }), 9);
});

run('visualTotalAfterCommit: Delete and Duplicate acks', () => {
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 7, visualBefore: 7, totalAfter: 5 }), 5);
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 7, visualBefore: 7, totalAfter: 8 }), 8);
});

run('visualTotalAfterCommit: non-finite input is treated as zero, not NaN', () => {
  assert.equal(on.visualTotalAfterCommit({ totalBefore: NaN, visualBefore: Infinity, totalAfter: 4 }), 4);
  assert.equal(on.visualTotalAfterCommit({ totalBefore: 3, visualBefore: 3, totalAfter: NaN }), 0);
});

// The footer expression exactly as it is on the base branch.
const baseFooter = ({ visualTotalSlides, totalSlides, slideCount, partialArtifact }) =>
  visualTotalSlides || totalSlides || slideCount || (partialArtifact ? '—' : 1);

run('syncedFooterTotal never shows a total below the real count (the J2-F4 state)', () => {
  const lagging = { visualTotalSlides: 7, totalSlides: 8, slideCount: 7, partialArtifact: false };
  assert.equal(baseFooter(lagging), 7, 'base shows the stale visual total');
  assert.equal(on.syncedFooterTotal(lagging), 8);
  assert.equal(on.syncedFooterTotal({ ...lagging, visualTotalSlides: 12, totalSlides: 11 }), 12, 'pending sections still count');
});

run('syncedFooterTotal falls back exactly as the base expression does', () => {
  for (const partialArtifact of [false, true]) {
    for (const slideCount of [undefined, null, 0, 5]) {
      const input = { visualTotalSlides: 0, totalSlides: 0, slideCount, partialArtifact };
      assert.equal(on.syncedFooterTotal(input), baseFooter(input), JSON.stringify(input));
    }
  }
});

run('syncedFooterTotal equals the base expression whenever visual >= real (every non-bug state)', () => {
  for (let total = 0; total <= 4; total += 1) {
    for (let visual = total; visual <= 5; visual += 1) {
      for (const slideCount of [undefined, 0, 3]) {
        for (const partialArtifact of [false, true]) {
          const input = { visualTotalSlides: visual, totalSlides: total, slideCount, partialArtifact };
          assert.equal(on.syncedFooterTotal(input), baseFooter(input), JSON.stringify(input));
        }
      }
    }
  }
});

// Model of the ack handlers: counters as they are right after the ack, before the next 3 s poll.
function afterAck({ total, visual }, newTotal, flag) {
  const next = { total: newTotal, visual };
  if (flag) next.visual = on.visualTotalAfterCommit({ totalBefore: total, visualBefore: visual, totalAfter: newTotal });
  return next;
}
const railOf = state => state.total;
const footerOf = (state, flag) => flag
  ? on.syncedFooterTotal({ visualTotalSlides: state.visual, totalSlides: state.total, slideCount: 7, partialArtifact: false })
  : baseFooter({ visualTotalSlides: state.visual, totalSlides: state.total, slideCount: 7, partialArtifact: false });

run('flag off: after an Add ack the footer lags the rail by one (today)', () => {
  const state = afterAck({ total: 7, visual: 7 }, 8, false);
  assert.equal(railOf(state), 8);
  assert.equal(footerOf(state, false), 7);
});

run('flag on: after an Add, Duplicate or Delete ack the rail and footer agree, five Adds in a row', () => {
  let state = { total: 7, visual: 7 };
  for (let n = 8; n <= 12; n += 1) {
    state = afterAck(state, n, true);
    assert.equal(railOf(state), footerOf(state, true), `after add -> ${n}`);
  }
  state = afterAck(state, 11, true); // delete one
  assert.equal(railOf(state), footerOf(state, true));
  state = afterAck(state, 12, true); // duplicate one
  assert.equal(railOf(state), footerOf(state, true));
});

run('call sites: all three acks commit both counters behind the flag, and the flag-off paths are untouched', () => {
  assert.match(viewer, /from '@\/lib\/studio-slide-count-sync'/);
  // Original commits are still there, unconditional.
  assert.ok(viewer.includes('        commit(setTotalSlides, newTotal)\n'));
  assert.ok(viewer.includes('        mutation.commit(setTotalSlides, newTotal)\n'));
  assert.ok(viewer.includes('      mutation.commit(setTotalSlides, remainingCount)\n'));
  const guarded = [...viewer.matchAll(/if \(STUDIO_SLIDE_COUNT_SYNC_ENABLED\) \{\n\s+(?:mutation\.)?commit\(setVisualTotalSlides, visualTotalAfterCommit\(\{\n\s+totalBefore: slideTotalsRef\.current\.total, visualBefore: slideTotalsRef\.current\.visual, totalAfter: (\w+),/g)]
    .map(match => match[1]);
  assert.deepEqual(guarded, ['newTotal', 'newTotal', 'remainingCount']);
});

run('call site: the footer keeps the base expression verbatim as its flag-off branch', () => {
  assert.ok(viewer.includes(": visualTotalSlides || totalSlides || slideCount || (studioPartialArtifact ? '—' : 1)}</span>"));
  assert.ok(viewer.includes('STUDIO_SLIDE_COUNT_SYNC_ENABLED\n                ? syncedFooterTotal({ visualTotalSlides, totalSlides, slideCount, partialArtifact: Boolean(studioPartialArtifact) })'));
});

run('rail heading still reads the real total (this change does not touch the thumbnail strip)', () => {
  const strip = read('components/slide-thumbnail-strip.tsx');
  assert.ok(strip.includes('const slidesTotal = totalSlides ?? slides.length'));
  assert.ok(!strip.includes('studio-slide-count-sync'));
});

console.log(`studio-slide-count-sync: ${testCount} tests passed`);
