// PL-42 (ARCH-PLATFORM card 07:40Z, CHIEF-ARCH CA-72/CA-73): the places that tell a person a deck's research switches are locked say ONE thing,
// and it is true on a deck where research did not run (a research-off deck, a deck kept on the brief-only path): the lock follows the outline
// (has_strawman), not research having run. The one wording, with the word the Studio's own control carries ("New deck"):
//   "Locked for this deck: its outline is already written. Start a new deck to change these."
// Pinned exactly in the three places the card names: (1) the research-options panel notice in components/builder/chat-input.tsx; (2) the chip /
// switch tooltip, lockedNote, in lib/studio-chat-clean.ts AND lib/studio-research-switch.ts; (3) the chat command reply, researchLockedBody, in
// lib/studio-chat-commands.ts. And no string anywhere in app/, components/ or lib/ says "research already ran" (the one place that did and is not
// on the card, the /kg lock in lib/studio-chat-parity-workspace.ts, is reworded too (ARCH-PLATFORM 09:22Z), so KNOWN_REMAINING is empty and the count is zero).
//   node scripts/test-studio-pl42-locked-copy.mjs        (plain node, offline: the REAL modules transpiled and run; mutants change the sources in memory only)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const ONE = 'Locked for this deck: its outline is already written. Start a new deck to change these.'
/** Strings that still say "research already ran" (path -> why). EMPTY: the /kg lock (kgLocked), found by PL-42 and ruled in by ARCH-PLATFORM 09:22Z, now says its own 53-character form. */
const KNOWN_REMAINING = {}
const KG_LOCKED = 'Locked for this deck: its outline is already written.'   // the /kg lock: no "start a new deck" clause, that file caps its fixed words at 60 characters

let checks = 0
const check = (name, fn) => { checks++; fn(); console.log(`PASS ${name}`) }
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    assert.equal((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${rel} does not transpile`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
const STUBS = {
  'next/navigation': { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/builder' },
  'next-auth/react': { useSession: () => ({ data: null, status: 'unauthenticated', update: async () => null }), signIn: async () => {}, signOut: async () => {}, SessionProvider: ({ children }) => children },
}
/** The real sources, or an in-memory override of one (the mutants): rel -> text. */
function sourceOf(rel, overrides) {
  if (rel in overrides) return overrides[rel]
  const file = path.join(repoRoot, rel)
  return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null
}
function load(rel, overrides = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const stem = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (/\.tsx?$/.test(stem + ext) && sourceOf(stem + ext, overrides) !== null) return stem + ext
    throw new Error(`unresolved ${spec} from ${from}`)
  }
  const get = r => {
    if (cache.has(r)) return cache.get(r).exports
    const module = { exports: {} }; cache.set(r, module)
    const require = spec => spec in STUBS ? STUBS[spec] : spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? get(resolve(spec, r)) : nodeRequire(spec)
    new Function('module', 'exports', 'require', 'process', compile(r, sourceOf(r, overrides)))(module, module.exports, require, { env: {} })
    return module.exports
  }
  return get(rel)
}
const walk = dir => fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true }).flatMap(e => {
  const rel = path.posix.join(dir, e.name)
  return e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(rel)) : /\.(ts|tsx)$/.test(e.name) ? [rel] : []
})
const SOURCE_FILES = ['app', 'components', 'lib'].flatMap(walk)

/** The failures of the pins (tagged P1..P4) against the real sources, or against sources with in-memory overrides. */
function failures(overrides = {}) {
  const out = []
  // P1: the research-options panel notice in the composer: its JSX text, whitespace collapsed, is the one wording, once
  const chatInput = sourceOf('components/builder/chat-input.tsx', overrides)
  const notice = /data-studio-v4-type-role="research-notice"[^>]*>([\s\S]*?)<\/div>/.exec(chatInput)
  if (!notice) out.push('P1 the research notice is not found in chat-input.tsx')
  else if (notice[1].replace(/\s+/g, ' ').trim() !== ONE) out.push(`P1 the panel notice reads ${JSON.stringify(notice[1].replace(/\s+/g, ' ').trim())}`)
  if (chatInput.split('research-notice').length !== 2) out.push('P1 there is not exactly one research-notice in chat-input.tsx')
  // P2: the chip / switch tooltip, both places; P3: the chat command reply (and its title stays)
  const clean = load('lib/studio-chat-clean.ts', overrides).CHAT_CLEAN_WORDS, switchCopy = load('lib/studio-research-switch.ts', overrides).RESEARCH_COPY
  if (clean.lockedNote !== ONE) out.push(`P2 CHAT_CLEAN_WORDS.lockedNote reads ${JSON.stringify(clean.lockedNote)}`)
  if (switchCopy.lockedNote !== ONE) out.push(`P2 RESEARCH_COPY.lockedNote reads ${JSON.stringify(switchCopy.lockedNote)}`)
  const commands = load('lib/studio-chat-commands.ts', overrides).CHAT_COMMANDS_WORDS
  if (commands.researchLockedBody !== ONE) out.push(`P3 researchLockedBody reads ${JSON.stringify(commands.researchLockedBody)}`)
  if (commands.researchLockedTitle !== 'Locked for this deck') out.push(`P3 researchLockedTitle reads ${JSON.stringify(commands.researchLockedTitle)}`)
  // P5: the /kg lock (WORKSPACE_WORDS.kgLocked) reads its own 53-character form, inside the 60-character cap of that file's words
  const kg = load('lib/studio-chat-parity-workspace.ts', overrides).WORKSPACE_WORDS.kgLocked
  if (kg !== KG_LOCKED) out.push(`P5 WORKSPACE_WORDS.kgLocked reads ${JSON.stringify(kg)}`)
  if (typeof kg === 'string' && kg.length > 60) out.push(`P5 WORKSPACE_WORDS.kgLocked is ${kg.length} characters (the cap is 60)`)
  // P4: no source in app/, components/ or lib/ says "research already ran" (any case)
  const found = {}
  for (const rel of SOURCE_FILES) { const n = (sourceOf(rel, overrides).match(/research already ran/gi) || []).length; if (n) found[rel] = n }
  for (const rel of Object.keys(overrides)) if (!(rel in found) && /research already ran/i.test(overrides[rel])) found[rel] = (overrides[rel].match(/research already ran/gi) || []).length
  for (const rel of Object.keys(found)) if (!(rel in KNOWN_REMAINING)) out.push(`P4 ${rel} says "research already ran" (${found[rel]}x)`)
  for (const rel of Object.keys(KNOWN_REMAINING)) if (!(rel in found)) out.push(`P4 ${rel} no longer says it: remove it from KNOWN_REMAINING (${KNOWN_REMAINING[rel]})`)
  return out
}

check('P1 the research-options panel notice (components/builder/chat-input.tsx) reads exactly the one wording', () => assert.deepEqual(failures().filter(x => x.startsWith('P1')), []))
check('P2 the chip and switch tooltips (CHAT_CLEAN_WORDS.lockedNote, RESEARCH_COPY.lockedNote) read exactly the one wording', () => assert.deepEqual(failures().filter(x => x.startsWith('P2')), []))
check('P3 the chat command reply (CHAT_COMMANDS_WORDS.researchLockedBody) reads exactly the one wording; its title stays "Locked for this deck"', () => assert.deepEqual(failures().filter(x => x.startsWith('P3')), []))
check('P4 no string in app/, components/ or lib/ says "research already ran" (any case), but the ones named in KNOWN_REMAINING', () => assert.deepEqual(failures().filter(x => x.startsWith('P4')), []))
check('P5 the /kg lock (lib/studio-chat-parity-workspace.ts kgLocked) reads its own 53-character form, inside the 60-character cap', () => assert.deepEqual(failures().filter(x => x.startsWith('P5')), []))
check('the one wording itself: it says the outline is written (not that research ran) and names the Studio\'s own control word, "new deck"', () => {
  assert.ok(/outline is already written/.test(ONE) && /Start a new deck/.test(ONE) && !/research/i.test(ONE) && !/session/i.test(ONE))
})

// ---------------------------------------------------------------------------------------------------------------- mutants (in memory only)
const real = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const MUTANTS = [
  ['the panel notice reverts to the old words', 'P1', { 'components/builder/chat-input.tsx': real('components/builder/chat-input.tsx').replace(ONE, 'Locked for this deck — research already ran. Start a new\n                      session to change these.') }],
  ['the panel notice loses the word "deck"', 'P1', { 'components/builder/chat-input.tsx': real('components/builder/chat-input.tsx').replace('Start a new deck to change these.', 'Start a new to change these.') }],
  ['the chip tooltip reverts', 'P2', { 'lib/studio-chat-clean.ts': real('lib/studio-chat-clean.ts').replace(`lockedNote: '${ONE}'`, "lockedNote: 'Locked for this deck — research already ran'") }],
  ['the switch tooltip reverts', 'P2', { 'lib/studio-research-switch.ts': real('lib/studio-research-switch.ts').replace(`lockedNote: '${ONE}'`, "lockedNote: 'Locked for this deck — research already ran'") }],
  ['the switch tooltip says "new session"', 'P2', { 'lib/studio-research-switch.ts': real('lib/studio-research-switch.ts').replace('Start a new deck to change these.', 'Start a new session to change these.') }],
  ['the chat command reply reverts', 'P3', { 'lib/studio-chat-commands.ts': real('lib/studio-chat-commands.ts').replace(`researchLockedBody: '${ONE}'`, "researchLockedBody: 'Research already ran, so these switches can no longer change. Start a new session to change them.'") }],
  ['the chat command title changes', 'P3', { 'lib/studio-chat-commands.ts': real('lib/studio-chat-commands.ts').replace("researchLockedTitle: 'Locked for this deck'", "researchLockedTitle: 'Research is locked'") }],
  ['a new string anywhere says "Research already ran"', 'P4', { 'lib/studio-chat-clean.ts': `${real('lib/studio-chat-clean.ts')}\nexport const PL42_MUTANT = 'Research already ran'\n` }],
  ['a new string says it in lower case in a component', 'P4', { 'components/builder/studio-composer-hint.tsx': "export const X = 'locked: research already ran'\n" }],
  ['the /kg lock goes back to the old words', 'P4', { 'lib/studio-chat-parity-workspace.ts': real('lib/studio-chat-parity-workspace.ts').replace(`kgLocked: '${KG_LOCKED}'`, "kgLocked: 'Locked: research already ran for this deck.'") }],
  ['the /kg lock goes back to the old words (also fails its own pin)', 'P5', { 'lib/studio-chat-parity-workspace.ts': real('lib/studio-chat-parity-workspace.ts').replace(`kgLocked: '${KG_LOCKED}'`, "kgLocked: 'Locked: research already ran for this deck.'") }],
  ['the /kg lock takes the long wording (over the 60-character cap)', 'P5', { 'lib/studio-chat-parity-workspace.ts': real('lib/studio-chat-parity-workspace.ts').replace(`kgLocked: '${KG_LOCKED}'`, `kgLocked: '${ONE}'`) }],
]
for (const [name, point, overrides] of MUTANTS) check(`MUTANT is caught by ${point}: ${name}`, () => {
  for (const [rel, text] of Object.entries(overrides)) if (fs.existsSync(path.join(repoRoot, rel))) assert.notEqual(text, real(rel), `the mutation changed ${rel}`)
  assert.ok(failures(overrides).some(x => x.startsWith(point)), `${point} did not fail`)
})
console.log(`\nPASS: ${checks} checks passed, 0 failed (${MUTANTS.length} mutants caught); the one wording: ${JSON.stringify(ONE)}`)
