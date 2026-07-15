import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const helperPath = new URL('../lib/layout-viewer-url-policy.ts', import.meta.url);
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
  module: mod,
  exports: mod.exports,
});

const {
  createLayoutViewerUrlPolicy,
  evaluateLayoutViewerUrl,
  gateLayoutViewerUrlIngress,
  recoverRestoredLayoutViewerUrls,
  sanitizeRestoredLayoutViewerUrls,
} = mod.exports;

const uatOrigin = 'https://layout-builder-v75-uat.up.railway.app';
const productionOrigin = 'https://web-production-f0d13.up.railway.app';
const uatPolicy = createLayoutViewerUrlPolicy(uatOrigin);

assert.equal(
  evaluateLayoutViewerUrl(`${uatOrigin}/p/uat-presentation`, uatPolicy).status,
  'allowed',
);

{
  const decision = evaluateLayoutViewerUrl(
    `${productionOrigin}/p/production-presentation`,
    uatPolicy,
  );
  assert.equal(decision.status, 'blocked');
  assert.equal(decision.reason, 'unapproved_origin');
  assert.equal(decision.origin, productionOrigin);
}

{
  const restored = sanitizeRestoredLayoutViewerUrls({
    presentationUrl: `${productionOrigin}/p/production-presentation`,
    presentationId: 'production-presentation',
    strawmanPreviewUrl: `${uatOrigin}/p/uat-presentation`,
    strawmanPresentationId: 'uat-presentation',
    finalPresentationUrl: `${productionOrigin}/p/production-presentation`,
    finalPresentationId: 'production-presentation',
  }, uatPolicy);

  assert.equal(restored.state.presentationUrl, null);
  assert.equal(restored.state.presentationId, null);
  assert.equal(restored.state.finalPresentationUrl, null);
  assert.equal(restored.state.finalPresentationId, null);
  assert.equal(restored.state.strawmanPreviewUrl, `${uatOrigin}/p/uat-presentation`);
  assert.equal(restored.state.strawmanPresentationId, 'uat-presentation');
  assert.equal(restored.blocked.length, 2);
}

{
  const ingress = gateLayoutViewerUrlIngress(
    `${productionOrigin}/p/production-presentation`,
    'production-presentation',
    uatPolicy,
  );
  assert.equal(ingress.status, 'blocked');
  assert.equal(ingress.url, null);
  assert.equal(ingress.presentationId, null);
  assert.equal(ingress.origin, productionOrigin);
}

{
  const migrationPolicy = createLayoutViewerUrlPolicy(uatOrigin, productionOrigin);
  assert.equal(
    evaluateLayoutViewerUrl(
      `${productionOrigin}/p/production-presentation`,
      migrationPolicy,
    ).status,
    'allowed',
    'an additional origin is allowed only when explicitly configured',
  );
}

{
  const verifiedIds = [];
  const restored = await recoverRestoredLayoutViewerUrls({
    presentationUrl: `${productionOrigin}/p/shared-presentation`,
    presentationId: 'shared-presentation',
    finalPresentationUrl: `${productionOrigin}/p/shared-presentation`,
    finalPresentationId: 'shared-presentation',
  }, uatPolicy, async (presentationId) => {
    verifiedIds.push(presentationId);
    return presentationId === 'shared-presentation';
  });

  assert.equal(restored.state.presentationUrl, `${uatOrigin}/p/shared-presentation`);
  assert.equal(restored.state.finalPresentationUrl, `${uatOrigin}/p/shared-presentation`);
  assert.equal(restored.state.presentationId, 'shared-presentation');
  assert.equal(restored.blocked.length, 0);
  assert.equal(restored.recovered.length, 2);
  assert.deepEqual(verifiedIds, ['shared-presentation'], 'the same id is verified only once');
}

{
  const restored = await recoverRestoredLayoutViewerUrls({
    finalPresentationUrl: `${productionOrigin}/p/production-only`,
    finalPresentationId: 'production-only',
  }, uatPolicy, async () => false);

  assert.equal(restored.state.finalPresentationUrl, null);
  assert.equal(restored.state.finalPresentationId, null);
  assert.equal(restored.recovered.length, 0);
  assert.equal(restored.blocked.length, 1);
}

for (const value of [
  'not-a-url',
  'javascript:alert(1)',
  `https://user:password@${new URL(uatOrigin).host}/p/presentation`,
]) {
  assert.equal(evaluateLayoutViewerUrl(value, uatPolicy).status, 'blocked');
}

console.log('layout viewer URL policy tests passed');
