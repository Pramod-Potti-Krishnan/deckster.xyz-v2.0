// J2-F5 (R-20261007-frontend-10): the canvas must stay visible while the Slide generation panel is open.
// Flag NEXT_PUBLIC_STUDIO_PANEL_KEEP_CANVAS_ENABLED, default off. With the flag on, the canvas wrapper and the
// drawers change in one step (no margin/width animation), so the Layout iframe is resized once.
// Run: node scripts/test-studio-panel-keep-canvas.mjs   (plain node: transpile + vm, no network)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');

function load(env) {
  const compiled = ts.transpileModule(read('lib/studio-panel-keep-canvas.ts'), {
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

const FLAG = 'NEXT_PUBLIC_STUDIO_PANEL_KEEP_CANVAS_ENABLED';
const off = load({});
const on = load({ [FLAG]: 'true' });
const page = read('app/builder/page.tsx');
const css = read('components/builder/studio-workspace.css');

run('flag is read as the exact string "true" and defaults off', () => {
  assert.equal(off.STUDIO_PANEL_KEEP_CANVAS_ENABLED, false);
  for (const value of ['', 'false', '1', 'TRUE', 'True', ' true']) {
    assert.equal(load({ [FLAG]: value }).STUDIO_PANEL_KEEP_CANVAS_ENABLED, false, JSON.stringify(value));
  }
  assert.equal(on.STUDIO_PANEL_KEEP_CANVAS_ENABLED, true);
  assert.match(read('lib/studio-panel-keep-canvas.ts'), /process\.env\.NEXT_PUBLIC_STUDIO_PANEL_KEEP_CANVAS_ENABLED === 'true'/);
});

run('presentationWrapperTransition: flag off keeps the base classes exactly', () => {
  assert.equal(off.presentationWrapperTransition({ isResizingDrawer: false, keepCanvas: false }), 'transition-[margin] duration-300 ease-out');
  assert.equal(off.presentationWrapperTransition({ isResizingDrawer: true, keepCanvas: false }), '');
});

run('presentationWrapperTransition: flag on never animates the canvas margin', () => {
  assert.equal(on.presentationWrapperTransition({ isResizingDrawer: false, keepCanvas: true }), '');
  assert.equal(on.presentationWrapperTransition({ isResizingDrawer: true, keepCanvas: true }), '');
});

run('page: the base class expression is still there for the flag-off branch, byte for byte', () => {
  assert.ok(page.includes(`              STUDIO_PANEL_KEEP_CANVAS_ENABLED
                ? presentationWrapperTransition({ isResizingDrawer, keepCanvas: studioShell })
                : isResizingDrawer ? "" : "transition-[margin] duration-300 ease-out"`));
  assert.equal(page.split('"transition-[margin] duration-300 ease-out"').length - 1, 1, 'the page still has exactly the one base literal');
});

run('page: the workspace carries the marker attribute only with the flag on and the Studio shell', () => {
  assert.ok(page.includes('data-studio-panel-keep-canvas={studioShell && STUDIO_PANEL_KEEP_CANVAS_ENABLED ? "true" : undefined}'));
});

run('css: drawers stop animating only under the marker, and the base rule is untouched', () => {
  assert.ok(css.includes('[data-studio-v4-shell="true"] [data-studio-panel-keep-canvas="true"] [data-studio-workspace-drawer] { transition: none; }'));
  // The base rule (specificity 0,2,0) keeps its width animation; the marker rule (0,3,0) overrides it only when present.
  assert.ok(css.includes(`[data-studio-v4-shell="true"] [data-studio-workspace-drawer] {
  top: var(--studio-pane-toolbar-height);
  bottom: 0;
  transform: none;
  transition: width 180ms ease-out;
}`));
});

run('the slide space keeps its minimum 192x108 viewer viewport (nothing here shrinks it)', () => {
  assert.ok(css.includes('min-width: 192px;') && css.includes('min-height: 108px;'));
});

console.log(`studio-panel-keep-canvas: ${testCount} tests passed`);
