// KNOWLEDGE-MAP-LABELS: entity names on the Second Brain map as clean text under the node, wrapped instead of cut (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS, exact "true", Studio
// controls only, default off). Card PASS2-J6-FINDINGS finding L7 (streams/ops/PASS2/J6/RUN.md section 2); mock design/studio-v4-mockup/components/knowledge-map.tsx (`km-node-label`).
// Offline and self-contained apart from one `git show` of the base's kg-graph-view.tsx (the repository needs that commit; KNOWLEDGE_MAP_LABELS_BASE=<commit> picks another).
// Run: node scripts/test-studio-knowledge-map-labels.mjs
//   helper     lib/studio-knowledge-map-labels.ts on its own (import-free): wrapping, and the placement on generated layouts at three zoom levels (labels never overlap, ordinary
//              labels never sit on a node, under the node first, the hovered and selected entity always keep one, the relation labels of the active entity);
//   graph      the REAL components/knowledge/kg-graph-view.tsx, static render. Flag off: its markup is the base file's byte for byte (2 profiles x 6 views). Flag on: no plate (no rect in a
//              name label), the name as halo text in the lines the helper wraps it to, "Northwind Quarterly Review Board" whole where the base cut it, and with the name and relation
//              labels cut out of both the markup is the base's;
//   source     the flag is read once (exact "true", AND the Studio controls), the placement is the flag-on choice of one call, the plate rendering is the flag-off branch.
// Then every layer re-runs against deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let root = here
while (!fs.existsSync(path.join(root, 'package.json'))) {
  const parent = path.dirname(root)
  assert.notEqual(parent, root, 'no package.json above this script')
  root = parent
}
const requireOwn = createRequire(path.join(root, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const { renderToStaticMarkup } = requireOwn('react-dom/server')
const realJsx = requireOwn('react/jsx-runtime')

const BASE = process.env.KNOWLEDGE_MAP_LABELS_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
const HELPER = 'lib/studio-knowledge-map-labels.ts'
const GRAPH = 'components/knowledge/kg-graph-view.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseGraph = execFileSync('git', ['show', `${BASE}:${GRAPH}`], { cwd: root, encoding: 'utf8' })

class MutationTargetMissing extends Error {}
const mutate = (source, edits, label) => edits.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new MutationTargetMissing(`mutation target missing in ${label}: ${from.slice(0, 70)}`)
  return text.replace(from, to)
}, source)

function transpile(source, fileName) {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${fileName} transpiles`)
  return out.outputText
}
const iconStub = new Proxy({}, { get: (_, key) => { const Icon = props => React.createElement('svg', { 'data-icon': String(key), className: props.className }); Icon.iconName = String(key); return Icon } })
function loadModule(entry, sources, env = {}) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const rel = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
    return [rel, `${rel}.ts`, `${rel}.tsx`].find(candidate => candidate in sources)
  }
  const run = rel => {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const req = spec => {
      if (spec === 'react') return React
      if (spec === 'react/jsx-runtime') return realJsx
      if (spec === 'lucide-react') return iconStub
      if (spec.endsWith('.css')) return {}
      const target = resolve(spec, rel)
      if (target) return run(target)
      throw new Error(`unexpected import ${spec} from ${rel}`)
    }
    vm.runInNewContext(transpile(sources[rel], rel), { module: mod, exports: mod.exports, require: req, Intl, Math, process: { env } })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return run(entry)
}

let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => check(assert.deepStrictEqual, plain(actual), plain(expected), message)

// ---- generated layouts ----------------------------------------------------------------------------------------------------------------------
const NAMES = ['AI Forecasting Pilot', 'Out-of-Stock Events', 'Weekly Forecast Error', 'Fresh Produce', 'AI Demand-Forecasting', 'Northwind Quarterly Review Board', 'Northwind Test Stores',
  'Priya Okafor', 'Ohio', 'Regional Fresh Produce Replenishment Programme', 'Supplier Lead Time (days)', 'Cold-Chain Sensor Network', 'Marcus Lindqvist', 'Pacific Northwest Distribution Centre',
  'Seasonal Demand Uplift', 'Shelf Availability', 'Contoso Logistics', 'Supercalifragilisticexpialidocious_and_more_letters_here']
function layoutOf(count, seed, spread = 1) {
  let state = seed
  const next = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296 }
  return Array.from({ length: count }, (_, i) => ({ node_id: `n${i + 1}`, name: NAMES[i % NAMES.length], x: 80 + next() * 800 * spread, y: 60 + next() * 480 * spread, r: 7 + next() * 15, salience: 1 + next() * 3 }))
}
const top = (layout, n = 18) => new Set([...layout].sort((a, b) => b.salience - a.salience).slice(0, n).map(point => point.node_id))
const edgesOf = layout => layout.slice(1).map((point, i) => ({ src_node_id: layout[i % 3].node_id, dst_node_id: point.node_id, relation: ['REDUCED', 'MEASURED_BY', 'IS_PART_OF_THE_PROGRAMME_OF'][i % 3] }))
const gap = 5
const overlap = (a, b) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
const boxOf = label => ({ x: label.x, y: label.y, width: label.width, height: label.height })

// ---- helper ---------------------------------------------------------------------------------------------------------------------------------
function helperChecks(h) {
  // wrapping
  const w = h.wrapLabel
  deq(w('AI Forecasting Pilot', 24, 2), ['AI Forecasting Pilot'], 'a short name is one line')
  deq(w('Northwind Quarterly Review Board', 24, 2), ['Northwind Quarterly', 'Review Board'], 'broken between words')
  deq(w('Northwind Quarterly Review Board', 30, 3), ['Northwind Quarterly Review', 'Board'], 'the selected one has longer lines')
  deq(w('Regional Fresh Produce Replenishment Programme', 24, 2), ['Regional Fresh Produce', 'Replenishment Programme'], 'a 46-character name fits two lines whole')
  deq(w('Pacific Northwest Distribution Centre', 24, 2), ['Pacific Northwest', 'Distribution Centre'])
  deq(w('Regional Fresh Produce Replenishment Programme and Review', 24, 2), ['Regional Fresh Produce', 'Replenishment Programme…'], 'a name that does not fit: the last line ends in an ellipsis')
  check(assert.ok, w('Regional Fresh Produce Replenishment Programme and Review', 24, 2).every(line => line.length <= 24), 'no line is longer than a line')
  deq(w('Supercalifragilisticexpialidocious_and_more_letters_here', 24, 2), ['Supercalifragilisticexp…'], 'one word longer than a line is cut with an ellipsis')
  deq(w('A Supercalifragilisticexpialidocious_and_more', 24, 2), ['A', 'Supercalifragilisticexp…'], 'a long word after a short one starts its own line')
  deq(w('  spaced   out\tname \n here ', 24, 2), ['spaced out name here'], 'whitespace is collapsed')
  for (const none of ['', '   ', null, undefined]) deq(w(none, 24, 2), ['Unnamed entity'], `no name: ${String(none)}`)
  deq(w(42, 24, 2), ['42'], 'a number')
  deq(w('one two three four five six seven eight nine ten', 10, 2), ['one two', 'three fou…'], 'two short lines of a long sentence')
  deq(w('abcdefghij abcdefghij abcdefghij', 10, 3), ['abcdefghij', 'abcdefghij', 'abcdefghij'], 'a line exactly full')
  deq(w('abcdefghij abcdefghij abcdefghij', 10, 2), ['abcdefghij', 'abcdefghi…'], 'a full last line makes room for the ellipsis')
  for (const name of NAMES) for (const [perLine, maxLines] of [[h.ORDINARY.perLine, h.ORDINARY.maxLines], [h.IMPORTANT.perLine, h.IMPORTANT.maxLines]]) {
    const lines = w(name, perLine, maxLines)
    check(assert.ok, lines.length >= 1 && lines.length <= maxLines && lines.every(line => line.length <= perLine), `wrap "${name}" ${perLine}x${maxLines}`)
    if (name.length <= perLine) deq(lines, [name], `${name} fits one line`)
  }
  deq(h.ORDINARY, { fontSize: 13, perLine: 24, maxLines: 2 })
  deq(h.IMPORTANT, { fontSize: 15, perLine: 30, maxLines: 3 })

  // widths: the same glyph table as the plate's width, without the plate's padding (20)
  check(assert.equal, h.textWidth('', 13), 24, 'a floor')
  check(assert.ok, Math.abs(h.textWidth('Priya Okafor', 13) - ([...'Priya Okafor'].reduce((sum, c) => sum + (/[MW@#%&]/.test(c) ? 1.05 : /[mw]/.test(c) ? 0.96 : /[iIl.,:;!|' ]/.test(c) ? 0.34 : /[A-Z]/.test(c) ? 0.8 : 0.68), 0) * 13 + 4)) < 1e-9, 'glyph widths')
  for (const [text, per] of [['MWMW', 1.05], ['mwmw', 0.96], ['iiiiiiiiii', 0.34], ['ABCD', 0.8], ['abcd', 0.68], ['日本語日', 1.05], ['a.b,c', 0.68 * 3 / 5 + 0.34 * 2 / 5]]) {
    check(assert.ok, Math.abs(h.textWidth(text, 13) - Math.max(24, per * [...text].length * 13 + 4)) < 1e-9, `the width of ${text}`)
  }
  check(assert.ok, h.textWidth('MMMM', 13) > h.textWidth('iiii', 13), 'wide letters are wider')
  check(assert.ok, h.textWidth('日本語', 13) > h.textWidth('abc', 13), 'wide characters are wider')
  check(assert.ok, h.textWidth('Priya Okafor', 15) > h.textWidth('Priya Okafor', 13), 'a larger font is wider')
  check(assert.equal, h.friendlyRelation('IS_PART_OF'), 'is part of')

  // placement
  const run = (layout, { edges = [], labeled = top(layout), selected = null, hover = null, active = null, scale = 1, viewport } = {}) => h.placeCleanLabels(layout, edges, labeled, selected, hover, active, scale, viewport)
  for (const [count, seed] of [[9, 1], [17, 2], [30, 3], [60, 4]]) for (const scale of [1, 1.8, 2.5]) {
    const layout = layoutOf(count, seed)
    const result = run(layout, { scale })
    const labels = result.entities
    check(assert.ok, labels.length > 0, `${count} nodes at ${scale}: something is labelled`)
    check(assert.ok, labels.length <= 18, 'at most the 18 most salient')
    const labeled = top(layout)
    check(assert.ok, labels.every(label => labeled.has(label.point.node_id)), 'only labelled entities get a label')
    check(assert.equal, new Set(labels.map(label => label.point.node_id)).size, labels.length, 'one label each')
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) check(assert.ok, !overlap(boxOf(labels[i]), boxOf(labels[j])), `${count}/${scale}: ${labels[i].point.name} and ${labels[j].point.name} do not overlap`)
    for (const label of labels) {
      for (const point of layout) {
        const cx = Math.max(label.x, Math.min(point.x * scale, label.x + label.width)), cy = Math.max(label.y, Math.min(point.y * scale, label.y + label.height))
        check(assert.ok, Math.hypot(point.x * scale - cx, point.y * scale - cy) >= point.r * scale + 3, `${count}/${scale}: the label of ${label.point.name} is clear of ${point.name}`)
      }
      check(assert.ok, label.lines.length >= 1 && label.lines.length <= 2 && label.fontSize === 13, 'ordinary metrics')
      check(assert.equal, label.height, label.lines.length * label.lineHeight + 2)
      check(assert.ok, Math.abs(label.width - Math.max(...label.lines.map(line => h.textWidth(line, label.fontSize)))) < 1e-9, 'the box is as wide as its widest line')
      check(assert.equal, label.lineHeight, 16)
      check(assert.equal, label.extraRow, false)
      check(assert.ok, Math.abs(label.x + label.width / 2 - label.point.x * scale) < 1e-9, 'centred on its node')
      check(assert.ok, label.y === label.point.y * scale + label.offsetY, 'offsetY is relative to the node centre')
    }
    deq(run(layout, { scale }), result, 'deterministic')
  }
  // under the node first: a lone node
  let lone = run([{ node_id: 'a', name: 'Priya Okafor', x: 400, y: 300, r: 12, salience: 2 }], { scale: 1 }).entities[0]
  check(assert.equal, lone.offsetY, 12 + 4, 'a lone node: the label is under it (radius + 4)')
  lone = run([{ node_id: 'a', name: 'Priya Okafor', x: 400, y: 300, r: 12, salience: 2 }], { scale: 2 }).entities[0]
  check(assert.equal, lone.offsetY, 24 + 4, 'at 2x the radius is painted twice as large')
  lone = run([{ node_id: 'a', name: 'Regional Fresh Produce Replenishment Programme', x: 400, y: 300, r: 12, salience: 2 }]).entities[0]
  deq(lone.lines, ['Regional Fresh Produce', 'Replenishment Programme'], 'long names wrap on the map')
  check(assert.equal, lone.height, 2 * 16 + 2)
  // under when it is clear, above when a node is in the way below
  const clearBelow = run([{ node_id: 'a', name: 'Priya Okafor', x: 400, y: 300, r: 12, salience: 3 }, { node_id: 'b', name: 'Ohio', x: 400, y: 380, r: 12, salience: 1 }]).entities
  check(assert.equal, clearBelow.find(label => label.point.node_id === 'a').offsetY, 16, 'nothing in the way: under the node')
  const nodeBelow = run([{ node_id: 'a', name: 'Priya Okafor', x: 400, y: 300, r: 12, salience: 3 }, { node_id: 'b', name: 'Ohio', x: 400, y: 326, r: 12, salience: 1 }]).entities
  const aAbove = nodeBelow.find(label => label.point.node_id === 'a')
  check(assert.equal, aAbove.offsetY, -(12 + 4 + aAbove.height), 'a node under it: the label goes above, clear of the node')
  const takenBelow = run([{ node_id: 'a', name: 'Priya Okafor', x: 400, y: 300, r: 12, salience: 3 }, { node_id: 'b', name: 'Ohio', x: 400, y: 360, r: 12, salience: 1 }]).entities
  deq(takenBelow.map(label => [label.point.node_id, label.offsetY]), [['a', 16], ['b', 16]], 'two nodes with room between them: each name under its own node')
  for (const placedLabels of [clearBelow, nodeBelow, takenBelow]) for (let i = 0; i < placedLabels.length; i++) for (let j = i + 1; j < placedLabels.length; j++) check(assert.ok, !overlap(boxOf(placedLabels[i]), boxOf(placedLabels[j])), 'two close nodes never share space')
  // the viewport: an ordinary label outside the view is skipped
  const view = { x: 0, y: 0, width: 200, height: 200 }
  check(assert.equal, run([{ node_id: 'a', name: 'Priya Okafor', x: 600, y: 500, r: 12, salience: 2 }], { viewport: view }).entities.length, 0, 'outside the view: no label')
  check(assert.equal, run([{ node_id: 'a', name: 'Priya Okafor', x: 100, y: 100, r: 12, salience: 2 }], { viewport: view }).entities.length, 1, 'inside the view: a label')
  check(assert.equal, run([{ node_id: 'a', name: 'Priya Okafor', x: 100, y: 195, r: 12, salience: 2 }], { viewport: view }).entities[0].offsetY < 0, true, 'no room under it inside the view: above')
  // the selected and hovered entity always keep a label, even outside the view or unlabelled otherwise
  const far = [{ node_id: 'a', name: 'Priya Okafor', x: 600, y: 500, r: 12, salience: 2 }, { node_id: 'b', name: 'Ohio', x: 100, y: 100, r: 12, salience: 1 }]
  let sel = run(far, { viewport: view, selected: 'a', labeled: new Set() }).entities
  deq(sel.map(label => label.point.node_id), ['a'], 'a selected entity outside the view still has its label (and nothing else is labelled)')
  check(assert.equal, sel[0].fontSize, 15, 'the selected one is larger')
  sel = run(far, { hover: 'b', selected: 'a', labeled: new Set() }).entities
  deq(sel.map(label => label.point.node_id), ['b', 'a'], 'the hovered one first, then the selected one')
  const ordered = run(layoutOf(17, 2), { hover: 'n5', selected: 'n3' }).entities.map(label => label.point.node_id)
  check(assert.equal, ordered[0], 'n5', 'hovered first')
  check(assert.equal, ordered[1], 'n3', 'selected second')
  const sal = layoutOf(17, 2)
  const rest = ordered.slice(2).map(id => sal.find(point => point.node_id === id).salience)
  deq(rest, [...rest].sort((x, y) => y - x), 'then by salience')
  const important = run(sal, { selected: 'n3' }).entities.find(label => label.point.node_id === 'n3')
  check(assert.equal, important.lines.length <= 3 && important.fontSize === 15 && important.lineHeight === 18, true, 'important metrics')
  // a selected entity whose under and above are both taken (here by the hovered one's three-line label) gets an extra row above, with a leader
  const crowd = [{ node_id: 's', name: 'Selected one', x: 300, y: 300, r: 12, salience: 1 }, { node_id: 'h', name: 'Regional Fresh Produce Replenishment Programme Review Board of Directors', x: 300, y: 250, r: 12, salience: 1 },
    { node_id: 'c', name: 'Obstacle', x: 300, y: 195, r: 14, salience: 1 }]
  const surrounded = run(crowd, { selected: 's', hover: 'h', labeled: new Set() }).entities
  deq(surrounded.map(label => label.point.node_id), ['h', 's'], 'both the hovered and the selected entity keep a label')
  check(assert.equal, surrounded[0].offsetY, 16, 'the hovered label could only go under (a node is above it)')
  check(assert.equal, surrounded[0].lines.length, 3, 'on three lines')
  check(assert.equal, surrounded[1].extraRow, true, 'the selected one is on an extra row')
  check(assert.equal, surrounded[1].offsetY, -62, 'one row above the first place above (-(12 + 4 + 20), then 20 + 5 + 1 more)')
  check(assert.ok, !overlap(boxOf(surrounded[0]), boxOf(surrounded[1])), 'and clear of the hovered label')
  check(assert.equal, run(crowd, { selected: 's', hover: 'h', labeled: new Set() }).entities[0].extraRow, false, 'the hovered one is not on an extra row')
  // the box reserved for a relation label is the plate the view draws (graphLabelWidth(compactGraphLabel(label, 20), 11, 62))
  const plateWidth = text => { const cut = text.length > 20 ? `${text.slice(0, 19)}…` : text; const glyphs = [...cut].reduce((sum, c) => sum + (/[MW@#%&]/.test(c) ? 1.05 : /[mw]/.test(c) ? 0.96 : /[iIl.,:;!|' ]/.test(c) ? 0.34 : /[A-Z]/.test(c) ? 0.8 : c.charCodeAt(0) > 255 ? 1.05 : 0.68), 0); return Math.max(62, glyphs * 11 + 20) }
  for (const relation of ['USES', 'REDUCED', 'MEASURED_BY', 'IS_PART_OF_THE_PROGRAMME_OF', 'is', 'WIMMW_WIMMW_WIMMW_WIMMW']) check(assert.ok, Math.abs(h.relationWidth(relation) - plateWidth(h.friendlyRelation(relation))) < 1e-9, `the relation box of ${relation} is the view's plate`)
  check(assert.equal, h.relationWidth('IS'), 62, 'the view\'s floor')
  // a relation label is not placed on a name label
  const nameBlock = run([{ node_id: 'a', name: 'A', x: 300, y: 300, r: 8, salience: 1 }, { node_id: 'b', name: 'B', x: 600, y: 300, r: 8, salience: 1 }, { node_id: 'c', name: 'In the way', x: 450, y: 270, r: 8, salience: 1 }],
    { edges: [{ src_node_id: 'a', dst_node_id: 'b', relation: 'USES' }], active: 'a', labeled: new Set(['c']) })
  deq(nameBlock.entities.map(label => label.point.node_id), ['c'])
  check(assert.equal, nameBlock.relations.size, 0, 'a name label is in the way: no relation label')
  // the box a relation label takes is as wide as its text: a long one keeps the next one off, two short ones sit side by side
  const trio = [{ node_id: 'a', name: 'A', x: 0, y: 300, r: 4, salience: 1 }, { node_id: 'b', name: 'B', x: 380, y: 300, r: 4, salience: 1 }, { node_id: 'c', name: 'C', x: 560, y: 300, r: 4, salience: 1 }]
  const relationsOf = (first, second) => [...run(trio, { edges: [{ src_node_id: 'a', dst_node_id: 'b', relation: first }, { src_node_id: 'a', dst_node_id: 'c', relation: second }], active: 'a', labeled: new Set() }).relations]
  deq(relationsOf('USES', 'USES'), ['a-b-USES', 'a-c-USES'], 'two short relation labels fit side by side')
  deq(relationsOf('IS_PART_OF_THE_PROGRAMME_OF', 'USES'), ['a-b-IS_PART_OF_THE_PROGRAMME_OF'], 'a long one takes the room of the next')
  // at most 8 relation labels, even when there is room for more
  const spokes = [{ node_id: 'h', name: 'Hub', x: 480, y: 300, r: 6, salience: 1 }, ...Array.from({ length: 10 }, (_, i) => ({ node_id: `s${i}`, name: `S${i}`, x: 480 + 300 * Math.cos((2 * Math.PI * i) / 10), y: 300 + 300 * Math.sin((2 * Math.PI * i) / 10), r: 6, salience: 1 }))]
  const hubEdges = spokes.slice(1).map(point => ({ src_node_id: 'h', dst_node_id: point.node_id, relation: 'USES' }))
  check(assert.equal, run(spokes, { edges: hubEdges, active: 'h', labeled: new Set() }).relations.size, 8, 'ten relations, room for all: 8 are labelled')
  // the selected entity: the second and third chances
  const edge = { x: 0, y: 0, width: 800, height: 400 }
  const squeezed = [{ node_id: 's', name: 'Selected', x: 300, y: 385, r: 12, salience: 1 }, { node_id: 'below', name: 'Below', x: 300, y: 415, r: 14, salience: 1 }, { node_id: 'above', name: 'Above', x: 300, y: 350, r: 14, salience: 1 }]
  const second = run(squeezed, { selected: 's', labeled: new Set(), viewport: edge }).entities[0]
  check(assert.equal, second.offsetY, -(12 + 4 + 20), 'nodes under and above, the view ends under it: above, still in the view (the second chance)')
  const outside = run(far, { viewport: view, selected: 'a', labeled: new Set() }).entities[0]
  check(assert.equal, outside.offsetY, 16, 'a selection outside the view: under its node, not on an extra row (the third chance)')
  check(assert.equal, outside.extraRow, false)
  // relation labels
  const layout = layoutOf(9, 1)
  const edges = edgesOf(layout)
  const none = run(layout, { edges })
  check(assert.equal, none.relations.size, 0, 'no active entity: no relation label')
  const active = run(layout, { edges, active: 'n1' })
  check(assert.ok, active.relations.size > 0 && active.relations.size <= 8, 'an active entity: its relation labels, at most 8')
  for (const key of active.relations) check(assert.ok, edges.some(edge => `${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}` === key && (edge.src_node_id === 'n1' || edge.dst_node_id === 'n1')), `${key} is a relation of the active entity`)
  check(assert.equal, active.entities.length, none.entities.length, 'relation labels do not take a name label away (names are placed first)')
  const lonely = run([{ node_id: 'a', name: 'A', x: 300, y: 300, r: 8, salience: 1 }, { node_id: 'b', name: 'B', x: 600, y: 300, r: 8, salience: 1 }], { edges: [{ src_node_id: 'a', dst_node_id: 'b', relation: 'IS_PART_OF_THE_PROGRAMME_OF' }], active: 'a', labeled: new Set() })
  deq([...lonely.relations], ['a-b-IS_PART_OF_THE_PROGRAMME_OF'], 'a relation label between two bare nodes')
  const covered = run([{ node_id: 'a', name: 'A', x: 300, y: 300, r: 8, salience: 1 }, { node_id: 'b', name: 'B', x: 340, y: 300, r: 30, salience: 1 }], { edges: [{ src_node_id: 'a', dst_node_id: 'b', relation: 'USES' }], active: 'a', labeled: new Set() })
  check(assert.equal, covered.relations.size, 0, 'a relation label that would sit on a node is not drawn')
  const missing = run([{ node_id: 'a', name: 'A', x: 300, y: 300, r: 8, salience: 1 }], { edges: [{ src_node_id: 'a', dst_node_id: 'gone', relation: 'USES' }], active: 'a', labeled: new Set() })
  check(assert.equal, missing.relations.size, 0, 'a relation to an entity that is not on the map')
  check(assert.equal, run([], {}).entities.length, 0, 'no entities, no labels')
}

// ---- graph ----------------------------------------------------------------------------------------------------------------------------------
const GNODES = layoutOf(9, 1).map((point, i) => ({ node_id: point.node_id, name: ['AI Forecasting Pilot', 'Out-of-Stock Events', 'Weekly Forecast Error', 'Fresh Produce', 'AI Demand-Forecasting', 'Northwind Quarterly Review Board', 'Northwind Test Stores', 'Priya Okafor', 'Ohio'][i],
  entity_type: ['EVENT', 'METRIC', 'METRIC', 'PRODUCT', 'TECHNOLOGY', 'ORG', 'ORG', 'PERSON', 'PLACE'][i], description: null, salience: [3, 2.4, 2.2, 1.6, 2.6, 2, 2.8, 1.4, 1.2][i], mention_count: i + 1 }))
const GEDGES = [[1, 2], [1, 3], [1, 5], [1, 7], [5, 4], [6, 1], [8, 6], [7, 9], [3, 2]].map(([a, b], i) => ({ src_node_id: `n${a}`, dst_node_id: `n${b}`, relation: ['REDUCED', 'MEASURED_BY', 'USES'][i % 3], weight: 1 + (i % 3) }))
const VIEWS = [
  { name: 'nine entities', nodes: GNODES, edges: GEDGES, selectedId: null },
  { name: 'the long name selected', nodes: GNODES, edges: GEDGES, selectedId: 'n6' },
  { name: 'a selection that is not on the map', nodes: GNODES, edges: GEDGES, selectedId: 'n99' },
  { name: 'one entity', nodes: GNODES.slice(0, 1), edges: [], selectedId: null },
  { name: 'two entities, one relation', nodes: GNODES.slice(0, 2), edges: GEDGES.slice(0, 1), selectedId: 'n2' },
  { name: 'a small panel', nodes: GNODES, edges: GEDGES, selectedId: null, width: 600, height: 400 },
  { name: 'an entity with relations selected', nodes: GNODES, edges: GEDGES, selectedId: 'n5' },
]
const envFor = (shell, flag) => ({ ...(shell ? { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } : {}), ...(flag ? { [FLAG]: 'true' } : {}) })
// KNOWLEDGE-MAP-TOOLBAR (a sibling change, when it is on this branch): kg-graph-view imports its toolbar and helper. Its flag is unset in every render here, so the markup is unaffected;
// the modules only have to resolve. Files that are not there (this change alone on the base) are left out.
// + PASS2 Second Brain (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN): kg-graph-view imports its import-free helper; its flag is unset in every render here.
const SIBLINGS = ['components/knowledge/studio-knowledge-map-toolbar.tsx', 'lib/studio-knowledge-map-toolbar.ts', 'lib/studio-p2-second-brain.ts'].filter(rel => fs.existsSync(path.join(root, rel)))
const siblingSources = () => Object.fromEntries(SIBLINGS.map(rel => [rel, read(rel)]))
function staticMarkup(graphSource, helperSource, env, view) {
  const { KgGraphView } = loadModule(GRAPH, { ...siblingSources(), [GRAPH]: graphSource, [HELPER]: helperSource }, env)
  return renderToStaticMarkup(React.createElement(KgGraphView, { nodes: view.nodes, edges: view.edges, selectedId: view.selectedId, width: view.width, height: view.height }))
}
const labelGroups = html => [...html.matchAll(/<g data-studio-graph-label="entity"[\s\S]*?<\/g>/g)].map(match => match[0])
const cutLabels = html => html.replace(/<g data-studio-graph-label="(?:entity|relation)"[\s\S]*?<\/g>/g, '')

function graphChecks(sources, baseMarkup) {
  const graph = sources.graph, helper = sources.helper
  for (const shell of [true, false]) for (const view of VIEWS) {
    check(assert.equal, staticMarkup(graph, helper, envFor(shell, false), view), baseMarkup(shell, view), `flag off, ${shell ? 'Studio' : 'classic'} controls, ${view.name}: the base's markup`)
  }
  for (const view of VIEWS.slice(0, 3)) check(assert.equal, staticMarkup(graph, helper, envFor(false, true), view), baseMarkup(false, view), `flag on without the Studio controls: the base's markup, ${view.name}`)
  const h = loadModule(HELPER, { [HELPER]: helper })
  for (const view of VIEWS) {
    const off = staticMarkup(graph, helper, envFor(true, false), view)
    const on = staticMarkup(graph, helper, envFor(true, true), view)
    const groups = labelGroups(on)
    const base = labelGroups(off)
    check(assert.ok, groups.length >= base.length, `${view.name}: at least as many names as the plates showed (${groups.length} vs ${base.length})`)
    check(assert.ok, base.every(group => /<rect /.test(group)), `${view.name}: flag off the names are on plates`)
    for (const group of groups) {
      check(assert.doesNotMatch, group, /<rect /, 'no plate')
      check(assert.match, group, /<text x="0" text-anchor="middle" fill="#(?:FFFFFF|DCE6F2)" font-size="1[35]" font-weight="(?:600|500)" paint-order="stroke" stroke="#10182B" stroke-width="3" stroke-linejoin="round">/, 'halo text')
      check(assert.match, group, /data-studio-graph-label-clean="true" aria-hidden="true" class="pointer-events-none"/, 'inert, as the plates were')
    }
    check(assert.equal, cutLabels(on), cutLabels(off), `${view.name}: with the name and relation labels cut out, the markup is the base's`)
  }
  // the long name, whole where the base cut it
  const long = VIEWS[1]
  const off = staticMarkup(graph, helper, envFor(true, false), long), on = staticMarkup(graph, helper, envFor(true, true), long)
  check(assert.match, off, /Northwind Quarterly Revi…/, 'the base cuts it')
  check(assert.doesNotMatch, on, /Revi…/, 'flag on: not cut')
  const lines = [...on.matchAll(/<tspan x="0" y="[\d.-]+">([^<]*)<\/tspan>/g)].map(match => match[1])
  check(assert.ok, lines.includes('Northwind Quarterly Review') && lines.includes('Board'), 'the selected name, wrapped whole (30 characters a line)')
  const group = labelGroups(on).find(item => item.includes('data-studio-graph-label-node="n6"'))
  check(assert.match, group, /fill="#FFFFFF" font-size="15" font-weight="600"/, 'the selected name: larger, white, bold')
  const withRelations = staticMarkup(graph, helper, envFor(true, true), VIEWS[6])
  check(assert.match, withRelations, /data-studio-graph-label="relation"/, 'the relation labels of the selected entity are still drawn')
  // the lines are the helper's
  const ordinary = staticMarkup(graph, helper, envFor(true, true), VIEWS[0])
  for (const group of labelGroups(ordinary)) {
    const id = /data-studio-graph-label-node="(n\d+)"/.exec(group)[1]
    const node = GNODES.find(item => item.node_id === id)
    const shown = [...group.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(match => match[1].replace(/&amp;/g, '&'))
    deq(shown, h.wrapLabel(node.name, 24, 2), `the lines of ${node.name}`)
  }
  // two-line names: the lines are one line height apart (3 more than the font size)
  for (const group of labelGroups(on)) {
    const ys = [...group.matchAll(/<tspan x="0" y="([\d.-]+)">/g)].map(match => Number(match[1]))
    const size = Number(/font-size="(\d+)"/.exec(group)[1])
    for (let i = 1; i < ys.length; i++) check(assert.ok, Math.abs(ys[i] - ys[i - 1] - (size + 3)) < 1e-6, `two lines of a ${size}px name are ${size + 3} apart`)
  }
  check(assert.ok, labelGroups(on).some(group => (group.match(/<tspan/g) ?? []).length === 2), 'and some name is on two lines')
  // labels of entities that are not the selected one's neighbours are dimmed with their nodes
  const neighbours = new Set(['n6', ...GEDGES.filter(edge => edge.src_node_id === 'n6' || edge.dst_node_id === 'n6').flatMap(edge => [edge.src_node_id, edge.dst_node_id])])
  for (const group of labelGroups(on)) {
    const id = /data-studio-graph-label-node="(n\d+)"/.exec(group)[1]
    check(assert.match, group, neighbours.has(id) ? /opacity="1"/ : /opacity="0\.18"/, `the label of ${id} is dimmed with its node`)
  }
  check(assert.ok, labelGroups(on).some(group => /opacity="0\.18"/.test(group)) && labelGroups(on).some(group => /opacity="1"/.test(group)), 'both kinds are there')
  // a label on an extra row has a leader line to its node (a helper that puts every label on an extra row)
  const everyExtra = mutate(helper, [['entities.push({ ...box, point, fontSize: metrics.fontSize, offsetY, lines, lineHeight, extraRow })', 'entities.push({ ...box, point, fontSize: metrics.fontSize, offsetY, lines, lineHeight, extraRow: true })']], 'extra row helper')
  const leaders = staticMarkup(graph, everyExtra, envFor(true, true), VIEWS[0])
  check(assert.equal, (leaders.match(/data-studio-graph-label-leader="true"/g) ?? []).length, labelGroups(leaders).length, 'a leader line for every label on an extra row')
  check(assert.match, leaders, /<line data-studio-graph-label-leader="true" x1="0" y1="-[\d.]+" x2="0" y2="[\d.-]+" stroke="#81949f" stroke-width="0.7" opacity="0.6"><\/line>/, 'from the node to the text')
  check(assert.equal, (ordinary.match(/data-studio-graph-label-leader/g) ?? []).length, 0, 'none for a label beside its node')
  // the node itself still carries the full name for a pointer and a screen reader
  check(assert.match, ordinary, /aria-label="Northwind Quarterly Review Board, org, seen 6 times"/, 'the node keeps the full name')
  check(assert.match, ordinary, /<title>Northwind Quarterly Review Board \(ORG\) — seen 6×<\/title>/, 'and its tooltip')
}

// ---- source ---------------------------------------------------------------------------------------------------------------------------------
function sourceChecks(graph) {
  const occurrences = (text, needle) => text.split(needle).length - 1
  check(assert.equal, occurrences(graph, FLAG), 1, 'the flag is named once')
  check(assert.ok, graph.includes(`const MAP_LABELS = STUDIO_GRAPH_CONTROLS && process.env.${FLAG} === 'true'\n`), 'read once, exact "true", AND the Studio controls')
  check(assert.ok, graph.indexOf('const STUDIO_GRAPH_CONTROLS =') < graph.indexOf('const MAP_LABELS ='), 'STUDIO_GRAPH_CONTROLS is defined first')
  check(assert.equal, (graph.match(/\bMAP_LABELS\b/g) ?? []).length, 4, 'defined, the placement, the clean labels, the plates')
  check(assert.ok, graph.includes("import { placeCleanLabels } from '@/lib/studio-knowledge-map-labels'\n"), 'the import')
  check(assert.equal, occurrences(graph, 'placeCleanLabels'), 2, 'imported and used once')
  check(assert.ok, graph.includes('useMemo<ReturnType<typeof placeStudioLabels> | null>(() => STUDIO_GRAPH_CONTROLS ? (MAP_LABELS ? placeCleanLabels : placeStudioLabels)(layout, edges, labeledIds, selectedId, hoverId, activeId, canvasScale * view.scale, { x: -view.x * canvasScale, y: -view.y * canvasScale, width: width * canvasScale, height: height * canvasScale }) : null, [layout, edges, labeledIds, selectedId, hoverId, activeId, canvasScale, view.scale, view.x, view.y, width, height])'), 'the placement is the flag-on choice of one call, with the same arguments and dependencies')
  check(assert.ok, graph.includes('{MAP_LABELS && studioLabels?.entities.map('), 'the clean labels')
  check(assert.ok, graph.includes('{!MAP_LABELS && studioLabels?.entities.map(({ point, width: plateWidth, height: plateHeight, fontSize, offsetY }) => {'), 'the plates are the flag-off branch, as they were')
  // + PASS2 Second Brain (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN) outlines the plates and sets their text semi-bold on its own flag; those swaps come out first (scripts/test-studio-p2-second-brain.mjs pins them).
  const plateGraph = graph.replace(' style={STUDIO_P2_MAP ? { stroke: typeColor(point.entity_type), strokeWidth: 1, strokeOpacity: .75 } : undefined}', '').replace('fill={STUDIO_P2_MAP ? "#F8FAFC" : "#E2E8F0"}', 'fill="#E2E8F0"').replace('fontWeight={STUDIO_P2_MAP ? 600 : 500}', 'fontWeight={500}')
  for (const part of ['<rect x={-plateWidth / 2} y={offsetY} width={plateWidth} height={plateHeight} rx={8} fill="#020617" opacity={.92} />', "<text x={0} y={offsetY + 17} textAnchor=\"middle\" fill=\"#E2E8F0\" fontSize={fontSize} fontWeight={500}>{compactGraphLabel(point.name, 25)}</text>",
    'function placeStudioLabels(', 'const width = graphLabelWidth(compactGraphLabel(point.name, 25), fontSize), height = 24']) check(assert.ok, plateGraph.includes(part), `the plate code is untouched: ${part.slice(0, 60)}`)
  check(assert.ok, graph.includes('if (STUDIO_GRAPH_CONTROLS && !studioLabels?.relations.has('), 'the relation labels read the placement as before')
}

// ---- run, then break things ------------------------------------------------------------------------------------------------------------------
const sources = { helper: read(HELPER), graph: read(GRAPH) }
const baseCache = new Map()
const baseMarkup = (shell, view) => {
  const key = `${shell}/${view.name}`
  if (!baseCache.has(key)) baseCache.set(key, staticMarkup(baseGraph, read(HELPER), envFor(shell, false), view))
  return baseCache.get(key)
}
const runAll = s => {
  helperChecks(loadModule(HELPER, { [HELPER]: s.helper }))
  graphChecks(s, baseMarkup)
  sourceChecks(s.graph)
}
runAll(sources)
const real = checks

const MUTANTS = [
  // helper: widths and wrapping
  ['helper', "return Math.max(24, glyphs * fontSize + 4)", "return Math.max(24, glyphs * fontSize + 24)", 'the plate\'s padding is back'],
  ['helper', "return Math.max(24, glyphs * fontSize + 4)", "return glyphs * fontSize + 4", 'no floor'],
  ['helper', "/[MW@#%&]/.test(char) ? 1.05", "/[MW@#%&]/.test(char) ? 0.5", 'wide letters are narrow'],
  ['helper', "char.charCodeAt(0) > 255 ? 1.05", "char.charCodeAt(0) > 255 ? 0.5", 'wide characters are narrow'],
  ['helper', "if (text === '') return ['Unnamed entity']", "if (text === '') return ['']", 'an empty name'],
  ['helper', ".replace(/\\s+/g, ' ').trim()", ".trim()", 'whitespace is kept'],
  ['helper', "const piece = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word", "const piece = word", 'a long word is not cut'],
  ['helper', "else if (current.length + 1 + piece.length <= perLine) current += ` ${piece}`", "else if (current.length + piece.length <= perLine) current += ` ${piece}`", 'the space is not counted'],
  ['helper', "else if (current.length + 1 + piece.length <= perLine) current += ` ${piece}`", "else if (current.length + 1 + piece.length < perLine) current += ` ${piece}`", 'a line is one short'],
  ['helper', "if (all.length <= maxLines) return all", "if (all.length < maxLines) return all", 'a name that fills every line is cut'],
  ['helper', "const kept = all.slice(0, maxLines)", "const kept = all.slice(0, maxLines + 1)", 'one line too many'],
  ['helper', "last.endsWith('…') ? last : `${last.slice(0, perLine - 1).trimEnd()}…`", "last", 'no ellipsis'],
  ['helper', "`${last.slice(0, perLine - 1).trimEnd()}…`", "`${last.slice(0, perLine).trimEnd()}…`", 'the ellipsis overflows the line'],
  ['helper', "export const ORDINARY = { fontSize: 13, perLine: 24, maxLines: 2 } as const", "export const ORDINARY = { fontSize: 13, perLine: 25, maxLines: 2 } as const", 'a longer ordinary line'],
  ['helper', "export const IMPORTANT = { fontSize: 15, perLine: 30, maxLines: 3 } as const", "export const IMPORTANT = { fontSize: 15, perLine: 30, maxLines: 2 } as const", 'two lines for the selected one'],
  // helper: placement
  ['helper', "const GAP = 5", "const GAP = 0", 'no gap between labels'],
  ['helper', "const offsets = [radius + 4, -radius - 4 - height]", "const offsets = [-radius - 4 - height, radius + 4]", 'above first'],
  ['helper', "const offsets = [radius + 4, -radius - 4 - height]", "const offsets = [radius + 4]", 'never above'],
  ['helper', "const offsets = [radius + 4, -radius - 4 - height]", "const offsets = [radius + 4, -radius - 4]", 'above overlaps the node'],
  ['helper', "const offsets = [radius + 4, -radius - 4 - height]", "const offsets = [radius, -radius - height]", 'no clearance from the node'],
  ['helper', "const lineHeight = metrics.fontSize + 3", "const lineHeight = metrics.fontSize + 1", 'tighter lines'],
  ['helper', "const height = lines.length * lineHeight + 2", "const height = lines.length * lineHeight", 'a shorter box'],
  ['helper', "const width = Math.max(...lines.map(line => textWidth(line, metrics.fontSize)))", "const width = textWidth(lines[0], metrics.fontSize)", 'the box is the first line wide'],
  ['helper', "const metrics = important ? IMPORTANT : ORDINARY", "const metrics = ORDINARY", 'the selected one is ordinary'],
  ['helper', "r: point.r * paintedScale + 3 }))", "r: point.r * paintedScale }))", 'no margin round a node'],
  ['helper', "(point.node_id === hoverId ? 0 : point.node_id === selectedId ? 1 : 2)", "(point.node_id === selectedId ? 0 : point.node_id === hoverId ? 1 : 2)", 'selected before hovered'],
  ['helper', ".sort((a, b) => priority(a) - priority(b) || b.salience - a.salience)", ".sort((a, b) => priority(a) - priority(b))", 'not by salience'],
  ['helper', ".sort((a, b) => priority(a) - priority(b) || b.salience - a.salience)", ".sort((a, b) => b.salience - a.salience)", 'priority ignored'],
  ['helper', "layout.filter(point => labeledIds.has(point.node_id) || priority(point) < 2)", "layout.filter(point => labeledIds.has(point.node_id))", 'the selected one is not labelled unless it is among the top'],
  ['helper', "layout.filter(point => labeledIds.has(point.node_id) || priority(point) < 2)", "layout", 'every entity is labelled'],
  ['helper', "let offsetY = offsets.find(offset => clear(offset, true) && fitsView(offset))", "let offsetY = offsets.find(offset => clear(offset, false) && fitsView(offset))", 'ordinary labels may sit on a node'],
  ['helper', "let offsetY = offsets.find(offset => clear(offset, true) && fitsView(offset))", "let offsetY = offsets.find(offset => clear(offset, true))", 'ordinary labels may leave the view'],
  ['helper', "if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false) && fitsView(offset))\n", "\n", 'no second chance for the selected one in the view'],
  ['helper', "if (important && offsetY === undefined) offsetY = offsets.find(offset => clear(offset, false))\n", "\n", 'no third chance outside the view'],
  ['helper', "if (important && offsetY === undefined) {\n      offsetY = [1, 2, 3]", "if (offsetY === undefined) {\n      offsetY = [1, 2, 3]", 'extra rows for ordinary labels'],
  ['helper', "offsets[1] - row * (height + GAP + 1)", "offsets[1] + row * (height + GAP + 1)", 'extra rows go down'],
  ['helper', "offsets[1] - row * (height + GAP + 1)", "offsets[1] - row * 2", 'extra rows overlap'],
  ['helper', "extraRow = offsetY !== undefined", "extraRow = false", 'no leader line'],
  ['helper', "if (offsetY === undefined) continue", "if (offsetY === undefined) offsetY = offsets[0]", 'a label with no room is drawn anyway'],
  ['helper', "occupied.push(box)\n    entities.push", "entities.push", 'labels do not take space'],
  ['helper', "x: point.x * paintedScale - width / 2, y: point.y * paintedScale + offsetY", "x: point.x * paintedScale, y: point.y * paintedScale + offsetY", 'not centred'],
  ['helper', "!viewport || (box.x >= viewport.x", "!viewport || (box.x > viewport.x + 50", 'the view is smaller than it is'],
  ['helper', "box.x + box.width <= viewport.x + viewport.width && box.y + box.height <= viewport.y + viewport.height", "box.x + box.width <= viewport.x + viewport.width", 'the bottom of the view is ignored'],
  ['helper', ".slice(0, 8)", ".slice(0, 20)", 'more than 8 relation labels'],
  ['helper', "edge.src_node_id === activeId || edge.dst_node_id === activeId)", "edge.src_node_id === activeId)", 'only outgoing relations'],
  ['helper', "if (!source || !target) continue", "if (!source && !target) continue", 'a relation to a missing entity'],
  ['helper', "if (occupied.some(other => overlaps(box, other)) || hitsCircle(box)) continue", "if (occupied.some(other => overlaps(box, other))) continue", 'a relation label may sit on a node'],
  ['helper', "if (occupied.some(other => overlaps(box, other)) || hitsCircle(box)) continue", "if (hitsCircle(box)) continue", 'a relation label may sit on a name'],
  ['helper', "relations.add(`${edge.src_node_id}-${edge.dst_node_id}-${edge.relation}`)", "relations.add(`${edge.src_node_id}-${edge.dst_node_id}`)", 'the relation key differs from the one the view reads'],
  ['helper', "textWidth(compact(friendlyRelation(relation), 20), 11) + 16)", "textWidth(friendlyRelation(relation), 11) + 16)", 'long relations are not cut'],
  ['helper', "return Math.max(62, textWidth(compact(friendlyRelation(relation), 20), 11) + 16)", "return 10", 'a relation box that is too narrow'],
  ['helper', "return Math.max(62, textWidth(", "return Math.max(40, textWidth(", 'a relation box below the view\'s own floor'],
  ['helper', "const width = relationWidth(edge.relation)", "const width = 62", 'the relation box ignores the text'],
  ['helper', "if (activeId) {", "if (false) {", 'no relation labels'],
  ['helper', "String(relation).replace(/_/g, ' ').toLowerCase()", "String(relation)", 'raw relation words'],
  // graph
  ['graph', "const MAP_LABELS = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS === 'true'", "const MAP_LABELS = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS === 'true'", 'not tied to the Studio controls'],
  ['graph', "const MAP_LABELS = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS === 'true'", "const MAP_LABELS = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS !== 'false'", 'on unless "false"'],
  ['graph', "const MAP_LABELS = STUDIO_GRAPH_CONTROLS && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS === 'true'", "const MAP_LABELS = STUDIO_GRAPH_CONTROLS && Boolean(process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_LABELS)", 'on for any value'],
  ['graph', "(MAP_LABELS ? placeCleanLabels : placeStudioLabels)(layout", "(MAP_LABELS ? placeStudioLabels : placeCleanLabels)(layout", 'the placement is swapped'],
  ['graph', "(MAP_LABELS ? placeCleanLabels : placeStudioLabels)(layout", "(placeCleanLabels)(layout", 'the clean placement flag off'],
  ['graph', "{MAP_LABELS && studioLabels?.entities.map(", "{studioLabels?.entities.map(", 'the clean labels flag off'],
  ['graph', "{!MAP_LABELS && studioLabels?.entities.map(({ point, width: plateWidth", "{studioLabels?.entities.map(({ point, width: plateWidth", 'the plates also flag on'],
  ['graph', 'paintOrder="stroke" stroke="#10182B" strokeWidth={3}', 'stroke="#10182B" strokeWidth={3}', 'no halo'],
  ['graph', 'fill={emphasised ? "#FFFFFF" : "#DCE6F2"} fontSize={fontSize} fontWeight={emphasised ? 600 : 500}', 'fill="#DCE6F2" fontSize={fontSize} fontWeight={500}', 'the selected name looks like the others'],
  ['graph', 'const emphasised = point.node_id === selectedId || point.node_id === hoverId', 'const emphasised = false', 'nothing is emphasised'],
  ['graph', '{lines.map((line, index) => <tspan key={index} x={0} y={offsetY + fontSize + index * lineHeight}>{line}</tspan>)}', '{lines.slice(0, 1).map((line, index) => <tspan key={index} x={0} y={offsetY + fontSize + index * lineHeight}>{line}</tspan>)}', 'only the first line is drawn'],
  ['graph', 'y={offsetY + fontSize + index * lineHeight}', 'y={offsetY + fontSize}', 'the lines are drawn on top of each other'],
  ['graph', "{extraRow && <line data-studio-graph-label-leader=\"true\"", "{false && <line data-studio-graph-label-leader=\"true\"", 'no leader line'],
  ['graph', 'opacity={dimmed ? .18 : 1} transform={`translate(${point.x} ${point.y}) scale(${labelScale})`}>\n              {extraRow', 'opacity={1} transform={`translate(${point.x} ${point.y}) scale(${labelScale})`}>\n              {extraRow', 'labels of dimmed nodes are not dimmed'],
  ['graph', 'data-studio-graph-label-clean="true" aria-hidden="true" className="pointer-events-none"', 'data-studio-graph-label-clean="true" className="pointer-events-none"', 'the label is announced twice'],
  ['graph', 'className="pointer-events-none" opacity={dimmed ? .18 : 1} transform={`translate(${point.x} ${point.y}) scale(${labelScale})`}>\n              {extraRow', 'opacity={dimmed ? .18 : 1} transform={`translate(${point.x} ${point.y}) scale(${labelScale})`}>\n              {extraRow', 'the label takes the pointer'],
  ['graph', 'compactGraphLabel(point.name, 25)}</text>', 'compactGraphLabel(point.name, 30)}</text>', 'the plate label is changed flag off'],
  ['graph', "const width = graphLabelWidth(compactGraphLabel(point.name, 25), fontSize), height = 24", "const width = graphLabelWidth(compactGraphLabel(point.name, 25), fontSize), height = 26", 'the plate placement is changed flag off'],
]
let caught = 0
const uncaught = []
for (const [file, from, to, name] of MUTANTS) {
  const before = checks
  const broken = { ...sources, [file]: mutate(sources[file], [[from, to]], `${file} (${name})`) }
  let failed = false
  try { runAll(broken) } catch (error) { if (error instanceof MutationTargetMissing) throw error; failed = true }
  checks = before
  if (failed) caught++
  else uncaught.push(`${file}: ${name}`)
}
assert.deepEqual(uncaught, [], 'mutants not caught')
checks = real
console.log(`PASS: studio knowledge map labels (${checks} checks, ${caught}/${MUTANTS.length} mutants caught)`)
