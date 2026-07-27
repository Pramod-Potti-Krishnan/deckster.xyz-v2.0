import assert from 'node:assert/strict'
import fs from 'node:fs'

const builderSource = fs.readFileSync(
  new URL('../app/builder/page.tsx', import.meta.url),
  'utf8',
)
const websocketSource = fs.readFileSync(
  new URL('../hooks/use-deckster-websocket-v2.ts', import.meta.url),
  'utf8',
)
const chatInputSource = fs.readFileSync(
  new URL('../components/builder/chat-input.tsx', import.meta.url),
  'utf8',
)

assert.match(
  builderSource,
  /if \(enabled\) setWebSearchEnabled\(true\)/,
  'enabling deep research must also enable regular web search',
)
assert.match(
  builderSource,
  /if \(!enabled\) setResearchEnabled\(false\)/,
  'disabling web search must also disable deep research',
)
assert.match(
  builderSource,
  /setWebSearchEnabled\(pending\.web_search \|\| pending\.deep_research\)/,
  'restored sessions must normalize legacy deep-only state',
)
assert.match(
  websocketSource,
  /const webSearch = \(options\?\.webSearch \?\? false\) \|\| deepResearch/,
  'the wire contract must normalize deep research to web+deep',
)
assert.match(
  chatInputSource,
  /Deep research \(includes web\)/,
  'the UI must explain that deep research includes web search',
)

console.log('research mode contract tests passed')
