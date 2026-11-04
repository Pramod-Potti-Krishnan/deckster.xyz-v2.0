// PROGRAM-1 E5 chat add free slot (NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED, exact "true", default off): a chat add MOVES to a free area of the slide at its own size, never shrunk,
// with its caption row. lib/chat-add-free-slot.ts; one import and one guarded line in hooks/use-textlabs-generation.ts, both marked CHAT-ADD-FREE-SLOT.
//
//   node scripts/test-studio-chat-add-free-slot.mjs     # offline: transpile + vm, the real lib/element-free-spot.ts, a stubbed viewer
//
// Proves:
//  A. flag off: the flag reads true only for "true"; the hook's line runs only behind it; stripped of the marked lines the hook is the base's byte for byte (so with the flag off the hook is the old code path);
//  B. move without shrink: the element goes to the first free spot at its own width and height; no room at full size = untouched (never a smaller box);
//  C. a picture and its caption row move together by the same offset, the pair clear of the slide's boxes; an unreadable caption position keeps both in place;
//  D. a slow viewer (FREE_SPOT_READ_TIMEOUT_MS) is logged once and leaves the params untouched; another failure is not logged as a timeout;
//  E. the house pattern: the newest commit named "Chat add ..." touches only this change's files, the strip gives the base back, .env.example is the base plus the block, three registry lines;
//  F. MUTANTS: each one must be caught by A-E.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(path.join(root, 'package.json'))('typescript')
const LIB = 'lib/chat-add-free-slot.ts'
const HOOK = 'hooks/use-textlabs-generation.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED'
const overrides = new Map()
const read = rel => overrides.has(rel) ? overrides.get(rel) : fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

const warns = []
function load(rel, env = {}, cache = new Map()) {
  if (cache.has(rel)) return cache.get(rel)
  const module = { exports: {} }
  cache.set(rel, module.exports)
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const req = spec => { if (spec.startsWith('@/')) return load(spec.slice(2) + '.ts', env, cache); throw new Error(`unexpected import ${spec} in ${rel}`) }
  vm.runInNewContext(out, { module, exports: module.exports, require: req, process: { env }, console: { ...console, warn: (...a) => warns.push(a.join(' ')), info() {} }, setTimeout, clearTimeout, Promise, Error, Number, Math, Object, Array, JSON, String })
  cache.set(rel, module.exports)
  return module.exports
}

let checks = 0
const ok = (c, label) => { assert.ok(c, label); checks++ }
const eq = (a, b, label) => { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), label); checks++ }

const ctx = (boxes, slideIndex = 1) => ({ success: true, slide_index: slideIndex, elements: boxes.map(([r, c]) => ({ position: { gridRow: r, gridColumn: c } })) })
const viewer = answer => async (action, params) => { assert.equal(action, 'getSlideGenerationContext'); return typeof answer === 'function' ? answer(params) : answer }
const span = v => v.split('/').map(Number)
const overlaps = (a, b) => !(a.c1 <= b.c0 || b.c1 <= a.c0 || a.r1 <= b.r0 || b.r1 <= a.r0)
const rectOf = p => { const [r0, r1] = span(p.gridRow), [c0, c1] = span(p.gridColumn); return { r0, r1, c0, c1 } }

async function suite() {
  // ---- A. flag off
  for (const v of [undefined, 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', '']) {
    const env = v === undefined ? {} : { [FLAG]: v }
    eq(load(LIB, env).CHAT_ADD_FREE_SLOT_ENABLED, false, `flag ${JSON.stringify(v)}: off`)
  }
  eq(load(LIB, { [FLAG]: 'true' }).CHAT_ADD_FREE_SLOT_ENABLED, true, 'flag "true": on')
  const hook = read(HOOK)
  const marked = hook.split('\n').filter(l => strip.CHAT_ADD_FREE_SLOT_MARKER_RE.test(l))
  eq(marked.length, 2, 'hook: two marked lines (the import and the call)')
  const call = marked.find(l => l.includes('applyChatAddFreeSlot('))
  ok(call && /^\s*if \(CHAT_ADD_FREE_SLOT_ENABLED && invocation\?\.kind === 'chat-add' && !refineContext\) \{/.test(call), 'hook: the call runs only behind the flag, for a chat add, never for a refine')
  ok(call.includes('caption: captionInsertParams'), 'hook: the caption row is handed in with its picture')
  const at = hook.indexOf(call), stacking = hook.indexOf('// CHAT-ADD-STACKING'), insert = hook.indexOf("if (captionInsertParams && method === 'insertImage')")
  ok(stacking < at && at < insert, 'hook: the move is decided after the stacking z and before the insert (Layout renders at creation only)')
  const lib = load(LIB, { [FLAG]: 'true' })

  // ---- B. move, never shrink
  const busy = ctx([['4/9', '2/32']]) // a title band across the top of the content area
  let p = { gridRow: '4/10', gridColumn: '2/14', positionWidth: 12, positionHeight: 6 }
  let slot = await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: viewer(busy), slideIndex: 1 })
  ok(slot, 'a free spot is found')
  eq([slot.width, slot.height, p.positionWidth, p.positionHeight], [12, 6, 12, 6], 'moved at its own size')
  const r = rectOf(p)
  eq([r.c1 - r.c0, r.r1 - r.r0], [12, 6], 'the grid box keeps its size')
  ok(!overlaps(r, { r0: 4, r1: 9, c0: 2, c1: 32 }), 'the box is clear of the slide\'s text')
  eq([r.r0, r.c0], [10, 2], 'the first free spot below the band (with its gap)')
  const crowded = ctx([['4/12', '2/32'], ['12/18', '2/24']]) // room only for a smaller box
  p = { gridRow: '4/10', gridColumn: '2/14', positionWidth: 12, positionHeight: 6 }
  const before = { ...p }
  slot = await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: viewer(crowded), slideIndex: 1 })
  eq(slot, null, 'no room at full size: no slot')
  eq(p, before, 'no room at full size: the params are untouched (never shrunk)')
  eq(lib.chooseChatAddSlot([{ startCol: 2, startRow: 4, endCol: 32, endRow: 12 }, { startCol: 2, startRow: 12, endCol: 24, endRow: 18 }], 12, 6), null, 'pure: no smaller box is offered')
  ok(!('FREE_SLOT_SCALES' in lib) && !/0\.4|shrink/i.test(read(LIB).split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('/')).join('\n')), 'the shrink steps are gone')
  p = { gridRow: '4/10', gridColumn: '2/14', positionWidth: 12, positionHeight: 6 }
  eq(await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: viewer(ctx([], 2)), slideIndex: 1 }), null, 'an answer for another slide: untouched')
  eq(await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: null, slideIndex: 1 }), null, 'no viewer: untouched')

  // ---- C. a picture and its caption move together
  let img = { gridRow: '4/14', gridColumn: '2/16', positionWidth: 14, positionHeight: 10 }
  let cap = { gridRow: '14/16', gridColumn: '2/16', positionWidth: 14, positionHeight: 2 }
  const left = ctx([['4/18', '2/16']]) // the left half is taken
  slot = await lib.applyChatAddFreeSlot({ params: img, caption: cap, sendElementCommand: viewer(left), slideIndex: 1 })
  ok(slot, 'picture + caption: moved')
  const ri = rectOf(img), rc = rectOf(cap)
  eq([ri.c1 - ri.c0, ri.r1 - ri.r0, rc.c1 - rc.c0, rc.r1 - rc.r0], [14, 10, 14, 2], 'both keep their size')
  eq([rc.r0 - ri.r0, rc.c0 - ri.c0], [10, 0], 'the caption keeps its place under the picture (same offset)')
  ok(!overlaps(ri, { r0: 4, r1: 18, c0: 2, c1: 16 }) && !overlaps(rc, { r0: 4, r1: 18, c0: 2, c1: 16 }), 'the pair is clear of the slide\'s boxes')
  eq([slot.startCol, slot.startRow], [ri.c0, ri.r0], 'the slot is the picture\'s')
  img = { gridRow: '4/12', gridColumn: '2/16', positionWidth: 14, positionHeight: 8 }; cap = { gridRow: '12/14', gridColumn: '2/16' }
  ok(await lib.applyChatAddFreeSlot({ params: img, caption: cap, sendElementCommand: viewer(ctx([['4/7', '2/32']])), slideIndex: 1 }), 'picture + caption under a title band: moved down')
  eq([img.gridRow, img.gridColumn, cap.gridRow, cap.gridColumn], ['8/16', '2/16', '16/18', '2/16'], 'moved down together: the caption by the same rows as its picture')
  img = { gridRow: '4/14', gridColumn: '2/16', positionWidth: 14, positionHeight: 10 }; cap = { gridRow: 'auto', gridColumn: '2/16' }
  const [i0, c0] = [{ ...img }, { ...cap }]
  eq(await lib.applyChatAddFreeSlot({ params: img, caption: cap, sendElementCommand: viewer(left), slideIndex: 1 }), null, 'an unreadable caption position: no move')
  eq([img, cap], [i0, c0], 'an unreadable caption position: both stay')
  img = { gridRow: '4/14', gridColumn: '2/16', positionWidth: 14, positionHeight: 10 }; cap = { gridRow: '14/18', gridColumn: '2/16' }
  const [i1, c1] = [{ ...img }, { ...cap }]
  eq(await lib.applyChatAddFreeSlot({ params: img, caption: cap, sendElementCommand: viewer(ctx([['4/18', '2/20']])), slideIndex: 1 }), null, 'no room for the pair: no move')
  eq([img, cap], [i1, c1], 'no room for the pair: both stay (never split, never shrunk)')

  // ---- D. a slow viewer is logged
  warns.length = 0
  p = { gridRow: '4/10', gridColumn: '2/14', positionWidth: 12, positionHeight: 6 }
  const slowBefore = { ...p }
  eq(await Promise.race([lib.applyChatAddFreeSlot({ params: p, sendElementCommand: () => new Promise(() => {}), slideIndex: 1, timeoutMs: 15 }), new Promise(resolve => setTimeout(() => resolve('hung'), 500))]), null, 'slow viewer: no slot, within the timeout')
  eq(p, slowBefore, 'slow viewer: untouched')
  eq(warns.length, 1, 'slow viewer: one log line')
  ok(/timed out/.test(warns[0]) && /15 ms/.test(warns[0]) && /FREE_SPOT_READ_TIMEOUT_MS/.test(warns[0]), 'the line says the read timed out, after how long, and names the timeout')
  warns.length = 0
  eq(await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: async () => { throw new Error('viewer gone') }, slideIndex: 1, timeoutMs: 15 }), null, 'a failed read: no slot')
  eq(warns, [], 'a failed read is not logged as a timeout')
  eq(await lib.applyChatAddFreeSlot({ params: p, sendElementCommand: viewer(busy), slideIndex: 1 }) !== null, true, 'a fast viewer still moves')
  eq(warns, [], 'a fast viewer logs nothing')
}

// ---- E. the house pattern
const strip = await import('./studio-chat-add-free-slot-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const OWN = (() => { try { return git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Chat add', 'HEAD').trim() || null } catch { return null } })()
function housePattern(stripFn) {
  ok(OWN, 'scope: a commit named "Chat add ..." is in HEAD')
  ok(git('log', '-1', '--format=%s', OWN).startsWith('Chat add'), 'scope: the commit is named "Chat add ..."')
  const own = git('diff-tree', '--no-commit-id', '--name-only', '-r', OWN).split('\n').filter(Boolean)
  eq(own.filter(rel => !strip.CHAT_ADD_FREE_SLOT_SCOPE_FILES.has(rel)), [], 'scope: the own commit touches only this change\'s files')
  eq(git('diff', '--name-only', `${strip.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean).filter(rel => !strip.CHAT_ADD_FREE_SLOT_SCOPE_FILES.has(rel)), [], 'scope: BASE..own touches only this change\'s files')
  for (const rel of strip.CHAT_ADD_FREE_SLOT_FILES) {
    const head = git('show', `${OWN}:${rel}`), base = git('show', `${strip.BASE_COMMIT}:${rel}`)
    ok(head !== base, `${rel}: changed`)
    eq(stripFn(rel, head), base, `${rel}: stripped, it is the base byte for byte`)
    const diff = git('diff', '-U0', `${strip.BASE_COMMIT}..${OWN}`, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
    ok(diff.length > 0 && diff.every(l => l.startsWith('+') && strip.CHAT_ADD_FREE_SLOT_MARKER_RE.test(l)), `${rel}: pure insertions, each marked`)
  }
  for (const rel of strip.CHAT_ADD_FREE_SLOT_PIN_FILES) eq(stripFn(rel, git('show', `${OWN}:${rel}`)), git('show', `${strip.BASE_COMMIT}:${rel}`), `${rel} (a taught proof): stripped, it is the base byte for byte`)
  eq(stripFn('app/builder/page.tsx', 'x // CHAT-ADD-FREE-SLOT\n'), 'x // CHAT-ADD-FREE-SLOT\n', 'strip: a file it does not own is untouched')
  eq(stripFn(HOOK, 'a // CHAT-ADD-FREE-SLOT-X\nb // X-CHAT-ADD-FREE-SLOT\n'), 'a // CHAT-ADD-FREE-SLOT-X\nb // X-CHAT-ADD-FREE-SLOT\n', 'strip: the marker is a whole token')
  eq(git('show', `${OWN}:.env.example`), `${git('show', `${strip.BASE_COMMIT}:.env.example`)}\n${strip.CHAT_ADD_FREE_SLOT_ENV_BLOCK}`, '.env.example is the base plus the block')
  ok(/^NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED="false"$/m.test(strip.CHAT_ADD_FREE_SLOT_ENV_BLOCK), 'the block sets the flag off')
  const reg = git('diff', '-U0', `${strip.BASE_COMMIT}..${OWN}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l))
  eq(reg.length, 3, 'registry: three lines, added')
  ok(reg.every(l => l.startsWith('+') && l.includes('LATER-CHANGE') && l.includes('studio-chat-add-free-slot-strip.mjs')), 'registry: each line is a LATER-CHANGE line naming this strip')
  ok(registry.LATER_STRIPS.includes(strip.stripChatAddFreeSlot) && registry.LATER_ENV_BLOCKS.includes(strip.CHAT_ADD_FREE_SLOT_ENV_BLOCK) && [...strip.CHAT_ADD_FREE_SLOT_SCOPE_FILES].every(f => registry.LATER_CHANGE_FILES.has(f)), 'registry: the strip, the block and the files are registered')
}

await suite()
housePattern(strip.stripChatAddFreeSlot)
const realChecks = checks

// ---- F. mutants
const SRC = read(LIB), HOOK_SRC = read(HOOK)
const MUTANTS = [
  [LIB, 'read the flag as truthy', "process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED === 'true'", '!!process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED'],
  [LIB, 'shrink back in (40%)', '  return spot ? { startCol: spot.startCol, startRow: spot.startRow, width, height } : null\n', "  if (spot) return { startCol: spot.startCol, startRow: spot.startRow, width, height }\n  const w = Math.max(8, Math.round(width * 0.4 * 5) / 5), h = Math.max(5, Math.round(height * 0.4 * 5) / 5)\n  const small = chooseFreeSpot(occupied, w, h)\n  return small ? { startCol: small.startCol, startRow: small.startRow, width: w, height: h } : null\n"],
  [LIB, 'the caption is not shifted', '      shift(caption, captionBox, dCol, dRow)\n', ''],
  [LIB, 'the caption is ignored (picture placed alone)', '    if (caption && own && captionBox) {', '    if (false) {'],
  [LIB, 'an unreadable caption does not stop the move', '  if (caption && (!own || !captionBox)) return null', '  if (false) return null'],
  [LIB, 'the caption shifted by the wrong offset', '      shift(caption, captionBox, dCol, dRow)', '      shift(caption, captionBox, dCol, 0)'],
  [LIB, 'no timeout log', "    if (error instanceof Error && error.message === SLOW_READ) {", '    if (false) {'],
  [LIB, 'every failure logged as a timeout', "    if (error instanceof Error && error.message === SLOW_READ) {", '    if (true) {'],
  [LIB, 'no timeout at all', '      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(SLOW_READ)), timeoutMs) }),', ''],
  [HOOK, 'the hook line loses its flag guard', "if (CHAT_ADD_FREE_SLOT_ENABLED && invocation?.kind === 'chat-add' && !refineContext) {", "if (invocation?.kind === 'chat-add' && !refineContext) {"],
  [HOOK, 'the hook does not hand in the caption', ', caption: captionInsertParams }', ' }'],
]
const survivors = []
for (const [rel, name, from, to] of MUTANTS) {
  const src = rel === LIB ? SRC : HOOK_SRC
  assert.equal(src.split(from).length, 2, `mutant "${name}" matches its source once`)
  overrides.set(rel, src.replace(from, () => to))
  let caught = false
  try { await suite() } catch { caught = true }
  overrides.delete(rel)
  if (!caught) survivors.push(name)
}
const STRIP_MUTANTS = [
  ['strip keeps marked lines', (rel, text) => text],
  ['strip drops every line on owned files that mentions the flag', (rel, text) => rel === HOOK ? text.split('\n').filter(l => !l.includes('CHAT_ADD_FREE_SLOT') && !strip.CHAT_ADD_FREE_SLOT_MARKER_RE.test(l)).join('\n') + '\n' : text],
  ['strip matches the marker as a substring', (rel, text) => rel === HOOK ? text.split('\n').filter(l => !l.includes('CHAT-ADD-FREE-SLOT')).join('\n') : text],
]
for (const [name, fn] of STRIP_MUTANTS) { let caught = false; try { housePattern(fn) } catch { caught = true } if (!caught) survivors.push(name) }
assert.deepEqual(survivors, [], `every mutant is caught (survivors: ${survivors.join('; ') || 'none'})`)
console.log(`ok - studio chat add free slot: ${realChecks} checks (flag-off identity, move without shrink, caption kept with its image, timeout logged, house pattern), ${MUTANTS.length + STRIP_MUTANTS.length} mutants all caught`)
