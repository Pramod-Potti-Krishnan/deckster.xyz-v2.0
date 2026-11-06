import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import postcss from 'postcss'

const source = fs.readFileSync(new URL('./studio-v4/ten-hour-usage-fixture.tsx', import.meta.url), 'utf8')
const state = [], effects = [], imports = []
let cursor = 0, requests = 0
const node = (type, props) => ({ type, props: props || {} })
const exports = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, module: { exports }, Date,
  require(id) {
    imports.push(id)
    if (id === 'react') return {
      useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
      useEffect(fn, deps) { effects.push({ fn, deps }) },
    }
    if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
    if (id === '@/components/builder/token-usage-strip') return { TokenUsageStrip: 'NativeTokenUsageStrip' }
    if (id === '@/components/builder/topup-modal') return { TopUpModal: 'NativeTopUpModal' }
    if (id === '@/components/user-profile-menu') return { UserProfileMenu: 'NativeUserProfileMenu' }
    if (id.endsWith('.css')) return {}
    throw new Error(`Unexpected runtime dependency ${id}`)
  },
  fetch() { requests++; throw new Error('No services allowed') },
})
function render(props = {}) { cursor = 0; effects.length = 0; return exports.default(props) }
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
const find = (tree, predicate) => { const matches = all(tree, predicate); assert.equal(matches.length, 1); return matches[0] }
const checkbox = tree => find(tree, item => item.props.id === 'local-long-session-counter')
const menu = tree => find(tree, item => item.type === 'NativeUserProfileMenu')
const strip = tree => find(tree, item => item.type === 'NativeTokenUsageStrip')
const popup = tree => find(tree, item => item.type === 'NativeTopUpModal')
let tree = render({ state: 'partial' })
assert.equal(checkbox(tree).props.checked, false)
assert.equal(menu(tree).props.sessionUsage.props.tokenUsage.session.total_tokens, 14283)
checkbox(tree).props.onChange({ target: { checked: true } })
find(tree, item => item.props.id === 'local-usage-draft').props.onChange({ target: { value: 'Retained local composer draft' } })
for (const fixtureState of ['partial', 'full', 'near', 'hard', 'reserve']) {
  tree = render({ state: fixtureState }); effects[0].fn(); tree = render({ state: fixtureState })
  const supplied = exports.usageFixtureProps(fixtureState, state[1])
  assert.deepEqual(strip(tree).props.tokenUsage, supplied.tokenUsage)
  assert.deepEqual(strip(tree).props.quota.status, supplied.quota.status)
  const account = menu(tree)
  assert.equal(account.props.studioLabels, true); assert.equal(account.props.studioPalette, true)
  assert.equal(account.props.sessionUsage.type, 'NativeTokenUsageStrip')
  assert.equal(account.props.sessionUsage.props.displayMode, 'counter')
  assert.equal(account.props.sessionUsage.props.tokenUsage.session.total_tokens, 1234567890)
  assert.equal(account.props.sessionUsage.props.tokenUsage.turn.total_tokens, 934)
  assert.equal(account.props.sessionUsage.props.tokenUsage.coverage, fixtureState === 'full' ? 'full' : 'partial')
  assert.equal(account.props.sessionUsage.props.quota, undefined)
  assert.equal(account.props.sessionUsage.props.onTopUp, undefined)
  assert.equal(find(tree, item => item.props.id === 'local-usage-draft').props.value, 'Retained local composer draft')
  strip(tree).props.onTopUp(); tree = render({ state: fixtureState }); assert.equal(popup(tree).props.open, true)
  popup(tree).props.onOpenChange(false); tree = render({ state: fixtureState }); assert.equal(popup(tree).props.open, false)
  assert.equal(checkbox(tree).props.checked, true)
}
checkbox(tree).props.onChange({ target: { checked: false } }); tree = render({ state: 'reserve' })
assert.equal(menu(tree).props.sessionUsage.props.tokenUsage.session.total_tokens, 14283)
assert.equal(menu(tree).props.sessionUsage.props.tokenUsage.turn.total_tokens, 934)
assert.equal(all(tree, item => item.type === 'nav')[0].props.children.length, 5)
assert.equal(requests, 0)
assert(!imports.some(id => id.startsWith('@/hooks/')), 'Service hook types must not become runtime dependencies')
postcss.parse(find(tree, item => item.type === 'style').props.children)
assert(source.includes('not a ledger acknowledgement'))
assert(source.includes('Reopening repeats the existing current-turn delta'))
console.log('Native usage account fixture: all five original states, long/default counter, actual component boundaries, retained draft/checkbox, unchanged popup open/close and type-only hooks passed; zero requests/actions.')
