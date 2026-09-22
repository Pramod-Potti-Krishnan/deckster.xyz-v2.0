/**
 * Deck identity (contract G3) — frontend half.
 *
 * Covers the rules the contract makes the FRONTEND responsible for:
 *   - presenter falls back to the signed-in profile name, and is omitted when
 *     that is empty — never replaced by a placeholder
 *   - empty / whitespace form fields are omitted, not sent as ""
 *   - null when nothing at all is known (no presenter, no form)
 *   - date is today's LOCAL calendar date as ISO YYYY-MM-DD
 *   - `source` is "form" when any form field is set, else "profile"
 *   - a frame built with NEXT_PUBLIC_DECK_IDENTITY_ENABLED off has no
 *     `deck_identity` key at all
 *
 * Plain node, no framework — same TS-through-vm idiom as
 * scripts/test-user-message-attachments.mjs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

/**
 * Compile a TS helper to CJS and evaluate it in THIS realm (rather than a vm
 * context) so the objects it returns share our intrinsics and `deepEqual`
 * works. `process` is a parameter, which lets each load see a different
 * NEXT_PUBLIC_DECK_IDENTITY_ENABLED without mutating the real environment.
 */
function loadTsModule(relativePath, env = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const mod = { exports: {} };
  const factory = new Function('module', 'exports', 'require', 'process', compiled.outputText);
  factory(mod, mod.exports, require, { ...process, env: { ...process.env, ...env } });
  return mod.exports;
}

const identity = loadTsModule('../lib/deck-identity.ts');
const {
  buildDeckIdentity,
  cleanLogoUrl,
  formatDeckIdentityDate,
  normalizeDeckIdentityForm,
  readDeckIdentityForm,
  writeDeckIdentityForm,
  DECK_IDENTITY_STORAGE_KEY,
} = identity;

const FIXED_NOW = new Date(2026, 8, 22, 9, 30); // 22 Sep 2026, local
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('deck identity — frontend contract');

// ---------------------------------------------------------------- date format
check('date is local ISO YYYY-MM-DD', () => {
  assert.equal(formatDeckIdentityDate(FIXED_NOW), '2026-09-22');
  assert.equal(formatDeckIdentityDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

check('date does not shift with the UTC boundary', () => {
  // 23:30 local on the 22nd is the 22nd, whatever UTC thinks.
  const lateEvening = new Date(2026, 8, 22, 23, 30);
  assert.equal(formatDeckIdentityDate(lateEvening), '2026-09-22');
  // ...and 00:30 local on the 23rd is the 23rd.
  const earlyMorning = new Date(2026, 8, 23, 0, 30);
  assert.equal(formatDeckIdentityDate(earlyMorning), '2026-09-23');
});

// --------------------------------------------------------------- the fallback
check('presenter falls back to the signed-in profile name', () => {
  const built = buildDeckIdentity({ sessionName: 'Pramod Potti', now: FIXED_NOW });
  assert.deepEqual(built, {
    presenter: 'Pramod Potti',
    date: '2026-09-22',
    source: 'profile',
  });
});

check('a whitespace profile name is omitted, not sent', () => {
  assert.equal(buildDeckIdentity({ sessionName: '   ', now: FIXED_NOW }), null);
  const withForm = buildDeckIdentity({
    sessionName: '   ',
    form: { company: 'Deckster' },
    now: FIXED_NOW,
  });
  assert.equal('presenter' in withForm, false);
  assert.equal(withForm.company, 'Deckster');
});

// ------------------------------------------------------------- no placeholders
check('never emits a placeholder presenter or company', () => {
  for (const placeholder of ['Presenter Name', 'presenter name', 'Your Company', 'AI-Generated Presentation']) {
    const built = buildDeckIdentity({
      sessionName: placeholder,
      form: { company: placeholder },
      now: FIXED_NOW,
    });
    if (built !== null) {
      assert.equal('presenter' in built, false, `presenter leaked "${placeholder}"`);
      assert.equal('company' in built, false, `company leaked "${placeholder}"`);
    }
  }
  // With nothing but placeholders there is nothing to say at all.
  assert.equal(
    buildDeckIdentity({ sessionName: 'Presenter Name', form: { company: 'Your Company' }, now: FIXED_NOW }),
    null,
  );
});

// ------------------------------------------------------------ empty → omitted
check('empty strings are omitted rather than sent as ""', () => {
  const built = buildDeckIdentity({
    sessionName: 'Pramod Potti',
    form: { company: '', confidentiality: '  ', logoUrl: '' },
    now: FIXED_NOW,
  });
  assert.deepEqual(built, {
    presenter: 'Pramod Potti',
    date: '2026-09-22',
    source: 'profile',
  });
  const serialized = JSON.parse(JSON.stringify(built));
  assert.equal('company' in serialized, false);
  assert.equal('confidentiality' in serialized, false);
  assert.equal('logo_url' in serialized, false);
});

check('values are trimmed', () => {
  const built = buildDeckIdentity({
    sessionName: '  Pramod Potti  ',
    form: { company: '  Deckster ', confidentiality: ' Confidential ' },
    now: FIXED_NOW,
  });
  assert.equal(built.presenter, 'Pramod Potti');
  assert.equal(built.company, 'Deckster');
  assert.equal(built.confidentiality, 'Confidential');
});

// ------------------------------------------------------- null when unknown
check('null when nothing is known', () => {
  assert.equal(buildDeckIdentity(), null);
  assert.equal(buildDeckIdentity({}), null);
  assert.equal(buildDeckIdentity({ sessionName: null, form: {}, now: FIXED_NOW }), null);
  assert.equal(buildDeckIdentity({ sessionName: undefined, form: null, now: FIXED_NOW }), null);
});

// ----------------------------------------------------------------- source rule
check('source is "form" when any form field is set, else "profile"', () => {
  assert.equal(
    buildDeckIdentity({ sessionName: 'Pramod Potti', now: FIXED_NOW }).source,
    'profile',
  );
  assert.equal(
    buildDeckIdentity({ sessionName: 'Pramod Potti', form: { company: 'Deckster' }, now: FIXED_NOW }).source,
    'form',
  );
  assert.equal(
    buildDeckIdentity({ sessionName: 'Pramod Potti', form: { confidentiality: 'Confidential' }, now: FIXED_NOW }).source,
    'form',
  );
  assert.equal(
    buildDeckIdentity({ sessionName: 'Pramod Potti', form: { logoUrl: 'https://cdn.example.com/l.png' }, now: FIXED_NOW }).source,
    'form',
  );
  // A form whose only value is blank does not make it "form".
  assert.equal(
    buildDeckIdentity({ sessionName: 'Pramod Potti', form: { company: '   ' }, now: FIXED_NOW }).source,
    'profile',
  );
});

// -------------------------------------------------------------------- logo url
check('logo_url keeps https and drops anything else', () => {
  assert.equal(cleanLogoUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
  assert.equal(cleanLogoUrl('http://cdn.example.com/logo.png'), undefined);
  assert.equal(cleanLogoUrl('javascript:alert(1)'), undefined);
  assert.equal(cleanLogoUrl('not a url'), undefined);
  assert.equal(cleanLogoUrl(''), undefined);
});

// -------------------------------------------------------------- the full shape
check('the full object matches the contract shape', () => {
  const built = buildDeckIdentity({
    sessionName: 'Pramod Potti',
    form: {
      company: 'Deckster',
      confidentiality: 'Confidential',
      logoUrl: 'https://cdn.example.com/logo.png',
    },
    now: FIXED_NOW,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(built)), {
    presenter: 'Pramod Potti',
    company: 'Deckster',
    date: '2026-09-22',
    confidentiality: 'Confidential',
    logo_url: 'https://cdn.example.com/logo.png',
    source: 'form',
  });
  // Only contract keys, nothing extra.
  assert.deepEqual(Object.keys(built).sort(), [
    'company', 'confidentiality', 'date', 'logo_url', 'presenter', 'source',
  ]);
});

// ------------------------------------------------------------------- storage
check('the stored form round-trips and tolerates junk', () => {
  const store = new Map();
  const events = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    dispatchEvent: (event) => events.push(event?.type ?? 'event'),
  };
  try {
    assert.deepEqual(readDeckIdentityForm(), {});

    writeDeckIdentityForm({ company: ' Deckster ', confidentiality: '', logoUrl: 'https://x.test/l.png' });
    assert.deepEqual(readDeckIdentityForm(), { company: 'Deckster', logoUrl: 'https://x.test/l.png' });
    assert.equal(events.length, 1);

    // Clearing every field removes the key rather than leaving `{}` behind.
    writeDeckIdentityForm({ company: '', confidentiality: '', logoUrl: '' });
    assert.equal(store.has(DECK_IDENTITY_STORAGE_KEY), false);
    assert.deepEqual(readDeckIdentityForm(), {});

    // Corrupt JSON and unexpected shapes never throw.
    store.set(DECK_IDENTITY_STORAGE_KEY, '{not json');
    assert.deepEqual(readDeckIdentityForm(), {});
    store.set(DECK_IDENTITY_STORAGE_KEY, JSON.stringify({ company: 42, rogue: 'drop me' }));
    assert.deepEqual(readDeckIdentityForm(), {});
  } finally {
    delete globalThis.window;
  }
});

check('storage helpers tolerate SSR and a throwing storage', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.deepEqual(readDeckIdentityForm(), {});
  assert.deepEqual(writeDeckIdentityForm({ company: 'Deckster' }), { company: 'Deckster' });

  globalThis.window = {
    get localStorage() {
      throw new Error('blocked');
    },
    dispatchEvent: () => {},
  };
  try {
    assert.deepEqual(readDeckIdentityForm(), {});
    assert.deepEqual(writeDeckIdentityForm({ company: 'Deckster' }), { company: 'Deckster' });
  } finally {
    delete globalThis.window;
  }
});

check('normalizeDeckIdentityForm keeps only the three known fields', () => {
  assert.deepEqual(normalizeDeckIdentityForm(null), {});
  assert.deepEqual(normalizeDeckIdentityForm('nope'), {});
  assert.deepEqual(
    normalizeDeckIdentityForm({ company: 'Deckster', presenter: 'hacker', source: 'probe' }),
    { company: 'Deckster' },
  );
});

// ------------------------------------------------------------------- the flag
check('the flag reads "1"/"true" and nothing else', () => {
  for (const value of ['1', 'true', 'TRUE', ' true ']) {
    assert.equal(loadTsModule('../lib/deck-identity.ts', { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: value }).isDeckIdentityEnabled(), true, value);
  }
  for (const value of ['0', 'false', '', 'yes']) {
    assert.equal(loadTsModule('../lib/deck-identity.ts', { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: value }).isDeckIdentityEnabled(), false, value);
  }
});

// ------------------------------------------- the frame, flag on and flag off
/**
 * Mirror of `buildUserMessage`'s identity line in
 * hooks/use-deckster-websocket-v2.ts — asserted against the real source below
 * so the two cannot drift apart silently.
 */
function buildFrameData(options) {
  return {
    text: 'Build me a deck',
    store_name: null,
    deep_research: false,
    web_search: false,
    extended_generation: true,
    file_upload: false,
    use_knowledge_graph: false,
    ...(options?.deckIdentity && { deck_identity: options.deckIdentity }),
  };
}

check('flag OFF: no deck_identity key anywhere in the frame', () => {
  const off = loadTsModule('../lib/deck-identity.ts', { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: '' });
  assert.equal(off.isDeckIdentityEnabled(), false);
  // This is what the hook does: null identity when the flag is off.
  const deckIdentity = off.isDeckIdentityEnabled()
    ? off.buildDeckIdentity({ sessionName: 'Pramod Potti', form: { company: 'Deckster' }, now: FIXED_NOW })
    : null;
  assert.equal(deckIdentity, null);

  const data = buildFrameData(deckIdentity ? { deckIdentity } : {});
  assert.equal('deck_identity' in data, false);
  assert.equal(JSON.stringify(data).includes('deck_identity'), false);
});

check('flag ON: deck_identity rides the frame', () => {
  const on = loadTsModule('../lib/deck-identity.ts', { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: '1' });
  assert.equal(on.isDeckIdentityEnabled(), true);
  const deckIdentity = on.buildDeckIdentity({
    sessionName: 'Pramod Potti',
    form: { company: 'Deckster' },
    now: FIXED_NOW,
  });
  const data = buildFrameData({ deckIdentity });
  assert.deepEqual(data.deck_identity, {
    presenter: 'Pramod Potti',
    company: 'Deckster',
    date: '2026-09-22',
    source: 'form',
  });
});

check('flag ON but nothing known: still no deck_identity key', () => {
  const on = loadTsModule('../lib/deck-identity.ts', { NEXT_PUBLIC_DECK_IDENTITY_ENABLED: '1' });
  const deckIdentity = on.buildDeckIdentity({ sessionName: null, form: {}, now: FIXED_NOW });
  assert.equal(deckIdentity, null);
  const data = buildFrameData(deckIdentity ? { deckIdentity } : {});
  assert.equal('deck_identity' in data, false);
});

// --------------------------------------------------- the real wiring, grepped
const hookSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
  'utf8',
);
const builderSource = fs.readFileSync(
  new URL('../app/builder/page.tsx', import.meta.url),
  'utf8',
);

check('buildUserMessage spreads deckIdentity conditionally', () => {
  assert.ok(
    hookSource.includes("...(options?.deckIdentity && { deck_identity: options.deckIdentity })"),
    'buildUserMessage must attach deck_identity only when the option is present',
  );
  assert.ok(
    hookSource.includes('deck_identity?: DeckIdentity;'),
    'UserMessage.data must declare deck_identity',
  );
  assert.ok(
    hookSource.includes('deckIdentity?: DeckIdentity;'),
    'SendUserMessageOptions must declare deckIdentity',
  );
});

check('the debug log reports presence, never values', () => {
  const logLine = hookSource
    .split('\n')
    .find((line) => line.includes('identity=${'));
  assert.ok(logLine, 'the send log must carry identity=');
  assert.ok(
    logLine.includes("message.data.deck_identity ? 'yes' : 'no'"),
    'the send log must report yes/no, never the identity values',
  );
  for (const field of ['deck_identity.presenter', 'deck_identity.company', 'deck_identity?.presenter', 'deck_identity?.company']) {
    assert.equal(hookSource.includes(`${field}}`), false, `log must not print ${field}`);
  }
});

check('every builder send path carries the identity', () => {
  assert.ok(
    builderSource.includes('const deckIdentity = useDeckIdentity()'),
    'builder must read the identity hook',
  );
  assert.ok(
    /buildSendOptions = useMemo\(\s*\(\) => \(\{[\s\S]*deckIdentity \? \{ deckIdentity \} : \{\}/.test(builderSource),
    'buildSendOptions must carry the identity for every call site that spreads it',
  );
  // Call sites that do NOT spread buildSendOptions must pass it explicitly.
  const explicit = builderSource.match(/\.\.\.\(deckIdentity \? \{ deckIdentity \} : \{\}\)/g) || [];
  assert.ok(
    explicit.length >= 3,
    `expected the identity spread at buildSendOptions plus the standalone send paths, saw ${explicit.length}`,
  );
});

console.log(`\n${passed} checks passed.`);
