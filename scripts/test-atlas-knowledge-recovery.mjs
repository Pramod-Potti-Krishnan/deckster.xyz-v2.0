import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Offline component transitions only. Hook results below are unit-test inputs,
// never network acknowledgements or connected-service acceptance evidence.
function componentHarness(relativePath, internalExport, studio = true) {
  const source = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  const cells = [], effects = [], layoutEffects = []
  let cursor = 0, requests = 0
  const jsx = (type, props) => ({ type, props: props || {} })
  const exports = {}
  const output = ts.transpileModule(`${source}\nexport { ${internalExport} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  })
  assert.equal((output.diagnostics || []).length, 0)
  vm.runInNewContext(output.outputText, {
    exports, module: { exports }, Date, Intl, AbortController, Set, Map,
    process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } },
    require(id) {
      if (id === 'react') return {
        useState(initial) {
          const index = cursor++
          if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
          return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }]
        },
        useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
        useEffect(fn) { effects.push(fn) },
        useLayoutEffect(fn) { layoutEffects.push(fn); effects.push(fn) },
        useCallback(fn) { return fn },
        useMemo(fn) { return fn() },
      }
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
      if (id.endsWith('.css')) return {}
      if (id === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') }
      if (id.endsWith('kg-graph-view')) return { typeColor: () => '#60A5FA', KgGraphView: 'KgGraphView' }
      if (id === 'next/link') return { __esModule: true, default: 'Link' }
      return new Proxy({}, { get: (_, key) => String(key) })
    },
    fetch() { requests++; throw new Error('Unexpected service request in an offline component test') },
  })
  return {
    render(kg) { cursor = 0; effects.length = 0; layoutEffects.length = 0; const tree = exports[internalExport]({ kg }); layoutEffects.forEach(fn => fn()); return tree },
    effects, get requests() { return requests },
  }
}

function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => all(item, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found)
  return found
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree !== 'object') return String(tree)
  if (Array.isArray(tree)) return tree.map(text).join(' ')
  return text(tree.props?.children)
}
function one(tree, predicate) { const matches = all(tree, predicate); assert.equal(matches.length, 1); return matches[0] }
const button = (tree, label) => one(tree, item => item.type === 'Button' && text(item).trim() === label)
const consent = tree => one(tree, item => item.type === 'Switch')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function access() {
  return {
    accountKey: 'test-owner', userId: 'test-owner', managementLifetime: 'owned-test-lifetime',
    isAuthenticated: true, managementReady: true, isEntitlementLoading: false, settingsRefreshing: false, isMutating: false,
    isLoading: false, isEntitled: true, isSubscribed: true,
    serviceAvailable: true, error: null,
    settings: { user_id: 'test-owner', subscribed: true, cross_session_enabled: true, consent_version: '2026-05-28-v1' },
    capability: { source: 'knowledge_graph', configured: true, available: true, code: null, reason: null },
    subscribe: async () => true, unsubscribe: async () => true, purge: async () => null, refetch: async () => {},
  }
}

const settingsPath = 'app/(app)/settings/knowledge-graph/page.tsx'
for (const studio of [true, false]) {
  const harness = componentHarness(settingsPath, 'KnowledgeGraphSettingsForAccount', studio)
  const kg = access()
  let purgeCalls = 0, consentCalls = 0, refreshCalls = 0
  let pending = deferred()
  kg.purge = () => { purgeCalls++; return pending.promise }
  kg.unsubscribe = async () => { consentCalls++; return true }
  kg.refetch = async () => { refreshCalls++ }
  let tree = harness.render(kg)
  assert.equal(consent(tree).props.checked, true)
  assert.equal(consent(tree).props.disabled, false)
  const oldConsent = consent(tree).props.onCheckedChange
  button(tree, 'Delete').props.onClick()
  tree = harness.render(kg)
  assert.equal(consent(tree).props.disabled, true, 'Confirmation owns consent until Cancel/result')
  const submit = button(tree, 'Delete Knowledge data').props.onClick
  const oldCancel = button(tree, 'Cancel').props.onClick
  const attempt = submit()
  await submit()
  await oldConsent(false)
  oldCancel()
  assert.equal(purgeCalls, 1, 'Repeated submission must issue one hook mutation')
  assert.equal(consentCalls, 0, 'No overlapping consent request')
  tree = harness.render(kg)
  assert.equal(button(tree, 'Deleting…').props.disabled, true)
  assert.equal(button(tree, 'Deleting…').props['aria-busy'], true)
  assert.equal(button(tree, 'Cancel').props.disabled, true)
  assert.match(text(tree), /Waiting for the deletion receipt/)
  kg.error = 'Deletion was refused'
  pending.resolve(null)
  await attempt
  tree = harness.render(kg)
  assert.match(text(tree), /Deletion was not confirmed/)
  assert.equal(button(tree, 'Delete Knowledge data').props.disabled, false)
  assert.equal(button(tree, 'Cancel').props.disabled, false)
  assert.equal(consent(tree).props.checked, true, 'No optimistic consent change on refusal')
  assert(!text(tree).includes('Deleted 0'))
  if (studio) {
    const retry = one(tree, item => item.props['data-studio-knowledge-settings-retry'] === 'true')
    assert.equal(retry.props.disabled, false, 'Refused deletion may re-read settings with confirmation retained')
    retry.props.onClick()
    assert.equal(refreshCalls, 1)
    // Reuse this captured callback to verify its guard before a new render.
    pending = deferred()
    const secondAttempt = button(tree, 'Delete Knowledge data').props.onClick()
    retry.props.onClick()
    assert.equal(refreshCalls, 1, 'No settings-read race during a deletion')
    pending.resolve({ user_id: 'test-owner', settings_deleted: true, nodes_deleted: 7, edges_deleted: 4, evidence_deleted: 9 })
    await secondAttempt
    kg.settings = null; kg.isSubscribed = false; kg.error = null
    tree = harness.render(kg)
    assert.match(text(tree), /7 entities, 4 relations, and 9 evidence items removed/)
    assert.equal(all(tree, item => item.type === 'Button' && text(item).includes('Delete Knowledge data')).length, 0)
  } else {
    oldCancel()
    tree = harness.render(kg)
    assert.equal(button(tree, 'Delete').props.disabled, false)
    assert.equal(consent(tree).props.disabled, false)
    assert.equal(all(tree, item => item.props['data-studio-knowledge-settings-card']).length, 0, 'Classic markers remain absent')
  }
  assert.equal(harness.requests, 0)
}

// Consent serialization includes stale handlers from the previous render.
{
  const harness = componentHarness(settingsPath, 'KnowledgeGraphSettingsForAccount')
  const kg = access(), pending = deferred()
  let calls = 0
  kg.unsubscribe = () => { calls++; return pending.promise }
  let tree = harness.render(kg)
  const oldDelete = button(tree, 'Delete').props.onClick
  const oldToggle = consent(tree).props.onCheckedChange
  const attempt = oldToggle(false)
  await oldToggle(false)
  oldDelete()
  tree = harness.render(kg)
  assert.equal(calls, 1)
  assert.equal(button(tree, 'Delete').props.disabled, true)
  assert.equal(all(tree, item => item.type === 'Button' && text(item).includes('Delete Knowledge data')).length, 0)
  pending.resolve(false); await attempt
  tree = harness.render(kg)
  assert.equal(consent(tree).props.checked, true)
  assert.equal(consent(tree).props.disabled, false)
}

// Capability/settings uncertainty never exposes an actionable consent change.
for (const override of [{ settings: null }, { serviceAvailable: false }, { capability: { available: false } }]) {
  const harness = componentHarness(settingsPath, 'KnowledgeGraphSettingsForAccount')
  const kg = { ...access(), ...override, managementReady: false }
  let calls = 0
  kg.subscribe = kg.unsubscribe = kg.purge = async () => { calls++; return null }
  const tree = harness.render(kg)
  assert.equal(consent(tree).props.disabled, true)
  assert.equal(button(tree, 'Delete').props.disabled, true)
  await consent(tree).props.onCheckedChange(false)
  button(tree, 'Delete').props.onClick()
  assert.equal(calls, 0)
}

// A thrown hook result and an account unmount must also release safely.
{
  const harness = componentHarness(settingsPath, 'KnowledgeGraphSettingsForAccount')
  const kg = access()
  kg.purge = async () => { throw new Error('Interrupted test promise') }
  let tree = harness.render(kg)
  button(tree, 'Delete').props.onClick(); tree = harness.render(kg)
  await button(tree, 'Delete Knowledge data').props.onClick()
  tree = harness.render(kg)
  assert.match(text(tree), /Deletion was not confirmed/)
  assert.equal(button(tree, 'Cancel').props.disabled, false)
  const pending = deferred(); kg.purge = () => pending.promise
  const cleanup = harness.effects[1]()
  const attempt = button(tree, 'Delete Knowledge data').props.onClick()
  cleanup()
  pending.resolve({ user_id: 'test-owner', settings_deleted: true, nodes_deleted: 12, edges_deleted: 5, evidence_deleted: 8 })
  await attempt
  tree = harness.render(kg)
  assert(!text(tree).includes('12 entities'), 'Old account continuation cannot present a result')
}

// A failed settings read must not be mislabelled as the unsubscribed setup state.
for (const studio of [true, false]) {
  const harness = componentHarness('app/(app)/knowledge/page.tsx', 'KnowledgePageForAccount', studio)
  const kg = { ...access(), settings: null, isSubscribed: false, error: 'Settings endpoint unavailable', serviceAvailable: true }
  let retries = 0; kg.refetch = async () => { retries++ }
  let tree = harness.render(kg)
  assert.equal(tree.props.kind, 'unavailable')
  tree.props.onRetry(); assert.equal(retries, 1)
  tree = harness.render({ ...kg, error: null, settings: { subscribed: false } })
  assert.equal(tree.props.kind, 'paused')
  assert.equal(harness.requests, 0)
}
console.log('Atlas Knowledge: offline busy/refusal/retry, consent serialization, capability uncertainty, account cleanup, and access recovery passed in Studio/classic; zero service requests.')
