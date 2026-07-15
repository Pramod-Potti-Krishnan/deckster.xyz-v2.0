import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const path = new URL('../lib/theme-sync.ts', import.meta.url)
const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, require })

const { applyThemeSyncResponse, isThemeAppliedToPresentation, syncingTheme } = mod.exports
const current = syncingTheme('new-request', 'deck-2')
const stale = applyThemeSyncResponse(current, {
  request_id: 'old-request', status: 'applied', presentation_id: 'deck-1',
})
assert.equal(stale, current)

const applied = applyThemeSyncResponse(current, {
  request_id: 'new-request', status: 'applied', presentation_id: 'deck-2',
})
assert.equal(applied.status, 'applied')
assert.equal(isThemeAppliedToPresentation(applied, 'deck-2'), true)
assert.equal(isThemeAppliedToPresentation(applied, 'deck-1'), false)

const failed = applyThemeSyncResponse(current, {
  request_id: 'new-request', status: 'failed', error: 'Theme Builder unavailable',
})
assert.equal(failed.status, 'failed')
assert.equal(failed.error, 'Theme Builder unavailable')

console.log('theme sync tests passed')
