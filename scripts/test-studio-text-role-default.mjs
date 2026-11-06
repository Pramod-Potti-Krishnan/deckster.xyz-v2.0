import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

function load(text) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports })
  return module.exports
}
const current = load(fs.readFileSync('lib/text-slot-catalog.ts', 'utf8'))
const previous = load(execFileSync('git', ['show', 'c5464a6:lib/text-slot-catalog.ts'], { encoding: 'utf8' }))
// Real parser and real selection helper. Synthetic catalogue; no services.
const catalog = current.parseTemplateSlotCatalog({ template_id: 'L25', slots: [
  { slot_name: 'logo', role: null, kind: 'accessory', accessory_type: 'LOGO' },
  { slot_name: 'slide_title', role: 'SLIDE_TITLE', kind: 'structural' },
  { slot_name: 'body', role: 'BODY_TEXT', kind: 'body' },
] })
let cases = 0
function check(name, fn) { fn(); cases++; console.log(`PASS ${name}`) }
const unspecified = { semanticRole: null, slotName: null, accessoryType: null }
check('frozen source reproduces generic text selecting Logo', () => {
  assert.equal(previous.selectionForExistingTarget(catalog, unspecified), 'slot:logo')
})
for (const target of [undefined, null, {}, unspecified, { semanticRole: null }, { accessoryType: null }, { semanticRole: '', accessoryType: '' }]) {
  check(`Studio unspecified metadata ${JSON.stringify(target)} stays body auto`, () => {
    assert.equal(current.selectionForExistingTarget(catalog, target, true), current.BODY_TEXT_AUTO_SLOT)
  })
}
const named = [
  [{ ...unspecified, slotName: 'logo' }, 'slot:logo'],
  [{ ...unspecified, slotName: 'body' }, 'slot:body'],
  [{ ...unspecified, slotName: 'unknown' }, current.BODY_TEXT_AUTO_SLOT],
  [{ ...unspecified, semanticRole: 'SLIDE_TITLE' }, 'slot:slide_title'],
  [{ ...unspecified, semanticRole: 'BODY_TEXT' }, 'slot:body'],
  [{ ...unspecified, accessoryType: 'LOGO' }, 'slot:logo'],
  [{ slotName: 'body', semanticRole: 'SLIDE_TITLE', accessoryType: 'LOGO' }, 'slot:body'],
]
for (const [target, expected] of named) check(`Studio explicit target ${JSON.stringify(target)}`, () => {
  assert.equal(current.selectionForExistingTarget(catalog, target, true), expected)
})
for (const target of [unspecified, { ...unspecified, semanticRole: 'SLIDE_TITLE' }, { ...unspecified, accessoryType: 'LOGO' }]) {
  check(`Studio target is independent of catalogue order ${JSON.stringify(target)}`, () => {
    assert.equal(current.selectionForExistingTarget(catalog, target, true), current.selectionForExistingTarget({ ...catalog, slots: [...catalog.slots].reverse() }, target, true))
  })
}
for (const target of [undefined, null, {}, unspecified, ...named.map(([target]) => target)]) {
  for (const flag of [undefined, false]) check(`classic exact source parity ${String(flag)} ${JSON.stringify(target)}`, () => {
    assert.equal(current.selectionForExistingTarget(catalog, target, flag), previous.selectionForExistingTarget(catalog, target))
  })
}
// Execute the actual form effect at each flag value so the helper's Studio-only
// option is exercised through its production caller, not just tested directly.
const text = fs.readFileSync('components/generation-panel/forms/text-box-form.tsx', 'utf8')
const tree = ts.createSourceFile('form.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, pred) { if (pred(node)) return node; let found; ts.forEachChild(node, child => { if (!found) found = find(child, pred) }); return found }
const flagNode = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'STUDIO_CONTENT_FIELDS')
const effect = find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('setTargetValue(selectionForExistingTarget'))
for (const flag of [undefined, 'false', 'TRUE', 'true']) check(`actual form effect flag ${String(flag)}`, () => {
  let selected
  const context = { roleContext: 'generic-target', roleContextRef: { current: null }, activeTargetId: null, slotCatalogLoading: false, BODY_TEXT_AUTO_SLOT: current.BODY_TEXT_AUTO_SLOT, slotSelectionValue: current.slotSelectionValue, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, effectiveCatalog: catalog, existingTextTarget: unspecified, selectionForExistingTarget: current.selectionForExistingTarget, setTargetValue: value => { selected = typeof value === 'function' ? value(current.BODY_TEXT_AUTO_SLOT) : value } }
  vm.runInNewContext(ts.transpileModule(`const STUDIO_CONTENT_FIELDS = ${flagNode.initializer.getText(tree)}; (${effect.arguments[0].getText(tree)})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  assert.equal(selected, flag === 'true' ? current.BODY_TEXT_AUTO_SLOT : 'slot:logo')
})
console.log(`${cases} text role default cases passed; offline only.`)
