import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const path = 'app/(app)/settings/security/page.tsx'
const baseline = readAtlasBaseline(`b386174:${path}`)
const current = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))

// All DELETE responses and signOut calls are injected unit inputs/counters.
// No real fetch, authentication, signOut or account operation is performed.
function harness(source = current, studio = true, legacy = false) {
  const auth = { user: { id: 'owner-a' }, isLoading: false, isAuthenticated: true }
  const outer = { cells: [], effects: [], cursor: 0 }, frames = new Map()
  let active, leaf, signOutImpl = async () => {}
  const deletes = [], signOuts = []
  const exports = {}, jsx = (type, props, key) => ({ type, props: props || {}, key })
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
  assert.equal(compiled.diagnostics.length, 0)
  vm.runInNewContext(compiled.outputText, {
    exports, module: { exports }, AbortController,
    process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } },
    console: { error() {} },
    require(id) {
      if (id === 'react') return {
        useState(initial) { const frame = active, index = frame.cursor++; if (!(index in frame.cells)) frame.cells[index] = typeof initial === 'function' ? initial() : initial; return [frame.cells[index], value => { frame.cells[index] = typeof value === 'function' ? value(frame.cells[index]) : value }] },
        useRef(initial) { const index = active.cursor++; if (!(index in active.cells)) active.cells[index] = { current: initial }; return active.cells[index] },
        useEffect(create, deps) { const index = active.cursor++; if (!same(active.effects[index]?.deps, deps)) active.effects[index] = { create, deps, previous: active.effects[index]?.cleanup, changed: true } },
      }
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
      if (id === '@/hooks/use-auth') return { useAuth: () => auth }
      if (id === 'next-auth/react') return { signOut: options => { signOuts.push({ owner: auth.user?.id, options }); return signOutImpl() } }
      if (id.endsWith('.css')) return {}
      return new Proxy({}, { get: (_, key) => String(key) })
    },
    fetch(url, options) { const pending = deferred(); deletes.push({ url, options, pending }); return pending.promise },
  })
  function outerRender() { active = outer; outer.cursor = 0; return exports.default() }
  function unmountFrame(frame) { if (frame) for (const effect of frame.effects) effect?.cleanup?.() }
  return {
    auth, deletes, signOuts, outerRender,
    render() {
      if (legacy) { leaf ||= { cells: [], effects: [], cursor: 0 }; active = leaf; leaf.cursor = 0; return exports.default() }
      const owned = outerRender()
      if (!frames.has(owned.key)) { unmountFrame(leaf); frames.set(owned.key, { cells: [], effects: [], cursor: 0 }) }
      leaf = frames.get(owned.key); active = leaf; leaf.cursor = 0
      return owned.type(owned.props)
    },
    effects() { for (const effect of leaf.effects) if (effect?.changed) { effect.previous?.(); effect.cleanup = effect.create(); effect.changed = false } },
    replay() { unmountFrame(leaf); for (const effect of leaf.effects) if (effect) effect.cleanup = effect.create() },
    unmount() { unmountFrame(leaf) },
    signOutImplementation(fn) { signOutImpl = fn },
  }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => all(item, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found); return found
}
function text(tree) { if (tree == null || typeof tree === 'boolean') return ''; if (typeof tree !== 'object') return String(tree); return Array.isArray(tree) ? tree.map(text).join(' ').replace(/\s+/g, ' ') : text(tree.props?.children) }
const one = (tree, predicate) => { const items = all(tree, predicate); assert.equal(items.length, 1); return items[0] }
const button = (tree, label) => one(tree, item => item.type === 'Button' && text(item).trim() === label)
const input = tree => one(tree, item => item.type === 'Input')
function render(h) { const tree = h.render(); h.effects(); return tree }
function confirm(h, value = 'DELETE') {
  let tree = render(h); button(tree, 'Delete Account').props.onClick()
  tree = render(h); input(tree).props.onChange({ target: { value } }); return render(h)
}
const ok = { ok: true }
const refused = { ok: false, json: async () => ({ error: 'Deletion refused by unit input' }) }

// Reproduce the actual baseline races before asserting corrected behavior.
{
  const h = harness(baseline, true, true), tree = confirm(h)
  const submit = button(tree, 'Delete My Account').props.onClick
  const first = submit(), second = submit()
  assert.equal(h.deletes.length, 2, 'Baseline has no synchronous duplicate guard')
  h.deletes[0].pending.resolve(refused); h.deletes[1].pending.resolve(refused)
  await Promise.all([first, second])
}
{
  const h = harness(baseline, true, true), tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.auth.user = { id: 'owner-b' }
  h.deletes[0].pending.resolve(ok); await request
  assert.equal(h.signOuts[0].owner, 'owner-b', 'Baseline late A reply attempts signOut during B')
}

for (const studio of [true, false]) {
  const h = harness(current, studio)
  let tree = confirm(h, 'delete')
  assert.equal(button(tree, 'Delete My Account').props.disabled, true)
  await button(tree, 'Delete My Account').props.onClick()
  assert.equal(h.deletes.length, 0)
  input(tree).props.onChange({ target: { value: ' DELETE ' } }); tree = render(h)
  const submit = button(tree, 'Delete My Account').props.onClick
  const oldCancel = button(tree, 'Cancel').props.onClick
  const oldInput = input(tree).props.onChange
  const request = submit(); await submit(); oldCancel(); oldInput({ target: { value: '' } })
  assert.equal(h.deletes.length, 1)
  assert.equal(h.deletes[0].url, '/api/account')
  assert.equal(h.deletes[0].options.method, 'DELETE')
  assert.equal(h.deletes[0].options.body, undefined)
  assert.equal(h.deletes[0].options.signal.aborted, false)
  tree = render(h)
  assert.equal(button(tree, 'Deleting…').props.disabled, true)
  assert.equal(button(tree, 'Cancel').props.disabled, true)
  assert.equal(input(tree).props.value, ' DELETE ')
  h.deletes[0].pending.resolve(refused); await request
  tree = render(h)
  assert.match(text(tree), /Deletion refused by unit input/)
  assert.equal(input(tree).props.value, ' DELETE ')
  assert.equal(button(tree, 'Delete My Account').props.disabled, false)
  assert.equal(h.signOuts.length, 0)
  button(tree, 'Cancel').props.onClick(); oldInput({ target: { value: 'DELETE' } }); await submit()
  assert.equal(h.deletes.length, 1, 'Captured submit/input cannot resurrect a cancelled confirmation')
  tree = render(h); button(tree, 'Delete Account').props.onClick(); tree = render(h)
  assert.equal(input(tree).props.value, '')
  assert(!text(tree).includes('Deletion refused by unit input'))
  assert.equal(button(tree, 'Delete My Account').props.disabled, true)
  assert.match(text(tree), /Google Sign-In/); assert.match(text(tree), /App-level TOTP is planned/)
  assert.match(text(tree), /Currently signed in with Google/); assert.match(text(tree), /Connected/)
  if (!studio) assert.equal(all(tree, item => item.props['data-studio-security']).length, 0)
}

// Transport loss is uncertain; unreadable refusal releases the same draft.
{
  const h = harness(); let tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.deletes[0].pending.reject(new Error('Injected transport loss')); await request
  tree = render(h)
  assert.match(text(tree), /request may have completed/)
  assert.equal(button(tree, 'Delete My Account').props.disabled, false)
  assert.equal(input(tree).props.value, 'DELETE')
  assert.equal(h.signOuts.length, 0)
  const retry = button(tree, 'Delete My Account').props.onClick()
  h.deletes[1].pending.resolve({ ok: false, json: async () => { throw new Error('Injected unreadable refusal') } })
  await retry; tree = render(h)
  assert.match(text(tree), /Failed to delete account/)
  assert.equal(button(tree, 'Delete My Account').props.disabled, false)
  assert.equal(h.signOuts.length, 0)
}

// Owner changes fence the response even BEFORE A's effect cleanup occurs.
{
  const h = harness(); let tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.auth.user = { id: 'owner-b' }
  assert.equal(h.outerRender().key, 'owner-b')
  h.deletes[0].pending.resolve(ok); await request
  assert.equal(h.signOuts.length, 0)
  tree = render(h)
  assert.equal(button(tree, 'Delete Account').props.disabled, false)
  assert.equal(all(tree, item => item.type === 'Input').length, 0)
}
{
  const h = harness(); let tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.unmount()
  assert.equal(h.deletes[0].options.signal.aborted, true)
  h.deletes[0].pending.resolve(ok); await request
  assert.equal(h.signOuts.length, 0)
}

// Auth verification loss and effect replay release pending UI with uncertainty,
// retaining the typed draft without claiming the server cancelled deletion.
for (const mode of ['auth-loading', 'effect-replay']) {
  const h = harness(); let tree = confirm(h)
  const oldSubmit = button(tree, 'Delete My Account').props.onClick
  const request = oldSubmit()
  if (mode === 'auth-loading') { h.auth.isLoading = true; tree = render(h) } else h.replay()
  tree = render(h)
  assert.equal(h.deletes[0].options.signal.aborted, true)
  assert.match(text(tree), /request may have completed/)
  assert.equal(input(tree).props.value, 'DELETE')
  assert.equal(button(tree, 'Cancel').props.disabled, false)
  if (mode === 'auth-loading') {
    assert.equal(button(tree, 'Delete My Account').props.disabled, true)
    await oldSubmit(); assert.equal(h.deletes.length, 1)
    h.auth.isLoading = false; tree = render(h)
  }
  assert.equal(button(tree, 'Delete My Account').props.disabled, false)
  h.deletes[0].pending.resolve(ok); await request
  assert.equal(h.signOuts.length, 0, 'Interrupted late response is not a signOut authority')
  const retry = button(tree, 'Delete My Account').props.onClick()
  h.deletes[1].pending.resolve(refused); await retry
  assert.equal(h.deletes.length, 2)
}

// Current-owner acknowledgement calls the exact existing signOut input once.
{
  const h = harness(), signingOut = deferred(); h.signOutImplementation(() => signingOut.promise)
  let tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.deletes[0].pending.resolve(ok); await settle(); tree = render(h)
  assert.equal(h.signOuts.length, 1)
  assert.equal(JSON.stringify(h.signOuts[0].options), JSON.stringify({ callbackUrl: '/' }))
  assert.equal(button(tree, 'Signing out…').props.disabled, true)
  assert.equal(button(tree, 'Cancel').props.disabled, true)
  await button(tree, 'Signing out…').props.onClick()
  assert.equal(h.signOuts.length, 1)
  signingOut.resolve(); await request; tree = render(h)
  assert.equal(button(tree, 'Signing out…').props.disabled, true, 'Normal success waits for existing signOut navigation')
}

// Known deletion acknowledgement survives replay/auth loss/signOut failure;
// recovery retries only signOut, never repeats DELETE.
for (const mode of ['effect-replay', 'auth-loading', 'sign-out-refusal']) {
  const h = harness(), signingOut = deferred(); h.signOutImplementation(() => signingOut.promise)
  let tree = confirm(h)
  const request = button(tree, 'Delete My Account').props.onClick()
  h.deletes[0].pending.resolve(ok); await settle()
  if (mode === 'effect-replay') h.replay()
  if (mode === 'auth-loading') { h.auth.isLoading = true; render(h); h.auth.isLoading = false; render(h) }
  if (mode === 'sign-out-refusal') signingOut.reject(new Error('Injected signOut refusal'))
  else signingOut.resolve()
  await request; tree = render(h)
  assert.match(text(tree), /Account deletion was confirmed/)
  assert.equal(button(tree, 'Retry sign-out').props.disabled, false)
  assert.equal(input(tree).props.disabled, true)
  assert.equal(button(tree, 'Cancel').props.disabled, true)
  h.signOutImplementation(async () => {})
  await button(tree, 'Retry sign-out').props.onClick()
  assert.equal(h.deletes.length, 1)
  assert.equal(h.signOuts.length, 2)
}

for (const change of [{ isLoading: true }, { isAuthenticated: false }, { user: null }]) {
  const h = harness(); Object.assign(h.auth, change)
  const tree = render(h)
  assert.equal(button(tree, 'Delete Account').props.disabled, true)
  button(tree, 'Delete Account').props.onClick()
  assert.equal(all(render(h), item => item.type === 'Input').length, 0)
  assert.equal(h.deletes.length, 0); assert.equal(h.signOuts.length, 0)
  assert(!text(tree).includes('Currently signed in with Google'))
  assert(!text(tree).includes('Connected'))
  assert.match(text(tree), change.isLoading ? /Verifying your sign-in.*Checking/ : /sign-in could not be verified.*Unverified/)
  assert.match(text(tree), /Google Sign-In/); assert.match(text(tree), /Two-Factor Authentication/); assert.match(text(tree), /Planned/)
}
console.log('Atlas Security: baseline races reproduced; actual-leaf offline duplicate/captured callbacks, owner-before-cleanup, unmount/replay, auth uncertainty, typed refusal/cancel/retry, acknowledged signOut-only recovery and classic guards passed; zero real account/signOut operations.')
