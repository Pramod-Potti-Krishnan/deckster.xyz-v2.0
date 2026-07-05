import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const helperPath = new URL('../lib/director-sync-recovery.ts', import.meta.url);
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

const { applyFinalSyncRecovery } = mod.exports;

function baseState(overrides = {}) {
  return {
    presentationUrl: null,
    finalPresentationUrl: null,
    deckOwnerSessionId: null,
    presentationId: null,
    finalPresentationId: null,
    activeVersion: 'blank',
    isBlankPresentation: true,
    slideCount: null,
    currentStatus: { status: 'generating' },
    ...overrides,
  };
}

function recover(state, payload) {
  return applyFinalSyncRecovery(state, payload, 'session-1');
}

{
  const result = recover(baseState(), {
    current_state: 'CONTENT_GENERATED',
    presentation_url: 'https://layout.example.com/p/final',
    presentation_id: 'pres-final',
    slide_count: 6,
  });

  assert.equal(result.didRecover, true);
  assert.equal(result.didChangeDisplayedDeck, true);
  assert.equal(result.state.presentationUrl, 'https://layout.example.com/p/final');
  assert.equal(result.state.finalPresentationUrl, 'https://layout.example.com/p/final');
  assert.equal(result.state.presentationId, 'pres-final');
  assert.equal(result.state.finalPresentationId, 'pres-final');
  assert.equal(result.state.activeVersion, 'final');
  assert.equal(result.state.isBlankPresentation, false);
  assert.equal(result.state.slideCount, 6);
  assert.equal(result.state.currentStatus, null);
}

{
  const result = recover(baseState({
    presentationUrl: 'https://layout.example.com/p/blank',
    blankPresentationUrl: 'https://layout.example.com/p/blank',
    presentationId: 'pres-blank',
    activeVersion: 'blank',
  }), {
    current_state: 'CONTENT_GENERATED',
    presentation_url: 'https://layout.example.com/p/final',
    presentation_id: 'pres-final',
    slide_count: 6,
  });

  assert.equal(result.didRecover, true);
  assert.equal(result.didChangeDisplayedDeck, true);
  assert.equal(result.state.presentationUrl, 'https://layout.example.com/p/final');
  assert.equal(result.state.activeVersion, 'final');
}

{
  const result = recover(baseState({
    presentationUrl: 'https://layout.example.com/p/strawman',
    strawmanPreviewUrl: 'https://layout.example.com/p/strawman',
    activeVersion: 'strawman',
  }), {
    current_state: 'COMPLETE',
    presentation_url: 'https://layout.example.com/p/final',
    presentation_id: 'pres-final',
    slide_count: 6,
  });

  assert.equal(result.didRecover, true);
  assert.equal(result.didChangeDisplayedDeck, true);
  assert.equal(result.state.presentationUrl, 'https://layout.example.com/p/final');
  assert.equal(result.state.activeVersion, 'final');
}

{
  const state = baseState({
    presentationUrl: 'https://layout.example.com/p/blank',
    activeVersion: 'blank',
  });
  const result = recover(state, {
    current_state: 'BLANK_PRESENTATION',
    presentation_url: 'https://layout.example.com/p/blank',
    presentation_id: 'pres-blank',
  });

  assert.equal(result.didRecover, false);
  assert.equal(result.didChangeDisplayedDeck, false);
  assert.equal(result.state, state);
}

{
  const state = baseState({
    presentationUrl: 'https://layout.example.com/p/strawman',
    activeVersion: 'strawman',
  });
  const result = recover(state, {
    current_state: 'REFINE_STRAWMAN',
    presentation_url: 'https://layout.example.com/p/strawman',
    presentation_id: 'pres-strawman',
  });

  assert.equal(result.didRecover, false);
  assert.equal(result.didChangeDisplayedDeck, false);
  assert.equal(result.state, state);
}

{
  const state = baseState({
    presentationUrl: 'https://layout.example.com/p/final',
    finalPresentationUrl: 'https://layout.example.com/p/final',
    presentationId: 'pres-final',
    finalPresentationId: 'pres-final',
    activeVersion: 'final',
    isBlankPresentation: false,
    slideCount: 6,
    currentStatus: null,
  });
  const result = recover(state, {
    current_state: 'CONTENT_GENERATED',
    presentation_url: 'https://layout.example.com/p/final',
    presentation_id: 'pres-final',
    slide_count: 6,
  });

  assert.equal(result.didRecover, false);
  assert.equal(result.didChangeDisplayedDeck, false);
  assert.equal(result.state, state);
}

{
  const state = baseState({
    presentationUrl: 'https://layout.example.com/p/final',
    finalPresentationUrl: 'https://layout.example.com/p/final',
    presentationId: null,
    finalPresentationId: null,
    activeVersion: 'final',
    isBlankPresentation: false,
    slideCount: 6,
    currentStatus: null,
  });
  const result = recover(state, {
    current_state: 'CONTENT_GENERATED',
    presentation_url: 'https://layout.example.com/p/final',
    presentation_id: 'pres-final',
    slide_count: 6,
  });

  assert.equal(result.didRecover, true);
  assert.equal(result.didChangeDisplayedDeck, false);
  assert.equal(result.state.presentationUrl, 'https://layout.example.com/p/final');
  assert.equal(result.state.finalPresentationId, 'pres-final');
}

console.log('director sync recovery tests passed');
