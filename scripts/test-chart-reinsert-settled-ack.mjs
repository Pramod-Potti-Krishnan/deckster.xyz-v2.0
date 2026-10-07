// J3.0 / ELEMENT L-04 F10: Studio side of the chart re-insert settled ACK.
// Flag NEXT_PUBLIC_CHART_REINSERT_SETTLED_ACK_ENABLED (exact 'true', default off).
//
// Nothing here calls a service: the Layout viewer is a mock that answers with ACK payloads.
// The FIXTURES block holds the ACKs a real Layout viewer produced for contract v1 (branch
// element/chart-reinsert-ack, flag on; a self-authored Chart.js chart, offline). The 'synthetic'
// entries are contract examples / failure-matrix rows (and the additive v1.1 render.page_errors)
// that the evidence run did not hit.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = relativePath => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

function loadModule(relativePath, { env = {}, requires = {}, warn = () => {} } = {}) {
  const mod = { exports: {} }
  new Function('module', 'exports', 'process', 'console', 'require', compile(read(relativePath)))(
    mod,
    mod.exports,
    { env },
    { warn },
    id => {
      if (!(id in requires)) throw new Error(`Unexpected test import: ${id}`)
      return requires[id]
    },
  )
  return mod.exports
}

const FLAG = 'NEXT_PUBLIC_CHART_REINSERT_SETTLED_ACK_ENABLED'

// FIXTURES-BEGIN
const FIXTURES = {
  "legacy_same_id": {
    "success": true,
    "action": "insertChart",
    "requestId": "f10-3",
    "elementId": "chart_f10a",
    "replaced": true,
    "position": {
      "gridRow": "6/16",
      "gridColumn": "3/17"
    }
  },
  "settled_success_apply": {
    "success": true,
    "action": "insertChart",
    "requestId": "f10-3",
    "elementId": "chart_f10a",
    "replaced": true,
    "position": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "element_id": "chart_f10a",
    "ok": true,
    "applied": true,
    "rendered": true,
    "persisted": true,
    "geometry": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "geometry_changed": true,
    "settle_ms": 71,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 16
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    }
  },
  "settled_success_slow_library": {
    "success": true,
    "action": "insertChart",
    "requestId": "f10-3",
    "elementId": "chart_slow",
    "position": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "element_id": "chart_slow",
    "ok": true,
    "applied": true,
    "replaced": false,
    "rendered": true,
    "persisted": true,
    "geometry": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "geometry_changed": false,
    "settle_ms": 1563,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 1512
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    }
  },
  "fail_throws": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-2",
    "elementId": "c1",
    "position": {
      "gridRow": "6/16",
      "gridColumn": "3/10"
    },
    "element_id": "c1",
    "ok": false,
    "applied": true,
    "replaced": false,
    "rendered": false,
    "persisted": true,
    "geometry": {
      "gridRow": "6/16",
      "gridColumn": "3/10"
    },
    "geometry_changed": false,
    "settle_ms": 54,
    "render": {
      "instance": false,
      "external_script_failures": [],
      "script_errors": [
        "Uncaught Error: plugin missing (simulated runtime failure)"
      ],
      "badge": false,
      "waited_ms": 0
    },
    "persist": {
      "status": "saved",
      "waited_ms": 53
    },
    "error": "A chart script threw: Uncaught Error: plugin missing (simulated runtime failure)",
    "errorCode": "CHART_RENDER_FAILED"
  },
  "fail_unreachable_cdn": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-3",
    "elementId": "c2",
    "position": {
      "gridRow": "6/16",
      "gridColumn": "10/17"
    },
    "element_id": "c2",
    "ok": false,
    "applied": true,
    "replaced": false,
    "rendered": false,
    "persisted": true,
    "geometry": {
      "gridRow": "6/16",
      "gridColumn": "10/17"
    },
    "geometry_changed": false,
    "settle_ms": 68,
    "render": {
      "instance": true,
      "external_script_failures": [
        "http://127.0.0.1:9/plugin.js"
      ],
      "script_errors": [],
      "badge": false,
      "waited_ms": 16
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    },
    "error": "A chart script could not be loaded: http://127.0.0.1:9/plugin.js",
    "errorCode": "CHART_RENDER_FAILED"
  },
  "fail_chartjs_rejects": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-4",
    "elementId": "c3",
    "position": {
      "gridRow": "6/16",
      "gridColumn": "17/24"
    },
    "element_id": "c3",
    "ok": false,
    "applied": true,
    "replaced": false,
    "rendered": false,
    "persisted": true,
    "geometry": {
      "gridRow": "6/16",
      "gridColumn": "17/24"
    },
    "geometry_changed": false,
    "settle_ms": 104,
    "render": {
      "instance": false,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 53
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    },
    "error": "Chart error: \"bogus-type\" is not a registered controller.",
    "errorCode": "CHART_RENDER_FAILED"
  },
  "fail_does_not_compile": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-5",
    "error": "Chart could not be inserted because its generated script is invalid. Regenerate the chart and try again.",
    "errorCode": "CHART_SCRIPT_SYNTAX_ERROR",
    "detail": "Inline chart script 1: Invalid or unexpected token",
    "element_id": "c4",
    "elementId": "c4",
    "ok": false,
    "applied": false,
    "rendered": false,
    "persisted": false,
    "settle_ms": 0
  },
  "fail_persist": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-2",
    "elementId": "chart_f10a",
    "position": {
      "gridRow": "6/16",
      "gridColumn": "3/17"
    },
    "element_id": "chart_f10a",
    "ok": false,
    "applied": true,
    "replaced": false,
    "rendered": true,
    "persisted": false,
    "geometry": {
      "gridRow": "6/16",
      "gridColumn": "3/17"
    },
    "geometry_changed": false,
    "settle_ms": 2093,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 12
    },
    "persist": {
      "status": "failed",
      "request_reference": "save-e3fd2b96",
      "waited_ms": 2065
    },
    "error": "Save interrupted. Changes are still pending — select this message to retry. Request reference: save-e3fd2b96.",
    "errorCode": "CHART_PERSIST_FAILED"
  },
  "synthetic_persist_failed_contract_example": {
    "success": false,
    "ok": false,
    "action": "insertChart",
    "requestId": "v-43",
    "element_id": "chart_1fb15c2e",
    "applied": true,
    "rendered": true,
    "persisted": false,
    "error": "Save interrupted. Changes are still pending - select this message to retry. Request reference: save-3fa9c2d1.",
    "errorCode": "CHART_PERSIST_FAILED",
    "persist": {
      "status": "failed",
      "request_reference": "save-3fa9c2d1",
      "attempts": 3
    }
  },
  "synthetic_settle_timeout_unsaved": {
    "success": false,
    "ok": false,
    "action": "insertChart",
    "requestId": "f10-7",
    "element_id": "chart_f10a",
    "elementId": "chart_f10a",
    "applied": true,
    "replaced": true,
    "rendered": true,
    "persisted": false,
    "geometry": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "geometry_changed": true,
    "settle_ms": 20003,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 40
    },
    "persist": {
      "status": "timeout",
      "waited_ms": 0
    },
    "error": "The chart was applied and rendered, but the save did not finish within 20000 ms.",
    "errorCode": "CHART_SETTLE_TIMEOUT"
  },
  "synthetic_invalid_geometry": {
    "success": false,
    "ok": false,
    "action": "insertChart",
    "requestId": "f10-6",
    "element_id": "chart_f10a",
    "elementId": "chart_f10a",
    "applied": false,
    "rendered": false,
    "persisted": false,
    "settle_ms": 0,
    "error": "The chart box is not on the slide grid (rows 1-19, columns 1-33, start before end). Nothing was changed.",
    "errorCode": "INVALID_GEOMETRY",
    "detail": "gridRow \"7/40\", gridColumn \"4/17\""
  },
  "synthetic_ok_false_rendered_and_persisted": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-8",
    "elementId": "chart_f10a",
    "replaced": true,
    "position": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "element_id": "chart_f10a",
    "ok": false,
    "applied": true,
    "rendered": true,
    "persisted": true,
    "geometry": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "geometry_changed": true,
    "settle_ms": 71,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 16
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    },
    "error": "The chart reported a render error.",
    "errorCode": "CHART_RENDER_FAILED"
  },
  "synthetic_success_with_page_errors": {
    "success": true,
    "action": "insertChart",
    "requestId": "f10-9",
    "elementId": "chart_f10a",
    "replaced": true,
    "position": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "element_id": "chart_f10a",
    "ok": true,
    "applied": true,
    "rendered": true,
    "persisted": true,
    "geometry": {
      "gridRow": "7/16",
      "gridColumn": "4/17"
    },
    "geometry_changed": true,
    "settle_ms": 71,
    "render": {
      "instance": true,
      "external_script_failures": [],
      "script_errors": [],
      "badge": false,
      "waited_ms": 16,
      "page_errors": 3
    },
    "persist": {
      "status": "saved",
      "waited_ms": 51
    }
  },
  "synthetic_render_failed_with_page_errors": {
    "success": false,
    "action": "insertChart",
    "requestId": "f10-10",
    "elementId": "c1",
    "position": {
      "gridRow": "6/16",
      "gridColumn": "3/10"
    },
    "element_id": "c1",
    "ok": false,
    "applied": true,
    "replaced": false,
    "rendered": false,
    "persisted": true,
    "geometry": {
      "gridRow": "6/16",
      "gridColumn": "3/10"
    },
    "geometry_changed": false,
    "settle_ms": 54,
    "render": {
      "instance": false,
      "external_script_failures": [],
      "script_errors": [
        "Uncaught Error: plugin missing (simulated runtime failure)"
      ],
      "badge": false,
      "waited_ms": 0,
      "page_errors": 2
    },
    "persist": {
      "status": "saved",
      "waited_ms": 53
    },
    "error": "A chart script threw: Uncaught Error: plugin missing (simulated runtime failure)",
    "errorCode": "CHART_RENDER_FAILED"
  }
}
// FIXTURES-END

const clone = value => JSON.parse(JSON.stringify(value))

// ---------------------------------------------------------------- flag
{
  const unset = loadModule('../lib/chart-reinsert-settled-ack.ts', { env: {} })
  assert.equal(unset.chartReinsertSettledAckEnabled(), false, 'default off')
  for (const value of ['', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']) {
    const mod = loadModule('../lib/chart-reinsert-settled-ack.ts', { env: { [FLAG]: value } })
    assert.equal(mod.chartReinsertSettledAckEnabled(), false, `only the exact string 'true' turns it on: ${JSON.stringify(value)}`)
  }
  const on = loadModule('../lib/chart-reinsert-settled-ack.ts', { env: { [FLAG]: 'true' } })
  assert.equal(on.chartReinsertSettledAckEnabled(), true)
}
const lib = loadModule('../lib/chart-reinsert-settled-ack.ts')

// ---------------------------------------------------------------- the opt-ins
{
  // flag off: null for every combination, so the request is never touched
  for (const action of ['insertChart', 'insertDiagram', 'upsertCitedElement', 'insertTextBox'])
    for (const sameId of [true, false])
      for (const geometryAuthoritative of [true, false])
        assert.equal(lib.chartReinsertOptIns({ enabled: false, action, sameId, geometryAuthoritative }), null)

  // flag on: only a same-id insertChart opts in
  assert.equal(lib.chartReinsertOptIns({ enabled: true, action: 'insertDiagram', sameId: true, geometryAuthoritative: true }), null)
  assert.equal(lib.chartReinsertOptIns({ enabled: true, action: 'upsertCitedElement', sameId: true, geometryAuthoritative: true }), null)
  assert.equal(lib.chartReinsertOptIns({ enabled: true, action: 'insertChart', sameId: false, geometryAuthoritative: true }), null,
    'a new chart (new id) is not a re-insert')
  assert.deepEqual(
    lib.chartReinsertOptIns({ enabled: true, action: 'insertChart', sameId: true, geometryAuthoritative: true }),
    { ackMode: 'settled', geometryMode: 'apply' },
  )
  const keep = lib.chartReinsertOptIns({ enabled: true, action: 'insertChart', sameId: true, geometryAuthoritative: false })
  assert.deepEqual(keep, { ackMode: 'settled' })
  assert.equal('geometryMode' in keep, false, 'geometryMode is not sent when the geometry is not authoritative')
}

// ---------------------------------------------------------------- authoritative geometry
{
  const live = { start_col: 4, start_row: 7, position_width: 13, position_height: 9 }
  const formDefault = { start_col: 2, start_row: 4, position_width: 10, position_height: 6 }
  const g = lib.chartReinsertGeometryAuthoritative
  assert.equal(g({ manuallyPositioned: true, refine: false, positionConfig: formDefault, liveGridPosition: null }), true, 'Manual position')
  assert.equal(g({ manuallyPositioned: true, refine: true, positionConfig: formDefault, liveGridPosition: live }), true, 'Manual position in a refine')
  assert.equal(g({ manuallyPositioned: false, refine: true, positionConfig: { ...live }, liveGridPosition: live }), true, 'refine positionConfig is the live box')
  assert.equal(g({ manuallyPositioned: false, refine: true, positionConfig: formDefault, liveGridPosition: live }), false,
    "a refine positionConfig that is the form's 2/4 default is not the chart's box")
  assert.equal(g({ manuallyPositioned: false, refine: true, positionConfig: formDefault, liveGridPosition: null }), false, 'no live box, no authority')
  assert.equal(g({ manuallyPositioned: false, refine: true, positionConfig: null, liveGridPosition: live }), false)
  assert.equal(g({ manuallyPositioned: false, refine: false, positionConfig: { ...live }, liveGridPosition: live }), false, 'not a refine')
  assert.equal(g({ manuallyPositioned: false, refine: true, positionConfig: { ...live, start_col: NaN }, liveGridPosition: { ...live, start_col: NaN } }), false)
}

// ---------------------------------------------------------------- reading the ACK
{
  const kind = ack => lib.classifySettledChartAck(ack).kind
  for (const notAck of [undefined, null, 'ok', 3, [], {}, { success: true, action: 'insertChart', elementId: 'x' }])
    assert.equal(kind(notAck), 'legacy', `not a settled ACK: ${JSON.stringify(notAck)}`)
  assert.equal(kind(FIXTURES.legacy_same_id), 'legacy', 'old-style ACK (Layout flag off)')
  assert.equal(kind({ ok: true }), 'legacy', 'a partial shape is not a settled ACK')

  assert.equal(kind(FIXTURES.settled_success_apply), 'ok')
  assert.equal(kind(FIXTURES.settled_success_slow_library), 'ok')

  // render failures, nothing applied: today's error path
  for (const name of ['fail_throws', 'fail_unreachable_cdn', 'fail_chartjs_rejects', 'fail_does_not_compile', 'synthetic_invalid_geometry']) {
    assert.equal(kind(FIXTURES[name]), 'failed', name)
  }

  // persisted:false / CHART_PERSIST_FAILED: not saved, never a success
  const persist = lib.classifySettledChartAck(FIXTURES.fail_persist)
  assert.equal(persist.kind, 'not_saved')
  assert.equal(persist.requestReference, 'save-e3fd2b96')
  assert.match(persist.message, /could not be saved/)
  assert.match(persist.message, /Request reference: save-e3fd2b96\./)
  assert.doesNotMatch(persist.message, /select this message/, "Layout's own wording points at its own indicator, not at Studio")
  const contractExample = lib.classifySettledChartAck(FIXTURES.synthetic_persist_failed_contract_example)
  assert.equal(contractExample.kind, 'not_saved')
  assert.equal(contractExample.requestReference, 'save-3fa9c2d1')
  const timeout = lib.classifySettledChartAck(FIXTURES.synthetic_settle_timeout_unsaved)
  assert.equal(timeout.kind, 'not_saved')
  assert.match(timeout.message, /not confirmed in time/)
  assert.equal(timeout.requestReference, null)
  // CHART_PERSIST_FAILED alone is enough, even if persisted says true
  assert.equal(kind({ ...clone(FIXTURES.fail_persist), persisted: true }), 'not_saved')
  // render failed AND not saved: the save is the actionable one, the render cause is kept
  const both = lib.classifySettledChartAck({ ...clone(FIXTURES.fail_throws), persisted: false })
  assert.equal(both.kind, 'not_saved')
  assert.match(both.message, /also did not render: A chart script threw: Uncaught Error: plugin missing/)

  // ok is read strictly (contract v1.1: ok = rendered && persisted): ok:false is a failure even if the
  // other two say true. There is no ok_with_warning outcome any more.
  assert.equal(kind(FIXTURES.synthetic_ok_false_rendered_and_persisted), 'failed')
  assert.equal(kind(FIXTURES.synthetic_success_with_page_errors), 'ok', 'page_errors never change the outcome')
  assert.equal(kind(FIXTURES.synthetic_render_failed_with_page_errors), 'failed')

  // a success ACK that contradicts itself is not trusted
  assert.equal(kind({ ...clone(FIXTURES.settled_success_apply), persisted: false }), 'not_saved')
  assert.equal(kind({ ...clone(FIXTURES.settled_success_apply), rendered: false }), 'failed')
  assert.equal(kind({ ...clone(FIXTURES.settled_success_apply), applied: false, ok: false, rendered: false, persisted: false }), 'failed')
}

// ---------------------------------------------------------------- the box Layout reports
{
  assert.deepEqual(lib.settledAckGeometry(FIXTURES.settled_success_apply), { gridRow: '7/16', gridColumn: '4/17' })
  assert.deepEqual(lib.settledAckGeometry(FIXTURES.fail_persist), { gridRow: '6/16', gridColumn: '3/17' })
  assert.equal(lib.settledAckGeometry(FIXTURES.legacy_same_id), null, 'old-style ACK: no readback')
  assert.equal(lib.settledAckGeometry(FIXTURES.fail_does_not_compile), null, 'nothing applied')
  assert.equal(lib.settledAckGeometry({ ...clone(FIXTURES.settled_success_apply), geometry: { gridRow: 'x', gridColumn: '4/17' } }), null)
  assert.equal(lib.settledAckGeometry({ ...clone(FIXTURES.settled_success_apply), geometry: null }), null)
  assert.equal(lib.settledAckGeometry({ ...clone(FIXTURES.synthetic_invalid_geometry), geometry: { gridRow: '7/16', gridColumn: '4/17' } }), null,
    'an ACK that applied nothing never reports a box')
  assert.equal(lib.settledAckGeometry({ ...clone(FIXTURES.settled_success_apply), geometry: { gridRow: '7/16' } }), null)
  assert.deepEqual(
    lib.settledAckGeometry({ ...clone(FIXTURES.settled_success_apply), geometry: { gridRow: '6.2/16.4', gridColumn: '3/17' } }),
    { gridRow: '6.2/16.4', gridColumn: '3/17' },
    '0.2 grid steps are legal',
  )
}

// ---------------------------------------------------------------- attaching the ACK to a rejection
{
  const plain = lib.attachSettledChartAck(new Error('x'), { success: false, error: 'x' })
  assert.equal('layoutAck' in plain, false, 'only a settled ACK is attached')
  assert.equal('layoutAck' in lib.attachSettledChartAck(new Error('x'), null), false)
  assert.equal('layoutAck' in lib.attachSettledChartAck(new Error('x'), { ok: false }), false)
  const attached = lib.attachSettledChartAck(new Error('x'), FIXTURES.fail_persist)
  assert.deepEqual(attached.layoutAck, FIXTURES.fail_persist)
}

// ---------------------------------------------------------------- the sender, through the real receipt reconciliation
{
  const reconcile = loadModule('../lib/layout-command-result.ts')

  // viewerReply: what presentation-viewer's sendCommand does with an ACK (resolve success, reject failure
  // carrying the ACK, as the flag-on viewer does for a request with ackMode 'settled').
  const viewerReply = ack => {
    if (ack.success) return Promise.resolve(clone(ack))
    const failure = new Error(ack.error || 'Command failed')
    return Promise.reject(lib.attachSettledChartAck(failure, clone(ack)))
  }
  const makeSend = replies => {
    const calls = []
    const send = async (action, params) => {
      calls.push({ action, params })
      const reply = replies[action] ?? replies.default
      const value = typeof reply === 'function' ? reply(calls.filter(c => c.action === action).length) : reply
      return value instanceof Error ? Promise.reject(value) : value
    }
    return { send, calls }
  }
  const warnings = []
  const run = (send, options = {}) => reconcile.sendLayoutMutationWithReconciliation(
    lib.settledChartAckSender(send, { warn: message => warnings.push(message) }),
    'insertChart',
    { elementId: 'chart_f10a', ackMode: 'settled', geometryMode: 'apply' },
    'gen-9:insert:0',
    { attempts: 2, delayMs: 0, wait: async () => {}, ...options },
  )

  // 1. success ACK: returned, params forwarded untouched (plus the mutationId reconcile adds)
  {
    const { send, calls } = makeSend({ insertChart: () => viewerReply(FIXTURES.settled_success_apply) })
    const result = await run(send)
    assert.deepEqual(result, FIXTURES.settled_success_apply)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].params, { elementId: 'chart_f10a', ackMode: 'settled', geometryMode: 'apply', mutationId: 'gen-9:insert:0' })
    assert.equal(warnings.length, 0)
  }
  // 2. old-style ACK (Layout flag off): exactly today's success
  {
    const { send } = makeSend({ insertChart: () => viewerReply(FIXTURES.legacy_same_id) })
    assert.deepEqual(await run(send), FIXTURES.legacy_same_id)
  }
  // 3. old-style failure: today's rejection, same object
  {
    const original = new Error('Chart could not be inserted')
    const { send, calls } = makeSend({ insertChart: () => original })
    await assert.rejects(run(send), error => error === original)
    assert.equal(calls.length, 1)
  }
  // 4. render failures: the original rejection, Layout's text, no receipt polling
  for (const name of ['fail_throws', 'fail_unreachable_cdn', 'fail_chartjs_rejects', 'fail_does_not_compile', 'synthetic_invalid_geometry']) {
    const { send, calls } = makeSend({ insertChart: () => viewerReply(FIXTURES[name]) })
    await assert.rejects(run(send), error => {
      assert.equal(error.message, FIXTURES[name].error, name)
      assert.equal(error.code, undefined)
      return true
    })
    assert.equal(calls.length, 1, `${name}: no receipt polling`)
  }
  // 5. not saved: ChartReinsertNotSavedError, with the ACK, and never a success
  for (const name of ['fail_persist', 'synthetic_persist_failed_contract_example', 'synthetic_settle_timeout_unsaved']) {
    const { send, calls } = makeSend({ insertChart: () => viewerReply(FIXTURES[name]) })
    await assert.rejects(run(send), error => {
      assert.equal(error.code, 'CHART_REINSERT_NOT_SAVED', name)
      assert.equal(error.ack.errorCode, FIXTURES[name].errorCode)
      assert.match(error.message, /^The chart was updated on the slide/)
      assert.doesNotMatch(error.message, /command timeout/i, 'must not look like a lost ACK to the reconciliation loop')
      return true
    })
    assert.equal(calls.length, 1, `${name}: not reconciled as a lost ACK`)
  }
  // 6. ok is read strictly: ok:false is never a success, even with rendered and persisted true
  {
    warnings.length = 0
    const name = 'synthetic_ok_false_rendered_and_persisted'
    const { send, calls } = makeSend({ insertChart: () => viewerReply(FIXTURES[name]) })
    await assert.rejects(run(send), error => {
      assert.equal(error.message, FIXTURES[name].error)
      assert.equal(error.code, undefined)
      return true
    })
    assert.equal(calls.length, 1)
    assert.equal(warnings.length, 0)
  }
  // 6b. render.page_errors (v1.1, additive): one console.warn with the count only, outcome unchanged
  {
    const pageErrorsWarning = count => `[chart-reinsert-ack] render.page_errors: ${count}`
    const warned = []
    const runWarned = send => reconcile.sendLayoutMutationWithReconciliation(
      lib.settledChartAckSender(send, { warn: (...args) => warned.push(args) }),
      'insertChart', { elementId: 'chart_f10a', ackMode: 'settled' }, 'gen-9:insert:0',
      { attempts: 2, delayMs: 0, wait: async () => {} },
    )
    // success with page_errors: the ACK is returned as is, one warning, the count and nothing else
    const success = FIXTURES.synthetic_success_with_page_errors
    assert.equal(success.render.page_errors, 3)
    assert.deepEqual(await runWarned(makeSend({ insertChart: () => viewerReply(success) }).send), success)
    assert.deepEqual(warned, [[pageErrorsWarning(3)]])
    assert.doesNotMatch(String(warned[0][0]), /ResizeObserver|Uncaught|error:|http|chart_f10a/)
    // render failure with page_errors: one warning, then Layout's rejection exactly as before
    warned.length = 0
    const renderFailed = FIXTURES.synthetic_render_failed_with_page_errors
    await assert.rejects(runWarned(makeSend({ insertChart: () => viewerReply(renderFailed) }).send), { message: renderFailed.error })
    assert.deepEqual(warned, [[pageErrorsWarning(2)]])
    // not saved with page_errors: one warning, the not-saved error
    warned.length = 0
    const unsaved = { ...clone(FIXTURES.fail_persist), render: { ...clone(FIXTURES.fail_persist.render), page_errors: 5 } }
    await assert.rejects(runWarned(makeSend({ insertChart: () => viewerReply(unsaved) }).send), { code: 'CHART_REINSERT_NOT_SAVED' })
    assert.deepEqual(warned, [[pageErrorsWarning(5)]])
    // a lost ACK: the receipt's ACK is read once, one warning
    warned.length = 0
    await runWarned(makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => ({ success: true, status: 'completed', result: clone(success) }),
    }).send)
    assert.deepEqual(warned, [[pageErrorsWarning(3)]])
    // absent, zero, negative, non-numeric, and a non-settled ACK: no warning
    for (const page_errors of [undefined, 0, -1, NaN, '3', null, {}]) {
      warned.length = 0
      const ack = { ...clone(FIXTURES.settled_success_apply), render: { ...clone(FIXTURES.settled_success_apply.render), page_errors } }
      assert.equal((await runWarned(makeSend({ insertChart: () => viewerReply(ack) }).send)).success, true)
      assert.deepEqual(warned, [], `page_errors ${String(page_errors)}: no warning`)
    }
    warned.length = 0
    const legacyWithRender = { ...clone(FIXTURES.legacy_same_id), render: { page_errors: 4 } }
    await runWarned(makeSend({ insertChart: () => viewerReply(legacyWithRender) }).send)
    assert.deepEqual(warned, [], 'an old-style ACK is not read')
    // 1.5 is logged as a whole count; other actions never warn
    const fractional = { ...clone(success), render: { ...clone(success.render), page_errors: 2.9 } }
    await runWarned(makeSend({ insertChart: () => viewerReply(fractional) }).send)
    assert.deepEqual(warned.at(-1), [pageErrorsWarning(2)])
    warned.length = 0
    await lib.settledChartAckSender(makeSend({ default: { success: true, render: { page_errors: 9 } } }).send, { warn: (...a) => warned.push(a) })('deleteElement', {})
    assert.deepEqual(warned, [])
  }
  // 7. a lost ACK: the 30 s command timeout reconciles through the receipt, read the same way
  const receipt = result => ({ success: true, status: 'completed', result: clone(result), action: 'insertChart', mutationId: 'gen-9:insert:0' })
  {
    const { send, calls } = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => receipt(FIXTURES.settled_success_apply),
    })
    assert.deepEqual(await run(send), FIXTURES.settled_success_apply)
    assert.deepEqual(calls.map(c => c.action), ['insertChart', 'getElementMutationReceipt'])
  }
  {
    // ok:false in a receipt is read strictly too: Layout's text, no success
    const { send } = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => receipt(FIXTURES.synthetic_ok_false_rendered_and_persisted),
    })
    await assert.rejects(run(send), error => error.message === `insertChart failed: ${FIXTURES.synthetic_ok_false_rendered_and_persisted.error}`)
  }
  {
    const { send } = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => receipt(FIXTURES.fail_persist),
    })
    await assert.rejects(run(send), /insertChart failed: The chart was updated on the slide but could not be saved/)
  }
  {
    const { send } = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => receipt(FIXTURES.fail_throws),
    })
    await assert.rejects(run(send), /insertChart failed: A chart script threw: Uncaught Error: plugin missing/)
  }
  {
    // receipt with an old-style result, a pending receipt, and a missing receipt: exactly today
    const { send } = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: () => receipt(FIXTURES.legacy_same_id),
    })
    assert.deepEqual(await run(send), FIXTURES.legacy_same_id)
    const pending = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: { success: true, status: 'pending', result: null },
    })
    await assert.rejects(run(pending.send), /no automatic rollback was attempted/)
    const missing = makeSend({
      insertChart: new Error('Command timeout'),
      getElementMutationReceipt: { success: true, status: 'missing', result: null },
    })
    await assert.rejects(run(missing.send), /no automatic rollback was attempted/)
  }
  // 8. a success ACK that contradicts itself is not a silent success
  {
    const lie = { ...clone(FIXTURES.settled_success_apply), rendered: false }
    const { send } = makeSend({ insertChart: () => Promise.resolve(lie) })
    await assert.rejects(run(send))
    const unsaved = { ...clone(FIXTURES.settled_success_apply), persisted: false }
    await assert.rejects(run(makeSend({ insertChart: () => Promise.resolve(unsaved) }).send), { code: 'CHART_REINSERT_NOT_SAVED' })
  }
  // 9. every other action passes through untouched (same args, same result object)
  {
    const sentinel = { success: true, anything: 1 }
    const { send, calls } = makeSend({ default: sentinel })
    const wrapped = lib.settledChartAckSender(send)
    const params = { elementId: 'x' }
    assert.equal(await wrapped('deleteElement', params), sentinel)
    assert.equal(calls[0].params, params)
    assert.equal(await wrapped('getSlideGenerationContext', params), sentinel)
  }
}

// ---------------------------------------------------------------- the viewer's own sendCommand (real source, mocked iframe)
{
  const viewerSource = read('../components/presentation-viewer.tsx')
  const start = viewerSource.indexOf('\nfunction sendCommand(')
  const end = viewerSource.indexOf('\nfunction postCommand(')
  assert.ok(start > 0 && end > start, 'sendCommand source markers')
  const sendCommandSource = viewerSource.slice(start, end)

  function makeViewer(flagValue) {
    const libOnOff = loadModule('../lib/chart-reinsert-settled-ack.ts', { env: flagValue === undefined ? {} : { [FLAG]: flagValue } })
    const listeners = new Set()
    const posted = []
    const window = {
      addEventListener: (type, handler) => { if (type === 'message') listeners.add(handler) },
      removeEventListener: (type, handler) => { if (type === 'message') listeners.delete(handler) },
    }
    const iframe = { contentWindow: { postMessage: (message, origin) => posted.push({ message: clone(message), origin }) } }
    const names = [
      'window', 'getLayoutServiceUrl', 'VIEWER_ORIGIN', 'getLayoutViewerOrigin', 'isTrustedLayoutViewerMessage',
      'createViewerRequestId', 'scTrace', 'isSlideComposerTraceEnabled', 'isMatchingSlideComposeCommandResponse',
      'attachSettledChartAck', 'chartReinsertSettledAckEnabled', 'setTimeout', 'clearTimeout', 'crypto',
    ]
    const values = [
      window, () => 'https://layout.test', 'https://viewer.test', () => 'https://viewer.test', () => true,
      () => 'request-1', () => {}, () => false, () => false,
      libOnOff.attachSettledChartAck, libOnOff.chartReinsertSettledAckEnabled, setTimeout, clearTimeout, undefined,
    ]
    const sendCommand = new Function(...names, `${compile(sendCommandSource)}\nreturn sendCommand`)(...values)
    const reply = data => { for (const handler of [...listeners]) handler({ data }) }
    return { sendCommand, reply, posted, iframe, listeners }
  }

  const params = { elementId: 'chart_f10a', gridRow: '7/16', gridColumn: '4/17', ackMode: 'settled', geometryMode: 'apply', mutationId: 'm-1' }
  const settledFailure = { ...clone(FIXTURES.fail_persist), requestId: 'request-1' }

  for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
    // flag off: identical postMessage, identical rejection, no extra property
    const viewer = makeViewer(flag)
    const pending = viewer.sendCommand(viewer.iframe, 'insertChart', params, { timeoutMs: 30_000 })
    assert.deepEqual(viewer.posted, [{ message: { action: 'insertChart', params, requestId: 'request-1' }, origin: 'https://viewer.test' }])
    viewer.reply(settledFailure)
    await assert.rejects(pending, error => {
      assert.equal(error.message, settledFailure.error)
      assert.equal('layoutAck' in error, false, `flag ${JSON.stringify(flag)}: the rejection carries nothing extra`)
      assert.deepEqual(Object.keys(error), [])
      return true
    })
    assert.equal(viewer.listeners.size, 0, 'listener removed')
  }
  {
    // flag on, request opted in: the rejection carries the ACK
    const viewer = makeViewer('true')
    const pending = viewer.sendCommand(viewer.iframe, 'insertChart', params, { timeoutMs: 30_000 })
    assert.deepEqual(viewer.posted[0].message, { action: 'insertChart', params, requestId: 'request-1' }, 'the request itself is never altered')
    viewer.reply(settledFailure)
    await assert.rejects(pending, error => {
      assert.equal(error.message, settledFailure.error)
      assert.deepEqual(error.layoutAck, settledFailure)
      return true
    })
  }
  {
    // flag on, request did not opt in (any other chart insert / command): rejection exactly as before
    const viewer = makeViewer('true')
    const pending = viewer.sendCommand(viewer.iframe, 'insertChart', { elementId: 'chart_new' }, { timeoutMs: 30_000 })
    viewer.reply({ success: false, action: 'insertChart', requestId: 'request-1', error: 'Chart could not be inserted' })
    await assert.rejects(pending, error => {
      assert.equal('layoutAck' in error, false)
      return true
    })
    // a settled-shaped failure for a request that did NOT ask for ackMode 'settled' is not attached either
    const unasked = makeViewer('true')
    const pendingUnasked = unasked.sendCommand(unasked.iframe, 'insertChart', { elementId: 'chart_f10a', mutationId: 'm-2' }, { timeoutMs: 30_000 })
    unasked.reply({ ...clone(FIXTURES.fail_persist), requestId: 'request-1' })
    await assert.rejects(pendingUnasked, error => {
      assert.equal('layoutAck' in error, false, 'no ackMode in the request, nothing attached')
      assert.equal(error.message, FIXTURES.fail_persist.error)
      return true
    })
    // a failure without text keeps today's wording
    const bare = makeViewer('true')
    const pendingBare = bare.sendCommand(bare.iframe, 'insertChart', params, { timeoutMs: 30_000 })
    bare.reply({ success: false, action: 'insertChart', requestId: 'request-1' })
    await assert.rejects(pendingBare, { message: 'Command failed' })
    const other = makeViewer('true')
    const pendingOther = other.sendCommand(other.iframe, 'deleteElement', { elementId: 'x' }, { timeoutMs: 5_000 })
    other.reply({ success: false, action: 'deleteElement', requestId: 'request-1', error: 'Element not found' })
    await assert.rejects(pendingOther, error => {
      assert.equal('layoutAck' in error, false)
      return true
    })
  }
  {
    // success ACKs resolve with the ACK object, flag on or off
    for (const flag of [undefined, 'true']) {
      const viewer = makeViewer(flag)
      const pending = viewer.sendCommand(viewer.iframe, 'insertChart', params, { timeoutMs: 30_000 })
      const ack = { ...clone(FIXTURES.settled_success_apply), requestId: 'request-1' }
      viewer.reply(ack)
      assert.deepEqual(await pending, ack)
    }
  }
  {
    // the 30 s command timeout is unchanged
    assert.match(viewerSource, /const MUTATING_LAYOUT_COMMAND_TIMEOUT_MS = 30_000/)
    assert.match(viewerSource, /insertChart: MUTATING_LAYOUT_COMMAND_TIMEOUT_MS/)
  }
}

// ---------------------------------------------------------------- end to end: viewer rejection -> sender -> reconciliation
{
  const reconcile = loadModule('../lib/layout-command-result.ts')
  const on = loadModule('../lib/chart-reinsert-settled-ack.ts', { env: { [FLAG]: 'true' } })
  assert.equal(on.chartReinsertSettledAckEnabled(), true)
  // a replay of the hook's own wiring (see the source gate below) for each fixture, flag on and off
  const scenarios = {
    settled_success_apply: 'success',
    legacy_same_id: 'success',
    synthetic_ok_false_rendered_and_persisted: 'failure',
    synthetic_success_with_page_errors: 'success',
    synthetic_render_failed_with_page_errors: 'failure',
    fail_throws: 'failure',
    fail_unreachable_cdn: 'failure',
    fail_chartjs_rejects: 'failure',
    fail_does_not_compile: 'failure',
    synthetic_invalid_geometry: 'failure',
    fail_persist: 'failure',
    synthetic_settle_timeout_unsaved: 'failure',
  }
  for (const [name, expected] of Object.entries(scenarios)) {
    for (const flagOn of [true, false]) {
      const ack = FIXTURES[name]
      const opts = on.chartReinsertOptIns({ enabled: flagOn, action: 'insertChart', sameId: true, geometryAuthoritative: true })
      const params = { elementId: 'chart_f10a' }
      if (opts) Object.assign(params, opts)
      const sendElementCommand = async () => {
        if (ack.success) return clone(ack)
        const failure = new Error(ack.error || 'Command failed')
        // the viewer attaches the ACK only for flag on + ackMode 'settled'
        if (flagOn && params.ackMode === 'settled') on.attachSettledChartAck(failure, clone(ack))
        throw failure
      }
      const outcome = await reconcile.sendLayoutMutationWithReconciliation(
        opts ? on.settledChartAckSender(sendElementCommand, { warn: () => {} }) : sendElementCommand,
        'insertChart',
        params,
        'gen-9:insert:0',
      ).then(() => 'success', () => 'failure')
      const legacyOutcome = ack.success ? 'success' : 'failure'
      if (!flagOn) assert.equal(outcome, legacyOutcome, `${name}: flag off is exactly the old outcome`)
      else assert.equal(outcome, expected, `${name}: flag on`)
    }
  }
}

// ---------------------------------------------------------------- source gates
{
  const hook = read('../hooks/use-textlabs-generation.ts')
  assert.match(hook, /from '@\/lib\/chart-reinsert-settled-ack'/)
  const optInAt = hook.indexOf('const chartReinsertOpts = chartReinsertOptIns({')
  const actionAt = hook.indexOf('const insertionAction = citedUpsertParams')
  const assignAt = hook.indexOf('if (chartReinsertOpts) Object.assign(params, chartReinsertOpts)')
  const sendAt = hook.indexOf('const insertResponse = await sendLayoutMutationWithReconciliation(')
  assert.ok(actionAt > 0 && optInAt > actionAt && assignAt > optInAt && sendAt > assignAt, 'opt-ins are decided after the action and before the send')
  assert.match(hook, /enabled: chartReinsertSettledAckEnabled\(\),\n\s+action: insertionAction,\n\s+sameId: Boolean\(refineContext\) && params\.elementId === refineContext\?\.elementId,/)
  assert.match(hook, /manuallyPositioned: manuallyPositionedChart,\n\s+refine: Boolean\(refineContext\),\n\s+positionConfig: formData\.positionConfig,\n\s+liveGridPosition: refineContext\?\.gridPosition,/)
  assert.match(hook, /chartReinsertOpts\n\s+\? settledChartAckSender\((generationLayoutServiceApis|layoutServiceApis)\.sendElementCommand\)\n\s+: (generationLayoutServiceApis|layoutServiceApis)\.sendElementCommand,/,
    'flag off sends through the unwrapped sender')
  assert.match(hook, /settledGeometry = chartReinsertOpts \? settledAckGeometry\(insertResponse\) : null/)

  // the overlap-avoidance promise: textlabs-client.ts (extractBodyContent, the 2/4 fallbacks) is untouched
  const client = read('../lib/textlabs-client.ts')
  assert.doesNotMatch(client, /CHART_REINSERT|chart-reinsert|settled/i)

  // the flag is read literally so Next inlines it
  assert.match(read('../lib/chart-reinsert-settled-ack.ts'), /process\.env\.NEXT_PUBLIC_CHART_REINSERT_SETTLED_ACK_ENABLED === 'true'/)
}

console.log('chart re-insert settled ACK tests passed')
