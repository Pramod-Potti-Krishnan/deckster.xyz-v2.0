import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const helperPath = new URL('../lib/layout-viewer-messaging.ts', import.meta.url);
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
  getLayoutViewerOrigin,
  isTrustedLayoutViewerMessage,
} = mod.exports;

const configuredOrigin = 'https://layout-builder-v75-uat.up.railway.app';
const restoredOrigin = 'https://web-production-f0d13.up.railway.app';
const viewerWindow = {};
const otherWindow = {};
const iframe = {
  src: `${restoredOrigin}/p/presentation-1`,
  contentWindow: viewerWindow,
};

assert.equal(getLayoutViewerOrigin(iframe, configuredOrigin), restoredOrigin);
assert.equal(getLayoutViewerOrigin({ src: '' }, configuredOrigin), configuredOrigin);
assert.equal(getLayoutViewerOrigin({ src: 'not a URL' }, configuredOrigin), configuredOrigin);

assert.equal(
  isTrustedLayoutViewerMessage(
    { origin: restoredOrigin, source: viewerWindow },
    iframe,
    configuredOrigin,
  ),
  true,
  'accepts a message from the runtime iframe origin and Window',
);

assert.equal(
  isTrustedLayoutViewerMessage(
    { origin: configuredOrigin, source: viewerWindow },
    iframe,
    configuredOrigin,
  ),
  false,
  'rejects the configured origin when it is not the runtime iframe origin',
);

assert.equal(
  isTrustedLayoutViewerMessage(
    { origin: restoredOrigin, source: otherWindow },
    iframe,
    configuredOrigin,
  ),
  false,
  'rejects a same-origin message from a different Window',
);

assert.equal(
  isTrustedLayoutViewerMessage(
    { origin: restoredOrigin, source: viewerWindow },
    { src: iframe.src, contentWindow: null },
    configuredOrigin,
  ),
  false,
  'rejects messages while the iframe Window is unavailable',
);

console.log('layout viewer messaging tests passed');
