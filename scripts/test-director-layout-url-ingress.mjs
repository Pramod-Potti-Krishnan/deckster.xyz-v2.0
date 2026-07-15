import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
}

const policyModule = { exports: {} };
vm.runInNewContext(compile(new URL('../lib/layout-viewer-url-policy.ts', import.meta.url)), {
  URL,
  module: policyModule,
  exports: policyModule.exports,
});

const ingressModule = { exports: {} };
vm.runInNewContext(compile(new URL('../lib/director-layout-url-ingress.ts', import.meta.url)), {
  module: ingressModule,
  exports: ingressModule.exports,
  require(specifier) {
    if (specifier === './layout-viewer-url-policy') return policyModule.exports;
    throw new Error(`Unexpected require: ${specifier}`);
  },
});

const { createLayoutViewerUrlPolicy } = policyModule.exports;
const { guardDirectorLayoutUrlMessage } = ingressModule.exports;
const uatOrigin = 'https://layout-builder-v75-uat.up.railway.app';
const productionOrigin = 'https://web-production-f0d13.up.railway.app';
const policy = createLayoutViewerUrlPolicy(uatOrigin);

const foreignFrames = [
  { type: 'sync_response', payload: { presentation_url: `${productionOrigin}/p/1`, presentation_id: 'id-1' } },
  { type: 'presentation_url', payload: { url: `${productionOrigin}/p/2`, presentation_id: 'id-2' } },
  { type: 'presentation_init', payload: { preview_url: `${productionOrigin}/p/3`, preview_presentation_id: 'id-3' } },
  { type: 'slide_update', payload: { preview_url: `${productionOrigin}/p/4`, preview_presentation_id: 'id-4', metadata: {} } },
  { type: 'slide_ready', payload: { presentation_url: `${productionOrigin}/p/5`, presentation_id: 'id-5' } },
];

for (const frame of foreignFrames) {
  const guarded = guardDirectorLayoutUrlMessage(frame, policy);
  assert.equal(guarded.ingress.status, 'blocked');
  assert.equal(guarded.ingress.url, null);
  assert.equal(guarded.ingress.presentationId, null);
  assert.equal(guarded.ingress.origin, productionOrigin);
  assert.equal(JSON.stringify(guarded.message).includes(productionOrigin), false);
  assert.equal(/id-[1-5]/.test(JSON.stringify(guarded.message)), false);
}

{
  const frame = {
    type: 'presentation_url',
    payload: { url: `${uatOrigin}/p/allowed`, presentation_id: 'allowed-id' },
  };
  const guarded = guardDirectorLayoutUrlMessage(frame, policy);
  assert.equal(guarded.ingress.status, 'allowed');
  assert.equal(guarded.ingress.url, frame.payload.url);
  assert.equal(guarded.ingress.presentationId, 'allowed-id');
  assert.equal(guarded.message, frame);
}

console.log('Director Layout URL ingress tests passed');
