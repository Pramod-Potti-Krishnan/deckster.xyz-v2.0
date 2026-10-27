// PASS2B chat touches (E2E-2, card PASS2B-JOURNEY-ELEVATION, audit rows J1-10, J1-15, J1-17, J1-02, J1-07): five flags, each default off.
//
//   NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT   J1-10  after "I'd like to make changes" / "Make some changes" the composer is focused once and its placeholder
//                                                reads "Tell Director what to change…" (derived from the transcript; nothing is sent)
//   NEXT_PUBLIC_STUDIO_BUILD_ERROR_STATE  J1-15  a failed build's ribbon drops Pause and Stop and says what is saved and how to try again
//   NEXT_PUBLIC_STUDIO_CHAT_ERROR_CLEAR   J1-17  a Director error notice (and the recovery card it feeds) is not drawn once the user has sent another
//                                                turn and Director has answered; derived from the two counts when the notice was first seen
//   NEXT_PUBLIC_STUDIO_CHAT_RECONNECT     J1-02  once every retry is used up the Director header offers "Reconnect", which only calls the page's connect()
//   NEXT_PUBLIC_STUDIO_APPROVAL_HINT      J1-07  the plan and outline approval cards say "About 3–5 minutes. You can stop anytime."
//
// What it proves, on the REAL sources (Director WebSocket hook, MessageList, QuestionCard, header, notice, ChatInput, StageRibbon, the page's own
// handlers and prop expressions), offline:
//   A. flag off (unset, and "false"): every transcript of the chat harness equals the committed base baselines hash for hash: outbound socket bytes,
//      React keys, handler calls, hook state, the session cache AND the rendered markup are the base's.
//   B. flag on (each alone, and all five together): outbound bytes / keys / handler calls / hook state / cache are byte-identical to flag off at every
//      checkpoint of every transcript and profile; the markup differs only by what that flag adds (counted; each addition is removed to get the
//      flag-off markup back).
//   C. the behaviours, on transcripts rebuilt from the recorded frames of error-retry, normal-build and reconnect-exhausted: the error notice and the
//      recovery card clear only after a retry that Director answered (not before, not after a retry that fails again); the edit prompt starts at the
//      click on the edit action and ends at the next turn, on both gates, and never after "Yes, let's build it!".
//   E. NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB x NEXT_PUBLIC_STUDIO_CHAT_RECONNECT (#402 follow-up): a tab Director handed over to another tab (`superseded`) never shows
//      the header Reconnect button, with both flags on (and the header / recovery flags): the one-live-tab transcripts plus a rebuilt one where the eviction comes
//      after a retry; its only way back stays "Use here". The button still shows for `exhausted` with ONE_LIVE_TAB on, so the check cannot pass by showing nothing.
//   D. units: QuestionCard / StudioDirectorHeader / StageRibbon flag off equal hashes of the base sources (scripts/fixtures/studio-pass2b-chat/
//      base-golden.json, printed from the base tree with PRINT_GOLDEN=1 PASS2B_ROOT=<base checkout>), and flag on differ exactly as designed over every
//      state; the two derived helpers over tables and through the real hook; the page's focus effect (extracted by AST and run); no handler region of the
//      page changed (the anchors of _sources.json); no new import in the four components the existing pin tests guard; flags read and CSS scoped.
//
//   node scripts/test-studio-pass2b-chat.mjs                    # all of the above
//   node scripts/test-studio-pass2b-chat.mjs --mutation-check   # also: break the code in a scratch copy several ways; each must be caught
//   node scripts/test-studio-pass2b-chat.mjs --mutation-check --mutant superseded   # only the breaks whose name contains the word
//   PRINT_GOLDEN=1 PASS2B_ROOT=/path/to/base node scripts/test-studio-pass2b-chat.mjs    # print base-golden.json from the base sources
//
// Offline by construction (no socket, fetch or real timer): the harness installs the host network guard.
process.env.NODE_ENV = 'production'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installHostNetworkGuard, createEnvironment } from './studio-chat-harness/fake-env.mjs'

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const release = installHostNetworkGuard(net, dns)
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES, BASE_ENV } = await import('./studio-chat-harness/profiles.mjs')
const { readSnapshot, compareSnapshots } = await import('./studio-chat-harness/snapshot.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { esmPackages, lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const { Root } = await import('./studio-chat-harness/mini-react.mjs')
const extract = await import('./studio-chat-harness/page-extract.mjs')
const { pageSources } = await import('./studio-chat-harness/page-sources.mjs')

const FLAGS = {
  edit: 'NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT',
  error: 'NEXT_PUBLIC_STUDIO_BUILD_ERROR_STATE',
  clear: 'NEXT_PUBLIC_STUDIO_CHAT_ERROR_CLEAR',
  reconnect: 'NEXT_PUBLIC_STUDIO_CHAT_RECONNECT',
  hint: 'NEXT_PUBLIC_STUDIO_APPROVAL_HINT',
}
const RECOVERY = 'NEXT_PUBLIC_STUDIO_CHAT_RECOVERY'
const ALL_FALSE = Object.fromEntries(Object.values(FLAGS).map(name => [name, 'false']))
const ALL_ON = Object.fromEntries(Object.values(FLAGS).map(name => [name, 'true']))
const HINT_TEXT = 'About 3–5 minutes. You can stop anytime.'
const HINT_P = `<p data-studio-director-part="approval-hint">${HINT_TEXT}</p>`
const EDIT_PLACEHOLDER = 'Tell Director what to change…'
const SAVED_TEXT = 'Your outline and any finished slides are saved. Send a message to try again.'
const RECONNECT_BUTTON = '<button type="button" data-studio-chat-reconnect="true" aria-label="Reconnect to Director">Reconnect</button>'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const GOLDEN_FILE = path.join(here, 'scripts/fixtures/studio-pass2b-chat/base-golden.json')
const BASELINES = path.join(here, 'scripts/fixtures/director-chat/baselines')
const fixturesAll = fs.readdirSync(path.join(here, 'scripts/fixtures/director-chat')).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(here, 'scripts/fixtures/director-chat', name), 'utf8')))
const fixtureNamed = name => fixturesAll.find(fixture => fixture.name === name) ?? (() => { throw new Error(`no transcript named ${name}`) })()
const clone = value => JSON.parse(JSON.stringify(value))

// ---------------------------------------------------------------------------------------------------------------------------------
// Unit world: the real components, loaded into the harness's vm with the repo's own imports (React, lucide as compact <svg>, the repo's Button).
const FRAMER = {
  __esModule: true,
  AnimatePresence: ({ children }) => children ?? null,
  motion: { p: ({ initial, animate, exit, transition, ...rest }) => React.createElement('p', rest) },
}
async function world(root, processEnv) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, ...processEnv } })
  const loader = createModuleLoader({
    root, globals: env.globals,
    stubs: { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React), 'framer-motion': FRAMER },
  })
  return { env, load: relative => loader.load(relative) }
}
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const nodesOf = value => Array.isArray(value) ? value.flatMap(nodesOf) : !value || typeof value !== 'object' ? [] : [value, ...nodesOf(value.props?.children)]

// QuestionCard states: action sets as Director sends them.
const A = (label, value, primary = false, requires_input = false) => ({ label, value, primary, requires_input })
const PLAN = [A("Yes, let's build it!", 'accept_plan', true), A("I'd like to make changes", 'reject_plan')]
const OUTLINE = [A('Looks perfect!', 'accept_strawman', true), A('Make some changes', 'request_refinement')]
const OUTLINE_J1 = [A('Looks perfect!', 'accept_strawman:outline-7f3a', true), A('Make some changes', 'request_refinement')]
const CARDS = {
  plan: { actions: PLAN, hint: true },
  outline: { actions: OUTLINE, hint: true },
  outlineIdentity: { actions: OUTLINE_J1, hint: true },
  skip: { actions: [A('Skip — use sensible defaults', 'skip_questions')], hint: false },
  finished: { actions: [A('Done, looks great!', 'complete_presentation', true), A('Make adjustments', 'request_adjustments', false, true)], hint: false },
  retryResearch: { actions: [A('Retry research', 'retry_research', true), A('Make some changes', 'request_refinement')], hint: false },
  resume: { actions: [A('Build the deck', 'accept_strawman_resume', true), A('Refine the outline first', 'request_refinement')], hint: false },
  none: { actions: [], hint: false },
  structured: { actions: PLAN, hint: false, structured: true },
}
const QUESTION_SET = { id: 'qs_1', intro: 'A few quick questions:', questions: [
  { id: 'q1', text: 'Who is it for?', suggestions: [{ label: 'Leaders', recommended: true }, { label: 'Team', recommended: false }], allow_free_text: true },
  { id: 'q2', text: 'How long?', suggestions: [{ label: '10 minutes', recommended: false }], allow_free_text: false },
] }
const cardMarkup = async (root, env, name, studioOn) => {
  const w = await world(root, { [SHELL]: studioOn ? 'true' : 'false', ...env })
  const { QuestionCard } = w.load('components/builder/chat/question-card.tsx')
  const c = CARDS[name]
  return renderToStaticMarkup(React.createElement(QuestionCard, {
    promptText: 'Does this structure work for you?', actions: c.actions, messageId: `msg-${name}`, onActionClick() {}, studio: studioOn,
    questionSet: c.structured ? QUESTION_SET : null, structuredEnabled: Boolean(c.structured), onSubmitAnswers() {},
  }))
}

// Header states.
const CONNECTIONS = ['connected', 'connecting', 'disconnected', 'error']
const STATUSES = ['idle', 'scheduled', 'paused_offline', 'exhausted', 'manual', 'superseded']
const headerMarkup = async (root, env, connectionState, reconnectStatus, loading, withHandler, shellOn = true, handler = () => {}) => {
  const w = await world(root, { [SHELL]: shellOn ? 'true' : 'false', ...env })
  const { StudioDirectorHeader } = w.load('components/builder/chat/studio-director-header.tsx')
  return renderToStaticMarkup(React.createElement(StudioDirectorHeader, {
    connectionState, reconnectStatus, isLoadingSession: loading,
    actions: React.createElement('span', { 'data-actions': 'true' }, 'call'), ...(withHandler ? { onReconnect: handler } : {}),
  }))
}

// Ribbon states (the narration fields StageRibbon reads).
const PHASES = ['planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error']
const narrationFor = (phase, variant = 'event') => ({
  active: true, phase, phaseLabel: { error: 'Something went wrong', complete: 'Your deck is ready', paused: 'Paused', stopped: 'Stopped' }[phase] ?? `Phase ${phase}`,
  startedAt: 1760000000000, slideCount: 6, slidesDone: 2, control: phase === 'paused' ? 'paused' : phase === 'stopped' ? 'stopped' : 'running', ghosts: [], slideStates: {},
  deckEvents: phase === 'error' && variant === 'event' ? [{ id: 'e1', status: 'error', text: 'Slide builder stopped on slide 3.', stage: 'render', ts: 1 }] : [],
})
const ribbonMarkup = async (root, env, phase, withControl, shellOn = true, variant = 'event') => {
  const w = await world(root, { [SHELL]: shellOn ? 'true' : 'false', ...env })
  const { StageRibbon } = w.load('components/build-narration/stage-ribbon.tsx')
  return renderToStaticMarkup(React.createElement(StageRibbon, {
    narration: narrationFor(phase, variant), control: withControl ? { enabled: true, onPause() {}, onResume() {}, onStop() {} } : undefined,
  }))
}
const CONTROLS_RE = /<div class="flex items-center gap-1\.5" data-testid="bn-controls">.*?<\/div>/s
const SAVED_RE = /<p data-studio-build-part="error-recovery" class="text-xs text-muted-foreground">[^<]*<\/p>/

// ---------------------------------------------------------------------------------------------------------------------------------
async function printGolden(root) {
  const out = { source: 'studio-v4-dev-preparation-code @ 506f32f (flag-off markup of the base sources; scripts/test-studio-pass2b-chat.mjs PRINT_GOLDEN)', card: {}, header: {}, ribbon: {}, imports: {}, regions: {} }
  for (const shell of [true, false]) for (const name of Object.keys(CARDS)) out.card[`${name}/shell=${shell}`] = sha(await cardMarkup(root, {}, name, shell))
  for (const shell of [true, false]) for (const c of CONNECTIONS) for (const s of STATUSES) for (const loading of [false, true]) {
    out.header[`${c}/${s}/loading=${loading}/shell=${shell}`] = sha(await headerMarkup(root, {}, c, s, loading, false, shell))
  }
  for (const shell of [true, false]) for (const phase of PHASES) for (const withControl of [true, false]) {
    out.ribbon[`${phase}/control=${withControl}/shell=${shell}`] = sha(await ribbonMarkup(root, {}, phase, withControl, shell))
  }
  out.ribbon['error/no-event/control=true/shell=true'] = sha(await ribbonMarkup(root, {}, 'error', true, true, 'none'))
  for (const file of ['components/builder/chat-input.tsx', 'components/builder/chat/question-card.tsx', 'components/builder/chat/studio-director-header.tsx', 'components/build-narration/stage-ribbon.tsx']) {
    out.imports[file] = sha(importLines(fs.readFileSync(path.join(root, file), 'utf8')).join('\n'))
  }
  for (const region of pageSources(root).regions) out.regions[region.label] = region.sha256
  return out
}
const importLines = source => source.split('\n').filter(line => /^import[\s{*"']/.test(line))
const chatCleanStrip = await import('./studio-chat-clean-strip.mjs') // LATER-CHANGES: registry read (CHAT-CLEAN): the strip of the change stacked after this one, so its marked lines come out before the pins below read a file
const { stripLaterChanges: registryRead } = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (PAUSED-LABEL): every registered later change's marked lines come out of a file before its import lines are read

if (process.env.PRINT_GOLDEN) {
  const root = path.resolve(process.env.PASS2B_ROOT || here)
  console.log(JSON.stringify(await printGolden(root), null, 2))
  release()
  process.exit(0)
}
const GOLDEN = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'))

// ---------------------------------------------------------------------------------------------------------------------------------
async function checks(root, { only } = {}) {
  const failures = []
  const fail = message => failures.push(message)
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
  const stats = { runs: 0, hintCards: 0, reconnectButtons: 0, noticeDrops: 0, editPrompts: 0 }
  const fixtures = fixturesAll.filter(fixture => !only || only.includes(fixture.name))

  const run = async (fixture, profile, extra) => {
    const result = await runTranscript({ root, fixture, profile, processEnv: { ...PROFILES[profile], ...extra }, includeMarkup: true })
    stats.runs++
    if (result.blockedNetwork.length) fail(`${fixture.name}/${profile}: code under test attempted network access: ${result.blockedNetwork.join(', ')}`)
    return result.files
  }
  const split = chrome => { const at = chrome.indexOf('<!-- StudioDirectorNotice -->'); return [chrome.slice(0, at), chrome.slice(at)] }
  const isMarkup = name => name.startsWith('markup/') || name === 'markup.json'

  // ---- A + B. the committed transcripts ----------------------------------------------------------------------------------------
  for (const fixture of fixtures) {
    for (const profile of Object.keys(PROFILES)) {
      const label = `${fixture.name}/${profile}`
      let off, explicitOff, ons = {}
      try {
        off = await run(fixture, profile, {}); explicitOff = await run(fixture, profile, ALL_FALSE)
        for (const [key, name] of Object.entries(FLAGS)) ons[key] = await run(fixture, profile, { [name]: 'true' })
        ons.all = await run(fixture, profile, ALL_ON)
      } catch (error) { fail(`${label}: the transcript could not be replayed (${String(error.message).split('\n')[0].slice(0, 200)})`); continue }

      // A. flag off == the committed base baselines, every file; "false" == unset
      const baseline = readSnapshot(path.join(BASELINES, fixture.name, profile))
      for (const diff of compareSnapshots(baseline, off, { skip: name => name.startsWith('markup/') && profile !== 'studio' })) fail(`${label}: flag off, ${diff.file} is ${diff.kind} against the committed base baseline`)
      for (const diff of compareSnapshots(off, explicitOff, { skip: name => name === 'env.json' })) fail(`${label}: the five flags set to "false" differ from unset in ${diff.file}`)
      if (/data-studio-chat-reconnect|approval-hint|error-recovery|Tell Director what to change|About 3–5 minutes/.test(Object.values(off).join('\n'))) fail(`${label}: flag off, but a new flag's markup or words were rendered`)

      // B. flag on: everything but markup (and the recorded env) is identical to flag off
      for (const [name, files] of Object.entries(ons)) {
        for (const diff of compareSnapshots(off, files, { skip: file => isMarkup(file) || file === 'env.json' })) fail(`${label}: flag ${name} on changes ${diff.file} (outbound bytes / keys / calls / state / cache must not move)`)
      }
      // markup: what each flag adds, and nothing else
      for (const file of Object.keys(off)) {
        if (!file.startsWith('markup/')) continue
        const isChat = file.endsWith('.chat.html'), isChrome = file.endsWith('.chrome.html')
        // the hint (J1-07): only inside studio ask cards that carry accept_plan / accept_strawman
        if (isChat) {
          const on = ons.hint[file]
          const count = on.split(`\n${HINT_P}`).length - 1
          if (on.split(`\n${HINT_P}`).join('') !== off[file]) fail(`${label} ${file}: the hint flag changed the chat markup beyond the hint line`)
          if (count > 0 && profile === 'classic') fail(`${label} ${file}: the hint was drawn outside the Studio shell`)
          if (count > 0 && !/data-studio-director-option="action"/.test(on)) fail(`${label} ${file}: a hint was drawn with no action button in the chat`)
          stats.hintCards += count
        } else if (ons.hint[file] !== off[file]) fail(`${label} ${file}: the hint flag changed more than the chat markup`)
        // reconnect (J1-02): header only; only where retries are used up; removing the button gives flag off back
        if (isChrome) {
          const [offHeader, offNotice] = split(off[file]); const [onHeader, onNotice] = split(ons.reconnect[file])
          if (onNotice !== offNotice) fail(`${label} ${file}: the reconnect flag changed the notice`)
          const buttons = onHeader.split(`\n${RECONNECT_BUTTON}`).length - 1
          if (onHeader.split(`\n${RECONNECT_BUTTON}`).join('') !== offHeader) fail(`${label} ${file}: the reconnect flag changed the header beyond the button`)
          stats.reconnectButtons += buttons
          if (buttons > 1) fail(`${label} ${file}: more than one Reconnect button`)
          if (profile === 'classic' && buttons) fail(`${label} ${file}: a Reconnect button outside the Studio shell`)
        } else if (ons.reconnect[file] !== off[file]) fail(`${label} ${file}: the reconnect flag changed more than the chrome`)
        // the three flags that never touch the plain transcripts' chat / chrome / composer except as designed
        for (const key of ['edit', 'error']) if (ons[key][file] !== off[file]) fail(`${label} ${file}: the ${key} flag changed markup in a transcript with no composer edit click or ribbon`)
        // clear (J1-17): the committed transcripts never answer an error notice with a later turn, so the flag leaves every one of them as it was
        if (ons.clear[file] !== off[file]) fail(`${label} ${file}: the clear flag changed markup in a committed transcript (no answered retry in it)`)
      }
    }
  }

  // ---- C. the behaviours, on transcripts rebuilt from recorded frames -------------------------------------------------------------
  const stepIndex = (fixture, predicate, what) => { const at = fixture.steps.findIndex(predicate); if (at < 0) throw new Error(`transcript ${fixture.name} has no ${what}`); return at }
  const frameStep = (fixture, type) => stepIndex(fixture, step => step.op === 'frame' && step.frame.type === type, `${type} frame`)
  const named = (steps, label) => steps.find(step => step.op === 'checkpoint' && step.label === label)
  const filesFor = (files, label) => {
    const entry = JSON.parse(files['state.json']).checkpoints.find(item => item.label === label)
    const name = entry?.checkpoint ?? null
    return { name, chat: name ? files[`markup/${name}.chat.html`] : undefined, chrome: name ? files[`markup/${name}.chrome.html`] : undefined, composer: name ? files[`markup/${name}.composer.html`] : undefined }
  }
  const showsNotice = (chrome, type) => chrome.includes(`data-studio-director-transport-notice="${type}"`)
  const showsCard = (chat, kind) => chat.includes(`data-studio-chat-recovery="${kind}"`)

  if (!only || only.includes('error-retry')) {
    try {
      const base = fixtureNamed('error-retry')
      const steps = base.steps
      const at = type => steps[frameStep(base, type)]
      const typedResend = steps[stepIndex(base, step => step.op === 'typed' && step.comment, 'resend step')]
      const think2 = steps.find(step => step.op === 'frame' && step.frame.message_id === 'msg-think-2')
      const plan = steps.find(step => step.op === 'frame' && step.frame.message_id === 'msg-plan')
      const gate = steps.find(step => step.op === 'frame' && step.frame.type === 'action_request')
      const lead = steps.slice(0, steps.findIndex(step => step.op === 'checkpoint' && step.label === 'working') + 1)
      const errorFrame = at('error')
      const secondError = clone(errorFrame); secondError.frame.timestamp = '2026-10-05T12:00:12Z'
      const cp = label => ({ op: 'checkpoint', label })
      const variant = (name, tail) => ({ ...clone(base), name, steps: clone([...lead, errorFrame, cp('error notice'), ...tail]) })
      const variants = {
        answered: variant('pass2b-error-answered', [typedResend, cp('retry sent, no reply yet'), think2, plan, gate, cp('answered')]),
        failedAgain: variant('pass2b-error-failed-again', [typedResend, secondError, cp('retry failed again')]),
        silent: variant('pass2b-error-silent', [typedResend, cp('retry sent, no reply yet')]),
      }
      for (const profile of ['studio', 'studio-plain']) {
        const env = { [RECOVERY]: 'true' }
        const result = {}
        for (const [key, fixture] of Object.entries(variants)) {
          result[key] = { off: await run(fixture, profile, env), on: await run(fixture, profile, { ...env, [FLAGS.clear]: 'true' }) }
          for (const diff of compareSnapshots(result[key].off, result[key].on, { skip: file => isMarkup(file) || file === 'env.json' })) fail(`error variant ${key}/${profile}: the clear flag changes ${diff.file}`)
        }
        const L = (files, label) => filesFor(files, label)
        const expect = (condition, message) => { if (!condition) fail(`error variant (${profile}): ${message}`) }
        for (const key of Object.keys(variants)) {
          const { off, on } = result[key]
          const first = [L(off, 'error notice'), L(on, 'error notice')]
          expect(first.every(f => f.chrome && showsNotice(f.chrome, 'error') && showsCard(f.chat, 'error')), `${key}: the error notice and the recovery card must show right after the error, flag off and on`)
        }
        { // retry sent, nothing back yet: still shown, flag on too
          const { off, on } = result.silent
          const checks = [L(off, 'retry sent, no reply yet'), L(on, 'retry sent, no reply yet')]
          expect(checks.every(f => f.chrome && showsNotice(f.chrome, 'error') && showsCard(f.chat, 'error')), 'a retry that Director has not answered yet must not clear the notice or the card')
        }
        { // answered: base keeps both for ever (the bug), flag on drops both
          const { off, on } = result.answered
          const o = L(off, 'answered'), n = L(on, 'answered')
          expect(o.chrome && showsNotice(o.chrome, 'error') && showsCard(o.chat, 'error'), 'flag off, the notice and card stay after an answered retry (the base behaviour this flag fixes)')
          expect(n.chrome && !showsNotice(n.chrome, 'error') && !showsCard(n.chat, 'error'), 'flag on, an answered retry clears both the notice and the card')
          if (n.chrome && !showsNotice(n.chrome, 'error')) stats.noticeDrops++
        }
        { // the retry failed again: a new notice, so shown
          const { on } = result.failedAgain
          const n = L(on, 'retry failed again')
          expect(n.chrome && showsNotice(n.chrome, 'error') && showsCard(n.chat, 'error'), 'a retry that fails again raises a new notice, which must show (flag on)')
        }
      }
      // the committed transcript itself: its notices arrive after the user's resend (or are resend-needed), so none is answered by a LATER turn and the flag moves nothing
      for (const profile of ['studio', 'studio-plain']) {
        const off = await run(base, profile, { [RECOVERY]: 'true' }), on = await run(base, profile, { [RECOVERY]: 'true', [FLAGS.clear]: 'true' })
        for (const diff of compareSnapshots(off, on, { skip: file => file === 'env.json' })) fail(`error-retry/${profile}: the clear flag changes ${diff.file} in the committed transcript`)
      }
    } catch (error) { fail(`error-retry variants could not be built or replayed: ${String(error.message).split('\n')[0].slice(0, 220)}`) }
  }

  if (!only || only.includes('normal-build')) {
    try {
      const base = fixtureNamed('normal-build')
      const planGate = base.steps.findIndex(step => step.op === 'checkpoint' && step.label === 'plan proposal')
      const outlineReady = base.steps.findIndex(step => step.op === 'checkpoint' && step.label === 'outline ready')
      const noStarter = steps => steps.filter(step => !(step.op === 'click' && step.target?.attrs?.['data-studio-director-starter']))
      const click = (key, text) => ({ op: 'click', target: { within: { key }, tag: 'button', text } })
      const planKey = base.steps[planGate - 1].frame.message_id
      const outlineKey = `combined_${base.steps.find(step => step.op === 'frame' && step.frame.type === 'slide_update').frame.message_id}`
      // Director's plain reply frame, taken from a recorded transcript (composer-send) and re-addressed to this session; its words are Director's own
      // answer to the edit click (backend/director websocket.py: "Of course! What changes would you like me to make to the ...?").
      const template = fixtureNamed('composer-send').steps.find(step => step.op === 'frame' && step.frame.type === 'chat_message' && step.frame.message_id !== 'msg-greeting').frame
      const reply = (id, text, timestamp) => ({ op: 'frame', frame: { ...clone(template), message_id: id, session_id: base.session.id, timestamp, payload: { ...clone(template.payload), text } } })
      const mk = (name, steps) => ({ ...clone(base), name, composer: true, stableHandlers: true, steps: clone(noStarter(steps)) })
      const head = noStarter(base.steps.slice(0, planGate + 1))
      const outlineHead = noStarter(base.steps.slice(0, outlineReady + 1))
      const cp = label => ({ op: 'checkpoint', label })
      const variants = {
        plan: mk('pass2b-edit-plan', [...head, click(planKey, "I'd like to make changes"), cp('click sent'), reply('msg-edit-ask', 'Of course! What changes would you like me to make to the plan?', '2026-10-05T12:00:30Z'), cp('edit asked'),
          { op: 'compose', text: 'Make it five slides' }, cp('typing'), { op: 'submit' }, cp('changes sent')]),
        outline: mk('pass2b-edit-outline', [...outlineHead, click(outlineKey, 'Make some changes'), cp('click sent'), reply('msg-edit-ask', 'Of course! What changes would you like me to make to the outline?', '2026-10-05T12:00:30Z'), cp('edit asked'),
          { op: 'compose', text: 'Drop slide three' }, cp('typing'), { op: 'submit' }, cp('changes sent')]),
        build: mk('pass2b-edit-build', [...head, click(planKey, "Yes, let's build it!"), cp('click sent'), reply('msg-build-ack', 'Drafting your outline now.', '2026-10-05T12:00:30Z'), cp('build asked')]),
        idle: mk('pass2b-edit-idle', [...head]),
      }
      const placeholderOf = html => (html ?? '').match(/placeholder="([^"]*)"/)?.[1]
      const stripPlaceholder = html => (html ?? '').replace(/placeholder="[^"]*"/, 'placeholder=""')
      for (const profile of ['studio', 'studio-plain']) {
        for (const [key, fixture] of Object.entries(variants)) {
          const off = await run(fixture, profile, {}), on = await run(fixture, profile, { [FLAGS.edit]: 'true' })
          for (const diff of compareSnapshots(off, on, { skip: file => isMarkup(file) || file === 'env.json' })) fail(`edit variant ${key}/${profile}: the edit flag changes ${diff.file} (the click is the base's, byte for byte)`)
          const entries = JSON.parse(off['state.json']).checkpoints
          const idle = placeholderOf(off[`markup/${entries[0].checkpoint}.composer.html`])
          if (!idle || idle === EDIT_PLACEHOLDER) fail(`edit variant ${key}/${profile}: no usable base placeholder (${idle})`)
          for (const entry of entries) {
            const name = entry.checkpoint, label = entry.label
            const offPlaceholder = placeholderOf(off[`markup/${name}.composer.html`]), onPlaceholder = placeholderOf(on[`markup/${name}.composer.html`])
            if (offPlaceholder === EDIT_PLACEHOLDER) fail(`edit variant ${key}/${profile} "${label}": flag off shows the edit prompt`)
            const wantPrompt = (key === 'plan' || key === 'outline') && (label === 'edit asked' || label === 'typing')
            const wanted = wantPrompt ? EDIT_PLACEHOLDER : offPlaceholder
            if (onPlaceholder !== wanted) fail(`edit variant ${key}/${profile} "${label}": placeholder is "${onPlaceholder}", expected "${wanted}" (flag off: "${offPlaceholder}")`)
            if (wantPrompt && onPlaceholder === EDIT_PLACEHOLDER) stats.editPrompts++
            for (const kind of ['chat', 'chrome']) if (off[`markup/${name}.${kind}.html`] !== on[`markup/${name}.${kind}.html`]) fail(`edit variant ${key}/${profile} "${label}": the edit flag changed the ${kind} markup`)
            if (stripPlaceholder(off[`markup/${name}.composer.html`]) !== stripPlaceholder(on[`markup/${name}.composer.html`])) fail(`edit variant ${key}/${profile} "${label}": the edit flag changed the composer beyond its placeholder`)
          }
          // the click is held until Director answers (the box says so), and after the next turn is sent the prompt is gone
          if (key === 'plan' || key === 'outline') {
            const held = entries.find(entry => entry.label === 'click sent'), sent = entries.find(entry => entry.label === 'changes sent')
            if (!/^Director is replying/.test(placeholderOf(on[`markup/${held.checkpoint}.composer.html`]) ?? '')) fail(`edit variant ${key}/${profile}: before Director answers the box must still say it is replying`)
            if (placeholderOf(on[`markup/${sent.checkpoint}.composer.html`]) === EDIT_PLACEHOLDER) fail(`edit variant ${key}/${profile}: the prompt outlived the next turn`)
          }
        }
      }
      if (stats.editPrompts === 0) fail('edit variants: the prompt was never shown, so the flag would not be noticed breaking')
    } catch (error) { fail(`edit-prompt variants could not be built or replayed: ${String(error.message).split('\n')[0].slice(0, 220)}`) }
  }

  // ---- E. a superseded tab never offers Reconnect (ONE_LIVE_TAB and RECONNECT both on) ---------------------------------------------
  if (!only || only.includes('superseded')) {
    try {
      const liveTab = name => JSON.parse(fs.readFileSync(path.join(here, 'scripts/fixtures/studio-one-live-tab', `${name}.json`), 'utf8'))
      const ONE_LIVE_TAB = 'NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB'
      const BUTTON = 'data-studio-chat-reconnect'
      const bothOn = { [ONE_LIVE_TAB]: 'true', [FLAGS.reconnect]: 'true', NEXT_PUBLIC_STUDIO_CHAT_HEADER: 'true', [RECOVERY]: 'true' }
      const reconnectOff = { ...bothOn, [FLAGS.reconnect]: 'false' }
      // The eviction after a retry: an ordinary drop, retry 1 starts, and that socket is the one Director closes with 4000 "New connection opened".
      const drop = liveTab('ordinary-drop-still-reconnects')
      const afterRetry = { ...clone(drop), name: 'pass2b-superseded-after-retry', steps: clone([
        ...drop.steps.slice(0, drop.steps.findIndex(step => step.op === 'checkpoint' && step.label === 'connected, one turn sent') + 1),
        { op: 'close', code: 1006, comment: 'an ordinary network drop' }, { op: 'expect', reconnectStatus: 'scheduled' },
        { op: 'advance', ms: 1500, comment: 'retry 1 starts' }, { op: 'expect', sockets: 2 },
        { op: 'close', code: 4000, reason: 'New connection opened', comment: 'the retry\'s socket is closed by Director: the session is open in another tab' },
        { op: 'checkpoint', label: 'evicted after a retry' }, { op: 'advance', ms: 120000 }, { op: 'checkpoint', label: 'two minutes later' },
        { op: 'offline' }, { op: 'online' }, { op: 'advance', ms: 60000 }, { op: 'checkpoint', label: 'offline and online while paused' },
      ]) }
      const transcripts = [liveTab('superseded-by-new-tab'), liveTab('use-here-takeover'), afterRetry]
      let supersededCheckpoints = 0
      for (const fixture of transcripts) for (const profile of ['studio', 'studio-plain']) {
        const label = `superseded ${fixture.name}/${profile}`
        const both = await run(fixture, profile, bothOn), off = await run(fixture, profile, reconnectOff)
        for (const diff of compareSnapshots(off, both, { skip: file => file === 'env.json' })) fail(`${label}: the Reconnect flag changes ${diff.file}; in a tab that is never exhausted it must change nothing`)
        const checkpoints = JSON.parse(both['state.json']).checkpoints
        let paused = false
        for (const entry of checkpoints) {
          const chrome = both[`markup/${entry.checkpoint}.chrome.html`] ?? ''
          const status = entry.connection.reconnectStatus
          if (chrome.includes(BUTTON)) fail(`${label} "${entry.label}": the Reconnect button is drawn (status ${status})`)
          if (status === 'exhausted') fail(`${label} "${entry.label}": the hook reports exhausted in a transcript that never uses up its retries`)
          if (status === 'superseded') {
            supersededCheckpoints++
            if (!/data-studio-chat-header-state="superseded">Open in another tab<\/span>/.test(chrome)) fail(`${label} "${entry.label}": a superseded tab must read "Open in another tab"`)
            if (!/data-studio-superseded-part="use-here"[^>]*>Use here<\/button>/.test(chrome)) fail(`${label} "${entry.label}": a superseded tab's way back must be "Use here"`)
            if (entry.connection.connecting || entry.connection.connected) fail(`${label} "${entry.label}": a superseded tab is connecting or connected`)
          }
          // once evicted, the status stays superseded until the user takes the session back (use-here-takeover does, and says so in its label)
          if (fixture.name !== 'use-here-takeover') { if (status === 'superseded') paused = true; else if (paused) fail(`${label} "${entry.label}": left superseded (${status}) with no "Use here"`) }
        }
        if (fixture.name === 'pass2b-superseded-after-retry') {
          const evicted = checkpoints.find(entry => entry.label === 'evicted after a retry')
          if (evicted.connection.reconnectStatus !== 'superseded' || !(evicted.connection.reconnectAttempt > 0)) fail(`${label}: the eviction must come after a retry (status ${evicted.connection.reconnectStatus}, attempt ${evicted.connection.reconnectAttempt})`)
        }
      }
      if (supersededCheckpoints < 6) fail(`superseded transcripts reached only ${supersededCheckpoints} superseded checkpoints; the check would be thin`)
      // not vacuous: with the one-live-tab flag on too, a tab that really used up its retries still gets the button
      for (const profile of ['studio', 'studio-plain']) {
        const files = await run(fixtureNamed('reconnect-exhausted'), profile, bothOn)
        const states = JSON.parse(files['state.json']).checkpoints
        const withButton = states.filter(entry => (files[`markup/${entry.checkpoint}.chrome.html`] ?? '').includes(BUTTON))
        if (withButton.length === 0) fail(`superseded control (${profile}): with ONE_LIVE_TAB on, an exhausted tab shows no Reconnect, so the check above proves nothing`)
        if (withButton.some(entry => entry.connection.reconnectStatus !== 'exhausted')) fail(`superseded control (${profile}): Reconnect drawn while not exhausted`)
        stats.reconnectButtons += withButton.length
      }
    } catch (error) { fail(`superseded transcripts could not be rebuilt or replayed: ${String(error.message).split('\n')[0].slice(0, 220)}`) }
  }

  // ---- D. units -----------------------------------------------------------------------------------------------------------------
  const flagsOffEnvs = [{}, ALL_FALSE]
  // D1 QuestionCard
  for (const shell of [true, false]) for (const name of Object.keys(CARDS)) {
    const goldenKey = `${name}/shell=${shell}`
    const offs = []
    for (const env of flagsOffEnvs) offs.push(await cardMarkup(root, env, name, shell))
    if (sha(offs[0]) !== GOLDEN.card[goldenKey]) fail(`QuestionCard ${goldenKey}: flag off differs from the base sources' markup`)
    if (offs[0] !== offs[1]) fail(`QuestionCard ${goldenKey}: "false" differs from unset`)
    const on = await cardMarkup(root, { [FLAGS.hint]: 'true' }, name, shell)
    const wanted = shell && CARDS[name].hint
    const count = on.split(HINT_P).length - 1
    if (count !== (wanted ? 1 : 0)) fail(`QuestionCard ${goldenKey}: hint drawn ${count} time(s), expected ${wanted ? 1 : 0}`)
    if (on.split(HINT_P).join('') !== offs[0]) fail(`QuestionCard ${goldenKey}: the hint flag changed the card beyond the hint line`)
    if (wanted && !on.endsWith(`${HINT_P}</div>`)) fail(`QuestionCard ${goldenKey}: the hint is not the last line of the card`)
    for (const other of ['edit', 'error', 'clear', 'reconnect']) {
      if (await cardMarkup(root, { [FLAGS[other]]: 'true' }, name, shell) !== offs[0]) fail(`QuestionCard ${goldenKey}: the ${other} flag changed the card`)
    }
  }
  // D2 header
  {
    const clicks = []
    for (const shell of [true, false]) for (const c of CONNECTIONS) for (const s of STATUSES) for (const loading of [false, true]) {
      const goldenKey = `${c}/${s}/loading=${loading}/shell=${shell}`
      const off = await headerMarkup(root, {}, c, s, loading, false, shell)
      if (sha(off) !== GOLDEN.header[goldenKey]) fail(`header ${goldenKey}: flag off differs from the base sources' markup`)
      const offWithHandler = await headerMarkup(root, {}, c, s, loading, true, shell)
      if (offWithHandler !== off) fail(`header ${goldenKey}: flag off, the onReconnect prop changed the header`)
      if (await headerMarkup(root, ALL_FALSE, c, s, loading, true, shell) !== off) fail(`header ${goldenKey}: "false" differs from unset`)
      const on = await headerMarkup(root, { [FLAGS.reconnect]: 'true' }, c, s, loading, true, shell)
      const onNoHandler = await headerMarkup(root, { [FLAGS.reconnect]: 'true' }, c, s, loading, false, shell)
      if (onNoHandler !== off) fail(`header ${goldenKey}: flag on, but with no onReconnect the header changed`)
      const wanted = shell && !loading && (c === 'disconnected' || c === 'error') && s === 'exhausted'
      const count = on.split(RECONNECT_BUTTON).length - 1
      if (count !== (wanted ? 1 : 0)) fail(`header ${goldenKey}: Reconnect drawn ${count} time(s), expected ${wanted ? 1 : 0}`)
      if (on.split(RECONNECT_BUTTON).join('') !== off) fail(`header ${goldenKey}: the reconnect flag changed the header beyond the button`)
      if (wanted && !on.includes(`${RECONNECT_BUTTON}<span data-actions="true">call</span></header>`)) fail(`header ${goldenKey}: the button must sit in the actions slot, before the actions`)
      for (const other of ['edit', 'error', 'clear', 'hint']) if (await headerMarkup(root, { [FLAGS[other]]: 'true' }, c, s, loading, true, shell) !== off) fail(`header ${goldenKey}: the ${other} flag changed the header`)
      if (wanted) clicks.push(goldenKey)
    }
    if (clicks.length === 0) fail('header: no state offered Reconnect; the button would not be tested')
    // the click calls the handler once, with no argument, and does nothing else
    const w = await world(root, { [SHELL]: 'true', [FLAGS.reconnect]: 'true' })
    const { StudioDirectorHeader } = w.load('components/builder/chat/studio-director-header.tsx')
    const calls = []
    const tree = StudioDirectorHeader({ connectionState: 'disconnected', reconnectStatus: 'exhausted', onReconnect: (...a) => calls.push(a) })
    const button = nodesOf(tree).find(node => node.props?.['data-studio-chat-reconnect'])
    if (!button) fail('header: the Reconnect button is not in the element tree')
    else {
      button.props.onClick({ preventDefault: () => fail('header: the click handler prevents default') })
      if (calls.length !== 1 || calls[0].length !== 0) fail(`header: the click must call onReconnect once with no arguments (got ${JSON.stringify(calls)})`)
      if (Object.keys(button.props).filter(key => /^on[A-Z]/.test(key)).join() !== 'onClick') fail('header: the button must carry one handler, onClick')
    }
  }
  // D3 ribbon
  for (const shell of [true, false]) for (const phase of PHASES) for (const withControl of [true, false]) {
    const goldenKey = `${phase}/control=${withControl}/shell=${shell}`
    const off = await ribbonMarkup(root, {}, phase, withControl, shell)
    if (sha(off) !== GOLDEN.ribbon[goldenKey]) fail(`ribbon ${goldenKey}: flag off differs from the base sources' markup`)
    if (await ribbonMarkup(root, ALL_FALSE, phase, withControl, shell) !== off) fail(`ribbon ${goldenKey}: "false" differs from unset`)
    const on = await ribbonMarkup(root, { [FLAGS.error]: 'true' }, phase, withControl, shell)
    if (shell && phase === 'error') {
      if (/data-testid="bn-controls"/.test(on)) fail(`ribbon ${goldenKey}: the failed build still offers Pause/Stop`)
      if (!SAVED_RE.test(on) || !on.includes(SAVED_TEXT)) fail(`ribbon ${goldenKey}: the saved/retry line is missing`)
      const reverted = on.replace(SAVED_RE, '')
      const expected = withControl ? off.replace(CONTROLS_RE, '') : off
      if (reverted !== expected) fail(`ribbon ${goldenKey}: the flag changed the failed ribbon beyond dropping Pause/Stop and adding the line`)
      if (withControl && !CONTROLS_RE.test(off)) fail(`ribbon ${goldenKey}: the flag-off error ribbon has no controls to drop (the test would prove nothing)`)
    } else if (on !== off) fail(`ribbon ${goldenKey}: the error-state flag changed a ribbon that is not a failed build in the Studio shell`)
    for (const other of ['edit', 'clear', 'reconnect', 'hint']) if (await ribbonMarkup(root, { [FLAGS[other]]: 'true' }, phase, withControl, shell) !== off) fail(`ribbon ${goldenKey}: the ${other} flag changed the ribbon`)
  }
  {
    const off = await ribbonMarkup(root, {}, 'error', true, true, 'none'), on = await ribbonMarkup(root, { [FLAGS.error]: 'true' }, 'error', true, true, 'none')
    if (sha(off) !== GOLDEN.ribbon['error/no-event/control=true/shell=true']) fail('ribbon error/no-event: flag off differs from the base sources')
    if (!on.includes('The build hit an error.') || !on.includes(SAVED_TEXT) || /bn-controls/.test(on)) fail('ribbon error/no-event: flag on must keep the fallback error words, add the line and drop the controls')
  }

  // D4 the two derived helpers, over tables
  {
    const w = await world(root, {})
    const lib = w.load('lib/studio-pass2b-chat.ts')
    const gate = (actions, id = 'g') => ({ type: 'action_request', message_id: id, payload: { actions } })
    const planGate = gate([{ label: "Yes, let's build it!", value: 'accept_plan' }, { label: "I'd like to make changes", value: 'reject_plan' }])
    const outlineGate = gate([{ label: 'Looks perfect!', value: 'accept_strawman' }, { label: 'Make some changes', value: 'request_refinement' }], 'o')
    const doneGate = gate([{ label: 'Done, looks great!', value: 'complete_presentation' }, { label: 'Make adjustments', value: 'request_adjustments', requires_input: true }], 'd')
    const turn = text => ({ id: text, text })
    const rows = [
      ['no turns', [], [planGate], false],
      ["last turn is the plan edit click", [turn('Hello'), turn("I'd like to make changes")], [planGate], true],
      ['outline edit click', [turn('Make some changes')], [outlineGate], true],
      ['padded label', [turn("  I'd like to make changes ")], [planGate], true],
      ['typed after the click', [turn("I'd like to make changes"), turn('Make it five slides')], [planGate], false],
      ['the build click', [turn("Yes, let's build it!")], [planGate], false],
      ['an edit label with the wrong action value', [turn("I'd like to make changes")], [gate([{ label: "I'd like to make changes", value: 'accept_plan' }])], false],
      ['Make adjustments (has its own banner)', [turn('Make adjustments')], [doneGate], false],
      ['no gate in the transcript', [turn("I'd like to make changes")], [{ type: 'chat_message', payload: { text: 'hi' } }], false],
      ['null inputs', null, null, false],
      ['empty text', [turn('')], [planGate], false],
    ]
    for (const [name, users, messages, want] of rows) if (lib.studioChatEditPromptActive(users, messages) !== want) fail(`studioChatEditPromptActive: "${name}" should be ${want}`)
    // stale-notice helper: the scenario table, run through the pure functions...
    const N1 = { type: 'error' }, N2 = { type: 'error' }
    let baseline = null
    const step = (notice, users, bots) => { baseline = lib.nextErrorNoticeBaseline(baseline, notice, users, bots); return lib.errorNoticeStaleAfterRetry(baseline, users, bots) }
    const table = [
      ['no notice', null, 2, 3, false], ['N1 drawn', N1, 2, 3, false], ['user sends', N1, 3, 3, false], ['Director answers', N1, 3, 4, true], ['and stays stale', N1, 3, 5, true],
      ['N2 raised after the answer', N2, 3, 5, false], ['N2: user sends', N2, 4, 5, false], ['N2: Director answers', N2, 4, 6, true],
      ['notice gone', null, 4, 6, false], ['N1 again after it left', N1, 4, 6, false], ['replayed frames, no user turn', N1, 4, 9, false],
    ]
    for (const [name, notice, users, bots, want] of table) if (step(notice, users, bots) !== want) fail(`stale notice: "${name}" should be ${want}`)
    // ...and through the real hook, whose ref must live across renders (the harness's own React host)
    const hook = w.load('hooks/use-studio-stale-error-notice.ts').useStudioStaleErrorNotice
    const seen = []
    const Probe = props => { seen.push(hook(props.enabled, props.notice, props.users, props.bots)); return null }
    const rootHost = new Root()
    const render = props => { rootHost.setElement(React.createElement(Probe, props)); rootHost.flush(); return seen[seen.length - 1] }
    const plan = [
      [true, N1, 1, 1, false], [true, N1, 2, 1, false], [true, N1, 2, 2, true], [true, N2, 2, 2, false], [true, N2, 3, 3, true], [true, null, 3, 3, false],
      [false, N1, 9, 9, false], [true, N1, 9, 9, false], [true, N1, 10, 10, true],
    ]
    for (const [enabled, notice, users, bots, want] of plan) if (render({ enabled, notice, users, bots }) !== want) fail(`useStudioStaleErrorNotice(enabled=${enabled}, users=${users}, bots=${bots}, ${notice === N1 ? 'N1' : notice === N2 ? 'N2' : 'none'}) should be ${want}`)
    rootHost.unmount()
  }

  // D5 the page: the focus effect, extracted from page.tsx and run
  {
    const page = extract.parseSource(path.join(root, 'app/builder/page.tsx'))
    const effect = extract.findCalls(page, 'useEffect').find(call => call.arguments[0].getText(page).includes('editPromptWasActiveRef'))
    if (!effect) fail('page: the edit-prompt focus effect is missing')
    else {
      const make = extract.compile(effect.arguments[0], page, 'edit-prompt focus effect')
      const focuses = []
      const textareaRef = { current: { focus: () => focuses.push('focus') } }
      const scenario = initial => {
        const ref = { current: initial }
        return active => { const before = focuses.length; make({ editPromptWasActiveRef: ref, studioEditPromptActive: active, requestAnimationFrame: callback => callback(), textareaRef })(); return focuses.length - before }
      }
      const mountedActive = scenario(true)
      if (mountedActive(true) !== 0) fail('page focus effect: mounting with the prompt already active (a reload) must not steal focus')
      const run1 = scenario(false)
      const seq = [[false, 0], [true, 1], [true, 0], [false, 0], [true, 1]]
      for (const [active, want] of seq) if (run1(active) !== want) fail(`page focus effect: active=${active} should focus ${want} time(s)`)
      const text = page.text ?? fs.readFileSync(path.join(root, 'app/builder/page.tsx'), 'utf8')
      if (!/const editPromptWasActiveRef = useRef\(studioEditPromptActive\)/.test(text)) fail('page: the focus ref must start at the current value, so the first render is never a start')
      if (!/\}, \[studioEditPromptActive\]\)/.test(effect.getText(page))) fail('page: the focus effect must depend only on studioEditPromptActive')
    }
    const text = read('app/builder/page.tsx')
    const expectText = (pattern, message) => { if (!pattern.test(text)) fail(`page: ${message}`) }
    expectText(/studioEditPrompt=\{studioEditPromptActive \|\| undefined\}/, 'ChatInput must get `studioEditPromptActive || undefined` (undefined with the flag off)')
    expectText(/const studioEditPromptActive = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_EDIT_PROMPT === 'true'\s+&& studioChatEditPromptActive\(session\.userMessages, messages\)/, 'studioEditPromptActive must be false unless the Studio shell and the exact flag')
    expectText(/useStudioStaleErrorNotice\(\s*studioShell && process\.env\.NEXT_PUBLIC_STUDIO_CHAT_ERROR_CLEAR === 'true', transportNotice, session\.userMessages\.length, messages\.length\)/, 'the stale-notice hook must read the exact flag and only the transcript counts')
    expectText(/notice=\{staleErrorNotice \? null : transportNotice\?\.sessionId === \(currentSessionId \|\| wsSessionId\) \? transportNotice : null\}/, 'the notice must stay exactly the base expression when not stale')
    expectText(/noticeType: staleErrorNotice \? null : transportNotice\?\.sessionId === \(currentSessionId \|\| wsSessionId\) \? \(transportNotice\?\.type \?\? null\) : null,/, 'the recovery card input must stay the base expression when not stale')
    expectText(/onReconnect=\{process\.env\.NEXT_PUBLIC_STUDIO_CHAT_RECONNECT === 'true' \? connect : undefined\}/, 'the header must get the page\'s connect() only with the exact flag')
    const hookBlock = text.match(/const \{([\s\S]*?)\} = useDecksterWebSocketV2\(/)?.[1] ?? ''
    if (!/\bconnect,/.test(hookBlock)) fail('page: `connect` must be the Director hook\'s own connect (the one "Use here" calls)')
    expectText(/import '@\/components\/builder\/studio-pass2b-chat\.css'/, 'the stylesheet must be imported')
    // no handler region of the page changed: every anchor of the base is the same, except the four prop expressions this PR owns
    const regions = Object.fromEntries(pageSources(root).regions.map(region => [region.label, region.sha256]))
    // + PASS2B G12 (NEXT_PUBLIC_STUDIO_COMPOSER_STAGE_CONTEXT) adds one flag-gated spread inside the composer context line's call; flag off it is the base's
    //   expression (scripts/test-studio-composer-stage-context.mjs compares the call site, minus that spread, with the base commit's text).
    // + PASS2B G01 (NEXT_PUBLIC_STUDIO_WELCOME_POLISH) adds one flag-gated spread on MessageList (the welcome's greeting name); flag off it adds no prop
    //   (scripts/test-studio-welcome-polish.mjs compares the page, minus that spread, with the base commit's text).
    const OWNED = new Set(['page.<MessageList studioRecovery>', 'page.<StudioDirectorNotice notice>', 'page.<ChatInput studioEditPrompt>', 'page.<StudioDirectorHeader onReconnect>',
      'page.<ChatInput studioContextLabel>', 'page.<MessageList ...0>'])
    for (const [label, hash] of Object.entries(GOLDEN.regions)) if (!OWNED.has(label) && regions[label] !== hash) fail(`page region "${label}" changed (handlers and every other prop expression must stay the base's)`)
    for (const label of Object.keys(regions)) if (!(label in GOLDEN.regions) && !OWNED.has(label)) fail(`page region "${label}" is new and not one of the four this PR owns`)
    for (const label of OWNED) if (!(label in regions)) fail(`page region "${label}" is missing`)
    for (const label of ['page.<ChatInput studioEditPrompt>', 'page.<StudioDirectorHeader onReconnect>']) if (label in GOLDEN.regions) fail(`${label} cannot be in the base golden`)
  }

  // D6 sources: no new import in the four guarded components; flags read at the right places; presentation only; stylesheet scoped; docs
  {
    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(registryRead(file, read(file))).join('\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`) // LATER-CHANGES: registry read (CHAT-CLEAN): the import lines a change registered after this one adds (chat clean's, in chat-input.tsx and message-list.tsx) are its own // LATER-CHANGES: registry read (PAUSED-LABEL)
    const filesUnder = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
    const sources = ['app', 'components', 'hooks', 'lib'].flatMap(filesUnder).filter(file => /\.(tsx?|css)$/.test(file))
    const where = {
      [FLAGS.edit]: ['app/builder/page.tsx', 'components/builder/chat-input.tsx'],
      [FLAGS.error]: ['components/build-narration/stage-ribbon.tsx'],
      [FLAGS.clear]: ['app/builder/page.tsx'],
      [FLAGS.reconnect]: ['app/builder/page.tsx', 'components/builder/chat/studio-director-header.tsx'],
      [FLAGS.hint]: ['components/builder/chat/question-card.tsx'],
    }
    for (const [flag, allowed] of Object.entries(where)) {
      const found = sources.filter(file => read(file).includes(`process.env.${flag}`))
      if (found.sort().join() !== [...allowed].sort().join()) fail(`${flag} is read in ${found.join(', ') || 'no file'}, expected ${allowed.join(', ')}`)
      for (const file of found) for (const line of read(file).split('\n')) if (line.includes(`process.env.${flag}`) && !line.includes(`process.env.${flag} === 'true'`)) fail(`${file}: ${flag} must be compared with exactly 'true': ${line.trim().slice(0, 120)}`)
    }
    const forbidden = /\b(fetch|WebSocket|localStorage|sessionStorage|setTimeout|setInterval|useState|useEffect|useReducer|\.send\(|sendMessage|persist)\b/
    for (const file of ['lib/studio-pass2b-chat.ts', 'hooks/use-studio-stale-error-notice.ts']) {
      const code = read(file).split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
      if (forbidden.test(code)) fail(`${file}: presentation-only code must not send, store, time or hold state (${code.match(forbidden)[0]})`)
    }
    const css = read('components/builder/studio-pass2b-chat.css').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const rule of css.match(/[^{}]+\{/g) ?? []) {
      const selector = rule.trim().replace(/\{$/, '').trim()
      if (selector.startsWith('@media')) continue
      if (!/data-studio-chat-reconnect|data-studio-director-part="approval-hint"|data-studio-build-part="error-recovery"/.test(selector)) fail(`stylesheet: the rule "${selector.slice(0, 90)}" is not keyed to a flag-on attribute`)
    }
    const env = read('.env.example')
    for (const name of Object.values(FLAGS)) if (!new RegExp(`^${name}="false"$`, 'm').test(env)) fail(`.env.example must carry ${name}="false"`)
    const pkg = JSON.parse(read('package.json'))
    if (pkg.scripts['test:studio-pass2b-chat'] !== 'node scripts/test-studio-pass2b-chat.mjs') fail('package.json: the test script is missing')
  }
  return { failures, stats }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Mutation check: break the code in a scratch copy; every break must be caught (the checks run on the transcripts they touch).
const MUTANTS = [
  ['hint drawn with the flag unset', 'components/builder/chat/question-card.tsx', "process.env.NEXT_PUBLIC_STUDIO_APPROVAL_HINT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_APPROVAL_HINT !== 'x'", ['normal-build']],
  ['hint on a skip card', 'components/builder/chat/question-card.tsx', "action.value === 'accept_plan' || action.value === 'accept_strawman'", "action.value === 'accept_plan' || action.value === 'skip_questions' || action.value === 'accept_strawman'", ['normal-build']],
  ['Reconnect while retries are still running', 'components/builder/chat/studio-director-header.tsx', "reconnectStatus === 'exhausted'", "reconnectStatus !== 'idle'", ['reconnect-exhausted', 'reconnect-mid-build']],
  ['Reconnect while superseded (both flags on)', 'components/builder/chat/studio-director-header.tsx', "reconnectStatus === 'exhausted'", "(reconnectStatus === 'exhausted' || reconnectStatus === 'superseded')", ['superseded']],
  ['Reconnect click passes the event', 'components/builder/chat/studio-director-header.tsx', 'onClick={() => onReconnect()}', 'onClick={onReconnect}', ['reconnect-exhausted']],
  ['failed build keeps Pause/Stop', 'components/build-narration/stage-ribbon.tsx', '{control && !buildErrorState ? (', '{control ? (', ['normal-build']],
  ['saved line on every phase', 'components/build-narration/stage-ribbon.tsx', 'const buildErrorState = isError\n    &&', 'const buildErrorState = true\n    &&', ['normal-build']],
  ['stale notice cleared by a user turn alone', 'lib/studio-pass2b-chat.ts', 'userTurns > baseline!.userTurns && botMessages > baseline!.botMessages', 'userTurns > baseline!.userTurns', ['error-retry']],
  ['stale notice cleared by any later turn count', 'lib/studio-pass2b-chat.ts', 'userTurns > baseline!.userTurns &&', 'userTurns >= baseline!.userTurns &&', ['error-retry']],
  ['recovery card keeps the stale notice', 'app/builder/page.tsx', 'noticeType: staleErrorNotice ? null : transportNotice', 'noticeType: transportNotice', ['error-retry']],
  ['edit prompt after any click', 'lib/studio-pass2b-chat.ts', "STUDIO_EDIT_ACTION_VALUES.includes(action.value)", "typeof action.value === 'string'", ['normal-build']],
  ['edit prompt focus on every render', 'app/builder/page.tsx', 'if (studioEditPromptActive && !wasActive) requestAnimationFrame', 'if (studioEditPromptActive) requestAnimationFrame', ['normal-build']],
  ['a handler changed (approval click)', 'app/builder/page.tsx', "session.markStudioUserIntent()\n    const messageId = crypto.randomUUID()", "session.markStudioUserIntent()\n    const messageId = crypto.randomUUID(); void 0", ['normal-build']],
  ['a new import in the composer', 'components/builder/chat-input.tsx', "import { StudioComposerHint } from './studio-composer-hint'", "import { StudioComposerHint } from './studio-composer-hint'\nimport { debugLog as unusedDebug } from '@/lib/debug-log'", ['normal-build']],
]
async function mutationCheck() {
  // One scratch copy per break: the harness caches the page's parsed regions by root path, so a shared root would keep the first break's page for every later one.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pass2b-mutants-'))
  let caught = 0
  const missed = []
  const copyTree = (to) => {
    for (const dir of ['app/builder', 'components', 'hooks', 'lib', 'types']) fs.cpSync(path.join(here, dir), path.join(to, dir), { recursive: true, mode: fs.constants.COPYFILE_FICLONE })
    for (const file of ['package.json', '.env.example']) fs.copyFileSync(path.join(here, file), path.join(to, file))
    fs.symlinkSync(path.join(here, 'node_modules'), path.join(to, 'node_modules'))
  }
  try {
    const wanted = args.includes('--mutant') ? args[args.indexOf('--mutant') + 1] : null
    for (const [index, [name, file, from, to, only]] of MUTANTS.entries()) {
      if (wanted && !name.includes(wanted)) continue
      const original = fs.readFileSync(path.join(here, file), 'utf8')
      if (!original.includes(from)) { missed.push(`${name} (the text to break was not found in ${file})`); continue }
      const root = path.join(scratch, `m${index}`)
      copyTree(root)
      fs.writeFileSync(path.join(root, file), original.replace(from, to))
      let result
      try { result = await checks(root, { only }) } catch (error) { result = { failures: [`threw: ${String(error.message).split('\n')[0]}`] } }
      fs.rmSync(root, { recursive: true, force: true })
      if (result.failures.length) { caught++; console.log(`  caught: ${name}  (${result.failures.length} failing check(s); first: ${result.failures[0].slice(0, 130)})`) } else missed.push(name)
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }) }
  return { caught, missed }
}

const started = Date.now()
const { failures, stats } = await checks(here)
if (failures.length) {
  release()
  console.error(`FAIL: ${failures.length} check(s)\n${failures.map(line => `  - ${line}`).join('\n')}`)
  process.exit(1)
}
console.log(`PASS: PASS2B chat touches. ${stats.runs} transcript runs, flag off equal to the committed base baselines; flag on moves nothing but each flag's own markup`)
console.log(`  approval hint lines ${stats.hintCards}, Reconnect buttons ${stats.reconnectButtons}, stale notices dropped ${stats.noticeDrops}, edit prompts ${stats.editPrompts}; ${((Date.now() - started) / 1000).toFixed(0)} s`)
if (args.includes('--mutation-check')) {
  console.log(`mutation check: ${MUTANTS.length} breaks in a scratch copy`)
  const { caught, missed } = await mutationCheck()
  release()
  if (missed.length) { console.error(`FAIL: ${missed.length} break(s) not caught:\n${missed.map(name => `  - ${name}`).join('\n')}`); process.exit(1) }
  console.log(`PASS: all ${caught} breaks were caught`)
}
release()
