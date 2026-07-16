import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/grid-splitter.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })

const { splitGridArea, splitGridAxis, splitGridSpan } = mod.exports

assert.deepEqual(Array.from(splitGridSpan(25, 3)), [8.4, 8.4, 8.2])

const horizontal = splitGridArea({
  start_col: 2.2, start_row: 4, position_width: 25, position_height: 8.2,
}, 3, 'horizontal')
assert.deepEqual(JSON.parse(JSON.stringify(horizontal)), [
  { start_col: 2.2, start_row: 4, position_width: 8.4, position_height: 8.2 },
  { start_col: 10.6, start_row: 4, position_width: 8.4, position_height: 8.2 },
  { start_col: 19, start_row: 4, position_width: 8.2, position_height: 8.2 },
])
assert.equal(horizontal.at(-1).start_col + horizontal.at(-1).position_width, 27.2)

const vertical = splitGridAxis(3.4, 11.2, 3)
assert.deepEqual(JSON.parse(JSON.stringify(vertical)), [
  { start: 3.4, size: 3.8 },
  { start: 7.2, size: 3.8 },
  { start: 11, size: 3.6 },
])

const grid = splitGridArea({
  start_col: 2, start_row: 4.2, position_width: 25, position_height: 11.2,
}, 6, 'grid', 3)
assert.equal(grid.length, 6)
assert.deepEqual(JSON.parse(JSON.stringify(grid.slice(0, 3).map(item => item.position_width))), [8.4, 8.4, 8.2])
assert.deepEqual(JSON.parse(JSON.stringify(grid.filter((_, index) => index % 3 === 0).map(item => item.position_height))), [5.6, 5.6])
assert.equal(grid[0].start_col + grid[0].position_width, grid[1].start_col)
assert.equal(grid[1].start_col + grid[1].position_width, grid[2].start_col)
assert.equal(grid[0].start_row + grid[0].position_height, grid[3].start_row)

assert.throws(() => splitGridSpan(1, 6), /at least 0.2/)
assert.throws(() => splitGridSpan(10.1, 3), /0.2 grid increments/)

console.log('minor-grid splitter tests passed')
