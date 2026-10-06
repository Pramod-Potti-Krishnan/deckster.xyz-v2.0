import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const helperPath = 'components/studio-libraries/library-account-boundary.tsx'
const source = fs.readFileSync(path.join(root, helperPath), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  reportDiagnostics: true,
})
assert.equal(compiled.diagnostics.length, 0)

// Execute the actual wrapper and pure helpers with deliberate auth snapshots.
// No live React/auth/network/browser operation is performed by this witness.
const exports = {}, cells = []
const auth = { user: { id: 'owner-a' }, isLoading: false, isAuthenticated: true }
let cursor = 0, context
const jsx = (type, props, key) => ({ type, props, key })
vm.runInNewContext(compiled.outputText, {
  exports, module: { exports },
  require(id) {
    if (id === '@/hooks/use-auth') return { useAuth: () => auth }
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'react') return {
      createContext(value) { context = { value, Provider: {} }; return context },
      useContext(value) { return value.value },
      useRef(initial) { const index = cursor++; return cells[index] ||= { current: initial } },
      useMemo(factory, dependencies) {
        const index = cursor++, previous = cells[index]
        if (!previous || !dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) {
          cells[index] = { value: factory(), dependencies }
        }
        return cells[index].value
      },
    }
    throw new Error(`Unexpected boundary dependency: ${id}`)
  },
})
const { StudioLibraryAccountBoundary, useStudioLibraryAccount, libraryAccountIsCurrent, libraryAccountCanStart } = exports
const children = { type: 'StandaloneWorkspace', props: { localDraft: 'retained fixture' } }
function render(change = {}) {
  Object.assign(auth, change); cursor = 0
  return StudioLibraryAccountBoundary({ children })
}
function account(tree) {
  assert.equal(tree.type, context.Provider)
  assert.equal(tree.props.children, children)
  context.value = tree.props.value
  assert.equal(useStudioLibraryAccount(), tree.props.value)
  return tree.props.value
}
function unavailable(tree, text) {
  assert.notEqual(tree.type, context.Provider)
  assert.equal(tree.props.role, 'status')
  assert.equal(tree.props.children, text)
  assert.notEqual(tree.props.children, children)
}

assert.equal(useStudioLibraryAccount(), null)
assert.equal(libraryAccountIsCurrent(null), false)
assert.equal(libraryAccountCanStart(null), false)
const first = render(), a = account(first), shared = a.current
assert.equal(first.key, 'owner-a')
assert.equal(a.owner, 'owner-a'); assert.equal(a.ready, true)
assert.equal(libraryAccountIsCurrent(a), true)
assert.equal(libraryAccountCanStart(a), true)
assert.equal(account(render()), a, 'Unchanged owner/readiness keeps context snapshot stable')

// Retained user.id while loading keeps the provider/child key even if the auth
// snapshot temporarily says not authenticated. Existing owned results survive.
const loading = render({ isLoading: true, isAuthenticated: false }), loadingA = account(loading)
assert.equal(loading.key, first.key)
assert.equal(loadingA.owner, a.owner)
assert.equal(loadingA.ready, false)
assert.equal(loadingA.current, shared)
assert.equal(libraryAccountIsCurrent(a), true)
assert.equal(libraryAccountCanStart(a), false, 'Old ready=true callback checks live readiness')
assert.equal(libraryAccountCanStart(loadingA), false)
let guardedStarts = 0
const capturedWhileLoading = () => { if (libraryAccountCanStart(loadingA)) guardedStarts += 1 }
capturedWhileLoading(); assert.equal(guardedStarts, 0)
const recovered = render({ isLoading: false, isAuthenticated: true }), readyA = account(recovered)
assert.equal(recovered.key, first.key)
assert.equal(readyA.current, shared)
assert.equal(loadingA.ready, false, 'Rendered snapshot remains a snapshot')
capturedWhileLoading(); assert.equal(guardedStarts, 1, 'Same-owner stable callback recovers using live readiness')

// Change the outer output before any hypothetical previous-child cleanup.
let previousChildCleanedUp = false
const bTree = render({ user: { id: 'owner-b' } }), b = account(bTree)
assert.equal(previousChildCleanedUp, false)
assert.notEqual(bTree.key, first.key)
assert.equal(b.current, shared)
assert.equal(libraryAccountIsCurrent(a), false)
assert.equal(libraryAccountCanStart(a), false)
capturedWhileLoading(); assert.equal(guardedStarts, 1)
assert.equal(libraryAccountIsCurrent(b), true)
assert.equal(libraryAccountCanStart(b), true)
previousChildCleanedUp = true

const unknown = render({ user: null, isLoading: true, isAuthenticated: false })
unavailable(unknown, 'Verifying your account…')
assert.equal(shared.current.owner, null); assert.equal(shared.current.ready, false)
assert.equal(libraryAccountIsCurrent(b), false)
assert.equal(libraryAccountCanStart(b), false)
unavailable(render({ user: { email: 'fixture@example.test' }, isLoading: false, isAuthenticated: true }), 'Sign in to view your library.')
assert.equal(shared.current.owner, null, 'No email fallback creates account identity')
unavailable(render({ user: { id: 'owner-b' }, isAuthenticated: false }), 'Sign in to view your library.')
assert.equal(shared.current.owner, null, 'Confirmed unauthenticated retained ID retires children')
const back = account(render({ user: { id: 'owner-a' }, isAuthenticated: true }))
assert.equal(back.current, shared)
assert.equal(libraryAccountCanStart(back), true)
// An old A lifecycle must also check its own mounted/request generation: this
// helper intentionally establishes ownership, not an operation/lifecycle epoch.
assert.equal(libraryAccountIsCurrent(a), true)

// Actual import inventory prevents the standalone adapter reaching native
// Builder components or shared providers. Consumers preserve null-context paths.
const allowed = new Set([
  'app/(app)/studio/templates/page.tsx', 'app/(app)/studio/themes/page.tsx',
  'components/studio-libraries/templates-workspace.tsx',
  'components/studio-libraries/themes-workspace.tsx',
])
const imports = []
function audit(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) audit(relative)
    else if (/\.tsx?$/.test(entry.name) && relative !== helperPath) {
      const file = ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true)
      for (const statement of file.statements) {
        if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier?.text?.includes('library-account-boundary')) {
          imports.push(relative); assert(allowed.has(relative), `Boundary import outside standalone ownership: ${relative}`)
        }
      }
    }
  }
}
audit('app'); audit('components')
console.log(`Atlas library account boundary: actual-wrapper key/context continuity, live readiness recovery, owner-before-cleanup retirement, unavailable/email-only guards and standalone import audit passed (${imports.length} current importers); zero connected operations.`)
