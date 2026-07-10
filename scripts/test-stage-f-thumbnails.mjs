import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, '..', 'lib', 'stage-f-thumbnails.ts')
const source = readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const module = { exports: {} }
vm.runInNewContext(transpiled.outputText, {
  module,
  exports: module.exports,
})

const {
  mergeStageFThumbnailUrl,
  mergeStageFPresentationThumbnailUrl,
  mergeStageFInsertedThumbnailUrl,
  applyStageFThumbnailUrls,
} = module.exports

const empty = {}
assert.equal(mergeStageFThumbnailUrl(empty, -1, 'https://cdn.test/a.png'), empty)
assert.equal(mergeStageFThumbnailUrl(empty, 0, ''), empty)

const one = mergeStageFThumbnailUrl(empty, 0, ' https://cdn.test/0.png?v=1 ')
assert.equal(JSON.stringify(one), JSON.stringify({ 0: 'https://cdn.test/0.png?v=1' }))
assert.equal(mergeStageFThumbnailUrl(one, 0, 'https://cdn.test/0.png?v=1'), one)

const slides = applyStageFThumbnailUrls(
  [
    { slideNumber: 1, title: 'One' },
    { slideNumber: 2, title: 'Two' },
  ],
  { 1: 'https://cdn.test/1.png?v=1' },
)

assert.equal(JSON.stringify(slides), JSON.stringify([
  { slideNumber: 1, title: 'One' },
  { slideNumber: 2, title: 'Two', thumbnailUrl: 'https://cdn.test/1.png?v=1' },
]))

const stableSlides = applyStageFThumbnailUrls(
  [
    { slideNumber: 1, slideIndex: 4, title: 'Inserted' },
    { slideNumber: 2, slideIndex: 1, title: 'Original' },
  ],
  {
    1: 'https://cdn.test/1.png?v=1',
    4: 'https://cdn.test/4.png?v=1',
  },
)

assert.equal(JSON.stringify(stableSlides), JSON.stringify([
  {
    slideNumber: 1,
    slideIndex: 4,
    title: 'Inserted',
    thumbnailUrl: 'https://cdn.test/4.png?v=1',
  },
  {
    slideNumber: 2,
    slideIndex: 1,
    title: 'Original',
    thumbnailUrl: 'https://cdn.test/1.png?v=1',
  },
]))

const byPresentation = mergeStageFPresentationThumbnailUrl(
  {},
  'deck-1',
  0,
  'https://cdn.test/deck-1/0.png?v=1',
)
const isolated = mergeStageFPresentationThumbnailUrl(
  byPresentation,
  'deck-2',
  0,
  'https://cdn.test/deck-2/0.png?v=1',
)
assert.equal(isolated['deck-1'][0], 'https://cdn.test/deck-1/0.png?v=1')
assert.equal(isolated['deck-2'][0], 'https://cdn.test/deck-2/0.png?v=1')

const inserted = mergeStageFInsertedThumbnailUrl(
  {
    'deck-1': {
      0: 'https://cdn.test/a.png?v=1',
      1: 'https://cdn.test/b.png?v=1',
      2: 'https://cdn.test/c.png?v=1',
    },
  },
  'deck-1',
  1,
  'https://cdn.test/d.png?v=1',
)
assert.equal(JSON.stringify(inserted['deck-1']), JSON.stringify({
  0: 'https://cdn.test/a.png?v=1',
  1: 'https://cdn.test/d.png?v=1',
  2: 'https://cdn.test/b.png?v=1',
  3: 'https://cdn.test/c.png?v=1',
}))
assert.equal(
  mergeStageFInsertedThumbnailUrl(
    inserted,
    'deck-1',
    1,
    'https://cdn.test/d.png?v=1',
  ),
  inserted,
)

console.log('stage-f thumbnail helpers ok')
