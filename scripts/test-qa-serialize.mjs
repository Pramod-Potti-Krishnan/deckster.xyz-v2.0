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
const { citationsForViewer, redactCitationsForStorage } = citations;
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
  const poisoned = {
    ...FAQ,
    citations: [{ source_kind: 'document', source_label: 'Acme_internal_model.xlsx' }],
  };
  const blob = JSON.stringify(serializeFaqForViewer(poisoned, OPTS));
  assert.ok(!blob.includes('Acme_internal_model'), 'a stored private citation was served');
});

// ---------------------------------------------------------------------------
// The promote -> store -> serve round trip.
//
// This is the path the product actually takes, and it is where an earlier
// version broke: promote stored the VIEWER projection, the read path filtered
// again, and a PublicCitation has no `source_kind` — so every citation fell
// into T3. The result was FAQ entries with no citations at all, each carrying
// an invented "used private material" line. A false confidentiality signal is
// worse than none, because the audience has no way to know it is false.
//
// The earlier test passed because it fed the INTERNAL shape, exercising a path
// the real code never takes. These drive the real one.
// ---------------------------------------------------------------------------

const FROM_RESEARCHER = [
  { source_kind: 'deck', source_label: 'Slide 4 — Unit economics', slide_number: 4 },
  { source_kind: 'web', source_label: 'Gartner 2026', source_url: 'https://example.com/x' },
  { source_kind: 'document', source_label: 'Acme_internal.pdf', page_number: 7, quote: 'margin' },
];

const promoted = (opts = OPTS) => ({
  ...FAQ,
  citations: JSON.parse(JSON.stringify(redactCitationsForStorage(FROM_RESEARCHER))),
});

test('a promoted FAQ entry keeps its citations when served', () => {
  const served = serializeFaqForViewer(promoted(), OPTS);
  assert.equal(served.citations.length, 2, 'citations were wiped by the read filter');
  assert.equal(served.citations[0].label, 'Slide 4 — Unit economics');
  assert.equal(served.citations[0].href, '/p/ab12cd34ef#/3');
  assert.equal(served.citations[1].kind, 'web');
});

test('a promoted FAQ entry still admits that private material was used', () => {
  assert.equal(serializeFaqForViewer(promoted(), OPTS).provenanceLine,
    "From Priya's background material.");
});

test('an FAQ grounded only in slides gets NO provenance line', () => {
  // The regression that mattered most: inventing "used private material" on an
  // answer that used none tells the audience something untrue about the deck.
  const deckOnly = {
    ...FAQ,
    citations: JSON.parse(JSON.stringify(redactCitationsForStorage([FROM_RESEARCHER[0]]))),
  };
  const served = serializeFaqForViewer(deckOnly, OPTS);
  assert.equal(served.citations.length, 1);
  assert.equal(served.provenanceLine, null, 'fabricated a private-source claim');
});

test('nothing identifying a private source is ever written to the FAQ row', () => {
  const blob = JSON.stringify(redactCitationsForStorage(FROM_RESEARCHER));
  for (const leak of ['Acme_internal', 'margin', '7']) {
    assert.ok(!blob.includes(leak), `stored row leaked "${leak}": ${blob}`);
  }
});

test('re-filtering a stored FAQ row is idempotent', () => {
  // The read path runs on every request; running it twice must not degrade
  // what the first pass produced.
  const once = serializeFaqForViewer(promoted(), OPTS);
  const twice = serializeFaqForViewer(promoted(), OPTS);
  assert.deepEqual(JSON.stringify(once.citations), JSON.stringify(twice.citations));
  assert.equal(once.provenanceLine, twice.provenanceLine);
});

test('turning off web citations later hides them from an ALREADY promoted entry', () => {
  // Redaction keeps T2 whole precisely so this choice stays reversible.
  const served = serializeFaqForViewer(promoted(), { ...OPTS, citeWebSources: false });
  assert.equal(served.citations.length, 1);
  assert.equal(served.citations[0].kind, 'slide');
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
