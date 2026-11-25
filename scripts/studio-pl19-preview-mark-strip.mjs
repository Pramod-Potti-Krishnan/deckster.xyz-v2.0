// PL-19 (Platform card, 25 Nov): a Vercel PREVIEW build shows one fixed mark on every Studio page. The ONLY existing file it touches is next.config.mjs (the build-time hook), which older proofs hold to the base commit byte for byte.
// So this change registers a code strip: stripPl19PreviewMark(rel, text) takes its three exact insertions back out of next.config.mjs and returns every other file untouched. No .env.example block (no flag, no setting). Plain node, nothing read from disk or git here.

export const PL19_BASE_COMMIT = '54c5f70e0e' // studio-v4-dev-preparation-code, the branch this change is cut from (its next.config.mjs is what the strip restores)
export const PL19_COMMIT_SUBJECT = /^PL-19:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL19_SCOPE_FILES = new Set([
  'next.config.mjs',
  'components/preview-build/preview-toaster.tsx',
  'scripts/test-studio-preview-build-mark.mjs',
  'scripts/studio-pl19-preview-mark-strip.mjs',
  'scripts/studio-later-changes.mjs',
])

/** The three insertions this change makes in next.config.mjs, exactly as committed (generated from the diff against the base, not retyped). */
export const PL19_CONFIG_INSERTIONS = [
  "import { fileURLToPath } from 'node:url'\n",
  "// PL-19: a Vercel PREVIEW build shows one fixed mark on every page (\"Preview build: not the UAT product\"), so a PR preview is never taken for the UAT product.\n// Decided HERE, at build time, from Vercel's own system variable VERCEL_ENV (\"production\" | \"preview\" | \"development\"), which Vercel sets on the builds it runs\n// (a Git-integration PR preview is \"preview\"; the UAT and production deploys run `vercel build --prod`, so they are \"production\"): no project setting, no\n// variable on any Vercel target, nothing copied to the preview target. Anything other than exactly \"preview\" (including unset) adds NOTHING to this config,\n// so a production-target build compiles exactly what it did before. On preview the root layout's toaster import is swapped for a wrapper that adds the mark.\nconst isVercelPreviewBuild = process.env.VERCEL_ENV === 'preview'\nconst previewToasterFile = fileURLToPath(new URL('./components/preview-build/preview-toaster.tsx', import.meta.url))\n\n",
  "  ...(isVercelPreviewBuild\n    ? {\n        webpack(config, { webpack }) {\n          config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\\/components\\/ui\\/toaster$/, previewToasterFile))\n          return config\n        },\n      }\n    : {}),\n",
]

/** (rel, text) => text: next.config.mjs without this change's three insertions; any other file as it is. Each insertion is removed once, only where it stands whole. */
export function stripPl19PreviewMark(rel, text) {
  if (rel !== 'next.config.mjs') return text
  let out = text
  for (const chunk of PL19_CONFIG_INSERTIONS) {
    const at = out.indexOf(chunk)
    if (at >= 0) out = out.slice(0, at) + out.slice(at + chunk.length)
  }
  return out
}
