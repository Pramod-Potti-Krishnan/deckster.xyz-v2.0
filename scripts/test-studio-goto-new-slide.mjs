// J2-F7 (R-20261007-frontend-11): after a synchronous generation the viewer must land on the new slide
// (not slide 1), and the Generate button must not move while the prompt is typed.
// Flag NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED, default off.
// Run: node scripts/test-studio-goto-new-slide.mjs   (plain node: transpile + vm + react-dom/server, no network)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Minimal TS/TSX loader. `env` is what the module sees as process.env (so NEXT_PUBLIC_* flags can be flipped).
function loadModule(file, env, stubs = {}, cache = new Map()) {
  const full = path.join(root, file);
  const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const mod = { exports: {} };
  const resolveLocal = id => {
    const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(full), id);
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return path.relative(root, base + ext);
    }
    throw new Error(`cannot resolve ${id} from ${file}`);
  };
  const requireFn = id => {
    if (id in stubs) return stubs[id];
    if (id.endsWith('.css')) return {};
    if (id.startsWith('@/') || id.startsWith('.')) {
      const rel = resolveLocal(id);
      if (!cache.has(rel)) cache.set(rel, loadModule(rel, env, stubs, cache));
      return cache.get(rel);
    }
    return req(id);
  };
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require: requireFn, process: { env }, console });
  return mod.exports;
}

let testCount = 0;
function run(name, fn) {
  testCount += 1;
  try { fn(); } catch (err) { console.error(`FAIL: ${name}`); throw err; }
}

const FLAG = 'NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED';
const off = loadModule('lib/studio-goto-new-slide.ts', {});
const on = loadModule('lib/studio-goto-new-slide.ts', { [FLAG]: 'true' });
const page = read('app/builder/page.tsx');
const panel = read('components/slide-generation-panel/index.tsx');
const input = read('components/generation-panel/shared/generation-input.tsx');

run('flag is read as the exact string "true" and defaults off', () => {
  assert.equal(off.STUDIO_GOTO_NEW_SLIDE_ENABLED, false);
  for (const value of ['', 'false', '1', 'TRUE', 'True', ' true']) {
    assert.equal(loadModule('lib/studio-goto-new-slide.ts', { [FLAG]: value }).STUDIO_GOTO_NEW_SLIDE_ENABLED, false, JSON.stringify(value));
  }
  assert.equal(on.STUDIO_GOTO_NEW_SLIDE_ENABLED, true);
  assert.match(read('lib/studio-goto-new-slide.ts'), /process\.env\.NEXT_PUBLIC_STUDIO_GOTO_NEW_SLIDE_ENABLED === 'true'/);
});

const armed = {
  enabled: true, lane: 'compose', existingDeck: true, draftStillCurrent: true,
  restoreSelection: false, startVisualIndex: 1, currentVisualIndex: 1,
};

run('shouldArmGoToNewSlide: arms exactly where the identity restore has no context (the J2 edit-mode case)', () => {
  assert.equal(on.shouldArmGoToNewSlide(armed), true);
});

run('shouldArmGoToNewSlide: every condition is required', () => {
  const cases = [
    { enabled: false },
    { lane: 'refine' },
    { existingDeck: false },
    { draftStillCurrent: false },
    { restoreSelection: true }, // the identity restore owns the selection
    { startVisualIndex: undefined }, // request started with the flag off
    { currentVisualIndex: 4 }, // the user moved to another slide while the request ran
  ];
  for (const change of cases) assert.equal(on.shouldArmGoToNewSlide({ ...armed, ...change }), false, JSON.stringify(change));
});

run('goToNewSlideIntent: the insert acknowledgement', () => {
  assert.deepEqual({ ...on.goToNewSlideIntent({ slide_index: 3, real_slide_id: 'slide_abc' }) }, { slideId: 'slide_abc', slideIndex: 3 });
  assert.deepEqual({ ...on.goToNewSlideIntent({ slide_index: 3 }) }, { slideId: null, slideIndex: 3 });
  assert.deepEqual({ ...on.goToNewSlideIntent({ slide_index: 0, slide_id: 'slide_x' }) }, { slideId: 'slide_x', slideIndex: 0 });
  assert.deepEqual({ ...on.goToNewSlideIntent({ slide_index: 2, real_slide_id: ' padded ' }) }, { slideId: null, slideIndex: 2 });
  assert.deepEqual({ ...on.goToNewSlideIntent({ slide_index: 2, real_slide_id: '' }) }, { slideId: null, slideIndex: 2 });
  for (const bad of [-1, 1.5, NaN, '3', null, undefined]) assert.equal(on.goToNewSlideIntent({ slide_index: bad }), null, String(bad));
});

const order = { nativeCount: 5, slideIds: ['a', 'b', 'c', 'd', 'e'] };

run('resolveGoToNewSlideTarget: by identity when the result names the slide', () => {
  assert.deepEqual({ ...on.resolveGoToNewSlideTarget(order, { slideId: 'd', slideIndex: 1 }) }, { visualIndex: 3, by: 'identity' });
});

run('resolveGoToNewSlideTarget: a named slide that is not in the viewer is never replaced by its index', () => {
  assert.equal(on.resolveGoToNewSlideTarget(order, { slideId: 'zzz', slideIndex: 1 }), null);
});

run('resolveGoToNewSlideTarget: without an id, the acknowledged index when the deck contains it', () => {
  assert.deepEqual({ ...on.resolveGoToNewSlideTarget(order, { slideId: null, slideIndex: 2 }) }, { visualIndex: 2, by: 'index' });
  assert.equal(on.resolveGoToNewSlideTarget(order, { slideId: null, slideIndex: 5 }), null);
});

run('page: the go-to is armed and run only behind the flag; the existing identity restore is untouched', () => {
  assert.match(page, /from '@\/lib\/studio-goto-new-slide'/);
  // Original restore decision, verbatim.
  assert.ok(page.includes("const restoreSelection = Boolean(record.lane !== 'refine' && selection?.draftStillCurrent && record.context?.isCurrent() && record.priorOrder)"));
  assert.ok(page.includes('target: target && !record.priorOrder?.slideIds.includes(target.slideId) ? target : null,'));
  // Arming and the start index exist only with the flag.
  assert.ok(page.includes('...(STUDIO_GOTO_NEW_SLIDE_ENABLED ? { startVisualIndex: currentSlideIndexRef.current } : {}),'));
  assert.ok(page.includes('...(STUDIO_GOTO_NEW_SLIDE_ENABLED && shouldArmGoToNewSlide({'));
  // The restore entry hands over to the go-to only when armed.
  assert.ok(page.includes('if (STUDIO_GOTO_NEW_SLIDE_ENABLED && pending.goToNewSlide) { await goToNewSlideAfterSync(apis, pending, attempt); return }'));
});

run('page: goToNewSlideAfterSync reads the native order, navigates through the verified path and is retired by any newer request', () => {
  const body = page.slice(page.indexOf('async function goToNewSlideAfterSync'), page.indexOf('async function restoreStudioSyncSelection'));
  assert.match(body, /apis\.composeGetState\(\)/);
  assert.match(body, /apis\.composeGoToVisualIndex\(target\.visualIndex, \{ isCurrent: sameRequest \}\)/);
  for (const guard of ['studioSyncPendingRef.current === pending', 'pending.observedRefresh', 'studioSyncRequestRef.current === request',
    'studioSyncSequenceRef.current === request.sequence', 'studioSyncRefreshRevisionRef.current === pending.refreshRevision',
    'request.isOwnerCurrent()', 'composeSelectionAttemptRef.current === attempt', 'composeViewerApiRef.current === apis']) {
    assert.ok(body.includes(guard), `missing guard ${guard}`);
  }
  // No positional navigation outside resolveGoToNewSlideTarget.
  assert.ok(!/goToSlide|handleGoToSlide|postMessage/.test(body));
});

// ---- Generate button position -------------------------------------------------------------------
const reactStubs = env => {
  const icon = () => null;
  return {
    'lucide-react': new Proxy({}, { get: () => icon }),
    '@/components/ui/popover': { Popover: ({ children }) => children, PopoverContent: () => null, PopoverTrigger: ({ children }) => children },
    '@/lib/element-prompt-limit': { elementPromptLengthState: (prompt) => ({ length: prompt.length, overLimit: false, overflow: 0 }) },
  };
};
const { renderToStaticMarkup } = req('react-dom/server');
const React = req('react');
function renderInput(props) {
  const { GenerationInput } = loadModule('components/generation-panel/shared/generation-input.tsx', {}, reactStubs());
  return renderToStaticMarkup(React.createElement(GenerationInput, {
    prompt: '', onPromptChange() {}, mandatoryConfig: null, showAdvanced: false, onToggleAdvanced() {},
    onSubmit() {}, isGenerating: false, error: null, ...props,
  }));
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const textareaTag = markup => markup.match(/<textarea[^>]*>/)[0];

run('GenerationInput flag off: markup is identical with the prop absent, undefined or false (no style on the textarea)', () => {
  const absent = renderInput({});
  assert.equal(renderInput({ stableSubmit: undefined }), absent);
  assert.equal(renderInput({ stableSubmit: false }), absent);
  assert.ok(!/style=/.test(textareaTag(absent)), textareaTag(absent));
  console.log(`  flag-off GenerationInput markup sha256[:16] = ${sha(absent)} (${absent.length} bytes)`);
});

run('GenerationInput flag on: the only markup difference is the fixed textarea height', () => {
  const base = renderInput({});
  const stable = renderInput({ stableSubmit: true });
  assert.notEqual(stable, base);
  assert.match(textareaTag(stable), /style="height:160px"/);
  assert.equal(stable.replace(' style="height:160px"', ''), base);
});

run('GenerationInput: the auto-grow effect is skipped with the flag on and unchanged otherwise', () => {
  assert.ok(input.includes("    if (stableSubmit) return\n    const ta = textareaRef.current\n    if (!ta) return\n    ta.style.height = 'auto'\n    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`\n  }, [prompt, stableSubmit])"));
});

run('only the Slide panel opts in; the Element generation panel is unchanged', () => {
  assert.ok(panel.includes('stableSubmit={STUDIO_GOTO_NEW_SLIDE_ENABLED}'));
  const element = read('components/generation-panel/index.tsx');
  assert.ok(!element.includes('stableSubmit'));
});

console.log(`studio-goto-new-slide: ${testCount} tests passed`);
