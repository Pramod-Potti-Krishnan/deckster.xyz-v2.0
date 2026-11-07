// FRONTEND-1 (P4-21b): proof of lib/studio/voice-v2, the port of Garud's v2 layered companion (feature/companion-v2-player b3a812e: companion-face, companion-compositor, companion-speech) and Deckster's call glue (call-face).
//   The face contract parser is ELEMENT-3's (lib/studio/voice/companion-face.ts, its own fixtures); M uses it through index.ts.
//   G. Garud's own tests (scripts/fixtures/studio-voice-v2/*.test.ts, imports re-pointed), run by a small vitest-shaped shim.
//   M. Maya's committed pack: both catalogs' face sections pass the locked contract against their own body frames, every piece is on disk, the compatibility view still parses, and the compositor draws her held body.
//   C. call-face: scene -> recipe, the call's mouth (loudness fallback with the 70 ms crossfade, a timeline when one exists, closed when not speaking or reduced).
//   P. The modules are pure: no React, no DOM, no import outside lib/studio.
//   E. Mutants of the ported modules and the glue: every one must be caught by G-P.
//
//   node scripts/test-studio-voice-v2.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const V2 = 'lib/studio/voice-v2'
const FILES = ['companion-compositor.ts', 'companion-speech.ts', 'call-face.ts', 'index.ts'].map(f => `${V2}/${f}`)
const TESTS = ['companion-compositor', 'companion-speech'].map(n => `scripts/fixtures/studio-voice-v2/${n}.test.ts`)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const SOURCES = Object.fromEntries(FILES.map(rel => [rel, read(rel)]))

// ---- the module host ----------------------------------------------------------------------------------------------------------------------
function makeHost(over = {}, vitest) {
  const cache = new Map()
  const resolve = (from, spec) => {
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const c of [base, `${base}.ts`, path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
    throw new Error(`cannot resolve ${spec}`)
  }
  const load = abs => {
    if (cache.has(abs)) return cache.get(abs).exports
    const module = { exports: {} }; cache.set(abs, module)
    const rel = path.relative(root, abs)
    const text = rel in over ? over[rel] : fs.readFileSync(abs, 'utf8')
    const out = ts.transpileModule(text, { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, isolatedModules: true } }).outputText
    const req = spec => spec === 'vitest' ? vitest : load(resolve(abs, spec))
    new Function('module', 'exports', 'require', out)(module, module.exports, req)
    return module.exports
  }
  return { load: rel => load(path.join(root, rel)) }
}

// ---- a vitest-shaped shim (the matchers Garud's tests use) ----------------------------------------------------------------------------------
function shim() {
  const cases = []
  const prefix = []
  const describe = (name, body) => { prefix.push(name); body(); prefix.pop() }
  const it = (name, body) => cases.push({ name: [...prefix, name].join(' > '), body })
  it.each = rows => (name, body) => rows.forEach(row => it(name.replace('%s', String(Array.isArray(row) ? row[0] : row)), () => Array.isArray(row) ? body(...row) : body(row)))
  const like = (a, b) => { if (b === null || typeof b !== 'object') return Object.is(a, b) || a === b; if (!a || typeof a !== 'object') return false; return Object.keys(b).every(k => like(a[k], b[k])) }
  const matchers = (actual, not) => {
    const check = (pass, msg) => { assert.ok(not ? !pass : pass, `${not ? 'not ' : ''}${msg}`) }
    return {
      toBe: v => check(Object.is(actual, v), `${JSON.stringify(actual)} toBe ${JSON.stringify(v)}`),
      toEqual: v => { let pass = true; try { assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(v))) } catch { pass = false } check(pass, `${JSON.stringify(actual)?.slice(0, 300)} toEqual ${JSON.stringify(v)?.slice(0, 300)}`) },
      toMatchObject: v => check(like(actual, v), `${JSON.stringify(actual)} toMatchObject ${JSON.stringify(v)}`),
      toBeCloseTo: (v, digits = 2) => check(Math.abs(actual - v) < 10 ** -digits / 2, `${actual} toBeCloseTo ${v}`),
      toBeGreaterThan: v => check(actual > v, `${actual} > ${v}`),
      toBeGreaterThanOrEqual: v => check(actual >= v, `${actual} >= ${v}`),
      toBeLessThanOrEqual: v => check(actual <= v, `${actual} <= ${v}`),
      toHaveLength: n => check(actual?.length === n, `length ${actual?.length} is ${n}`),
      toBeNull: () => check(actual === null, `${JSON.stringify(actual)} toBeNull`),
      toThrow: () => { let threw = false; try { actual() } catch { threw = true } check(threw, 'toThrow') },
    }
  }
  const expect = actual => Object.assign(matchers(actual, false), { not: matchers(actual, true) })
  return { vitest: { describe, it, expect }, cases }
}

let checks = 0
const ok = (c, m) => { checks++; assert.ok(c, m) }
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m) }

async function all(over = {}, log = false) {
  // G. Garud's tests
  let garud = 0
  for (const test of TESTS) {
    const { vitest, cases } = shim()
    makeHost(over, vitest).load(test)
    for (const c of cases) { try { c.body() } catch (error) { throw new assert.AssertionError({ message: `${path.basename(test)}: ${c.name}: ${error.message}` }) } checks++; garud++ }
  }
  if (log) console.log(`PASS G  Garud's tests: ${garud} cases`)
  const v2 = makeHost(over).load(`${V2}/index.ts`)

  // M. Maya's pack
  const before = checks
  for (const [rel, folder] of [['maya/motion/manifest.json', 'maya/motion/'], ['maya/face/manifest.json', 'maya/face/']]) {
    const raw = JSON.parse(read(`public/companions/${rel}`))
    ok(v2.isCompanionFace(raw.face), `maya ${rel}: the face section is v2 (inline), not the native Face pointer`)
    const face = v2.parseCompanionFace(raw.face, Object.keys(raw.frames))
    eq([face.angles, Object.keys(face.heads).length === Object.keys(raw.frames).length], [['front', 'left', 'right'], true], `maya ${rel}: three angles, a head for every body frame`)
    const missing = []
    for (const kind of ['mouth', 'eyes', 'brows']) for (const a of face.angles) for (const src of Object.values(face.pieces[kind][a])) if (!fs.existsSync(path.join(root, 'public/companions', folder, src))) missing.push(src)
    eq(missing, [], `maya ${rel}: every piece is on disk`)
    ok(face.angles.every(a => Object.keys(face.pieces.mouth[a]).length === 18), `maya ${rel}: plain and smiling mouths for every angle`)
    const plan = v2.composeCompanionFace({ manifest: raw, bodyFrame: raw.clips.talk_neutral.frames[0], time: 1, motionTime: 1, state: 'speaking', mouth: { mouth: 'ah' } })
    eq([plan.bodies.length, plan.bodies[0].frame, plan.bodies[0].layers.map(l => l.kind)], [1, raw.neutral, ['eyes', 'brows', 'mouth']], `maya ${rel}: a talk slot holds the neutral body with three patches`)
    ok(plan.bodies[0].layers.find(l => l.kind === 'mouth').src.endsWith('mouth_front_ah.webp'), `maya ${rel}: the mouth patch is the asked shape`)
    const happy = v2.composeCompanionFace({ manifest: raw, bodyFrame: raw.neutral, time: 1, expression: 'happy', mouth: { mouth: 'ee' } })
    ok(happy.bodies[0].layers.find(l => l.kind === 'mouth').src.includes('smile_ee') && happy.bodies[0].layers.find(l => l.kind === 'brows').src.endsWith('happy.webp'), `maya ${rel}: pleased speaks with the smiling mouth set and happy brows`)
    const look = Object.keys(raw.frames).find(id => face.heads[id].angle === 'left')
    eq(v2.composeCompanionFace({ manifest: raw, bodyFrame: look, time: 1, mouth: { mouth: 'oh' } }).bodies[0].frame, raw.neutral, `maya ${rel}: Garud's rule: a body her expr_ clips also use (${look}) is not held; his player reaches it only as a gesture`)
    const view = { ...raw, clips: {} } // the Studio painter's view: the call player has chosen the body (layered-face.ts)
    ok(v2.composeCompanionFace({ manifest: view, bodyFrame: look, time: 1, mouth: { mouth: 'oh' } }).bodies[0].layers.find(l => l.kind === 'mouth').src.includes('_left_'), `maya ${rel}: the body the player drew (${look}) wears its own angle's patches at its own head`)
    const refuse = (mutate, label) => { const f = JSON.parse(JSON.stringify(raw.face)); mutate(f); let threw = false; try { v2.parseCompanionFace(f, Object.keys(raw.frames)) } catch { threw = true } ok(threw, `maya ${rel}: refused: ${label}`) }
    refuse(f => { f.heads.extra = { ...f.heads[raw.neutral] } }, 'a head for a body that is not in the catalog')
    refuse(f => { f.recipes.sorry.brows = 'nope' }, 'a recipe with unknown brows')
    refuse(f => { f.pieces.mouth.front.ah = 'http:x.webp' }, 'a piece that is not a pack path')
    ok(v2.composeCompanionFace({ manifest: raw, bodyFrame: raw.neutral, time: 3.87, reduced: true, mouth: { mouth: 'ah' } }).bodies[0].layers.find(l => l.kind === 'eyes').src.endsWith('eyes_front_open.webp'), `maya ${rel}: reduced motion never blinks`)
    eq(v2.companionLoudnessMouth(0.2, 0.1), 'oo', 'loudness: a middling level opens the mouth (Garud thresholds .025 / .15 / .42)')
    let broken = { ...raw.face, angles: ['front', 'up'] }
    let threw = false; try { v2.parseCompanionFace(broken, Object.keys(raw.frames)) } catch { threw = true } ok(threw, `maya ${rel}: a broken section is refused (the player keeps the compatibility view)`)
  }
  // C. call-face
  eq(['thinking', 'working', 'pleased', 'celebrating', 'concerned', 'sorry', 'speaking', 'listening', 'idle', 'constructor', 'toString'].map(v2.sceneExpression), ['thinking', 'thinking', 'happy', 'happy', 'concerned', 'sorry', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral'], 'call: scenes to recipes (prototype names are not scenes)')
  eq(v2.callMouth({ speaking: false, level: 0.9, audioTime: 1 }).sample, { mouth: 'closed', previousMouth: 'closed', mouthMix: 1 }, 'call: not speaking: closed')
  eq(v2.callMouth({ speaking: true, level: 0.9, audioTime: 1, reduced: true }).sample.mouth, 'closed', 'call: reduced motion: closed')
  for (const [level, t] of [[0.01, 0.1], [0.1, 0.1], [0.3, 0.1], [0.7, 0.1], [0.7, 0.15]]) eq(v2.callMouth({ speaking: true, level, audioTime: t }, { mouth: v2.companionLoudnessMouth(level, t), previousMouth: 'closed', changedAt: 0 }).sample.mouth, v2.companionLoudnessMouth(level, t), `call: loudness fallback at ${level}/${t} is Garud's shape`)
  {
    let m = v2.CALL_MOUTH_REST
    const a = v2.callMouth({ speaking: true, level: 0.7, audioTime: 0.1 }, m); m = a.memory
    eq([a.sample.mouth, a.sample.previousMouth, a.sample.mouthMix], ['ee', 'closed', 0], 'call: a new shape starts its crossfade from the one before')
    const b = v2.callMouth({ speaking: true, level: 0.7, audioTime: 0.135 }, m)
    ok(Math.abs(b.sample.mouthMix - 0.5) < 1e-9 && b.sample.mouth === 'ee', 'call: half way through the 70 ms fade at 35 ms')
    const c = v2.callMouth({ speaking: true, level: 0.7, audioTime: 0.149 }, b.memory)
    eq([c.sample.mouth, c.sample.previousMouth], ['ee', 'closed'], 'call: the same shape keeps fading (not restarted)')
    const d = v2.callMouth({ speaking: true, level: 0.7, audioTime: 0.15 }, c.memory)
    eq([d.sample.mouth, d.sample.previousMouth, d.sample.mouthMix], ['ah', 'ee', 0], 'call: the next shape fades from the last')
    const back = v2.callMouth({ speaking: true, level: 0.7, audioTime: 0.05 }, d.memory)
    eq(back.sample.mouthMix, 1, 'call: a clock that went back (a new segment) has no stale blend')
    const shapes = new Set(); let mem = v2.CALL_MOUTH_REST
    for (let t = 0; t < 2; t += 1 / 60) { const r = v2.callMouth({ speaking: true, level: 0.5, audioTime: t }, mem); mem = r.memory; shapes.add(r.sample.mouth) }
    ok(shapes.size >= 3 && !shapes.has('closed'), 'call: a loud voice moves through several open shapes')
  }
  {
    const timeline = { cues: [{ t: 0, mouth: 'closed' }, { t: 0.5, mouth: 'oh' }, { t: 1, mouth: 'closed' }], gestures: [] }
    eq(v2.callMouth({ speaking: true, level: 0, audioTime: 0.7, timeline }).sample, v2.sampleCompanionSpeech(timeline, 0.7), 'call: a timeline, when there is one, is sampled on the audio clock (the level is not used)')
  }
  // P. purity
  for (const rel of FILES) {
    const imports = [...SOURCES[rel].matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1])
    ok(imports.every(s => s.startsWith('./') || s.startsWith('../voice/')), `pure: ${rel} imports only lib/studio (${imports})`)
    ok(!/\b(react|document|window|HTMLCanvasElement|requestAnimationFrame|performance\.now|Date\.now|setTimeout)\b/.test(SOURCES[rel].replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `pure: ${rel} touches no DOM, React or clock`)
    ok(rel.endsWith('index.ts') || SOURCES[rel].includes('b3a812e'), `provenance: ${rel} names Garud b3a812e`)
  }
  for (const f of ['companion-speech.ts']) {
    const garud = SOURCES[`${V2}/${f}`].split('\n').slice(1).join('\n')
    ok(garud.length > 1000 && !garud.includes('Deckster:'), `port: ${f} is Garud's text after its provenance line`)
  }
  if (log) console.log(`PASS M-P  Maya's pack, call glue, purity (${checks - before} checks)`)
}

await all({}, true)
const passed = checks

// E. mutants
const mutants = [
  [`${V2}/companion-compositor.ts`, 'blink never', 'if (t < 3.8) return "open";', 'return "open";'],
  [`${V2}/companion-compositor.ts`, 'blink opens closed eyes', 'r.eyes === "closed" || blink === "open" ? r.eyes : blink', 'blink === "open" ? r.eyes : blink'],
  [`${V2}/companion-compositor.ts`, 'breath too deep', 'export const COMPANION_BREATH_RISE = .008', 'export const COMPANION_BREATH_RISE = .02'],
  [`${V2}/companion-compositor.ts`, 'talk frames allowed as the body', 'if (!m.frames[frame] || Object.entries(m.clips).some(([name, c]) => forbiddenClip(name) && c.frames.includes(frame))) return m.neutral;', 'if (!m.frames[frame]) return m.neutral;'],
  [`${V2}/companion-compositor.ts`, 'no smile set', 'r.mouthSet === "smile" ? mouths[`smile_${shape}`]! : mouths[shape]', 'mouths[shape]'],
  [`${V2}/companion-compositor.ts`, 'no mouth crossfade', 'if (previous !== mouth && mouthMix < 1) add("mouth", mouthSource(previous), 1 - mouthMix);', ''],
  [`${V2}/companion-compositor.ts`, 'state not mapped', 'input.expression ?? ({', 'undefined ?? ({'],
  [`${V2}/companion-compositor.ts`, 'reduced still blinks', 'blink = input.reduced ? "open" : companionBlink(life)', 'blink = companionBlink(life)'],
  [`${V2}/companion-speech.ts`, 'no lead', 'export const COMPANION_MOUTH_LEAD = 0.05;', 'export const COMPANION_MOUTH_LEAD = 0;'],
  [`${V2}/companion-speech.ts`, 'fleeting shapes kept', 'if (next - c.t + 1e-9 < COMPANION_SHORTEST_SHAPE) continue;', ''],
  [`${V2}/companion-speech.ts`, 'loudness thresholds moved', ': amplitude < .15 ? (syllable % 3 === 0 ? 6 : 1)', ': amplitude < .3 ? (syllable % 3 === 0 ? 6 : 1)'],
  [`${V2}/companion-speech.ts`, 'duration does not close', 'if (p.duration !== undefined && audioTime >= p.duration) return closed();', ''],
  [`${V2}/call-face.ts`, 'pleased has no smile', 'pleased: "happy"', 'pleased: "proud"'],
  [`${V2}/call-face.ts`, 'sorry is concerned', 'sorry: "sorry",', 'sorry: "concerned",'],
  [`${V2}/call-face.ts`, 'the mouth moves while listening', 'if (!input.speaking || input.reduced) {', 'if (input.reduced) {'],
  [`${V2}/call-face.ts`, 'reduced motion talks', 'if (!input.speaking || input.reduced) {', 'if (!input.speaking) {'],
  [`${V2}/call-face.ts`, 'the timeline is ignored', 'if (input.timeline) return', 'if (false) return'],
  [`${V2}/call-face.ts`, 'no crossfade between loudness shapes', 'mouthMix: next.previousMouth === next.mouth ? 1 : mouthMix', 'mouthMix: 1'],
  [`${V2}/call-face.ts`, 'a stale blend after a seek back', 'previousMouth: t >= memory.changedAt ? memory.mouth : shape', 'previousMouth: memory.mouth'],
  [`${V2}/call-face.ts`, 'prototype names are scenes', 'Object.prototype.hasOwnProperty.call(SCENE_EXPRESSIONS, scene) ? SCENE_EXPRESSIONS[scene]! : "neutral"', '(SCENE_EXPRESSIONS[scene] ?? "neutral")'],
]
const survivors = [], stale = []
for (const [rel, name, from, to] of mutants) {
  const text = SOURCES[rel]
  if (!text.includes(from)) { stale.push(name); continue }
  let caught = false
  try { await all({ [rel]: text.replace(from, () => to) }) } catch { caught = true }
  if (!caught) survivors.push(name)
}
checks = passed + 2
assert.deepEqual(stale, [], `stale mutants: ${stale}`)
assert.deepEqual(survivors, [], `survivors: ${survivors}`)
console.log(`PASS E  ${mutants.length} mutants, every one caught`)
console.log(`OK studio voice v2: ${checks} checks`)
