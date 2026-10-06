import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual frontend component against synthetic callback outcomes.
// The service hook is not loaded, and every real network request is refused.
const source = fs.readFileSync(new URL('../components/chat-history-sidebar.tsx', import.meta.url), 'utf8')
const stateNames = [...source.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(match => match[1])
const compiled = ts.transpileModule(source, {
  reportDiagnostics: true,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
assert.equal((compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error).length, 0)

const fixtureSessions = ['alpha', 'beta', 'gamma', 'untouched'].map(id => ({
  id, title: `Local ${id}`, createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-02T12:00:00Z',
  lastMessageAt: null, currentStage: 3, status: 'active', isFavorite: false, messages: [],
}))
const jsx = (type, props, key) => ({ type, props, key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : !value ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const plain = value => JSON.parse(JSON.stringify(value))

function fixture({ studio = true, currentSessionId = 'alpha', outcomes = [], cacheThrows = false } = {}) {
  const state = {}, calls = [], cache = [], progress = [], toasts = []
  let cursor = 0, newChats = 0
  const refuse = () => { throw new Error('Test refuses all service requests') }
  const react = {
    useState(initial) {
      const name = stateNames[cursor++]
      if (!(name in state)) state[name] = typeof initial === 'function' ? initial() : initial
      return [state[name], value => {
        state[name] = typeof value === 'function' ? value(state[name]) : value
        if (name === 'deletionProgress') progress.push(plain(state[name]))
      }]
    },
    useEffect() {},
  }
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': Object.fromEntries(['X', 'Plus', 'Search', 'CheckSquare', 'Trash2', 'Check', 'Loader2', 'MessageSquare'].map(name => [name, name])),
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({
      loading: false,
      loadSessions: refuse,
      deleteSession: async id => {
        calls.push(id)
        const outcome = outcomes[calls.length - 1]
        if (outcome instanceof Error) throw outcome
        if (typeof outcome === 'boolean' || outcome instanceof Promise) return outcome
        throw new Error('Unexpected synthetic callback invocation')
      },
    }) },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'offline-owner' } }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: entry => toasts.push(entry) }) },
    '@/hooks/use-session-cache': {
      sessionCacheKey: (owner, id) => `${owner}:session:${id}`,
      sessionMetadataCacheKey: (owner, id) => `${owner}:metadata:${id}`,
    },
    './session-list-item': { SessionListItem: 'SessionListItem' },
    './ui/button': { Button: 'Button' },
    './ui/input': { Input: 'Input' },
    './ui/checkbox': { Checkbox: 'Checkbox' },
    './delete-confirm-modal': { DeleteConfirmModal: 'DeleteConfirmModal' },
    './ui/alert-dialog': Object.fromEntries(['AlertDialog', 'AlertDialogAction', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'].map(name => [name, name])),
    './studio-session-history.css': {},
  }
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } },
    fetch: refuse, console: { log() {}, error() {} },
    sessionStorage: { removeItem: key => { cache.push(key); if (cacheThrows) throw new Error('Synthetic local cache failure') } },
    require: name => { if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`); return imports[name] },
  })
  const props = { isOpen: true, currentSessionId, onClose() {}, onSessionSelect() {}, onNewChat: () => { newChats++ } }
  function render(overrides) {
    if (overrides) Object.assign(state, overrides)
    cursor = 0
    return mod.exports.ChatHistorySidebar(props)
  }
  render({ sessions: fixtureSessions, totalSessionCount: 4, isSelectionMode: true, selectedIds: new Set(['alpha', 'beta', 'gamma']) })
  return { state, calls, cache, progress, toasts, render, get newChats() { return newChats } }
}

async function confirmBulk(test) {
  let tree = test.render()
  const open = nodes(tree).find(node => node.type === 'Button' && textOf(node).includes('Delete Selected'))
  open.props.onClick()
  tree = test.render()
  const modal = nodes(tree).find(node => node.type === 'DeleteConfirmModal')
  assert.equal(modal.props.open, true)
  assert.deepEqual(plain(modal.props.sessionTitles), ['Local alpha', 'Local beta', 'Local gamma'])
  await modal.props.onConfirm()
  return test.render()
}

for (const { name, outcomes, current, confirmed, remaining, calls } of [
  { name: 'all confirmed', outcomes: [true, true, true], current: 'alpha', confirmed: ['alpha', 'beta', 'gamma'], remaining: [], calls: ['alpha', 'beta', 'gamma'] },
  { name: 'all refused', outcomes: [false, false, false], current: 'alpha', confirmed: [], remaining: ['alpha', 'beta', 'gamma'], calls: ['alpha', 'beta', 'gamma'] },
  { name: 'partial with unresolved current', outcomes: [false, true, true], current: 'alpha', confirmed: ['beta', 'gamma'], remaining: ['alpha'], calls: ['alpha', 'beta', 'gamma'] },
  { name: 'partial with confirmed current', outcomes: [true, false, true], current: 'alpha', confirmed: ['alpha', 'gamma'], remaining: ['beta'], calls: ['alpha', 'beta', 'gamma'] },
  { name: 'unexpected middle exception', outcomes: [true, new Error('Synthetic callback interruption')], current: 'beta', confirmed: ['alpha'], remaining: ['beta', 'gamma'], calls: ['alpha', 'beta'] },
]) {
  const test = fixture({ outcomes, currentSessionId: current })
  let tree = await confirmBulk(test)
  assert.deepEqual(test.calls, calls, `${name}: sequential callback snapshot, no automatic retry`)
  assert.deepEqual(Array.from(test.state.sessions, session => session.id), ['alpha', 'beta', 'gamma', 'untouched'].filter(id => !confirmed.includes(id)), `${name}: remove only confirmed rows`)
  assert.deepEqual(Array.from(test.state.selectedIds), remaining, `${name}: retain unconfirmed and unattempted IDs`)
  assert.deepEqual(test.cache, confirmed.flatMap(id => [`offline-owner:session:${id}`, `offline-owner:metadata:${id}`]), `${name}: clear cache only for confirmed IDs`)
  assert.equal(test.newChats, confirmed.includes(current) ? 1 : 0, `${name}: current session navigation requires confirmation`)
  assert.equal(test.state.isDeletingBulk, false)
  assert.equal(test.state.showBulkDeleteModal, false)
  assert.equal(test.state.isSelectionMode, remaining.length > 0)
  if (remaining.length) {
    assert.equal(test.state.showSuccessModal, false)
    assert.deepEqual(plain(test.state.studioBulkDeleteResult), { confirmed: confirmed.length, unresolved: remaining.length, total: 3 })
    const notice = nodes(tree).find(node => node.props?.['data-studio-session-part'] === 'bulk-result')
    assert.equal(notice.props.role, 'status')
    assert.ok(textOf(notice).includes('Deletion could not be confirmed'))
    assert.ok(!textOf(notice).includes('successfully'))
    nodes(tree).find(node => node.props?.['aria-label'] === 'Dismiss bulk deletion result').props.onClick()
    tree = test.render()
    assert.equal(test.state.studioBulkDeleteResult, null)
    assert.deepEqual(Array.from(test.state.selectedIds), remaining, 'dismiss is local-only and keeps recovery selection')
    assert.deepEqual(test.calls, calls, 'dismiss never retries')
  } else {
    assert.equal(test.state.showSuccessModal, true)
    assert.equal(test.state.deletionSummary.count, 3)
    assert.equal(test.state.studioBulkDeleteResult, null)
  }
  assert.deepEqual(test.progress[0], { current: 0, total: 3 })
  assert.equal(test.progress.length, calls.length + 1)
}

// A pending native callback keeps the existing confirmation busy and progress visible.
let finishPending
const pending = fixture({ outcomes: [new Promise(resolve => { finishPending = resolve }), false, true] })
let pendingTree = pending.render()
nodes(pendingTree).find(node => node.type === 'Button' && textOf(node).includes('Delete Selected')).props.onClick()
pendingTree = pending.render()
const pendingRun = nodes(pendingTree).find(node => node.type === 'DeleteConfirmModal').props.onConfirm()
pendingTree = pending.render()
const pendingModal = nodes(pendingTree).find(node => node.type === 'DeleteConfirmModal')
assert.equal(pendingModal.props.isDeleting, true)
assert.deepEqual(plain(pendingModal.props.deletionProgress), { current: 1, total: 3 })
assert.deepEqual(pending.calls, ['alpha'], 'no next native callback starts before the pending outcome')
assert.deepEqual(Array.from(pending.state.selectedIds), ['alpha', 'beta', 'gamma'])
assert.equal(pending.state.sessions.length, 4, 'no deletion is claimed while the outcome is pending')
finishPending(true)
await pendingRun
assert.equal(pending.state.isDeletingBulk, false)
assert.deepEqual(Array.from(pending.state.selectedIds), ['beta'])
assert.deepEqual(pending.calls, ['alpha', 'beta', 'gamma'])

// A second request occurs only after the author explicitly opens and confirms the native dialog again.
const retry = fixture({ outcomes: [true, false, true, true] })
await confirmBulk(retry)
let retryTree = retry.render()
nodes(retryTree).find(node => node.type === 'Button' && textOf(node).includes('Delete Selected')).props.onClick()
retryTree = retry.render()
const retryModal = nodes(retryTree).find(node => node.type === 'DeleteConfirmModal')
assert.deepEqual(plain(retryModal.props.sessionTitles), ['Local beta'])
assert.deepEqual(retry.calls, ['alpha', 'beta', 'gamma'])
await retryModal.props.onConfirm()
assert.deepEqual(retry.calls, ['alpha', 'beta', 'gamma', 'beta'])
assert.deepEqual(Array.from(retry.state.sessions, session => session.id), ['untouched'])
assert.equal(retry.state.showSuccessModal, true)
assert.equal(retry.state.deletionSummary.count, 1)
assert.equal(retry.state.selectedIds.size, 0)

const cacheFailure = fixture({ outcomes: [true, true, true], cacheThrows: true })
await confirmBulk(cacheFailure)
assert.deepEqual(Array.from(cacheFailure.state.sessions, session => session.id), ['untouched'])
assert.equal(cacheFailure.state.deletionSummary.count, 3, 'local cache failure does not erase confirmed service outcomes')

// Classic's inherited behavior stays unchanged, including its known partial-result limitation.
const classic = fixture({ studio: false, outcomes: [false, true, false] })
const classicTree = await confirmBulk(classic)
assert.equal(classic.state.sessions.length, 4)
assert.equal(classic.state.selectedIds.size, 0)
assert.equal(classic.state.isSelectionMode, false)
assert.equal(classic.newChats, 1)
assert.equal(classic.state.showSuccessModal, true)
assert.equal(classic.state.deletionSummary.count, 1)
assert.equal(nodes(classicTree).some(node => node.props?.['data-studio-session-part'] === 'bulk-result'), false)

for (const confirmed of [false, true]) {
  const single = fixture({ outcomes: [confirmed] })
  const row = nodes(single.render()).find(node => node.type === 'SessionListItem' && node.props.session.id === 'alpha')
  await row.props.onDelete('alpha')
  assert.equal(single.state.sessions.some(session => session.id === 'alpha'), !confirmed)
  assert.equal(single.newChats, confirmed ? 1 : 0)
  assert.equal(single.toasts[0].title, confirmed ? 'Session deleted' : 'Delete failed')
  assert.equal(single.state.studioBulkDeleteResult, null)
}

console.log('Studio Sessions bulk recovery passed: actual component all-confirmed/refused/partial/current-session/exception outcomes, confirmed-only rows/cache, unresolved selection and honest notice, native explicit retry/dismiss, pending/final progress gates, local cache failure, classic inherited behavior and unchanged single-delete result handling. Only synthetic callback outcomes ran; no service hook, fetch or deletion request executed.')
