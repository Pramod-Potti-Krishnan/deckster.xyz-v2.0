// PASS2-DIRECTOR-CHAT PR B: NEXT_PUBLIC_STUDIO_CHAT_POLISH is presentation only.
//
// Replays the five Director transcripts of the chat harness (scripts/studio-chat-harness/README.md) twice through the REAL
// WebSocket hook, MessageList, QuestionCard, header/notice and page handlers, flag off and flag on, and proves:
//   1. flag off: the rendered chat markup equals the committed base baselines, hash for hash;
//   2. flag on: outbound socket bytes, React keys, hook ids, handler calls, hook state and the sessionStorage cache are
//      byte-identical to flag off, at every checkpoint of every transcript and profile;
//   3. flag on: the markup differs ONLY by one added data-studio-chat-polish attribute on each message root (strip it and the
//      markup equals flag off, byte for byte); the classic (non-Studio) profile gets none at all;
//   4. every kind of message root MessageList draws (user, chat, thinking stream, working pulse, ask card, outline,
//      combined outline + ready) was exercised flag-on, so a root that lost its attribute would be noticed;
//   5. every rule of studio-chat-polish.css is keyed to [data-studio-chat-polish], so flag off nothing can match.
//
//   node scripts/test-studio-chat-polish.mjs
//
// Offline by construction (no socket, fetch or real timer): the harness installs the host network guard.
process.env.NODE_ENV = 'production'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_POLISH'
const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
const { readSnapshot } = await import('./studio-chat-harness/snapshot.mjs')

const failures = []
const fail = message => failures.push(message)
const ATTR = / data-studio-chat-polish="(message|thinking)"/g
const ANY_ATTR = /data-studio-chat-polish/ // not global: .test() on a global regex keeps lastIndex
const fixtures = fs.readdirSync(path.join(root, 'scripts/fixtures/director-chat')).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/director-chat', name), 'utf8')))

// Root kinds seen flag-on, to prove coverage of every root MessageList draws (it must be non-empty for each kind).
const seen = { user: 0, chat: 0, thinkingStream: 0, workingPulse: 0, askCard: 0, outline: 0, combined: 0 }
let checkpoints = 0, rootsWithAttr = 0, rootsTotal = 0

// Split a pretty-printed chat markup into one string per message root (the harness prints one tag per line).
const roots = html => {
  const starts = [...html.matchAll(/<div[^>]* data-studio-director-message="(?:user|director)"/g)].map(m => m.index)
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length))
}
const classify = fragment => {
  if (/^<div[^>]* data-studio-director-message="user"/.test(fragment)) return 'user'
  if (/data-studio-director-part="preview-ready"/.test(fragment)) return 'combined'
  if (/data-studio-director-part="thinking"[^>]*role="status"|role="status"[^>]*data-studio-director-part="thinking"/.test(fragment)) return 'workingPulse'
  if (/data-studio-director-part="thinking"/.test(fragment)) return 'thinkingStream'
  if (/data-studio-director-part="body"/.test(fragment)) return 'chat'
  if (/data-studio-director-ask/.test(fragment)) return 'askCard'
  if (/outline-review/.test(fragment)) return 'outline'
  return 'other'
}

for (const fixture of fixtures) {
  for (const profile of Object.keys(PROFILES)) {
    const label = `${fixture.name}/${profile}`
    const run = async extra => {
      const result = await runTranscript({ root, fixture, profile, processEnv: { ...PROFILES[profile], ...extra }, includeMarkup: true })
      if (result.blockedNetwork.length) fail(`${label}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
      return result.files
    }
    let off, on, explicitOff
    try { off = await run({}); on = await run({ [FLAG]: 'true' }); explicitOff = await run({ [FLAG]: 'false' }) } catch (error) {
      fail(`${label}: the transcript could not be replayed (${String(error.message).split('\n')[0].slice(0, 200)})`)
      continue
    }

    // 1. flag off == base. Hash for hash against the committed baselines, and unset == "false" == the base run.
    const baseline = readSnapshot(path.join(root, 'scripts/fixtures/director-chat/baselines', fixture.name, profile))
    if (off['markup.json'] !== baseline['markup.json']) fail(`${label}: flag-off markup hashes differ from the base baselines`)
    for (const name of Object.keys(off)) if (name.startsWith('markup/') && baseline[name] !== undefined && off[name] !== baseline[name]) fail(`${label}: flag-off ${name} differs from the base baseline`)
    for (const name of Object.keys(off)) if (name !== 'env.json' && off[name] !== explicitOff[name]) fail(`${label}: ${FLAG}=false differs from unset in ${name}`)
    if (ANY_ATTR.test(Object.values(off).join('\n'))) fail(`${label}: flag off, but a data-studio-chat-polish attribute was rendered`)

    // 2. flag on: everything but markup (and the recorded env) is identical.
    for (const name of Object.keys(off)) {
      if (name.startsWith('markup/') || name === 'markup.json' || name === 'env.json') continue
      if (off[name] !== on[name]) fail(`${label}: flag on changes ${name} (outbound bytes / keys / calls / state / cache must not move)`)
    }
    if (Object.keys(off).length !== Object.keys(on).length || Object.keys(off).some(name => !(name in on))) fail(`${label}: flag on produces a different set of files`)

    // 3. flag on: markup differs only by the attribute.
    for (const name of Object.keys(off)) {
      if (!name.startsWith('markup/') || !name.endsWith('.chat.html')) continue
      checkpoints++
      const stripped = on[name].replace(ATTR, '')
      if (stripped !== off[name]) {
        const a = off[name].split('\n'), b = stripped.split('\n')
        const at = a.findIndex((line, i) => line !== b[i])
        fail(`${label} ${name}: flag-on markup differs from flag-off beyond the attribute, first at line ${at + 1}\n    off: ${a[at]?.slice(0, 160)}\n    on : ${b[at]?.slice(0, 160)}`)
      }
      const flagged = [...on[name].matchAll(ATTR)].length
      if (profile === 'classic') {
        if (flagged) fail(`${label} ${name}: the classic (non-Studio) chat must not get the attribute`)
        continue
      }
      const fragments = roots(on[name])
      rootsTotal += fragments.length
      for (const fragment of fragments) {
        const kind = classify(fragment)
        const first = fragment.split('\n')[0]
        const attribute = first.match(/ data-studio-chat-polish="(message|thinking)"/)?.[1]
        if (attribute) rootsWithAttr++
        else fail(`${label} ${name}: a ${kind} message root has no data-studio-chat-polish attribute: ${first.slice(0, 140)}`)
        if (kind in seen) seen[kind]++
        else fail(`${label} ${name}: unclassified message root ${first.slice(0, 140)}`)
        if (attribute === 'thinking' && kind !== 'workingPulse' && kind !== 'thinkingStream') fail(`${label} ${name}: "thinking" on a ${kind} root`)
        if (attribute === 'message' && (kind === 'workingPulse' || kind === 'thinkingStream')) fail(`${label} ${name}: a ${kind} root should be "thinking"`)
      }
      if (flagged !== fragments.length) fail(`${label} ${name}: ${flagged} attributes for ${fragments.length} message roots`)
    }
  }
}

// 4. coverage of the root kinds
for (const [kind, count] of Object.entries(seen)) if (count === 0) fail(`no ${kind} message root was exercised flag-on; add a transcript step that draws one`)

// 5. the stylesheet cannot match without the attribute
const css = fs.readFileSync(path.join(root, 'components/builder/studio-chat-polish.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const splitTop = (text, separator) => { // split on a separator outside (), [], quotes
  const parts = []; let depth = 0, quote = null, last = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue }
    if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === separator && depth === 0) { parts.push(text.slice(last, i)); last = i + 1 }
  }
  parts.push(text.slice(last)); return parts
}
const rules = []
const readBlock = (text, into) => {
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i); if (open === -1) break
    let depth = 1, j = open + 1, quote = null
    for (; j < text.length && depth; j++) {
      const c = text[j]
      if (quote) { if (c === quote && text[j - 1] !== '\\') quote = null; continue }
      if (c === '"' || c === "'") quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
    }
    const head = text.slice(i, open).trim(), body = text.slice(open + 1, j - 1)
    if (head.startsWith('@media') || head.startsWith('@supports')) readBlock(body, into)
    else if (head.startsWith('@')) fail(`studio-chat-polish.css: unexpected at-rule "${head}" (keyframes or font faces are global; key them to the flag instead)`)
    else into.push({ head, body })
    i = j
  }
}
readBlock(css, rules)
if (rules.length < 10) fail(`studio-chat-polish.css: only ${rules.length} rules parsed; the parser or the file changed`)
for (const rule of rules) {
  for (const selector of splitTop(rule.head, ',')) {
    if (!/^\s*\[data-studio-v4-shell="true"\]\s+\[data-studio-chat-polish/.test(selector)) fail(`studio-chat-polish.css: selector is not scoped to the Studio shell and [data-studio-chat-polish]: ${selector.trim().slice(0, 120)}`)
  }
}

release()
if (failures.length) {
  console.error(`FAIL studio chat polish (${failures.length}):\n` + failures.slice(0, 40).map(line => `  - ${line}`).join('\n') + (failures.length > 40 ? `\n  ... ${failures.length - 40} more` : ''))
  process.exit(1)
}
console.log(`PASS studio chat polish: ${fixtures.length} transcripts x ${Object.keys(PROFILES).length} profiles, ${checkpoints} chat checkpoints.`)
console.log(`  flag off == base (markup hashes and files), ${FLAG}=false == unset`)
console.log(`  flag on: outbound bytes, keys, calls, state and cache identical; markup differs only by data-studio-chat-polish on ${rootsWithAttr}/${rootsTotal} Studio message roots (none in classic)`)
console.log(`  root kinds exercised flag-on: ${Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`  studio-chat-polish.css: ${rules.length} rules, all keyed to [data-studio-chat-polish]`)
