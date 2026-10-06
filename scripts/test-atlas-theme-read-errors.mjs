import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Real hook, deliberate offline responses. No connected reads or mutation receipts.
const source = fs.readFileSync('hooks/use-theme-profiles.ts', 'utf8')
function harness(text = source) {
  const exports = {}, replies = [], reads = [], values = [], transitions = []
  let slot = 0
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, console,
    async fetch(url, options) {
      reads.push({ url, options }); assert(replies.length, 'Each read requires explicit input')
      return await replies.shift()
    },
    require(id) {
      assert.equal(id, 'react')
      return { useCallback: fn => fn, useState(initial) {
        const index = slot++; values[index] = initial
        return [initial, next => { values[index] = next; transitions.push([index, next]) }]
      } }
    },
  })
  const hook = exports.useThemeProfiles()
  return { hook, replies, reads, values, transitions }
}
const reply = (body, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => body })
const plain = value => JSON.parse(JSON.stringify(value))
let cases = 0
const profile = { id: 'owned/theme', name: 'Saved palette', is_standard: true, theme_payload: { colors: { primary: '#123456' } } }
for (const [method, path, valid, expected] of [
  ['listThemes', '/api/themes', { themes: [profile], count: 1 }, { themes: [profile], count: 1 }],
  ['getStandardTheme', '/api/themes/standard', { theme: profile }, profile],
]) {
  for (const failure of [
    () => reply(method === 'listThemes' ? { themes: [], count: 0, error: 'storage unavailable' } : { theme: null, error: 'storage unavailable' }),
    () => reply({}, false),
    () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad JSON') } }),
    () => Promise.reject(new Error('transport unavailable')),
  ]) {
    const h = harness(); h.replies.push(failure())
    const result = await h.hook[method]()
    assert.equal(result, null, 'Refusal cannot become confirmed empty/default')
    assert.equal(h.values[0], false, 'Busy releases after refusal')
    assert(h.values[1]?.message, 'Refusal reports an error without escaping rejection')
    assert.deepEqual(h.transitions.filter(([slot]) => slot === 0).map(([, value]) => value), [true, false])
    assert.equal(h.reads[0].url, path); assert.equal(h.reads[0].options.cache, 'no-store')
    h.replies.push(reply(valid)); assert.deepEqual(plain(await h.hook[method]()), expected)
    assert.equal(h.values[1], null, 'A successful retry clears the earlier error')
    assert.equal(h.values[0], false); cases++
  }
}
for (const [method, body, expected] of [
  ['listThemes', { themes: [], count: 0 }, { themes: [], count: 0 }],
  ['listThemes', {}, { themes: [], count: 0 }],
  ['listThemes', { themes: [profile], count: 1, error: '' }, { themes: [profile], count: 1 }],
  ['getStandardTheme', { theme: null }, null],
  ['getStandardTheme', { theme: profile, error: null }, profile],
]) {
  const h = harness(); h.replies.push(reply(body))
  assert.deepEqual(plain(await h.hook[method]()), expected)
  assert.equal(h.values[1], null); assert.equal(h.values[0], false); cases++
}
const baseline = readAtlasBaseline('63e0eb2:hooks/use-theme-profiles.ts')
{
  const h = harness(baseline); h.replies.push(reply({ themes: [], count: 0, error: 'storage unavailable' }))
  assert.deepEqual(plain(await h.hook.listThemes()), { themes: [], count: 0 }); assert.equal(h.values[1], null)
  cases++ // Negative control reproduces the erroneous confirmed-empty result.
}
{
  const h = harness(baseline); h.replies.push(reply({ theme: null, error: 'storage unavailable' }))
  assert.equal(await h.hook.getStandardTheme(), null); assert.equal(h.values[1], null); cases++
}
// Mutation operations and payloads must be byte-preserved by this assigned read batch.
assert.equal(source.slice(source.indexOf('  const saveTheme')), baseline.slice(baseline.indexOf('  const saveTheme')))
console.log(`PASS ${cases} actual theme read/refusal/recovery cases; mutation callbacks unchanged; offline only`)
