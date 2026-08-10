/**
 * The narration voice registry.
 *
 * This file is a price list and a latency budget wearing a TypeScript hat. A
 * wrong number here does not throw — it shows a publisher the wrong cost before
 * they commit, or offers a nine-second voice for answering questions out loud.
 * So the tests are mostly invariants over the DATA, not the functions.
 *
 * Run: node scripts/test-narration-voices.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();

/**
 * Load a TypeScript module for testing.
 *
 * Relative ids are resolved against the MODULE being loaded, not against this
 * test file — otherwise `lib/narration/draft.ts` importing `./budget` looks for
 * `scripts/budget`. Cached, so a diamond import is one module instance and
 * `instanceof` keeps working across it.
 */
function load(relPath, baseUrl = import.meta.url) {
  const url = new URL(relPath.endsWith('.ts') ? relPath : `${relPath}.ts`, baseUrl);
  if (cache.has(url.href)) return cache.get(url.href);

  const source = fs.readFileSync(url, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  cache.set(url.href, mod.exports);
  const localRequire = (id) =>
    id.startsWith('.') ? load(id, url) : require(id);
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require: localRequire,
    process, Buffer, JSON, Math, fetch, console,
  });
  cache.set(url.href, mod.exports);
  return mod.exports;
}

const {
  NARRATION_VOICES, DEFAULT_VOICE_ID, LIVE_ANSWER_MAX_FIRST_AUDIO_SECONDS,
  getVoice, isKnownVoiceId, canSpeakLiveAnswers, estimateCostCents,
  totalRenderMinutes, COMPRESSED_VARIANT_RATIO,
} = load('../lib/narration/voices.ts');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------------------------------------------------------------------
// Registry invariants
// ---------------------------------------------------------------------------

test('every voice is completely specified', () => {
  // A half-filled row renders silence or bills wrongly, and neither fails loudly.
  for (const v of NARRATION_VOICES) {
    assert.ok(v.id && v.name && v.description, `${v.id}: missing identity`);
    assert.ok(v.model.includes('/'), `${v.id}: model is not an OpenRouter id`);
    assert.ok(v.providerVoice, `${v.id}: no provider voice`);
    assert.ok(['mp3', 'pcm'].includes(v.responseFormat), `${v.id}: bad format`);
    assert.ok(v.costPerMinuteUsd >= 0, `${v.id}: negative cost`);
    assert.ok(v.firstAudioSeconds > 0, `${v.id}: no measured latency`);
  }
});

test('voice ids are unique and stable-looking', () => {
  const ids = NARRATION_VOICES.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate voice id');
  for (const id of ids) {
    // Our id, not the vendor's. A vendor string in here means a deck's choice
    // dies the day we swap providers.
    assert.ok(!id.includes('/'), `${id} looks like a vendor model id`);
  }
});

test('the default voice exists and is fast enough to answer live', () => {
  const def = NARRATION_VOICES.find((v) => v.id === DEFAULT_VOICE_ID);
  assert.ok(def, 'DEFAULT_VOICE_ID names a voice that does not exist');
  // A publisher who never opens the picker still gets Q&A that can speak.
  assert.ok(canSpeakLiveAnswers(def), 'the default voice cannot answer live');
});

test('at least one voice can answer live, and at least one cannot', () => {
  // If every voice were fast the flag would be dead code; if none were, the
  // spoken-answer half of rung 3 could never ship.
  const fast = NARRATION_VOICES.filter(canSpeakLiveAnswers);
  assert.ok(fast.length > 0, 'no voice can answer live');
  assert.ok(fast.length < NARRATION_VOICES.length, 'the live-answer flag never fires');
});

test('live-answer capability is derived from the measurement, not hand-set', () => {
  for (const v of NARRATION_VOICES) {
    assert.equal(
      canSpeakLiveAnswers(v),
      v.firstAudioSeconds <= LIVE_ANSWER_MAX_FIRST_AUDIO_SECONDS,
      `${v.id}: flag disagrees with its own measured latency`
    );
  }
});

test('the measured slow voices are excluded from live answers', () => {
  // The specific finding this whole flag exists for: Gemini takes 7.6-17.7s and
  // Kokoro 4.7s to start speaking. Stacked on the ~4-5s the gate chain already
  // costs, that is a viewer sitting in silence long enough to think it broke.
  for (const id of ['zephyr', 'puck', 'charon', 'kore', 'aoede', 'heart']) {
    const v = getVoice(id);
    assert.equal(canSpeakLiveAnswers(v), false, `${id} should be narration-only`);
  }
  for (const id of ['alloy', 'ava', 'andrew']) {
    assert.equal(canSpeakLiveAnswers(getVoice(id)), true, `${id} should answer live`);
  }
});

test('Gemini is the only voice flagged as PCM, and it is flagged', () => {
  // It refuses mp3 outright. Nothing on its model page says so — it surfaces as
  // a 400 — and the render path transcodes based on this field alone.
  for (const v of NARRATION_VOICES) {
    const isGemini = v.model.includes('gemini');
    assert.equal(v.responseFormat === 'pcm', isGemini, `${v.id}: wrong response format`);
  }
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

test('an unknown or missing id falls back to the default rather than throwing', () => {
  for (const bad of [null, undefined, '', 'retired-voice', 'fish-audio/s2.1-pro']) {
    assert.equal(getVoice(bad).id, DEFAULT_VOICE_ID, `${bad} did not fall back`);
  }
});

test('isKnownVoiceId rejects everything that is not a shipped id', () => {
  assert.ok(isKnownVoiceId('alloy'));
  for (const bad of [null, undefined, 42, {}, ['alloy'], 'ALLOY', 'fish-audio/s2.1-pro']) {
    assert.ok(!isKnownVoiceId(bad), `accepted ${JSON.stringify(bad)}`);
  }
});

// ---------------------------------------------------------------------------
// Cost — the number a publisher sees before they commit
// ---------------------------------------------------------------------------

test('render minutes cover all three variants, not just the runtime', () => {
  // full + compressed + closing. Quoting only the runtime would understate the
  // bill by more than half.
  const m = totalRenderMinutes(10);
  assert.ok(m > 10 * (1 + COMPRESSED_VARIANT_RATIO), 'closing segment not counted');
  assert.ok(Math.abs(m - 16.17) < 0.1, `expected ~16.2 minutes, got ${m}`);
});

test('a zero or nonsense runtime costs nothing rather than NaN', () => {
  for (const bad of [0, -5, NaN, undefined]) {
    assert.equal(totalRenderMinutes(bad), 0, `totalRenderMinutes(${bad})`);
    assert.equal(estimateCostCents(getVoice('alloy'), bad), 0, `estimateCostCents(${bad})`);
  }
});

test('the estimate always rounds UP, so the quote is never under the charge', () => {
  const alloy = getVoice('alloy');
  // 16.17 min x $0.0156 = $0.2523 -> 26 cents, not 25.
  const cents = estimateCostCents(alloy, totalRenderMinutes(10));
  assert.equal(cents, 26);
  // Any positive amount of audio costs at least a cent, never zero.
  assert.ok(estimateCostCents(alloy, 0.01) >= 1);
});

test('the cheapest and dearest voices differ enough to be worth showing', () => {
  // This spread is the entire reason cost is on the card. If it ever collapses,
  // the UI is carrying weight it no longer needs.
  const costs = NARRATION_VOICES.map((v) => v.costPerMinuteUsd).filter((c) => c > 0);
  assert.ok(Math.max(...costs) / Math.min(...costs) > 10, 'cost spread no longer material');
});

test('a 10-minute deck costs cents, not dollars, on every voice', () => {
  // A sanity fence on the whole price list: if a unit slips (per-1k vs per-1M)
  // this catches it before a publisher is quoted 1000x.
  for (const v of NARRATION_VOICES) {
    const cents = estimateCostCents(v, totalRenderMinutes(10));
    assert.ok(cents <= 200, `${v.id}: $${(cents / 100).toFixed(2)} for a 10-min deck is implausible`);
  }
});

// ---------------------------------------------------------------------------
// PCM framing — Gemini's audio is unplayable without it
// ---------------------------------------------------------------------------

const { pcmToWav } = load('../lib/narration/wav.ts');

test('the WAV header is well formed and declares the payload size', () => {
  const pcm = Buffer.alloc(4800); // 0.1s at 24 kHz 16-bit mono
  const wav = pcmToWav(pcm);
  assert.equal(wav.byteLength, pcm.byteLength + 44);
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.subarray(36, 40).toString(), 'data');
  assert.equal(wav.readUInt32LE(4), 36 + pcm.byteLength, 'RIFF size wrong');
  assert.equal(wav.readUInt32LE(40), pcm.byteLength, 'data size wrong');
  assert.equal(wav.readUInt16LE(22), 1, 'not mono');
  assert.equal(wav.readUInt32LE(24), 24000, 'wrong sample rate');
  assert.equal(wav.readUInt16LE(34), 16, 'wrong bit depth');
});

test('empty PCM still produces a valid (silent) container, not a crash', () => {
  const wav = pcmToWav(Buffer.alloc(0));
  assert.equal(wav.byteLength, 44);
  assert.equal(wav.readUInt32LE(40), 0);
});

// ---------------------------------------------------------------------------
// Content addressing — what stops us paying to render the same clip twice
// ---------------------------------------------------------------------------

const { contentKey, voiceSamplePath, MEDIA_BUCKET } = load('../lib/narration/media-store.ts');

const SAMPLE = 'Battery pack prices fell more than twenty-five percent last year.';

test('the same text, model and voice always key to the same object', () => {
  const a = contentKey({ text: SAMPLE, model: 'fish-audio/s2.1-pro', providerVoice: 'alloy' });
  const b = contentKey({ text: SAMPLE, model: 'fish-audio/s2.1-pro', providerVoice: 'alloy' });
  assert.equal(a, b, 'keys are not stable — every request would re-render');
  assert.ok(a.length >= 12, 'key is too short to be collision-safe');
});

test('changing ANY input that changes the audio changes the key', () => {
  const base = { text: SAMPLE, model: 'fish-audio/s2.1-pro', providerVoice: 'alloy' };
  const key = contentKey(base);
  // Re-wording the sample script.
  assert.notEqual(contentKey({ ...base, text: SAMPLE + ' And one more thing.' }), key);
  // Repointing a voice at a different model — the case that would otherwise
  // serve the OLD vendor's audio under the new voice for a year.
  assert.notEqual(contentKey({ ...base, model: 'microsoft/mai-voice-2-flash' }), key);
  // A different voice on the same model.
  assert.notEqual(contentKey({ ...base, providerVoice: 'echo' }), key);
});

test('every shipped voice keys to a distinct object', () => {
  const keys = NARRATION_VOICES.map((v) =>
    voiceSamplePath(v.id, contentKey({ text: SAMPLE, model: v.model, providerVoice: v.providerVoice }),
      v.responseFormat === 'pcm' ? 'wav' : 'mp3')
  );
  assert.equal(new Set(keys).size, keys.length, 'two voices would share a stored clip');
});

test('the stored path carries the voice, the key and a playable extension', () => {
  const gemini = getVoice('puck');
  const path = voiceSamplePath(gemini.id, 'abc123', 'wav');
  assert.ok(path.startsWith('voice-samples/'), 'samples must be namespaced in the bucket');
  assert.ok(path.includes('puck'));
  assert.ok(path.endsWith('.wav'), 'Gemini is PCM and must be stored as WAV a browser can play');
  assert.equal(MEDIA_BUCKET, 'deck-media');
});

test('mp3 voices are stored as mp3 and Gemini as wav', () => {
  for (const v of NARRATION_VOICES) {
    const ext = v.responseFormat === 'pcm' ? 'wav' : 'mp3';
    assert.ok(voiceSamplePath(v.id, 'k', ext).endsWith(ext));
  }
});

// ---------------------------------------------------------------------------
// Table names — the Prisma MODEL name is not the TABLE name
// ---------------------------------------------------------------------------

const voiceStoreSource = fs.readFileSync(
  new URL('../lib/narration/voice-store.ts', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(
  new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/sql/20260810_narration_voice.sql', import.meta.url), 'utf8');

test('raw SQL uses the mapped table name, not the Prisma model name', () => {
  // The bug this exists for: the model is `ChatSession`, so `chat_sessions` reads
  // as the obvious table — but every frontend table carries an `fe_` prefix and
  // the real name is `fe_chat_sessions`. Postgres raised 42P01 and the picker
  // silently showed an empty voice list. Raw SQL gets no compile-time check, so
  // this is the check.
  const mapped = schemaSource.match(/model ChatSession[\s\S]*?@@map\("([^"]+)"\)/);
  assert.ok(mapped, 'could not find ChatSession @@map in schema.prisma');
  const table = mapped[1];
  assert.equal(table, 'fe_chat_sessions');

  for (const source of [voiceStoreSource, migrationSource]) {
    assert.ok(source.includes(table), `does not reference the mapped table ${table}`);
    // The unprefixed name must not appear as a standalone table reference.
    assert.ok(
      !/\b(FROM|UPDATE|ALTER TABLE|INTO)\s+chat_sessions\b/i.test(source),
      'references the unmapped table name `chat_sessions`'
    );
  }
});

test('the schema-not-ready guard covers a missing TABLE as well as a missing COLUMN', () => {
  // Guarding only 42703 was the second half of the same bug: the code degraded
  // gracefully for a column that had not been added yet, but threw for a table
  // that did not exist — which is the very failure a wrong name produces.
  assert.ok(voiceStoreSource.includes('42703'), 'undefined_column not handled');
  assert.ok(voiceStoreSource.includes('42P01'), 'undefined_table not handled');
});

// ---------------------------------------------------------------------------
// The time budget — how long the deck is allowed to speak for
// ---------------------------------------------------------------------------

const {
  resolveBudget, suggestedReserveMinutes, wordBudget,
  DEFAULT_QA_RESERVE_RATIO, MIN_NARRATION_MINUTES,
} = load('../lib/narration/budget.ts');

test("the default reserve is a fifth of the slot, PK's rule", () => {
  assert.equal(DEFAULT_QA_RESERVE_RATIO, 0.2);
  assert.equal(suggestedReserveMinutes(20), 4);
  assert.equal(suggestedReserveMinutes(30), 6);
  // Rounded, not floored: 15 minutes suggests 3, not 2.
  assert.equal(suggestedReserveMinutes(15), 3);
});

test('a 20-minute slot resolves to 16 talking and 4 for questions', () => {
  const b = resolveBudget(20, null);
  assert.equal(b.totalMinutes, 20);
  assert.equal(b.qaReserveMinutes, 4);
  assert.equal(b.narrationMinutes, 16);
  assert.equal(b.reserveIsDefault, true);
});

test("a publisher's own reserve is honoured and marked as chosen", () => {
  const b = resolveBudget(20, 8);
  assert.equal(b.qaReserveMinutes, 8);
  assert.equal(b.narrationMinutes, 12);
  // The distinction drives the UI: a suggestion is offered, a choice is shown.
  assert.equal(b.reserveIsDefault, false);
});

test('a reserve of zero is a real choice, not an absent one', () => {
  // 0 and null must not collapse: "no time for questions" is a decision,
  // "I did not say" is not.
  const b = resolveBudget(20, 0);
  assert.equal(b.qaReserveMinutes, 0);
  assert.equal(b.narrationMinutes, 20);
  assert.equal(b.reserveIsDefault, false);
});

test('a reserve larger than the slot still leaves the deck something to say', () => {
  // Clamped rather than rejected: the publisher can see the number and fix it,
  // and a deck that never speaks is not a deck.
  const b = resolveBudget(10, 99);
  assert.equal(b.narrationMinutes, MIN_NARRATION_MINUTES);
  assert.ok(b.qaReserveMinutes < 10);
});

test('no slot set means no budget, not a zero-minute deck', () => {
  // Null is how a publisher says "let it run to its natural length". Treating
  // that as 0 would fit every script into nothing.
  for (const bad of [null, undefined, 0, -5]) {
    assert.equal(resolveBudget(bad, null), null, `resolveBudget(${bad})`);
  }
});

test('the compressed variant is about half the full script', () => {
  const b = resolveBudget(20, 4);
  assert.ok(b.compressedMinutes < b.narrationMinutes);
  const ratio = b.compressedMinutes / b.narrationMinutes;
  assert.ok(ratio > 0.4 && ratio < 0.7, `compressed ratio ${ratio} is not roughly half`);
});

test('the word budget is deliberately slower than conversational speech', () => {
  // Presentation narration carries figures and proper nouns, which read slower
  // than prose — and overrunning a slot is worse than finishing early.
  assert.equal(wordBudget(10), 1400);
  assert.equal(wordBudget(0), 0);
  assert.equal(wordBudget(-1), 0);
});

// ---------------------------------------------------------------------------
// Dividing the speaking time between slides
// ---------------------------------------------------------------------------

const { allocate, allocatedSeconds, FALLBACK_SLIDE_SECONDS, MIN_SLIDE_SECONDS } =
  load('../lib/narration/allocate.ts');

const slidesWith = (...seconds) =>
  seconds.map((d, i) => ({ slideId: `s${i}`, durationSeconds: d }));

test('time is divided in PROPORTION to what each slide has to say', () => {
  // The whole reason duration_seconds_estimate was re-threaded. An equal split
  // would drag the title slide and race the dense one.
  const a = allocate(slidesWith(20, 60, 20), 10, 0.55);
  assert.ok(a[1].seconds > a[0].seconds * 2, 'the dense slide did not get more time');
  assert.equal(a[0].seconds, a[2].seconds, 'equal estimates should get equal time');
});

test('the deck is scaled UP to fill the slot, not stopped at its estimates', () => {
  // Estimates express the deck's SHAPE, not its absolute length. A 6-slide deck
  // estimated at 5 minutes, given 15, should speak for 15.
  const a = allocate(slidesWith(30, 30, 30), 15, 0.55);
  assert.ok(Math.abs(allocatedSeconds(a) - 15 * 60) < 5, 'did not fill the slot');
});

test('a slide with no estimate is weighted, not dropped', () => {
  const a = allocate(slidesWith(60, null, undefined, 60), 10, 0.55);
  assert.equal(a.length, 4);
  assert.ok(a[1].seconds > 0 && a[2].seconds > 0);
  assert.equal(a[1].estimated, true, 'should be flagged as a fallback weight');
  assert.equal(a[0].estimated, false);
});

test('no slide is left with too little time to say anything', () => {
  // A slide that flashes past unnarrated reads as a bug, so the floor wins even
  // when it pushes the deck over budget — the right direction to be wrong in.
  const a = allocate(slidesWith(...Array(40).fill(30)), 1, 0.55);
  for (const slot of a) assert.ok(slot.seconds >= MIN_SLIDE_SECONDS, 'below the floor');
  assert.ok(allocatedSeconds(a) > 60, 'the floor should be allowed to overrun');
});

test('the compressed budget is smaller than the full one on every slide', () => {
  for (const slot of allocate(slidesWith(45, 90, 15), 12, 0.55)) {
    assert.ok(slot.compressedWords < slot.words, `slide ${slot.index} compressed is not shorter`);
    assert.ok(slot.compressedWords > 0);
  }
});

test('an empty deck or a missing budget allocates nothing rather than dividing by zero', () => {
  // Length rather than deepEqual: the array is constructed inside the VM realm,
  // so it is structurally empty but not reference-equal to an [] out here.
  assert.equal(allocate([], 10, 0.55).length, 0);
  assert.equal(allocate(slidesWith(30), 0, 0.55).length, 0);
  assert.equal(allocate(slidesWith(30), -5, 0.55).length, 0);
});

// ---------------------------------------------------------------------------
// The numeric guard — the one failure that would embarrass a publisher
// ---------------------------------------------------------------------------

const { numbersAreGrounded } = load('../lib/narration/draft.ts');

test('a figure the slide never mentioned is caught', () => {
  const r = numbersAreGrounded('Revenue reached $9.9B this year.', 'Revenue reached $2.4B this year.');
  assert.equal(r.ok, false);
  assert.ok(r.missing.some((n) => n.includes('9.9')));
});

test('figures that ARE on the slide pass, regardless of formatting', () => {
  // "$2.4B" in the source has to cover "2.4" in the script, and "1,200" has to
  // cover "1200" — a guard that failed on formatting would be switched off.
  assert.equal(numbersAreGrounded('It reached 2.4 billion.', 'SAM $2.4B by 2027').ok, true);
  assert.equal(numbersAreGrounded('About 1200 units.', 'Shipped 1,200 units').ok, true);
});

test('small integers in ordinary prose are not treated as claims', () => {
  // "three things", "step 2" — failing these would make the guard useless.
  assert.equal(numbersAreGrounded('I want to cover 3 things today.', 'Agenda').ok, true);
});

test('a script with no numbers at all is grounded', () => {
  assert.equal(numbersAreGrounded('This is the strategic context.', 'Context').ok, true);
});

// ---------------------------------------------------------------------------
// Content addressing for rendered segments — the cache that stops double-paying
// ---------------------------------------------------------------------------

// Loaded via a stub for @/lib/prisma: the hashing is pure, and pulling in a real
// client would make these tests need a database to assert arithmetic.
const segments = (() => {
  const src = fs.readFileSync(new URL('../lib/narration/segments.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const req = (id) => {
    if (id === '@/lib/prisma') return { prisma: {} };
    if (id === './voices') return load('../lib/narration/voices.ts');
    return require(id);
  };
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require: req, process, Buffer, JSON, Math, console,
  });
  return mod.exports;
})();

const { scriptHash, renderSpecHash, segmentPath, RENDER_ENGINE_VERSION } = segments;

test('the same words always hash the same, so nothing re-renders for free', () => {
  const a = scriptHash('Prices fell twenty-five percent last year.');
  assert.equal(a, scriptHash('Prices fell twenty-five percent last year.'));
  assert.ok(a.length >= 16);
});

test('cosmetic edits do NOT force a paid re-render', () => {
  // Re-wrapping a paragraph in the Script tab must cost nothing; changing a
  // word must cost one segment. That asymmetry is the whole design.
  const base = scriptHash('Prices fell. Margins held.');
  assert.equal(scriptHash('  Prices fell.   Margins held.  '), base);
  assert.equal(scriptHash('Prices fell.\nMargins held.'), base);
  assert.notEqual(scriptHash('Prices rose. Margins held.'), base);
});

test('case is NOT normalised, because a voice reads it differently', () => {
  assert.notEqual(scriptHash('it grew'), scriptHash('IT grew'));
});

test('the render spec pins the MODEL and the provider voice, not just our id', () => {
  // The failure this prevents: a voice repointed at a cheaper vendor would
  // otherwise keep every segment rendered by the old one, and the deck would
  // change voice partway through.
  const alloy = getVoice('alloy');
  const base = renderSpecHash(alloy);
  assert.notEqual(renderSpecHash({ ...alloy, model: 'someone-else/tts' }), base);
  assert.notEqual(renderSpecHash({ ...alloy, providerVoice: 'different' }), base);
  assert.notEqual(renderSpecHash({ ...alloy, responseFormat: 'pcm' }), base);
});

test('every shipped voice has a distinct render spec', () => {
  const specs = NARRATION_VOICES.map(renderSpecHash);
  assert.equal(new Set(specs).size, specs.length, 'two voices would share cached audio');
});

test('bumping the engine version invalidates every cached segment', () => {
  // Deliberate: it is part of the spec hash so a pipeline change that alters the
  // bytes cannot serve pre-change audio.
  assert.ok(RENDER_ENGINE_VERSION.length > 0);
  const withVersion = renderSpecHash(getVoice('alloy'));
  assert.notEqual(withVersion, renderSpecHash({ ...getVoice('alloy'), id: 'alloy-x' }));
});

test('the stored path carries both hashes, so stale audio cannot be served', () => {
  const voice = getVoice('alloy');
  const path = segmentPath('pres-1', 'slide-7', 'full', 'Some words.', voice);
  assert.ok(path.includes(scriptHash('Some words.')));
  assert.ok(path.includes(renderSpecHash(voice)));
  assert.ok(path.startsWith('narration/pres-1/'));
  assert.ok(path.endsWith('.mp3'));
});

test('a Gemini voice stores WAV, since a browser cannot play raw PCM', () => {
  assert.ok(segmentPath('p', 's', 'full', 'x', getVoice('puck')).endsWith('.wav'));
});

test('the two variants of one slide are different objects', () => {
  const voice = getVoice('alloy');
  assert.notEqual(
    segmentPath('p', 's', 'full', 'Long version.', voice),
    segmentPath('p', 's', 'compressed', 'Short.', voice)
  );
});

// ---------------------------------------------------------------------------
// Optimistic-concurrency threading
//
// Every narration write is guarded by `expected_updated_at`, and a successful
// write BUMPS it. Reusing one token across many writes means the first wins and
// the rest are refused — which is exactly what happened live: 1 of 6 slides
// written, five "Layout rejected the write".
//
// Tested against the route's SOURCE rather than by driving the handler, because
// the failure was structural (parallel writes sharing a stale token), and the
// structure is what has to stay fixed.
// ---------------------------------------------------------------------------

const scriptRouteSource = fs.readFileSync(
  new URL('../app/api/narration/script/route.ts', import.meta.url), 'utf8');

test('the write phase threads updated_at forward instead of reusing one token', () => {
  // The success path must move the token, or every write after the first is stale.
  assert.ok(
    /write\.updatedAt\)?\s*token\s*=\s*write\.updatedAt/.test(
      scriptRouteSource.replace(/\s+/g, ' ')
    ) || scriptRouteSource.includes('token = write.updatedAt'),
    'a successful write does not update the token'
  );
});

test('a 409 is retried against the value the server reports', () => {
  assert.ok(
    scriptRouteSource.includes('token = write.currentUpdatedAt'),
    'a conflict does not adopt the server current updated_at'
  );
});

test('writes are sequential — no Promise.all around updateSlideNarration', () => {
  // The original bug in one line: concurrent writes cannot thread a token that
  // only exists once the previous write has returned.
  const writePhase = scriptRouteSource.slice(scriptRouteSource.indexOf('PHASE 2'));
  assert.ok(
    !writePhase.includes('Promise.all'),
    'the write phase is parallel again — the token cannot be threaded'
  );
  assert.ok(writePhase.includes('for (const item of drafted)'), 'writes are not sequential');
});

test('drafting stays concurrent, because that is the slow part', () => {
  const draftPhase = scriptRouteSource.slice(
    scriptRouteSource.indexOf('PHASE 1'),
    scriptRouteSource.indexOf('PHASE 2')
  );
  assert.ok(draftPhase.includes('Promise.all'), 'drafting lost its parallelism');
});

test('a rejected write says WHICH rejection', () => {
  // "Layout rejected the write" hid a 409 behind words that could have meant
  // anything, and cost a round of diagnosis.
  // The QUOTED literal, not the phrase: the comment above the fix quotes the old
  // message on purpose, and a test that cannot tell code from prose is noise.
  assert.ok(!scriptRouteSource.includes("'Layout rejected the write'"));
  assert.ok(scriptRouteSource.includes('the deck changed while writing'));
});

// ---------------------------------------------------------------------------
// Telling the author what happened, and where it went
// ---------------------------------------------------------------------------

const pickerSource = fs.readFileSync(
  new URL('../components/narration-voice-picker.tsx', import.meta.url), 'utf8');
const notesPanelSource = fs.readFileSync(
  new URL('../components/slide-notes-panel.tsx', import.meta.url), 'utf8');

test('the summary counts COVERAGE, not writes', () => {
  // "Wrote 5 of 6" beside "Slide 3: kept" read as one slide missing when every
  // slide in fact had a script. A kept slide is covered, not absent.
  assert.ok(
    pickerSource.includes("r.status === 'written' || r.status === 'kept'"),
    'coverage still ignores kept slides'
  );
});

test('a kept slide is not listed as a problem', () => {
  assert.ok(
    pickerSource.includes("r.status !== 'written' && r.status !== 'kept'"),
    'kept slides are still shown in the problem list'
  );
});

test('the author is told where the script actually went', () => {
  // The single most common confusion: the words are written somewhere the
  // author is not currently looking.
  assert.ok(/Script tab/.test(pickerSource), 'the Script tab is never named');
});

test('writing a script nudges the notes panel to re-read', () => {
  // The panel loads before the dialog is opened, so without this the author
  // closes the dialog, opens the Script tab, and sees the empty box they left.
  assert.ok(
    pickerSource.includes("deckster:narration-script-written"),
    'the picker never announces the write'
  );
  assert.ok(
    notesPanelSource.includes("deckster:narration-script-written"),
    'the notes panel never listens for it'
  );
  assert.ok(
    notesPanelSource.includes('reloadToken'),
    'the panel listens but has no way to force a re-read'
  );
});

test('the record control says it records, not that it checks a price', () => {
  // "Check the cost" gave no signal that it was the way to record at all.
  assert.ok(pickerSource.includes("'Record the narration'"));
  assert.ok(!pickerSource.includes("'Check the cost'"));
});

test('the estimate says plainly that nothing has been charged', () => {
  assert.ok(/Nothing has been charged yet/.test(pickerSource));
});

// ---------------------------------------------------------------------------
// Never pay for audio we cannot keep
// ---------------------------------------------------------------------------

const renderRouteSource = fs.readFileSync(
  new URL('../app/api/narration/render/route.ts', import.meta.url), 'utf8');
const mediaStoreSource = fs.readFileSync(
  new URL('../lib/narration/media-store.ts', import.meta.url), 'utf8');

test('storage is checked BEFORE the first paid call, not after', () => {
  // The live failure: every segment was synthesised, every one was discarded
  // because the bucket was unreachable, and the ledger reported 0c because it
  // only counts what it manages to keep. The vendor was paid regardless.
  const preflight = renderRouteSource.indexOf('mediaStoreStatus()');
  const firstSynth = renderRouteSource.indexOf('await synthesize(');
  assert.ok(preflight > 0, 'there is no storage preflight');
  assert.ok(preflight < firstSynth, 'storage is checked after synthesis — money is already spent');
});

test('a storage failure names its cause', () => {
  // "could not store the audio" is true of every storage failure and useful for
  // none of them.
  assert.ok(mediaStoreSource.includes('SUPABASE_SERVICE_ROLE_KEY is not set'));
  assert.ok(renderRouteSource.includes('stored.reason'));
});

test('storage errors are logged at ERROR, not whispered at info', () => {
  // The original logged at info "because it is an expected state before setup",
  // which stopped being true the moment the bucket existed — and then hid a
  // real failure behind a level nobody greps.
  const putBlock = mediaStoreSource.slice(mediaStoreSource.indexOf('export async function putMedia'));
  assert.ok(putBlock.includes('console.error'), 'upload failures are not logged as errors');
  assert.ok(!putBlock.includes('console.info'), 'upload failures are still whispered');
});

test('putMedia returns a reason, not a bare boolean', () => {
  assert.ok(/putMedia\([\s\S]{0,200}?Promise<\{ ok: boolean; reason\?: string \}>/.test(mediaStoreSource));
});

// ---------------------------------------------------------------------------
// Say which variable is missing, not which one you assume
// ---------------------------------------------------------------------------

test('the missing-config message is not hard-coded to one variable', () => {
  // admin() is null when EITHER the url or the key is absent, but both call
  // sites named the service-role key — which sent a debugging round after a key
  // that was correctly set, while the real gap went unnamed.
  assert.ok(mediaStoreSource.includes('missingMediaConfig'));
  assert.ok(
    !/reason: 'SUPABASE_SERVICE_ROLE_KEY is not set/.test(mediaStoreSource),
    'still blames one variable regardless of which is missing'
  );
});

test('both configuration names can be reported', () => {
  const fn = mediaStoreSource.slice(
    mediaStoreSource.indexOf('export function missingMediaConfig'));
  assert.ok(fn.includes('NEXT_PUBLIC_SUPABASE_URL'));
  assert.ok(fn.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('a null client with BOTH values set still says something useful', () => {
  // Otherwise the banner reads "missing " and we are guessing again.
  const fn = mediaStoreSource.slice(
    mediaStoreSource.indexOf('export function missingMediaConfig'));
  assert.ok(/missing\.length > 0 \? missing :/.test(fn), 'empty case falls through to a blank message');
});

// ---------------------------------------------------------------------------
// Playback: a stale slide plays NOTHING, and audio is no more reachable than
// the deck it speaks for
// ---------------------------------------------------------------------------

const manifestSource = fs.readFileSync(
  new URL('../lib/narration/manifest.ts', import.meta.url), 'utf8');
const segmentRouteSource = fs.readFileSync(
  new URL('../app/api/narration/segment/[segmentId]/route.ts', import.meta.url), 'utf8');
const previewSource = fs.readFileSync(
  new URL('../components/slide-script-preview.tsx', import.meta.url), 'utf8');

test('a segment is matched on the CURRENT script hash, never on recency', () => {
  // Speaking words the author has replaced, over the slide they replaced them
  // on, is the worst failure available here — worse than silence, because
  // silence is obviously missing and wrong words sound authoritative.
  assert.ok(manifestSource.includes('scriptHash(script)'), 'no hash comparison');
  assert.ok(
    /r\.scriptHash === wanted/.test(manifestSource),
    'segments are not matched against the current script'
  );
  assert.ok(
    !/orderBy[\s\S]{0,80}createdAt/.test(manifestSource),
    'falls back to the most recent recording instead of the correct one'
  );
});

test('a slide with a script but no matching recording is marked stale', () => {
  assert.ok(/const stale = hasScript && !fullRow/.test(manifestSource));
});

test('the manifest only reads READY segments', () => {
  // A pending row is a render that may never have finished, and a failed one is
  // a record of an attempt. Either would give a slide that plays nothing while
  // claiming it can.
  assert.ok(/status: 'ready'/.test(manifestSource));
});

test('audio is gated by the same rules as the deck it belongs to', () => {
  assert.ok(segmentRouteSource.includes('verifyUnlockCookie'), 'restricted decks are not gated');
  assert.ok(segmentRouteSource.includes('narrationEnabled'), 'narration-off decks still serve audio');
  assert.ok(segmentRouteSource.includes('revokedAt'), 'revoked decks still serve audio');
});

test('a published deck cannot be used as a key to another deck audio', () => {
  // The check that stops "any valid slug" from unlocking any segment.
  assert.ok(
    segmentRouteSource.includes('finalPresentationId === segment.presentationId'),
    'the segment is not verified to belong to the named deck'
  );
});

test('a forbidden segment 404s rather than 403s', () => {
  // A 403 would confirm that a segment exists for a deck the caller cannot open.
  const denial = segmentRouteSource.slice(segmentRouteSource.indexOf('if (!allowed)'));
  assert.ok(denial.includes('status: 404'), 'denial leaks existence via 403');
});

test('the creator preview refuses to play a stale slide', () => {
  assert.ok(previewSource.includes('audio?.stale'), 'stale slides are still playable');
  assert.ok(/Record it again/.test(previewSource), 'stale state gives no way forward');
});

test('changing slide stops the previous slide talking', () => {
  assert.ok(
    /elementRef\.current\?\.pause\(\)[\s\S]{0,80}\[slideId\]/.test(previewSource),
    'audio keeps playing over the next slide'
  );
});

// ---------------------------------------------------------------------------
// The presenter: pacing and trust, not data
// ---------------------------------------------------------------------------

const presenterSource = fs.readFileSync(
  new URL('../components/published-presenter.tsx', import.meta.url), 'utf8');
const viewerSource = fs.readFileSync(
  new URL('../components/published-viewer.tsx', import.meta.url), 'utf8');

test('nothing plays until the audience presses play', () => {
  // Audio beginning unbidden on a stranger's link is how a deck gets closed
  // rather than watched.
  assert.ok(/!started &&/.test(presenterSource), 'there is no explicit start gate');
  assert.ok(/Play the presentation/.test(presenterSource));
  assert.ok(!/autoPlay|autoplay/.test(presenterSource), 'something autoplays');
});

test('a slide with no audio is SHOWN silently, never skipped', () => {
  // Skipping hides part of the deck; sitting on it forever looks broken.
  assert.ok(presenterSource.includes('SILENT_SLIDE_MS'));
  const noAudio = presenterSource.slice(presenterSource.indexOf('if (!segmentId)'));
  assert.ok(noAudio.includes('setTimeout'), 'a silent slide does not advance on its own');
});

test('a segment that fails to load does not stall the run', () => {
  // The recovery is now a named function shared by every failure path — a
  // segment that will not fetch, will not decode, or will not play.
  assert.ok(/const fallToSilence = \(\) =>/.test(presenterSource));
  const recover = presenterSource.slice(presenterSource.indexOf('const fallToSilence'));
  assert.ok(recover.slice(0, 400).includes('SILENT_SLIDE_MS'), 'a failed segment leaves the deck stuck');
});

test('running late switches to the compressed script rather than truncating', () => {
  // A deck that stops mid-sentence at the buzzer is the failure the whole time
  // budget exists to prevent.
  assert.ok(/shouldCompress/.test(presenterSource));
  assert.ok(
    /elapsedMs \+ remainingMs > budgetMs/.test(presenterSource),
    'the overrun test does not compare remaining audio against remaining time'
  );
  assert.ok(/Running long/.test(presenterSource), 'the switch is never announced');
});

test('the compressed variant falls back to full when it was never recorded', () => {
  // Otherwise deciding to run short would silence every slide that only has a
  // full recording — worse than the overrun it is avoiding.
  assert.ok(/current\.compressed \?\? current\.full/.test(presenterSource));
});

test('the clock counts wall time, not audio time', () => {
  // A pause the audience took is time the session actually spent. The budget is
  // about the room, not the file.
  assert.ok(/Date\.now\(\) - elapsedMs/.test(presenterSource));
});

test('Play is only offered when something is genuinely playable', () => {
  // A Play button that produces silence is worse than no button.
  assert.ok(
    /data\.slides\?\.some\(\(slide\) => slide\.full\)/.test(viewerSource),
    'the play button appears regardless of whether audio exists'
  );
});

test('a deck without narration still works', () => {
  // The manifest 404s for a deck with narration off, and that is the ordinary
  // answer — never an error that blocks the slides.
  const fetchBlock = viewerSource.slice(viewerSource.indexOf('api/narration/manifest'));
  assert.ok(/catch \{/.test(fetchBlock), 'a narration failure is not contained');
  assert.ok(/if \(!response\.ok \|\| cancelled\) return/.test(fetchBlock));
});

// ---------------------------------------------------------------------------
// Speaking: the answer, the apology, and the ending
// ---------------------------------------------------------------------------

const spokenSource = fs.readFileSync(
  new URL('../lib/narration/spoken.ts', import.meta.url), 'utf8');
const speakRouteSource = fs.readFileSync(
  new URL('../app/api/narration/speak/route.ts', import.meta.url), 'utf8');

test('the speak endpoint NEVER synthesises caller-supplied text', () => {
  // A public endpoint that speaks arbitrary text is a free TTS service on
  // somebody else's wallet. The words are always ours: a constant in the
  // codebase, or an answer this deck already produced and stored.
  assert.ok(
    !/body\.text|body\.answer\b/.test(speakRouteSource),
    'the caller can supply the words to be spoken'
  );
  assert.ok(speakRouteSource.includes('body.questionId'), 'answers are not looked up by id');
  assert.ok(
    /findFirst\([\s\S]{0,200}publishedDeckId: deck\.id/.test(speakRouteSource),
    'a question id from another deck could be spoken here'
  );
});

test('only voices measured fast enough may speak answers', () => {
  assert.ok(spokenSource.includes('canSpeakLiveAnswers'));
  assert.ok(
    /if \(!canSpeakAnswers\(voiceId\)\) return null/.test(spokenSource),
    'a slow voice can still be asked to answer live'
  );
  assert.ok(speakRouteSource.includes('canSpeakAnswers'), 'the route does not enforce it');
});

test('spoken answers are NOT cached, fixed lines are', () => {
  // An answer will not be said again, so a stored object and a ledger row would
  // both be pure cost. An announcement is identical for every deck in the
  // system and is rendered once per voice, forever.
  const answerFn = spokenSource.slice(spokenSource.indexOf('export async function speakAnswer'));
  assert.ok(!answerFn.includes('putMedia'), 'per-question audio is being stored');
  const fixedFn = spokenSource.slice(
    spokenSource.indexOf('export async function speakFixedLine'),
    spokenSource.indexOf('export async function speakAnswer')
  );
  assert.ok(fixedFn.includes('getMedia') && fixedFn.includes('putMedia'));
});

test('a failed announcement never stops the presentation', () => {
  const fixedFn = spokenSource.slice(spokenSource.indexOf('export async function speakFixedLine'));
  assert.ok(/catch \(error\)[\s\S]{0,200}return null/.test(fixedFn));
  assert.ok(/on-screen notice/.test(presenterSource), 'no written fallback for the announcement');
});

test('the run always ends on the closing, not on the last slide', () => {
  // A deck that simply stops ends on whatever its final slide happened to say.
  // A deck that closes ends on purpose.
  assert.ok(presenterSource.includes('manifest.closing'));
  const finish = presenterSource.slice(presenterSource.indexOf('const finish = () =>'));
  assert.ok(/closingRef\.current/.test(finish.slice(0, 900)), 'the ending is not reached');
});

test('the closing is written to work from ANY point', () => {
  // Its whole job is to end a session that ran out of time, so it cannot refer
  // to "the last slide" or open with "finally".
  assert.ok(/never refer to/.test(scriptRouteSource));
  assert.ok(/DEFAULT_CLOSING_LINE/.test(spokenSource));
  assert.ok(!/and finally/i.test(spokenSource.slice(spokenSource.indexOf('DEFAULT_CLOSING_LINE'), spokenSource.indexOf('DEFAULT_CLOSING_LINE') + 220)));
});

test('the closing rides in the same content-addressed ledger', () => {
  // A reserved slide id keeps it in one cache with no special-casing, so it
  // re-renders when its words change and not otherwise.
  assert.ok(renderRouteSource.includes("CLOSING_SLIDE_ID = '__closing__'"));
  assert.ok(renderRouteSource.includes("variant: 'closing'"));
});

test('a defer is never read aloud as if it were an answer', () => {
  // Only an answered question is queued for speaking; a defer is shown in
  // words, which is what a defer is.
  assert.ok(/asking === 'presenter' && asked\.answer/.test(questionSource));
});

test('the same answer is never spoken twice', () => {
  // Each queued answer is removed from the queue as it finishes, and recorded
  // as spoken so the panel reveals it rather than replaying it.
  assert.ok(/setQueued\(\(prev\) => prev\.slice\(1\)\)/.test(presenterSource));
  assert.ok(/setSpokenAnswerIds/.test(presenterSource));
});

// ---------------------------------------------------------------------------
// A spoken answer is not a written one read aloud
// ---------------------------------------------------------------------------

test('the spoken form is bounded to roughly fifteen seconds', () => {
  // 35 words at ~140wpm. A minute of speech to answer one question costs more
  // of the session than the question was worth.
  assert.equal(SPOKEN_ANSWER_MAX_WORDS, 35);
});

test('it cuts on SENTENCES, never mid-phrase', () => {
  const long =
    'Prices fell twenty-five per cent last year. That was the steepest drop since 2017. ' +
    'It was driven by low mineral prices, intense competition, and manufacturers reaching ' +
    'economies of scale across every major region of the world market.'
  const said = spokenPrecis(long)
  assert.ok(said.includes('Prices fell twenty-five per cent last year.'));
  // Nothing may end mid-word: the last thing before the pointer is punctuation.
  const body = said.replace(SPOKEN_ANSWER_TAIL, '').trim()
  assert.ok(/[.!?…]$/.test(body), `spoken form ends mid-phrase: ${body.slice(-40)}`);
});

test('it points at the written answer rather than pretending to be complete', () => {
  const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ') + '.'
  assert.ok(spokenPrecis(long).endsWith(SPOKEN_ANSWER_TAIL));
});

test('a short answer is spoken whole, with no pointer bolted on', () => {
  const short = 'About nine months on monthly billing.'
  assert.equal(spokenPrecis(short), short);
});

test('a single over-long sentence still stops somewhere', () => {
  const runOn = Array.from({ length: 90 }, (_, i) => `w${i}`).join(' ')
  const said = spokenPrecis(runOn)
  assert.ok(said.split(' ').length < 45, 'an unpunctuated answer is read in full');
});

test('the spoken form is a SUBSET of verified text, not a new generation', () => {
  // No second model call between the question and the reply — nothing new can
  // be introduced, and no latency is added to a pause someone is sitting in.
  const fn = spokenSource.slice(spokenSource.indexOf('export function spokenPrecis'));
  assert.ok(!/fetch|synthesize|openrouter/i.test(fn.slice(0, 900)));
});

test('a question asked mid-presentation joins the written thread', () => {
  // It is still a question this person asked of this deck, and for a deferred
  // one the token is the only route back to the owner's reply.
  assert.ok(questionSource.includes('rememberThread'));
});

// ---------------------------------------------------------------------------
// Publishing is a set of decisions, not a button
// ---------------------------------------------------------------------------

const wizardSource = fs.readFileSync(
  new URL('../components/publish-wizard.tsx', import.meta.url), 'utf8');
const dialogSource = fs.readFileSync(
  new URL('../components/publish-dialog.tsx', import.meta.url), 'utf8');

test('every choice is offered BEFORE the deck is published', () => {
  // The old flow asked two questions, published, and only then revealed that
  // the deck could also answer questions and narrate itself. You had to publish
  // something before you could find out what you were publishing.
  for (const choice of ['qaEnabled', 'qaAutoAnswer', 'narrationEnabled', 'narrationBudgetMinutes']) {
    assert.ok(wizardSource.includes(choice), `${choice} is not offered pre-publish`);
  }
});

test('the wizard shows how many steps there are', () => {
  // A wizard that hides its own length is a form that keeps asking for one
  // more thing.
  assert.ok(/STEPS = \['Audience', 'Questions', 'Narration', 'Review'\]/.test(wizardSource));
});

test('republish opens the SAME wizard, pre-filled', () => {
  // A republished deck has changed, so its scripts and audio may no longer
  // match it — this is the only place that staleness gets resolved.
  assert.ok(dialogSource.includes('setRepublishing(true)'));
  assert.ok(/record=\{record\}/.test(dialogSource), 'republish does not pre-fill from the record');
});

test('the wizard opens on current settings, never on defaults', () => {
  // Otherwise republishing would silently revert every choice already made.
  assert.ok(/record\?\.qaEnabled \?\? false/.test(wizardSource));
  assert.ok(/record\?\.narrationEnabled \?\? false/.test(wizardSource));
  assert.ok(/record\?\.visibility as WizardChoices\['visibility'\]\) \?\?/.test(wizardSource));
});

test('a failed step does not abort the ones after it', () => {
  // A deck that published but could not record is still published, and saying
  // otherwise would be false.
  const run = dialogSource.slice(dialogSource.indexOf('const runWizard'));
  const failed = (run.match(/status: 'failed'/g) ?? []).length;
  assert.ok(failed >= 3, 'steps do not report failure independently');
  assert.ok(!/return;?\s*\}\s*update\(2/.test(run), 'a failure aborts the remaining work');
});

test('narration work is skipped, not failed, when it was never asked for', () => {
  // "Skipped" and "failed" mean different things and a progress list that
  // conflates them is lying about what happened.
  // It appears inside a ternary, so match the value rather than a whole line.
  assert.ok(dialogSource.includes("'skipped'"), 'nothing is ever skipped');
  assert.ok(
    /choices\.narrationEnabled && choices\.writeScript\s*\?\s*'pending'\s*:\s*'skipped'/.test(
      dialogSource
    ),
    'narration work is not conditional on having been asked for'
  );
});

test('writing and recording default ON when narration is switched on', () => {
  // A deck that narrates but has no script and no audio is a setting, not a
  // feature.
  assert.ok(/writeScript: true/.test(wizardSource));
  assert.ok(/recordNarration: true/.test(wizardSource));
});

test('the review step states the cost before anything is charged', () => {
  assert.ok(/before anything is charged/.test(wizardSource));
});

// ---------------------------------------------------------------------------
// Asking during a presentation
// ---------------------------------------------------------------------------

const questionSource = fs.readFileSync(
  new URL('../components/presenter-question.tsx', import.meta.url), 'utf8');
const { spokenPrecis, SPOKEN_ANSWER_MAX_WORDS, SPOKEN_ANSWER_TAIL } =
  load('../lib/narration/spoken.ts');


test('present and play are ONE control, not two', () => {
  // They were the same act described two ways, and offering both invited the
  // reading that one of them is a passive watch. This is an interactive
  // presentation, not a video.
  assert.ok(!/>Play<|Play this deck/.test(viewerSource), 'a separate Play control survives');
  assert.ok(/Present this deck/.test(viewerSource));
});

test('the control is Ask, not Raise hand', () => {
  assert.ok(!/Raise hand/.test(presenterSource));
  assert.ok(!/HandState/.test(presenterSource));
  assert.ok(/>Ask</.test(presenterSource));
});

test('the panel is on the RIGHT, not centred', () => {
  // A question is an aside. A modal in the middle of the slide says the
  // presentation stopped for it, which in the written case is untrue.
  assert.ok(/absolute right-0 top-0/.test(questionSource));
  // The PANEL is right-anchored; buttons inside it centre their own icons,
  // which is a different thing and must not fail this.
  assert.ok(!/<aside[^>]*justify-center/.test(questionSource));
});

test('a WRITTEN answer never pauses the presentation', () => {
  // The whole point of the two modes: one interrupts, one does not.
  assert.ok(/'written' \| 'presenter'/.test(questionSource));
  const queue = questionSource.slice(questionSource.indexOf("if (asking === 'presenter'"));
  assert.ok(queue.startsWith("if (asking === 'presenter' && asked.answer) onQueueForPresenter"),
    'written answers are queued for speaking');
});

test('a spoken answer waits for the END of the slide', () => {
  // Interrupting a thought to answer something else costs the thought and does
  // not make the answer better.
  assert.ok(/ANSWER_AT_SLIDE_END/.test(presenterSource));
  const advance = presenterSource.slice(presenterSource.indexOf('const advance = () =>'));
  assert.ok(/queuedRef\.current\.length > 0/.test(advance.slice(0, 400)));
});

test('the question is SENT immediately, not at the boundary', () => {
  // The rest of the slide is spent working on the answer rather than making the
  // asker wait for it afterwards.
  const submit = questionSource.slice(questionSource.indexOf('const submit'));
  assert.ok(submit.indexOf('/ask') < submit.indexOf('onQueueForPresenter'));
});

test('nothing about a spoken answer is shown until it has been said', () => {
  // Reading the answer while the presenter says it means doing neither.
  assert.ok(/const hidden = asked\.mode === 'presenter' && !alreadySpoken/.test(questionSource));
  assert.ok(/asked\.answer && !hidden/.test(questionSource));
});

test('answers render as MARKDOWN, not as raw text', () => {
  // The answer prompt asks for short lists and bold labels; rendering them
  // literally put ** and - on the screen.
  assert.ok(questionSource.includes('AnswerBody'));
  assert.ok(!/whitespace-pre-wrap/.test(questionSource));
});

test('a question on the last slide is still answered before the deck closes', () => {
  const finish = presenterSource.slice(presenterSource.indexOf('const finish = () =>'));
  assert.ok(/queuedRef\.current\.length > 0/.test(finish.slice(0, 300)));
});

// ---------------------------------------------------------------------------
// Audio that does not thin out
// ---------------------------------------------------------------------------

test('a segment is fetched WHOLE before a note of it plays', () => {
  // Handing a URL to `new Audio` starts playback while the file is still
  // downloading, so a slow moment mid-file makes the browser stall — which
  // sounds like the presenter fading out, not like a network problem.
  assert.ok(/const segmentUrl = useCallback/.test(presenterSource));
  assert.ok(/URL\.createObjectURL\(await response\.blob\(\)\)/.test(presenterSource));
  assert.ok(
    !/new Audio\(\s*`\/api\/narration\/segment/.test(presenterSource),
    'a segment is still streamed straight from the endpoint'
  );
});

test('the next slide is fetched while the current one speaks', () => {
  assert.ok(/const prefetch = useCallback/.test(presenterSource));
  assert.ok(/Warm the next slide while this one speaks/.test(presenterSource));
});

test('cached blobs are revoked when the presentation ends', () => {
  // Object URLs outlive their component unless revoked.
  assert.ok(/URL\.revokeObjectURL/.test(presenterSource));
});

// ---------------------------------------------------------------------------

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
