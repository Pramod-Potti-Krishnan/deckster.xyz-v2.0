import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const themeBuilderPath = new URL('../lib/theme-builder.ts', import.meta.url)
const compiled = ts.transpileModule(fs.readFileSync(themeBuilderPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require })

const {
  normalizeThemePanelSelection,
  selectCanonicalThemePreset,
} = mod.exports

const restoredLegacy = normalizeThemePanelSelection({
  mode: 'preset',
  preset_id: 'vibrant-orange',
  color_overrides: { accent: '#123456', surface: '#abcdef' },
})
assert.equal(restoredLegacy.preset_id, 'vibrant')
assert.deepEqual(
  JSON.parse(JSON.stringify(restoredLegacy.color_overrides)),
  { accent: '#123456', surface: '#abcdef' },
)

assert.equal(
  normalizeThemePanelSelection({ mode: 'preset', preset_id: 'corporate-blue' }).preset_id,
  'corporate_light',
)
assert.equal(
  normalizeThemePanelSelection({ mode: 'preset', preset_id: 'unknown-old-theme' }).preset_id,
  'corporate_light',
)

const switchedPreset = selectCanonicalThemePreset({
  mode: 'custom',
  primary_hex: '#111111',
  secondary_hex: '#222222',
  color_overrides: { border: '#333333' },
}, 'dark-mode')
assert.equal(switchedPreset.mode, 'preset')
assert.equal(switchedPreset.preset_id, 'corporate_dark')
assert.deepEqual(
  JSON.parse(JSON.stringify(switchedPreset.color_overrides)),
  { border: '#333333', primary: '#111111', secondary: '#222222' },
)

const panelSource = fs.readFileSync(new URL('../components/theme-panel.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(panelSource, /sendCommand\s*\(/)
assert.doesNotMatch(panelSource, /['"](?:setTheme|previewTheme|saveTheme)['"]/) 
assert.match(panelSource, /onBuildThemeChange\(next\)/)
assert.match(panelSource, /Template and theme choices are locked once generation starts/)
assert.match(panelSource, /if \(selectionLocked \|\| !canApply \|\| !onBuildThemeChange\) return/)
assert.match(panelSource, /&& !selectionLocked/)
assert.match(panelSource, /Syncing/)
assert.match(panelSource, /Applied/)
assert.match(panelSource, /Failed/)

const areaSource = fs.readFileSync(new URL('../components/builder/presentation-area.tsx', import.meta.url), 'utf8')
const viewerSource = fs.readFileSync(new URL('../components/presentation-viewer.tsx', import.meta.url), 'utf8')
assert.match(areaSource, /buildThemeSelection=\{buildThemeSelection\}/)
assert.match(areaSource, /themeSync=\{themeSync\}/)
assert.match(viewerSource, /onBuildThemeChange=\{onBuildThemeChange\}/)
assert.match(viewerSource, /selectionLocked=\{templateSelectionLocked\}/)

console.log('theme panel lifecycle tests passed')
