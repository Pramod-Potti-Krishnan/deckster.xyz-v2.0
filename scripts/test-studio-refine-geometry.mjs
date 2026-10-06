import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const source = fs.readFileSync('app/builder/page.tsx', 'utf8')
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, predicate) {
  if (predicate(node)) return node
  let result
  ts.forEachChild(node, child => { if (!result) result = find(child, predicate) })
  return result
}
const memo = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'generationElementContext')
const flag = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'studioShell')
assert.ok(memo && flag, 'actual Builder memo and flag exist')
const callback = memo.initializer.arguments[0].getText(tree)
const expression = ts.transpileModule(`(${callback})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const flagExpression = ts.transpileModule(flag.initializer.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const blank = { elementId: 'older-blank', startCol: 2, startRow: 4, width: 8, height: 5 }
const target = { elementId: 'native-metric', gridPosition: { start_col: 3, start_row: 7, position_width: 14, position_height: 8, auto_position: false } }
let cases = 0
function check(name, fn) { fn(); cases++; console.log(`PASS ${name}`) }
function run({ enabled = 'true', mode = 'refine', type = 'METRICS', refine = target, active = blank } = {}) {
  const context = { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: enabled } }, generationPanel: { mode, elementType: type, refineContext: refine }, blankElements: { activePosition: active } }
  context.studioShell = vm.runInNewContext(flagExpression, context)
  return vm.runInNewContext(expression, context)
}
const normalize = value => JSON.parse(JSON.stringify(value))
for (const type of ['METRICS', 'TABLE', 'IMAGE', 'CHART', 'TEXT_BOX']) {
  check(`${type} native geometry and exact target replace stale blank context`, () => {
    assert.deepEqual(normalize(run({ type })), { elementId: target.elementId, startCol: 3, startRow: 7, width: 14, height: 8 })
  })
  check(`${type} native geometry works without any Add Element selection`, () => {
    assert.deepEqual(normalize(run({ type, active: null })), { elementId: target.elementId, startCol: 3, startRow: 7, width: 14, height: 8 })
  })
  check(`${type} fractional live bounds are preserved`, () => {
    const refine = { elementId: 'fractional', gridPosition: { start_col: 1.4, start_row: 3.2, position_width: 8.6, position_height: 4.1 } }
    assert.deepEqual(normalize(run({ type, refine })), { elementId: 'fractional', startCol: 1.4, startRow: 3.2, width: 8.6, height: 4.1 })
  })
  for (const enabled of [undefined, '', 'false', 'TRUE']) check(`${type} exact default-off parity for flag ${String(enabled)}`, () => {
    // Explicit undefined must bypass the run helper's default argument.
    const context = { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: enabled } }, generationPanel: { mode: 'refine', elementType: type, refineContext: target }, blankElements: { activePosition: blank } }
    context.studioShell = vm.runInNewContext(flagExpression, context)
    assert.equal(vm.runInNewContext(expression, context), blank)
  })
  for (const mode of ['generate', 'edit']) check(`${type} ${mode} keeps original blank context`, () => assert.equal(run({ type, mode }), blank))
  for (const refine of [undefined, null, { elementId: 'no-grid', gridPosition: null }]) check(`${type} missing native context preserves original fallback`, () => {
    const context = { studioShell: true, generationPanel: { mode: 'refine', elementType: type, refineContext: refine }, blankElements: { activePosition: blank } }
    assert.equal(vm.runInNewContext(expression, context), blank)
  })
}
for (const type of ['ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM']) check(`${type} existing behavior unchanged`, () => assert.equal(run({ type }), blank))
check('actual inspector prop uses the memo result', () => {
  const prop = find(tree, node => ts.isJsxAttribute(node) && node.name.getText(tree) === 'elementContext' && node.initializer?.getText(tree) === '{generationElementContext}')
  assert.ok(prop)
})
check('memo observes target replacement, form mode, flags and native Add Element bounds', () => {
  const dependencies = memo.initializer.arguments[1].elements.map(node => node.getText(tree))
  assert.deepEqual(dependencies, ['studioShell', 'generationPanel.mode', 'generationPanel.elementType', 'generationPanel.refineContext', 'blankElements.activePosition'])
})
check('context calculation leaves saved records and old blank untouched', () => {
  const before = JSON.stringify({ target, blank }); run(); assert.equal(JSON.stringify({ target, blank }), before)
})
check('frozen Builder reproduces the geometry handoff gap', () => {
  const prior = execFileSync('git', ['show', '3649af3:app/builder/page.tsx'], { encoding: 'utf8' })
  assert.ok(prior.includes('elementContext={blankElements.activePosition}'))
  assert.notEqual(blank.width, target.gridPosition.position_width)
  assert.notEqual(blank.startCol, target.gridPosition.start_col)
})
console.log(`${cases} actual Builder geometry checks passed; offline only.`)
