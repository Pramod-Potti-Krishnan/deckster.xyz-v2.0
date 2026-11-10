import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const helperPath = new URL('../lib/user-message-attachments.ts', import.meta.url);
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

const {
  attachmentsFromPayload,
  snapshotAttachedUploads,
} = mod.exports;
const builderSource = fs.readFileSync(
  new URL('../app/builder/page.tsx', import.meta.url),
  'utf8',
);
const messageListSource = fs.readFileSync(
  new URL('../components/builder/message-list.tsx', import.meta.url),
  'utf8',
);
const sessionHookSource = fs.readFileSync(
  new URL('../hooks/use-builder-session.ts', import.meta.url),
  'utf8',
);

{
  const attachments = snapshotAttachedUploads([
    {
      id: 'ready',
      name: 'strategy.pdf',
      size: 1200,
      type: 'application/pdf',
      status: 'success',
      geminiFileUri: 'must-not-leak',
      geminiStoreName: 'must-not-leak',
    },
    {
      id: 'processing',
      name: 'indexing.pdf',
      size: 300,
      type: 'application/pdf',
      status: 'processing',
    },
    {
      id: 'degraded',
      name: 'partially-indexed.pdf',
      size: 400,
      type: 'application/pdf',
      status: 'degraded',
    },
    {
      id: 'pending',
      name: 'pending.pdf',
      size: 100,
      type: 'application/pdf',
      status: 'uploading',
    },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(attachments)), [{
    id: 'ready',
    name: 'strategy.pdf',
    size: 1200,
    type: 'application/pdf',
  }, {
    id: 'processing',
    name: 'indexing.pdf',
    size: 300,
    type: 'application/pdf',
  }, {
    id: 'degraded',
    name: 'partially-indexed.pdf',
    size: 400,
    type: 'application/pdf',
  }]);
  assert.equal('geminiFileUri' in attachments[0], false);
  assert.equal('geminiStoreName' in attachments[0], false);
}

{
  const attachments = attachmentsFromPayload({
    text: 'Build a deck',
    attachments: [
      { id: 'one', name: 'brief.docx', size: 42, type: 'application/docx' },
      { id: '', name: 'invalid', size: -1, type: '' },
      null,
    ],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(attachments)), [{
    id: 'one',
    name: 'brief.docx',
    size: 42,
    type: 'application/docx',
  }]);
}

assert.deepEqual(
  JSON.parse(JSON.stringify(attachmentsFromPayload({ text: 'legacy row' }))),
  [],
);

assert.match(
  builderSource,
  /attachments:\s*messageAttachments/,
  'sent user bubbles must retain their attachment snapshot',
);
assert.match(
  builderSource,
  /payload:\s*messagePayload/,
  'attachment metadata must be persisted with the user message',
);
assert.match(
  messageListSource,
  /item\.attachments\.map\([\s\S]*<FileChip/,
  'persisted attachments must render in the chat transcript',
);
assert.match(
  sessionHookSource,
  /attachments:\s*attachmentsFromPayload\(msg\.payload\)/,
  'attachments must restore after a session reload',
);

console.log('user message attachment tests passed');
