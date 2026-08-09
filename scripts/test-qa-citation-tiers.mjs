/**
 * Citation tiering is the confidentiality boundary of published-deck Q&A.
 *
 * Researcher returns the FULL, tier-blind citation set because the gates must
 * verify against all the evidence. This module decides what a viewer may be
 * NAMED. Getting it wrong leaks the existence and title of a publisher's private
 * documents to an external audience, so it is tested directly rather than left
 * to review.
 *
 * Run: node scripts/test-qa-citation-tiers.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const modulePath = new URL('../lib/publish/qa-citations.ts', import.meta.url);
const source = fs.readFileSync(modulePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});

const mod = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  require,
});
const { citationsForViewer, VIEWER_CORPUS_DESCRIPTION } = mod.exports;

const OPTS = { slug: 'ab12cd34ef', citeWebSources: true, ownerName: 'Priya' };
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------------------------------------------------------------------
// T1 — deck slides are always named, because the viewer can verify them
// ---------------------------------------------------------------------------

test('deck citations are named and deep-link to the slide', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [{ source_kind: 'deck', source_label: 'Slide 4 — Market', slide_number: 4, quote: 'SAM $2.4B' }],
    OPTS
  );
  assert.equal(citations.length, 1);
  assert.equal(citations[0].kind, 'slide');
  assert.equal(citations[0].label, 'Slide 4 — Market');
  // #/N is 0-based in the viewer iframe
  assert.equal(citations[0].href, '/p/ab12cd34ef#/3');
  assert.equal(provenanceLine, null, 'no private source was used');
});

// ---------------------------------------------------------------------------
// T3 — private sources are NEVER named. The core guarantee.
// ---------------------------------------------------------------------------

test('uploaded documents are never named to a viewer', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [{
      source_kind: 'document',
      source_label: 'Acme_pricing_v3.pdf',
      source_ref: 'doc_1',
      page_number: 7,
      quote: 'internal margin table',
    }],
    OPTS
  );
  assert.equal(citations.length, 0, 'a private document was named to a viewer');
  assert.equal(provenanceLine, "From Priya's background material.");
});

test('no fragment of a private source survives serialization', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [{
      source_kind: 'document',
      source_label: 'Acme_pricing_v3.pdf',
      source_ref: 'doc_1',
      page_number: 7,
      quote: 'confidential margin detail',
      source_url: 'https://internal.example/secret',
    }],
    OPTS
  );
  const blob = JSON.stringify({ citations, provenanceLine });
  for (const leak of ['Acme_pricing_v3', 'doc_1', 'confidential margin', 'internal.example', '7']) {
    assert.ok(!blob.includes(leak), `leaked "${leak}" in ${blob}`);
  }
});

test('internal research is never named', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [{ source_kind: 'research', source_label: 'Deep synthesis pass 2' }],
    OPTS
  );
  assert.equal(citations.length, 0);
  assert.ok(provenanceLine);
});

test('an UNRECOGNISED source kind defaults to private', () => {
  // A new source type must never leak merely by not being in a list.
  const { citations, provenanceLine } = citationsForViewer(
    [{ source_kind: 'knowledge_graph', source_label: 'entity:Acme' }],
    OPTS
  );
  assert.equal(citations.length, 0, 'unknown kind was named — it must default to private');
  assert.ok(provenanceLine);
});

test('a missing source kind defaults to private', () => {
  const { citations } = citationsForViewer([{ source_label: 'mystery' }], OPTS);
  assert.equal(citations.length, 0);
});

// ---------------------------------------------------------------------------
// T2 — public web, publisher's choice
// ---------------------------------------------------------------------------

test('public web sources are named when the publisher opted in', () => {
  const { citations } = citationsForViewer(
    [{ source_kind: 'web', source_label: 'Gartner 2026 forecast', source_url: 'https://example.com/x' }],
    OPTS
  );
  assert.equal(citations.length, 1);
  assert.equal(citations[0].kind, 'web');
  assert.equal(citations[0].href, 'https://example.com/x');
});

test('opting out of web citations hides them but still admits provenance', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [{ source_kind: 'web', source_label: 'Gartner', source_url: 'https://example.com/x' }],
    { ...OPTS, citeWebSources: false }
  );
  assert.equal(citations.length, 0);
  assert.ok(provenanceLine, 'it still grounded the answer, so it still earns a provenance line');
});

// ---------------------------------------------------------------------------
// Mixed — the realistic case
// ---------------------------------------------------------------------------

test('a mixed answer names only the deck and admits the rest without naming it', () => {
  const { citations, provenanceLine } = citationsForViewer(
    [
      { source_kind: 'deck', source_label: 'Slide 2 — Timeline', slide_number: 2 },
      { source_kind: 'document', source_label: 'Q3_delivery_plan.pdf', page_number: 3 },
    ],
    OPTS
  );
  assert.equal(citations.length, 1);
  assert.equal(citations[0].label, 'Slide 2 — Timeline');
  assert.equal(provenanceLine, "From Priya's background material.");
  assert.ok(!JSON.stringify(citations).includes('Q3_delivery_plan'));
});

test('empty and null citation sets are handled', () => {
  for (const input of [null, undefined, []]) {
    const { citations, provenanceLine } = citationsForViewer(input, OPTS);
    assert.equal(citations.length, 0);
    assert.equal(provenanceLine, null);
  }
});

test('the viewer-facing corpus description discloses no counts or kinds', () => {
  assert.ok(!/\d/.test(VIEWER_CORPUS_DESCRIPTION), 'a count is itself a leak');
  for (const word of ['document', 'upload', 'file', 'slides']) {
    assert.ok(
      !VIEWER_CORPUS_DESCRIPTION.toLowerCase().includes(word),
      `description names a source kind: "${word}"`
    );
  }
});

// ---------------------------------------------------------------------------

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
