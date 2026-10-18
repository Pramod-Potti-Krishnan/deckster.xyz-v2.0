// INSERT-PERSIST (NEXT_PUBLIC_STUDIO_INSERT_PERSIST): blank-canvas Shape / Metrics inserts must reach Layout, and a Table insert must not
// keep its "Click to configure" placeholder after reload. Fails on base (lib/studio-insert-persist.ts and its wiring do not exist).
//
// The fake viewer below models Layout uat @ 457c32d exactly where it matters:
//   src/utils/auto-save.js markContentChanged(): returns early unless body[data-mode] === 'edit' or options.force === true.
//   src/utils/element-manager.js insertTextBox / deleteElement -> triggerAutoSave (not forced);
//   upsertCitedElement -> triggerPersistentAutoSave (force) and the viewer then awaits forceSave.
//   forceSave()/triggerSave(): with nothing pending, no PUT.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('..', import.meta.url)
const libPath = new URL('lib/studio-insert-persist.ts', root)
assert.ok(fs.existsSync(libPath), 'lib/studio-insert-persist.ts exists')

function loadLib(flag) {
  const source = fs.readFileSync(libPath, 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  const env = flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_INSERT_PERSIST: flag }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env } })
  return module.exports
}

function fakeLayoutViewer() {
  const slide = new Map() // live DOM: elementId -> type
  let mode = 'view'
  let pending = 0
  let stored = [] // what the last PUT /api/presentations/{id}/slides wrote
  let puts = 0
  const log = []
  const mark = (force = false) => { if (mode === 'edit' || force) pending += 1 }
  const save = () => { if (pending === 0) return; stored = [...slide.keys()].sort(); puts += 1; pending = 0 }
  const send = async (action, params = {}) => {
    log.push(action)
    switch (action) {
      case 'isEditModeActive': return { success: true, isEditing: mode === 'edit' }
      case 'enterEditMode': mode = 'edit'; return { success: true, isEditing: true }
      case 'insertTextBox': slide.set(params.elementId, params.componentType); mark(); return { success: true, elementId: params.elementId }
      case 'upsertCitedElement': slide.set(params.elementId, params.componentType); mark(true); save(); return { success: true, elementId: params.elementId }
      case 'deleteElement': slide.delete(params.elementId); mark(); return { success: true }
      default: throw new Error(`unexpected ${action}`)
    }
  }
  return { send, log, flushDebounce: save, setMode: m => { mode = m }, get stored() { return stored }, get puts() { return puts } }
}

// The exact branch added to presentation-viewer.tsx handleSendElementCommand (layout-service commands).
function studioElementCommand(lib, viewer, { studioShell = true } = {}) {
  return async (action, params) => {
    if (lib.shouldEnsureEditModeForPersistence(action, { enabled: lib.STUDIO_INSERT_PERSIST_ENABLED, studioShell })) {
      await lib.ensureViewerTracksEdits((a, p) => viewer.send(a, p ?? {}))
    }
    return viewer.send(action, params)
  }
}

// The Add Element sequence on a blank canvas (hooks/use-textlabs-generation.ts): placeholder insertTextBox, the generated element
// (insertTextBox for SHAPE / uncited METRICS, upsertCitedElement for TABLE), then deleteElement of the placeholder.
async function blankCanvasInsert(lib, componentType, opts) {
  const viewer = fakeLayoutViewer()
  const cmd = studioElementCommand(lib, viewer, opts)
  await cmd('insertTextBox', { elementId: 'blank_1', componentType })
  const elementId = `${componentType.toLowerCase()}_1`
  await cmd(componentType === 'TABLE' ? 'upsertCitedElement' : 'insertTextBox', { elementId, componentType })
  await cmd('deleteElement', { elementId: 'blank_1' })
  viewer.flushDebounce()
  return { viewer, elementId }
}

const off = loadLib(undefined)
const offFalse = loadLib('false')
const on = loadLib('true')
assert.equal(off.STUDIO_INSERT_PERSIST_ENABLED, false, 'default off')
assert.equal(offFalse.STUDIO_INSERT_PERSIST_ENABLED, false, 'only exact "true" enables')
assert.equal(on.STUDIO_INSERT_PERSIST_ENABLED, true)

// Flag off: identity — the same commands go out, and the bug reproduces (this is base behaviour).
for (const type of ['SHAPE', 'METRICS']) {
  const { viewer } = await blankCanvasInsert(off, type)
  assert.deepEqual(viewer.log, ['insertTextBox', 'insertTextBox', 'deleteElement'], `${type} flag off sends nothing extra`)
  assert.equal(viewer.puts, 0, `${type} flag off: nothing persisted (the reported bug)`)
}
{
  const { viewer } = await blankCanvasInsert(off, 'TABLE')
  assert.deepEqual(viewer.log, ['insertTextBox', 'upsertCitedElement', 'deleteElement'])
  assert.deepEqual(viewer.stored, ['blank_1', 'table_1'], 'flag off: the table is saved with its placeholder (the reported leftover)')
}

// Flag on: every blank-canvas insert persists, and the placeholder does not survive.
for (const type of ['SHAPE', 'METRICS', 'TABLE']) {
  const { viewer, elementId } = await blankCanvasInsert(on, type)
  assert.deepEqual(viewer.stored, [elementId], `${type} flag on: saved slide holds exactly the generated element`)
  assert.equal(viewer.log.filter(a => a === 'enterEditMode').length, 1, `${type}: edit mode entered once`)
  assert.equal(viewer.log[0], 'isEditModeActive')
}

// Already editing (built deck after a selection, R8-3): nothing new is sent beyond the read.
{
  const viewer = fakeLayoutViewer()
  viewer.setMode('edit')
  const cmd = studioElementCommand(on, viewer)
  await cmd('insertTextBox', { elementId: 'metrics_9', componentType: 'METRICS' })
  assert.deepEqual(viewer.log, ['isEditModeActive', 'insertTextBox'])
}

// Outside the Studio shell nothing changes.
{
  const { viewer } = await blankCanvasInsert(on, 'SHAPE', { studioShell: false })
  assert.deepEqual(viewer.log, ['insertTextBox', 'insertTextBox', 'deleteElement'])
}

// Only autosave-gated mutations trigger it; reads and forced upserts do not.
for (const action of ['getElementGeometry', 'setElementGenerationState', 'upsertCitedElement', 'upsertSemanticElement', 'forceSave']) {
  assert.equal(on.shouldEnsureEditModeForPersistence(action, { enabled: true, studioShell: true }), false, action)
}
for (const action of ['insertTextBox', 'deleteElement', 'insertImage', 'insertChart', 'insertDiagram']) {
  assert.equal(on.shouldEnsureEditModeForPersistence(action, { enabled: true, studioShell: true }), true, action)
  assert.equal(on.shouldEnsureEditModeForPersistence(action, { enabled: false, studioShell: true }), false, `${action} flag off`)
}

// A failing viewer read never blocks the insert.
{
  const r = await on.ensureViewerTracksEdits(async () => { throw new Error('timeout') })
  assert.equal(r.editing, false)
  assert.equal(r.entered, false)
}

// Wiring: the guard sits in handleSendElementCommand's layout-service branch, before the command goes out, and the callback's deps are unchanged.
const viewerSource = fs.readFileSync(new URL('components/presentation-viewer.tsx', root), 'utf8')
assert.match(viewerSource, /from '@\/lib\/studio-insert-persist'/)
const start = viewerSource.indexOf('const handleSendElementCommand = useCallback(')
const branch = viewerSource.indexOf("if (commandType === 'layout-service') {", start)
const guard = viewerSource.indexOf('shouldEnsureEditModeForPersistence(action, { enabled: STUDIO_INSERT_PERSIST_ENABLED, studioShell })', branch)
const sendOut = viewerSource.indexOf('return sendCommand(iframeRef.current, action, params, { timeoutMs })', branch)
assert.ok(start > 0 && branch > start && guard > branch && sendOut > guard, 'guard precedes the layout-service send')
assert.match(viewerSource, /\}, \[presentationId, currentSlide, triggerIframeRefresh, studioShell\]\)/, 'handleSendElementCommand deps unchanged')

console.log('test-studio-insert-persist: ok')
