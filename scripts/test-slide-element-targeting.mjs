import assert from 'node:assert/strict'
import fs from 'node:fs'

const viewerSource = fs.readFileSync(
  new URL('../components/presentation-viewer.tsx', import.meta.url),
  'utf8',
)
const builderSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8')
const generationSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)

const addSlideHandler = viewerSource.slice(
  viewerSource.indexOf('// Add slide handler'),
  viewerSource.indexOf('// Duplicate slide handler'),
)
assert.match(addSlideHandler, /const newSlideNumber = newSlideIndex \+ 1/)
assert.match(addSlideHandler, /onSlideChangeRef\.current\?\.\(newSlideNumber\)/)
assert.ok(
  addSlideHandler.indexOf('onSlideChangeRef.current?.(newSlideNumber)') <
    addSlideHandler.indexOf("'goToSlide'"),
  'the authoritative new slide is published before awaiting iframe navigation',
)

const presentationAreaCall = builderSource.slice(
  builderSource.lastIndexOf('<PresentationArea'),
  builderSource.lastIndexOf('buildThemeSelection={buildThemeSelection}'),
)
assert.match(
  presentationAreaCall,
  /currentSlideIndexRef\.current = nextVisualIndex[\s\S]*setCurrentSlideIndex\(nextVisualIndex\)/,
  'the imperative slide owner updates before React state is scheduled',
)
assert.match(builderSource, /getCurrentSlideIndex = useCallback\(\(\) => currentSlideIndexRef\.current, \[\]\)/)
assert.match(builderSource, /getCurrentSlideIndex,\n/)

const openPanelHandler = generationSource.slice(
  generationSource.indexOf('const handleOpenPanel = useCallback'),
  generationSource.indexOf('return { handleGenerate, handleOpenPanel }'),
)
assert.match(openPanelHandler, /const targetSlideIndex = getCurrentSlideIndex\?\.\(\) \?\? currentSlideIndex/)
assert.match(openPanelHandler, /slideIndex: targetSlideIndex/)
assert.equal(
  (openPanelHandler.match(/slideIndex: targetSlideIndex/g) || []).length,
  2,
  'the placeholder command and blank-element tracking use the same authoritative slide',
)
assert.ok(
  openPanelHandler.indexOf('const targetSlideIndex') <
    openPanelHandler.indexOf("sendElementCommand('insertTextBox'"),
  'the slide is resolved at click time before insertion begins',
)

assert.match(
  generationSource,
  /blankInfo\?\.slideIndex[\s\S]*refineContext\?\.slideIndex[\s\S]*getCurrentSlideIndex\?\.\(\)[\s\S]*currentSlideIndex/,
  'generation without a placeholder also has an authoritative slide fallback',
)

console.log('Immediate Add Blank → Element slide-targeting contract tests passed')
