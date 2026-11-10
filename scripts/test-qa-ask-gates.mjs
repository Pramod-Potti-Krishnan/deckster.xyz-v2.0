/**
 * Integration test for POST /api/publish/[slug]/ask.
 *
 * The other Q&A suites test pure functions. This one runs the REAL route
 * handler, with only the external boundaries faked (Prisma, Researcher, wallet,
 * quota, next/server, next/headers). The real limiter, the real citation
 * tiering and the real passcode check all execute.
 *
 * It exists for one property the unit tests cannot reach: **gate ORDER**.
 *
 * Steps 1-13 of the chain must cost nothing, and only step 14 may call a model.
 * That ordering IS the cost model — the difference between a public endpoint
 * that is cheap to refuse and one that an anonymous caller can bill the
 * publisher for at will. It is a property of the sequence, not of any function,
 * so nothing short of driving the handler can verify it.
 *
 * Every test that expects a refusal asserts `researcherCalls === 0`.
 *
 * Run: node scripts/test-qa-ask-gates.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

process.env.NEXTAUTH_SECRET = 'test-secret-for-ask-gates';
process.env.PUBLIC_QA_ENABLED = 'true';
process.env.RESEARCHER_SERVICE_URL = 'https://researcher-uat.example';
process.env.NEXT_PUBLIC_APP_URL = 'https://deckster-xyz-uat.vercel.app';

const nodeRequire = createRequire(import.meta.url);
const root = path.join(new URL('.', import.meta.url).pathname, '..');

// ---------------------------------------------------------------------------
// Module loader: real @/lib/publish/* modules, faked boundaries.
//
// Uses `new Function` rather than vm.runInNewContext so everything runs in THIS
// realm — cross-realm prototypes silently break instanceof and deepEqual.
// ---------------------------------------------------------------------------
const cache = new Map();

function loadReal(alias, shims) {
  if (cache.has(alias)) return cache.get(alias);
  const file = path.join(root, alias.replace(/^@\//, '') + '.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  cache.set(alias, mod.exports);
  const req = (id) => {
    if (id in shims) return shims[id];
    // Only `@/...` ids are project modules to transpile; everything else
    // (node:crypto, packages) is a real require.
    if (!id.startsWith('@/')) return nodeRequire(id);
    return cache.has(id) ? cache.get(id) : loadReal(id, shims);
  };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, req);
  cache.set(alias, mod.exports);
  return mod.exports;
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------
function makeResponse() {
  return {
    json(body, init = {}) {
      return {
        status: init.status ?? 200,
        headers: init.headers ?? {},
        body,
        cookies: { set() {} },
      };
    },
  };
}

const DECK = {
  id: 'deck-1',
  userId: 'user-1',
  title: 'Q3 Business Review',
  version: 3,
  visibility: 'unlisted',
  passcodeHash: null,
  revokedAt: null,
  qaEnabled: true,
  qaCorpusStatus: 'ready',
  qaCorpusVersion: 3,
  qaDailyCap: 50,
  qaMonthlyCap: 500,
  qaVisitorBurstLimit: 10,
  qaVisitorDailyLimit: 40,
  qaTonePreset: 'professional',
  qaToneInstruction: null,
  qaCiteWebSources: true,
  user: { name: 'Priya', tier: 'pro' },
};

const RESEARCHER_ANSWER = {
  outcome: 'answered',
  gate_reason: 'answered',
  answer: 'About nine months on monthly billing.',
  citations: [
    { source_kind: 'deck', source_label: 'Slide 4 — Unit economics', slide_number: 4 },
    { source_kind: 'document', source_label: 'Acme_internal.pdf', page_number: 7, quote: 'margin' },
  ],
  defer_message: null,
  confidence: 0.88,
  retrieval_top: 0.81,
  tokens_in: 3200,
  tokens_out: 80,
  model_used: 'gemini-2.5-flash',
};

/** Build a scenario and return { run, state }. */
function scenario(overrides = {}) {
  const state = {
    deck: { ...DECK, ...(overrides.deck ?? {}) },
    counts: {
      blocked: 0, ipInWindow: 0, ipToday: 0, deckToday: 0, deckThisMonth: 0,
      ...(overrides.counts ?? {}),
    },
    recentQuestions: overrides.recentQuestions ?? [],
    // Who is calling. null = anonymous visitor, which is the normal case for a
    // public endpoint and therefore the default.
    session: overrides.session ?? null,
    sessionThrows: overrides.sessionThrows ?? false,
    faqs: overrides.faqs ?? [],
    sources: overrides.sources ?? [],
    cookies: overrides.cookies ?? {},
    researcherCalls: 0,
    researcherArgs: null,
    researcherThrows: overrides.researcherThrows ?? false,
    researcherResult: overrides.researcherResult ?? RESEARCHER_ANSWER,
    created: [],
    walletCalls: [],
    quota: overrides.quota ?? {
      caps: { dailyCents: 1000, weeklyCents: 5000, monthlyCents: 20000 },
      spent: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
      walletBalanceCents: 5000,
    },
  };

  // Prisma counts arrive in a fixed order from one Promise.all — match it.
  let countCall = 0;
  const countOrder = ['blocked', 'ipInWindow', 'ipToday', 'deckToday', 'deckThisMonth'];

  const prisma = {
    publishedDeck: {
      findUnique: async () => (state.deck ? { ...state.deck } : null),
    },
    deckQuestion: {
      count: async () => state.counts[countOrder[countCall++]] ?? 0,
      findMany: async () => state.recentQuestions,
      create: async ({ data }) => {
        state.created.push(data);
        return { id: `q-${state.created.length}` };
      },
      update: async () => ({}),
    },
    deckFaqItem: { findMany: async () => state.faqs },
    publishedDeckSource: {
      findMany: async (args) => {
        const want = args?.where?.allowedForQa
        return want === undefined
          ? state.sources
          : state.sources.filter((row) => row.allowedForQa === want)
      },
    },
  };

  const shims = {
    'next/server': { NextResponse: makeResponse(), NextRequest: class {} },
    'next/headers': {
      cookies: async () => ({ get: (name) => (state.cookies[name] ? { value: state.cookies[name] } : undefined) }),
    },
    '@/lib/prisma': { prisma },
    'next-auth': {
      getServerSession: async () => {
        if (state.sessionThrows) throw new Error('auth backend down');
        return state.session;
      },
    },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/publish/qa': {
      isQaBackendConfigured: () => process.env.PUBLIC_QA_ENABLED === 'true',
      askResearcher: async (args) => {
        state.researcherCalls += 1;
        state.researcherArgs = args;
        if (state.researcherThrows) throw new Error('researcher down');
        return state.researcherResult;
      },
    },
    '@/lib/quota/quota': {
      getQuotaStatus: async () => state.quota,
      fitsWithinCaps: (caps, spent, cost) =>
        spent.dailyCents + cost <= caps.dailyCents &&
        spent.weeklyCents + cost <= caps.weeklyCents &&
        spent.monthlyCents + cost <= caps.monthlyCents,
    },
    '@/lib/pricing/tokens': { tokensToUsdCents: (t) => (t <= 0 ? 0 : Math.ceil((t / 1e6) * 10 * 100)) },
    '@/lib/wallet': {
      debitWallet: async (p) => { state.walletCalls.push({ kind: 'debit', ...p }); return {}; },
      recordPlanUsage: async (p) => { state.walletCalls.push({ kind: 'plan', ...p }); return {}; },
      InsufficientFundsError: class extends Error {},
    },
  };

  cache.clear();
  const route = loadReal('@/app/api/publish/[slug]/ask/route', shims);

  const run = async (body = { question: 'What is the payback period?' }) => {
    // The route logs its own failures. When the scenario MAKES it fail, that
    // logging is expected output, not a signal — silence it so a real error
    // still stands out.
    const original = console.error;
    if (state.researcherThrows) console.error = () => {};
    try {
      return await route.POST(
        { headers: new Headers({ 'x-forwarded-for': '203.0.113.7' }), json: async () => body },
        { params: Promise.resolve({ slug: 'ab12cd34ef' }) }
      );
    } finally {
      console.error = original;
    }
  };

  return { run, state };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------------------------------------------------------------------
// The cost model: every refusal must be free
// ---------------------------------------------------------------------------

test('the happy path calls Researcher exactly once and meters the real usage', async () => {
  const { run, state } = scenario();
  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'answered');
  assert.equal(state.researcherCalls, 1);
  // 3280 tokens -> 4c. Metered from the response, never estimated.
  assert.equal(state.walletCalls.length, 1);
  assert.equal(state.walletCalls[0].tokens, 3280);
  assert.equal(state.walletCalls[0].sourceRef, 'deck_qa:q-1');
});

test('a revoked deck 404s without touching Researcher', async () => {
  const { run, state } = scenario({ deck: { revokedAt: new Date() } });
  const res = await run();
  assert.equal(res.status, 404);
  assert.equal(state.researcherCalls, 0);
});

test('Q&A disabled on the deck 403s without touching Researcher', async () => {
  const { run, state } = scenario({ deck: { qaEnabled: false } });
  const res = await run();
  assert.equal(res.status, 403);
  assert.equal(state.researcherCalls, 0);
});

test('a restricted deck without the unlock cookie 401s without touching Researcher', async () => {
  const { run, state } = scenario({
    deck: { visibility: 'restricted', passcodeHash: 'scrypt:aa:bb' },
  });
  const res = await run();
  assert.equal(res.status, 401);
  assert.equal(state.researcherCalls, 0);
});

test('a malformed question 400s without touching Researcher', async () => {
  const { run, state } = scenario();
  const res = await run({ question: 'hi' });
  assert.equal(res.status, 400);
  assert.equal(state.researcherCalls, 0);
});

test('a rate-limited caller 429s without touching Researcher', async () => {
  const { run, state } = scenario({ counts: { ipInWindow: 10 } });
  const res = await run();
  assert.equal(res.status, 429);
  assert.ok(res.headers['Retry-After']);
  assert.equal(state.researcherCalls, 0);
});

test('a blocked asker 429s silently, and is not told they are blocked', async () => {
  const { run, state } = scenario({ counts: { blocked: 1 } });
  const res = await run();
  assert.equal(res.status, 429);
  assert.equal(state.researcherCalls, 0);
  assert.ok(!JSON.stringify(res.body).toLowerCase().includes('block'));
});

test("the deck's OWN visitor limit is what the route enforces", async () => {
  // Not the deployment constant. An owner who raised the limit for a live event
  // must actually get the higher number, and one who lowered it the lower.
  const busy = scenario({ deck: { qaVisitorBurstLimit: 40 }, counts: { ipInWindow: 25 } });
  assert.equal((await busy.run()).status, 200);
  assert.equal(busy.state.researcherCalls, 1);

  const strict = scenario({ deck: { qaVisitorBurstLimit: 5 }, counts: { ipInWindow: 5 } });
  assert.equal((await strict.run()).status, 429);
  assert.equal(strict.state.researcherCalls, 0);
});

test('the signed-in OWNER is not rate-limited on their own deck', async () => {
  // The owner testing their own feature is not an anonymous abuser. Before this,
  // a handful of test questions locked the publisher out of their own deck.
  const { run, state } = scenario({
    counts: { ipInWindow: 9999, ipToday: 9999 },
    session: { user: { id: 'user-1' } },
  });
  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(state.researcherCalls, 1);
});

test('a signed-in NON-owner gets no exemption', async () => {
  // The exemption is scoped to THIS deck's owner. Any signed-in account slipping
  // through would make the limiter bypassable by anyone who can register.
  const { run, state } = scenario({
    counts: { ipInWindow: 9999 },
    session: { user: { id: 'someone-else' } },
  });
  assert.equal((await run()).status, 429);
  assert.equal(state.researcherCalls, 0);
});

test('the owner exemption does not override the deck spend caps', async () => {
  // Those caps are the owner's own ceiling and the only thing bounding cost on
  // the account being billed.
  const { run, state } = scenario({
    counts: { deckToday: 50 },
    session: { user: { id: 'user-1' } },
  });
  assert.equal((await run()).status, 429);
  assert.equal(state.researcherCalls, 0);
  assert.equal(state.walletCalls.length, 0);
});

test('the owner exemption does not unblock a blocked asker', async () => {
  const { run, state } = scenario({
    counts: { blocked: 1 },
    session: { user: { id: 'user-1' } },
  });
  assert.equal((await run()).status, 429);
  assert.equal(state.researcherCalls, 0);
});

test('an auth failure degrades to anonymous rather than exempting the caller', async () => {
  // Fail strict: if we cannot establish who is calling, they are a visitor.
  const original = console.error;
  console.error = () => {};
  try {
    const { run, state } = scenario({ counts: { ipInWindow: 9999 }, sessionThrows: true });
    assert.equal((await run()).status, 429);
    assert.equal(state.researcherCalls, 0);
  } finally {
    console.error = original;
  }
});

test('a capped deck defers WITHOUT calling Researcher and without billing', async () => {
  // The money property: never pay for an answer we then refuse to give.
  const { run, state } = scenario({ counts: { deckToday: 50 } });
  const res = await run();
  assert.equal(res.status, 429);
  assert.equal(state.researcherCalls, 0);
  assert.equal(state.walletCalls.length, 0);
});

test('an owner with no plan room and an empty wallet defers before the model call', async () => {
  const { run, state } = scenario({
    quota: {
      caps: { dailyCents: 10, weeklyCents: 10, monthlyCents: 10 },
      spent: { dailyCents: 10, weeklyCents: 10, monthlyCents: 10 },
      walletBalanceCents: 0,
    },
  });
  const res = await run();
  assert.equal(res.body.status, 'deferred');
  assert.equal(res.body.deferReason, 'capped');
  assert.equal(state.researcherCalls, 0, 'billed nothing, but still called the model');
  assert.equal(state.walletCalls.length, 0);
});

test('an unbuilt corpus defers without calling Researcher', async () => {
  const { run, state } = scenario({ deck: { qaCorpusStatus: 'none' } });
  const res = await run();
  assert.equal(res.body.status, 'deferred');
  assert.equal(res.body.deferReason, 'not_ready');
  assert.equal(state.researcherCalls, 0);
});

// ---------------------------------------------------------------------------
// Free short-circuits still work when the deck is out of budget
// ---------------------------------------------------------------------------

test('an FAQ hit answers without Researcher, even on a deck with no budget', async () => {
  const { run, state } = scenario({
    quota: {
      caps: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
      spent: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
      walletBalanceCents: 0,
    },
    faqs: [{
      id: 'f1',
      question: 'What is the payback period?',
      answer: 'About nine months.',
      citations: [{ source_kind: 'deck', source_label: 'Slide 4', slide_number: 4 }],
      approvedByName: 'Priya',
    }],
  });
  const res = await run();
  assert.equal(res.body.status, 'answered');
  assert.equal(res.body.source, 'faq');
  assert.equal(res.body.approvedBy, 'Priya');
  assert.equal(state.researcherCalls, 0, 'a human-approved answer must never cost a model call');
});

test('a repeated question is served from cache without Researcher', async () => {
  const { run, state } = scenario({
    recentQuestions: [{
      id: 'q-old',
      question: 'What is the payback period?',
      aiAnswer: 'About nine months.',
      aiCitations: [{ source_kind: 'deck', source_label: 'Slide 4', slide_number: 4 }],
    }],
  });
  const res = await run();
  assert.equal(res.body.status, 'answered');
  assert.equal(res.body.source, 'cached');
  assert.equal(state.researcherCalls, 0);
});

// ---------------------------------------------------------------------------
// The confidentiality boundary, through the real route
// ---------------------------------------------------------------------------

test('a private source is never named in the response, but is admitted', async () => {
  const { run } = scenario();
  const res = await run();
  const blob = JSON.stringify(res.body);
  for (const leak of ['Acme_internal', 'margin', 'page_number']) {
    assert.ok(!blob.includes(leak), `response leaked "${leak}"`);
  }
  assert.equal(res.body.provenanceLine, "From Priya's background material.");
  assert.equal(res.body.citations.length, 1);
  assert.equal(res.body.citations[0].label, 'Slide 4 — Unit economics');
});

test('the FULL tier-blind citation set is persisted for the owner', async () => {
  const { run, state } = scenario();
  await run();
  const stored = JSON.stringify(state.created[0].aiCitations);
  assert.ok(stored.includes('Acme_internal'), 'the owner audit trail lost the real source');
});

test('operational fields never reach the asker', async () => {
  const { run } = scenario();
  const res = await run();
  const blob = JSON.stringify(res.body);
  for (const leak of ['0.88', '0.81', 'gemini-2.5-flash', '3200']) {
    assert.ok(!blob.includes(leak), `response leaked ${leak}`);
  }
});

// ---------------------------------------------------------------------------
// Deferral must always be answerable later
// ---------------------------------------------------------------------------

test('EVERY defer carries a follow-up token', async () => {
  // An anonymous asker has no other route back to the answer, so a defer
  // without a token is a question they can never read the reply to.
  const cases = [
    { deck: { qaCorpusStatus: 'none' } },
    { quota: { caps: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
               spent: { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 },
               walletBalanceCents: 0 } },
    { researcherThrows: true },
  ];
  for (const override of cases) {
    const { run } = scenario(override);
    const res = await run();
    assert.equal(res.body.status, 'deferred', JSON.stringify(res.body));
    assert.ok(res.body.followUp?.token, `no follow-up token: ${JSON.stringify(override)}`);
    assert.ok(res.body.followUp.url.startsWith('/p/ab12cd34ef/q/'));
  }
});

test('a Researcher outage degrades to a defer, not a 500', async () => {
  const { run, state } = scenario({ researcherThrows: true });
  const res = await run();
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'deferred');
  assert.equal(state.created.length, 1, 'the question was lost instead of recorded');
});

test('a Researcher defer is recorded and returned with its template copy', async () => {
  const { run, state } = scenario({
    researcherResult: {
      ...RESEARCHER_ANSWER, outcome: 'deferred', gate_reason: 'no_evidence',
      answer: null, defer_message: "I don't have that in this deck.", citations: [],
    },
  });
  const res = await run();
  assert.equal(res.body.status, 'deferred');
  assert.equal(res.body.message, "I don't have that in this deck.");
  assert.equal(state.created[0].status, 'deferred');
  // Metered anyway: a defer decided after the grounding call still cost one.
  assert.equal(state.walletCalls.length, 1);
});

// ---------------------------------------------------------------------------
// The allowlist crosses the boundary correctly
// ---------------------------------------------------------------------------

test('no recorded decisions means nothing is denied', async () => {
  const { run, state } = scenario();
  await run();
  assert.deepEqual(state.researcherArgs.excludedSourceRefs, []);
});

test('only DENIED sources are sent, never an allow-list', async () => {
  // The live regression: an allow-list built from stored rows treated every
  // source WITHOUT a row as denied. Toggling one entry in the sources panel
  // switched off all six slides, retrieval returned zero chunks, and the deck
  // answered no_evidence to questions its own slides covered.
  const { run, state } = scenario({
    sources: [
      { sourceRef: 'slide_1', allowedForQa: true },
      { sourceRef: 'doc_1', allowedForQa: false },
    ],
  });
  await run();
  assert.deepEqual(state.researcherArgs.excludedSourceRefs, ['doc_1']);
  assert.ok(
    !(state.researcherArgs.allowedSourceRefs || []).length,
    'an allow-list was sent — sources with no recorded decision would be denied'
  );
});

test('a source the owner explicitly allowed is NOT in the denial list', async () => {
  const { run, state } = scenario({
    sources: [{ sourceRef: 'slide_1', allowedForQa: true }],
  });
  await run();
  assert.deepEqual(state.researcherArgs.excludedSourceRefs, []);
});

test("the deck's tone settings are forwarded to Researcher", async () => {
  const { run, state } = scenario({
    deck: { qaTonePreset: 'friendly', qaToneInstruction: 'Be warm.' },
  });
  await run();
  assert.equal(state.researcherArgs.tonePreset, 'friendly');
  assert.equal(state.researcherArgs.toneInstruction, 'Be warm.');
  assert.equal(state.researcherArgs.ownerName, 'Priya');
});

// ---------------------------------------------------------------------------
// Concurrency — pins the ACCEPTED race so a future change to it is visible
// ---------------------------------------------------------------------------

test('concurrent asks can overshoot the cap, and the overshoot is bounded', async () => {
  // Counts are read outside a transaction, so simultaneous callers all see the
  // same sub-cap number. This asserts the CURRENT, documented behaviour: the
  // overshoot exists and is bounded by concurrency, not unbounded. If someone
  // later makes the cap exact, this test should fail and be deleted.
  const { run, state } = scenario({ counts: { deckToday: 49 } });
  const results = await Promise.all([run(), run(), run(), run()]);
  const answered = results.filter((r) => r.body.status === 'answered').length;
  assert.ok(answered > 1, 'the race is closed — update the docs and drop this test');
  assert.ok(answered <= 4, 'overshoot must stay bounded by request concurrency');
  assert.equal(state.researcherCalls, answered, 'billed a call that produced no answer');
});

// ---------------------------------------------------------------------------

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
