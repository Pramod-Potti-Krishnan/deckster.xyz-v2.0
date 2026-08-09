/**
 * The `/ask` route is the only unauthenticated endpoint in the product that
 * spends a signed-in user's money. These are the pure decisions that stand
 * between a public URL and a drained wallet, tested without a database.
 *
 * Run: node scripts/test-qa-limits.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

process.env.NEXTAUTH_SECRET = 'test-secret-for-qa-limits';

const require = createRequire(import.meta.url);
function load(relPath) {
  const source = fs.readFileSync(new URL(relPath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require, process, Buffer,
    decodeURIComponent, encodeURIComponent, JSON,
  });
  return mod.exports;
}

const mod = load('../lib/publish/qa-limits.ts');
const threads = load('../lib/publish/qa-threads.ts');

const {
  hashAskerIp, clientIpFrom, newFollowUpToken, hashFollowUpToken, followUpTokenMatches,
  normaliseQuestion, questionSimilarity, matchFaq, evaluateLimits, validateQuestion,
  startOfUtcDay, startOfUtcMonth,
  IP_BURST_LIMIT, IP_DAILY_LIMIT, FAQ_MATCH_THRESHOLD,
  clampVisitorBurst, clampVisitorDaily,
  VISITOR_BURST_MIN, VISITOR_BURST_MAX, VISITOR_DAILY_MIN, VISITOR_DAILY_MAX,
} = mod;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const CAPS = { deckDailyCap: 50, deckMonthlyCap: 500 };
const clean = { blocked: 0, ipInWindow: 0, ipToday: 0, deckToday: 0, deckThisMonth: 0, ...CAPS };

// ---------------------------------------------------------------------------
// Asker identity — pseudonymous, and not reversible
// ---------------------------------------------------------------------------

test('the IP hash is keyed, so it cannot be brute-forced back to an IP', () => {
  // An unkeyed sha256 of an IPv4 address is reversible by enumerating the whole
  // 2^32 space in seconds. Keying is what makes the stored value not personal data.
  const withSecret = hashAskerIp('203.0.113.7');
  process.env.NEXTAUTH_SECRET = 'a-different-secret';
  const withOther = hashAskerIp('203.0.113.7');
  process.env.NEXTAUTH_SECRET = 'test-secret-for-qa-limits';
  assert.notEqual(withSecret, withOther, 'hash does not depend on the secret — it is a bare digest');
  assert.equal(hashAskerIp('203.0.113.7'), withSecret, 'hashing must be stable');
  assert.notEqual(hashAskerIp('203.0.113.8'), withSecret);
});

test('the client IP is the first x-forwarded-for entry, not the last', () => {
  // The last entry is the proxy nearest us; trusting it would put every visitor
  // in one bucket and rate-limit the whole internet as a single caller.
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' });
  assert.equal(clientIpFrom(headers), '203.0.113.7');
});

test('a request with no forwarding headers falls back to a shared bucket', () => {
  assert.equal(clientIpFrom(new Headers()), 'unknown');
});

test('follow-up tokens round-trip and reject anything else', () => {
  const token = newFollowUpToken();
  assert.ok(token.length >= 42, 'token is too short to be unguessable');
  assert.ok(followUpTokenMatches(token, hashFollowUpToken(token)));
  assert.ok(!followUpTokenMatches(newFollowUpToken(), hashFollowUpToken(token)));
  assert.ok(!followUpTokenMatches(token, 'not-a-hash'));
  assert.ok(!followUpTokenMatches('', hashFollowUpToken(token)));
});

test('the raw token is never derivable from its stored hash', () => {
  const token = newFollowUpToken();
  assert.ok(!hashFollowUpToken(token).includes(token));
});

// ---------------------------------------------------------------------------
// FAQ matching — a human's byline may only be reused for the same question
// ---------------------------------------------------------------------------

const FAQS = [
  { id: 'f1', question: 'What is the pricing?', answer: 'Three tiers.', citations: null, approvedByName: 'Priya' },
  { id: 'f2', question: 'When does it ship?', answer: 'Q3.', citations: null, approvedByName: 'Priya' },
];

test('an identical question hits the FAQ', () => {
  assert.equal(matchFaq('What is the pricing?', FAQS)?.id, 'f1');
});

test('punctuation and case do not prevent a match', () => {
  assert.equal(matchFaq('what is the PRICING', FAQS)?.id, 'f1');
});

test('a different question sharing most words does NOT hit the FAQ', () => {
  // "What is the pricing" vs "What is the timeline" — 3 of 5 tokens shared.
  // Reusing f1's answer here would put the publisher's name on an answer to a
  // question nobody asked.
  assert.equal(matchFaq('What is the timeline?', FAQS), null);
});

test('a NEGATED question does not match its affirmative', () => {
  assert.equal(matchFaq('What is not the pricing?', FAQS), null);
});

test('an empty or whitespace question matches nothing', () => {
  assert.equal(matchFaq('   ', FAQS), null);
  assert.equal(matchFaq('?!.', FAQS), null);
});

test('similarity is bounded and symmetric', () => {
  assert.equal(questionSimilarity('what is the pricing', 'what is the pricing'), 1);
  assert.equal(questionSimilarity('a b c', 'x y z'), 0);
  assert.equal(
    questionSimilarity('what is the pricing', 'the pricing'),
    questionSimilarity('the pricing', 'what is the pricing')
  );
});

test('the FAQ threshold is high enough that only near-identical text reuses a byline', () => {
  assert.ok(FAQ_MATCH_THRESHOLD >= 0.9, 'threshold too loose for a human-approved answer');
});

test('normalisation collapses whitespace and strips punctuation', () => {
  assert.equal(normaliseQuestion('  What   is   the pricing?!  '), 'what is the pricing');
});

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

test('a clean caller is allowed', () => {
  assert.equal(evaluateLimits(clean).allowed, true);
});

test('a blocked asker is rejected before any other limit is consulted', () => {
  // Blocked wins even when every counter is clean, so an abuser cannot infer
  // anything from which rejection they receive.
  const verdict = evaluateLimits({ ...clean, blocked: 1 });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'blocked');
});

test('the per-IP burst limit trips at the documented count', () => {
  assert.equal(evaluateLimits({ ...clean, ipInWindow: IP_BURST_LIMIT - 1 }).allowed, true);
  const verdict = evaluateLimits({ ...clean, ipInWindow: IP_BURST_LIMIT });
  assert.equal(verdict.reason, 'rate_limited');
  assert.ok(verdict.retryAfterSeconds > 0, 'a rate limit must tell the caller when to retry');
});

test('the per-IP daily limit trips independently of the burst window', () => {
  assert.equal(evaluateLimits({ ...clean, ipToday: IP_DAILY_LIMIT }).reason, 'rate_limited');
});

test('one abuser cannot make a deck look capped to everyone else', () => {
  // Per-IP is checked BEFORE per-deck: the noisy caller gets 'rate_limited'
  // while the deck's own budget is still intact.
  const verdict = evaluateLimits({ ...clean, ipInWindow: 99, deckToday: 0 });
  assert.equal(verdict.reason, 'rate_limited');
});

test('the deck daily cap trips at the owner-configured value', () => {
  assert.equal(evaluateLimits({ ...clean, deckToday: 49 }).allowed, true);
  assert.equal(evaluateLimits({ ...clean, deckToday: 50 }).reason, 'capped');
});

test('the deck monthly cap trips even when the day is quiet', () => {
  assert.equal(evaluateLimits({ ...clean, deckToday: 1, deckThisMonth: 500 }).reason, 'capped');
});

test('a cap of zero blocks everything', () => {
  assert.equal(evaluateLimits({ ...clean, deckDailyCap: 0 }).reason, 'capped');
});

// ---------------------------------------------------------------------------
// Per-visitor limits: owner-adjustable, and the owner is exempt on own deck
// ---------------------------------------------------------------------------

test("a deck's own visitor limit overrides the deployment default", () => {
  // The point of the setting: a deck in front of a live audience raises it, a
  // quiet client deck lowers it, and neither has to match the global constant.
  assert.equal(evaluateLimits({ ...clean, ipInWindow: 30, visitorBurstLimit: 40 }).allowed, true);
  assert.equal(evaluateLimits({ ...clean, ipInWindow: 4, visitorBurstLimit: 5 }).allowed, true);
  assert.equal(evaluateLimits({ ...clean, ipInWindow: 5, visitorBurstLimit: 5 }).reason, 'rate_limited');
});

test("a deck's own daily visitor limit overrides the deployment default", () => {
  assert.equal(evaluateLimits({ ...clean, ipToday: 150, visitorDailyLimit: 200 }).allowed, true);
  assert.equal(evaluateLimits({ ...clean, ipToday: 20, visitorDailyLimit: 20 }).reason, 'rate_limited');
});

test('with no per-deck limits stored, the deployment defaults still apply', () => {
  // Rows created before the columns existed, and any caller that forgets to
  // pass them, must not silently become unlimited.
  assert.equal(evaluateLimits({ ...clean, ipInWindow: IP_BURST_LIMIT }).reason, 'rate_limited');
  assert.equal(evaluateLimits({ ...clean, ipToday: IP_DAILY_LIMIT }).reason, 'rate_limited');
});

test('the deck owner is exempt from the per-visitor limits on their own deck', () => {
  // This is why the exemption exists: the owner asking a handful of test
  // questions was being treated as an anonymous abuser and locked out of their
  // own feature. Ownership is established server-side against deck.userId.
  assert.equal(evaluateLimits({ ...clean, ipInWindow: 9999, isOwner: true }).allowed, true);
  assert.equal(evaluateLimits({ ...clean, ipToday: 9999, isOwner: true }).allowed, true);
});

test('the owner exemption does NOT extend to the deck spend caps', () => {
  // The caps are the owner's own spend ceiling, so bypassing them for the owner
  // would remove the only thing bounding cost on the account paying for it.
  assert.equal(evaluateLimits({ ...clean, deckToday: 50, isOwner: true }).reason, 'capped');
  assert.equal(
    evaluateLimits({ ...clean, deckToday: 1, deckThisMonth: 500, isOwner: true }).reason,
    'capped'
  );
});

test('the owner exemption does NOT unblock a blocked asker', () => {
  // Block is checked first and is unconditional; otherwise a blocked visitor who
  // happened to be signed in as the owner would walk straight through.
  assert.equal(evaluateLimits({ ...clean, blocked: 1, isOwner: true }).reason, 'blocked');
});

test('an owner-supplied limit is clamped, and never to zero', () => {
  // 0 would make a deck that accepts questions and refuses every one on arrival
  // — strictly worse than turning Q&A off, which is already a switch.
  assert.equal(clampVisitorBurst(0), VISITOR_BURST_MIN);
  assert.equal(clampVisitorBurst(-5), VISITOR_BURST_MIN);
  assert.equal(clampVisitorBurst(10_000), VISITOR_BURST_MAX);
  assert.equal(clampVisitorBurst(12.7), 12);
  assert.equal(clampVisitorDaily(0), VISITOR_DAILY_MIN);
  assert.equal(clampVisitorDaily(10_000), VISITOR_DAILY_MAX);
});

test('a clamped limit still throttles — there is no unlimited setting', () => {
  const burst = clampVisitorBurst(Number.MAX_SAFE_INTEGER);
  assert.equal(evaluateLimits({ ...clean, ipInWindow: burst, visitorBurstLimit: burst }).reason,
    'rate_limited');
});

test('the default per-visitor allowance is 10 in a 5-minute window', () => {
  // The number PK asked for. Asserted so a future edit to the constant is a
  // deliberate decision rather than a drive-by.
  assert.equal(IP_BURST_LIMIT, 10);
  assert.equal(mod.IP_BURST_WINDOW_MS, 5 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('question length bounds are enforced and the result is trimmed', () => {
  assert.equal(validateQuestion('  How big is the market?  '), 'How big is the market?');
  assert.equal(validateQuestion('hi'), null);
  assert.equal(validateQuestion('x'.repeat(501)), null);
  assert.equal(validateQuestion('x'.repeat(500)), 'x'.repeat(500));
});

test('whitespace-only and non-string questions are rejected', () => {
  for (const input of ['     ', '', null, undefined, 42, {}, ['a question']]) {
    assert.equal(validateQuestion(input), null, `accepted ${JSON.stringify(input)}`);
  }
});

// ---------------------------------------------------------------------------
// Window boundaries
// ---------------------------------------------------------------------------

test('day and month windows are UTC and start at the boundary', () => {
  const now = new Date('2026-08-09T13:45:12.000Z');
  assert.equal(startOfUtcDay(now).toISOString(), '2026-08-09T00:00:00.000Z');
  assert.equal(startOfUtcMonth(now).toISOString(), '2026-08-01T00:00:00.000Z');
});

test('the first instant of a UTC day is inside that day, not the previous one', () => {
  const midnight = new Date('2026-08-09T00:00:00.000Z');
  assert.equal(startOfUtcDay(midnight).getTime(), midnight.getTime());
});

// ---------------------------------------------------------------------------
// The asker's thread cookie — the only way an anonymous asker finds their answer
// ---------------------------------------------------------------------------

const { parseThreads, appendThread, serialiseThreads, MAX_TRACKED_THREADS } = threads;
const entry = (n) => ({ token: `tok${n}`, questionId: `q${n}`, askedAt: '2026-08-09T00:00:00.000Z' });

test('a malformed or tampered cookie degrades to an empty list, not a crash', () => {
  for (const raw of [null, undefined, '', 'not json', '{"not":"an array"}', '[1,2,3]', '%%%']) {
    assert.deepEqual(parseThreads(raw).length, 0, `threw or accepted garbage: ${raw}`);
  }
});

test('entries missing required fields are dropped rather than trusted', () => {
  const raw = serialiseThreads([entry(1), { token: 'x' }, { questionId: 'y', askedAt: 'z' }]);
  assert.equal(parseThreads(raw).length, 1);
});

test('a thread survives a serialise/parse round trip', () => {
  const parsed = parseThreads(serialiseThreads([entry(1), entry(2)]));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].token, 'tok2');
});

test('re-asking does not duplicate a thread already tracked', () => {
  const list = appendThread([entry(1)], entry(1));
  assert.equal(list.length, 1);
});

test('the thread list is capped, dropping the OLDEST first', () => {
  // An unbounded cookie eventually exceeds the header limit and makes every
  // request to the deck fail — so the cap is a correctness property, not tidiness.
  let list = [];
  for (let i = 0; i < MAX_TRACKED_THREADS + 5; i += 1) list = appendThread(list, entry(i));
  assert.equal(list.length, MAX_TRACKED_THREADS);
  assert.equal(list[list.length - 1].token, `tok${MAX_TRACKED_THREADS + 4}`, 'newest was lost');
  assert.ok(!list.some((row) => row.token === 'tok0'), 'oldest should have been evicted');
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
