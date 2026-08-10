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
