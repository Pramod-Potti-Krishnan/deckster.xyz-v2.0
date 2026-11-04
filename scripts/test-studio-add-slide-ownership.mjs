import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Native callback + native bridge/reconciliation only. Supplied local events
// and virtual timers never create a browser, Layout write or remote receipt.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const viewerOverride = process.argv.indexOf('--viewer-source')
const viewerSource = viewerOverride >= 0 ? fs.readFileSync(process.argv[viewerOverride + 1], 'utf8') : read('components/presentation-viewer.tsx')
const source = ts.createSourceFile('viewer.tsx', viewerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
assert.equal(source.parseDiagnostics.length, 0)
const baseline = ts.createSourceFile('baseline.tsx', execFileSync('git', ['show', '08462e6:components/presentation-viewer.tsx'], { encoding: 'utf8' }), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, predicate) {
  if (predicate(node)) return node
  let result
  ts.forEachChild(node, child => { if (!result) result = find(child, predicate) })
  return result
}
const nativeEntryBaseline = ts.createSourceFile('native-entry-baseline.tsx', execFileSync('git', ['show', '2778388:components/presentation-viewer.tsx'], { encoding: 'utf8' }), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declaration = name => find(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === name)
const callback = (name, tree = source) => find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name).initializer.arguments[0].getText(tree)
const nativeFunction = name => find(source, node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(source)
const printer = ts.createPrinter({ removeComments: true })
const print = (node, tree) => printer.printNode(ts.EmitHint.Unspecified, node, tree)
for (const name of ['sendCommand', 'createViewerRequestId']) {
  const original = find(baseline, node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  const current = find(source, node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.equal(print(current, source), print(original, baseline), `${name}: actual native receipt bridge remains unchanged`)
}
const mutationCall = tree => find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'sendLayoutMutationWithReconciliation')
assert.equal(print(mutationCall(source), source), print(mutationCall(baseline), baseline), 'exact native mutation callback/options/12×250 reconciliation remain unchanged')
function evaluate(text, context) {
  return vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
}
function pure(path, context) {
  const module = { exports: {} }
  evaluate(read(path), { ...context, module, exports: module.exports })
  return module.exports
}
function harness(...flags) {
  const flag = flags.length ? flags[0] : 'true'
  const callbackSource = flags[2] ? nativeEntryBaseline : flags[1] ? baseline : source
  const events = [], listeners = new Set(), timers = new Map(), commands = []
  const thumbnailInvalidations = []
  let timerSequence = 0, iframeSequence = 0
  const c = {
    URL, Promise, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    studioShell: flag === 'true', currentSlide: 1, totalSlides: 3, isEditMode: false,
    studioOwnerUserId: 'user-A', onThumbnailMutationCapture: undefined,
    thumbnailNativeRevisionRef: { current: 0 }, thumbnailMetadataRef: { current: { revision: 0 } },
    studioCanonicalThumbnails: null, slideStructure: null, slidesModifiedByCrud: false,
    setStudioCanonicalThumbnails: () => {},
    presentationId: 'presentation-A', presentationUrl: 'https://fixture.invalid/A', approvedIframeNavigationUrl: 'https://fixture.invalid/A',
    sessionId: 'session-A', deckOwnerSessionId: 'session-A', activeVersion: 'final',
    display: 'A', serial: 0, crypto: { randomUUID: () => `supplied-request-${++c.serial}` },
    VIEWER_ORIGIN: 'https://fixture.invalid', READ_LAYOUT_COMMAND_TIMEOUT_MS: 8000, MUTATING_LAYOUT_COMMAND_TIMEOUT_MS: 30000,
    debugLog: () => {}, scTrace: () => {}, console: { error: () => {}, warn: () => {} },
    setSelectedTextBoxId: value => events.push(['selected-text', c.display, value]),
    onTextBoxSelected: (...args) => events.push(['text-selection', c.display, ...args]),
    onElementSelected: (...args) => events.push(['element-selection', c.display, ...args]),
    onTextBoxDeselected: () => events.push(['text-deselection', c.display]),
    onElementDeselected: () => events.push(['element-deselection', c.display]),
    onElementDeleted: value => events.push(['element-deleted', c.display, value]),
    isSlideComposerTraceEnabled: () => false, isMatchingSlideComposeCommandResponse: () => false,
    iframeRef: { current: null }, slideMutationPendingRef: { current: false },
    nativeSnapshotStructureEditedRef: { current: false }, snapshotSelectionRef: { current: null },
    onSlideChangeRef: { current: value => events.push(['parent-slide', c.display, value]) },
    onThumbnailInvalidatedRef: { current: value => thumbnailInvalidations.push(value) },
    onEditModeChange: value => events.push(['parent-edit', c.display, value]),
    setIsSlideMutationPending: value => events.push(['pending', c.display, value]),
    setTotalSlides: value => events.push(['count', c.display, value]),
    setCurrentSlide: value => events.push(['slide', c.display, value]),
    setSelectedSlideIndices: value => events.push(['rail-selection', c.display, JSON.parse(JSON.stringify(value))]),
    setSlidesModifiedByCrud: value => events.push(['crud', c.display, value]),
    setIsEditMode: value => {
      c.isEditMode = typeof value === 'function' ? value(c.isEditMode) : value
      events.push(['edit', c.display, c.isEditMode])
    },
    isGridActive: false, isBordersActive: false,
    setIsGridActive: value => events.push(['grid', c.display, value]),
    setIsBordersActive: value => events.push(['borders', c.display, value]),
    setIsFullscreen: value => events.push(['fullscreen', c.display, value]),
    containerRef: { current: { requestFullscreen: async () => events.push(['request-fullscreen', c.display]) } },
    document: { fullscreenElement: null, exitFullscreen: async () => events.push(['exit-fullscreen', c.display]) },
    toast: value => events.push(['toast', c.display, value.title, value.description]),
    recordValue: value => value && typeof value === 'object' ? value : null,
    setTimeout(fn, delay) { const id = ++timerSequence; timers.set(id, { fn, delay }); return id },
    clearTimeout: id => timers.delete(id),
    window: { addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) },
    useRef: value => ({ current: value }),
  }
  Object.assign(c, pure('lib/layout-viewer-messaging.ts', c), pure('lib/layout-command-result.ts', c))
  c.automatic = () => true
  c.replyData = action => action === 'addSlide'
    ? { success: true, slide_index: 1, slide_count: 4 }
    : action === 'getElementMutationReceipt'
      ? { success: true, status: 'completed', result: { success: true, slide_index: 1, slide_count: 4 } }
      : action === 'isEditModeActive' ? { success: true, isEditing: false }
        : ['toggleEditMode', 'enterEditMode'].includes(action) ? { success: true, isEditing: true } : { success: true }
  function reply(command, data = c.replyData(command.message.action)) {
    for (const listener of [...listeners]) listener({
      origin: 'https://fixture.invalid', source: command.frame.contentWindow,
      data: { action: command.message.action, requestId: command.message.requestId, ...data },
    })
  }
  function iframe(name) {
    const frame = { src: `https://fixture.invalid/${name}`, fixtureId: ++iframeSequence, contentWindow: {
      postMessage(message) {
        const command = { frame, message }
        commands.push(command)
        events.push(['command', c.display, name, message.action])
        if (c.automatic(message.action)) reply(command)
      },
    } }
    return frame
  }
  c.iframeRef.current = iframe('A')
  evaluate(`${nativeFunction('createViewerRequestId')}\n${nativeFunction('sendCommand')}`, c)
  for (const name of ['slideMutationMountRef', 'slideMutationRequestRef', 'slideMutationOwnerRef', ...(declaration('viewerInteractionIntentRef') ? ['viewerInteractionIntentRef'] : [])]) {
    evaluate(`globalThis.${name} = ${declaration(name).initializer.getText(source)}`, c)
  }
  const ownerUpdate = find(source, node => ts.isIfStatement(node) && node.expression.getText(source).includes('slideMutationOwnerRef.current.presentationId'))
  const effect = contains => find(source, node => ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes(contains)).arguments[0].getText(source)
  evaluate(`globalThis.renderOwner = () => { ${ownerUpdate.getText(source)}; return slideMutationOwnerRef.current };
    globalThis.setup = ${effect('slideMutationMountRef.current.active = true')};
    globalThis.mirrorPending = ${effect('setIsSlideMutationPending(slideMutationPendingRef.current)')};
    globalThis.cleanup = setup();`, c)
  function bind() {
    const owner = c.renderOwner()
    c.renderSlideMutationOwner = owner
    if (declaration('captureThumbnailInvalidation')) evaluate(`globalThis.captureThumbnailInvalidation = ${callback('captureThumbnailInvalidation')}`, c)
    if (declaration('beginStudioViewerInteraction')) evaluate(`globalThis.beginStudioViewerInteraction = ${callback('beginStudioViewerInteraction')}`, c)
    c.mirrorPending()
    evaluate(`globalThis.add = (() => {
      const currentSlide = globalThis.currentSlide, totalSlides = globalThis.totalSlides, isEditMode = globalThis.isEditMode;
      const renderSlideMutationOwner = globalThis.renderSlideMutationOwner;
      const beginStudioViewerInteraction = globalThis.beginStudioViewerInteraction;
      const ensureEditMode = ${callback('ensureEditMode', callbackSource)};
      globalThis.ensure = ensureEditMode;
      globalThis.mode = ${callback('handleToggleEditModeButton', callbackSource)};
      globalThis.present = ${callback('handleFullscreen', callbackSource)};
      return ${callback('handleAddSlide', callbackSource)};
    })()`, c)
  }
  bind()
  function selection(kind, data) {
    c.ensureEditMode = c.ensure
    const marker = kind === 'text' ? "event.data.type === 'textBoxSelected'" : "event.data.type === 'elementSelected'"
    const effect = find(callbackSource, node => ts.isCallExpression(node) && node.expression.getText(callbackSource) === 'useEffect' && node.arguments[0]?.getText(callbackSource).includes(marker))
    const handler = find(effect.arguments[0], node => ts.isVariableDeclaration(node) && node.name.getText(callbackSource) === 'handleMessage').initializer.getText(callbackSource)
    const fn = evaluate(`(${handler})`, c)
    return fn({ origin: 'https://fixture.invalid', source: c.iframeRef.current?.contentWindow, data })
  }
  function retire(name = 'B', { sameIframe = false, unmount = false } = {}) {
    const oldIframe = c.iframeRef.current
    c.display = name
    c.presentationId = `presentation-${name}`
    c.presentationUrl = `https://fixture.invalid/${name}`
    c.approvedIframeNavigationUrl = c.presentationUrl
    c.iframeRef.current = unmount ? null : sameIframe ? oldIframe : iframe(name)
    if (oldIframe && c.iframeRef.current !== oldIframe) oldIframe.contentWindow = null
    if (unmount) c.cleanup()
    else bind()
    return events.length
  }
  async function tick() { for (let step = 0; step < 20; step++) await Promise.resolve() }
  async function drain() {
    for (let step = 0; step < 100; step++) {
      await tick()
      if (!timers.size && !listeners.size) return
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn() }
    }
    assert.fail('native command/reconciliation virtual timers did not settle')
  }
  return { c, events, commands, timers, reply, retire, bind, tick, drain, selection, thumbnailInvalidations }
}

let cases = 0
const failures = []
async function check(name, test) {
  try { await test(); cases++; console.log(`PASS ${name}`) }
  catch (error) { failures.push({ name, message: error.message }); console.log(`FAIL ${name}: ${error.message}`) }
}
await check('owned native Add ACK selects the inserted rail card before navigation settles', async () => {
  const h = harness(); h.c.automatic = action => action !== 'goToSlide'
  const baseReply = h.c.replyData
  h.c.replyData = action => action === 'addSlide' ? { success: true, slide_index: 6, slide_count: 7 } : baseReply(action)
  const pending = h.c.add('H2'); await h.tick()
  assert.deepEqual(h.events.filter(event => event[0] === 'rail-selection'), [['rail-selection', 'A', [6]]])
  assert.ok(h.events.findIndex(event => event[0] === 'rail-selection') < h.events.findIndex(event => event[0] === 'command' && event[3] === 'goToSlide'))
  h.reply(h.commands.at(-1)); await h.drain(); await pending
})
await check('retired Add receipt cannot select a returned owner rail', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const pending = h.c.add('H2'); await h.tick(); const held = h.commands[0]
  h.retire('B', { sameIframe: true }); h.retire('A', { sameIframe: true })
  h.reply(held); await h.drain(); await pending
  assert.deepEqual(h.events.filter(event => event[0] === 'rail-selection'), [])
})
for (const flag of [undefined, 'false', 'TRUE']) await check(`classic ${String(flag)} Add does not change explicit rail selection`, async () => {
  const h = harness(flag); await h.c.add('H2')
  assert.deepEqual(h.events.filter(event => event[0] === 'rail-selection'), [])
})
for (const flag of [undefined, 'false', 'TRUE', 'true']) {
  await check(`native success/options/ordering (${String(flag)})`, async () => {
    const h = harness(flag)
    await h.c.add('L29')
    assert.deepEqual(h.commands.map(({ message }) => message.action), ['addSlide', 'goToSlide', 'toggleBorderHighlight', ...(flag === 'true' ? ['isEditModeActive', 'enterEditMode'] : ['toggleEditMode'])])
    assert.equal(h.commands[0].message.params.layout, 'L29')
    assert.equal(h.commands[0].message.params.position, 1)
    assert.match(h.commands[0].message.params.mutationId, /^add-slide:/)
    assert.ok(h.events.findIndex(event => event[0] === 'parent-slide') < h.events.findIndex(event => event[0] === 'command' && event[3] === 'goToSlide'))
    assert.equal(h.c.slideMutationPendingRef.current, false)
    assert.deepEqual(h.thumbnailInvalidations, flag === 'true' ? ['presentation-A'] : [])
  })
}
for (const flag of [undefined, 'false', 'TRUE']) {
  for (const phase of ['addSlide', 'toggleBorderHighlight']) {
    await check(`default-off ${String(flag)} native retirement behavior equals fixed baseline (${phase})`, async () => {
      async function run(original) {
        const h = harness(flag, original)
        h.c.automatic = action => action !== phase
        const pending = h.c.add('L01'); await h.tick(); h.reply(h.commands.at(-1))
        h.retire('B'); await h.drain(); await pending
        return JSON.stringify(h.events.filter(event => event[0] !== 'pending'))
      }
      assert.equal(await run(false), await run(true))
    })
  }
}
await check('native same-tick duplicate admission', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const first = h.c.add('L01'); await h.c.add('L02')
  assert.equal(h.commands.length, 1)
  h.reply(h.commands[0]); await first
})
await check('native explicit negative receipt has no optimistic count/selection and permits retry', async () => {
  const h = harness(); h.c.replyData = () => ({ success: false, error: 'Supplied local refusal' })
  await h.c.add('L01')
  assert.equal(h.commands.length, 1)
  assert.equal(h.events.some(event => ['count', 'slide', 'parent-slide'].includes(event[0])), false)
  assert.equal(h.c.slideMutationPendingRef.current, false)
})
await check('native lost acknowledgement reconciles exact mutation identity', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const pending = h.c.add('L01'); await h.drain(); await pending
  assert.equal(h.commands[1].message.action, 'getElementMutationReceipt')
  assert.equal(h.commands[1].message.params.mutationId, h.commands[0].message.params.mutationId)
  assert.ok(h.events.some(event => event[0] === 'toast' && event[2] === 'Slide Added'))
})
await check('native unresolved receipt retains 12 attempts and honest reload recovery', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  h.c.replyData = () => ({ success: true, status: 'pending' })
  const pending = h.c.add('L01'); await h.drain(); await pending
  assert.equal(h.commands.filter(command => command.message.action === 'getElementMutationReceipt').length, 12)
  assert.equal(h.events.some(event => event[0] === 'count'), false)
  assert.ok(h.events.some(event => event[0] === 'toast' && event[2] === 'Check slide result' && /Reload before trying again/.test(event[3])))
})
await check('native changed slide preserves admitted insertion target and authoritative ACK order', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const pending = h.c.add('L01'); h.c.currentSlide = 3; h.bind()
  h.reply(h.commands[0]); await pending
  assert.equal(h.commands[0].message.params.position, 1)
  assert.ok(h.events.some(event => event[0] === 'parent-slide' && event[2] === 2))
})

// ACKs are local native message events. Retirement immediately after event
// settlement exercises the outer Promise continuation, not a fake command.
for (const phase of ['addSlide', 'getElementMutationReceipt', 'goToSlide', 'toggleBorderHighlight', 'isEditModeActive', 'enterEditMode']) {
  for (const retirement of ['B', 'ABA', 'exact-iframe', 'unmount']) {
    await check(`Studio ${phase} outer continuation rejects retired ${retirement}`, async () => {
      const h = harness()
      h.c.automatic = action => action !== phase && !(phase === 'getElementMutationReceipt' && action === 'addSlide')
      const pending = h.c.add('L01')
      await h.tick()
      if (phase === 'getElementMutationReceipt') {
        for (const [id, timer] of [...h.timers]) { h.timers.delete(id); timer.fn() }
        await h.tick()
      }
      const command = h.commands.at(-1)
      assert.equal(command.message.action, phase)
      h.reply(command)
      let boundary
      if (retirement === 'ABA') { h.retire('B'); boundary = h.retire('A') }
      else if (retirement === 'exact-iframe') boundary = h.retire('A')
      else if (retirement === 'unmount') boundary = h.retire('unmounted', { unmount: true })
      else boundary = h.retire('B')
      await h.drain(); await pending
      const late = h.events.slice(boundary).filter(event => event[0] !== 'pending')
      assert.equal(late.length, 0, `retired native continuation leaked ${JSON.stringify(late)}`)
    })
  }
}
await check('Studio real old-iframe timeout emits no current-owner recovery notice', async () => {
  const h = harness(); h.c.automatic = action => action !== 'goToSlide'
  const pending = h.c.add('L01'); await h.tick()
  const boundary = h.retire('B'); await h.drain(); await pending
  assert.equal(h.events.slice(boundary).some(event => event[0] === 'toast'), false)
})
await check('Studio presentation/source render generation changes even when exact iframe survives', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const pending = h.c.add('L01'); h.reply(h.commands[0])
  const boundary = h.retire('B', { sameIframe: true }); await h.drain(); await pending
  assert.equal(h.events.slice(boundary).filter(event => event[0] !== 'pending').length, 0)
})
await check('Studio exact URL refresh retires same-presentation source', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const pending = h.c.add('L01'); h.reply(h.commands[0])
  h.c.approvedIframeNavigationUrl += '?refresh=2'; h.bind()
  const boundary = h.events.length; await h.drain(); await pending
  assert.equal(h.events.slice(boundary).filter(event => event[0] !== 'pending').length, 0)
})
await check('Studio stale render callback cannot admit against adopted owner', async () => {
  const h = harness(), old = h.c.add
  h.retire('B'); const boundary = h.events.length
  await old('L01')
  assert.equal(h.commands.length, 0)
  assert.equal(h.events.length, boundary)
})
await check('Studio new owner admits immediately; old success finally cannot release its pending request', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const original = h.c.add('L01'); h.reply(h.commands[0])
  h.retire('B'); const current = h.c.add('L02')
  assert.equal(h.commands.length, 2)
  await original
  assert.equal(h.c.slideMutationPendingRef.current, true)
  await h.c.add('L03'); assert.equal(h.commands.length, 2)
  h.reply(h.commands[1]); await current
  assert.equal(h.c.slideMutationPendingRef.current, false)
  assert.ok(h.events.some(event => event[0] === 'toast' && event[1] === 'B' && event[2] === 'Slide Added'))
})
await check('Studio cleanup/setup remount generation retires old completion without releasing new same-iframe request', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const original = h.c.add('L01'); h.reply(h.commands[0])
  h.c.cleanup(); h.c.cleanup = h.c.setup(); h.bind()
  const current = h.c.add('L02'); await original
  assert.equal(h.commands.length, 2)
  assert.equal(h.c.slideMutationPendingRef.current, true)
  h.reply(h.commands[1]); await current
  assert.equal(h.c.slideMutationPendingRef.current, false)
})
await check('Studio retired timeout/ambiguous receipt cannot release B pending request or leak recovery', async () => {
  const h = harness(); h.c.automatic = action => action !== 'addSlide'
  const original = h.c.add('L01')
  h.retire('B'); const boundary = h.events.length
  const current = h.c.add('L02')
  const protectedTimer = [...h.timers.keys()].at(-1)
  for (let step = 0; step < 100; step++) {
    await h.tick()
    const oldTimers = [...h.timers].filter(([id]) => id !== protectedTimer)
    if (!oldTimers.length) break
    for (const [id, timer] of oldTimers) { h.timers.delete(id); timer.fn() }
  }
  await original
  assert.equal(h.c.slideMutationPendingRef.current, true)
  assert.equal(h.events.slice(boundary).some(event => event[0] === 'toast'), false)
  h.reply(h.commands[1]); await current
  assert.equal(h.c.slideMutationPendingRef.current, false)
})
for (const phase of ['addSlide', 'getElementMutationReceipt', 'goToSlide', 'toggleBorderHighlight', 'isEditModeActive', 'enterEditMode']) {
  await check(`Studio negative ${phase} receipt after retirement has no current-owner failure`, async () => {
    const h = harness(); h.c.automatic = action => action !== phase && !(phase === 'getElementMutationReceipt' && action === 'addSlide')
    const pending = h.c.add('L01'); await h.tick()
    if (phase === 'getElementMutationReceipt') {
      for (const [id, timer] of [...h.timers]) { h.timers.delete(id); timer.fn() }
      await h.tick()
    }
    h.reply(h.commands.at(-1), { success: false, error: 'Supplied local refusal' })
    const boundary = h.retire('B'); await h.drain(); await pending
    assert.equal(h.events.slice(boundary).filter(event => event[0] !== 'pending').length, 0)
  })
}

// Exercise the actual native lazy-entry callback independently of Add Slide.
// Local postMessage receipts establish callback behavior, not a service ACK.
const editEvents = h => h.events.filter(event => ['edit', 'parent-edit'].includes(event[0]))
const nativeViewReplies = h => {
  const ordinary = h.c.replyData
  h.c.replyData = action => action === 'isEditModeActive'
    ? { success: true, isEditing: false }
    : ordinary(action)
}
await check('Studio native already editing adopts true without toggling or re-entering', async () => {
  const h = harness()
  h.c.replyData = () => ({ success: true, isEditing: true })
  assert.equal(await h.c.ensure(), true)
  assert.deepEqual(h.commands.map(command => command.message.action), ['isEditModeActive'])
  assert.equal(editEvents(h).length, 2)
  assert.ok(editEvents(h).every(event => event[2] === true))
})
await check('Studio native view reads then enters explicitly with unchanged empty parameters', async () => {
  const h = harness(); nativeViewReplies(h)
  assert.equal(await h.c.ensure(), true)
  assert.deepEqual(h.commands.map(command => command.message.action), ['isEditModeActive', 'enterEditMode'])
  assert.ok(h.commands.every(command => command.message.params === undefined))
  assert.equal(editEvents(h).length, 2)
})
await check('Studio parent already editing still reads and adopts actual native editing', async () => {
  const h = harness(); h.c.isEditMode = true; h.bind()
  h.c.replyData = () => ({ success: true, isEditing: true })
  assert.equal(await h.c.ensure(), true)
  assert.deepEqual(h.commands.map(command => command.message.action), ['isEditModeActive'])
  assert.equal(editEvents(h).length, 2)
})
await check('Studio missing iframe returns false without adopting edit state', async () => {
  const h = harness(); h.c.iframeRef.current = null
  assert.equal(await h.c.ensure(), false)
  assert.equal(h.commands.length, 0)
  assert.equal(editEvents(h).length, 0)
})
for (const phase of ['isEditModeActive', 'enterEditMode']) {
  for (const failure of ['refused', 'timeout']) {
    await check(`Studio ${phase} ${failure} has no adoption or toggle fallback`, async () => {
      const h = harness(); nativeViewReplies(h)
      const ordinary = h.c.replyData
      if (failure === 'refused') h.c.replyData = action => action === phase
        ? { success: false, error: 'Supplied local edit refusal' } : ordinary(action)
      else h.c.automatic = action => action !== phase
      const pending = h.c.ensure(); await h.drain()
      assert.equal(await pending, false)
      assert.deepEqual(h.commands.map(command => command.message.action), phase === 'isEditModeActive'
        ? ['isEditModeActive'] : ['isEditModeActive', 'enterEditMode'])
      assert.equal(editEvents(h).length, 0)
    })
  }
}
await check('Studio successful entry receipt without isEditing never adopts state', async () => {
  const h = harness(); h.c.replyData = () => ({ success: true, isEditing: false })
  assert.equal(await h.c.ensure(), false)
  assert.equal(editEvents(h).length, 0)
  assert.deepEqual(h.commands.map(command => command.message.action), ['isEditModeActive', 'enterEditMode'])
})
for (const phase of ['isEditModeActive', 'enterEditMode']) {
  for (const retirement of ['B', 'ABA', 'exact-iframe', 'same-iframe', 'unmount']) {
    for (const readEditing of phase === 'isEditModeActive' ? [false, true] : [false]) {
      await check(`Studio lazy ${phase} retires ${retirement}, read editing=${readEditing}`, async () => {
        const h = harness()
        const owner = h.c.slideMutationOwnerRef.current
        const mount = h.c.slideMutationMountRef.current.generation
        const frame = h.c.iframeRef.current
        const isCurrent = () => h.c.slideMutationMountRef.current.active
          && h.c.slideMutationMountRef.current.generation === mount
          && h.c.slideMutationOwnerRef.current === owner && h.c.iframeRef.current === frame
        const ordinary = h.c.replyData
        h.c.replyData = action => action === 'isEditModeActive'
          ? { success: true, isEditing: readEditing } : ordinary(action)
        h.c.automatic = action => action !== phase
        const pending = h.c.ensure(frame, isCurrent); await h.tick()
        assert.equal(h.commands.at(-1).message.action, phase)
        h.reply(h.commands.at(-1))
        if (retirement === 'ABA') { h.retire('B'); h.retire('A') }
        else if (retirement === 'exact-iframe') h.retire('A')
        else if (retirement === 'same-iframe') h.retire('B', { sameIframe: true })
        else if (retirement === 'unmount') h.retire('unmounted', { unmount: true })
        else h.retire('B')
        const boundary = h.events.length, commandCount = h.commands.length
        await h.drain()
        assert.equal(await pending, false)
        assert.equal(h.commands.length, commandCount, 'retired read must not dispatch entry')
        assert.equal(h.events.slice(boundary).filter(event => event[0] !== 'pending').length, 0)
        assert.equal(editEvents(h).length, 0)
      })
    }
  }
}
await check('Studio expired caller guard prevents even the initial native read', async () => {
  const h = harness()
  assert.equal(await h.c.ensure(h.c.iframeRef.current, () => false), false)
  assert.equal(h.commands.length, 0)
  assert.equal(editEvents(h).length, 0)
})
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  for (const outcome of ['editing', 'not-editing', 'refused', 'timeout', 'parent-editing', 'missing-iframe']) {
    await check(`classic native edit callback matches exact baseline ${String(flag)} ${outcome}`, async () => {
      async function run(original) {
        const h = harness(flag, original)
        if (outcome === 'parent-editing') { h.c.isEditMode = true; h.bind() }
        if (outcome === 'missing-iframe') h.c.iframeRef.current = null
        if (outcome === 'timeout') h.c.automatic = () => false
        h.c.replyData = () => outcome === 'refused'
          ? { success: false, error: 'Supplied classic refusal' }
          : { success: true, isEditing: outcome !== 'not-editing' }
        const pending = h.c.ensure(); await h.drain()
        return { result: await pending, actions: h.commands.map(command => command.message.action), events: h.events }
      }
      assert.deepEqual(await run(false), await run(true))
    })
  }
}


// These supplied native states describe the unchanged message contract. The
// callback, bridge, desired-mode choice and retirement checks are actual source.
function nativeEditing(h, initially, pendingExit = false) {
  const state = { editing: initially }
  h.c.replyData = action => {
    if (action === 'isEditModeActive') return { success: true, isEditing: state.editing }
    if (action === 'enterEditMode') { state.editing = true; return { success: true, isEditing: true } }
    if (action === 'exitEditMode') {
      if (!pendingExit) state.editing = false
      // Native exit reports false even if its pending-save guard kept editing.
      return { success: true, isEditing: false }
    }
    return { success: true }
  }
  return state
}
const actions = h => h.commands.map(command => command.message.action)
const mirrored = h => editEvents(h).map(event => [event[0], event[2]])
await check('Studio stale parent true/native false re-enters after native E exit', async () => {
  const h = harness(); h.c.isEditMode = true; h.bind()
  nativeEditing(h, false)
  assert.equal(await h.c.ensure(), true)
  assert.deepEqual(actions(h), ['isEditModeActive', 'enterEditMode'])
  assert.deepEqual(mirrored(h), [['edit', true], ['parent-edit', true]])
})
await check('Studio native E/selection roundtrip reads both directions without toggles', async () => {
  const h = harness(), native = nativeEditing(h, true)
  assert.equal(await h.c.ensure(), true)
  h.bind()
  native.editing = false // supplied native E exit; parent still true
  assert.equal(await h.c.ensure(), true)
  h.bind()
  native.editing = true // supplied native editing before another selection
  assert.equal(await h.c.ensure(), true)
  assert.deepEqual(actions(h), ['isEditModeActive', 'isEditModeActive', 'enterEditMode', 'isEditModeActive'])
  assert.equal(h.c.isEditMode, true)
})
for (const parent of [false, true]) {
  for (const native of [false, true]) {
    for (const requested of [undefined, false, true]) {
      await check(`Studio Mode parent=${parent} native=${native} requested=${String(requested)}`, async () => {
        const h = harness(); h.c.isEditMode = parent; h.bind(); nativeEditing(h, native)
        await h.c.mode(requested)
        const desired = requested ?? !native
        assert.deepEqual(actions(h), ['isEditModeActive',
          ...(desired === native ? [] : [desired ? 'enterEditMode' : 'exitEditMode']), 'isEditModeActive'])
        assert.deepEqual(mirrored(h), [['edit', desired], ['parent-edit', desired]])
        assert.ok(h.commands.every(command => command.message.params === undefined))
      })
    }
  }
}
await check('Studio Mode pending native save refuses exit; observed true stays true', async () => {
  const h = harness(); h.c.isEditMode = false; h.bind(); nativeEditing(h, true, true)
  await h.c.mode(false)
  assert.deepEqual(actions(h), ['isEditModeActive', 'exitEditMode', 'isEditModeActive'])
  assert.deepEqual(mirrored(h), [['edit', true], ['parent-edit', true]])
})
for (const native of [false, true]) {
  await check(`Studio Present observes native ${native} despite stale parent ${!native}`, async () => {
    const h = harness(); h.c.isEditMode = !native; h.bind(); nativeEditing(h, native)
    await h.c.present()
    assert.deepEqual(actions(h), native ? ['isEditModeActive', 'exitEditMode', 'isEditModeActive'] : ['isEditModeActive'])
    assert.deepEqual(mirrored(h), [['edit', false], ['parent-edit', false]])
    assert.deepEqual(h.events.filter(event => event[0].includes('fullscreen')).map(event => [event[0], event[2]]),
      [['request-fullscreen', undefined], ['fullscreen', true]])
  })
}
await check('Studio Present pending native save refuses exit and never requests fullscreen', async () => {
  const h = harness(); h.c.isEditMode = false; h.bind(); nativeEditing(h, true, true)
  await h.c.present()
  assert.deepEqual(actions(h), ['isEditModeActive', 'exitEditMode', 'isEditModeActive'])
  assert.deepEqual(mirrored(h), [['edit', true], ['parent-edit', true]])
  assert.equal(h.events.some(event => event[0].includes('fullscreen')), false)
})
await check('Studio Present retains native overlay hide order and fullscreen exit', async () => {
  const h = harness(); h.c.isGridActive = true; h.c.isBordersActive = true; h.bind()
  nativeEditing(h, false)
  await h.c.present()
  assert.deepEqual(actions(h), ['isEditModeActive', 'hideGridOverlay', 'hideBorderHighlight'])
  assert.ok(h.events.findIndex(event => event[0] === 'borders') < h.events.findIndex(event => event[0] === 'request-fullscreen'))
  h.c.document.fullscreenElement = {}; h.bind()
  const start = h.commands.length
  await h.c.present()
  assert.equal(h.commands.length, start)
  assert.deepEqual(h.events.slice(-2), [['exit-fullscreen', 'A'], ['fullscreen', 'A', false]])
})
for (const operation of ['mode', 'present']) {
  for (const readNumber of [1, 2]) {
    await check(`Studio ${operation} replacement after native read ${readNumber} has no mirror/fullscreen`, async () => {
      const h = harness(); nativeEditing(h, true)
      let reads = 0
      h.c.automatic = action => action !== 'isEditModeActive' || ++reads !== readNumber
      const pending = operation === 'mode' ? h.c.mode(false) : h.c.present()
      await h.tick()
      const held = h.commands.at(-1)
      assert.equal(held.message.action, 'isEditModeActive')
      assert.equal(reads, readNumber)
      h.reply(held)
      const boundary = h.retire('B')
      const count = h.commands.length
      await h.drain(); await pending
      assert.equal(h.commands.length, count)
      assert.equal(h.events.slice(boundary).filter(event => event[0] !== 'pending').length, 0)
      assert.equal(editEvents(h).length, 0)
      assert.equal(h.events.some(event => event[0].includes('fullscreen')), false)
    })
  }
  for (const phase of ['initial-read', 'exit', 'observed-read']) {
    await check(`Studio ${operation} ${phase} refusal never mirrors or requests fullscreen`, async () => {
      const h = harness(); nativeEditing(h, true)
      const ordinary = h.c.replyData; let reads = 0
      h.c.replyData = action => {
        if (action === 'isEditModeActive') reads++
        const refused = phase === 'exit' ? action === 'exitEditMode'
          : action === 'isEditModeActive' && reads === (phase === 'initial-read' ? 1 : 2)
        return refused ? { success: false, error: 'Supplied native refusal' } : ordinary(action)
      }
      await (operation === 'mode' ? h.c.mode(false) : h.c.present())
      assert.equal(editEvents(h).length, 0)
      assert.equal(h.events.some(event => event[0].includes('fullscreen')), false)
    })
  }
}
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  for (const operation of ['mode', 'present']) {
    for (const parent of [false, true]) {
      for (const refused of [false, true]) {
        await check(`classic ${String(flag)} ${operation} parent=${parent} refusal=${refused} baseline parity`, async () => {
          async function run(original) {
            const h = harness(flag, original); h.c.isEditMode = parent; h.bind()
            h.c.replyData = () => refused ? { success: false, error: 'Supplied classic refusal' } : { success: true }
            await (operation === 'mode' ? h.c.mode(false) : h.c.present())
            return { actions: actions(h), events: h.events }
          }
          assert.deepEqual(await run(false), await run(true))
        })
      }
    }
  }
}


await check('frozen baseline reproduces native editing toggled off on lazy selection', async () => {
  const h = harness('true', true)
  let native = true
  h.c.replyData = action => {
    if (action === 'toggleEditMode') native = !native
    return { success: true, isEditing: native }
  }
  assert.equal(await h.c.ensure(), false)
  assert.equal(native, false)
  assert.deepEqual(actions(h), ['toggleEditMode'])
})
await check('frozen baseline stale parent true skips native E-exited editing state', async () => {
  const h = harness('true', true); h.c.isEditMode = true; h.bind()
  nativeEditing(h, false)
  assert.equal(await h.c.ensure(), true)
  assert.equal(h.commands.length, 0)
  assert.equal(editEvents(h).length, 0)
})


// The checkpoint really crosses these boundaries: execute its unchanged
// callback and receipt bridge, rather than a model of its control flow.
for (const operation of ['text', 'element', 'mode', 'present']) {
  await check(`2778388 reproduces same-iframe stale ${operation} continuation`, async () => {
    const h = harness('true', false, true)
    h.c.automatic = action => action !== 'isEditModeActive'
    const pending = ['text', 'element'].includes(operation)
      ? h.selection(operation, { type: operation === 'text' ? 'textBoxSelected' : 'elementSelected', elementId: 'old-A', elementType: 'CHART', properties: { chartType: 'bar' } })
      : operation === 'mode' ? h.c.mode(true) : h.c.present()
    await h.tick(); const held = h.commands.at(-1)
    const boundary = h.retire('B', { sameIframe: true })
    h.c.automatic = () => true; h.reply(held); await h.drain(); await pending
    assert.ok(h.events.slice(boundary).some(event => !['pending'].includes(event[0])), 'checkpoint must reproduce a stale continuation')
  })
}
for (const kind of ['text', 'element']) {
  for (const boundary of ['query', 'entry']) {
    await check(`Studio ${kind} selection retires on same-iframe owner change during ${boundary}`, async () => {
      const h = harness(); h.c.automatic = action => action !== (boundary === 'query' ? 'isEditModeActive' : 'enterEditMode')
      const pending = h.selection(kind, { type: kind === 'text' ? 'textBoxSelected' : 'elementSelected', elementId: 'old-A', elementType: 'CHART', properties: { chartType: 'bar' } })
      await h.tick(); const held = h.commands.at(-1); const count = h.commands.length
      const start = h.retire('B', { sameIframe: true }); h.reply(held); await h.drain(); await pending
      assert.equal(h.commands.length, count)
      assert.deepEqual(h.events.slice(start).filter(event => event[0] !== 'pending'), [])
    })
  }
  await check(`Studio ${kind} selection refuses native entry without adoption or arrange`, async () => {
    const h = harness(); const ordinary = h.c.replyData
    h.c.replyData = action => action === 'enterEditMode' ? { success: false, error: 'Native refusal' } : ordinary(action)
    await h.selection(kind, { type: kind === 'text' ? 'textBoxSelected' : 'elementSelected', elementId: 'refused', elementType: 'CHART', properties: {} })
    assert.equal(h.commands.some(command => command.message.action === 'bringToFront'), false)
    assert.equal(h.events.some(event => ['selected-text', 'text-selection', 'element-selection'].includes(event[0])), false)
  })
}
for (const operation of ['mode', 'present']) {
  await check(`Studio ${operation} retires on same-iframe owner change after read`, async () => {
    const h = harness(); h.c.automatic = action => action !== 'isEditModeActive'
    const pending = operation === 'mode' ? h.c.mode(true) : h.c.present()
    await h.tick(); const held = h.commands.at(-1); const count = h.commands.length
    const start = h.retire('B', { sameIframe: true }); h.reply(held); await h.drain(); await pending
    assert.equal(h.commands.length, count)
    assert.deepEqual(h.events.slice(start).filter(event => event[0] !== 'pending'), [])
  })
}


const selectionData = (kind, id = 'selected-current') => kind === 'text'
  ? { type: 'textBoxSelected', elementId: id, componentType: 'METRICS', formatting: { fontSize: 40, color: '#123456', bold: true } }
  : { type: 'elementSelected', elementId: id, elementType: 'chart', properties: { chartType: 'bar', data: [45, 70, 100], generationConfig: { prompt: 'Keep this prompt' } } }
for (const kind of ['text', 'element']) {
  for (const change of ['ABA', 'version', 'session', 'deck-owner', 'source', 'unmount', 'replacement']) {
    await check(`Studio ${kind} selection preserves lifetime across ${change}`, async () => {
      const h = harness(); h.c.automatic = action => action !== 'enterEditMode'
      const pending = h.selection(kind, selectionData(kind)); await h.tick(); const held = h.commands.at(-1)
      if (change === 'ABA') { h.retire('B', { sameIframe: true }); h.retire('A', { sameIframe: true }) }
      else if (change === 'unmount' || change === 'replacement') h.retire('B', { unmount: change === 'unmount' })
      else {
        if (change === 'version') h.c.activeVersion = 'strawman'
        if (change === 'session') h.c.sessionId = 'session-B'
        if (change === 'deck-owner') h.c.deckOwnerSessionId = 'owner-B'
        if (change === 'source') h.c.approvedIframeNavigationUrl += '?refresh=1'
        h.bind()
      }
      const start = h.events.length, count = h.commands.length
      h.reply(held); await h.drain(); await pending
      assert.equal(h.commands.length, count)
      assert.deepEqual(h.events.slice(start), [])
    })
  }
  for (const next of ['deselect', 'replacement', 'mode']) {
    await check(`Studio ${kind} pending selection yields to ${next} intent`, async () => {
      const h = harness(); h.c.automatic = action => action !== 'isEditModeActive'
      const pending = h.selection(kind, selectionData(kind, 'superseded')); await h.tick(); const held = h.commands.at(-1)
      h.c.automatic = () => true
      if (next === 'deselect') await h.selection(kind, { type: kind === 'text' ? 'textBoxDeselected' : 'elementDeselected', elementId: 'superseded' })
      else if (next === 'replacement') await h.selection(kind === 'text' ? 'element' : 'text', selectionData(kind === 'text' ? 'element' : 'text', 'replacement'))
      else await h.c.mode(true)
      const start = h.events.length, count = h.commands.length
      h.reply(held); await h.drain(); await pending
      assert.equal(h.commands.length, count)
      assert.deepEqual(h.events.slice(start), [])
      assert.equal(h.events.some(event => ['text-selection', 'element-selection'].includes(event[0]) && event[2] === 'superseded'), false)
      if (next === 'replacement') assert.equal(h.events.filter(event => ['text-selection', 'element-selection'].includes(event[0]) && event[2] === 'replacement').length, 1)
    })
  }
  for (const phase of ['query', 'entry-not-editing']) {
    await check(`Studio ${kind} ${phase} refusal does not open or arrange`, async () => {
      const h = harness(); const ordinary = h.c.replyData
      h.c.replyData = action => phase === 'query' && action === 'isEditModeActive'
        ? { success: false, error: 'Read refused' }
        : phase === 'entry-not-editing' && action === 'enterEditMode' ? { success: true, isEditing: false } : ordinary(action)
      await h.selection(kind, selectionData(kind))
      assert.equal(h.commands.some(command => command.message.action === 'bringToFront'), false)
      assert.equal(h.events.some(event => ['text-selection', 'element-selection', 'selected-text'].includes(event[0])), false)
    })
  }
}
for (const componentType of ['TEXT_BOX', 'METRICS', 'ICON', 'SHAPE']) {
  await check(`native text-backed ${componentType} positive selection preserves exact formatting`, async () => {
    const h = harness(); nativeEditing(h, true)
    const data = { ...selectionData('text'), componentType }
    await h.selection('text', data)
    const selected = h.events.find(event => event[0] === 'text-selection')
    assert.equal(selected[2], data.elementId); assert.equal(selected[3], data.formatting); assert.equal(selected[4], componentType)
    assert.deepEqual(actions(h), ['isEditModeActive', 'bringToFront'])
    assert.equal(h.commands.at(-1).message.params.elementId, data.elementId)
  })
}
for (const elementType of ['chart', 'image', 'table', 'diagram', 'infographic', 'shape']) {
  await check(`native ${elementType} positive selection preserves exact specialist properties`, async () => {
    const h = harness(); nativeEditing(h, true)
    const data = { ...selectionData('element'), elementType }
    await h.selection('element', data)
    const selected = h.events.find(event => event[0] === 'element-selection')
    assert.equal(selected[2], data.elementId); assert.equal(selected[3], elementType); assert.equal(selected[4], data.properties)
    assert.deepEqual(actions(h), ['isEditModeActive', 'bringToFront'])
  })
}
for (const operation of ['mode', 'present']) {
  for (const phase of ['exitEditMode', 'observed-read', ...(operation === 'present' ? ['hideGridOverlay', 'hideBorderHighlight'] : [])]) {
    await check(`Studio ${operation} retires after ${phase} before further commands/state`, async () => {
      const h = harness(); nativeEditing(h, true)
      h.c.isGridActive = true; h.c.isBordersActive = true; h.bind()
      let reads = 0
      h.c.automatic = action => phase === 'observed-read'
        ? action !== 'isEditModeActive' || ++reads !== 2 : action !== phase
      const pending = operation === 'mode' ? h.c.mode(false) : h.c.present()
      await h.tick(); const held = h.commands.at(-1)
      assert.equal(held.message.action, phase === 'observed-read' ? 'isEditModeActive' : phase)
      h.retire('B', { sameIframe: true }); const start = h.events.length, count = h.commands.length
      h.reply(held); await h.drain(); await pending
      assert.equal(h.commands.length, count); assert.deepEqual(h.events.slice(start), [])
    })
  }
  for (const change of ['ABA', 'version', 'session', 'unmount']) {
    await check(`Studio ${operation} read retires across ${change}`, async () => {
      const h = harness(); h.c.automatic = action => action !== 'isEditModeActive'
      const pending = operation === 'mode' ? h.c.mode(true) : h.c.present()
      await h.tick(); const held = h.commands.at(-1)
      if (change === 'ABA') { h.retire('B', { sameIframe: true }); h.retire('A', { sameIframe: true }) }
      else if (change === 'unmount') h.retire('B', { unmount: true })
      else { if (change === 'session') h.c.sessionId = 'session-B'; else h.c.activeVersion = 'blank'; h.bind() }
      const start = h.events.length, count = h.commands.length
      h.reply(held); await h.drain(); await pending
      assert.equal(h.commands.length, count); assert.deepEqual(h.events.slice(start), [])
    })
  }
}
for (const flag of [undefined, 'false', 'TRUE']) {
  for (const kind of ['text', 'element']) {
    await check(`classic ${String(flag)} ${kind} selection/refusal parity with 2778388`, async () => {
      async function run(original) {
        const h = harness(flag, false, original)
        h.c.replyData = () => ({ success: false, error: 'Existing classic refusal' })
        await h.selection(kind, selectionData(kind)); await h.tick()
        return JSON.stringify({ events: h.events, actions: actions(h) })
      }
      assert.equal(await run(false), await run(true))
    })
  }
}

console.log(`${cases} native Add Slide ownership cases passed; ${failures.length} failed. Offline callbacks/events only.`)
if (failures.length) process.exitCode = 1
