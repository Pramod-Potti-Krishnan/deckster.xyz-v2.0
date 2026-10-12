// PASS2 #10 (frontend-2): Studio deck list cards show no internal stage labels and no repeated titles.
// Flag NEXT_PUBLIC_STUDIO_DECK_CARDS_V2, default off. Flag off must render every card exactly as the base did.
// Run: node scripts/test-studio-deck-cards-v2.mjs   (plain node: transpile + vm, no network, no React runtime)
//   PRINT_GOLDEN=1 node scripts/test-studio-deck-cards-v2.mjs   re-prints the flag-off hashes (run on a pristine base page).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const PAGE = 'app/(app)/dashboard/page.tsx';
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CARDS_V2';

// ---- a tiny module loader: the real TS compiled to CommonJS, run in a vm with a chosen process.env -------------------
function loadTs(file, env, stubs = {}, append = '') {
  const compiled = ts.transpileModule(read(file) + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.length, 0, file);
  const mod = { exports: {} };
  const requireFn = id => {
    if (id in stubs) return stubs[id];
    if (id.endsWith('.css')) return {};
    if (id === '@/lib/studio-deck-cards') return loadTs('lib/studio-deck-cards.ts', env);
    // Every other import (ui kit, icons, hooks) is a name-only stub: components become their own name.
    return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
  };
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require: requireFn, process: { env }, console, Date, Set, Map, Array, encodeURIComponent });
  return mod.exports;
}

// ---- render PresentationCard to a stable string (function components expanded, handlers reduced to <fn>) ----------------
const jsx = (type, props, key) => ({ type, props: props || {}, key });
const LAYOUT = 'https://layout.example.invalid/';
function loadCard(env) {
  const stubs = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react': { useState: v => [v, () => {}], useRef: v => ({ current: v }), useCallback: f => f, useEffect: () => {} },
    'next/link': { __esModule: true, default: 'Link' },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => (typeof url === 'string' && url.startsWith(LAYOUT) ? { status: 'allowed', url } : { status: 'empty' }) },
    '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
  };
  return loadTs(PAGE, env, stubs, '\nexport { PresentationCard };').PresentationCard;
}
function serialise(node) {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(serialise).join('');
  if (typeof node.type === 'function') return serialise(node.type(node.props));
  const { children, ...rest } = node.props;
  const attrs = Object.keys(rest).sort().map(key => typeof rest[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(rest[key])}`);
  return `<${node.type}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(children)}</${node.type}>`;
}
// Visible text only: every string child, no attributes (aria-label / alt / title are not "on the card").
function visibleText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(visibleText);
  if (typeof node.type === 'function') return visibleText(node.type(node.props));
  return visibleText(node.props.children);
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const getStatusColor = status => `color-${status}`;
const getStageName = stage => ({ 1: 'Starting', 2: 'Planning', 3: 'Outlining', 4: 'Preview Ready', 5: 'Refining', 6: 'Complete' }[stage] ?? 'Unknown');

const base = {
  id: 'deck-1', title: 'Rolling out AI demand forecasting to 40 stores', description: 'Rolling out AI demand forecasting to 40 stores',
  createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:30:00Z', slideCount: 4, status: 'completed', thumbnail: '/placeholder.svg',
  folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}p/deck-1`, currentStage: 6,
};
const FIXTURES = {
  'complete, description repeats the title': base,
  'in progress at stage 4, description repeats the title': { ...base, id: 'deck-2', status: 'in-progress', currentStage: 4 },
  'outline preview only, distinct description': { ...base, id: 'deck-3', status: 'in-progress', currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}p/deck-3`, description: 'Build a deck on store-level forecasting for the board' },
  'no description placeholder': { ...base, id: 'deck-4', description: 'No description available' },
  'complete, distinct description': { ...base, id: 'deck-5', description: 'Make this for the regional ops review next Tuesday' },
  'refining at stage 5 with tags and no preview': { ...base, id: 'deck-6', status: 'in-progress', currentStage: 5, finalPresentationUrl: null, strawmanPreviewUrl: null, tags: ['ops', 'retail', 'q4', 'board'] },
  'long truncated-looking title': { ...base, id: 'deck-7', title: 'Adopting AI-driven demand forecasting in mid-size retail', description: 'Adopting AI-driven demand forecasting in mid-size retail', slideCount: 62 },
};
const render = (Card, presentation, withDelete) => Card({ presentation, onOpen() {}, getStatusColor, getStageName, ...(withDelete ? { onDelete() {}, deleteDisabled: false } : {}) });

// Hashes of serialise(PresentationCard(...)) with the flag OFF, [without delete, with delete], captured from the base page
// (origin/studio-v4-dev-preparation-code at 68e3396, before this change).
const BASE_HASHES = {
  'complete, description repeats the title': ['cfa6e32f369a5074cf353190d7d620ef9c653e9339c9ebf7419266477c418fd4', '17c61fe256194492d8c472ce9d54d881717314b412695a02c9e0397732dc3b94'],
  'in progress at stage 4, description repeats the title': ['99a41fdaa272fd67f1597135df2477552e7545afdcc87fa860cd96f927bf1826', '02c8b54559a72fbda9e05361cda254fa825a4b2ba7add28568ebee56ead2eb69'],
  'outline preview only, distinct description': ['1d7ca1108e372c328b5d09b862622b0968ef8859bc028b9682e8ead32a8ace2f', 'd87c53e96b86d659e6eaf87a59c0e965813069f60601f6738df1ccebcedbbcee'],
  'no description placeholder': ['17d58c089bdc79c6545a78c34373506ee8cd84e40facb8692681dfd34e21abb7', 'bc47ebc5d6b68fe4ebb6e9aafa4925fb9794eee009fdc812860fdf230af36073'],
  'complete, distinct description': ['ac5d5379b27114ece77befc7eb80fd63b2afe4630dd647c963bc3fb7b9c7f9a1', 'c66e4bd69c67865163b8a195ec270fe8fa65389ed6c48435b188d1417ba1c0a2'],
  'refining at stage 5 with tags and no preview': ['7b758ebac722f12a53b2840ed7185e334139cd253adc3de4b001d6115a7d9125', 'c755a615f059080a6e7c74376def110b0baec2ea4165980a93e6edd8a07e4e9c'],
  'long truncated-looking title': ['7bafb126d11c884103638e65d73053a5ebf38f1394741828e069285c9515f54e', '50fbca0e505621b655b1498b6ee341cfac94649eadaf6e0e7e8840ca356b5bfd'],
};

if (process.env.PRINT_GOLDEN) {
  const Card = loadCard({});
  const out = {};
  for (const [name, p] of Object.entries(FIXTURES)) out[name] = [false, true].map(del => sha(serialise(render(Card, p, del))));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

let testCount = 0;
function run(name, fn) {
  testCount += 1;
  try { fn(); } catch (err) { console.error(`FAIL: ${name}`); throw err; }
}

const helpersOff = loadTs('lib/studio-deck-cards.ts', {});
const { deckCardDescription, deckCardStatusLabel, DECK_CARD_NO_DESCRIPTION } = helpersOff;
const OffCard = loadCard({});
const OnCard = loadCard({ [FLAG]: 'true' });

// ---- the flag --------------------------------------------------------------------------------------------------------
run('the flag is read as the exact string "true" in the dashboard and defaults off', () => {
  assert.match(read(PAGE), /process\.env\.NEXT_PUBLIC_STUDIO_DECK_CARDS_V2 === "true"/);
  for (const value of [undefined, '', 'false', '1', 'TRUE', 'True', ' true', 'true ']) {
    const Card = loadCard(value === undefined ? {} : { [FLAG]: value });
    const html = serialise(render(Card, FIXTURES['complete, description repeats the title'], false));
    assert.equal(html, serialise(render(OffCard, FIXTURES['complete, description repeats the title'], false)), JSON.stringify(value));
    assert.match(html, /Stage 6: Complete/);
  }
  assert.doesNotMatch(serialise(render(OnCard, FIXTURES['complete, description repeats the title'], false)), /Stage 6/);
});

run('the flag is documented in .env.example, default "false"', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_DECK_CARDS_V2="false"$/m);
});

// ---- flag off is the base --------------------------------------------------------------------------------------------
run('flag off: every card renders byte-for-byte as the base did (hash-identical, with and without delete)', () => {
  for (const [name, presentation] of Object.entries(FIXTURES)) {
    const hashes = [false, true].map(del => sha(serialise(render(OffCard, presentation, del))));
    assert.deepEqual(hashes, BASE_HASHES[name], name);
  }
});

run('flag off still shows the stage badge, the raw status and the repeated description', () => {
  const text = visibleText(render(OffCard, FIXTURES['in progress at stage 4, description repeats the title'], false));
  assert.ok(text.join('').includes('Stage 4: Preview Ready'));
  assert.ok(text.includes('in-progress'));
  assert.equal(text.filter(part => part === FIXTURES['in progress at stage 4, description repeats the title'].title).length, 2);
});

// ---- flag on ---------------------------------------------------------------------------------------------------------
const STAGE_WORDS = /Stage\s*\d|Preview Ready|Refining|Outlining|Planning|Starting|Unknown/;

run('flag on: no card, in any state, shows an internal stage label', () => {
  for (const [name, presentation] of Object.entries(FIXTURES)) {
    for (const del of [false, true]) {
      const text = visibleText(render(OnCard, presentation, del)).join(' | ');
      assert.doesNotMatch(text, STAGE_WORDS, name);
      assert.doesNotMatch(serialise(render(OnCard, presentation, del)), /Stage \d/, name);
    }
  }
});

run('flag on: the title is on the card once; a description that repeats it is dropped', () => {
  for (const name of ['complete, description repeats the title', 'in progress at stage 4, description repeats the title', 'long truncated-looking title']) {
    const presentation = FIXTURES[name];
    const parts = visibleText(render(OnCard, presentation, true));
    assert.equal(parts.filter(part => part === presentation.title).length, 1, name);
    assert.doesNotMatch(serialise(render(OnCard, presentation, true)), /<CardDescription/, name);
  }
});

run('flag on: a description that says more than the title is kept, with its markup unchanged', () => {
  for (const name of ['outline preview only, distinct description', 'complete, distinct description']) {
    const presentation = FIXTURES[name];
    const html = serialise(render(OnCard, presentation, false));
    assert.ok(html.includes(`<CardDescription className="line-clamp-2 mt-1">${presentation.description}</CardDescription>`), name);
  }
});

run('flag on: the placeholder description is not shown', () => {
  const html = serialise(render(OnCard, FIXTURES['no description placeholder'], false));
  assert.ok(!html.includes('No description available'));
  assert.doesNotMatch(html, /<CardDescription/);
});

run('flag on: one plain status badge, same colour class and data attribute as before', () => {
  const cases = [
    ['complete, description repeats the title', 'completed', 'Complete'],
    ['in progress at stage 4, description repeats the title', 'in-progress', 'In progress'],
    ['outline preview only, distinct description', 'in-progress', 'Outline preview'],
    ['refining at stage 5 with tags and no preview', 'in-progress', 'In progress'],
  ];
  for (const [name, status, label] of cases) {
    const html = serialise(render(OnCard, FIXTURES[name], false));
    assert.ok(html.includes(`<Badge className="color-${status}" data-studio-deck-status="${status}">${label}</Badge>`), `${name}: ${label}`);
    assert.equal((html.match(/<Badge /g) || []).length, 1 + FIXTURES[name].tags.slice(0, 3).length + (FIXTURES[name].tags.length > 3 ? 1 : 0), name);
  }
});

run('flag on: everything else on the card is untouched (preview, links, menu, meta, tags)', () => {
  // Same card with the two flagged parts cut out of both renders must be identical.
  const strip = html => html
    .replace(/<CardDescription[^>]*>.*?<\/CardDescription>/, '')
    .replace(/<Badge className="color-[^"]*" data-studio-deck-status="[^"]*">.*?<\/Badge>/, '<STATUS>')
    .replace(/<Badge className="text-xs" variant="outline">Stage .*?<\/Badge>/, '');
  for (const [name, presentation] of Object.entries(FIXTURES)) {
    for (const del of [false, true]) {
      assert.equal(strip(serialise(render(OnCard, presentation, del))), strip(serialise(render(OffCard, presentation, del))), name);
    }
  }
});

// ---- helpers ---------------------------------------------------------------------------------------------------------
run('deckCardStatusLabel maps only to words a user would use', () => {
  assert.equal(deckCardStatusLabel({ status: 'completed', finalPresentationUrl: 'u' }), 'Complete');
  assert.equal(deckCardStatusLabel({ status: 'completed' }), 'Complete');
  assert.equal(deckCardStatusLabel({ status: 'in-progress', finalPresentationUrl: 'u' }), 'In progress');
  assert.equal(deckCardStatusLabel({ status: 'in-progress', finalPresentationUrl: 'u', strawmanPreviewUrl: 's' }), 'In progress');
  assert.equal(deckCardStatusLabel({ status: 'in-progress', strawmanPreviewUrl: 's' }), 'Outline preview');
  assert.equal(deckCardStatusLabel({ status: 'in-progress', finalPresentationUrl: null, strawmanPreviewUrl: null }), 'In progress');
  assert.equal(deckCardStatusLabel({ status: 'draft' }), 'Draft');
  for (const status of ['draft', 'in-progress', 'completed']) {
    for (const finalPresentationUrl of [null, 'f']) for (const strawmanPreviewUrl of [null, 's']) {
      assert.doesNotMatch(deckCardStatusLabel({ status, finalPresentationUrl, strawmanPreviewUrl }), STAGE_WORDS);
    }
  }
});

run('deckCardDescription drops repeats of the title and placeholders', () => {
  const t = 'Rolling out AI demand forecasting to 40 stores';
  const dropped = [
    t, `  ${t}  `, t.toUpperCase(), t.toLowerCase(), `${t}.`, `${t}…`, `${t}...`, t.replace(/ /g, '  '), `${t}\n`,
    DECK_CARD_NO_DESCRIPTION, '', '   ', null, undefined, '...', '—',
  ];
  for (const description of dropped) assert.equal(deckCardDescription(t, description), null, JSON.stringify(description));
  // either side cut short with an ellipsis
  assert.equal(deckCardDescription('Adopting AI-driven demand forecasting in mi…', 'Adopting AI-driven demand forecasting in mid-size retail'), null);
  assert.equal(deckCardDescription('Adopting AI-driven demand forecasting in mid-size retail', 'Adopting AI-driven demand forecasting in mi...'), null);
  assert.equal(deckCardDescription('Q3 Board Update', 'Q3 board update!'), null);
});

run('deckCardDescription keeps a description that adds something (trimmed, otherwise as typed)', () => {
  const t = 'Rolling out AI demand forecasting to 40 stores';
  assert.equal(deckCardDescription(t, 'Make this for the regional ops review'), 'Make this for the regional ops review');
  assert.equal(deckCardDescription(t, `  ${t} for the board  `), `${t} for the board`);
  assert.equal(deckCardDescription('Q3', 'Q3 board update for finance'), 'Q3 board update for finance');
  assert.equal(deckCardDescription('Pricing', 'Pricing review'), 'Pricing review');
  assert.equal(deckCardDescription('Pricing review', 'Pricing'), 'Pricing');
  assert.equal(deckCardDescription('Untitled Presentation', 'Hello! Build me a deck.'), 'Hello! Build me a deck.');
  assert.equal(deckCardDescription('', 'Only a description'), 'Only a description');
});

run('the helper module has no side effects and no flag of its own (the dashboard owns the switch)', () => {
  const source = read('lib/studio-deck-cards.ts');
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /process\.env|fetch\(|import /);
});

run('search still matches the original description (the data is not rewritten, only the render)', () => {
  const source = read(PAGE);
  assert.match(source, /p\.description\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\)/);
  assert.match(source, /description: getFirstMessage\(session\)/);
  assert.match(source, /currentStage: session\.currentStage/);
});

console.log(`test-studio-deck-cards-v2: ${testCount} tests passed`);
