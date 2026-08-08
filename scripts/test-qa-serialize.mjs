/**
 * A `DeckQuestion` row mixes what the owner may see with what the asker may
 * see. These tests pin the seam.
 *
 * The central one is `no operational field reaches the asker`: it asserts over
 * the SERIALIZED BLOB rather than field by field, so a column added to the
 * schema later fails the test instead of quietly shipping to a public endpoint.
 *
 * Run: node scripts/test-qa-serialize.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const here = new URL('.', import.meta.url).pathname;

/** Compile a TS module, resolving the one `@/lib/publish/*` import by hand. */
function load(relPath, aliases = {}) {
  const source = fs.readFileSync(path.join(here, relPath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const shimmedRequire = (id) => (id in aliases ? aliases[id] : require(id));
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require: shimmedRequire, JSON, Array, Object,
  });
  return mod.exports;
}

const citations = load('../lib/publish/qa-citations.ts');
const { serializeQuestionForOwner, serializeThreadForAsker, serializeFaqForViewer } = load(
  '../lib/publish/qa-serialize.ts',
  { '@/lib/publish/qa-citations': citations }
);

const OPTS = { slug: 'ab12cd34ef', citeWebSources: true, ownerName: 'Priya' };

/** A row with every operational field populated with a distinctive value. */
const ROW = {
  id: 'q1',
  question: 'What is the payback period?',
  status: 'answered',
  gateReason: 'answered',
  aiAnswer: 'About nine months.',
  aiCitations: [
    { source_kind: 'deck', source_label: 'Slide 4 — Unit economics', slide_number: 4 },
    { source_kind: 'document', source_label: 'Acme_internal_model.xlsx', page_number: 12 },
  ],
  confidence: 0.87,
  retrievalTop: 0.79,
  modelUsed: 'gemini-2.5-flash',
  tokensIn: 4210,
  tokensOut: 96,
  costCents: 7,
  askerEmail: 'asker@example.com',
  askerName: 'Sam',
  askerIpHash: 'deadbeefdeadbeef',
  ownerAnswer: null,
  ownerAnsweredAt: null,
  ownerReadAt: null,
  askerSeenAt: null,
  deckVersion: 3,
  createdAt: new Date('2026-08-09T10:00:00.000Z'),
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

test('no operational field reaches the asker', () => {
  // Asserted over the whole blob, not per field: a column added later must fail
  // here rather than ship silently to a public route.
  const blob = JSON.stringify(serializeThreadForAsker(ROW, OPTS));
  const mustNotLeak = {
    'model confidence': '0.87',
    'retrieval score': '0.79',
    'model name': 'gemini-2.5-flash',
    'input tokens': '4210',
    'output tokens': '96',
    'cost': 'costCents',
    "the asker's own email back": 'asker@example.com',
    'the rate-limiting IP hash': 'deadbeefdeadbeef',
    'which gate fired': 'gateReason',
    'the private document name': 'Acme_internal_model',
  };
  for (const [label, needle] of Object.entries(mustNotLeak)) {
    assert.ok(!blob.includes(needle), `asker view leaked ${label}: ${blob}`);
  }
});

test('the leak needles are real — the owner view does contain them', () => {
  // Guards the test above from passing vacuously. If a needle were misspelled
  // or a fixture field renamed, "absent from the asker view" would be true for
  // the wrong reason and the leak test would be worthless.
  const ownerBlob = JSON.stringify(serializeQuestionForOwner(ROW));
  for (const needle of ['0.87', '0.79', 'gemini-2.5-flash', '4210', '96',
                        'asker@example.com', 'gateReason', 'Acme_internal_model']) {
    assert.ok(ownerBlob.includes(needle), `needle "${needle}" is not findable anywhere`);
  }
});

test('the asker still gets the answer and the deck citation', () => {
  const thread = serializeThreadForAsker(ROW, OPTS);
  assert.equal(thread.answer, 'About nine months.');
  assert.equal(thread.citations.length, 1);
  assert.equal(thread.citations[0].label, 'Slide 4 — Unit economics');
  assert.equal(thread.provenanceLine, "From Priya's background material.");
});

test('the owner sees everything, including private source names', () => {
  const owner = serializeQuestionForOwner(ROW);
  assert.equal(owner.confidence, 0.87);
  assert.equal(owner.costCents, 7);
  assert.equal(owner.askerEmail, 'asker@example.com');
  assert.ok(JSON.stringify(owner.aiCitations).includes('Acme_internal_model'));
});

test("the owner view still withholds the asker's IP hash", () => {
  // It is a rate-limiting key, not information. Surfacing it invites treating
  // it as an identity.
  assert.ok(!JSON.stringify(serializeQuestionForOwner(ROW)).includes('deadbeefdeadbeef'));
});

// ---------------------------------------------------------------------------
// Attribution — only a human answer carries a name
// ---------------------------------------------------------------------------

test('a machine answer is never bylined', () => {
  assert.equal(serializeThreadForAsker(ROW, OPTS).answeredBy, null);
});

test("an owner's answer supersedes the machine's and carries their name", () => {
  const thread = serializeThreadForAsker(
    { ...ROW, ownerAnswer: 'Nine months, and faster on annual plans.',
      ownerAnsweredAt: new Date('2026-08-09T12:00:00.000Z'), status: 'owner_answered' },
    OPTS
  );
  assert.equal(thread.answer, 'Nine months, and faster on annual plans.');
  assert.equal(thread.answeredBy, 'Priya');
  assert.ok(!thread.answer.includes('About nine months'), 'superseded machine answer still shown');
});

test("an owner's own words carry no machine citations", () => {
  // The evidence belongs to the machine's answer, not the human's. Attaching it
  // would misattribute where the human's claim came from.
  const thread = serializeThreadForAsker({ ...ROW, ownerAnswer: 'Nine months.' }, OPTS);
  assert.equal(thread.citations.length, 0);
  assert.equal(thread.provenanceLine, null);
});

// ---------------------------------------------------------------------------
// Blocking is invisible
// ---------------------------------------------------------------------------

test('a blocked asker sees an ordinary defer, never that they were blocked', () => {
  const thread = serializeThreadForAsker({ ...ROW, status: 'blocked', aiAnswer: null }, OPTS);
  assert.equal(thread.status, 'deferred');
  assert.ok(!JSON.stringify(thread).includes('blocked'), 'told the asker they were blocked');
});

test('a deferred thread reports that it is waiting on the owner', () => {
  const thread = serializeThreadForAsker({ ...ROW, status: 'deferred', aiAnswer: null }, OPTS);
  assert.equal(thread.awaitingOwner, true);
  assert.equal(thread.answer, null);
});

test('an answered thread is not waiting on anyone', () => {
  assert.equal(serializeThreadForAsker(ROW, OPTS).awaitingOwner, false);
});

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ = {
  id: 'f1',
  question: 'What is the payback period?',
  answer: 'About nine months.',
  citations: [{ kind: 'slide', label: 'Slide 4 — Unit economics', slideNumber: 4 }],
  sortOrder: 0,
  published: true,
  approvedByName: 'Priya',
  approvedAt: new Date('2026-08-09T12:00:00.000Z'),
  sourceQuestionId: 'q1',
};

test('an FAQ entry is bylined, because a human approved it', () => {
  assert.equal(serializeFaqForViewer(FAQ, OPTS).approvedBy, 'Priya');
});

test('FAQ citations are re-filtered on read, not trusted from storage', () => {
  // Stored citations are already viewer-tier, but a bad write (or an older row
  // written before the filter existed) must not become a public leak.
  const poisoned = {
    ...FAQ,
    citations: [{ source_kind: 'document', source_label: 'Acme_internal_model.xlsx' }],
  };
  const blob = JSON.stringify(serializeFaqForViewer(poisoned, OPTS));
  assert.ok(!blob.includes('Acme_internal_model'), 'a stored private citation was served');
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
