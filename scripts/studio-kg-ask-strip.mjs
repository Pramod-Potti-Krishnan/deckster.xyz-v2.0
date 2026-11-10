// Studio "Ask your second brain" (flag NEXT_PUBLIC_STUDIO_KG_ASK): the exact text this change adds to the two shared files it touches (the Knowledge page and .env.example), so a pin that holds
// one of them to an earlier commit can first put the base text back (stripKgAsk(rel, text)), the way scripts/studio-p2-polish-strip.mjs and scripts/studio-p2-publish-strip.mjs do.
// scripts/test-studio-kg-ask.mjs proves that stripping gives back the base commit's files byte for byte, so nothing else of those files is changed. New files (no base text to put back):
// app/api/knowledge-graph/query/route.ts, components/knowledge/studio-kg-ask.{tsx,css}, hooks/use-studio-kg-ask.ts, lib/studio-kg-ask.ts and the two scripts.

export const KG_ASK_FILES = ['.env.example', 'app/(app)/knowledge/page.tsx']

export const KG_ASK_ENV_FROM = '\n# STUDIO KG ASK, "Ask your second brain"'
export const KG_ASK_ENV_TO = 'NEXT_PUBLIC_STUDIO_KG_ASK="false"\n'

// text this change adds to the page; each is found exactly once
export const KG_ASK_PAGE_ADDED = [
  'import { StudioKgAsk } from "@/components/knowledge/studio-kg-ask"\n',
  '// "Ask your second brain" (lib/studio-kg-ask.ts): a question box above the map that shows the passages the graph holds on a question, with their sources. Exact "true" AND the Studio shell; default off, and then the page is exactly as before.\nconst KG_ASK = process.env.NEXT_PUBLIC_STUDIO_KG_ASK === "true" && STUDIO_SHELL\n',
  '      {KG_ASK && <StudioKgAsk />}\n\n',
]

export function stripKgAsk(rel, text) {
  let out = text
  if (rel === '.env.example') {
    const from = out.indexOf(KG_ASK_ENV_FROM)
    if (from !== -1) {
      const to = out.indexOf(KG_ASK_ENV_TO, from)
      if (to !== -1) out = out.slice(0, from) + out.slice(to + KG_ASK_ENV_TO.length)
    }
  } else if (rel === 'app/(app)/knowledge/page.tsx') {
    for (const added of KG_ASK_PAGE_ADDED) out = out.split(added).join('')
  }
  return out
}
