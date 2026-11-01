// PASS2-DIRECTOR-CHAT PR C: NEXT_PUBLIC_STUDIO_CHAT_HEADER and NEXT_PUBLIC_STUDIO_CHAT_ASK change WORDS only.
//
//   NEXT_PUBLIC_STUDIO_CHAT_HEADER  the Director header's connection line ("Connected", "Reconnecting…", "Offline, will retry",
//                                   "Couldn't reconnect") chosen from the connection state and reconnect status the hook already reports
//   NEXT_PUBLIC_STUDIO_CHAT_ASK     the plan gate's card is headed "Approval needed" instead of "Your input"
//
// Replays the five Director transcripts of the chat harness (scripts/studio-chat-harness/README.md) through the REAL WebSocket hook,
// MessageList, QuestionCard, the Studio header and the real page handlers, under five environments (unset, "false", header only, ask
// only, both), and proves:
//   1. flag off: the rendered chat and header markup equal the committed base baselines, hash for hash; "false" equals unset;
//   2. flag on (any combination): outbound socket bytes, React keys, hook ids, handler calls, hook state and the sessionStorage cache are
//      byte-identical to flag off at every checkpoint of every transcript and profile;
//   3. header flag: the chat markup is untouched; the header differs only by two data attributes and the words, and the words equal an
//      independent table of (connection state x reconnect status) at every checkpoint the real hook reached;
//   4. ask flag: the header is untouched; the chat markup differs only in the heading words and icon of plan-gate cards (an action_request
//      carrying accept_plan), and never in an outline gate, a questions card, another choice or a historical card;
//   5. the same two facts at unit level over every combination (header: 4 states x 6 reconnect statuses x loading x flag; card: studio x
//      structured x action sets x flag), plus the page wiring, the untouched handler lines and the stylesheet scoping.
//
//   node scripts/test-studio-chat-header-ask.mjs                    # quick: all of the above
//   node scripts/test-studio-chat-header-ask.mjs --mutation-check   # also: break the code in ten ways in a scratch copy, each must be caught
//
// Offline by construction (no socket, fetch or real timer): the harness installs the host network guard.
process.env.NODE_ENV = 'production'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import vm from 'node:vm'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HEADER = 'NEXT_PUBLIC_STUDIO_CHAT_HEADER'
const ASK = 'NEXT_PUBLIC_STUDIO_CHAT_ASK'
const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
const { readSnapshot } = await import('./studio-chat-harness/snapshot.mjs')

const fixtures = fs.readdirSync(path.join(repoRoot, 'scripts/fixtures/director-chat')).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts/fixtures/director-chat', name), 'utf8')))

// ---------------------------------------------------------------------------------------------------------------------------------
// The words, written out as a table (not computed): [tone, text] by connection state, then reconnect status. Any status the table does
// not list for a state is not a state the hook produces together with it, and is not asserted.
const SCHEDULED = ['reconnecting', 'Reconnecting…'], OFFLINE = ['offline', 'Offline, will retry'], FAILED = ['failed', "Couldn't reconnect"]
const ORACLE = {
  connected: { idle: ['ready', 'Connected'], scheduled: ['ready', 'Connected'], paused_offline: ['ready', 'Connected'], exhausted: ['ready', 'Connected'], manual: ['ready', 'Connected'] },
  connecting: { idle: ['connecting', 'Connecting…'], scheduled: SCHEDULED, paused_offline: OFFLINE, exhausted: FAILED, manual: ['connecting', 'Connecting…'] },
  disconnected: { idle: ['disconnected', 'Disconnected'], scheduled: SCHEDULED, paused_offline: OFFLINE, exhausted: FAILED, manual: ['disconnected', 'Disconnected'] },
  error: { idle: ['error', 'Connection error'], scheduled: SCHEDULED, paused_offline: OFFLINE, exhausted: FAILED, manual: ['error', 'Connection error'] },
}
const LEGACY = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected', error: 'Connection error' } // the words before this PR
const STATUSES = ['idle', 'scheduled', 'paused_offline', 'exhausted', 'manual']

// ---------------------------------------------------------------------------------------------------------------------------------
// Unit loader: one TypeScript file from `root`, evaluated with explicit imports and a plain `process.env`.
import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): a registered later change's marked lines come out of a source before it is read
function loadModule(root, relative, env, imports) {
  const source = stripLaterChanges(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const errors = (compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${relative}: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, process: { env }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    require: name => { if (!(name in imports)) throw new Error(`${relative}: unexpected import "${name}"`); return imports[name] },
  })
  return mod.exports
}
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || value === false ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const nodesOf = value => Array.isArray(value) ? value.flatMap(nodesOf) : !value || typeof value !== 'object' ? [] : [value, ...nodesOf(value.props?.children)]
const comparable = tree => JSON.stringify(tree, (key, value) => typeof value === 'function' ? '[fn]' : value)

// ---------------------------------------------------------------------------------------------------------------------------------
async function checks(root) {
  const failures = []
  const fail = message => failures.push(message)
  const stats = { checkpoints: 0, headerStates: new Map(), planGateCards: 0, unitHeader: 0, unitCard: 0 }
  const read = relative => stripLaterChanges(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)

  // ---- A. the five transcripts, five environments --------------------------------------------------------------------------
  // message id -> does any frame/row carrying that id offer accept_plan (so an expected change is tied to the real gate, not to a label)
  const gateIds = new Set()
  const scan = value => {
    if (Array.isArray(value)) return value.forEach(scan)
    if (!value || typeof value !== 'object') return
    const id = value.message_id ?? value.id
    const payload = value.payload ?? value
    if (typeof id === 'string' && Array.isArray(payload?.actions) && payload.actions.some(action => action?.value === 'accept_plan')) gateIds.add(id)
    Object.values(value).forEach(scan)
  }
  fixtures.forEach(scan)
  if (gateIds.size === 0) fail('no transcript carries an accept_plan gate; the ask flag would be tested against nothing')

  const ATTR = / data-studio-chat-(?:header|header-state|ask)="[^"]*"/g
  const split = chrome => { const at = chrome.indexOf('<!-- StudioDirectorNotice -->'); return [chrome.slice(0, at), chrome.slice(at)] }
  // React escapes text content (e.g. ' -> &#x27;), so decode before comparing with the plain-text oracle
  const unescapeHtml = text => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const headerTexts = html => [...html.matchAll(/<span role="status"[^>]*>([^<]*)<\/span>/g)].map(match => match[1])
  const cardsOf = html => { // one string per ask card, from its root to the next card
    const starts = [...html.matchAll(/ data-director-action-id="([^"]*)"/g)].map(match => ({ id: match[1], at: match.index }))
    return starts.map((entry, i) => ({ id: entry.id, from: entry.at, to: starts[i + 1]?.at ?? html.length }))
  }
  // the heading row of a QuestionCard: <div heading><svg data-icon=Name ...></svg><span ...>words</span>, with or without the harness's line breaks
  const HEADING = /(<div data-studio-director-part="heading"[^>]*>\s*)<svg data-icon="([A-Za-z0-9]+)"([^>]*)>(\s*)<\/svg>(\s*<span[^>]*>)([^<]*)(<\/span>)/

  for (const fixture of fixtures) {
    for (const profile of Object.keys(PROFILES)) {
      const label = `${fixture.name}/${profile}`
      const run = async extra => {
        const result = await runTranscript({ root, fixture, profile, processEnv: { ...PROFILES[profile], ...extra }, includeMarkup: true })
        if (result.blockedNetwork.length) fail(`${label}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
        return result.files
      }
      let off, explicitOff, hdr, ask, both
      try {
        off = await run({}); explicitOff = await run({ [HEADER]: 'false', [ASK]: 'false' })
        hdr = await run({ [HEADER]: 'true' }); ask = await run({ [ASK]: 'true' }); both = await run({ [HEADER]: 'true', [ASK]: 'true' })
      } catch (error) { fail(`${label}: the transcript could not be replayed (${String(error.message).split('\n')[0].slice(0, 200)})`); continue }

      // 1. flag off == base, hash for hash; "false" == unset
      const baseline = readSnapshot(path.join(repoRoot, 'scripts/fixtures/director-chat/baselines', fixture.name, profile))
      if (off['markup.json'] !== baseline['markup.json']) fail(`${label}: flag-off markup hashes differ from the committed base baselines`)
      for (const name of Object.keys(off)) if (name.startsWith('markup/') && baseline[name] !== undefined && off[name] !== baseline[name]) fail(`${label}: flag-off ${name} differs from the base baseline`)
      for (const name of Object.keys(off)) if (name !== 'env.json' && off[name] !== explicitOff[name]) fail(`${label}: ${HEADER}/${ASK}="false" differs from unset in ${name}`)
      if (/data-studio-chat-(?:header|ask)|Reconnecting…|Offline, will retry|Couldn't reconnect|Approval needed/.test(Object.values(off).join('\n'))) fail(`${label}: flag off, but new-flag markup or words were rendered`)

      // 2. flag on: everything but markup (and the recorded env) is identical to flag off, in every combination
      for (const [name, files] of [['header', hdr], ['ask', ask], ['both', both]]) {
        for (const file of Object.keys(off)) {
          if (file.startsWith('markup/') || file === 'markup.json' || file === 'env.json') continue
          if (off[file] !== files[file]) fail(`${label}: ${name} flag on changes ${file} (outbound bytes / keys / calls / state / cache must not move)`)
        }
        if (Object.keys(off).length !== Object.keys(files).length || Object.keys(off).some(file => !(file in files))) fail(`${label}: ${name} flag on produces a different set of files`)
      }

      // 3. header flag: chat untouched; header differs by two attributes and the words; the words follow the table
      const state = JSON.parse(off['state.json']).checkpoints
      for (const file of Object.keys(off)) {
        if (!file.startsWith('markup/')) continue
        if (file.endsWith('.chat.html')) {
          stats.checkpoints += profile === 'studio' ? 1 : 0
          if (hdr[file] !== off[file]) fail(`${label} ${file}: the header flag changed the chat markup`)
          if (ask[file] !== both[file]) fail(`${label} ${file}: the header flag changed the ask-flag chat markup`)
          if (hdr[file.replace('.chat.html', '.chrome.html')] === undefined) fail(`${label}: missing chrome for ${file}`)
        }
        if (!file.endsWith('.chrome.html')) continue
        const [offHeader, offNotice] = split(off[file]); const [hdrHeader, hdrNotice] = split(hdr[file])
        if (hdrNotice !== offNotice) fail(`${label} ${file}: the header flag changed the notice`)
        if (ask[file] !== off[file]) fail(`${label} ${file}: the ask flag changed the header or notice`)
        if (both[file] !== hdr[file]) fail(`${label} ${file}: the ask flag changed the header-flag chrome`)
        if (profile === 'classic') { if (hdr[file] !== off[file]) fail(`${label} ${file}: the classic (non-Studio) chrome must not change`); continue }
        const checkpoint = state.find(entry => file.includes(entry.checkpoint))
        const [offText] = headerTexts(offHeader), [hdrText] = headerTexts(hdrHeader)
        const loading = offText === 'Loading conversation…'
        const [tone, words] = loading ? ['loading', 'Loading conversation…'] : (ORACLE[checkpoint.connection.state] || {})[checkpoint.connection.reconnectStatus] || []
        if (!words) { fail(`${label} ${file}: no oracle row for ${checkpoint.connection.state} / ${checkpoint.connection.reconnectStatus}`); continue }
        stats.headerStates.set(`${checkpoint.connection.state}/${checkpoint.connection.reconnectStatus}`, words)
        if (unescapeHtml(hdrText) !== words) fail(`${label} ${file}: header says "${hdrText}", the table says "${words}" for ${checkpoint.connection.state} / ${checkpoint.connection.reconnectStatus}`)
        const stateAttr = hdrHeader.match(/ data-studio-chat-header-state="([^"]*)"/)?.[1]
        if (stateAttr !== tone) fail(`${label} ${file}: data-studio-chat-header-state is "${stateAttr}", the table says "${tone}"`)
        if (!/<header data-studio-director-header="true" role="group" aria-label="Director conversation" data-studio-chat-header="true">/.test(hdrHeader)) fail(`${label} ${file}: the header root lacks data-studio-chat-header`)
        const reverted = hdrHeader.replace(ATTR, '').replace(`>${hdrText}</span>`, `>${offText}</span>`)
        if (reverted !== offHeader) fail(`${label} ${file}: the header differs from flag off by more than two data attributes and the words`)
        if (!loading && offText !== LEGACY[checkpoint.connection.state]) fail(`${label} ${file}: flag-off header says "${offText}", the base said "${LEGACY[checkpoint.connection.state]}"`)
      }

      // 4. ask flag: only plan-gate card headings (words + icon) differ in the chat markup
      for (const file of Object.keys(off)) {
        if (!file.startsWith('markup/') || !file.endsWith('.chat.html')) continue
        let html = ask[file]
        let reverts = 0
        const cards = cardsOf(html)
        for (const card of cards.reverse()) { // from the end, so earlier offsets stay valid
          const segment = html.slice(card.from, card.to)
          const heading = segment.match(HEADING)
          if (!heading || heading[6] !== 'Approval needed') continue
          if (!gateIds.has(card.id)) { fail(`${label} ${file}: "Approval needed" on card ${card.id}, which does not carry accept_plan`); continue }
          if (heading[2] !== 'CheckCircle2') fail(`${label} ${file}: the plan-gate heading icon is ${heading[2]}, expected CheckCircle2`)
          const original = segment.replace(HEADING, `$1<svg data-icon="HelpCircle"$3>$4</svg>$5Your input$7`)
          html = html.slice(0, card.from) + original + html.slice(card.to); reverts++
        }
        stats.planGateCards += reverts
        if (html !== off[file]) {
          const a = off[file].split('\n'), b = html.split('\n'); const at = a.findIndex((line, i) => line !== b[i])
          fail(`${label} ${file}: the ask flag changed the chat markup beyond plan-gate headings, first at line ${at + 1}\n    off: ${a[at]?.slice(0, 150)}\n    on : ${b[at]?.slice(0, 150)}`)
        }
        if (profile === 'classic' && ask[file] !== off[file]) fail(`${label} ${file}: the classic (non-Studio) chat must not change`)
      }
    }
  }
  if (stats.planGateCards === 0) fail('the ask flag changed no plan-gate card in any transcript; the replay would not notice it breaking')
  for (const wanted of ['connected/idle', 'disconnected/scheduled', 'connecting/idle', 'disconnected/paused_offline']) {
    if (![...stats.headerStates.keys()].some(key => key === wanted)) fail(`no transcript checkpoint reached ${wanted}; the header words were not exercised in that state`)
  }

  // ---- B. the header, every combination -----------------------------------------------------------------------------------
  const jsx = (type, props, key) => ({ type, props, key })
  const headerImports = { 'lucide-react': { Sparkles: 'Sparkles' }, 'react/jsx-runtime': { jsx, jsxs: jsx }, './studio-director-header.css': {} }
  const headerFor = (flag, shell) => loadModule(root, 'components/builder/chat/studio-director-header.tsx', { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, ...(flag === undefined ? {} : { [HEADER]: flag }) }, headerImports).StudioDirectorHeader
  for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) {
    const Header = headerFor(flag, 'true')
    for (const connectionState of Object.keys(ORACLE)) {
      for (const loading of [false, true]) {
        const plain = comparable(Header({ connectionState, isLoadingSession: loading, actions: 'ACTIONS' }))
        for (const reconnectStatus of [undefined, ...STATUSES]) {
          const tree = Header({ connectionState, isLoadingSession: loading, reconnectStatus, actions: 'ACTIONS' })
          const status = nodesOf(tree).find(node => node.props?.role === 'status')
          const text = textOf(status), attrs = status.props, rootAttrs = tree.props
          stats.unitHeader++
          if (flag !== 'true') {
            if (comparable(tree) !== plain) fail(`header unit: flag ${flag}: reconnectStatus ${reconnectStatus} changed the markup (it must be ignored)`)
            if (text !== (loading ? 'Loading conversation…' : LEGACY[connectionState])) fail(`header unit: flag ${flag}: "${text}" is not the base wording for ${connectionState}`)
            if ('data-studio-chat-header' in rootAttrs || 'data-studio-chat-header-state' in attrs) fail(`header unit: flag ${flag}: new attributes rendered`)
            continue
          }
          const [tone, words] = loading ? ['loading', 'Loading conversation…'] : ORACLE[connectionState][reconnectStatus ?? 'idle']
          if (text !== words) fail(`header unit: ${connectionState} / ${reconnectStatus} loading=${loading}: "${text}", expected "${words}"`)
          if (attrs['data-studio-chat-header-state'] !== tone) fail(`header unit: ${connectionState} / ${reconnectStatus} loading=${loading}: state attribute "${attrs['data-studio-chat-header-state']}", expected "${tone}"`)
          if (rootAttrs['data-studio-chat-header'] !== 'true') fail(`header unit: ${connectionState} / ${reconnectStatus}: no data-studio-chat-header on the root`)
          if (attrs['data-connection-state'] !== (loading ? 'loading' : connectionState)) fail(`header unit: data-connection-state changed for ${connectionState} loading=${loading}`)
          if (attrs.role !== 'status' || attrs['aria-label'] !== 'Director connection' || attrs['aria-atomic'] !== 'true') fail(`header unit: the status region lost role / aria-label / aria-atomic`)
          if (nodesOf(tree).some(node => node.type === 'button')) fail('header unit: a button appeared in the header')
          if (!/^(?:Connected|Connecting…|Reconnecting…|Offline, will retry|Couldn't reconnect|Disconnected|Connection error|Loading conversation…)$/.test(text)) fail(`header unit: unexpected words "${text}"`)
          if (text === 'Connected' && !loading && connectionState !== 'connected') fail(`header unit: "Connected" shown while ${connectionState}`)
        }
      }
    }
  }
  // outside the Studio shell nothing renders, flag or not
  for (const flag of [undefined, 'true']) if (headerFor(flag, 'false')({ connectionState: 'connected', reconnectStatus: 'idle' }) !== null) fail(`header unit: rendered outside the Studio shell with flag ${flag}`)

  // ---- C. the ask card, every combination ----------------------------------------------------------------------------------
  const requireRoot = createRequire(path.join(root, 'package.json'))
  const React = requireRoot('react'), { renderToStaticMarkup } = requireRoot('react-dom/server')
  const icon = name => props => React.createElement('svg', { 'data-icon': name, ...props })
  const lucide = new Proxy({}, { get: (_, name) => typeof name === 'string' ? icon(name) : undefined })
  const Button = ({ variant, size, ...props }) => React.createElement('button', props)
  const cardImports = { react: React, 'react/jsx-runtime': requireRoot('react/jsx-runtime'), 'lucide-react': lucide, '@/components/ui/button': { Button } }
  const cardFor = flag => loadModule(root, 'components/builder/chat/question-card.tsx', { ...(flag === undefined ? {} : { [ASK]: flag }) }, cardImports).QuestionCard
  const action = (value, primary = false, requires_input = false) => ({ label: `L ${value}`, value, primary, requires_input })
  const ACTION_SETS = {
    plan: [action('accept_plan', true), action('reject_plan')], outline: [action('accept_strawman', true), action('request_refinement')],
    planAndOutline: [action('accept_plan', true), action('accept_strawman')], other: [action('present', true), action('edit_slide')],
    typeIn: [action('refine', false, true)], none: [], retry: [action('retry_research', true)],
  }
  const questionSet = { id: 'qs', intro: 'Intro', questions: [{ id: 'q1', text: 'Who?', allow_free_text: true, suggestions: [{ label: 'A', recommended: true }, { label: 'B' }] }] }
  const headingOf = html => html.match(HEADING)
  const legacyHeading = (studio, structured, outline) => structured ? 'Quick questions' : studio && outline ? 'Review your outline' : 'Your input'
  for (const studio of [false, true]) {
    for (const structured of [false, true]) {
      for (const [setName, actions] of Object.entries(ACTION_SETS)) {
        const props = { promptText: 'Prompt', actions, messageId: 'm1', onActionClick() {}, questionSet: structured ? questionSet : null, structuredEnabled: structured, studio, onSubmitAnswers() {} }
        const render = flag => renderToStaticMarkup(React.createElement(cardFor(flag), props))
        const off = render(undefined), explicitOff = render('false'), on = render('true'), near = render('TRUE')
        const outline = actions.some(a => a.value === 'accept_strawman'), plan = actions.some(a => a.value === 'accept_plan')
        stats.unitCard++
        const tag = `card unit (studio ${studio}, structured ${structured}, ${setName})`
        if (explicitOff !== off) fail(`${tag}: "false" differs from unset`)
        if (near !== off) fail(`${tag}: "TRUE" (not exactly "true") changed the card`)
        const offHeading = off.match(/<span class="text-\[10px\][^>]*>([^<]*)<\/span>/)?.[1]
        if (offHeading !== legacyHeading(studio, structured, outline)) fail(`${tag}: flag-off heading "${offHeading}", the base said "${legacyHeading(studio, structured, outline)}"`)
        const expectApproval = studio && !structured && !outline && plan
        const onHeading = on.match(/<span class="text-\[10px\][^>]*>([^<]*)<\/span>/)?.[1]
        if (onHeading !== (expectApproval ? 'Approval needed' : offHeading)) fail(`${tag}: flag-on heading "${onHeading}", expected "${expectApproval ? 'Approval needed' : offHeading}"`)
        if (expectApproval) {
          const reverted = on.replace(/data-icon="CheckCircle2"/, 'data-icon="HelpCircle"').replace('>Approval needed<', '>Your input<')
          if (reverted !== off) fail(`${tag}: flag-on differs from flag-off by more than the plan-gate heading words and icon`)
        } else if (on !== off) fail(`${tag}: flag on changed this card (only plan-gate cards may change)`)
        // the buttons and inputs are the same, in the same order, with the same attributes
        const controls = html => [...html.matchAll(/<(?:button|input)\b[^>]*>/g)].map(match => match[0])
        if (JSON.stringify(controls(on)) !== JSON.stringify(controls(off))) fail(`${tag}: flag on changed the card's buttons or inputs`)
      }
    }
  }

  // ---- D. wiring and scoping, read from the source ----------------------------------------------------------------------------
  const page = read('app/builder/page.tsx')
  const headerTag = page.match(/<StudioDirectorHeader\b[^>]*?\n?[^>]*?actions=/)?.[0] ?? ''
  if (!headerTag.includes('connectionState={connectionState} isLoadingSession={session.isLoadingSession} reconnectStatus={reconnectStatus}')) fail('page.tsx: <StudioDirectorHeader> must pass connectionState, isLoadingSession and reconnectStatus={reconnectStatus} (the hook\'s own value)')
  if ((page.match(/<StudioDirectorHeader\b/g) || []).length !== 1) fail('page.tsx: expected exactly one <StudioDirectorHeader>')
  const card = read('components/builder/chat/question-card.tsx')
  for (const [name, snippet] of [['the action button handler', 'onClick={() => onActionClick(action, messageId)}'], ['the submit composition', 'onSubmitAnswers(parts.join("\\n"), `Answers: ${answersOnly.join(" · ")}`)'], ['the send gate', 'disabled={answeredCount === 0}'], ['the answered count', '{answeredCount} of {questionSet.questions.length} answered']]) {
    if ((card.split(snippet).length - 1) !== 1) fail(`question-card.tsx: ${name} changed (${snippet})`)
  }
  const header = read('components/builder/chat/studio-director-header.tsx')
  if ((header.match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_HEADER/g) || []).length !== 1) fail('studio-director-header.tsx: the flag must be read in exactly one place')
  if ((card.match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_ASK/g) || []).length !== 1) fail('question-card.tsx: the flag must be read in exactly one place')
  if (/\b(?:useEffect|useState|useRef|useCallback|setTimeout|setInterval|fetch|WebSocket)\b/.test(header.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('studio-director-header.tsx: gained state, effects, timers or requests')
  const css = read('components/builder/chat/studio-director-header.css')
  const marker = css.lastIndexOf('/*', css.indexOf('PASS2-DIRECTOR-CHAT PR C')) // the start of the PR C comment
  if (css.indexOf('PASS2-DIRECTOR-CHAT PR C') < 0) fail('studio-director-header.css: the PR C block is missing')
  else {
    const added = css.slice(marker).replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = []
    const block = text => {
      let i = 0
      while (i < text.length) {
        const open = text.indexOf('{', i); if (open === -1) break
        let depth = 1, j = open + 1
        for (; j < text.length && depth; j++) { if (text[j] === '{') depth++; else if (text[j] === '}') depth-- }
        const head = text.slice(i, open).trim(), body = text.slice(open + 1, j - 1)
        if (head.startsWith('@media')) block(body)
        else if (head.startsWith('@')) fail(`studio-director-header.css: unexpected at-rule "${head}" in the PR C block`)
        else rules.push(head)
        i = j
      }
    }
    block(added)
    if (rules.length < 8) fail(`studio-director-header.css: only ${rules.length} PR C rules parsed`)
    for (const head of rules) for (const selector of head.split(/,(?![^(]*\))/)) {
      if (!/^\s*\[data-studio-v4-shell="true"\]\s+\[data-studio-chat-header\]/.test(selector)) fail(`studio-director-header.css: a PR C selector is not scoped to the Studio shell and [data-studio-chat-header]: ${selector.trim().slice(0, 120)}`)
    }
  }
  const env = read('.env.example')
  for (const name of [HEADER, ASK]) if (!new RegExp(`^${name}="false"$`, 'm').test(env)) fail(`.env.example: ${name}="false" is not documented`)
  const pkg = JSON.parse(read('package.json'))
  if (pkg.scripts?.['test:studio-chat-header-ask'] !== 'node scripts/test-studio-chat-header-ask.mjs') fail('package.json: test:studio-chat-header-ask is missing')
  return { failures, stats }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Mutation check: copy the product sources the replay reads into a scratch directory, break them one way at a time, and require the
// checks above to notice every break (and to pass on the unbroken copy).
async function mutationCheck() {
  // A fresh copy per mutation: the harness caches the parsed page per root, so a reused root would never see an edited page.tsx.
  const scratches = []
  const makeScratch = () => {
    const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'chat-header-ask-'))
    scratches.push(scratch)
    const copy = relative => { fs.mkdirSync(path.dirname(path.join(scratch, relative)), { recursive: true }); fs.cpSync(path.join(repoRoot, relative), path.join(scratch, relative), { recursive: true }) }
    for (const relative of ['components', 'lib', 'hooks', 'types', 'app/builder/page.tsx', 'package.json', '.env.example', 'tsconfig.json']) copy(relative)
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(scratch, 'node_modules'))
    return scratch
  }
  const HDR = 'components/builder/chat/studio-director-header.tsx', CARD = 'components/builder/chat/question-card.tsx', PAGE = 'app/builder/page.tsx', CSS = 'components/builder/chat/studio-director-header.css'
  const mutations = [
    ['header: ignores its flag (new words with the flag off)', HDR, s => s.replace('process.env.NEXT_PUBLIC_STUDIO_CHAT_HEADER === "true"', 'true')],
    ['header: connected + scheduled no longer reads "Connected"', HDR, s => s.replace('  if (connectionState === "connected") return { tone: "ready", text: "Connected" }\n', '')],
    ['header: offline and gave-up words swapped', HDR, s => s.replace('"Offline, will retry"', '"@@"').replace('"Couldn\'t reconnect"', '"Offline, will retry"').replace('"@@"', '"Couldn\'t reconnect"')],
    ['header: "Connected" while not connected', HDR, s => s.replace('if (connectionState === "connected") return', 'if (connectionState !== "error") return')],
    ['header: the state attribute is dropped', HDR, s => s.replace('{ "data-studio-chat-header-state": chatHeader.tone }', '{}')],
    ['ask: ignores its flag (new heading with the flag off)', CARD, s => s.replace('process.env.NEXT_PUBLIC_STUDIO_CHAT_ASK === "true"', 'true')],
    ['ask: the outline gate is headed "Approval needed" too', CARD, s => s.replace('studio && !structured && !isOutlineApproval &&', 'studio && !structured &&').replace('studio && isOutlineApproval ? "Review your outline" : isPlanApproval', 'isPlanApproval ? "Approval needed" : studio && isOutlineApproval')],
    ['ask: a changed action handler (wire behaviour)', CARD, s => s.replace('onClick={() => onActionClick(action, messageId)}', 'onClick={() => onActionClick({ ...action, label: action.label + " " }, messageId)}')],
    ['page: the header gets the wrong value (replay and source check)', PAGE, s => s.replace('reconnectStatus={reconnectStatus}\n', 'reconnectStatus={connectionState as any}\n')],
    ['css: an unscoped rule in the PR C block', CSS, s => s + '\n[data-studio-v4-shell="true"] [data-studio-director-header="true"] > strong { font-size: 99px; }\n'],
  ]
  let ok = true
  try {
    const control = await checks(makeScratch())
    console.log(control.failures.length === 0 ? 'mutation control: the unbroken scratch copy passes' : `mutation control FAILED: ${control.failures.length} failures on the unbroken copy\n  - ${control.failures.slice(0, 5).join('\n  - ')}`)
    if (control.failures.length) ok = false
    for (const [name, file, edit] of mutations) {
      const scratch = makeScratch()
      const target = path.join(scratch, file), original = fs.readFileSync(target, 'utf8'), mutated = edit(original)
      if (mutated === original) { console.log(`MUTATION NOT APPLIED  ${name}`); ok = false; continue }
      fs.writeFileSync(target, mutated)
      let result
      try { result = await checks(scratch) } catch (error) { result = { failures: [`threw: ${String(error.message).split('\n')[0]}`] } }
      const caught = result.failures.length > 0
      ok &&= caught
      const kinds = [...new Set(result.failures.map(line => line.includes('page.tsx') ? 'source check' : line.includes('.css') ? 'stylesheet check' : /unit\b/.test(line) ? 'unit matrix' : 'transcript replay'))].join(' + ')
      console.log(`${caught ? 'caught' : 'MISSED'}  ${name}  (${result.failures.length} failure${result.failures.length === 1 ? '' : 's'} by ${kinds || '-'}; first: ${(result.failures[0] || '-').split('\n')[0].slice(0, 110)})`)
    }
  } finally { for (const scratch of scratches) fs.rmSync(scratch, { recursive: true, force: true }) }
  return ok
}

const { failures, stats } = await checks(repoRoot)
let mutationsOk = true
if (process.argv.includes('--mutation-check')) mutationsOk = await mutationCheck()
release()
if (failures.length) {
  console.error(`FAIL studio chat header + ask (${failures.length}):\n` + failures.slice(0, 40).map(line => `  - ${line}`).join('\n') + (failures.length > 40 ? `\n  ... ${failures.length - 40} more` : ''))
  process.exit(1)
}
if (!mutationsOk) { console.error('FAIL studio chat header + ask: the mutation check did not catch every break'); process.exit(1) }
console.log(`PASS studio chat header + ask: ${fixtures.length} transcripts x ${Object.keys(PROFILES).length} profiles x 5 environments, ${stats.checkpoints} studio chat checkpoints.`)
console.log(`  flag off == base (markup hashes and files), "false" == unset; flag on (header, ask, both): outbound bytes, keys, calls, state and cache identical`)
console.log(`  header words checked against the table at real hook states: ${[...stats.headerStates.entries()].map(([k, v]) => `${k} -> "${v}"`).join(', ')}`)
console.log(`  ask flag changed ${stats.planGateCards} plan-gate card heading(s) and nothing else; ${stats.unitHeader} header and ${stats.unitCard} card unit combinations`)
console.log('  page wiring, untouched handler lines, flag read sites and stylesheet scoping verified' + (process.argv.includes('--mutation-check') ? '; all ten mutations caught' : ''))
