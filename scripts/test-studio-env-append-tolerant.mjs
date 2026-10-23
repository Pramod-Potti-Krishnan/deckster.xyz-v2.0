// FRONTEND-1: the .env.example rule of scripts/studio-env-append-tolerant.mjs (sameAsBase), which the Pass 3 pins of #470 / #472 / #473 / #475 use to hold the file to an earlier commit with their own block out.
// Plain node, no network, no git: the base here is this tree's own .env.example, so the test needs no old commit. Proves that
//   - a later change's block (comments, blanks, an assignment of another flag) after the last block, between two blocks, or at the top is tolerated;
//   - a base line edited, dropped, duplicated into a different value, moved, or a base comment dropped is refused (the "base line" mutants), as is a line that is not a comment, a blank or an assignment,
//     a lone blank line (the leftover of a strip that took out too little), and this change's own flag left behind;
//   - every file but .env.example is held to the base byte for byte;
//   - and that each mutant of the rule (a check removed from the module) is caught by one of those.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULE = 'scripts/studio-env-append-tolerant.mjs'
const root = new URL('../', import.meta.url)
const source = fs.readFileSync(fileURLToPath(new URL(MODULE, root)), 'utf8')
const base = fs.readFileSync(fileURLToPath(new URL('.env.example', root)), 'utf8')
const load = text => new Function(`${text.replace(/^export /gm, '')}\nreturn { sameAsBase }`)().sameAsBase

let checks = 0
const is = (value, message) => { checks++; assert.ok(value, message) }
const OWN = /NEXT_PUBLIC_OWN_FLAG\b/
const later = '\n# A LATER CHANGE (a made-up flag, for this check)\n# a comment\nNEXT_PUBLIC_SOME_LATER_FLAG="false"\n'
const lines = base.split('\n')
const assignments = lines.map((line, i) => (/^[A-Z][A-Z0-9_]*=/.test(line) ? i : -1)).filter(i => i > 0)
const [first, second] = assignments
const mid = assignments[Math.floor(assignments.length / 2)]
assert.ok(assignments.length > 10 && first > 0 && second > first, 'the tree has an .env.example with env lines to edit')

/** What the rule must say for `rule`: [label, expected, text, rel?]. Every refusal is a base line mutant or a stray line. */
function cases() {
  const edit = (i, to) => lines.map((line, at) => (at === i ? to : line)).join('\n')
  const swapped = lines.map((line, at) => (at === first ? lines[second] : at === second ? lines[first] : line)).join('\n')
  const dup = lines.slice(0, first + 1).concat(lines.slice(first)).join('\n')
  const comment = lines.findIndex((line, at) => at > 0 && /^#/.test(line) && line.length > 20)
  const blocks = base.indexOf('\n\n# ')
  return [
    ['the base itself', true, base],
    ['a block of another flag after the last block', true, base + later],
    ['a block of another flag between two blocks', true, base.slice(0, blocks) + '\n' + later.trimEnd() + '\n' + base.slice(blocks)],
    ['a block of another flag at the top', true, later.trimStart() + base],
    ['two later blocks, one after the other', true, base + later + later.replace('SOME_LATER', 'ANOTHER_LATER')],
    ['a later block that carries its own blank lines at both ends', true, `${base}\n\n# A LATER CHANGE\nNEXT_PUBLIC_SOME_LATER_FLAG="false"\n\n`],
    ['a base env line with another value', false, edit(first, `${lines[first]}x`) + later],
    ['a base env line with another value, in the middle of the file', false, edit(mid, `${lines[mid]}x`)],
    ['the last base env line with another value', false, edit(assignments.at(-1), `${lines[assignments.at(-1)]}x`)],
    ['a base env line dropped', false, lines.filter((_, at) => at !== first).join('\n') + later],
    ['the last base line dropped', false, lines.slice(0, lines.findLastIndex(line => line.trim() !== '')).join('\n')],
    ['a base comment dropped', false, lines.filter((_, at) => at !== comment).join('\n') + later],
    ['two base env lines in the other order', false, swapped + later],
    ['a base env line repeated with another value', false, dup.replace(lines[first], `${lines[first]}y`) + later],
    ['a line that is not a comment, a blank or an assignment', false, `${base}\nnot a comment, a blank or an assignment\n`],
    ['a lone blank line inside the base', false, [...lines.slice(0, mid), '', ...lines.slice(mid)].join('\n')],
    ['a lone blank line after the base', false, `${base}\n`],
    ['a block of another flag that ends with its own blank line', true, `${base}${later}\n`],
    ['this change\'s own flag left behind', false, `${base}\n# a block\nNEXT_PUBLIC_OWN_FLAG="false"\n`],
    ['this change\'s own flag named in a later comment', false, `${base}\n# see NEXT_PUBLIC_OWN_FLAG\n`],
    ['another file, byte for byte', true, 'some text', 'README.md', 'some text'],
    ['another file, a block of another flag appended', false, 'some text' + later, 'README.md', 'some text'],
    ['package.json, one more byte', false, '{}\n', 'package.json', '{}'],
  ]
}

function prove(rule, label) {
  for (const [what, want, text, rel = '.env.example', baseText = base] of cases()) {
    is(rule(rel, text, baseText, OWN) === want, `${label}: ${what} is ${want ? 'tolerated' : 'refused'}`)
  }
}

prove(load(source), 'the rule')
// The module has no other export and reads nothing.
is(/^export function sameAsBase\(/m.test(source) && (source.match(/^export /gm) ?? []).length === 1, 'the module exports sameAsBase only')
is(!/\b(process|require|import|fetch|readFile)\b/.test(source.replace(/^\/\/.*$/gm, '')), 'the module reads nothing')

// Each mutant removes one check from the rule; one of the cases above must catch it.
const swap = (text, from, to) => { is(text.includes(from), `mutant text exists: ${from.slice(0, 50)}`); return text.replace(from, () => to) }
const MUTANTS = [
  ['the base order and values are forgotten', t => swap(t, 'return next === want.length && runs.every(', 'return runs.every(')],
  ['any line passes as an extra', t => swap(t, '/^\\s*$|^\\s*#|^[A-Z][A-Z0-9_]*=/.test(line) && !ownFlags.test(line)', 'true')],
  ['this change\'s own flag may stay', t => swap(t, ' && !ownFlags.test(line)', '')],
  ['a lone blank line passes', t => swap(t, 'extra.some(line => /\\S/.test(line)) && ', '')],
  ['every file takes the tolerance', t => swap(t, 'if (rel !== \'.env.example\') return false\n', '')],
  ['the byte-for-byte shortcut is gone but so is the tolerance', t => swap(t, 'return next === want.length && runs.every(', 'return false && runs.every(')],
  ['a comment line is not a legal extra', t => swap(t, '|^\\s*#|', '|')],
  ['an assignment is not a legal extra', t => swap(t, '|^[A-Z][A-Z0-9_]*=/.test(line)', '/.test(line)')],
  ['a base variable may be given a second value', t => swap(t, ' && !names.has(line.slice(0, line.indexOf(\'=\')))', '')],
  ['a base line is matched by value only', t => swap(t, 'line === want[next]', 'line.slice(0, 12) === want[next].slice(0, 12)')],
  ['a base line is matched out of order', t => swap(t, 'line === want[next]', 'want.includes(line)')],
]
let caught = 0
for (const [name, mutate] of MUTANTS) {
  const mutated = mutate(source)
  assert.notEqual(mutated, source, `mutant "${name}" changes the module`)
  let rule = null
  try { rule = load(mutated) } catch { caught++; continue } // a mutant that does not even load is caught too
  const before = checks
  let survived = true
  for (const [what, want, text, rel = '.env.example', baseText = base] of cases()) if (rule(rel, text, baseText, OWN) !== want) { survived = false; break }
  checks = before
  assert.ok(!survived, `mutant survived: ${name}`)
  caught++
}
console.log(`studio-env-append-tolerant: ${checks} checks passed, ${caught}/${MUTANTS.length} mutants caught`)
