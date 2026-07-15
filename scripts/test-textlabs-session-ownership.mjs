import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const hookSlots = []
let hookCursor = 0
let createImplementation
const creationCalls = []

const react = {
  useState(initial) {
    const index = hookCursor++
    if (!(index in hookSlots)) {
      hookSlots[index] = typeof initial === 'function' ? initial() : initial
    }
    return [
      hookSlots[index],
      next => {
        hookSlots[index] = typeof next === 'function' ? next(hookSlots[index]) : next
      },
    ]
  },
  useRef(initial) {
    const index = hookCursor++
    if (!(index in hookSlots)) hookSlots[index] = { current: initial }
    return hookSlots[index]
  },
  useCallback(callback) {
    hookCursor++
    return callback
  },
}

const source = fs.readFileSync(new URL('../hooks/use-textlabs-session.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const mod = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module: mod,
  exports: mod.exports,
  DOMException,
  console,
  require: id => {
    if (id === 'react') return react
    if (id === '@/lib/textlabs-client') {
      return {
        createSession: (presentationId, signal) => {
          creationCalls.push({ presentationId, signal })
          return createImplementation(presentationId, signal)
        },
      }
    }
    throw new Error(`Unexpected dependency: ${id}`)
  },
})

function render(presentationId) {
  hookCursor = 0
  return mod.exports.useTextLabsSession(presentationId)
}

createImplementation = async presentationId => ({ session_id: `session-${presentationId}` })
let hook = render('deck-a')
assert.equal(await hook.ensureSession(), 'session-deck-a')
hook = render('deck-a')
assert.equal(hook.sessionId, 'session-deck-a')
assert.equal(await hook.ensureSession(), 'session-deck-a')
assert.equal(creationCalls.length, 1, 'a cached session is reused only for its presentation')

const oldDeckCreation = deferred()
createImplementation = () => oldDeckCreation.promise
hook = render('deck-b')
assert.equal(hook.sessionId, null, 'changing presentation invalidates the cached session synchronously')
const oldDeckRequest = hook.ensureSession()

const newDeckCreation = deferred()
createImplementation = () => newDeckCreation.promise
hook = render('deck-c')
const newDeckRequest = hook.ensureSession()
oldDeckCreation.resolve({ session_id: 'session-deck-b' })
await assert.rejects(oldDeckRequest, /presentation changed/)
newDeckCreation.resolve({ session_id: 'session-deck-c' })
assert.equal(await newDeckRequest, 'session-deck-c')
hook = render('deck-c')
assert.equal(hook.sessionId, 'session-deck-c', 'old completion cannot populate the new presentation')

const sharedCreation = deferred()
createImplementation = () => sharedCreation.promise
hook = render('deck-d')
const firstWaiter = hook.ensureSession()
const secondWaiter = hook.ensureSession()
assert.equal(creationCalls.filter(call => call.presentationId === 'deck-d').length, 1)
sharedCreation.resolve({ session_id: 'session-deck-d' })
assert.deepEqual(await Promise.all([firstWaiter, secondWaiter]), ['session-deck-d', 'session-deck-d'])

console.log('Text Labs presentation-bound session tests passed')
