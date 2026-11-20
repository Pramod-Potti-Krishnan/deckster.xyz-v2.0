// AVATAR-W5 (M11, Step A): the WIRING proof of "My companions" (flag NEXT_PUBLIC_STUDIO_MY_COMPANIONS, exact "true", default off): everything that keeps the change inert and registered. The behaviour has its own proofs
// (scripts/test-studio-avatar-pack-route.mjs: the two server routes and the link minter; scripts/test-studio-my-companions.mjs: the player, the hook, the page).
//   node scripts/test-studio-my-companions-wiring.mjs        Plain node: reads files and git, transpiles nothing, no network.
//   A. only marked lines: every line this change adds to an existing file carries the marker MY-COMPANIONS; a base line is rewritten only where a [has, was] pair says so; the strip gives dev's file byte for byte, twice over;
//      the files this change must not touch (the Builder page, the chat input, the composer, the middleware, the next config, the avatar spawn mock) are dev's byte for byte;
//   B. the older proofs this change teaches gain only marked lines (the first-parent subject filter of the two that read it, and the read hooks of the proofs that hold the voice-call files to dev's bytes) and are dev's without them;
//   C. .env.example: one block at the end, "false", naming no other flag; the registry: three lines at the true end of each list, each marked LATER-CHANGE; the strips commute;
//   D. own-commit scope by the subject prefix "My companions:" on the first-parent line, the commit message, a secret scan of the added lines;
//   E. the flag is read from one literal env name, and only the new lib reads it; the server variables are named only by the server files;
//   F. mutants: each is one edit of the real text, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as stripModule from './studio-my-companions-strip.mjs'
import * as heroOnlyStrip from './studio-replace-picture-hero-only-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, MY_COMPANIONS_FLAGS: FLAGS, MY_COMPANIONS_MARKER_RE: MARKER_RE, MY_COMPANIONS_SUBJECT: SUBJECT, MY_COMPANIONS_FILES: APP_FILES, MY_COMPANIONS_NEW_FILES: NEW_FILES, MY_COMPANIONS_EDITS: EDITS,
  MY_COMPANIONS_PIN_EDITS: PIN_EDITS, MY_COMPANIONS_PIN_FILES: PIN_FILES, MY_COMPANIONS_PIN_MARK: PIN_MARK, MY_COMPANIONS_SCOPE_FILES: SCOPE, MY_COMPANIONS_ENV_BLOCK: ENV_BLOCK } = stripModule
const STRIP_FN = stripModule.stripMyCompanions
const FLAG = FLAGS[0]

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

const ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs'
const UNTOUCHED = ['app/builder/page.tsx', 'components/builder/chat-input.tsx', 'middleware.ts', 'next.config.mjs', 'components/studio-avatar-spawn/steps.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn-app.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn.css', 'lib/studio-avatar-spawn.ts', 'components/builder/voice-call/companion-player.tsx', 'components/builder/voice-call/layered-face.ts', 'lib/studio-thinking-levels.ts', 'lib/studio-upload-formats.ts']
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-|[A-Za-z]+:\/\/[^\s/:@]+:[^\s/:@]+@)/

// ============================================================================================================================================
// A. only marked lines
// ============================================================================================================================================
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
/** What the strips of the changes registered AFTER this one do to a text (they are other changes' lines and stay when only this strip runs). */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...PIN_FILES, ENV, REGISTRY].filter(rel => fs.existsSync(path.join(root, rel))).map(rel => [rel, read(rel)]))
function insertionChecks(texts = TEXTS, strip = STRIP_FN, edits = EDITS, readNow = read) {
  assert.ok(APP_FILES.length > 0 && APP_FILES.every(rel => rel in edits && edits[rel].length > 0), 'every existing file this change edits has at least one edit pair')
  for (const rel of APP_FILES) {
    const mine = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), mine)
    assert.equal(strip(rel, mine), baseText(rel), `${rel}: without this change's lines the file is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, mine)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    const wasLines = edits[rel].flatMap(([, was]) => was.split('\n').filter((line, at, all) => !(at === all.length - 1 && line === '')))
    assert.deepEqual([...diff.removed].sort(), [...wasLines].sort(), `${rel}: the base lines that are gone are exactly the ones a pair puts back`)
    for (const [has, was] of edits[rel]) assert.ok(has.endsWith('\n') && has.split('\n').filter(Boolean).every(line => MARKER_RE.test(line)) && (was === '' || was.endsWith('\n')), `${rel}: a pair is whole marked lines and what they replaced`)
  }
  assert.equal(strip(APP_FILES[0], 5), 5, 'a text that is not a string comes back as it is'); assert.equal(strip('components/presentation-viewer.tsx', 'x'), 'x', 'a file this change does not own comes back as it is')
  // the marker is a WHOLE token
  assert.ok(MARKER_RE.test('// MY-COMPANIONS') && !MARKER_RE.test('// X-MY-COMPANIONS') && !MARKER_RE.test('// MY-COMPANIONS-X') && !MARKER_RE.test('// MY_COMPANIONS'), 'the marker is a whole token')
  // the files this change must not touch are dev's, byte for byte
  for (const rel of UNTOUCHED) {
    const inBase = (() => { try { git('cat-file', '-e', `${BASE_COMMIT}:${rel}`); return true } catch { return false } })()
    if (inBase) assert.equal(readNow(rel), baseText(rel), `${rel}: not touched by this change (byte for byte dev's)`)
    else assert.ok(!fs.existsSync(path.join(root, rel)), `${rel}: dev has no such file (another change's, not yet merged): this change does not create it`)
  }
}
function newFilesChecks(texts = TEXTS) {
  for (const rel of NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), `${rel}: the new file is there`)
  for (const rel of NEW_FILES) assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), `${rel}: it is new (dev has no such file)`)
  for (const rel of [...APP_FILES, ...NEW_FILES]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
}

// ============================================================================================================================================
// B. the older proofs this change teaches
// ============================================================================================================================================
function pinChecks(texts = TEXTS, strip = STRIP_FN, pinEdits = PIN_EDITS) {
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now), gained = pinEdits[rel].length
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line(s) and loses none`)
    for (const line of diff.added) assert.ok(line.includes(PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const [has, was] of pinEdits[rel]) assert.ok(was === '' && has.includes(PIN_MARK) && has.endsWith('\n') && !has.slice(0, -1).includes('\n'), `${rel}: a pin pair is one marked line and nothing put back`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^My companions:'), `${rel}: the splice names this change's own subject`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripMyCompanions(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: a read hook uses this change's own strip, never the registry`)
  }
  for (const rel of ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']) assert.ok(PIN_FILES.includes(rel), `${rel}: taught the subject filter, as every later change does`)
}

// ============================================================================================================================================
// C. .env.example and the registry
// ============================================================================================================================================
function envChecks(texts = TEXTS, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.equal((env.match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1, `.env.example assigns ${FLAG} once`); assert.match(block, new RegExp(`^${FLAG}="false"$`, 'm'), `${FLAG} is documented as "false"`)
  assert.ok(block.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && block.split('\n').filter(line => line.startsWith('#')).length >= 2 && block.endsWith(`${FLAG}="false"\n`), 'the block is comments and one assignment, which ends it')
  assert.ok(block.includes('exact value "true"') && block.includes('default off') && block.includes('AVATAR_COMPANIONS_REGISTRY') && block.includes('AVATAR_PACK_BUCKET'), 'the block names the exact value, the default and the two server variables the owner must set')
  for (const other of ['NEXT_PUBLIC_STUDIO_V4_SHELL', 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN', 'NEXT_PUBLIC_STUDIO_VOICE_CALL', 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION']) assert.ok(!block.includes(other), `the block names only its own flag, not ${other} (other proofs count the others' names in the file)`)
  assert.doesNotMatch(block, SECRET, 'the block holds no secret')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG), false, 'the registry takes the block out of .env.example'); assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO MY COMPANIONS'), false, 'and its comments with it')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}
const REG_MARK = '// LATER-CHANGE: AVATAR-W5, My companions'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'MY_COMPANIONS_SCOPE_FILES', LATER_ENV_BLOCKS: 'MY_COMPANIONS_ENV_BLOCK', LATER_STRIPS: 'stripMyCompanions' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean), at = rows.findIndex(line => line.includes('studio-my-companions-strip.mjs')), hero = rows.findIndex(line => line.includes('studio-replace-picture-hero-only-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(at > hero && hero > 0, `${list}: it comes after the hero-only Replace picture's line (the last one before it when this was written; a later change's line may follow)`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`); assert.equal((text.slice(start, end).match(/studio-my-companions-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    assert.ok(rows[at].includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(rows[at]), `${list}: the line carries the registry marker`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-my-companions-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.ok(registered.every(line => diff.added.includes(line)), 'and the three are among the lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered'); assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.indexOf(STRIP_FN) > registry.LATER_STRIPS.indexOf(heroOnlyStrip.stripReplacePictureHeroOnly), 'the strip runs after the hero-only Replace picture\'s (the order the changes were stacked)')
  assert.ok(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) > registry.LATER_ENV_BLOCKS.indexOf(heroOnlyStrip.REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK), 'and its block follows the hero-only\'s')
  // an older proof that holds an app file to dev's reads it through the registry: it is dev's
  for (const rel of [...APP_FILES, ...PIN_FILES]) assert.equal(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is dev's (older proofs read it like that)`)
  // the neighbouring change's strip leaves this one's lines alone, in either order
  for (const rel of [...APP_FILES, ...PIN_FILES]) {
    const now = read(rel), a = STRIP_FN(rel, heroOnlyStrip.stripReplacePictureHeroOnly(rel, now)), b = heroOnlyStrip.stripReplacePictureHeroOnly(rel, STRIP_FN(rel, now))
    assert.equal(a, b, `${rel}: the strips commute`)
  }
}

// ============================================================================================================================================
// D. scope, commits, secrets
// ============================================================================================================================================
const subjectOf = commit => git('log', '-1', '--format=%s', commit)
/** This change's commits: on the first-parent line, by the subject prefix. Once the gate has merged the branch they sit on the merge's second parent and the first-parent line has none: then there is nothing of its own to read and the proof says so. */
const ownCommits = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(commit => subjectOf(commit).startsWith(SUBJECT))
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
function commitChecks() {
  const commits = ownCommits('--first-parent')
  if (commits.length === 0) { console.log('NOTE scope: no commit of this change on the first-parent line (not committed yet, or merged into dev: its commits are on the second parent); the strip, source and registry checks above cover the files'); return }
  scopeCheck(commits)
  for (const commit of commits) {
    assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
    assert.doesNotMatch(git('show', '--format=%B', commit), SECRET, `commit ${commit.slice(0, 8)}: no secret in the message or the diff`)
    const added = git('show', '--format=', '-U0', commit).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')); for (const line of added) assert.doesNotMatch(line, SECRET, `commit ${commit.slice(0, 8)}: no secret in an added line`)
  }
  assert.deepEqual([...touchedFiles(commits)].filter(rel => !registry.LATER_CHANGE_FILES.has(rel)), [], 'every file the commits touch is registered')
}

// ============================================================================================================================================
// E. one literal read; the server variables stay on the server
// ============================================================================================================================================
const FLAG_LIB = 'lib/studio-my-companions.ts'
const SERVER_ONLY_NAMES = ['AVATAR_COMPANIONS_REGISTRY', 'AVATAR_PACK_BUCKET', 'AVATAR_PACK_LINK_TTL_SECONDS', 'AVATAR_PACK_DEV_STANDIN', 'SUPABASE_SERVICE_ROLE_KEY']
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', '--cached', '--others', '--exclude-standard', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel), reads = (text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length
    assert.equal(reads, rel === FLAG_LIB ? 1 : 0, `${rel}: ${rel === FLAG_LIB ? 'reads' : 'does not read'} ${FLAG} ${rel === FLAG_LIB ? 'once' : 'itself'}`)
    // a browser-side file never names a server variable
    const browserSide = !rel.startsWith('lib/server/') && !rel.startsWith('app/api/')
    if (browserSide) for (const name of SERVER_ONLY_NAMES) if (rel !== 'lib/supabase-storage.ts' && !(name === 'SUPABASE_SERVICE_ROLE_KEY' && !/avatar|companion/i.test(rel))) assert.ok(!text.includes(name), `${rel}: a browser-side file does not name ${name}`)
  }
  const lib = texts[FLAG_LIB] ?? read(FLAG_LIB); assert.equal((lib.match(/process\.env\.[A-Z]/g) || []).length, 2, 'the lib reads two env names (the shell and its own flag), each once')
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. only marked lines: the strip gives dev\'s files byte for byte; the files this change must not touch are dev\'s', () => insertionChecks())
await check('A2. the new files exist, are new, and hold no secret', () => newFilesChecks())
await check('B. the older proofs this change teaches: only marked lines, dev\'s without them', () => pinChecks())
await check('C1. .env.example: one block at the end, "false", naming no other flag', () => envChecks())
await check('C2. the registry: three lines at the end of each list, each marked LATER-CHANGE; the strips commute', () => registryChecks())
await check('D. own-commit scope by the subject prefix on the first-parent line; the commit message; secrets', () => commitChecks())
await check('E. the flag is read from one literal env name, only by the lib; no browser-side file names a server variable', () => oneReadChecks())

// ---- F. mutants ----------------------------------------------------------------------------------------------------------------------------------------------------------
const appFile = APP_FILES[0], firstEdit = EDITS[appFile]?.[0]
await mutant('strip: an edit pair missing', () => { const edits = { ...EDITS, [appFile]: EDITS[appFile].slice(1) }; return insertionChecks(TEXTS, (rel, text) => (typeof text === 'string' && rel in edits ? edits[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) : text), edits) })
await mutant('source: an added line without the marker', () => { const rel = appFile, line = firstEdit[0].split('\n')[0]; return insertionChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], line, line.replace(/\s*\/\/ .*MY-COMPANIONS.*$/, '').replace(/\{\/\*.*MY-COMPANIONS.*\*\/\}/, '')) }) })
await mutant('source: a base line lost from an edited file', () => { const rel = appFile, base = baseText(rel), line = base.split('\n').find(l => l.trim().length > 30 && TEXTS[rel].includes(l + '\n') && !firstEdit[1].includes(l)); return insertionChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], line + '\n', '') }) })
await mutant('source: a file this change must not touch is edited', () => insertionChecks(TEXTS, STRIP_FN, EDITS, rel => (rel === 'app/builder/page.tsx' ? baseText(rel) + '// x\n' : read(rel))))
await mutant('env: the flag documented as "true"', () => envChecks({ ...TEXTS, [ENV]: swap(TEXTS[ENV], `${FLAG}="false"`, `${FLAG}="true"`) }, ENV_BLOCK.replace(`${FLAG}="false"`, `${FLAG}="true"`)))
await mutant('env: the block names the voice call flag', () => envChecks(TEXTS, ENV_BLOCK.replace('the call, its', 'NEXT_PUBLIC_STUDIO_VOICE_CALL, its')))
await mutant('env: no blank line before the block', () => envChecks({ ...TEXTS, [ENV]: TEXTS[ENV].replace(`\n\n${ENV_BLOCK}`, `\n${ENV_BLOCK}`) }))
await mutant('env: another line added to .env.example', () => envChecks({ ...TEXTS, [ENV]: TEXTS[ENV] + 'X=1\n' }))
await mutant('env: a line of dev\'s .env.example lost', () => envChecks({ ...TEXTS, [ENV]: TEXTS[ENV].replace(/^[^#\n][^\n]*\n/m, '') }))
await mutant('registry: the strip line missing', () => registryChecks(read(REGISTRY).split('\n').filter(line => !(line.includes('studio-my-companions-strip.mjs') && line.includes('stripMyCompanions'))).join('\n')))
await mutant('registry: the env block line missing', () => registryChecks(read(REGISTRY).split('\n').filter(line => !(line.includes('studio-my-companions-strip.mjs') && line.includes('ENV_BLOCK'))).join('\n')))
await mutant('registry: the files line missing', () => registryChecks(read(REGISTRY).split('\n').filter(line => !(line.includes('studio-my-companions-strip.mjs') && line.includes('SCOPE_FILES'))).join('\n')))
await mutant('registry: a line of dev\'s registry lost', () => registryChecks(read(REGISTRY).replace(/^[^\n]*studio-replace-picture-hero-only-strip\.mjs[^\n]*ENV_BLOCK[^\n]*\n/m, '')))
await mutant('registry: a second files line', () => registryChecks(read(REGISTRY).replace('  // one line per later change, above this comment\n])', `  ...(await import('./studio-my-companions-strip.mjs')).MY_COMPANIONS_SCOPE_FILES, ${REG_MARK}\n  // one line per later change, above this comment\n])`)))
await mutant('pins: a taught line without the pin mark', () => { const rel = PIN_FILES[0], has = PIN_EDITS[rel][0][0]; return pinChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], has, has.replace(PIN_MARK, 'something else')) }) })
await mutant('pins: a taught proof loses a line of its own', () => { const rel = PIN_FILES[0], base = baseText(rel), line = base.split('\n').find(l => l.trim().length > 20 && !l.includes('LATER-CHANGES')); return pinChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], line + '\n', '') }) })
await mutant('pins: a splice that names the wrong subject', () => { const rel = 'scripts/test-studio-deck-sync-truth.mjs'; return pinChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], '^My companions:', '^Avatar spawn mock:') }) })
await mutant('pins: a read hook that goes through the registry', () => { const rel = PIN_FILES.find(r => (TEXTS[r].match(/fs\.readFileSync = /g) || []).length > 0 && TEXTS[r].includes('stripMyCompanions(rel, out)')); if (!rel) throw new SwapError('no read hook in a taught proof'); return pinChecks({ ...TEXTS, [rel]: swap(TEXTS[rel], 'stripMyCompanions(rel, out)', 'stripLaterChanges(rel, out)') }) })
await mutant('scope: a stray file in the scope check', () => scopeCheck([], ['app/builder/page.tsx']))
await mutant('flag: read a second time in another file', () => oneReadChecks({ 'hooks/use-studio-voice-call.ts': read('hooks/use-studio-voice-call.ts') + `\nconst x = process.env.${FLAG}\n` }))
await mutant('flag: the lib does not read it', () => oneReadChecks({ [FLAG_LIB]: read(FLAG_LIB).replace(`process.env.${FLAG}`, 'process.env.NOPE') }))
await mutant('server variable named in a browser-side file', () => oneReadChecks({ 'hooks/use-studio-voice-call.ts': read('hooks/use-studio-voice-call.ts') + '\n// AVATAR_PACK_BUCKET\n' }))

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join(' | ')}`); process.exit(1) }
