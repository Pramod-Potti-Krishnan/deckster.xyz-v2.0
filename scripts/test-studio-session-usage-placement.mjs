import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Actual leaf/menu/rail code with finite local props. No auth, quota or transport calls.
const require = createRequire(import.meta.url)
const node = (type, props) => ({ type, props: props || {} })
const user = { id: 'local-session-usage', name: 'Local account', email: 'local@example.invalid', image: null }
let calls = 0
function component(path, flag, initial = []) {
  const exports = {}
  const state = [...initial]
  const effects = []
  const frames = []
  const timers = []
  let cursor = 0
  const react = {
    useState(init) { const index = cursor++; if (!(index in state)) state[index] = typeof init === 'function' ? init() : init; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }] },
    useRef(init) { return { current: init } },
    useEffect(effect, deps) { effects.push({ effect, deps }) },
    useCallback(fn) { return fn },
  }
  const code = ts.transpileModule(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag, NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' } },
    require(id) {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === '@/hooks/use-auth') return { useAuth: () => ({ user, logout: () => { calls++ }, isLoading: false }) }
      if (id === 'next/navigation') return { usePathname: () => '/builder', useRouter: () => ({ push: () => { calls++ } }) }
      if (id === 'next-themes') return { useTheme: () => ({ theme: 'dark', setTheme: () => { calls++ } }) }
      if (id === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') }
      if (id === 'next/link') return { default: 'Link' }
      if (id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/components/')) return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Unexpected import ${id}`)
    },
    performance: { now: () => 0 }, requestAnimationFrame: fn => { frames.push(fn); return frames.length }, cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimeout: () => {},
    fetch: () => { calls++; throw new Error('No service request is allowed') }, console,
  })
  return { render(name, props) { cursor = 0; effects.length = 0; return exports[name](props) }, state, effects, frames, timers }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(child => all(child, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree !== 'object') return String(tree)
  return Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props.children)
}
const usage = coverage => ({ session: { total_tokens: 14283 }, turn: { total_tokens: 934 }, coverage, action_type: 'local-supplied-turn' })
const quota = kind => ({ status: { flags: { dailyNear: kind === 'near', dailyAt: kind === 'hard' || kind === 'reserve', weeklyNear: false, weeklyAt: false }, walletBalanceCents: kind === 'reserve' ? 2500 : 0, resetAt: { daily: '2099-01-01T00:00:00Z', weekly: '2099-01-04T00:00:00Z' } } })
const topUp = () => { calls++ }
const tokenPath = 'components/builder/token-usage-strip.tsx'
let cases = 0
for (const coverage of ['partial', 'full']) for (const warning of ['none', 'near', 'hard', 'reserve']) for (const mode of ['all', 'counter', 'warning']) {
  const runtime = component(tokenPath, 'true')
  const props = { tokenUsage: usage(coverage), quota: quota(warning), onTopUp: topUp, displayMode: mode }
  const tree = runtime.render('TokenUsageStrip', props)
  assert.equal(runtime.effects.length, 3, 'All modes preserve every existing effect before returning')
  if (mode === 'warning' && warning === 'none') { assert.equal(tree, null); cases++; continue }
  const counters = all(tree, item => item.props['data-studio-token-counter'])
  const warnings = all(tree, item => item.props['data-studio-token-warning'])
  assert.equal(counters.length, mode === 'warning' ? 0 : 1)
  assert.equal(warnings.length, mode === 'counter' || warning === 'none' ? 0 : 1)
  if (counters.length) {
    assert(text(counters[0]).includes('14,283'))
    const badge = all(counters[0], item => item.props['data-studio-token-coverage'])[0]
    assert.equal(badge.props['data-studio-token-coverage'], coverage)
    assert.equal(badge.props['aria-description'], badge.props.title)
    if (mode === 'counter') assert.equal(text(all(tree, item => item.props['data-studio-token-explanation'])[0]), badge.props.title)
  }
  if (warnings.length) {
    assert.equal(warnings[0].props.role, 'status')
    const buttons = all(warnings[0], item => item.type === 'button')
    assert.equal(buttons.length, warning === 'reserve' ? 0 : 1)
    if (buttons.length) assert.strictEqual(buttons[0].props.onClick, topUp)
    assert(text(warnings[0]).includes(warning === 'reserve' ? 'Running on reserve credits' : warning === 'hard' ? 'Daily limit reached' : 'Approaching daily limit'))
  }
  cases++
}
for (const flag of ['false', undefined, 'TRUE']) for (const mode of ['all', 'counter', 'warning']) {
  const p = { tokenUsage: usage('partial'), quota: quota('hard'), onTopUp: topUp }
  const baseline = component(tokenPath, flag).render('TokenUsageStrip', p)
  const alternate = component(tokenPath, flag).render('TokenUsageStrip', { ...p, displayMode: mode })
  assert.equal(JSON.stringify(alternate), JSON.stringify(baseline), 'Nonliteral/classic ignores displayMode')
}
const animation = component(tokenPath, 'true')
animation.render('TokenUsageStrip', { tokenUsage: usage('partial'), displayMode: 'counter' })
animation.effects.forEach(({ effect }) => effect())
assert.equal(animation.frames.length, 1)
assert.equal(animation.timers[0].ms, 4500)
assert.equal(animation.state[0], 14283, 'New popup mount starts at the current supplied total')
assert.equal(animation.state[1], true)
animation.timers[0].fn()
assert.equal(animation.state[1], false)
const slot = node('supplied-usage', {})
for (const flag of ['true', 'false', undefined]) {
  const runtime = component('components/user-profile-menu.tsx', flag)
  const tree = runtime.render('UserProfileMenu', { sessionUsage: slot })
  const slots = all(tree, item => item.props['data-studio-session-usage'])
  assert.equal(slots.length, flag === 'true' ? 1 : 0, 'Native slot is independent of null quota')
  if (slots.length) { assert.strictEqual(slots[0].props.children, slot); assert.equal(slots[0].props.role, 'group') }
  const empty = runtime.render('UserProfileMenu', {})
  assert.equal(all(empty, item => item.props['data-studio-session-usage']).length, 0)
}
const rail = component('components/layout/studio-rail.tsx', 'true').render('StudioRail', { sessionUsage: slot })
assert.strictEqual(all(rail, item => item.type === 'UserProfileMenu')[0].props.sessionUsage, slot)
assert.equal(calls, 0)
console.log(`Studio session usage placement: ${cases} native modes, classic/nonliteral parity, all effects/timer/current total, independent menu slot and rail forwarding passed; zero requests/actions.`)
