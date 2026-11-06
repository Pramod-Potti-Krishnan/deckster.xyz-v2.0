// FRONTEND-1: the one rule the Pass 3 pins of #470 / #472 / #473 / #475 ask when they hold a file to an earlier commit with this change's lines out ("stripping this change gives back <base>'s file").
// .env.example is the shared file every flag-gated change appends a block of its own flag to, so a change stacked on those four, or merged after them, leaves lines in it that none of them wrote.
// A byte-for-byte compare refuses all of those. sameAsBase(rel, text, baseText, ownFlags) keeps the byte-for-byte rule for every file but .env.example. For .env.example the base's lines must all still be there, in order,
// with the same values (a line edited, dropped or moved fails), and whatever else the file holds must come in runs that carry a comment or an env assignment of another flag (not a second value for a base variable); the blank lines of a block go with it,
// a lone blank line is a leftover of a strip that took out too little, and a line naming one of `ownFlags` (a regexp) is this change's own block left behind. Same rule scripts/test-studio-p2-polish.mjs and
// scripts/test-studio-p2-publish.mjs use, a little stricter. scripts/test-studio-env-append-tolerant.mjs holds it to that.
export function sameAsBase(rel, text, baseText, ownFlags) {
  if (text === baseText) return true
  if (rel !== '.env.example') return false
  const want = baseText.split('\n'), runs = [], names = new Set(want.filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => line.slice(0, line.indexOf('='))))
  let next = 0, run = null
  for (const line of text.split('\n')) {
    if (next < want.length && line === want[next]) { next++; run = null } else { if (!run) runs.push(run = []); run.push(line) }
  }
  return next === want.length && runs.every(extra => extra.some(line => /\S/.test(line)) && extra.every(line => /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/.test(line) && !ownFlags.test(line) && !names.has(line.slice(0, line.indexOf('=')))))
}
