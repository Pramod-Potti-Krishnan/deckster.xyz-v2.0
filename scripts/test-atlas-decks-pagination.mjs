import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import postcss from 'postcss'

const source = fs.readFileSync(new URL('../app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value }); return { promise, resolve } }
const settle = async () => { for (let index = 0; index < 6; index++) await Promise.resolve() }
const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

function harness(studio = true) {
  const cells = [], slots = [], pendingEffects = []
  let cursor = 0, requests = 0
  const calls = [], deletes = [], pushes = [], removed = []
  const auth = { user: { id: 'owner-a', email: 'owner-a@example.invalid', tier: 'pro' }, isLoading: false }
  const reading = [], deleting = []
  const loadSessions = options => { calls.push(options); const request = deferred(); reading.push(request); return request.promise }
  const deleteSession = id => { deletes.push(id); const request = deferred(); deleting.push(request); return request.promise }
  const exports = {}
  const jsx = (type, props, key) => ({ type, props: props || {}, key })
  const compiled = ts.transpileModule(`${source}\nexport { DashboardForAccount, PresentationCard };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true,
  })
  assert.equal(compiled.diagnostics.length, 0)
  vm.runInNewContext(compiled.outputText, {
    exports, module: { exports }, Date, Set, Map, Array, encodeURIComponent,
    process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } },
    sessionStorage: { removeItem: key => removed.push(key) },
    localStorage: { getItem: () => null, removeItem: key => removed.push(key) },
    require(id) {
      if (id === 'react') return {
        useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] },
        useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
        useCallback(fn, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, fn }; return slots[index].fn },
        useEffect(fn, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) pendingEffects.push({ index, fn, deps }) },
      }
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
      if (id.endsWith('.css')) return {}
      if (id === '@/hooks/use-auth') return { useAuth: () => auth }
      if (id === '@/hooks/use-chat-sessions') return { useChatSessions: () => ({ loadSessions, deleteSession }) }
      if (id === 'next/navigation') return { useRouter: () => ({ push: url => pushes.push(url) }) }
      if (id === 'next/link') return { __esModule: true, default: 'Link' }
      if (id === '@/hooks/use-session-cache') return {
        sessionCacheKey: (owner, session) => `deckster_session_v2_${encodeURIComponent(owner)}_${session}`,
        sessionMetadataCacheKey: (owner, session) => `deckster_metadata_v2_${encodeURIComponent(owner)}_${session}`,
      }
      if (id === '@/lib/last-builder-session') return { lastBuilderSessionKey: owner => `deckster:last_session_id:${owner}` }
      if (id === '@/lib/layout-service-client') return { LAYOUT_VIEWER_URL_POLICY: {} }
      if (id === '@/lib/layout-viewer-url-policy') return { evaluateLayoutViewerUrl: () => ({ status: 'empty' }) }
      return new Proxy({}, { get: (_, key) => String(key) })
    },
    fetch() { requests++; throw new Error('No services are permitted in this offline witness') },
  })
  return {
    auth, calls, deletes, pushes, removed, reading, deleting, exports,
    render() { cursor = 0; pendingEffects.length = 0; return exports.DashboardForAccount(auth) },
    effects() { const changes = pendingEffects.splice(0); for (const effect of changes) { slots[effect.index]?.cleanup?.(); slots[effect.index] = { deps: effect.deps, cleanup: effect.fn() } } },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    get requests() { return requests },
  }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => all(item, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found); return found
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree !== 'object') return String(tree)
  return Array.isArray(tree) ? tree.map(text).join(' ').replace(/\s+/g, ' ') : text(tree.props?.children)
}
const one = (tree, predicate) => { const found = all(tree, predicate); assert.equal(found.length, 1); return found[0] }
const button = (tree, label) => one(tree, item => item.type === 'Button' && text(item).trim() === label)
const activeContent = tree => {
  const tabs = one(tree, item => item.type === 'Tabs')
  return one(tabs, item => item.type === 'TabsContent' && item.props.value === tabs.props.value)
}
const cards = tree => all(activeContent(tree), item => typeof item.type === 'function' && item.type.name === 'PresentationCard')
const session = (id, override = {}) => ({ id, title: `Deck ${id}`, currentStage: 6, finalPresentationUrl: `https://viewer.example.invalid/${id}`, strawmanPreviewUrl: null, createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-03T12:00:00Z', slideCount: 5, messages: [], ...override })
const page = (sessions, offset = 0, hasMore = false, limit = 100) => ({ sessions, pagination: { offset, limit, hasMore, total: hasMore ? offset + limit + 100 : offset + sessions.length } })
const firstPage = Array.from({ length: 100 }, (_, index) => session(`a-${index}`))

async function mount(h, initial = page(firstPage, 0, true)) {
  h.render(); h.effects()
  assert.equal(h.calls.length, 1)
  assert.equal(JSON.stringify(h.calls[0]), JSON.stringify({ limit: 100, status: 'active' }))
  h.reading[0].resolve(initial); await settle()
  const tree = h.render(); h.effects(); return tree
}

{
  const h = harness()
  let tree = await mount(h)
  assert.equal(cards(tree).length, 100)
  button(tree, 'List').props.onClick()
  one(tree, item => item.type === 'Input').props.onChange({ target: { value: 'older' } })
  button(tree, 'Filters').props.onClick()
  tree = h.render(); h.effects()
  button(tree, 'completed').props.onClick()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 0)
  const append = button(tree, 'Load more sessions').props.onClick
  const oldRefresh = button(tree, 'Refresh').props.onClick
  append(); append(); oldRefresh()
  assert.equal(h.calls.length, 2, 'Repeated append/overlapping refresh issues only one read')
  assert.equal(h.calls[1].offset, 100)
  tree = h.render(); h.effects()
  assert.equal(button(tree, 'Loading more…').props.disabled, true)
  h.reading[1].resolve(null); await settle()
  tree = h.render(); h.effects()
  assert.match(text(tree), /More sessions could not be loaded/)
  assert.equal(one(tree, item => item.type === 'Input').props.value, 'older')
  assert.equal(button(tree, 'completed').props['aria-pressed'], true)
  assert.equal(one(activeContent(tree), item => item.props['data-studio-deck-grid']).props['data-studio-deck-view'], 'list')
  button(tree, 'Retry loading more').props.onClick()
  assert.equal(h.calls[2].offset, 100, 'Refusal does not advance the native offset')
  h.reading[2].resolve(page([session('a-99'), session('older? /deck', { title: 'An older deck' })], 100, false)); await settle()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 1)
  assert.equal(cards(tree)[0].props.presentation.id, 'older? /deck')
  assert.match(text(tree), /101 active sessions loaded/)
  cards(tree)[0].props.onOpen('older? /deck')
  assert.equal(h.pushes[0], '/builder?session_id=older%3F%20%2Fdeck')
  const leaf = h.exports.PresentationCard(cards(tree)[0].props)
  for (const link of all(leaf, item => item.type === 'Link')) assert.equal(link.props.href, h.pushes[0])
  assert.equal(one(leaf, item => item.type === 'DropdownMenuItem' && text(item) === 'Duplicate').props.disabled, true)
  assert.equal(all(tree, item => item.type === 'Button' && text(item) === 'Load more sessions').length, 0)
  assert.equal(h.requests, 0)
}

// Native hasMore derives from an unfiltered server total. A short page ends
// local paging even when old empty sessions make that total overstate results.
{
  const h = harness(), tree = await mount(h, page([session('short')], 0, true))
  assert.equal(cards(tree).length, 1)
  assert.equal(all(tree, item => item.type === 'Button' && text(item) === 'Load more sessions').length, 0)
  assert.match(text(tree), /1 active sessions loaded/)
}
{
  const h = harness(); let tree = await mount(h)
  button(tree, 'Load more sessions').props.onClick()
  h.reading[1].resolve(page([], 100, true)); await settle()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 100)
  assert.equal(all(tree, item => item.type === 'Button' && text(item) === 'Load more sessions').length, 0)
}

// A full refresh replaces accumulated pages, while a refused refresh retains
// the existing cards and the acknowledged next native offset.
{
  const h = harness(); let tree = await mount(h)
  button(tree, 'Refresh').props.onClick(); h.reading[1].resolve(null); await settle()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 100)
  assert.match(text(tree), /Showing the last loaded records/)
  button(tree, 'Refresh').props.onClick(); h.reading[2].resolve(page([session('replacement')])); await settle()
  tree = h.render(); h.effects()
  assert.deepEqual(cards(tree).map(item => item.props.presentation.id), ['replacement'])
}

// Deletion is still refusal-safe and cannot overlap paging. A real-result unit
// input adjusts the next offset for the removed active session; it is not a
// persistence acknowledgement or authorization to call a connected service.
{
  const h = harness(); let tree = await mount(h)
  const oldDelete = cards(tree)[0].props.onDelete
  button(tree, 'Load more sessions').props.onClick()
  oldDelete(cards(tree)[0].props.presentation)
  tree = h.render(); h.effects()
  assert.equal(one(tree, item => item.type === 'AlertDialog').props.open, false)
  h.reading[1].resolve(page(Array.from({ length: 100 }, (_, index) => session(`b-${index}`)), 100, true)); await settle()
  tree = h.render(); h.effects()
  cards(tree)[0].props.onDelete(cards(tree)[0].props.presentation)
  tree = h.render(); h.effects()
  const action = one(tree, item => item.type === 'AlertDialogAction')
  action.props.onClick({ preventDefault() {} }); action.props.onClick({ preventDefault() {} })
  assert.equal(h.deletes.length, 1)
  const reads = h.calls.length
  button(tree, 'Load more sessions').props.onClick()
  assert.equal(h.calls.length, reads, 'Mutation owns the paging interval')
  h.deleting[0].resolve(false); await settle()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 200)
  assert.equal(one(tree, item => item.type === 'AlertDialog').props.open, true)
  assert.match(text(tree), /server did not confirm deletion/)
  one(tree, item => item.type === 'AlertDialogAction').props.onClick({ preventDefault() {} })
  h.deleting[1].resolve(true); await settle()
  tree = h.render(); h.effects()
  assert.equal(cards(tree).length, 199)
  assert.equal(h.removed.length, 2)
  assert(h.removed.every(key => key.includes('owner-a_a-0')))
  button(tree, 'Load more sessions').props.onClick()
  assert.equal(h.calls.at(-1).offset, 199, 'Owned deletion does not skip the shifted next row')
}

// Synchronous account key and unmount invalidation prevent old cards/counts or
// delayed reads from entering a newly mounted owner's view.
{
  const h = harness(); let tree = await mount(h)
  assert.equal(h.exports.default().key, 'owner-a')
  button(tree, 'Load more sessions').props.onClick()
  h.unmount()
  h.auth.user = { id: 'owner-b', email: 'owner-b@example.invalid' }
  assert.equal(h.exports.default().key, 'owner-b')
  h.reading[1].resolve(page([session('old-account-late')], 100)); await settle()
  tree = h.render()
  assert.equal(cards(tree).length, 0)
  assert(!text(tree).includes('old-account-late'))
  const next = harness(); next.auth.user = h.auth.user
  tree = next.render(); next.effects()
  assert.equal(all(tree, item => item.type === 'Input')[0].props.value, '')
  assert.equal(all(tree, item => item.props['data-studio-deck-pagination']).length, 0)
  assert(!text(tree).includes('100 active sessions loaded'))
}
{
  const h = harness(); let tree = await mount(h)
  cards(tree)[0].props.onDelete(cards(tree)[0].props.presentation)
  tree = h.render(); h.effects()
  one(tree, item => item.type === 'AlertDialogAction').props.onClick({ preventDefault() {} })
  h.unmount()
  h.deleting[0].resolve(true); await settle()
  assert.equal(h.removed.length, 0, 'Old-account deletion continuation cannot clear local references')
  assert.equal(cards(h.render()).length, 100)
}

{
  const h = harness(false), tree = await mount(h)
  assert.equal(cards(tree).length, 100)
  assert.equal(all(tree, item => item.props['data-studio-deck-pagination']).length, 0)
  assert.equal(cards(tree)[0].props.onDelete, undefined)
  assert.equal(one(tree, item => item.props['data-studio-deck-primary']).props.children.props.href, '/builder')
}
postcss.parse(fs.readFileSync(new URL('../components/builder/studio-decks.css', import.meta.url), 'utf8'))
console.log('Atlas Decks: actual-leaf offline paging, deduped older-session reopen, retained filter/view, refusal/retry, overlapping-read/mutation guards, shifted deletion offset, account boundary and classic rollback passed; zero service requests.')
