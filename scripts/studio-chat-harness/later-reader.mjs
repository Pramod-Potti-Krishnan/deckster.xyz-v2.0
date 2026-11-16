// FRONTEND-1 (chat parity chain): the reader the three chain proofs (viewer, workspace, remaining commands) read the repo through.
//
// A chain proof holds a file to "its change's lines on top of the base": the strip of its own change puts the file back to the base, byte for byte, and its own marked lines are the only lines added. Any OTHER change registered in
// scripts/studio-later-changes.mjs may have put lines into the same files (a marked line in the Builder page, a line in the composer, a block at the end of .env.example), in two ways:
//   - a change stacked on this one, or merged after it (the remaining commands, another branch's registry lines below this change's); its lines are in the file, not in this change's base;
//   - a change merged BEFORE it (its registry lines above this change's) whose branch this change was never rebased onto: its lines are in the file, not in this change's base either.
// Both are read out, whichever side of this change they were registered on: of every registered strip but this change's own, newest first, a strip is applied when it takes something out of the file AND its lines are not in this change's base
// (the strip leaves the base's file as it is). A change that is in the base (the older changes of dev, the changes below this one in the chain) is left in, as the base has it. The same for .env.example: a registered block that
// this change's base does not have comes out, the one blank line before it with it. A proof run in a clone without its base commit cannot tell, and reads out only the strips registered after its own change.
//
// Nothing registered besides this change, and a read is the file as it is. Plain node, no git here: the proof gives `baseText(rel)` (the base's file, '' when the base has none).
//
//   const reader = makeLaterReader({ registry, ownStrip, ownBlock, baseText })
//   reader.out(rel, text)        the text as this change left it
//   reader.install(fs, root, path)   makes every fs.readFileSync of a file under `root` return that (returns the real readFileSync)

export function makeLaterReader({ registry, ownStrip, ownBlock = null, baseText = null }) {
  const strips = registry.LATER_STRIPS
  const at = strips.indexOf(ownStrip)
  // newest first: the registry lists the changes in the order they were stacked, and a change's lines come out before the ones it was stacked on
  const candidates = (baseText ? strips.filter(fn => fn !== ownStrip) : at === -1 ? [] : strips.slice(at + 1)).filter(fn => typeof fn === 'function').reverse()
  const blocks = (baseText ? registry.LATER_ENV_BLOCKS.filter(block => block !== ownBlock) : ownBlock === null || registry.LATER_ENV_BLOCKS.indexOf(ownBlock) === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(ownBlock) + 1)).filter(block => typeof block === 'string' && block.trim() !== '')
  const bases = new Map(), inBase = new Map(), memo = new Map()
  const baseOf = rel => { if (!bases.has(rel)) bases.set(rel, baseText(rel) ?? ''); return bases.get(rel) }
  /** The strip's lines are not in the base's file (the strip leaves it as it is), so this change did not leave them there. */
  const notInBase = (fn, rel) => {
    if (!baseText) return true
    if (!inBase.has(rel)) inBase.set(rel, new Map())
    const known = inBase.get(rel)
    if (!known.has(fn)) { const base = baseOf(rel), stripped = fn(rel, base); known.set(fn, typeof stripped !== 'string' || stripped === base) }
    return known.get(fn)
  }
  const out = (rel, text) => {
    if (typeof text !== 'string') return text
    const key = `${rel}\0${text}`
    if (memo.has(key)) return memo.get(key)
    let result = text
    for (const fn of candidates) {
      const next = fn(rel, result)
      if (typeof next === 'string' && next !== result && notInBase(fn, rel)) result = next
    }
    if (rel === '.env.example') {
      const base = baseText ? baseOf(rel) : null
      for (const block of blocks) if (base === null || !base.includes(block)) result = result.replace(`\n${block}`, '')
    }
    memo.set(key, result)
    return result
  }
  const install = (fsModule, root, path) => {
    const real = fsModule.readFileSync
    fsModule.readFileSync = function (file, ...rest) {
      const text = real.call(this, file, ...rest)
      const rel = typeof file === 'string' ? path.relative(root, file) : ''
      return typeof text === 'string' && rel && !rel.startsWith('..') ? out(rel, text) : text
    }
    return real
  }
  return { out, install, strips: candidates, blocks }
}
