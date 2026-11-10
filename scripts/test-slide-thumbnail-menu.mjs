// Unit tests for lib/slide-thumbnail-menu.ts (Canvas v2 P4).
// Run: pnpm test:slide-thumbnail-menu   (plain node — transpile + vm)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/slide-thumbnail-menu.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports });
const { getSlideMenuActions, slideMenuHasAnyAction } = mod.exports;

const stripSource = fs.readFileSync(
  new URL('../components/slide-thumbnail-strip.tsx', import.meta.url),
  'utf8',
);

let testCount = 0;
function run(name, fn) {
  testCount += 1;
  try {
    fn();
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

const CAN_ALL = { duplicate: true, changeLayout: true, reorder: true, deleteOne: true, deleteMulti: true };
const base = { realSlideNumber: 2, slidesTotal: 5, isItemProcessing: false, selectedCount: 0, can: CAN_ALL };

run('all handlers: full menu, correctly gated', () => {
  const m = getSlideMenuActions(base);
  assert.ok(m.duplicate && !m.duplicate.disabled);
  assert.ok(m.changeLayout && !m.changeLayout.disabled);
  assert.ok(m.moveUp && !m.moveUp.disabled);
  assert.ok(m.moveDown && !m.moveDown.disabled);
  assert.ok(m.delete && !m.delete.multi && m.delete.label === 'Delete Slide' && !m.delete.disabled);
  assert.equal(slideMenuHasAnyAction(m), true);
});

run('move bounds: first slide cannot move up, last cannot move down', () => {
  const first = getSlideMenuActions({ ...base, realSlideNumber: 1 });
  assert.equal(first.moveUp.disabled, true);
  assert.equal(first.moveDown.disabled, false);
  const last = getSlideMenuActions({ ...base, realSlideNumber: 5 });
  assert.equal(last.moveUp.disabled, false);
  assert.equal(last.moveDown.disabled, true);
});

run('processing disables every action', () => {
  const m = getSlideMenuActions({ ...base, isItemProcessing: true });
  assert.equal(m.duplicate.disabled, true);
  assert.equal(m.changeLayout.disabled, true);
  assert.equal(m.moveUp.disabled, true);
  assert.equal(m.moveDown.disabled, true);
  assert.equal(m.delete.disabled, true);
});

run('multi-select delete: label counts, cannot delete all', () => {
  const m = getSlideMenuActions({ ...base, selectedCount: 3 });
  assert.equal(m.delete.multi, true);
  assert.equal(m.delete.label, 'Delete 3 Slides');
  assert.equal(m.delete.disabled, false);
  const all = getSlideMenuActions({ ...base, selectedCount: 5 });
  assert.equal(all.delete.disabled, true);
});

run('multi-selected without a bulk handler falls back to single delete', () => {
  const m = getSlideMenuActions({ ...base, selectedCount: 3, can: { ...CAN_ALL, deleteMulti: false } });
  assert.equal(m.delete.multi, false);
  assert.equal(m.delete.label, 'Delete Slide');
});

run('single-delete gate: last remaining slide is not deletable', () => {
  const m = getSlideMenuActions({ ...base, realSlideNumber: 1, slidesTotal: 1 });
  assert.equal(m.delete.disabled, true);
});

run('no handlers: empty model, dots menu hidden', () => {
  const m = getSlideMenuActions({
    ...base,
    can: { duplicate: false, changeLayout: false, reorder: false, deleteOne: false, deleteMulti: false },
  });
  assert.equal(m.duplicate, null);
  assert.equal(m.changeLayout, null);
  assert.equal(m.moveUp, null);
  assert.equal(m.moveDown, null);
  assert.equal(m.delete, null);
  assert.equal(slideMenuHasAnyAction(m), false);
});

// ---- source pins: the strip really uses the shared model, and the old
// overlay badge + hover delete are gone ----

run('strip: both menus render through the one shared model', () => {
  assert.ok(stripSource.includes('getSlideMenuActions('), 'model not consumed');
  const renders = (stripSource.match(/renderMenuItems\(\{/g) || []).length;
  assert.equal(renders, 2, 'exactly two renderers (context + dropdown) must consume renderMenuItems');
  assert.ok(stripSource.includes('DropdownMenuTrigger'), 'dots dropdown missing');
});

run('strip: number badge no longer overlays the slide image; no hover delete button', () => {
  assert.ok(!stripSource.includes('Slide number badge in corner'), 'overlay badge block still present');
  assert.ok(!stripSource.includes('Delete button - appears on hover'), 'hover delete still present');
  // The SLIDE tile's overlay badge (identified by its thumbnail color branch)
  // must be gone. The transient compose-job placeholder tile (no image) keeps
  // its corner number — there is no thumbnail to obscure.
  assert.ok(!stripSource.includes('bg-slate-900/80'), 'slide-tile overlay badge still present');
});

console.log(`slide-thumbnail-menu: ${testCount} tests passed`);
