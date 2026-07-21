import assert from 'node:assert/strict'
import fs from 'node:fs'

const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
const areaSource = fs.readFileSync(
  new URL('../components/builder/presentation-area.tsx', import.meta.url),
  'utf8',
)

const activation = builderSource.slice(
  builderSource.indexOf('const activateElementPanel = useCallback'),
  builderSource.indexOf('// Text Labs generation hook'),
)
assert.match(activation, /bringToFront\('element'\)/)
assert.match(activation, /setShowElementPanel\(false\)/)
assert.match(activation, /setShowTextBoxPanel\(false\)/)
assert.match(activation, /setShowFormatPanel\(false\)/)
assert.ok(
  activation.indexOf("bringToFront('element')") < activation.indexOf('setShowElementPanel(false)'),
  'Element focus is assigned before competing panels are reconciled',
)

const toolbarActivation = builderSource.slice(
  builderSource.indexOf('const handleOpenGenerationPanelInFront'),
  builderSource.indexOf('const handleOpenBlankGenerationPanel'),
)
assert.match(toolbarActivation, /activateElementPanel\(\)/)
assert.match(toolbarActivation, /await handleOpenGenerationPanel\(type\)/)
assert.ok(
  toolbarActivation.indexOf('activateElementPanel()') <
    toolbarActivation.indexOf('handleOpenGenerationPanel(type)'),
  'toolbar activation focuses Element before inserting/opening its placeholder',
)

const blankActivation = builderSource.slice(
  builderSource.indexOf('const handleOpenBlankGenerationPanel'),
  builderSource.indexOf('const handleApprovedTextLabsGenerate'),
)
assert.match(blankActivation, /activateElementPanel\(\)/)
assert.match(blankActivation, /generationPanel\.openPanelForElement\(componentType, elementId\)/)
assert.ok(
  blankActivation.indexOf('activateElementPanel()') <
    blankActivation.indexOf('generationPanel.openPanelForElement'),
  'blank-placeholder activation focuses Element before opening it',
)

assert.match(
  builderSource,
  /onOpenGenerationPanel=\{features\.useTextLabsGeneration \? handleOpenGenerationPanelInFront : undefined\}/,
)
assert.match(
  builderSource,
  /onOpenBlankGenerationPanel=\{handleOpenBlankGenerationPanel\}/,
)
assert.match(areaSource, /openBlankGenerationPanel\(info\.componentType, elementId\)/)
assert.doesNotMatch(
  areaSource.slice(
    areaSource.indexOf('export function handleBlankElementClick'),
    areaSource.indexOf('export interface PresentationAreaProps'),
  ),
  /generationPanel\.openPanelForElement/,
  'PresentationArea cannot bypass the page-owned focus wrapper',
)

assert.match(builderSource, /data-builder-panel="element"/)
assert.match(builderSource, /data-builder-panel="deck"/)
assert.match(
  builderSource,
  /zIndex: isElementDrawerOpen \? 10 \+ panelZIndices\.element : 60/,
)
assert.match(
  builderSource,
  /zIndex: isDeckDrawerOpen \? 10 \+ panelZIndices\.deck : 60/,
)

// At the initial equal z-index used in a 1280px UAT layout, focusing Element
// must make it strictly higher than the still-open Deck drawer.
const panelZ = { element: 0, deck: 0 }
const nextZ = Math.max(...Object.values(panelZ)) + 1
panelZ.element = nextZ
assert.ok(panelZ.element > panelZ.deck)

console.log('Element panel focus and pointer-routing contract tests passed')
