import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const helperPath = new URL('../lib/builder-presentation-ownership.ts', import.meta.url)
const compiled = ts.transpileModule(fs.readFileSync(helperPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require, URL, decodeURIComponent })

const {
  deriveBuilderStage,
  isPresentationCallbackCurrent,
  resolveEffectivePresentation,
} = mod.exports

const stale = resolveEffectivePresentation({
  livePresentationUrl: 'https://layout.example/p/strawman-2',
  livePresentationId: 'strawman-2',
  liveSlideCount: 8,
  override: {
    presentationUrl: 'https://layout.example/p/manual-1',
    presentationId: 'manual-1',
    slideCount: 2,
    refreshToken: 123,
  },
})
assert.equal(stale.presentationId, 'strawman-2')
assert.equal(stale.presentationUrl, 'https://layout.example/p/strawman-2')
assert.equal(stale.slideCount, 8)
assert.equal(stale.refreshToken, 0)
assert.equal(stale.usesOverride, false)

const matching = resolveEffectivePresentation({
  livePresentationUrl: 'https://layout.example/p/manual-1',
  livePresentationId: 'manual-1',
  liveSlideCount: 1,
  override: {
    presentationUrl: 'https://layout.example/p/manual-1?updated=1',
    presentationId: 'manual-1',
    slideCount: 2,
    refreshToken: 456,
  },
})
assert.equal(matching.presentationId, 'manual-1')
assert.equal(matching.slideCount, 2)
assert.equal(matching.refreshToken, 456)
assert.equal(matching.usesOverride, true)

assert.equal(isPresentationCallbackCurrent({ callbackPresentationId: 'manual-1', livePresentationId: 'strawman-2' }), false)
assert.equal(isPresentationCallbackCurrent({ callbackPresentationId: 'strawman-2', livePresentationId: 'strawman-2' }), true)
assert.equal(deriveBuilderStage({ activeVersion: 'blank', presentationUrl: 'https://layout/p/blank', slideCount: 1, hasSlideStructure: false }), 0)
assert.equal(deriveBuilderStage({ activeVersion: 'strawman', presentationUrl: 'https://layout/p/strawman', slideCount: 8, hasSlideStructure: true }), 4)
assert.equal(deriveBuilderStage({ activeVersion: 'final', presentationUrl: 'https://layout/p/final', slideCount: 8, hasSlideStructure: true }), 6)

console.log('builder presentation ownership tests passed')
