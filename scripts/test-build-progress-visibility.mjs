import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const helperPath = new URL('../lib/build-progress-visibility.ts', import.meta.url);
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

const { shouldShowBuildWorkingPulse } = mod.exports;
const builderSource = fs.readFileSync(
  new URL('../app/builder/page.tsx', import.meta.url),
  'utf8',
);
const messageListSource = fs.readFileSync(
  new URL('../components/builder/message-list.tsx', import.meta.url),
  'utf8',
);

assert.equal(shouldShowBuildWorkingPulse({
  isGeneratingFinal: true,
  hasVisibleThinkingStream: false,
  currentStatus: null,
}), true, 'acceptance should show progress before the first backend frame');

assert.equal(shouldShowBuildWorkingPulse({
  isGeneratingFinal: false,
  hasVisibleThinkingStream: false,
  currentStatus: { status: 'generating' },
}), true);

assert.equal(shouldShowBuildWorkingPulse({
  isGeneratingFinal: true,
  hasVisibleThinkingStream: true,
  currentStatus: null,
}), false, 'real lifecycle narration replaces the optimistic pulse');

assert.equal(shouldShowBuildWorkingPulse({
  isGeneratingFinal: false,
  hasVisibleThinkingStream: false,
  currentStatus: { status: 'idle' },
}), false);

assert.match(
  builderSource,
  /isGeneratingFinal=\{isGeneratingFinal\}/,
  'Builder must wire acceptance state into the transcript progress fallback',
);
assert.match(
  messageListSource,
  /shouldShowBuildWorkingPulse\(\{\s*isGeneratingFinal,\s*hasVisibleThinkingStream,\s*currentStatus,/,
  'MessageList must combine optimistic and backend progress state',
);
assert.match(
  builderSource,
  /status === 'idle' \|\| status === 'complete' \|\| status === 'error'[\s\S]*setIsGeneratingFinal\(false\)/,
  'ordinary build errors must clear optimistic progress',
);

console.log('build progress visibility tests passed');
