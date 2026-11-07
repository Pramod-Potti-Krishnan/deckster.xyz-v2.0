// P4-19: exact, reversible compatibility views for older Studio source proofs. No runtime code is changed.
export const VOICE_CORE_ENV_BLOCK = "# Director companion calls: opt in only (P4-19).\nNEXT_PUBLIC_STUDIO_VOICE_CALL=false\n";
export const VOICE_CORE_SCOPE_FILES = new Set([
  "scripts/test-studio-api-hardening.mjs",
  ".env.example",
  "docs/p4-19/RESULT.md",
  "docs/p4-19/VOICE-CORE.md",
  "docs/p4-19/source-inventory.json",
  "docs/p4-19/studio-comparison.json",
  "lib/studio/voice/avatar-rig.ts",
  "lib/studio/voice/bird-motion.ts",
  "lib/studio/voice/call-state.ts",
  "lib/studio/voice/companion-face.ts",
  "lib/studio/voice/flag.ts",
  "lib/studio/voice/format.ts",
  "lib/studio/voice/gestures.ts",
  "lib/studio/voice/index.ts",
  "lib/studio/voice/mic-errors.ts",
  "lib/studio/voice/sentences.ts",
  "lib/studio/voice/tone.ts",
  "lib/studio/voice/turns.ts",
  "lib/studio/voice/vad.ts",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/fixtures/studio-voice-core/bird-motion.test.ts",
  "scripts/fixtures/studio-voice-core/companion-face.test.ts",
  "scripts/fixtures/studio-voice-core/companion-clips.test.ts",
  "scripts/fixtures/studio-voice-core/voice-avatar-rig.test.ts",
  "scripts/fixtures/studio-voice-core/voice-call-state.test.ts",
  "scripts/fixtures/studio-voice-core/voice-flag.test.ts",
  "scripts/fixtures/studio-voice-core/voice-format.test.ts",
  "scripts/fixtures/studio-voice-core/voice-mic-errors.test.ts",
  "scripts/fixtures/studio-voice-core/voice-proof-registry.test.ts",
  "scripts/fixtures/studio-voice-core/voice-sentences.test.ts",
  "scripts/fixtures/studio-voice-core/voice-tone.test.ts",
  "scripts/fixtures/studio-voice-core/voice-turns.test.ts",
  "scripts/fixtures/studio-voice-core/voice-vad.test.ts",
  "scripts/studio-later-changes.mjs",
  "scripts/studio-voice-core-strip.mjs",
  "scripts/studio-voice-vitest.config.mjs",
  "scripts/test-studio-chat-element-edit.mjs",
  "scripts/test-studio-chat-element-refine.mjs",
  "scripts/test-studio-chat-theme-export.mjs",
  "scripts/test-studio-deck-mutation-dedupe.mjs",
  "scripts/test-studio-deck-sync-truth.mjs",
  "scripts/test-studio-launch-wording.mjs",
  "scripts/test-studio-legal-short-links.mjs",
  "scripts/test-studio-model-catalog.mjs",
  "scripts/test-studio-model-choice.mjs",
  "scripts/test-studio-narration-router.mjs",
  "scripts/test-studio-p2-docs.mjs",
  "scripts/test-studio-p2-polish.mjs",
  "scripts/test-studio-p2-profile-page.mjs",
  "scripts/test-studio-p2-publish.mjs",
  "scripts/test-studio-stage-open-gate.mjs",
  "scripts/test-studio-uat-marketing.mjs"
]);
export const VOICE_CORE_KNOWN_SUBJECTS = [
  "Port pure Director voice core and fixture tests behind opt-in flag",
  "Add safe companion gesture hints and legacy clip fallbacks",
  "Document final Director voice fields and sentence-gap gesture wiring"
];
export function isVoiceCoreCommitSubject(value) {
  const subject = String(value).trim();
  return VOICE_CORE_KNOWN_SUBJECTS.includes(subject) || subject.startsWith("Voice core:") || subject.startsWith("Voice call:") || subject === "Voice: restore chat input focus when a call ends"; // VOICE-CALL: the voice call UI (P4-20) is the next change of the same family; the older scope proofs leave its "Voice call:" commits out too, and its one commit named without the prefix (5e02a8ee, history is not rewritten)
}
export const VOICE_CORE_SCOPE_PIN = "  shas.splice(0, shas.length, ...shas.filter(sha => !isVoiceCoreCommitSubject(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): the pure voice port owns these later commits; this proof still checks its original files\n";
export const VOICE_CORE_PROOF_EDITS = {
  "scripts/test-studio-api-hardening.mjs": [
    [
      "const otherStrips = (rel, text) => typeof text !== 'string' ? text : ((t) => rel !== 'prisma/schema.prisma' ? t : LATER_STRIPS.filter(fn => fn !== strip.stripApiHardening).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, t))(LATER_STRIPS.slice(LATER_STRIPS.indexOf(strip.stripApiHardening) + 1).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text)) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE, carrier 2): every owned file is first read past the changes registered AFTER this one (the voice port teaches the legal short links proof two lines); then, as before, // LATER-CHANGES: registry read (API-HARDENING, Option L chain): the schema is read as this change left it, whatever the changes registered before it marked in it (#576's schema model, added after BASE); every other owned file is compared as before, because the registered strips of changes already in BASE put back older text this change's pairs do not expect\n",
      "const otherStrips = (rel, text) => typeof text !== 'string' || rel !== 'prisma/schema.prisma' ? text : LATER_STRIPS.filter(fn => fn !== strip.stripApiHardening).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text) // LATER-CHANGES: registry read (API-HARDENING, Option L chain): the schema is read as this change left it, whatever the changes registered before it marked in it (#576's schema model, added after BASE); every other owned file is compared as before, because the registered strips of changes already in BASE put back older text this change's pairs do not expect\n"
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:Port pure Director voice core and fixture tests behind opt-in flag$|Add safe companion gesture hints and legacy clip fallbacks$|Document final Director voice fields and sentence-gap gesture wiring$|Voice core:)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): the pure voice port owns these later commits; this proof still checks its original files\n",
      ""
    ],
    [
      "import { isVoiceCoreCommitSubject } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): only the voice port's bounded commit subjects are excluded\n",
      ""
    ],
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !isVoiceCoreCommitSubject(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): the pure voice port owns these later commits; this proof still checks its original files\n",
      ""
    ],
    [
      "import { isVoiceCoreCommitSubject, stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only this port's exact proof metadata\n",
      ""
    ],
    [
      "  for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) assert.equal(sha(stripPeers(rel, stripDeckSyncTruth(rel, stripVoiceCore(rel, rawText(rel))))), sha(stripPeers(rel, gitText(rel, BASE))), `${rel} (an older proof taught to read through the registry)`)\n",
      "  for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) assert.equal(sha(stripPeers(rel, stripDeckSyncTruth(rel, rawText(rel)))), sha(stripPeers(rel, gitText(rel, BASE))), `${rel} (an older proof taught to read through the registry)`)\n"
    ]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "import { isVoiceCoreCommitSubject } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): only the voice port's bounded commit subjects are excluded\n",
      ""
    ],
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !isVoiceCoreCommitSubject(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): the pure voice port owns these later commits; this proof still checks its original files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-mutation-dedupe.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripDeckSyncTruth(rel, stripFirstPaint(rel, stripLaunchWording(rel, stripVoiceCore(rel, readFileSync(path.join(repoRoot, rel), 'utf8'))))) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): the lines of the change stacked after this one come out first\n",
      "const read = rel => stripDeckSyncTruth(rel, stripFirstPaint(rel, stripLaunchWording(rel, readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (DECK-SYNC-TRUTH): the lines of the change stacked after this one come out first\n"
    ]
  ],
  "scripts/test-studio-launch-wording.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripLaterChanges(rel, stripVoiceCore(rel, fs.readFileSync(path.join(root, rel), 'utf8')))\n",
      "const read = rel => stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8'))\n"
    ]
  ],
  "scripts/test-studio-legal-short-links.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripVoiceCore(rel, (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8')))\n",
      "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"
    ]
  ],
  "scripts/test-studio-model-catalog.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, stripVoiceCore(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'))))\n",
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')))\n"
    ],
    [
      "import { stripVoiceCore, voiceCoreProofDiffLines } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only this port's exact proof metadata\n",
      ""
    ],
    [
      "  const lines = (rel, sign) => voiceCoreProofDiffLines(rel, git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n')).filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))\n",
      "  const lines = (rel, sign) => git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n').filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))\n"
    ]
  ],
  "scripts/test-studio-narration-router.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const tryRead = rel => { try { return stripApiHardening(rel, stripVoiceCore(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) } catch { return null } } // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip\n",
      "const tryRead = rel => { try { return stripApiHardening(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')) } catch { return null } } // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip\n"
    ],
    [
      "import { stripVoiceCore, voiceCoreProofDiffLines } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only this port's exact proof metadata\n",
      ""
    ],
    [
      "    const lines = (rel, sign) => voiceCoreProofDiffLines(rel, (gitOut('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel) ?? '').split('\\n')).filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))\n",
      "    const lines = (rel, sign) => (gitOut('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel) ?? '').split('\\n').filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))\n"
    ]
  ],
  "scripts/test-studio-p2-docs.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, stripVoiceCore(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)\n",
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)\n"
    ]
  ],
  "scripts/test-studio-p2-polish.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, stripVoiceCore(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))\n",
      "const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))\n"
    ]
  ],
  "scripts/test-studio-p2-profile-page.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripVoiceCore(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))\n",
      "const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')\n"
    ]
  ],
  "scripts/test-studio-p2-publish.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const read = rel => stripP2Polish(rel, stripVoiceCore(rel, fs.readFileSync(path.join(root, rel), 'utf8')))\n",
      "const read = rel => stripP2Polish(rel, fs.readFileSync(path.join(root, rel), 'utf8'))\n"
    ]
  ],
  "scripts/test-studio-uat-marketing.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "const readFile = file => stripApiHardening(rel(file), stripVoiceCore(file, fs.readFileSync(path.join(repoRoot, rel(file)), 'utf8'))) // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip\n",
      "const readFile = file => stripApiHardening(rel(file), fs.readFileSync(path.join(repoRoot, rel(file)), 'utf8')) // LATER-CHANGE: PROGRAM-1 API hardening reads through its strip\n"
    ]
  ],
  "scripts/test-studio-stage-open-gate.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): remove only this later port's exact test metadata\n",
      ""
    ],
    [
      "    for (const line of diffLines(normDiff({ norm: (r, text) => r === rel ? stripVoiceCore(r, text) : ctx.norm(r, text) }, rel, head))) if (line.startsWith('+')) assert.ok(line.includes(STAGE_OPEN_GATE_PIN_MARK), `${rel}: an added line without the mark: ${line.slice(0, 100)}`)\n",
      "    for (const line of diffLines(normDiff({ norm: (r, text) => r === rel ? text : ctx.norm(r, text) }, rel, head))) if (line.startsWith('+')) assert.ok(line.includes(STAGE_OPEN_GATE_PIN_MARK), `${rel}: an added line without the mark: ${line.slice(0, 100)}`)\n"
    ]
  ],
  "scripts/test-studio-chat-element-refine.mjs": [
    [
      "import { voiceCoreProofDiffLines } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only this port's exact proof metadata\n",
      ""
    ],
    [
      "    const removed = voiceCoreProofDiffLines(rel, git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n')).filter(line => line.startsWith('-') && !line.startsWith('---'))\n",
      "    const removed = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(line => line.startsWith('-') && !line.startsWith('---'))\n"
    ],
    [
      "    const added = voiceCoreProofDiffLines(rel, git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n')).filter(line => line.startsWith('+') && !line.startsWith('+++'))\n",
      "    const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))\n"
    ]
  ],
  "scripts/test-studio-model-choice.mjs": [
    [
      "import { stripVoiceCore } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only this port's exact proof metadata\n",
      ""
    ],
    [
      "const read = rel => stripVoiceCore(rel, (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8')))\n",
      "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"
    ]
  ],
  "scripts/test-studio-chat-theme-export.mjs": [
    [
      "import { voiceCoreProofDiffLines } from './studio-voice-core-strip.mjs' // LATER-CHANGES: registry read (STUDIO-VOICE-CORE): normalize only exact voice-port proof edits\n",
      ""
    ],
    [
      "    const diff = voiceCoreProofDiffLines(rel, git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n'))\n",
      "    const diff = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n')\n"
    ],
    [
      "    const added = voiceCoreProofDiffLines(rel, git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n')).filter(line => line.startsWith('+') && !line.startsWith('+++'))",
      "    const added = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))"
    ]
  ]
};
export const VOICE_CORE_REGISTRY_LINES = [
  "  ...(await import('./studio-voice-core-strip.mjs')).VOICE_CORE_SCOPE_FILES, // LATER-CHANGE: ELEMENT-3, pure Director voice core (NEXT_PUBLIC_STUDIO_VOICE_CALL)\n",
  "  (await import('./studio-voice-core-strip.mjs')).VOICE_CORE_ENV_BLOCK, // LATER-CHANGE: ELEMENT-3, Director voice opt-in\n",
  "  (await import('./studio-voice-core-strip.mjs')).stripVoiceCore, // LATER-CHANGE: ELEMENT-3, voice port compatibility pin\n"
];
/** Public test-only dependency metadata, reversed only when every byte of a known hunk matches. */
export const VOICE_CORE_LOCK_EDITS = [
  [
    "      typescript:\n        specifier: ^5\n        version: 5.9.3\n      vitest:\n        specifier: 5.0.3\n        version: 5.0.3(@types/node@22.19.1)(vite@8.3.5(@types/node@22.19.1)(jiti@1.21.7))\n\npackages:\n\n",
    "      typescript:\n        specifier: ^5\n        version: 5.9.3\n\npackages:\n\n"
  ],
  [
    "  '@jridgewell/sourcemap-codec@1.5.5':\n    resolution: {integrity: sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==}\n\n  '@jridgewell/sourcemap-codec@1.6.0':\n    resolution: {integrity: sha512-T7jf+5zgsZHwNJ4lvQ7/aezbyk0nNX+zJVWpmHA7VYsEx7a7qr5Rg5IbtJFqkgze5Y2sruq1RUY8Q837Od7iFw==}\n\n  '@jridgewell/trace-mapping@0.3.31':\n    resolution: {integrity: sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==}\n\n",
    "  '@jridgewell/sourcemap-codec@1.5.5':\n    resolution: {integrity: sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==}\n\n  '@jridgewell/trace-mapping@0.3.31':\n    resolution: {integrity: sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==}\n\n"
  ],
  [
    "    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}\n    engines: {node: '>= 8'}\n\n  '@oxc-project/types@0.156.0':\n    resolution: {integrity: sha512-1Duyg48TdJNdyhEB8Xn1L36bT9Pv6GUtlKjHxOys8xkaF/rQq3XJE+bAurSK/AgIz5mGFsb77cn9Pb20+WCScw==}\n\n  '@panva/hkdf@1.2.1':\n    resolution: {integrity: sha512-6oclG6Y3PiDFcoyk8srjLfVKyMfVCKJ27JwNPViuXziFpmdz+MZnZN/aKY0JGXgYuO/VghU0jcOAZgWXZ1Dmrw==}\n\n",
    "    resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}\n    engines: {node: '>= 8'}\n\n  '@panva/hkdf@1.2.1':\n    resolution: {integrity: sha512-6oclG6Y3PiDFcoyk8srjLfVKyMfVCKJ27JwNPViuXziFpmdz+MZnZN/aKY0JGXgYuO/VghU0jcOAZgWXZ1Dmrw==}\n\n"
  ],
  [
    "  '@radix-ui/rect@1.1.0':\n    resolution: {integrity: sha512-A9+lCBZoaMJlVKcRBz2YByCG+Cp2t6nAnMnNba+XiWxnj6r4JUFqfsgwocMBZU9LPtdxC6wB56ySYpc7LQIoJg==}\n\n  '@rolldown/binding-android-arm-eabi@1.2.16':\n    resolution: {integrity: sha512-ia3DwAs0OsMGS7+IConptSiyk9pEXkOx/AbJ2n/lAGxH3QkWQus1t8d7gnAT38FCU2sQu8lUbeR6AiZFv4JxaA==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm]\n    os: [android]\n\n  '@rolldown/binding-android-arm64@1.2.16':\n    resolution: {integrity: sha512-kx5wBiMB6E7TEvpl2B9gjLU004BkvEm2Dr941BFjx/SontPwSzNuQUIoVKxHHoSjpFIfHMmcguyLOtyn0hObRg==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [android]\n\n  '@rolldown/binding-darwin-arm64@1.2.16':\n    resolution: {integrity: sha512-qslZrXnKJU4cUpjoAmtAo/KQM9e2IRMlmpig6Zpwj+8KWxW8v+nkAf9216Bsek9lOC1jvg2yCjygCFo2f83msQ==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [darwin]\n\n  '@rolldown/binding-darwin-x64@1.2.16':\n    resolution: {integrity: sha512-FdF+y48ND13eAyM2mQn+85kvAqNlvRWROy2rhgA463X/0Gv4vGtazZtfaF1mRBLscYvtOlh4QnLjOWiFzX69OQ==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [x64]\n    os: [darwin]\n\n  '@rolldown/binding-freebsd-x64@1.2.16':\n    resolution: {integrity: sha512-ddjqFM5e95AgLbUPtKIS7V1KTVlA0RUgCVr5mn+/IEhsdy3pr+Vuj/HZ7nlMN2FyxIwUktOH1LEPIQXO1v9y1Q==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [x64]\n    os: [freebsd]\n\n  '@rolldown/binding-linux-arm-gnueabihf@1.2.16':\n    resolution: {integrity: sha512-tHdKWbFkFBI687iim3LIyIvyL7j66VvQYkDPss5Stn/qyE2tWkR1YD0dXmXPFKKqT/o5ZEJVsaRsWS2meQwGOA==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm]\n    os: [linux]\n\n  '@rolldown/binding-linux-arm64-gnu@1.2.16':\n    resolution: {integrity: sha512-FJiLGAblPBMlBEdbOqw6kW6QcXDWAf/oJu7gYs9ZJZwmg+K+/zjFLxPTIY9izJUzxzc24FHvmseyA0IvJSl17w==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [linux]\n\n  '@rolldown/binding-linux-arm64-musl@1.2.16':\n    resolution: {integrity: sha512-hrJpblMsrQ58U9veWpbXzkhV5zStunds6HWLprqq1qauvgBr1E6P+24kLj6lSLI9vjRn/RYpjprhkHQPKGWpNg==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [linux]\n\n  '@rolldown/binding-linux-ppc64-gnu@1.2.16':\n    resolution: {integrity: sha512-qJd/dC6j6CwLG9/s/RP2nb1RZ0GIgj7Ioj7x/SYa3RzjVrlzrmH0fhIOpfvqQDeIsdP0loi+kHaMhJzY1PBIaA==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [ppc64]\n    os: [linux]\n\n  '@rolldown/binding-linux-s390x-gnu@1.2.16':\n    resolution: {integrity: sha512-Vx7Xg5uUJuNcujJjI70OICaH0EYj80BtOLZTSN7uOYg8QOLlyKnaG0IW7Fn/J0IpJsaKzmDKMhOQv1JBM9m9vg==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [s390x]\n    os: [linux]\n\n  '@rolldown/binding-linux-x64-gnu@1.2.16':\n    resolution: {integrity: sha512-TNKhgE3uJTsTzatUSSYt0Kgo+Oa2uSlSjz4r1aEIea7HX6ULBym4fAlYUhG1i6pjNf2njfCUAfKwr6C3E9Xg1w==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [x64]\n    os: [linux]\n\n  '@rolldown/binding-linux-x64-musl@1.2.16':\n    resolution: {integrity: sha512-7chXdpjXZ8qG0+mIxECN3cT9kvhZ3/oZhMX6Pp876P7CDrIy8nJswva6Mq357JR7eYXfuskwZxMeV1SzoZdHrA==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [x64]\n    os: [linux]\n\n  '@rolldown/binding-openharmony-arm64@1.2.16':\n    resolution: {integrity: sha512-Kwjt+7uNTJK5/MDkGWGVO2KQPnj8yAV75dMpfwyHZrJSXWHrniOB0aUEWlVYf3H1hOqFLIStLdM5QXq6bnKmOQ==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [openharmony]\n\n  '@rolldown/binding-win32-arm64-msvc@1.2.16':\n    resolution: {integrity: sha512-/LH6WfjDRXXJz/p5xl4TmU+jpcnwcxbKEQBW/GZE0JHfN0lGIyTtsUEGaQ/q/GikkGJ2yLKe6pwm7AnEWO8pdw==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [arm64]\n    os: [win32]\n\n  '@rolldown/binding-win32-x64-msvc@1.2.16':\n    resolution: {integrity: sha512-1lv1KvX0Z871zfk7vw+dnXMMnHNyDwMzWG8Kv3HxDXMOhzCX4SHc7HK319fInP0i+0p9D8brkfzL7pJOaGl+tw==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    cpu: [x64]\n    os: [win32]\n\n  '@rolldown/pluginutils@1.0.1':\n    resolution: {integrity: sha512-2j9bGt5Jh8hj+vPtgzPtl72j0yRxHAyumoo6TNfAjsLB04UtpSvPbPcDcBMxz7n+9CYB0c1GxQFxYRg2jimqGw==}\n\n  '@standard-schema/spec@1.0.0':\n    resolution: {integrity: sha512-m2bOd0f2RT9k8QJx1JN85cZYyH1RqFBdlwtkSlf4tBDYLCiiZnv1fIIwacK6cqwXavOydf0NPToMQgpKq+dVlA==}\n\n",
    "  '@radix-ui/rect@1.1.0':\n    resolution: {integrity: sha512-A9+lCBZoaMJlVKcRBz2YByCG+Cp2t6nAnMnNba+XiWxnj6r4JUFqfsgwocMBZU9LPtdxC6wB56ySYpc7LQIoJg==}\n\n  '@standard-schema/spec@1.0.0':\n    resolution: {integrity: sha512-m2bOd0f2RT9k8QJx1JN85cZYyH1RqFBdlwtkSlf4tBDYLCiiZnv1fIIwacK6cqwXavOydf0NPToMQgpKq+dVlA==}\n\n"
  ],
  [
    "    resolution: {integrity: sha512-WRZOuCuaz8UcZZE4R5HXTco2goQSI2XxjGY3hbM/xDvwmqFWd4ivooImsMx65OKM6CtNKbnZ5YL+YwAwK7c1dg==}\n    deprecated: This is a stub types definition. bcryptjs provides its own type definitions, so you do not need this installed.\n\n  '@types/chai@5.2.3':\n    resolution: {integrity: sha512-Mw558oeA9fFbv65/y4mHtXDs9bPnFMZAL/jxdPFUpOHHIXX91mcgEHbS5Lahr+pwZFR8A7GQleRWeI6cGFC2UA==}\n\n  '@types/d3-array@3.2.2':\n    resolution: {integrity: sha512-hOLWVbm7uRza0BYXpIIW5pxfrKe0W+D5lrFiAEYR+pb6w3N2SwSMaJbXdUfSEv+dT4MfHBLtn5js0LAWaO6otw==}\n\n",
    "    resolution: {integrity: sha512-WRZOuCuaz8UcZZE4R5HXTco2goQSI2XxjGY3hbM/xDvwmqFWd4ivooImsMx65OKM6CtNKbnZ5YL+YwAwK7c1dg==}\n    deprecated: This is a stub types definition. bcryptjs provides its own type definitions, so you do not need this installed.\n\n  '@types/d3-array@3.2.2':\n    resolution: {integrity: sha512-hOLWVbm7uRza0BYXpIIW5pxfrKe0W+D5lrFiAEYR+pb6w3N2SwSMaJbXdUfSEv+dT4MfHBLtn5js0LAWaO6otw==}\n\n"
  ],
  [
    "  '@types/debug@4.1.12':\n    resolution: {integrity: sha512-vIChWdVG3LG1SMxEvI/AK+FWJthlrqlTu7fbrlywTkkaONwk/UAGaULXRlf8vkzFBLVm0zkMdCquhL5aOjhXPQ==}\n\n  '@types/deep-eql@4.0.2':\n    resolution: {integrity: sha512-c9h9dVVMigMPc4bwTvC5dxqtqJZwQPePsWjPlpSOnojbor6pGqdk541lfA7AqFQr5pB1BRdq0juY9db81BwyFw==}\n\n  '@types/estree-jsx@1.0.5':\n    resolution: {integrity: sha512-52CcUVNFyfb1A2ALocQw/Dd1BQFNmSdkuC3BkZ6iqhdMfQz7JWOFRuJFloOzjk+6WijU56m9oKXFAXc7o3Towg==}\n\n",
    "  '@types/debug@4.1.12':\n    resolution: {integrity: sha512-vIChWdVG3LG1SMxEvI/AK+FWJthlrqlTu7fbrlywTkkaONwk/UAGaULXRlf8vkzFBLVm0zkMdCquhL5aOjhXPQ==}\n\n  '@types/estree-jsx@1.0.5':\n    resolution: {integrity: sha512-52CcUVNFyfb1A2ALocQw/Dd1BQFNmSdkuC3BkZ6iqhdMfQz7JWOFRuJFloOzjk+6WijU56m9oKXFAXc7o3Towg==}\n\n"
  ],
  [
    "\n  '@ungap/structured-clone@1.3.0':\n    resolution: {integrity: sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g==}\n    deprecated: Potential CWE-502 - Update to 1.3.1 or higher\n\n  '@vercel/analytics@2.0.1':\n    resolution: {integrity: sha512-MTQG6V9qQrt1tsDeF+2Uoo5aPjqbVPys1xvnIftXSJYG2SrwXRHnqEvVoYID7BTruDz4lCd2Z7rM1BdkUehk2g==}\n",
    "\n  '@ungap/structured-clone@1.3.0':\n    resolution: {integrity: sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g==}\n\n  '@vercel/analytics@2.0.1':\n    resolution: {integrity: sha512-MTQG6V9qQrt1tsDeF+2Uoo5aPjqbVPys1xvnIftXSJYG2SrwXRHnqEvVoYID7BTruDz4lCd2Z7rM1BdkUehk2g==}\n"
  ],
  [
    "      vue-router:\n        optional: true\n\n  '@vitest/mocker@5.0.3':\n    resolution: {integrity: sha512-T8sWAIbkSyAjkwTcaEc3Iu0o9A27X1/kdXrizhZkGuSKScRQtRzclfAMpOTcGdXCsqxeWlpGy3XjqaW8CpLORg==}\n    peerDependencies:\n      msw: ^2.4.9\n      vite: ^6.0.0 || ^7.0.0 || ^8.0.0\n    peerDependenciesMeta:\n      msw:\n        optional: true\n      vite:\n        optional: true\n\n  '@vitest/spy@5.0.3':\n    resolution: {integrity: sha512-XhFysQTB8AZ+P4gMi+Lpo99vg2AZi0qKpaB9yXQl37+CaMEAPO3iH/wGVnSyL5MPERiLezpqTVtrR6UZH5GCXg==}\n\n  agent-base@7.1.4:\n    resolution: {integrity: sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ==}\n    engines: {node: '>= 14'}\n",
    "      vue-router:\n        optional: true\n\n  agent-base@7.1.4:\n    resolution: {integrity: sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ==}\n    engines: {node: '>= 14'}\n"
  ],
  [
    "  aria-hidden@1.2.6:\n    resolution: {integrity: sha512-ik3ZgC9dY/lYVVM++OISsaYDeg1tb0VtP5uL3ouh1koGOaUMDPpbFIei4JkFimWUFPn90sbMNMXQAIVOlnYKJA==}\n    engines: {node: '>=10'}\n\n  assertion-error@2.0.1:\n    resolution: {integrity: sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==}\n    engines: {node: '>=12'}\n\n  attr-accept@2.2.5:\n    resolution: {integrity: sha512-0bDNnY/u6pPwHDMoF0FieU354oBi0a8rD9FcsLwzcGWbc8KS8KPIi7y+s13OlVY+gMWc/9xEMUgNE6Qm8ZllYQ==}\n",
    "  aria-hidden@1.2.6:\n    resolution: {integrity: sha512-ik3ZgC9dY/lYVVM++OISsaYDeg1tb0VtP5uL3ouh1koGOaUMDPpbFIei4JkFimWUFPn90sbMNMXQAIVOlnYKJA==}\n    engines: {node: '>=10'}\n\n  attr-accept@2.2.5:\n    resolution: {integrity: sha512-0bDNnY/u6pPwHDMoF0FieU354oBi0a8rD9FcsLwzcGWbc8KS8KPIi7y+s13OlVY+gMWc/9xEMUgNE6Qm8ZllYQ==}\n"
  ],
  [
    "  ccount@2.0.1:\n    resolution: {integrity: sha512-eyrF0jiFpY+3drT6383f1qhkbGsLSifNAjA61IUjZjmLCWjItY6LB9ft9YhoDgwfmclB2zhu51Lc7+95b8NRAg==}\n\n  chai@6.3.0:\n    resolution: {integrity: sha512-XWAtwJ6OHO+tj0EKCs0Y2UamnyOxseZWltU4x2U2wh8g4AigdjwvtUjvLP2tqkA/avxHEtzxNaqGq/YGNwckKg==}\n    engines: {node: '>=18'}\n\n  character-entities-html4@2.1.0:\n    resolution: {integrity: sha512-1v7fgQRj6hnSwFpq1Eu0ynr/CDEw0rXo2B61qXrLNdHZmPKgb7fqS1a2JwF0rISo9q77jDI8VMEHoApn8qDoZA==}\n\n",
    "  ccount@2.0.1:\n    resolution: {integrity: sha512-eyrF0jiFpY+3drT6383f1qhkbGsLSifNAjA61IUjZjmLCWjItY6LB9ft9YhoDgwfmclB2zhu51Lc7+95b8NRAg==}\n\n  character-entities-html4@2.1.0:\n    resolution: {integrity: sha512-1v7fgQRj6hnSwFpq1Eu0ynr/CDEw0rXo2B61qXrLNdHZmPKgb7fqS1a2JwF0rISo9q77jDI8VMEHoApn8qDoZA==}\n\n"
  ],
  [
    "    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}\n    engines: {node: '>= 0.4'}\n\n  es-module-lexer@2.3.2:\n    resolution: {integrity: sha512-poHGpORABojJJucnV9KbOavETW8lBVnphkW77ER5/BQ5Fz7oXSoCNek7IH3vR5nRjdsEz926ibFYX8KtLQmdyw==}\n\n  es-object-atoms@1.1.1:\n    resolution: {integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==}\n    engines: {node: '>= 0.4'}\n",
    "    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}\n    engines: {node: '>= 0.4'}\n\n  es-object-atoms@1.1.1:\n    resolution: {integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==}\n    engines: {node: '>= 0.4'}\n"
  ],
  [
    "  estree-util-is-identifier-name@3.0.0:\n    resolution: {integrity: sha512-hFtqIDZTIUZ9BXLb8y4pYGyk6+wekIivNVTcmvk8NoOh+VeRn5y6cEHzbURrWbfp1fIqdVipilzj+lfaadNZmg==}\n\n  estree-walker@3.0.3:\n    resolution: {integrity: sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==}\n\n  eventemitter3@4.0.7:\n    resolution: {integrity: sha512-8guHBZCwKnFhYdHr2ysuRWErTwhoN2X8XELRlrRwpmfeY2jjuUN4taQMsULKUVo1K4DvZl+0pgfyoysHxvmvEw==}\n\n  expect-type@1.4.0:\n    resolution: {integrity: sha512-KfYbmpRm0VbLjEvVa9yGwCi9GI34xvi7A/HXYWQO65CSD2u3MczUJSuwXKFIxlGsgBQizV9q5J9NHj4VG0n+pA==}\n    engines: {node: '>=12.0.0'}\n\n  exsolve@1.0.8:\n    resolution: {integrity: sha512-LmDxfWXwcTArk8fUEnOfSZpHOJ6zOMUJKOtFLFqJLoKJetuQG874Uc7/Kki7zFLzYybmZhp1M7+98pfMqeX8yA==}\n",
    "  estree-util-is-identifier-name@3.0.0:\n    resolution: {integrity: sha512-hFtqIDZTIUZ9BXLb8y4pYGyk6+wekIivNVTcmvk8NoOh+VeRn5y6cEHzbURrWbfp1fIqdVipilzj+lfaadNZmg==}\n\n  eventemitter3@4.0.7:\n    resolution: {integrity: sha512-8guHBZCwKnFhYdHr2ysuRWErTwhoN2X8XELRlrRwpmfeY2jjuUN4taQMsULKUVo1K4DvZl+0pgfyoysHxvmvEw==}\n\n  exsolve@1.0.8:\n    resolution: {integrity: sha512-LmDxfWXwcTArk8fUEnOfSZpHOJ6zOMUJKOtFLFqJLoKJetuQG874Uc7/Kki7zFLzYybmZhp1M7+98pfMqeX8yA==}\n"
  ],
  [
    "\n  glob@10.5.0:\n    resolution: {integrity: sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==}\n    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me\n    hasBin: true\n\n  google-auth-library@10.5.0:\n",
    "\n  glob@10.5.0:\n    resolution: {integrity: sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==}\n    hasBin: true\n\n  google-auth-library@10.5.0:\n"
  ],
  [
    "  jws@4.0.0:\n    resolution: {integrity: sha512-KDncfTmOZoOMTFG4mBlG0qUIOlc03fmzH+ru6RgYVZhPkyiy/92Owlt/8UEN+a4TXR1FQetfIpJE8ApdvdVxTg==}\n\n  lightningcss-android-arm64@1.33.0:\n    resolution: {integrity: sha512-gEpRTalKdosp4Bb8qWtc2iOgE5SeIHlpS1up9bFq2wAyYhl1UdTObYiHe98zEM9SQvSoqQZ1IQD0JNpg3Ml5pg==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm64]\n    os: [android]\n\n  lightningcss-darwin-arm64@1.33.0:\n    resolution: {integrity: sha512-Sciaz8eenNTKn9b3t7+xr0ipTp9YxKQY4npwQ3mrRuL0BAVHBLyZxofhaKBAVtzmtRZ/zTyo0/to4B1uWG/Djg==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm64]\n    os: [darwin]\n\n  lightningcss-darwin-x64@1.33.0:\n    resolution: {integrity: sha512-Z5UPAxzrjlWNNyGy6i65cJzzvgJ5D3T6wMvs+gWpY9d7qRhANrxqAp6LhxIgZhWEw18RfJTGcRxjuLIBr+m8XQ==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [x64]\n    os: [darwin]\n\n  lightningcss-freebsd-x64@1.33.0:\n    resolution: {integrity: sha512-QQM/Ti/hQajJwCY+RiWuCZ9sdtI/XQk7nDK5vC8kkdwixezOlDgvDx7+RT+QjK6FcFT4MpsuoBnHIo/O3StRRg==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [x64]\n    os: [freebsd]\n\n  lightningcss-linux-arm-gnueabihf@1.33.0:\n    resolution: {integrity: sha512-N7FVBe6iS24MlM6R/4RBTxGhQheZGs7tiQ9U32UtF75NzP5Q7xWPRqLBCKxlRQRk3rY1jCIPLzx7WzOhuUIRLQ==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm]\n    os: [linux]\n\n  lightningcss-linux-arm64-gnu@1.33.0:\n    resolution: {integrity: sha512-j2v/itmy4HlNxlc6voKXYgBqNi0Ng2LShg4z7GufpEgs05P+2suBVyi9I6YHq5uoVFx9ETin3eCEhLVyXGQnKg==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm64]\n    os: [linux]\n\n  lightningcss-linux-arm64-musl@1.33.0:\n    resolution: {integrity: sha512-yiO5ROMuYQgXbC60yjZU5CYSFZGKXL0HFATXt9mHJn1+zW55oCtMI9NfcVhYLMFDL7gV7oBPon/EmMMGg2OvtQ==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm64]\n    os: [linux]\n\n  lightningcss-linux-x64-gnu@1.33.0:\n    resolution: {integrity: sha512-ar+Ju7LmcN0Jo4FpL4hpFybwNG9/3A/Br5KW2n2jyODg3MEZXaDYADdemoNS+BDNfMgKvylJLj4S5tyRActuAg==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [x64]\n    os: [linux]\n\n  lightningcss-linux-x64-musl@1.33.0:\n    resolution: {integrity: sha512-RYiYbkokw0trfKqqzfF55lginwEPrD3OJDfTuJzFs1MK6iFnDenaz1fqLLtX4ITG3OktJQXOeTaw1awrBAlZPw==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [x64]\n    os: [linux]\n\n  lightningcss-win32-arm64-msvc@1.33.0:\n    resolution: {integrity: sha512-1K+MPfLSFVpphzpdbfkhlWk6wBrTObBzS2T6db10PNOZgR9GoVsAWzwNyuhUYYbTp23j+4RrncfujZ4uAzXvwA==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [arm64]\n    os: [win32]\n\n  lightningcss-win32-x64-msvc@1.33.0:\n    resolution: {integrity: sha512-OlEICDx/Xl0FqSp4bry8zFnCvGpig3Gl4gCquvYwHuqJKEC1+n9NgDniFvqHGmMv1ZkqDJrDqKKSykTDX+ehuA==}\n    engines: {node: '>= 12.0.0'}\n    cpu: [x64]\n    os: [win32]\n\n  lightningcss@1.33.0:\n    resolution: {integrity: sha512-WkUDrojuJs0xkgGf2udWxa3yGBRxPtxUkB79i6aCZLRgc7PM8fZe9TosfPDcvEpQZbuFASnHYmRLBLUbmLOIIA==}\n    engines: {node: '>= 12.0.0'}\n\n  lilconfig@3.1.3:\n    resolution: {integrity: sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==}\n    engines: {node: '>=14'}\n",
    "  jws@4.0.0:\n    resolution: {integrity: sha512-KDncfTmOZoOMTFG4mBlG0qUIOlc03fmzH+ru6RgYVZhPkyiy/92Owlt/8UEN+a4TXR1FQetfIpJE8ApdvdVxTg==}\n\n  lilconfig@3.1.3:\n    resolution: {integrity: sha512-/vlFKAoH5Cgt3Ie+JLhRbwOsCQePABiU3tJ1egGvyQ+33R/vcwM2Zl2QR/LzjsBeItPt3oSVXapn+m4nQDvpzw==}\n    engines: {node: '>=14'}\n"
  ],
  [
    "    peerDependencies:\n      react: ^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0-rc\n\n  magic-string@1.4.5:\n    resolution: {integrity: sha512-oLLC2+YvQUfAa+vxoufE/yc1icb87M9iXIRqAoR/2EhE/8cb3SF/+Gi0c2By1B+5Vz2e2vQtUvHiu1+63Znh+w==}\n\n  markdown-table@3.0.4:\n    resolution: {integrity: sha512-wiYz4+JrLyb/DqW2hkFJxP7Vd7JuTDm77fvbM8VfEQdmSMqcImWeeRbHwZjBjIFki/VaMK2BhFi7oUUZeM5bqw==}\n\n",
    "    peerDependencies:\n      react: ^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0-rc\n\n  markdown-table@3.0.4:\n    resolution: {integrity: sha512-wiYz4+JrLyb/DqW2hkFJxP7Vd7JuTDm77fvbM8VfEQdmSMqcImWeeRbHwZjBjIFki/VaMK2BhFi7oUUZeM5bqw==}\n\n"
  ],
  [
    "\n  nanoid@3.3.11:\n    resolution: {integrity: sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==}\n    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}\n    hasBin: true\n\n  nanoid@3.3.20:\n    resolution: {integrity: sha512-uKdg2G3GNCKQn9byYOpxbGqrT2fGO5KRt5J/8b3pok8rT6qxGWF6hxMyJiEYtAf+FVyYuD9hRaDqX5uPFYJ4ZQ==}\n    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}\n    hasBin: true\n\n",
    "\n  nanoid@3.3.11:\n    resolution: {integrity: sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==}\n    engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}\n    hasBin: true\n\n"
  ],
  [
    "    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}\n    engines: {node: '>= 0.4'}\n\n  obug@2.2.1:\n    resolution: {integrity: sha512-XrsrhT5sybtKI6wakr2SPOlGZWWYbUXZ7a0jT8/QOeAPau+1X/bSegNe5YR75oJmEZQbKningirmGOEJCIk61Q==}\n    engines: {node: '>=12.20.0'}\n\n  ohash@2.0.11:\n    resolution: {integrity: sha512-RdR9FQrFwNBNXAr4GixM8YaRZRJ5PUWbKYbE5eOsrwAjJW0q2REGcf79oYPsLyskQCZG1PLN+S/K1V00joZAoQ==}\n\n",
    "    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}\n    engines: {node: '>= 0.4'}\n\n  ohash@2.0.11:\n    resolution: {integrity: sha512-RdR9FQrFwNBNXAr4GixM8YaRZRJ5PUWbKYbE5eOsrwAjJW0q2REGcf79oYPsLyskQCZG1PLN+S/K1V00joZAoQ==}\n\n"
  ],
  [
    "\n  picomatch@4.0.3:\n    resolution: {integrity: sha512-5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==}\n    engines: {node: '>=12'}\n\n  picomatch@4.0.7:\n    resolution: {integrity: sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==}\n    engines: {node: '>=12'}\n\n  pify@2.3.0:\n",
    "\n  picomatch@4.0.3:\n    resolution: {integrity: sha512-5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==}\n    engines: {node: '>=12'}\n\n  pify@2.3.0:\n"
  ],
  [
    "    resolution: {integrity: sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==}\n    engines: {node: ^10 || ^12 || >=14}\n\n  postcss@8.5.32:\n    resolution: {integrity: sha512-LJlKCCAUFKOuZxipUdYw1NzIITEsPcgyOG9LkvRJvuKj/bRzbuRY0ARXvL0pWGpsZvn8jku+LMep2eU0seHp8g==}\n    engines: {node: ^10 || ^12 || >=14}\n\n  postcss@8.5.6:\n    resolution: {integrity: sha512-3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==}\n    engines: {node: ^10 || ^12 || >=14}\n",
    "    resolution: {integrity: sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==}\n    engines: {node: ^10 || ^12 || >=14}\n\n  postcss@8.5.6:\n    resolution: {integrity: sha512-3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==}\n    engines: {node: ^10 || ^12 || >=14}\n"
  ],
  [
    "  recharts@2.15.0:\n    resolution: {integrity: sha512-cIvMxDfpAmqAmVgc4yb7pgm/O1tmmkl/CjrvXuW+62/+7jj/iF9Ykm+hb/UJt42TREHMyd3gb+pkgoa2MxgDIw==}\n    engines: {node: '>=14'}\n    deprecated: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide\n    peerDependencies:\n      react: ^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0\n      react-dom: ^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0\n",
    "  recharts@2.15.0:\n    resolution: {integrity: sha512-cIvMxDfpAmqAmVgc4yb7pgm/O1tmmkl/CjrvXuW+62/+7jj/iF9Ykm+hb/UJt42TREHMyd3gb+pkgoa2MxgDIw==}\n    engines: {node: '>=14'}\n    peerDependencies:\n      react: ^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0\n      react-dom: ^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0\n"
  ],
  [
    "    resolution: {integrity: sha512-l0OE8wL34P4nJH/H2ffoaniAokM2qSmrtXHmlpvYr5AVVX8msAyW0l8NVJFDxlSK4u3Uh/f41cQheDVdnYijwQ==}\n    hasBin: true\n\n  rolldown@1.2.16:\n    resolution: {integrity: sha512-bWvlMpFKiTfDKfnK7FC2MPgPeWCf/Kpwsq49ApdW+FQaBZb6O6dZ4MAPbPUjp7hYQrw/RobqCzn64BRrQecGHw==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    hasBin: true\n\n  run-parallel@1.2.0:\n    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}\n\n",
    "    resolution: {integrity: sha512-l0OE8wL34P4nJH/H2ffoaniAokM2qSmrtXHmlpvYr5AVVX8msAyW0l8NVJFDxlSK4u3Uh/f41cQheDVdnYijwQ==}\n    hasBin: true\n\n  run-parallel@1.2.0:\n    resolution: {integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==}\n\n"
  ],
  [
    "    resolution: {integrity: sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==}\n    engines: {node: '>=0.10.0'}\n\n  source-map-js@1.2.2:\n    resolution: {integrity: sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==}\n    engines: {node: '>=0.10.0'}\n\n  space-separated-tokens@2.0.2:\n    resolution: {integrity: sha512-PEGlAwrG8yXGXRjW32fGbg66JAlOAwbObuqVoJpv/mRgoWDQfgH1wDPvtzWyUSNAXBGSk8h755YDbbcEy3SH2Q==}\n\n  std-env@4.3.0:\n    resolution: {integrity: sha512-OtU/EgQ1kIm5KwqQpBC6ZEMXrZRui11w8zgfTWp8cdO9B8OaPsbA8bTHO2P+HNo1VlUTGMVBwPhydu6poeXiag==}\n\n  string-width@4.2.3:\n    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}\n",
    "    resolution: {integrity: sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==}\n    engines: {node: '>=0.10.0'}\n\n  space-separated-tokens@2.0.2:\n    resolution: {integrity: sha512-PEGlAwrG8yXGXRjW32fGbg66JAlOAwbObuqVoJpv/mRgoWDQfgH1wDPvtzWyUSNAXBGSk8h755YDbbcEy3SH2Q==}\n\n  string-width@4.2.3:\n    resolution: {integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==}\n"
  ],
  [
    "  tiny-invariant@1.3.3:\n    resolution: {integrity: sha512-+FbBPE1o9QAYvviau/qC5SE3caw21q3xkvWKBtja5vgqOWIHHJ3ioaq1VPfn/Szqctz2bU/oYeKd9/z5BL+PVg==}\n\n  tinybench@6.2.3:\n    resolution: {integrity: sha512-Al01C2JIBnO2CXCAPbpAl6sUiOZHeThGtHYNTa51JRw9PyWOCdr+9Ong05R4qg/Sk3+H645E8ov1h2c58ityNw==}\n    engines: {node: '>=20.0.0'}\n\n  tinyexec@1.0.2:\n    resolution: {integrity: sha512-W/KYk+NFhkmsYpuHq5JykngiOCnxeVL8v8dFnqxSD8qEEdRfXk1SDM6JzNqcERbcGYj9tMrDQBYV9cjgnunFIg==}\n    engines: {node: '>=18'}\n\n  tinyexec@1.3.1:\n    resolution: {integrity: sha512-GCvB3aoys96IuDFBMcTB46JOR6mdMtAToqwiW8JlWhsoh1mhHi/xn9ss/Dg7N555GiJyEt2qzoG/NHCwM6h1EA==}\n    engines: {node: '>=18'}\n\n  tinyglobby@0.2.15:\n    resolution: {integrity: sha512-j2Zq4NyQYG5XMST4cbs02Ak8iJUdxRM0XI5QyxXuZOzKOINmWurp3smXu3y5wDcJrptwpSjgXHzIQxR0omXljQ==}\n    engines: {node: '>=12.0.0'}\n\n  tinyglobby@0.2.17:\n    resolution: {integrity: sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==}\n    engines: {node: '>=12.0.0'}\n\n  to-regex-range@5.0.1:\n",
    "  tiny-invariant@1.3.3:\n    resolution: {integrity: sha512-+FbBPE1o9QAYvviau/qC5SE3caw21q3xkvWKBtja5vgqOWIHHJ3ioaq1VPfn/Szqctz2bU/oYeKd9/z5BL+PVg==}\n\n  tinyexec@1.0.2:\n    resolution: {integrity: sha512-W/KYk+NFhkmsYpuHq5JykngiOCnxeVL8v8dFnqxSD8qEEdRfXk1SDM6JzNqcERbcGYj9tMrDQBYV9cjgnunFIg==}\n    engines: {node: '>=18'}\n\n  tinyglobby@0.2.15:\n    resolution: {integrity: sha512-j2Zq4NyQYG5XMST4cbs02Ak8iJUdxRM0XI5QyxXuZOzKOINmWurp3smXu3y5wDcJrptwpSjgXHzIQxR0omXljQ==}\n    engines: {node: '>=12.0.0'}\n\n  to-regex-range@5.0.1:\n"
  ],
  [
    "\n  uuid@8.3.2:\n    resolution: {integrity: sha512-+NYs2QeMWy+GWFOEm9xnn6HCDp0l7QBD7ml8zLUmJ+93Q5NF0NocErnwkTkXVFNiX3/fpC6afS8Dhb/gz7R7eg==}\n    deprecated: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).\n    hasBin: true\n\n  uuid@9.0.1:\n    resolution: {integrity: sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA==}\n    deprecated: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).\n    hasBin: true\n\n  vaul@1.1.2:\n",
    "\n  uuid@8.3.2:\n    resolution: {integrity: sha512-+NYs2QeMWy+GWFOEm9xnn6HCDp0l7QBD7ml8zLUmJ+93Q5NF0NocErnwkTkXVFNiX3/fpC6afS8Dhb/gz7R7eg==}\n    hasBin: true\n\n  uuid@9.0.1:\n    resolution: {integrity: sha512-b+1eJOlsR9K8HJpow9Ok3fiWOWSIcIzXodvv0rQjVoOVNpWMpxf1wZNpt4y9h10odCNrqnYp1OBzRktckBe3sA==}\n    hasBin: true\n\n  vaul@1.1.2:\n"
  ],
  [
    "\n  victory-vendor@36.9.2:\n    resolution: {integrity: sha512-PnpQQMuxlwYdocC8fIJqVXvkeViHYzotI+NJrCuav0ZYFoq912ZHBk3mCeuj+5/VpodOjPe1z0Fk2ihgzlXqjQ==}\n\n  vite@8.3.5:\n    resolution: {integrity: sha512-z1YpjieJ9g0ebTmQpLBv/oq9E3F9EIlOe+7LahW8SrE3LTiG3udBRUXQOlYXP9b+IC2q2phHeVxj9xGlw34OEQ==}\n    engines: {node: ^20.19.0 || >=22.12.0}\n    hasBin: true\n    peerDependencies:\n      '@types/node': ^20.19.0 || >=22.12.0\n      '@vitejs/devtools': ^0.7.1 || ^0.8.0\n      esbuild: ^0.27.0 || ^0.28.0\n      jiti: '>=1.21.0'\n      less: ^4.0.0\n      sass: ^1.70.0\n      sass-embedded: ^1.70.0\n      stylus: '>=0.54.8'\n      sugarss: ^5.0.0\n      terser: ^5.16.0\n      tsx: ^4.8.1\n      yaml: ^2.4.2\n    peerDependenciesMeta:\n      '@types/node':\n        optional: true\n      '@vitejs/devtools':\n        optional: true\n      esbuild:\n        optional: true\n      jiti:\n        optional: true\n      less:\n        optional: true\n      sass:\n        optional: true\n      sass-embedded:\n        optional: true\n      stylus:\n        optional: true\n      sugarss:\n        optional: true\n      terser:\n        optional: true\n      tsx:\n        optional: true\n      yaml:\n        optional: true\n\n  vitest@5.0.3:\n    resolution: {integrity: sha512-xMw97S3rjdtj5dkVat7jCsqWBpvchs3RlpQctUqwJD0KkERk40vz2fJ77lDwW/Vzh/pk18eItYAzkodhSes3jQ==}\n    engines: {node: ^22.12.0 || ^24.0.0 || >=26.0.0}\n    hasBin: true\n    peerDependencies:\n      '@edge-runtime/vm': '*'\n      '@opentelemetry/api': ^1.9.0\n      '@types/node': ^22.0.0 || >=24.0.0\n      '@vitest/browser-playwright': 5.0.3\n      '@vitest/browser-preview': 5.0.3\n      '@vitest/browser-webdriverio': ^5.0.0-beta.5 || >=5.0.0\n      '@vitest/coverage-istanbul': 5.0.3\n      '@vitest/coverage-v8': 5.0.3\n      '@vitest/ui': 5.0.3\n      happy-dom: '*'\n      jsdom: '*'\n      vite: ^6.4.0 || ^7.0.0 || ^8.0.0\n    peerDependenciesMeta:\n      '@edge-runtime/vm':\n        optional: true\n      '@opentelemetry/api':\n        optional: true\n      '@types/node':\n        optional: true\n      '@vitest/browser-playwright':\n        optional: true\n      '@vitest/browser-preview':\n        optional: true\n      '@vitest/browser-webdriverio':\n        optional: true\n      '@vitest/coverage-istanbul':\n        optional: true\n      '@vitest/coverage-v8':\n        optional: true\n      '@vitest/ui':\n        optional: true\n      happy-dom:\n        optional: true\n      jsdom:\n        optional: true\n\n  web-streams-polyfill@3.3.3:\n    resolution: {integrity: sha512-d2JWLCivmZYTSIoge9MsgFCZrt571BikcWGYkjC1khllbTeDlGqZ2D8vD8E/lJa8WGWbb7Plm8/XJYV7IJHZZw==}\n",
    "\n  victory-vendor@36.9.2:\n    resolution: {integrity: sha512-PnpQQMuxlwYdocC8fIJqVXvkeViHYzotI+NJrCuav0ZYFoq912ZHBk3mCeuj+5/VpodOjPe1z0Fk2ihgzlXqjQ==}\n\n  web-streams-polyfill@3.3.3:\n    resolution: {integrity: sha512-d2JWLCivmZYTSIoge9MsgFCZrt571BikcWGYkjC1khllbTeDlGqZ2D8vD8E/lJa8WGWbb7Plm8/XJYV7IJHZZw==}\n"
  ],
  [
    "  which@2.0.2:\n    resolution: {integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==}\n    engines: {node: '>= 8'}\n    hasBin: true\n\n  why-is-node-running@3.2.1:\n    resolution: {integrity: sha512-Tb2FUhB4vUsGQlfSquQLYkApkuPAFQXGFzxWKHHumVz2dK+X1RUm/HnID4+TfIGYJ1kTcwOaCk/buYCEJr6YjQ==}\n    engines: {node: '>=20.11'}\n    hasBin: true\n\n  wrap-ansi@7.0.0:\n",
    "  which@2.0.2:\n    resolution: {integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==}\n    engines: {node: '>= 8'}\n    hasBin: true\n\n  wrap-ansi@7.0.0:\n"
  ],
  [
    "\n  '@jridgewell/sourcemap-codec@1.5.5': {}\n\n  '@jridgewell/sourcemap-codec@1.6.0': {}\n\n  '@jridgewell/trace-mapping@0.3.31':\n    dependencies:\n      '@jridgewell/resolve-uri': 3.1.2\n",
    "\n  '@jridgewell/sourcemap-codec@1.5.5': {}\n\n  '@jridgewell/trace-mapping@0.3.31':\n    dependencies:\n      '@jridgewell/resolve-uri': 3.1.2\n"
  ],
  [
    "    dependencies:\n      '@nodelib/fs.scandir': 2.1.5\n      fastq: 1.19.1\n\n  '@oxc-project/types@0.156.0': {}\n\n  '@panva/hkdf@1.2.1': {}\n\n",
    "    dependencies:\n      '@nodelib/fs.scandir': 2.1.5\n      fastq: 1.19.1\n\n  '@panva/hkdf@1.2.1': {}\n\n"
  ],
  [
    "\n  '@radix-ui/rect@1.1.0': {}\n\n  '@rolldown/binding-android-arm-eabi@1.2.16':\n    optional: true\n\n  '@rolldown/binding-android-arm64@1.2.16':\n    optional: true\n\n  '@rolldown/binding-darwin-arm64@1.2.16':\n    optional: true\n\n  '@rolldown/binding-darwin-x64@1.2.16':\n    optional: true\n\n  '@rolldown/binding-freebsd-x64@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-arm-gnueabihf@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-arm64-gnu@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-arm64-musl@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-ppc64-gnu@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-s390x-gnu@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-x64-gnu@1.2.16':\n    optional: true\n\n  '@rolldown/binding-linux-x64-musl@1.2.16':\n    optional: true\n\n  '@rolldown/binding-openharmony-arm64@1.2.16':\n    optional: true\n\n  '@rolldown/binding-win32-arm64-msvc@1.2.16':\n    optional: true\n\n  '@rolldown/binding-win32-x64-msvc@1.2.16':\n    optional: true\n\n  '@rolldown/pluginutils@1.0.1': {}\n\n  '@standard-schema/spec@1.0.0': {}\n\n  '@stripe/stripe-js@8.5.3': {}\n",
    "\n  '@radix-ui/rect@1.1.0': {}\n\n  '@standard-schema/spec@1.0.0': {}\n\n  '@stripe/stripe-js@8.5.3': {}\n"
  ],
  [
    "    dependencies:\n      bcryptjs: 3.0.3\n\n  '@types/chai@5.2.3':\n    dependencies:\n      '@types/deep-eql': 4.0.2\n      assertion-error: 2.0.1\n\n  '@types/d3-array@3.2.2': {}\n\n  '@types/d3-color@3.1.3': {}\n",
    "    dependencies:\n      bcryptjs: 3.0.3\n\n  '@types/d3-array@3.2.2': {}\n\n  '@types/d3-color@3.1.3': {}\n"
  ],
  [
    "  '@types/debug@4.1.12':\n    dependencies:\n      '@types/ms': 2.1.0\n\n  '@types/deep-eql@4.0.2': {}\n\n  '@types/estree-jsx@1.0.5':\n    dependencies:\n",
    "  '@types/debug@4.1.12':\n    dependencies:\n      '@types/ms': 2.1.0\n\n  '@types/estree-jsx@1.0.5':\n    dependencies:\n"
  ],
  [
    "      next: 15.5.9(react-dom@19.2.1(react@19.2.1))(react@19.2.1)\n      react: 19.2.1\n\n  '@vitest/mocker@5.0.3(vite@8.3.5(@types/node@22.19.1)(jiti@1.21.7))':\n    dependencies:\n      '@jridgewell/trace-mapping': 0.3.31\n      '@vitest/spy': 5.0.3\n      estree-walker: 3.0.3\n      magic-string: 1.4.5\n    optionalDependencies:\n      vite: 8.3.5(@types/node@22.19.1)(jiti@1.21.7)\n\n  '@vitest/spy@5.0.3': {}\n\n  agent-base@7.1.4: {}\n\n  ansi-regex@5.0.1: {}\n",
    "      next: 15.5.9(react-dom@19.2.1(react@19.2.1))(react@19.2.1)\n      react: 19.2.1\n\n  agent-base@7.1.4: {}\n\n  ansi-regex@5.0.1: {}\n"
  ],
  [
    "  aria-hidden@1.2.6:\n    dependencies:\n      tslib: 2.8.1\n\n  assertion-error@2.0.1: {}\n\n  attr-accept@2.2.5: {}\n\n",
    "  aria-hidden@1.2.6:\n    dependencies:\n      tslib: 2.8.1\n\n  attr-accept@2.2.5: {}\n\n"
  ],
  [
    "\n  ccount@2.0.1: {}\n\n  chai@6.3.0: {}\n\n  character-entities-html4@2.1.0: {}\n\n  character-entities-legacy@3.0.0: {}\n",
    "\n  ccount@2.0.1: {}\n\n  character-entities-html4@2.1.0: {}\n\n  character-entities-legacy@3.0.0: {}\n"
  ],
  [
    "\n  destr@2.0.5: {}\n\n  detect-libc@2.1.2: {}\n\n  detect-node-es@1.1.0: {}\n\n",
    "\n  destr@2.0.5: {}\n\n  detect-libc@2.1.2:\n    optional: true\n\n  detect-node-es@1.1.0: {}\n\n"
  ],
  [
    "\n  es-errors@1.3.0: {}\n\n  es-module-lexer@2.3.2: {}\n\n  es-object-atoms@1.1.1:\n    dependencies:\n      es-errors: 1.3.0\n",
    "\n  es-errors@1.3.0: {}\n\n  es-object-atoms@1.1.1:\n    dependencies:\n      es-errors: 1.3.0\n"
  ],
  [
    "\n  estree-util-is-identifier-name@3.0.0: {}\n\n  estree-walker@3.0.3:\n    dependencies:\n      '@types/estree': 1.0.8\n\n  eventemitter3@4.0.7: {}\n\n  expect-type@1.4.0: {}\n\n  exsolve@1.0.8: {}\n\n",
    "\n  estree-util-is-identifier-name@3.0.0: {}\n\n  eventemitter3@4.0.7: {}\n\n  exsolve@1.0.8: {}\n\n"
  ],
  [
    "  fdir@6.5.0(picomatch@4.0.3):\n    optionalDependencies:\n      picomatch: 4.0.3\n\n  fdir@6.5.0(picomatch@4.0.7):\n    optionalDependencies:\n      picomatch: 4.0.7\n\n  fetch-blob@3.2.0:\n    dependencies:\n",
    "  fdir@6.5.0(picomatch@4.0.3):\n    optionalDependencies:\n      picomatch: 4.0.3\n\n  fetch-blob@3.2.0:\n    dependencies:\n"
  ],
  [
    "      jwa: 2.0.1\n      safe-buffer: 5.2.1\n\n  lightningcss-android-arm64@1.33.0:\n    optional: true\n\n  lightningcss-darwin-arm64@1.33.0:\n    optional: true\n\n  lightningcss-darwin-x64@1.33.0:\n    optional: true\n\n  lightningcss-freebsd-x64@1.33.0:\n    optional: true\n\n  lightningcss-linux-arm-gnueabihf@1.33.0:\n    optional: true\n\n  lightningcss-linux-arm64-gnu@1.33.0:\n    optional: true\n\n  lightningcss-linux-arm64-musl@1.33.0:\n    optional: true\n\n  lightningcss-linux-x64-gnu@1.33.0:\n    optional: true\n\n  lightningcss-linux-x64-musl@1.33.0:\n    optional: true\n\n  lightningcss-win32-arm64-msvc@1.33.0:\n    optional: true\n\n  lightningcss-win32-x64-msvc@1.33.0:\n    optional: true\n\n  lightningcss@1.33.0:\n    dependencies:\n      detect-libc: 2.1.2\n    optionalDependencies:\n      lightningcss-android-arm64: 1.33.0\n      lightningcss-darwin-arm64: 1.33.0\n      lightningcss-darwin-x64: 1.33.0\n      lightningcss-freebsd-x64: 1.33.0\n      lightningcss-linux-arm-gnueabihf: 1.33.0\n      lightningcss-linux-arm64-gnu: 1.33.0\n      lightningcss-linux-arm64-musl: 1.33.0\n      lightningcss-linux-x64-gnu: 1.33.0\n      lightningcss-linux-x64-musl: 1.33.0\n      lightningcss-win32-arm64-msvc: 1.33.0\n      lightningcss-win32-x64-msvc: 1.33.0\n\n  lilconfig@3.1.3: {}\n\n  lines-and-columns@1.2.4: {}\n",
    "      jwa: 2.0.1\n      safe-buffer: 5.2.1\n\n  lilconfig@3.1.3: {}\n\n  lines-and-columns@1.2.4: {}\n"
  ],
  [
    "  lucide-react@0.454.0(react@19.2.1):\n    dependencies:\n      react: 19.2.1\n\n  magic-string@1.4.5:\n    dependencies:\n      '@jridgewell/sourcemap-codec': 1.6.0\n\n  markdown-table@3.0.4: {}\n\n",
    "  lucide-react@0.454.0(react@19.2.1):\n    dependencies:\n      react: 19.2.1\n\n  markdown-table@3.0.4: {}\n\n"
  ],
  [
    "\n  nanoid@3.3.11: {}\n\n  nanoid@3.3.20: {}\n\n  next-auth@4.24.13(next@15.5.9(react-dom@19.2.1(react@19.2.1))(react@19.2.1))(react-dom@19.2.1(react@19.2.1))(react@19.2.1):\n    dependencies:\n      '@babel/runtime': 7.28.4\n",
    "\n  nanoid@3.3.11: {}\n\n  next-auth@4.24.13(next@15.5.9(react-dom@19.2.1(react@19.2.1))(react@19.2.1))(react-dom@19.2.1(react@19.2.1))(react@19.2.1):\n    dependencies:\n      '@babel/runtime': 7.28.4\n"
  ],
  [
    "\n  object-inspect@1.13.4: {}\n\n  obug@2.2.1: {}\n\n  ohash@2.0.11: {}\n\n  oidc-token-hash@5.2.0: {}\n",
    "\n  object-inspect@1.13.4: {}\n\n  ohash@2.0.11: {}\n\n  oidc-token-hash@5.2.0: {}\n"
  ],
  [
    "\n  picomatch@4.0.3: {}\n\n  picomatch@4.0.7: {}\n\n  pify@2.3.0: {}\n\n  pirates@4.0.7: {}\n",
    "\n  picomatch@4.0.3: {}\n\n  pify@2.3.0: {}\n\n  pirates@4.0.7: {}\n"
  ],
  [
    "      nanoid: 3.3.11\n      picocolors: 1.1.1\n      source-map-js: 1.2.1\n\n  postcss@8.5.32:\n    dependencies:\n      nanoid: 3.3.20\n      picocolors: 1.1.1\n      source-map-js: 1.2.2\n\n  postcss@8.5.6:\n    dependencies:\n",
    "      nanoid: 3.3.11\n      picocolors: 1.1.1\n      source-map-js: 1.2.1\n\n  postcss@8.5.6:\n    dependencies:\n"
  ],
  [
    "  rimraf@5.0.10:\n    dependencies:\n      glob: 10.5.0\n\n  rolldown@1.2.16:\n    dependencies:\n      '@oxc-project/types': 0.156.0\n      '@rolldown/pluginutils': 1.0.1\n    optionalDependencies:\n      '@rolldown/binding-android-arm-eabi': 1.2.16\n      '@rolldown/binding-android-arm64': 1.2.16\n      '@rolldown/binding-darwin-arm64': 1.2.16\n      '@rolldown/binding-darwin-x64': 1.2.16\n      '@rolldown/binding-freebsd-x64': 1.2.16\n      '@rolldown/binding-linux-arm-gnueabihf': 1.2.16\n      '@rolldown/binding-linux-arm64-gnu': 1.2.16\n      '@rolldown/binding-linux-arm64-musl': 1.2.16\n      '@rolldown/binding-linux-ppc64-gnu': 1.2.16\n      '@rolldown/binding-linux-s390x-gnu': 1.2.16\n      '@rolldown/binding-linux-x64-gnu': 1.2.16\n      '@rolldown/binding-linux-x64-musl': 1.2.16\n      '@rolldown/binding-openharmony-arm64': 1.2.16\n      '@rolldown/binding-win32-arm64-msvc': 1.2.16\n      '@rolldown/binding-win32-x64-msvc': 1.2.16\n\n  run-parallel@1.2.0:\n    dependencies:\n",
    "  rimraf@5.0.10:\n    dependencies:\n      glob: 10.5.0\n\n  run-parallel@1.2.0:\n    dependencies:\n"
  ],
  [
    "\n  source-map-js@1.2.1: {}\n\n  source-map-js@1.2.2: {}\n\n  space-separated-tokens@2.0.2: {}\n\n  std-env@4.3.0: {}\n\n  string-width@4.2.3:\n    dependencies:\n",
    "\n  source-map-js@1.2.1: {}\n\n  space-separated-tokens@2.0.2: {}\n\n  string-width@4.2.3:\n    dependencies:\n"
  ],
  [
    "\n  tiny-invariant@1.3.3: {}\n\n  tinybench@6.2.3: {}\n\n  tinyexec@1.0.2: {}\n\n  tinyexec@1.3.1: {}\n\n  tinyglobby@0.2.15:\n    dependencies:\n      fdir: 6.5.0(picomatch@4.0.3)\n      picomatch: 4.0.3\n\n  tinyglobby@0.2.17:\n    dependencies:\n      fdir: 6.5.0(picomatch@4.0.7)\n      picomatch: 4.0.7\n\n  to-regex-range@5.0.1:\n    dependencies:\n",
    "\n  tiny-invariant@1.3.3: {}\n\n  tinyexec@1.0.2: {}\n\n  tinyglobby@0.2.15:\n    dependencies:\n      fdir: 6.5.0(picomatch@4.0.3)\n      picomatch: 4.0.3\n\n  to-regex-range@5.0.1:\n    dependencies:\n"
  ],
  [
    "      d3-time: 3.1.0\n      d3-timer: 3.0.1\n\n  vite@8.3.5(@types/node@22.19.1)(jiti@1.21.7):\n    dependencies:\n      lightningcss: 1.33.0\n      picomatch: 4.0.7\n      postcss: 8.5.32\n      rolldown: 1.2.16\n      tinyglobby: 0.2.17\n    optionalDependencies:\n      '@types/node': 22.19.1\n      fsevents: 2.3.3\n      jiti: 1.21.7\n\n  vitest@5.0.3(@types/node@22.19.1)(vite@8.3.5(@types/node@22.19.1)(jiti@1.21.7)):\n    dependencies:\n      '@types/chai': 5.2.3\n      '@vitest/mocker': 5.0.3(vite@8.3.5(@types/node@22.19.1)(jiti@1.21.7))\n      chai: 6.3.0\n      es-module-lexer: 2.3.2\n      expect-type: 1.4.0\n      magic-string: 1.4.5\n      obug: 2.2.1\n      picomatch: 4.0.7\n      std-env: 4.3.0\n      tinybench: 6.2.3\n      tinyexec: 1.3.1\n      tinyglobby: 0.2.17\n      vite: 8.3.5(@types/node@22.19.1)(jiti@1.21.7)\n      why-is-node-running: 3.2.1\n    optionalDependencies:\n      '@types/node': 22.19.1\n    transitivePeerDependencies:\n      - msw\n\n  web-streams-polyfill@3.3.3: {}\n\n  webidl-conversions@3.0.1: {}\n",
    "      d3-time: 3.1.0\n      d3-timer: 3.0.1\n\n  web-streams-polyfill@3.3.3: {}\n\n  webidl-conversions@3.0.1: {}\n"
  ],
  [
    "  which@2.0.2:\n    dependencies:\n      isexe: 2.0.0\n\n  why-is-node-running@3.2.1: {}\n\n  wrap-ansi@7.0.0:\n    dependencies:\n",
    "  which@2.0.2:\n    dependencies:\n      isexe: 2.0.0\n\n  wrap-ansi@7.0.0:\n    dependencies:\n"
  ]
];
/** Normalize only exact voice-port rows before an older proof checks its raw diff. Unknown rows stay visible. */
export function voiceCoreProofDiffLines(rel, lines) {
  if (!Object.prototype.hasOwnProperty.call(VOICE_CORE_PROOF_EDITS, rel)) return lines;
  const restored = new Set();
  const out = lines.flatMap(line => {
    if (!line.startsWith("+") || line.startsWith("+++")) return [line];
    const source = line.slice(1) + "\n";
    const normalized = stripVoiceCore(rel, source);
    if (normalized === source) return [line];
    if (!normalized) return [];
    const rows = (normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized).split("\n");
    rows.forEach(row => restored.add(row));
    return rows.map(row => "+" + row);
  });
  // Only a known restored read/pin row can become unchanged; unrelated additions/removals are never cancelled.
  for (const row of restored) {
    let plus = out.indexOf("+" + row), minus = out.indexOf("-" + row);
    while (plus !== -1 && minus !== -1) {
      out.splice(Math.max(plus, minus), 1); out.splice(Math.min(plus, minus), 1);
      plus = out.indexOf("+" + row); minus = out.indexOf("-" + row);
    }
  }
  return out;
}
export function stripVoiceCore(rel, text) {
  if (VOICE_CORE_PROOF_EDITS[rel]) {
    let out = text;
    for (const [has, was] of VOICE_CORE_PROOF_EDITS[rel]) out = out.replace(has, was);
    return out;
  }
  if (rel === "scripts/studio-later-changes.mjs") {
    let out = text;
    for (const line of VOICE_CORE_REGISTRY_LINES) out = out.replace(line, "");
    return out;
  }
  if (rel === "pnpm-lock.yaml") {
    let out = text;
    for (const [has, was] of [...VOICE_CORE_LOCK_EDITS].reverse()) out = out.replace(has, was);
    return out;
  }
  if (rel === "package.json") return text
    .replace('"test:studio-launch-wording": "node scripts/test-studio-launch-wording.mjs",\n    "test:studio-voice-core": "vitest run --config scripts/studio-voice-vitest.config.mjs"', '"test:studio-launch-wording": "node scripts/test-studio-launch-wording.mjs"')
    .replace('    "vitest": "5.0.3",\n', '');
  return text;
}
