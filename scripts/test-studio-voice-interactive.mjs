/**
 * Studio v4 Director voice / interactive mode — pure helpers.
 *
 * Covers lib/studio-voice-interactive.ts:
 *   - the build-time flag is on ONLY when NEXT_PUBLIC_STUDIO_V4_SHELL and
 *     NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE are both the literal "true"
 *   - voice input is ALWAYS reported unavailable (no approved speech contract)
 *   - spoken replies use only an on-device (localService) voice
 *   - Director reply text extraction / markdown stripping / clipping
 *   - call-duration formatting
 *   - static guard: literal process.env reads (so Next inlines them) and no
 *     microphone / network / storage APIs in the helper module
 *
 * Plain node, no framework — same TS-through-CJS idiom as
 * scripts/test-deck-identity.mjs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const LIB_PATH = '../lib/studio-voice-interactive.ts';

/**
 * Compile a TS helper to CJS and evaluate it in THIS realm (rather than a vm
 * context) so the objects it returns share our intrinsics and `deepEqual`
 * works. `process` is a parameter, so each load sees exactly the env it is
 * given — the real environment is neither read nor mutated.
 */
function loadTsModule(relativePath, env = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const mod = { exports: {} };
  const factory = new Function('module', 'exports', 'require', 'process', compiled.outputText);
  factory(mod, mod.exports, require, { ...process, env: { ...env } });
  return mod.exports;
}

const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL';
const VOICE = 'NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE';

/** Load with exactly these two flags; `undefined` means the key is absent. */
function loadWithFlags(shell, voice) {
  const env = {};
  if (shell !== undefined) env[SHELL] = shell;
  if (voice !== undefined) env[VOICE] = voice;
  return loadTsModule(LIB_PATH, env);
}

const lib = loadWithFlags(undefined, undefined);
const {
  studioVoiceInteractiveFlagOn,
  speechInputStatus,
  pickLocalVoice,
  speechOutputStatus,
  directorReplyText,
  latestDirectorReply,
  clipForSpeech,
  formatCallDuration,
} = lib;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// ---------------------------------------------------------------------------
// 1. Flag
// ---------------------------------------------------------------------------

check('flag is ON only when both values are the literal "true"', () => {
  assert.equal(loadWithFlags('true', 'true').STUDIO_VOICE_INTERACTIVE_ENABLED, true);
});

check('flag is OFF for every non-literal / partial combination (module load)', () => {
  const offValues = [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes', 'on'];
  for (const bad of offValues) {
    // shell on, voice-interactive bad
    assert.equal(
      loadWithFlags('true', bad).STUDIO_VOICE_INTERACTIVE_ENABLED,
      false,
      `shell "true" + voice ${JSON.stringify(bad)} must be OFF`,
    );
    // shell bad, voice-interactive on
    assert.equal(
      loadWithFlags(bad, 'true').STUDIO_VOICE_INTERACTIVE_ENABLED,
      false,
      `shell ${JSON.stringify(bad)} + voice "true" must be OFF`,
    );
    // both bad
    assert.equal(
      loadWithFlags(bad, bad).STUDIO_VOICE_INTERACTIVE_ENABLED,
      false,
      `both ${JSON.stringify(bad)} must be OFF`,
    );
  }
});

check('flag is OFF when everything is unset', () => {
  assert.equal(loadWithFlags(undefined, undefined).STUDIO_VOICE_INTERACTIVE_ENABLED, false);
});

check('flag is OFF when shell is off and voice-interactive is on', () => {
  assert.equal(loadWithFlags('false', 'true').STUDIO_VOICE_INTERACTIVE_ENABLED, false);
  assert.equal(loadWithFlags(undefined, 'true').STUDIO_VOICE_INTERACTIVE_ENABLED, false);
});

check('flag is OFF when shell is on and voice-interactive is unset', () => {
  assert.equal(loadWithFlags('true', undefined).STUDIO_VOICE_INTERACTIVE_ENABLED, false);
});

check('studioVoiceInteractiveFlagOn: truth table', () => {
  assert.equal(studioVoiceInteractiveFlagOn('true', 'true'), true);
  assert.equal(studioVoiceInteractiveFlagOn(undefined, undefined), false);
  assert.equal(studioVoiceInteractiveFlagOn('true', undefined), false);
  assert.equal(studioVoiceInteractiveFlagOn(undefined, 'true'), false);
  assert.equal(studioVoiceInteractiveFlagOn('false', 'true'), false);
  assert.equal(studioVoiceInteractiveFlagOn('true', 'false'), false);
  assert.equal(studioVoiceInteractiveFlagOn('', ''), false);
  assert.equal(studioVoiceInteractiveFlagOn('TRUE', 'TRUE'), false);
  assert.equal(studioVoiceInteractiveFlagOn('1', '1'), false);
  assert.equal(studioVoiceInteractiveFlagOn(' true', 'true'), false);
  assert.equal(studioVoiceInteractiveFlagOn('true', ' true'), false);
  assert.equal(studioVoiceInteractiveFlagOn('true', 'true '), false);
});

// ---------------------------------------------------------------------------
// 2. speechInputStatus — always unavailable
// ---------------------------------------------------------------------------

check('speechInputStatus is never available (undefined / empty / with recognition)', () => {
  const windows = [
    undefined,
    {},
    { SpeechRecognition: undefined, webkitSpeechRecognition: undefined },
    { SpeechRecognition: function SpeechRecognition() {} },
    { webkitSpeechRecognition: function webkitSpeechRecognition() {} },
    { SpeechRecognition: function A() {}, webkitSpeechRecognition: function B() {} },
  ];
  for (const win of windows) {
    const status = speechInputStatus(win);
    assert.equal(status.available, false, `must be unavailable for ${JSON.stringify(win)}`);
    assert.equal(typeof status.reason, 'string');
    assert.ok(status.reason.trim().length > 0, 'reason must be non-empty');
  }
  assert.equal(speechInputStatus().available, false);
});

check('speechInputStatus reason differs when the browser has recognition', () => {
  const without = speechInputStatus({});
  const withStd = speechInputStatus({ SpeechRecognition: function () {} });
  const withWebkit = speechInputStatus({ webkitSpeechRecognition: function () {} });
  assert.notEqual(without.reason, withStd.reason);
  assert.equal(withStd.reason, withWebkit.reason);
  assert.equal(speechInputStatus(undefined).reason, without.reason);
});

// ---------------------------------------------------------------------------
// 3. pickLocalVoice
// ---------------------------------------------------------------------------

const v = (name, lang, localService, def) => ({ name, lang, localService, ...(def === undefined ? {} : { default: def }) });

check('pickLocalVoice returns null for no voices', () => {
  assert.equal(pickLocalVoice([]), null);
});

check('pickLocalVoice returns null when there is no localService voice, even if remote voices exist', () => {
  const remoteOnly = [v('Remote EN', 'en-US', false, true), v('Remote FR', 'fr-FR', false)];
  assert.equal(pickLocalVoice(remoteOnly), null);
  assert.equal(pickLocalVoice(remoteOnly, 'fr'), null);
});

check('pickLocalVoice never returns a remote voice', () => {
  const voices = [
    v('Remote EN default', 'en-US', false, true),
    v('Remote EN', 'en-GB', false),
    v('Local DE', 'de-DE', true),
  ];
  const picked = pickLocalVoice(voices, 'en');
  assert.ok(picked && picked.localService === true, 'picked voice must be local');
  assert.equal(picked.name, 'Local DE');
  for (const lang of ['en', 'en-US', 'de', 'fr', undefined]) {
    const p = pickLocalVoice(voices, lang);
    assert.ok(p === null || p.localService === true);
  }
});

check('pickLocalVoice prefers the same base language (en-GB matches preference "en")', () => {
  const voices = [v('Local DE', 'de-DE', true, true), v('Local EN-GB', 'en-GB', true), v('Local FR', 'fr-FR', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'Local EN-GB');
  // base-language comparison also ignores the preferred region and case
  assert.equal(pickLocalVoice(voices, 'en-US').name, 'Local EN-GB');
  assert.equal(pickLocalVoice(voices, 'EN-us').name, 'Local EN-GB');
  assert.equal(pickLocalVoice(voices, 'fr').name, 'Local FR');
});

check('pickLocalVoice defaults the preferred language to "en"', () => {
  const voices = [v('Local DE', 'de-DE', true, true), v('Local EN', 'en-AU', true)];
  assert.equal(pickLocalVoice(voices).name, 'Local EN');
});

check('pickLocalVoice prefers `default` within the language pool', () => {
  const voices = [v('A', 'en-US', true), v('B', 'en-GB', true, true), v('C', 'en-AU', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'B');
});

check('pickLocalVoice takes the first of the pool when none is default', () => {
  const voices = [v('A', 'en-US', true), v('B', 'en-GB', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'A');
});

check('pickLocalVoice does not let a non-matching default beat a language match', () => {
  const voices = [v('Default DE', 'de-DE', true, true), v('Plain EN', 'en-US', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'Plain EN');
});

check('pickLocalVoice does not let a remote default beat a local voice', () => {
  const voices = [v('Remote default', 'en-US', false, true), v('Local EN', 'en-US', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'Local EN');
});

check('pickLocalVoice falls back to any local voice when no language matches', () => {
  const voices = [v('Local DE', 'de-DE', true), v('Local FR', 'fr-FR', true)];
  assert.equal(pickLocalVoice(voices, 'en').name, 'Local DE');
  // and prefers default within the whole local pool
  const withDefault = [v('Local DE', 'de-DE', true), v('Local FR', 'fr-FR', true, true)];
  assert.equal(pickLocalVoice(withDefault, 'en').name, 'Local FR');
});

check('pickLocalVoice returns the original object (identity), not a copy', () => {
  const target = v('Only', 'en-US', true);
  assert.equal(pickLocalVoice([target], 'en'), target);
});

// ---------------------------------------------------------------------------
// 4. speechOutputStatus
// ---------------------------------------------------------------------------

check('speechOutputStatus unavailable without synthesis', () => {
  const s = speechOutputStatus(false, null);
  assert.equal(s.available, false);
  assert.ok(s.reason.trim().length > 0);
  // a voice does not rescue a browser with no synthesis
  const s2 = speechOutputStatus(false, v('Local EN', 'en-US', true));
  assert.equal(s2.available, false);
  assert.ok(s2.reason.trim().length > 0);
});

check('speechOutputStatus unavailable with a null voice', () => {
  const s = speechOutputStatus(true, null);
  assert.equal(s.available, false);
  assert.ok(s.reason.trim().length > 0);
  assert.notEqual(s.reason, speechOutputStatus(false, null).reason);
});

check('speechOutputStatus available with a voice, and the reason names it', () => {
  const s = speechOutputStatus(true, v('Samantha', 'en-US', true));
  assert.equal(s.available, true);
  assert.ok(s.reason.includes('Samantha'), `reason should mention the voice name, got: ${s.reason}`);
});

// ---------------------------------------------------------------------------
// 5. directorReplyText
// ---------------------------------------------------------------------------

const chat = (text, extra = {}, id) => ({
  ...(id === undefined ? {} : { message_id: id }),
  type: 'chat_message',
  payload: { text, ...extra },
});

check('directorReplyText is null for non chat_message types', () => {
  assert.equal(directorReplyText({ type: 'action_request', payload: { text: 'Hello' } }), null);
  assert.equal(directorReplyText({ type: 'status_update', payload: { text: 'Working' } }), null);
  assert.equal(directorReplyText({ type: 'slide_update', payload: { text: 'x' } }), null);
  assert.equal(directorReplyText({ payload: { text: 'no type' } }), null);
});

check('directorReplyText is null for null / undefined / missing payload', () => {
  assert.equal(directorReplyText(null), null);
  assert.equal(directorReplyText(undefined), null);
  assert.equal(directorReplyText({ type: 'chat_message' }), null);
});

check('directorReplyText is null for ephemeral chat messages', () => {
  assert.equal(directorReplyText(chat('Thinking...', { ephemeral: true })), null);
  // only the literal boolean true is ephemeral
  assert.equal(directorReplyText(chat('Real reply', { ephemeral: false })), 'Real reply');
});

check('directorReplyText is null for missing / non-string / blank text', () => {
  assert.equal(directorReplyText({ type: 'chat_message', payload: {} }), null);
  assert.equal(directorReplyText({ type: 'chat_message', payload: { text: 42 } }), null);
  assert.equal(directorReplyText({ type: 'chat_message', payload: { text: null } }), null);
  assert.equal(directorReplyText(chat('')), null);
  assert.equal(directorReplyText(chat('   \n\t ')), null);
  assert.equal(directorReplyText(chat('**')), null);
});

check('directorReplyText strips markdown: links keep their label', () => {
  assert.equal(
    directorReplyText(chat('See [the plan](https://example.com/plan?x=1) for details.')),
    'See the plan for details.',
  );
});

check('directorReplyText strips markdown: images are dropped', () => {
  assert.equal(directorReplyText(chat('Before ![chart](https://example.com/c.png) after')), 'Before after');
});

check('directorReplyText strips markdown: code fences are removed', () => {
  const out = directorReplyText(chat('Run this:\n```js\nconst secret = 1\n```\nDone.'));
  assert.equal(out, 'Run this: Done.');
  assert.ok(!out.includes('secret'));
  assert.ok(!out.includes('`'));
});

check('directorReplyText strips markdown: **bold** becomes bold', () => {
  assert.equal(directorReplyText(chat('This is **bold** text')), 'This is bold text');
  assert.equal(directorReplyText(chat('**Bold** start')), 'Bold start');
});

check('directorReplyText strips other markdown markers (italics, inline code, headings, quotes)', () => {
  assert.equal(directorReplyText(chat('# Title\n> quoted *italic* `code`')), 'Title quoted italic code');
});

check('directorReplyText joins list_items after the text with ". "', () => {
  assert.equal(
    directorReplyText(chat('Options', { list_items: ['First', 'Second', 'Third'] })),
    'Options. First. Second. Third',
  );
});

check('directorReplyText ignores non-string list_items and non-array list_items', () => {
  assert.equal(directorReplyText(chat('Options', { list_items: ['Keep', 7, null, { a: 1 }] })), 'Options. Keep');
  assert.equal(directorReplyText(chat('Options', { list_items: 'not an array' })), 'Options');
  assert.equal(directorReplyText(chat('Options', { list_items: [] })), 'Options');
});

check('directorReplyText strips markdown inside list_items too', () => {
  assert.equal(
    directorReplyText(chat('Pick one', { list_items: ['**Fast** option', '[Slow](https://x.test) option'] })),
    'Pick one. Fast option. Slow option',
  );
});

check('directorReplyText collapses whitespace and newlines', () => {
  assert.equal(directorReplyText(chat('  one \n\n  two\t\tthree   ')), 'one two three');
});

// ---------------------------------------------------------------------------
// 6. latestDirectorReply
// ---------------------------------------------------------------------------

check('latestDirectorReply returns null for an empty list', () => {
  assert.equal(latestDirectorReply([]), null);
});

check('latestDirectorReply returns null when nothing is speakable', () => {
  assert.equal(
    latestDirectorReply([
      { message_id: 'a', type: 'status_update', payload: { text: 'Working' } },
      chat('Thinking', { ephemeral: true }, 'b'),
    ]),
    null,
  );
});

check('latestDirectorReply picks the last non-ephemeral chat_message', () => {
  const messages = [
    chat('First reply', {}, 'm1'),
    chat('Second reply', {}, 'm2'),
    chat('Draft', { ephemeral: true }, 'm3'),
    { message_id: 'm4', type: 'status_update', payload: { text: 'Building slides' } },
  ];
  assert.deepEqual(latestDirectorReply(messages), { id: 'm2', text: 'Second reply' });
});

check('latestDirectorReply skips trailing ephemeral and status messages', () => {
  const messages = [
    chat('Only real reply', {}, 'real'),
    chat('typing...', { ephemeral: true }, 'e1'),
    { message_id: 's1', type: 'status_update', payload: { text: 'Updating' } },
    { message_id: 'a1', type: 'action_request', payload: { text: 'Approve?' } },
    chat('typing again', { ephemeral: true }, 'e2'),
  ];
  assert.deepEqual(latestDirectorReply(messages), { id: 'real', text: 'Only real reply' });
});

check('latestDirectorReply returns the cleaned text and falls back to an index id', () => {
  const messages = [chat('Hi **there**'), chat('Latest [link](https://x.test)')];
  assert.deepEqual(latestDirectorReply(messages), { id: 'index-1', text: 'Latest link' });
});

check('latestDirectorReply does not mutate its input', () => {
  const messages = Object.freeze([Object.freeze(chat('Hello', {}, 'x'))]);
  assert.deepEqual(latestDirectorReply(messages), { id: 'x', text: 'Hello' });
});

// ---------------------------------------------------------------------------
// 7. clipForSpeech
// ---------------------------------------------------------------------------

const CLIP_SUFFIX = 'The full reply is in the chat.';

check('clipForSpeech leaves text at or under max unchanged', () => {
  assert.equal(clipForSpeech('Short reply.'), 'Short reply.');
  assert.equal(clipForSpeech('x'.repeat(600)), 'x'.repeat(600));
  assert.equal(clipForSpeech('abcde', 5), 'abcde');
  assert.equal(clipForSpeech(''), '');
});

check('clipForSpeech clips long text with the chat suffix (no sentence stop)', () => {
  const long = 'x'.repeat(2000);
  const out = clipForSpeech(long);
  assert.ok(out.endsWith(CLIP_SUFFIX), 'must end with the suffix');
  assert.ok(out.length < long.length, 'must be shorter than the original');
  assert.ok(out.length < long.length + CLIP_SUFFIX.length, 'must be shorter than original + suffix');
  assert.ok(out.length <= 600 + 1 + CLIP_SUFFIX.length, 'must stay within max + suffix');
});

check('clipForSpeech cuts at the last sentence stop past half of max', () => {
  const sentence = 'This is a sentence. ';
  const long = sentence.repeat(100);
  const out = clipForSpeech(long, 100);
  assert.ok(out.endsWith(`. ${CLIP_SUFFIX}`) || out.endsWith(`.${' '}${CLIP_SUFFIX}`), `got: ${out}`);
  assert.ok(out.length < long.length);
  const body = out.slice(0, out.length - CLIP_SUFFIX.length - 1);
  assert.ok(body.endsWith('.'), 'body must end on a sentence boundary');
  assert.ok(body.length <= 100);
});

check('clipForSpeech honours a custom max', () => {
  const out = clipForSpeech('y'.repeat(50), 10);
  assert.ok(out.endsWith(CLIP_SUFFIX));
  assert.ok(out.startsWith('y'.repeat(10)));
});

// ---------------------------------------------------------------------------
// 8. formatCallDuration
// ---------------------------------------------------------------------------

check('formatCallDuration formats m:ss and h:mm:ss', () => {
  assert.equal(formatCallDuration(0), '0:00');
  assert.equal(formatCallDuration(6), '0:06');
  assert.equal(formatCallDuration(59), '0:59');
  assert.equal(formatCallDuration(60), '1:00');
  assert.equal(formatCallDuration(65), '1:05');
  assert.equal(formatCallDuration(599), '9:59');
  assert.equal(formatCallDuration(3599), '59:59');
  assert.equal(formatCallDuration(3600), '1:00:00');
  assert.equal(formatCallDuration(3661), '1:01:01');
  assert.equal(formatCallDuration(36000), '10:00:00');
});

check('formatCallDuration clamps negatives to 0:00 and floors fractions', () => {
  assert.equal(formatCallDuration(-1), '0:00');
  assert.equal(formatCallDuration(-3600), '0:00');
  assert.equal(formatCallDuration(59.9), '0:59');
  assert.equal(formatCallDuration(0.4), '0:00');
  assert.equal(formatCallDuration(65.99), '1:05');
});

// ---------------------------------------------------------------------------
// 9. Static source guard (text only, nothing executed)
// ---------------------------------------------------------------------------

const libSource = fs.readFileSync(new URL(LIB_PATH, import.meta.url), 'utf8');

check('static guard: both flags are read as literal process.env.NEXT_PUBLIC_* (so Next inlines them)', () => {
  assert.ok(
    libSource.includes('process.env.NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE'),
    'must read process.env.NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE literally',
  );
  assert.ok(
    libSource.includes('process.env.NEXT_PUBLIC_STUDIO_V4_SHELL'),
    'must read process.env.NEXT_PUBLIC_STUDIO_V4_SHELL literally',
  );
  // no dynamic env access, which Next cannot inline
  assert.ok(!/process\.env\s*\[/.test(libSource), 'must not use dynamic process.env[...] access');
  assert.ok(!/\{[^}]*\}\s*=\s*process\.env/.test(libSource), 'must not destructure process.env');
});

check('static guard: no microphone, network, socket or storage APIs in the helper module', () => {
  for (const banned of ['getUserMedia', 'fetch(', 'WebSocket', 'localStorage']) {
    assert.ok(!libSource.includes(banned), `lib/studio-voice-interactive.ts must not contain ${banned}`);
  }
});

check('latestPendingAsk: newest unanswered action_request only; answered or absent → null', () => {
  const { latestPendingAsk } = loadTsModule(LIB_PATH, {});
  const ask = (id, prompt) => ({ message_id: id, type: 'action_request', payload: { prompt_text: prompt, actions: [] } });
  const reply = (id) => ({ message_id: id, type: 'chat_message', payload: { text: 'hi' } });
  assert.equal(latestPendingAsk([], new Set()), null);
  assert.equal(latestPendingAsk([reply('r1')], new Set()), null);
  assert.deepEqual(latestPendingAsk([ask('a1', ' Approve outline? '), reply('r2')], new Set()), { id: 'a1', prompt: 'Approve outline?' });
  // A newer question supersedes an older one; an answered newest one hides the pointer.
  assert.equal(latestPendingAsk([ask('a1', 'old'), ask('a2', 'new')], new Set()).id, 'a2');
  assert.equal(latestPendingAsk([ask('a1', 'old'), ask('a2', 'new')], new Set(['a2'])), null);
  assert.equal(latestPendingAsk([ask('a1', '')], null).prompt, 'The Director needs your input.');
  assert.equal(latestPendingAsk([{ type: 'action_request', payload: {} }], new Set()), null, 'no id → no pointer');
});

// ---------------------------------------------------------------------------
// 10. Integration guards: OFF leaves the Builder unchanged; no hidden media
// ---------------------------------------------------------------------------

const pageSource = fs.readFileSync(new URL('../app/builder/page.tsx', import.meta.url), 'utf8');
const hookSource = fs.readFileSync(new URL('../components/builder/voice-interactive/use-director-call.ts', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../components/builder/voice-interactive/director-call.tsx', import.meta.url), 'utf8');
const headerSource = fs.readFileSync(new URL('../components/builder/chat/studio-director-header.tsx', import.meta.url), 'utf8');

check('page: the call panel and header entry render only behind the centralized flag', () => {
  assert.ok(pageSource.includes('const voiceInteractive = STUDIO_VOICE_INTERACTIVE_ENABLED'));
  assert.ok(pageSource.includes('{voiceInteractive && (\n                    <DirectorCallPanel'), 'panel must be gated by voiceInteractive');
  assert.ok(pageSource.includes('actions={voiceInteractive ? <DirectorCallEntry'), 'header entry must be gated');
  assert.ok(pageSource.includes('enabled: voiceInteractive,'), 'hook must receive the flag');
});

check('page: the call reuses the existing send path (no new send/transport call sites)', () => {
  for (const banned of ['directorCall.send', 'sendMessage(', 'new WebSocket']) {
    assert.ok(!viewSource.includes(banned) && !hookSource.includes(banned), `call code must not contain ${banned}`);
  }
});

check('header: renders actions only when given; no flag of its own changes', () => {
  assert.ok(headerSource.includes('if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true") return null'));
  assert.ok(headerSource.includes('{actions}'));
});

check('hook: every listener/timer/speech effect is gated on an open call; no mic, fetch or storage', () => {
  for (const banned of ['getUserMedia', 'fetch(', 'WebSocket', 'localStorage', 'sessionStorage', 'SpeechRecognition(']) {
    assert.ok(!hookSource.includes(banned), `hook must not contain ${banned}`);
    assert.ok(!viewSource.includes(banned), `view must not contain ${banned}`);
  }
  const effects = hookSource.split('useEffect(').slice(1);
  const gated = effects.filter(body => /^\(\) => \{\n\s+if \(!inCall(?: \|\| !outputOn)?\) return/.test(body));
  // capabilities, timer, speech, hidden-tab => 4 gated; plus scope-change and unmount cleanup.
  assert.equal(gated.length, 4, `expected 4 inCall-gated effects, got ${gated.length}`);
  assert.equal(effects.length, 6);
  assert.ok(hookSource.includes('mode: enabled ? mode : "chat"'), 'flag off must report chat mode');
  assert.ok(hookSource.includes('if (!enabled) return'), 'start must refuse when the flag is off');
});

check('view: microphone control is always disabled (no approved speech-input contract)', () => {
  assert.ok(/<button type="button" disabled aria-disabled="true" aria-label="Voice input unavailable"/.test(viewSource));
});

console.log(`\n${passed} checks passed.`);
