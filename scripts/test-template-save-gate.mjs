import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const helperPath = new URL('../lib/template-save-gate.ts', import.meta.url);
const source = fs.readFileSync(helperPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  URL,
  decodeURIComponent,
  module: mod,
  exports: mod.exports,
  require,
});

const { getTemplateSaveGate, extractPresentationIdFromViewerUrl } = mod.exports;

function finalDeck(overrides = {}) {
  return {
    templateBuilderEnabled: true,
    sessionId: 'session-1',
    deckOwnerSessionId: 'session-1',
    presentationUrl: 'https://layout.example.com/p/final-pres',
    presentationId: 'final-pres',
    finalPresentationUrl: 'https://layout.example.com/p/final-pres',
    templateSavePresentationId: 'final-pres',
    activeVersion: 'final',
    isBlankPresentation: false,
    templateModeOn: false,
    ...overrides,
  };
}

{
  const result = getTemplateSaveGate(finalDeck());
  assert.equal(result.canSave, true);
  assert.equal(result.sourcePresentationId, 'final-pres');
  assert.equal(result.disabledReason, null);
}

{
  const result = getTemplateSaveGate(finalDeck({
    deckOwnerSessionId: 'stale-session',
    templateSavePresentationId: null,
    presentationId: null,
  }));
  assert.equal(result.canSave, true);
  assert.equal(result.sourcePresentationId, 'final-pres');
  assert.equal(result.disabledReason, null);
}

{
  const result = getTemplateSaveGate(finalDeck({
    activeVersion: 'blank',
    isBlankPresentation: true,
    presentationUrl: 'https://layout.example.com/p/blank-pres',
    finalPresentationUrl: null,
    templateSavePresentationId: null,
  }));
  assert.equal(result.canSave, false);
  assert.equal(result.disabledReason, 'blank_presentation');
}

{
  const result = getTemplateSaveGate(finalDeck({
    activeVersion: 'strawman',
    presentationUrl: 'https://layout.example.com/p/strawman-pres',
    finalPresentationUrl: null,
    templateSavePresentationId: null,
  }));
  assert.equal(result.canSave, false);
  assert.equal(result.disabledReason, 'not_final_deck');
}

{
  const result = getTemplateSaveGate(finalDeck({ templateModeOn: true }));
  assert.equal(result.canSave, false);
  assert.equal(result.disabledReason, 'template_mode');
}

{
  const result = getTemplateSaveGate(finalDeck({
    deckOwnerSessionId: 'stale-session',
  }));
  const templateSelectionLocked = true;
  assert.equal(result.canSave, true);
  assert.equal(templateSelectionLocked, true);
}

{
  assert.equal(
    extractPresentationIdFromViewerUrl('https://web-production-f0d13.up.railway.app/p/6c256436-0509-4eed-94d5-56162725bc3f?showNotes=false'),
    '6c256436-0509-4eed-94d5-56162725bc3f',
  );
}

console.log('template save gate tests passed');
