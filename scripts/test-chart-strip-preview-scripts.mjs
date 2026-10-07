// NEXT_PUBLIC_CHART_STRIP_PREVIEW_SCRIPTS_ENABLED (default off).
//
// Text Labs returns every chart as a full preview document whose <head> loads Chart.js from a
// CDN. buildInsertionParams -> extractBodyContent hoists head scripts into the stored chart_html,
// and a second Chart.js load in the Layout viewer replaces window.Chart (point labels and the deck
// font are lost). With the flag on, a CHART insertion drops head <script src> loads and keeps the
// chart's own inline scripts and markup. Everything else, and flag off, is exactly as before.
//
// extractBodyContent needs a DOM parser, and Node has none. The stub below understands only the
// Text Labs wrapper shape (<head> ... </head><body> ... </body>); it exists so the flag logic can
// be asserted without a browser. The real DOMParser is exercised in a headless Chromium by the
// render proof in the PR, not here.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_CHART_STRIP_PREVIEW_SCRIPTS_ENABLED'
const moduleCache = new Map()
const env = {}

function moduleUrl(relativePath) {
  return new URL(relativePath, import.meta.url)
}

// Minimal stand-in for DOMParser().parseFromString(html, 'text/html'): head scripts + body.
class StubDOMParser {
  parseFromString(html) {
    const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)
    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
    const headHtml = headMatch ? headMatch[1] : ''
    const scripts = [...headHtml.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)].map(m => ({
      outerHTML: m[0],
      hasAttribute: name => new RegExp(`(^|\\s)${name}(\\s*=|\\s|$)`, 'i').test(m[1]),
    }))
    return {
      head: { querySelectorAll: selector => (selector === 'script' ? scripts : []) },
      body: { innerHTML: bodyMatch ? bodyMatch[1] : '' },
    }
  }
}

function loadTypeScriptModule(url) {
  const key = url.href
  if (moduleCache.has(key)) return moduleCache.get(key)
  const compiled = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const mod = { exports: {} }
  moduleCache.set(key, mod.exports)
  vm.runInNewContext(compiled.outputText, {
    module: mod,
    exports: mod.exports,
    process: { env },
    DOMParser: StubDOMParser,
    fetch: () => { throw new Error('Unexpected fetch') },
    FormData,
    require: id => {
      if (!id.startsWith('@/')) throw new Error(`Unexpected test import: ${id}`)
      return loadTypeScriptModule(moduleUrl(`../${id.slice(2)}.ts`))
    },
  })
  moduleCache.set(key, mod.exports)
  return mod.exports
}

const { buildInsertionParams } = loadTypeScriptModule(moduleUrl('../lib/textlabs-client.ts'))
const { INSERTION_METHOD_MAP } = loadTypeScriptModule(moduleUrl('../types/textlabs.ts'))

// The pre-change implementation, verbatim, as the flag-off oracle.
function legacyExtractBodyContent(html) {
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    const parser = new StubDOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const headScripts = Array.from(doc.head.querySelectorAll('script'))
    const bodyContent = doc.body.innerHTML
    const scriptTags = headScripts.map(s => s.outerHTML).join('\n')
    return scriptTags + '\n' + bodyContent
  }
  return html
}

const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const CHARTJS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
const CHARTJS_TAG = `<script src="${CHARTJS_SRC}"></script>`
const HEAD_INLINE = '<script>window.__previewReady = true;</script>'

// Body shaped like Analytics' chart_html: container, heading, canvas, inline init, font fix.
const chartBody = `
    <div class="atomic-chart-container" data-chart-id="line" data-element-id="chart-pres-1-slide-0-line-a748d9e5"
         style="width: 940px; height: 100%; display: flex; flex-direction: column;">
  <h3 class="atomic-chart-heading" style="font-family: Inter, sans-serif; color: #6b7280;">Rising Sequence: Q1 62 to Q4 81</h3>
  <div class="chart-content" style="flex: 1; min-height: 0;">
    <canvas id="canvas-chart-pres-1-slide-0-line-a748d9e5"></canvas>
    <script>
      (function() {
        function initChart() {
          const ctx = document.getElementById('canvas-chart-pres-1-slide-0-line-a748d9e5').getContext('2d');
          const chartConfig = {"type": "line", "data": {"labels": ["Q1", "Q2", "Q3", "Q4"], "datasets": [{"label": "Data", "data": [62, 68, 74, 81], "datalabels": {"display": true}}]}, "options": {"plugins": {"datalabels": {"anchor": "end"}}}};
          window.chartInstances = window.chartInstances || {};
          window.chartInstances['canvas-chart-pres-1-slide-0-line-a748d9e5'] = new Chart(ctx, chartConfig);
        }
        setTimeout(initChart, 100);
      })();
    </script>
  </div>
</div>
<script>
(function() {
  setTimeout(function() {
    var chart = window.chartInstances && window.chartInstances['canvas-chart-pres-1-slide-0-line-a748d9e5'];
    if (chart) { chart.options.scales.y.ticks.font.family = "Inter, sans-serif"; chart.update('none'); }
  }, 0);
})();
</script>
`

// What Text Labs sends: the chart wrapped in a complete preview document.
const previewDocument = (head, body = chartBody) => `<!DOCTYPE html>
<html>
<head>
${head}
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
    </style>
</head>
<body>
    ${body}
</body>
</html>`

const chartDocument = previewDocument(`    ${CHARTJS_TAG}`)
const chartDocumentWithInlineHead = previewDocument(`    ${CHARTJS_TAG}\n    ${HEAD_INLINE}`)

const gridPosition = { start_col: 2, start_row: 4, position_width: 20, position_height: 10 }
const chartElement = html => ({ element_id: 'chart-pres-1-slide-0-line-a748d9e5', html, grid_position: gridPosition })

function insertChart(html, flagValue) {
  if (flagValue === undefined) delete env[FLAG]
  else env[FLAG] = flagValue
  return buildInsertionParams('CHART', chartElement(html))
}

const countTags = (html, pattern) => (html.match(pattern) || []).length
const SCRIPT_TAG = /<script\b/gi
const SCRIPT_SRC_TAG = /<script\b[^>]*\bsrc\s*=/gi

// ---- flag off (unset, or anything but the exact string 'true'): identical to today -------------
const legacyChart = legacyExtractBodyContent(chartDocument)
assert.ok(legacyChart.startsWith(CHARTJS_TAG + '\n'), 'the legacy output carries the CDN script first')
assert.equal(countTags(legacyChart, SCRIPT_SRC_TAG), 1)

for (const flagValue of [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'truee']) {
  const result = insertChart(chartDocument, flagValue)
  assert.equal(result.method, 'insertChart')
  assert.equal(result.params.chartHtml, legacyChart, `flag value ${JSON.stringify(flagValue)} must leave the output byte-identical`)
  assert.equal(sha(result.params.chartHtml), sha(legacyChart))
}
const legacyChartInline = legacyExtractBodyContent(chartDocumentWithInlineHead)
assert.equal(insertChart(chartDocumentWithInlineHead, undefined).params.chartHtml, legacyChartInline)
assert.equal(insertChart(chartDocumentWithInlineHead, 'false').params.chartHtml, legacyChartInline)

// ---- flag on, CHART: no head library loads, the chart's own scripts and markup exactly ----------
const stripped = insertChart(chartDocument, 'true').params.chartHtml
assert.equal(stripped, `\n\n    ${chartBody}\n`, 'only the body is left (after the join newline)')
assert.equal(countTags(stripped, SCRIPT_SRC_TAG), 0, 'no <script src=...> remains')
assert.ok(!stripped.includes('chart.umd'), 'the Chart.js CDN URL is gone')
assert.ok(!stripped.includes(CHARTJS_SRC))
assert.equal(countTags(stripped, SCRIPT_TAG), 2, 'the chart init script and the font-fix script are both kept')
assert.ok(stripped.includes(chartBody.trim()), 'the chart markup and inline scripts are byte-identical to the body')
assert.ok(stripped.includes('new Chart(ctx, chartConfig)'))
assert.ok(stripped.includes('"datalabels": {"display": true}'), 'point-label config is untouched')
assert.ok(stripped.includes('data-element-id="chart-pres-1-slide-0-line-a748d9e5"'))
assert.notEqual(stripped, legacyChart)
assert.equal(
  stripped,
  legacyChart.replace(CHARTJS_TAG, ''),
  'the only difference from today is the removed Chart.js script tag',
)

// Head scripts without a src are the chart's own and stay (in head order, ahead of the body).
const strippedInline = insertChart(chartDocumentWithInlineHead, 'true').params.chartHtml
assert.equal(countTags(strippedInline, SCRIPT_SRC_TAG), 0)
assert.ok(strippedInline.startsWith(HEAD_INLINE + '\n'), 'the head inline script is kept')
assert.equal(strippedInline, legacyChartInline.replace(CHARTJS_TAG + '\n', ''))
assert.equal(countTags(strippedInline, SCRIPT_TAG), 3)

// Several head library loads (Chart.js plus a plugin) all go; a src attribute in any form counts.
const manyLoads = previewDocument([
  `    ${CHARTJS_TAG}`,
  '    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>',
  "    <script async src='https://example.invalid/other.js'></script>",
  '    <script type="text/javascript" SRC="/relative.js"></script>',
  `    ${HEAD_INLINE}`,
].join('\n'))
const strippedMany = insertChart(manyLoads, 'true').params.chartHtml
assert.equal(countTags(strippedMany, SCRIPT_SRC_TAG), 0)
assert.ok(strippedMany.startsWith(HEAD_INLINE + '\n'))
assert.equal(countTags(strippedMany, SCRIPT_TAG), 3)
assert.equal(insertChart(manyLoads, undefined).params.chartHtml, legacyExtractBodyContent(manyLoads))

// Only the head is touched: a library load placed in the body is the chart's own and stays.
const bodyLoad = `${chartBody}\n    <script src="https://example.invalid/body-lib.js"></script>`
const strippedBodyLoad = insertChart(previewDocument(`    ${CHARTJS_TAG}`, bodyLoad), 'true').params.chartHtml
assert.equal(countTags(strippedBodyLoad, SCRIPT_SRC_TAG), 1)
assert.ok(strippedBodyLoad.includes('https://example.invalid/body-lib.js'))
assert.ok(!strippedBodyLoad.includes('chart.umd'))

// A bare fragment (no <!DOCTYPE>/<html>) is returned as is, flag on or off.
for (const flagValue of [undefined, 'true']) {
  assert.equal(insertChart(chartBody, flagValue).params.chartHtml, chartBody)
  assert.equal(insertChart('<canvas id="chart"></canvas>', flagValue).params.chartHtml, '<canvas id="chart"></canvas>')
  assert.equal(insertChart('', flagValue).params.chartHtml, '')
}
assert.equal(insertChart(undefined, 'true').params.chartHtml, '', 'a missing html field stays empty')

// Nothing but chartHtml changes in a CHART insertion.
{
  const off = insertChart(chartDocumentWithInlineHead, undefined)
  const on = insertChart(chartDocumentWithInlineHead, 'true')
  const { chartHtml: offHtml, ...offRest } = off.params
  const { chartHtml: onHtml, ...onRest } = on.params
  assert.notEqual(offHtml, onHtml)
  assert.deepEqual(JSON.parse(JSON.stringify(onRest)), JSON.parse(JSON.stringify(offRest)))
  assert.equal(on.method, off.method)
}

// ---- other element types: unchanged by the flag, in both states --------------------------------
const nonChartTypes = Object.keys(INSERTION_METHOD_MAP).filter(type => type !== 'CHART')
assert.ok(nonChartTypes.length >= 15, 'every non-chart component type is covered')
assert.equal(
  Object.entries(INSERTION_METHOD_MAP).filter(([, method]) => method === 'insertChart').map(([type]) => type).join(),
  'CHART',
  'CHART is the only type that inserts through the chart path',
)

const diagramDocument = previewDocument(
  `    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>\n    ${HEAD_INLINE}`,
  '<div class="diagram">swimlane</div>',
)
const withoutIds = params => {
  const { elementId, ...rest } = params
  assert.ok(typeof elementId === 'string' && elementId.length > 0)
  return JSON.parse(JSON.stringify(rest))
}
for (const type of nonChartTypes) {
  const element = { html: diagramDocument, image_url: 'https://example.invalid/i.png', grid_position: gridPosition }
  delete env[FLAG]
  const off = buildInsertionParams(type, element)
  env[FLAG] = 'true'
  const on = buildInsertionParams(type, element)
  assert.equal(on.method, off.method, `${type}: same insertion method`)
  assert.deepEqual(withoutIds(on.params), withoutIds(off.params), `${type}: flag must not change a non-chart insertion`)
  if (off.method === 'insertDiagram') {
    assert.equal(on.params.htmlContent, legacyExtractBodyContent(diagramDocument), `${type}: diagram HTML is today's output`)
    assert.ok(on.params.htmlContent.includes('mermaid.min.js'), `${type}: the diagram's head library load is kept`)
    assert.ok(on.params.htmlContent.includes(HEAD_INLINE))
  } else if (off.method === 'insertElement') {
    assert.equal(on.params.content, diagramDocument, `${type}: element content is stored as received`)
  } else {
    assert.equal(on.params.imageUrl, 'https://example.invalid/i.png')
  }
}
// A V2 infographic (HTML, no image) routes through the diagram path: untouched too.
{
  delete env[FLAG]
  const off = buildInsertionParams('INFOGRAPHIC', { html: diagramDocument, grid_position: gridPosition })
  env[FLAG] = 'true'
  const on = buildInsertionParams('INFOGRAPHIC', { html: diagramDocument, grid_position: gridPosition })
  assert.equal(off.method, 'insertDiagram')
  assert.equal(on.params.htmlContent, off.params.htmlContent)
  assert.ok(on.params.htmlContent.includes('mermaid.min.js'))
}

// ---- source contract: the call sites -----------------------------------------------------------
const clientSource = fs.readFileSync(moduleUrl('../lib/textlabs-client.ts'), 'utf8')
assert.equal(
  (clientSource.match(/process\.env\.NEXT_PUBLIC_CHART_STRIP_PREVIEW_SCRIPTS_ENABLED === 'true'/g) || []).length,
  1,
  'the flag is read once, literally and with an exact comparison (Next inlines NEXT_PUBLIC_ values by name)',
)
assert.equal((clientSource.match(/dropHeadScriptSources: chartStripPreviewScriptsEnabled\(\)/g) || []).length, 1)
assert.match(
  clientSource,
  /htmlContent: extractBodyContent\(element\.html \|\| ''\)/,
  'the diagram call site passes no option',
)

console.log('chart-strip-preview-scripts: all assertions passed')
console.log(`flag-off chart hash ${sha(legacyChart).slice(0, 16)}; flag-on chart hash ${sha(stripped).slice(0, 16)}`)
