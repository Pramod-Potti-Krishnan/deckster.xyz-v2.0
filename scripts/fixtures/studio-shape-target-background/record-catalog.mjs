// Runs the REAL layout-builder src/utils/semantic-slot-catalog.js (+ src/templates/template-registry.js) in a vm with a one-section DOM, and
// returns the exact getTemplateSlotCatalog frame the viewer posts back (viewer/presentation-viewer.html:3943-3955), per layout id.
//   node record-catalog.mjs <layout-builder checkout> <out.json>      (the test imports recordCatalogFrames and feeds it `git show <sha>:<path>`)
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

export const LAYOUT_IDS = ['H1s', 'H2', 'H3', 'H1', 'C1', 'L25', 'I1']

export function recordCatalogFrames(readSource) {
  const out = {}
  for (const layoutId of LAYOUT_IDS) {
    const section = { dataset: { layout: layoutId, template: undefined }, querySelector: () => null, querySelectorAll: () => [], getAttribute: () => null }
    const document = { querySelector: sel => (sel.includes('nth-child(1)') || sel.includes('data-slide-index="0"')) ? section : null, querySelectorAll: () => [], documentElement: {} }
    const window = { document, currentPresentationData: { slides: [{ content: {} }] }, getComputedStyle: () => ({ getPropertyValue: () => '' }) }
    window.window = window
    const ctx = vm.createContext({ window, document, console, Math, Number, Object, Array, String, JSON, parseFloat, parseInt, Boolean, RegExp, Set, Map })
    for (const rel of ['src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js']) vm.runInContext(readSource(rel), ctx, { filename: rel })
    const catalogResult = window.SemanticSlotCatalog.buildTemplateSlotCatalog(0)
    const result = { success: false, action: 'getTemplateSlotCatalog' }
    Object.assign(result, catalogResult)
    if (catalogResult.success) result.data = { canvas_type: catalogResult.canvas_type, hero_style: catalogResult.hero_style, slots: catalogResult.slots }
    out[layoutId] = JSON.parse(JSON.stringify(result))
  }
  return out
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const layout = process.argv[2]
  fs.writeFileSync(process.argv[3], JSON.stringify(recordCatalogFrames(rel => fs.readFileSync(path.join(layout, rel), 'utf8')), null, 1))
}
