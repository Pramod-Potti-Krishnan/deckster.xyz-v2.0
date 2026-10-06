import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/studio-workspace-layout.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
const module = { exports: {} }
vm.runInNewContext(compiled.outputText, { module, exports: module.exports })
const { allocateStudioWorkspace, resizeStudioPane } = module.exports
const baseline = { width: 1440, chatPreference: 304, inspectorPreference: 420, chatOpen: true, inspectorOpen: true, activePane: 'inspector' }

for (const width of [1100, 1200, 1440, 1920]) {
  const layout = allocateStudioWorkspace({ ...baseline, width })
  assert.equal(layout.dualPane, true)
  assert.equal(layout.chatVisible, true)
  assert.equal(layout.inspectorVisible, true)
  assert.ok(layout.chatWidth >= 280 && layout.chatWidth <= 360)
  assert.ok(layout.inspectorWidth >= 320 && layout.inspectorWidth <= 400)
  assert.ok(layout.canvasWidth >= 480, `wide canvas budget at ${width}`)
}
for (const width of [320, 500, 768, 1099]) {
  for (const activePane of ['chat', 'inspector']) {
    const layout = allocateStudioWorkspace({ ...baseline, width, activePane })
    assert.equal(layout.dualPane, false)
    assert.equal(layout.chatVisible, activePane === 'chat')
    assert.equal(layout.inspectorVisible, activePane === 'inspector')
    assert.equal(activePane === 'chat' ? layout.right : layout.left, 0)
    assert.ok(layout.canvasWidth >= 0)
    assert.equal(layout.left + layout.right + layout.canvasWidth, width)
  }
}
const collapsed = allocateStudioWorkspace({ ...baseline, width: 1100, inspectorCollapsed: true })
assert.equal(collapsed.right, 28)
assert.equal(collapsed.chatVisible, true)
assert.ok(collapsed.canvasWidth >= 480)
const fallback = allocateStudioWorkspace({ ...baseline, width: Number.NaN, chatPreference: Infinity, inspectorPreference: -5 })
assert.ok(Number.isFinite(fallback.canvasWidth))
assert.ok(fallback.canvasWidth >= 480)
const closedInspector = allocateStudioWorkspace({ ...baseline, width: 900, inspectorOpen: false })
assert.equal(closedInspector.presentedPane, 'chat')
assert.equal(closedInspector.chatVisible, true)
const closedChat = allocateStudioWorkspace({ ...baseline, width: 900, activePane: 'chat', chatOpen: false })
assert.equal(closedChat.presentedPane, 'inspector')
assert.equal(closedChat.inspectorVisible, true)
const snapshot = JSON.stringify(baseline)
allocateStudioWorkspace({ ...baseline, width: 500 })
assert.equal(JSON.stringify(baseline), snapshot, 'allocation must not mutate owner inputs or preferences')
assert.equal(resizeStudioPane(320, 100, 124, 'chat'), 344)
assert.equal(resizeStudioPane(320, 100, 124, 'inspector'), 296)
assert.equal(resizeStudioPane(320, 100, 76, 'inspector'), 344)
const roomyChat = allocateStudioWorkspace({ ...baseline, width: 1440, inspectorOpen: false, chatPreference: 640 })
assert.equal(roomyChat.chatWidth, 640, 'single-pane conversation can use available room')
assert.ok(roomyChat.canvasWidth >= 480)
const withInspector = allocateStudioWorkspace({ ...baseline, width: 1440, chatPreference: 640 })
assert.equal(withInspector.chatWidth, 360, 'opening an inspector preserves the canvas floor')
assert.equal(roomyChat.chatWidth, 640, 'allocation never overwrites the saved wider preference')
console.log('Studio workspace allocation and natural resize direction passed')

for (const width of [240, 324, 500, 600]) {
  for (const activePane of ['chat', 'inspector']) {
    for (const chatOpen of [false, true]) for (const inspectorOpen of [false, true]) {
      const input = { ...baseline, width, activePane, chatOpen, inspectorOpen, overlay: true }
      const before = JSON.stringify(input)
      const pane = allocateStudioWorkspace(input)
      const stage = allocateStudioWorkspace({ ...input, stageSelected: true })
      assert.equal(pane.chatWidth, width, 'foreground Chat uses the measured workspace')
      assert.equal(pane.inspectorWidth, width, 'foreground Inspector uses the measured workspace')
      assert.equal(pane.canvasWidth, width, 'mounted Stage always has positive geometry')
      assert.equal(stage.chatVisible, false, 'Stage selection hides presentation only, without closing owners')
      assert.equal(stage.inspectorVisible, false)
      assert.equal(stage.canvasWidth, width)
      assert.equal(JSON.stringify(input), before, 'small-screen selection never writes preferences or owners')
      assert.ok(!(pane.chatVisible && pane.inspectorVisible), 'only one foreground pane owns the screen')
    }
  }
}
for (const width of [601, 768, 900, 1100, 1440]) {
  const input = { ...baseline, width }
  assert.equal(JSON.stringify(allocateStudioWorkspace(input)), JSON.stringify(allocateStudioWorkspace({ ...input, stageSelected: true })), 'Stage selection cannot alter the existing wider allocation')
}
const compactCollapsed = allocateStudioWorkspace({ ...baseline, width: 324, overlay: true, inspectorCollapsed: true })
assert.equal(compactCollapsed.right, 28, 'native collapsed Template handle remains available')
assert.equal(compactCollapsed.canvasWidth, 296)
console.log('Small-screen full-width pane ownership and retained Stage geometry passed')
