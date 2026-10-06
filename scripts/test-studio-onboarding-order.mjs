import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// This compatibility test renders the real route body with isolated state/JSX
// adapters. Shared UI tokens do not run effects; no browser or service exists.
const current = fs.readFileSync(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8')
const before = execFileSync('git', ['show', 'd1e0b18:app/onboarding/page.tsx'], { encoding: 'utf8' })
function helperBlock(source) {
  const file = ts.createSourceFile('onboarding.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.equal(file.parseDiagnostics.length, 0)
  let declaration
  function visit(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(file) === 'getPromptSuggestions')) declaration = node
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(declaration)
  const start = source.lastIndexOf('\n', declaration.getStart(file)) + 1
  const end = declaration.getEnd() + 2 // Native blank line after the declaration.
  return { block: source.slice(start, end), start, end, initializer: declaration.declarationList.declarations[0].initializer.getText(file) }
}
const oldHelper = helperBlock(before), newHelper = helperBlock(current)
assert.equal(newHelper.block, oldHelper.block, 'suggestion helper bytes unchanged')
assert.equal(current.slice(0, newHelper.start) + current.slice(newHelper.end), before.slice(0, oldHelper.start) + before.slice(oldHelper.end), 'every byte outside declaration position unchanged')
assert.ok(newHelper.start < current.indexOf('  const steps = ['), 'helper initialized before eager steps JSX')
const helperContext = {}
vm.runInNewContext(ts.transpileModule(`globalThis.getSuggestions = ${oldHelper.initializer}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, helperContext)

const modules = {
  '@/components/ui/button': ['Button'],
  '@/components/ui/card': ['Card', 'CardContent', 'CardDescription', 'CardHeader', 'CardTitle'],
  '@/components/ui/badge': ['Badge'], '@/components/ui/progress': ['Progress'],
  '@/components/ui/radio-group': ['RadioGroup', 'RadioGroupItem'], '@/components/ui/label': ['Label'],
  '@/components/ui/dialog': ['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle'],
  'lucide-react': ['Sparkles', 'MessageSquare', 'Layout', 'Users', 'ArrowRight', 'Play', 'Briefcase', 'GraduationCap', 'TrendingUp', 'Palette', 'BarChart3', 'Rocket', 'FileText', 'CheckCircle2', 'PartyPopper', 'Target', 'UserCircle', 'FileUp'],
}
function renderHarness(source, initialStates) {
  const states = [...initialStates], navigation = []
  let cursor = 0
  const module = { exports: {} }
  const context = {
    module, exports: module.exports,
    require(name) {
      if (name === 'react') return { useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] } }
      if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' }
      if (name === 'next/navigation') return { useRouter: () => ({ push: value => navigation.push(value) }) }
      if (name === 'next/link') return { default: 'Link', __esModule: true }
      assert.ok(modules[name], `unapproved isolated dependency ${name}`)
      return Object.fromEntries(modules[name].map(value => [value, value]))
    },
    setTimeout: () => assert.fail('test must not invoke the inherited timer success flow'),
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
  assert.equal(compiled.diagnostics.length, 0)
  vm.runInNewContext(compiled.outputText, context)
  return { render() { cursor = 0; return module.exports.default() }, states, navigation }
}
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join(' ')
  return text(node.props?.children)
}
function all(node, predicate, found = []) {
  if (Array.isArray(node)) { for (const child of node) all(child, predicate, found); return found }
  if (!node || typeof node !== 'object') return found
  if (predicate(node)) found.push(node)
  all(node.props?.children, predicate, found)
  return found
}
const snapshot = node => JSON.stringify(node, (key, value) => typeof value === 'function' ? '[native callback]' : value)
const statesFor = (step, useCase, startingPoint) => [step, false, false, useCase, '', '', startingPoint]
assert.throws(() => renderHarness(before, statesFor(4, 'sales', 'scratch')).render(), /Cannot access 'getPromptSuggestions' before initialization/, 'baseline native scratch/use-case branch reproduces the real TDZ')

const useCases = ['sales', 'marketing', 'education', 'business', 'creative', 'startup', 'unknown-native-case', '']
let renders = 0
for (const useCase of useCases) {
  for (const startingPoint of ['', 'scratch', 'template']) {
    for (let step = 0; step < 5; step++) {
      const state = statesFor(step, useCase, startingPoint)
      const currentTree = renderHarness(current, state).render()
      renders++
      if (startingPoint !== 'scratch' || !useCase) {
        assert.equal(snapshot(currentTree), snapshot(renderHarness(before, state).render()), 'native non-TDZ branch output unchanged')
      }
      if (step === 4 && startingPoint === 'scratch' && useCase) {
        const buttons = all(currentTree, node => node.type === 'button')
        const suggestions = helperContext.getSuggestions(useCase)
        for (const suggestion of suggestions) assert.ok(buttons.some(node => text(node).includes(suggestion)), `full native prompt retained for ${useCase}`)
        assert.equal(buttons.filter(node => text(node).startsWith('→')).length, 3)
      }
    }
  }
}
const caseTree = renderHarness(current, statesFor(1, '', '')).render()
const caseButtons = all(caseTree, node => node.type === 'button')
assert.equal(caseButtons.length, 6)
assert.deepEqual(caseButtons.map(text).map(value => value.trim().replace(/\s+/g, ' ')), [
  'Sales Pitches Win more deals with compelling pitch decks', 'Marketing Decks Showcase campaigns and results',
  'Educational Content Teach and train effectively', 'Business Reports Present data and insights',
  'Creative Projects Portfolios and showcases', 'Startup Pitches Fundraising and investor decks',
])
const roleTree = renderHarness(current, statesFor(2, '', '')).render()
assert.deepEqual(all(roleTree, node => node.type === 'RadioGroupItem').map(node => node.props.value), ['marketer', 'sales', 'educator', 'founder', 'designer', 'consultant', 'student', 'other'])
const teamTree = renderHarness(current, statesFor(3, '', '')).render()
assert.equal(all(teamTree, node => node.type === 'button').length, 4)
// Native click setters and real router callbacks remain local; nothing sends.
const interactive = renderHarness(current, statesFor(1, '', ''))
all(interactive.render(), node => node.type === 'button')[0].props.onClick()
assert.equal(interactive.states[3], 'sales')
all(interactive.render(), node => node.type === 'Button' && text(node).includes('Skip to Dashboard'))[0].props.onClick()
assert.deepEqual(interactive.navigation, ['/dashboard'])
for (const start of ['scratch', 'template']) {
  const h = renderHarness(current, [4, false, true, 'sales', 'founder', 'solo', start])
  const finish = all(h.render(), node => node.type === 'Button' && ['Start Creating', 'Browse Templates'].some(label => text(node).includes(label)))[0]
  finish.props.onClick()
  assert.deepEqual(h.navigation, [start === 'template' ? '/templates' : '/builder'])
}
console.log(`Onboarding order: baseline TDZ reproduced; ${renders} native branch renders pass; exact suggestions/use-case/role/team/start options, callbacks and every byte outside declaration position preserved. Direct-route compatibility only; no main Builder reachability or service completion claimed.`)
