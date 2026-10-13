// PASS2-DIRECTOR-CHAT PR D: NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT (item 6), NEXT_PUBLIC_STUDIO_CHAT_RECOVERY (item 7) and
// NEXT_PUBLIC_STUDIO_CHAT_ANSWERED_CHOICE (item 8) are presentation only.
//
// Replays the seven Director transcripts of the chat harness (scripts/studio-chat-harness/README.md; the composer-send transcript renders the REAL
// composer) through the REAL WebSocket hook, MessageList, QuestionCard, ChatInput, header/notice and page handlers, flag off and flag on, in two
// environments (the profile default, and the UAT-like one with the ask-card identity and history-status flags, where an answered question card
// exists), and proves, per flag:
//   1. flag off: the rendered markup equals the committed baselines (recorded from the base commit), file for file, and FLAG=false equals unset;
//      no marker attribute of the flag is rendered;
//   2. flag on: outbound socket bytes, React keys, hook ids, handler calls (the composer's included), hook state, the session cache and the
//      composer's control list are byte-identical to flag off, at every checkpoint of every transcript and profile;
//   3. flag on: the markup differs ONLY by what the flag adds (strip exactly that and it equals flag off, byte for byte), and nothing else moves;
//   4. flag on: the flag draws what it should, exactly where it should (the pinned tables below), and nothing in the classic (non-Studio) chat;
//   5. all three flags together change nothing the three singly do not;
//   6. the pure helpers (composer line, recovery kind, chosen option) behave as specified, including every conservative refusal;
//   7. the recovery card cannot send, retry or reconnect: its component has no handler, hook or call (checked in source), and the helpers are import-free;
//   8. every rule of the three stylesheets is keyed to its flag's attribute, so flag off nothing can match.
//
//   node scripts/test-studio-chat-composer-recovery-answered.mjs
//
// Offline by construction (no socket, fetch or real timer): the harness installs the host network guard.
process.env.NODE_ENV = 'production'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAGS = {
  context: 'NEXT_PUBLIC_STUDIO_CHAT_COMPOSER_CONTEXT',
  recovery: 'NEXT_PUBLIC_STUDIO_CHAT_RECOVERY',
  answered: 'NEXT_PUBLIC_STUDIO_CHAT_ANSWERED_CHOICE',
}
const ENVS = {
  default: {},
  uat: { NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED: 'true', NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED: 'true' },
}
const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
const { readSnapshot } = await import('./studio-chat-harness/snapshot.mjs')

const failures = []
const fail = message => failures.push(message)
const fixturesDir = path.join(root, 'scripts/fixtures/director-chat')
const fixtures = fs.readdirSync(fixturesDir).filter(name => name.endsWith('.json')).sort().map(name => JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')))

// What each flag adds to the markup, and the exact inverse (applied to the flag-on markup it must give the flag-off markup back).
const CONTEXT_LINE = /<div data-studio-chat-context="true">\n<span aria-hidden="true" data-studio-chat-context-dot="true">\n<\/span>\n<span>[^<]*<\/span>\n<\/div>\n/g
const PILL_ATTR = / data-studio-chat-pill="(?:template|theme)"/g
const PILL_NAME = /<strong>([^<]*)<\/strong>\n(?=<\/span>)/g
const stripContext = html => html.replace(CONTEXT_LINE, '').replace(PILL_ATTR, '').replace(PILL_NAME, '$1')
const RECOVERY_CARD = /<div data-studio-chat-recovery="[a-z]+" role="note" aria-label="Director was interrupted">\n<svg data-icon="ShieldCheck" size="14" aria-hidden="true">\n<\/svg>\n<div>\n<p data-studio-chat-recovery-part="title">[^<]*<\/p>\n<p data-studio-chat-recovery-part="body">[^<]*<\/p>\n<\/div>\n<\/div>\n/g
const stripRecovery = html => html.replace(RECOVERY_CARD, '')
// The check icon is stripped only where the flag put it (inside an element marked chosen): a live question card draws the same icon on a selected chip.
const CHOSEN_CHECK = /(data-studio-chat-chosen="true"[^>]*>[^<]*)<svg data-icon="Check" class="h-3 w-3" aria-hidden="true">\n<\/svg>\n(?:<span class="sr-only"> \(your choice\)<\/span>\n)?/g
const stripAnswered = html => html.replace(CHOSEN_CHECK, '$1').replace(/ data-studio-chat-answered="true"/g, '').replace(/ data-studio-chat-chosen="true" aria-pressed="true"/g, '')
  .replace(/ data-studio-chat-chosen="true"/g, '')
const MARKERS = {
  context: /data-studio-chat-context|data-studio-chat-pill/,
  recovery: /data-studio-chat-recovery/,
  answered: /data-studio-chat-answered|data-studio-chat-chosen/,
}
// Which markup file kind each flag may change, and how to undo it.
const TOUCHES = { context: { suffix: '.composer.html', strip: stripContext }, recovery: { suffix: '.chat.html', strip: stripRecovery }, answered: { suffix: '.chat.html', strip: stripAnswered } }
const decode = text => text.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

// What the flags drew, collected flag-on (for the pinned tables in section 4).
const seen = {
  context: {},     // `${fixture}/${profile}` -> { checkpoint-number: line text | null }
  pills: {},       // `${fixture}/${profile}/${checkpoint}` -> ['template','theme']
  recovery: {},    // `${env}/${fixture}/${profile}` -> { checkpoint-number: kind }
  chosen: {},      // `${env}/${fixture}/${profile}` -> { checkpoint-number: [labels] }
}
const number = file => file.match(/markup\/(\d+)-/)?.[1]
let runs = 0

for (const [envName, extraEnv] of Object.entries(ENVS)) {
  for (const fixture of fixtures) {
    for (const profile of Object.keys(PROFILES)) {
      const label = `${envName}/${fixture.name}/${profile}`
      const run = async flags => {
        runs++
        const result = await runTranscript({ root, fixture, profile, processEnv: { ...PROFILES[profile], ...extraEnv, ...flags }, includeMarkup: true })
        if (result.blockedNetwork.length) fail(`${label}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
        return result.files
      }
      let off, explicitOff, all
      const on = {}
      try {
        off = await run({})
        for (const [key, name] of Object.entries(FLAGS)) on[key] = await run({ [name]: 'true' })
        if (envName === 'default') { explicitOff = await run(Object.fromEntries(Object.values(FLAGS).map(name => [name, 'false']))); all = await run(Object.fromEntries(Object.values(FLAGS).map(name => [name, 'true']))) }
      } catch (error) {
        fail(`${label}: the transcript could not be replayed (${String(error.message).split('\n')[0].slice(0, 220)})`)
        continue
      }
      const nonMarkup = Object.keys(off).filter(name => !name.startsWith('markup/') && name !== 'markup.json' && name !== 'env.json')

      // 1. flag off == base (default environment: the committed baselines), FLAG=false == unset, and no marker.
      if (envName === 'default') {
        const baseline = readSnapshot(path.join(fixturesDir, 'baselines', fixture.name, profile))
        for (const name of Object.keys(baseline)) if (name !== 'env.json' && baseline[name] !== off[name]) fail(`${label}: flag-off ${name} differs from the committed base baseline`)
        // (Full markup is recorded for the studio profile only; the other profiles keep hashes in markup.json, compared above.)
        for (const name of Object.keys(off)) if (!(name in baseline) && !name.startsWith('markup/')) fail(`${label}: flag-off produces ${name}, which the base baseline does not have`)
        for (const name of Object.keys(off)) if (name !== 'env.json' && off[name] !== explicitOff[name]) fail(`${label}: every flag =false differs from unset in ${name}`)
      }
      for (const [key, marker] of Object.entries(MARKERS)) if (marker.test(Object.values(off).join('\n'))) fail(`${label}: flag off, but a ${key} marker attribute was rendered`)

      // 2 + 3. flag on, each flag alone.
      for (const [key, files] of Object.entries(on)) {
        for (const name of nonMarkup) if (off[name] !== files[name]) fail(`${label} [${FLAGS[key]}]: flag on changes ${name} (bytes sent / keys / calls / state / cache / composer controls must not move)`)
        if (Object.keys(off).length !== Object.keys(files).length || Object.keys(off).some(name => !(name in files))) fail(`${label} [${FLAGS[key]}]: flag on produces a different set of files`)
        const { suffix, strip } = TOUCHES[key]
        for (const name of Object.keys(off)) {
          if (!name.startsWith('markup/')) continue
          if (name.endsWith(suffix)) {
            const stripped = strip(files[name])
            if (stripped !== off[name]) {
              const a = off[name].split('\n'), b = stripped.split('\n')
              const at = a.findIndex((line, i) => line !== b[i])
              fail(`${label} [${FLAGS[key]}] ${name}: flag-on markup differs from flag-off beyond what the flag adds, first at line ${at + 1}\n    off: ${a[at]?.slice(0, 170)}\n    on : ${b[at]?.slice(0, 170)}`)
            }
          } else if (files[name] !== off[name]) fail(`${label} [${FLAGS[key]}] ${name}: this flag must not change ${name.split('.').slice(-2).join('.')}`)
        }
        // Only its own marker, only in Studio.
        for (const [other, marker] of Object.entries(MARKERS)) {
          const text = Object.values(files).join('\n')
          if (other !== key && marker.test(text)) fail(`${label} [${FLAGS[key]}]: rendered a ${other} marker`)
          if (other === key && profile === 'classic' && marker.test(text)) fail(`${label} [${FLAGS[key]}]: the classic (non-Studio) chat must not get ${other} markers`)
        }
      }

      // 5. all three together.
      if (all) {
        for (const name of nonMarkup) if (off[name] !== all[name]) fail(`${label} [all three flags]: changes ${name}`)
        for (const name of Object.keys(off)) {
          if (!name.startsWith('markup/')) continue
          const stripped = name.endsWith('.composer.html') ? stripContext(all[name]) : name.endsWith('.chat.html') ? stripAnswered(stripRecovery(all[name])) : all[name]
          if (stripped !== off[name]) fail(`${label} [all three flags] ${name}: differs from flag off beyond what the flags add`)
        }
      }

      // Collect what each flag drew (flag on), for the pinned tables.
      for (const name of Object.keys(on.context)) {
        if (!name.startsWith('markup/') || !name.endsWith('.composer.html')) continue
        const line = on.context[name].match(/<div data-studio-chat-context="true">\n<span[^>]*>\n<\/span>\n<span>([^<]*)<\/span>/)?.[1] ?? null
        ;(seen.context[`${fixture.name}/${profile}`] ??= {})[number(name)] = line
        const pills = [...on.context[name].matchAll(/data-studio-chat-pill="(template|theme)"/g)].map(m => m[1])
        if (pills.length) seen.pills[`${fixture.name}/${profile}/${number(name)}`] = pills
      }
      for (const name of Object.keys(on.recovery)) {
        if (!name.startsWith('markup/') || !name.endsWith('.chat.html')) continue
        const kinds = [...on.recovery[name].matchAll(/data-studio-chat-recovery="([a-z]+)"/g)].map(m => m[1])
        if (kinds.length > 1) fail(`${label} ${name}: ${kinds.length} recovery cards at once`)
        if (kinds.length) (seen.recovery[label] ??= {})[number(name)] = kinds[0]
      }
      for (const name of Object.keys(on.answered)) {
        if (!name.startsWith('markup/') || !name.endsWith('.chat.html')) continue
        const chosen = [...on.answered[name].matchAll(/data-studio-chat-chosen="true"[^>]*>([^<]*)(?:<svg|<\/li)/g)].map(m => decode(m[1]))
        if (chosen.length) (seen.chosen[label] ??= {})[number(name)] = chosen
      }
    }
  }
}

// 4. what each flag draws, pinned. A flag that drew nothing, drew it somewhere else, or drew it in the classic chat fails here.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
for (const profile of ['studio', 'studio-plain']) {
  const line = seen.context[`composer-send/${profile}`] ?? {}
  const expected = { '01': 'New presentation', '02': 'New presentation', '03': 'New presentation', '04': 'Working on slide 1', '05': 'Working on slide 3', '06': 'Working on slide 3', '07': 'Working on slide 3', '08': 'Working on slide 3', '09': 'Working on slide 3', '10': 'Working on slide 3', '11': 'Working on slide 3' }
  if (profile === 'studio' && !same(line, expected)) fail(`composer context line per checkpoint of composer-send/studio: got ${JSON.stringify(line)}`)
}
for (const profile of ['studio-plain']) if (!same(seen.context[`composer-send/${profile}`], undefined)) { /* markup is only recorded for the studio profile */ }
if (!same(seen.pills['composer-send/studio/06'], ['template', 'theme'])) fail(`the template and theme pills were not both marked at checkpoint 06: ${JSON.stringify(seen.pills['composer-send/studio/06'])}`)
if (Object.keys(seen.pills).some(key => key.includes('/classic/'))) fail('the classic composer got pill markers')

const RECOVERY_EXPECTED = {   // both Studio-shell profiles (studio, studio-plain); the classic chat never gets a card
  'error-retry': { '02': 'error', '03': 'error', '04': 'resend', '05': 'resend' },
  'reconnect-mid-build': { '06': 'offline' },
  'reconnect-exhausted': { '03': 'lost', '04': 'lost', '05': 'lost' },
}
for (const envName of Object.keys(ENVS)) for (const profile of ['studio', 'studio-plain']) for (const [fixtureName, expected] of Object.entries(RECOVERY_EXPECTED)) {
  const key = `${envName}/${fixtureName}/${profile}`
  if (!same(seen.recovery[key] ?? {}, expected)) fail(`recovery cards of ${key}: got ${JSON.stringify(seen.recovery[key] ?? {})}, wanted ${JSON.stringify(expected)}`)
}
for (const key of Object.keys(seen.recovery)) {
  const [, fixtureName, profile] = key.split('/')
  if (profile === 'classic' || !(fixtureName in RECOVERY_EXPECTED)) fail(`a recovery card was drawn where none is expected: ${key} ${JSON.stringify(seen.recovery[key])}`)
}

const labelsOf = (key, from, to) => Object.entries(seen.chosen[key] ?? {}).filter(([n]) => n >= from && n <= to).flatMap(([, labels]) => labels)
const CHOSEN_EXPECTED = {
  'default/normal-build/studio': { '05': ["Yes, let's build it!"], '07': ["Yes, let's build it!", 'Looks perfect!'], '09': ["Yes, let's build it!", 'Looks perfect!', 'Done, looks great!'] },
  'default/ask-card-flow/studio': { '06': ["I'd like to make changes"] },
  'default/reconnect-mid-build/studio': { '01': ["Yes, let's build it!"], '08': ['Looks perfect!'] },
  // the UAT-like environment: an answered question card names the suggestions the user picked, never a typed answer
  'uat/ask-card-flow/studio': { '04': ['General public', '10 minutes'], '06': ['General public', '10 minutes', "I'd like to make changes"] },
  'uat/history-reload/studio': { '01': ['Done, looks great!'], '05': ['Done, looks great!'] },
}
for (const [key, pinned] of Object.entries(CHOSEN_EXPECTED)) for (const [n, labels] of Object.entries(pinned)) {
  if (!same(seen.chosen[key]?.[n], labels)) fail(`chosen options of ${key} checkpoint ${n}: got ${JSON.stringify(seen.chosen[key]?.[n])}, wanted ${JSON.stringify(labels)}`)
}
for (const key of Object.keys(seen.chosen)) if (key.endsWith('/classic')) fail(`chosen markers rendered in ${key}`)
if (!labelsOf('uat/ask-card-flow/studio', '04', '10').every(label => label !== 'Mostly plain language with one chart')) fail('a typed (free-text) answer was marked as a chosen suggestion')

// 6. the pure helpers, loaded through the same TypeScript transpile the repo uses.
const load = rel => {
  const source = fs.readFileSync(path.join(root, rel), 'utf8')
  if (/^\s*import\s/m.test(source)) fail(`${rel} must stay import-free (it is transpiled in a bare sandbox by tests and read by the page)`)
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(out, { module, exports: module.exports })
  return module.exports
}
const ctxLib = load('lib/studio-chat-composer-context.ts')
const recLib = load('lib/studio-chat-recovery.ts')
const choiceLib = load('lib/studio-chat-answered-choice.ts')
const eq = (label, got, wanted) => { if (!same(got, wanted)) fail(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(wanted)}`) }

eq('context: no deck', ctxLib.studioComposerContextLabel({ deckOpen: false, slideNumber: 4, slideCount: 8 }), 'New presentation')
eq('context: slide 3 of 8', ctxLib.studioComposerContextLabel({ deckOpen: true, slideNumber: 3, slideCount: 8 }), 'Working on slide 3')
eq('context: count unknown', ctxLib.studioComposerContextLabel({ deckOpen: true, slideNumber: 3, slideCount: null }), 'Working on slide 3')
eq('context: slide past the end', ctxLib.studioComposerContextLabel({ deckOpen: true, slideNumber: 9, slideCount: 8 }), 'Working on your presentation')
eq('context: slide 0 / NaN', [0, NaN, -1, 2.5].map(slideNumber => ctxLib.studioComposerContextLabel({ deckOpen: true, slideNumber, slideCount: 8 })), Array(4).fill('Working on your presentation'))

const idle = { noticeType: null, noticeRequiresResend: false, reconnectStatus: 'idle', statusError: false }
const kind = patch => recLib.studioChatRecoveryKind({ ...idle, ...patch })
eq('recovery: nothing wrong', kind({}), null)
eq('recovery: a retry is scheduled is not an alarm', kind({ reconnectStatus: 'scheduled' }), null)
eq('recovery: a refreshed connection is quiet', kind({ noticeType: 'auth_refreshed' }), null)
eq('recovery: manual disconnect shows nothing', kind({ reconnectStatus: 'manual' }), null)
eq('recovery: status error', kind({ statusError: true }), 'error')
eq('recovery: transport error', kind({ noticeType: 'error' }), 'error')
eq('recovery: offline', kind({ reconnectStatus: 'paused_offline' }), 'offline')
eq('recovery: retries used up', kind({ reconnectStatus: 'exhausted' }), 'lost')
eq('recovery: refresh failed', kind({ noticeType: 'auth_refresh_failed' }), 'lost')
eq('recovery: auth expired', kind({ noticeType: 'auth_expired' }), 'resend')
eq('recovery: discarded input on any notice', kind({ noticeType: 'auth_refreshed', noticeRequiresResend: true }), 'resend')
eq('recovery: a discarded message outranks offline', kind({ noticeType: 'auth_expired', reconnectStatus: 'paused_offline', statusError: true }), 'resend')
eq('recovery: offline outranks exhausted and error', kind({ reconnectStatus: 'paused_offline', statusError: true }), 'offline')
eq('recovery: exhausted outranks error', kind({ reconnectStatus: 'exhausted', statusError: true }), 'lost')
eq('recovery: no input, no card', recLib.studioChatRecoveryCard(undefined), null)
for (const k of ['resend', 'offline', 'lost', 'error']) {
  const card = recLib.studioChatRecoveryCard({ ...idle, ...({ resend: { noticeType: 'auth_expired' }, offline: { reconnectStatus: 'paused_offline' }, lost: { reconnectStatus: 'exhausted' }, error: { statusError: true } })[k] })
  if (!card || card.kind !== k || !card.title || !/Your slides are safe\./.test(card.body)) fail(`recovery card ${k}: ${JSON.stringify(card)}`)
  if (/retr(y|ied)\b.*automatic|reconnected for you|we (re)?sent/i.test(card.title + card.body)) fail(`recovery card ${k} claims something Director did not do`)
}

const ask = {
  payload: {
    actions: [{ label: "Yes, let's build it!" }, { label: "I'd like to make changes" }, { label: 'Yes' }],
    question_set: { questions: [
      { id: 'a', suggestions: [{ label: 'General public' }, { label: 'Yes' }, { label: 'No' }] },
      { id: 'b', suggestions: [{ label: '10 minutes' }, { label: '15 minutes' }, { label: 'No' }] },
    ] },
  },
}
const user = text => ({ messageType: 'user', text })
const bot = type => ({ messageType: 'bot', type })
const choose = (items, index = 0) => choiceLib.findAnsweredChoice(items, index, ask)
eq('choice: a button click echoed as its label', choose([bot('action_request'), user("Yes, let's build it!")]), { actionIndex: 0, suggestions: [] })
eq('choice: the label is trimmed', choose([bot('action_request'), user("  I'd like to make changes \n")]), { actionIndex: 1, suggestions: [] })
eq('choice: other Director frames in between are skipped', choose([bot('action_request'), bot('chat_message'), bot('status_update'), user("Yes, let's build it!")]), { actionIndex: 0, suggestions: [] })
eq('choice: the next user turn only', choose([bot('action_request'), user('Something else'), user("Yes, let's build it!")]), null)
eq('choice: a typed reply names nothing', choose([bot('action_request'), user('Make it blue')]), null)
eq('choice: no reply yet', choose([bot('action_request'), bot('chat_message')]), null)
eq('choice: another ask in between', choose([bot('action_request'), bot('action_request'), user("Yes, let's build it!")]), null)
eq('choice: a combined outline ask in between', choose([bot('action_request'), { messageType: 'bot', type: 'combined_strawman', actionRequest: {} }, user("Yes, let's build it!")]), null)
eq('choice: a combined outline WITHOUT an ask is not an ask', choose([bot('action_request'), { messageType: 'bot', type: 'combined_strawman' }, user("Yes, let's build it!")]), { actionIndex: 0, suggestions: [] })
eq('choice: a repeated label is ambiguous, so unmarked', choiceLib.choiceFromReply('Yes', { payload: { actions: [{ label: 'Yes' }, { label: 'Yes' }] } }), null)
eq('choice: answers, unique labels', choose([bot('action_request'), user('Answers: General public · 10 minutes')]), { actionIndex: null, suggestions: ['a\u0000General public', 'b\u000010 minutes'] })
eq('choice: a free-text part is ignored, the rest kept', choose([bot('action_request'), user('Answers: Anyone who will listen · 15 minutes')]), { actionIndex: null, suggestions: ['b\u000015 minutes'] })
eq('choice: a label two questions offer is not placed', choose([bot('action_request'), user('Answers: No · 10 minutes')]), { actionIndex: null, suggestions: ['b\u000010 minutes'] })
eq('choice: only free text', choose([bot('action_request'), user('Answers: Anyone who will listen')]), null)
eq('choice: without the "Answers: " prefix it is not an answer set', choose([bot('action_request'), user('General public · 10 minutes')]), null)
eq('choice: an ask with no options', choiceLib.findAnsweredChoice([bot('action_request'), user('Yes')], 0, { payload: {} }), null)

// 7. the recovery card cannot send, retry or reconnect.
const cardSource = fs.readFileSync(path.join(root, 'components/builder/chat/studio-recovery-card.tsx'), 'utf8')
const code = cardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
if (/\bon[A-Z]\w*\s*=|<button\b|<a\b|<input\b|<form\b|\buse[A-Z]\w*\s*\(|\bfetch\s*\(|\bsend\w*\s*\(|\bconnect\w*\s*\(|\bretry\w*\s*\(|window\.|document\./i.test(code)) fail('studio-recovery-card.tsx has a handler, hook, control or call; the card must be words only')
if ((code.match(/^import .*$/gm) ?? []).some(line => !/from "lucide-react"|from "@\/lib\/studio-chat-recovery"|^import "\.\/studio-recovery-card\.css"/.test(line))) fail('studio-recovery-card.tsx imports something other than its icon, its words and its stylesheet')

// 8. every stylesheet rule is keyed to its flag's attribute.
const splitTop = (text, separator) => {
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
const selectors = css => {
  const out = []
  const read = text => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open === -1) break
      let depth = 1, j = open + 1
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++ }
      const head = text.slice(i, open).trim(), body = text.slice(open + 1, j - 1)
      if (head.startsWith('@')) read(body); else out.push(...splitTop(head, ',').map(s => s.trim()).filter(Boolean))
      i = j
    }
  }
  read(css.replace(/\/\*[\s\S]*?\*\//g, ''))
  return out
}
const SHEETS = {
  'components/builder/studio-chat-composer.css': /\[data-studio-chat-(?:context|pill)/,
  'components/builder/chat/studio-recovery-card.css': /\[data-studio-chat-recovery/,
  'components/builder/studio-chat-answered.css': /\[data-studio-chat-(?:answered|chosen)/,
}
for (const [file, key] of Object.entries(SHEETS)) {
  const list = selectors(fs.readFileSync(path.join(root, file), 'utf8'))
  if (!list.length) fail(`${file}: no rules found`)
  for (const selector of list) if (!key.test(selector)) fail(`${file}: a rule that is not keyed to the flag's attribute would match with the flag off: ${selector}`)
}

release()
if (failures.length) {
  console.error(failures.map(line => `FAIL ${line}`).join('\n'))
  console.error(`\nPR D chat flags: ${failures.length} failure(s) over ${runs} transcript runs.`)
  process.exit(1)
}
console.log(`PR D chat flags: all checks passed (${runs} transcript runs: ${fixtures.length} transcripts x ${Object.keys(PROFILES).length} profiles x ${Object.keys(ENVS).length} environments, flag off / on per flag / all three). Flag off equals the base baselines; flag on moves nothing but what each flag adds.`)
