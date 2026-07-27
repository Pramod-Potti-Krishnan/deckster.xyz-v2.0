import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const websocket = readFileSync('hooks/use-deckster-websocket-v2.ts', 'utf8')
const cards = readFileSync('components/builder/message-list.tsx', 'utf8')
const fileChip = readFileSync('components/file-chip.tsx', 'utf8')
const upload = readFileSync('hooks/use-file-upload.ts', 'utf8')
const builder = readFileSync('app/builder/page.tsx', 'utf8')

assert.match(websocket, /research_status\?:/)
assert.match(websocket, /citation_count\?:/)
assert.match(cards, /research_status/)
assert.match(cards, /citation_count/)

assert.match(fileChip, /'processing'/)
assert.match(upload, /status:\s*'processing'/)
assert.match(upload, /void pollIngestStatus/)
assert.doesNotMatch(upload, /await pollIngestStatus/)
assert.match(builder, /file\.status === 'processing'/)

console.log('golden evidence contract: ok')
