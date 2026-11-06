// UAT MARKETING PORT (flag NEXT_PUBLIC_STUDIO_UAT_MARKETING): the table that says exactly how every ported file differs from its source, and the generator that writes them.
//
//   node scripts/studio-uat-marketing-port.mjs --write     regenerate every ported file from the two pinned commits (idempotent)
//   node scripts/studio-uat-marketing-port.mjs --check     exit 1 if a ported file in the working tree is not what --write would produce
//
// Two sources, both pinned by commit so a later change of either shows up as a red line in scripts/test-studio-uat-marketing.mjs, never silently:
//   UAT_COMMIT  the `uat` tip the marketing pass 2 was merged at (ee532fa). Components, pages, content, metadata, CSS block, images, logos.
//   DEV_BASE    the studio-v4-dev-preparation-code tip this port branched from. The unflagged route files and hooks/use-v3-deck.ts are edited FROM it, so the edits are mechanical and reversible.
// Override with UAT_MARKETING_UAT=<commit> / UAT_MARKETING_BASE=<commit> (the test reads the same variables).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const UAT_COMMIT = process.env.UAT_MARKETING_UAT || 'ee532fab4b84a6883f8a5b50675ccab692b62240'
export const DEV_BASE = process.env.UAT_MARKETING_BASE || 'de4d8e3efdd15594a8be84422c0a9494842b6264'

const git = (args, encoding = 'utf8') => execFileSync('git', args, { cwd: repoRoot, encoding, maxBuffer: 256 * 1024 * 1024 })
const cache = new Map()
export const uatBlob = (rel, encoding = 'utf8') => { const key = `u:${rel}:${encoding}`; if (!cache.has(key)) cache.set(key, git(['show', `${UAT_COMMIT}:${rel}`], encoding)); return cache.get(key) }
export const baseBlob = (rel, encoding = 'utf8') => { const key = `b:${rel}:${encoding}`; if (!cache.has(key)) cache.set(key, git(['show', `${DEV_BASE}:${rel}`], encoding)); return cache.get(key) }

/** Replace `from` with `to` exactly `count` times (default once); anything else is an error, so a drifting source breaks loudly. `count: 'any'` allows zero or more. */
export function edit(text, from, to, count = 1, label = from.slice(0, 60)) {
  const parts = text.split(from)
  const found = parts.length - 1
  if (count === 'any' ? false : found !== count) throw new Error(`edit expected ${count} x ${JSON.stringify(label)}, found ${found}`)
  return parts.join(to)
}
export function editRegex(text, re, to, label = String(re)) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g'
  const found = [...text.matchAll(new RegExp(re.source, flags))].length
  if (found !== 1) throw new Error(`editRegex expected 1 x ${label}, found ${found}`)
  return text.replace(new RegExp(re.source, re.flags.replace('g', '')), to)
}

const CONTENT_IMPORT = '"@/lib/marketing/v3-content"'
const VIEW_IMPORT = '"@/lib/marketing/v3-uat-view"'
const SLIDES_FROM = '/marketing/v3/slides/'
const SLIDES_TO = '/marketing/v3-uat/slides/'

/** Applied to every copied component and page: the content comes from the UAT view, the stills from the UAT set. */
const common = text => edit(edit(text, CONTENT_IMPORT, VIEW_IMPORT, 'any'), SLIDES_FROM, SLIDES_TO, 'any')
const pageCommon = text => edit(common(text), '"@/components/marketing/v3/', '"@/components/marketing/v3-uat/', 'any')

// ---------------------------------------------------------------- components (UAT components/marketing/v3/** -> components/marketing/v3-uat/**)
const VERBATIM = [
  'AudienceQA', 'BringFlow', 'BuildCta', 'CycleWord', 'ExpertsLoop', 'KnowledgeGraphCanvas', 'PlayerSlides', 'SlideChip', 'StatusPill', 'SvgDefs', 'ThemeSwitch', 'V3Spotlight', 'Waveform', 'ZoomBuild',
  'home/Begin', 'home/Bring', 'home/Experts', 'home/Gallery', 'home/Knowledge', 'home/RealDeck', 'home/Themes',
]

/** The documented differences from the UAT file, beyond `common`. Each is one exact replacement; the comment says why (D2 = phone menu, D3 = LAND-05 words, D5 = ACC-14 plan words, P2 Docs = footer links). */
const COMPONENT_EDITS = {
  // D2: UAT's phone menu keeps LAND-06's behaviours: a press outside closes it, Escape closes and hands the focus back, choosing a link closes.
  'HeaderV3': text => {
    let next = text
    next = edit(next, 'import { useEffect, useState } from "react"', 'import { useEffect, useRef, useState } from "react"')
    next = edit(next, 'import { trackCta } from "@/lib/analytics"\n', 'import { trackCta } from "@/lib/analytics"\nimport { studioUatMenuKeyEvent, studioUatMenuNext, studioUatMenuRestoresFocus, type StudioUatMenuEvent } from "@/lib/studio-uat-marketing"\n')
    next = edit(next, `  // Close the phone menu on navigation and on Escape.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
`, `  const headerRef = useRef<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const send = (event: StudioUatMenuEvent) => {
    setOpen((current) => studioUatMenuNext(current, event))
    if (studioUatMenuRestoresFocus(event)) buttonRef.current?.focus()
  }

  // Close the phone menu on navigation, on Escape (the focus goes back to the button) and on a press outside the header.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const action = studioUatMenuKeyEvent(event.key)
      if (action) send(action)
    }
    const onPress = (event: Event) => {
      const target = event.target as Node | null
      if (target && headerRef.current?.contains(target)) return
      send("outside")
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPress)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPress)
    }
  }, [open])
`)
    next = edit(next, '<header className="hdr" data-v3-header>', '<header ref={headerRef} className="hdr" data-v3-header>')
    next = edit(next, '<button type="button" className="hdr__menu"', '<button ref={buttonRef} type="button" className="hdr__menu"')
    next = edit(next, 'if (!open) trackCta("v3_menu"); setOpen(!open) }}', 'if (!open) trackCta("v3_menu"); send("toggle") }}')
    next = edit(next, 'onClick={() => setOpen(false)}>{item.label}</Link>', 'onClick={() => send("choose")}>{item.label}</Link>')
    return next
  },
  // P2 Docs: the Landing footer keeps Help / Docs / Security / Cookies (flag NEXT_PUBLIC_STUDIO_P2_DOCS), on UAT's own list of links.
  'FooterV3': text => {
    let next = text
    next = edit(next, 'import { V3_CONTENT } from ' + VIEW_IMPORT + '\n', 'import { V3_CONTENT } from ' + VIEW_IMPORT + '\nimport { studioDocsFooterLinks } from "@/lib/studio-p2-docs"\n\n// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS, default off): Help, Docs, Security and Cookies join the links UAT lists. Off: UAT\'s footer as it is.\nconst STUDIO_P2_DOCS = process.env.NEXT_PUBLIC_STUDIO_P2_DOCS === "true"\n')
    next = edit(next, 'export function FooterV3() {\n  return (', 'export function FooterV3() {\n  const links = STUDIO_P2_DOCS ? studioDocsFooterLinks(V3_CONTENT.footer.links) : V3_CONTENT.footer.links\n  return (')
    next = edit(next, '{V3_CONTENT.footer.links.map((link) =>', '{links.map((link) =>')
    return next
  },
  // The runtime hook: the UAT tree's copy of use-v3-deck (generated below) so the real hook stays as it is.
  'V3Runtime': text => {
    let next = text
    next = edit(next, 'import { useV3Deck } from "@/hooks/use-v3-deck"', 'import { useV3DeckUat } from "@/hooks/use-v3-deck-uat"')
    next = edit(next, '  useV3Deck()\n', '  useV3DeckUat()\n')
    return next
  },
  // D3: the film's narration pill follows the feature's status (Beta on UAT, Live with LAND-05), not a fixed class.
  'HeroFilm': text => {
    let next = text
    next = edit(next, 'export function HeroFilm({ copy, tiles, target, youLabel, statusWord, betaWord }: {', 'export function HeroFilm({ copy, tiles, target, youLabel, statusWord, betaWord, betaStatus }: {')
    next = edit(next, '  betaWord: string\n}) {', '  betaWord: string\n  betaStatus: string\n}) {')
    next = edit(next, '<span className="st st--beta st--sm">{betaWord}</span>', '<span className={`st st--${betaStatus} st--sm`}>{betaWord}</span>')
    return next
  },
  'home/Start': text => {
    let next = text
    next = edit(next, 'import { SlideChip } from "../SlideChip"\n', 'import { SlideChip } from "../SlideChip"\nimport { statusOf } from "../StatusPill"\n')
    next = edit(next, '            betaWord={V3_STATUS_WORDS.beta}\n', '            betaWord={statusOf("narration").word}\n            betaStatus={statusOf("narration").status}\n')
    return next
  },
  // D3: the player's voice label takes the narration status colour (CSS: styles/marketing-v3-uat.css).
  'home/Present': text => edit(text, '<span className="player__voice">{copy.player.voice}</span>', '<span className={`player__voice player__voice--${statusOf("narration").status}`}>{copy.player.voice}</span>'),
  // D5: with ACC-14 on the plan words are the shared plan list's (the same call lib/studio-billing.ts gives the unflagged Landing); the Beta pill finds its line again.
  'home/Pricing': text => {
    let next = text
    next = edit(next, 'import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"\n', 'import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"\nimport { studioLandingTiers } from "@/lib/studio-billing"\nimport { studioUatBetaLine } from "@/lib/studio-uat-marketing"\n')
    next = edit(next, 'const tierHref = ', '// PASS2 ACC-14 (NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off): the plan words come from the shared plan list (PRICING_TIERS), the list Billing reads too. Off: UAT\'s copy as written.\nconst STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"\n\nconst tierHref = ')
    next = edit(next, 'export function Pricing({ copy, n, total }: { copy: PricingHomeCopy; n: number; total: number }) {\n  return (', 'export function Pricing({ copy, n, total }: { copy: PricingHomeCopy; n: number; total: number }) {\n  const tiers = studioLandingTiers(copy.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT)\n  return (')
    next = edit(next, '{copy.tiers.map((tier) => (', '{tiers.map((tier) => (')
    next = edit(next, 'feature === tier.betaFeature &&', 'feature === studioUatBetaLine(tier.features, tier.betaFeature) &&')
    return next
  },
}

export const COMPONENT_FILES = [...VERBATIM, ...Object.keys(COMPONENT_EDITS)]
const componentSource = name => `components/marketing/v3/${name}.tsx`
const componentDest = name => `components/marketing/v3-uat/${name}.tsx`
export const componentOutput = name => (COMPONENT_EDITS[name] ?? (text => text))(common(uatBlob(componentSource(name))))

// ---------------------------------------------------------------- pages (UAT app/(marketing-v3)/**/page.tsx -> components/marketing/v3-uat/pages/*.tsx)
const stripMetadata = (text, metadataRe) => {
  let next = text
  next = edit(next, 'import type { Metadata } from "next"\n', '')
  next = edit(next, 'import { v3Metadata } from "@/lib/marketing/v3-metadata"\n', '')
  return editRegex(next, metadataRe, '', 'the metadata export')
}
const METADATA_RE = /export const metadata: Metadata = v3Metadata\(\{[\s\S]*?\}\)\n\n?/

const PAGES = {
  home: { from: 'page', rename: ['MarketingV3HomePage', 'UatHomePage'] },
  about: { from: 'about/page', rename: ['AboutV3Page', 'UatAboutPage'] },
  bring: { from: 'bring/page', rename: ['BringPage', 'UatBringPage'] },
  experts: { from: 'experts/page', rename: ['ExpertsPage', 'UatExpertsPage'] },
  learn: { from: 'learn/page', rename: ['LearnV3Page', 'UatLearnPage'] },
  present: { from: 'present/page', rename: ['PresentPage', 'UatPresentPage'] },
  pricing: { from: 'pricing/page', rename: ['PricingV3Page', 'UatPricingPage'] },
}
export const PAGE_NAMES = Object.keys(PAGES)
const pageSource = name => `app/(marketing-v3)/${PAGES[name].from}.tsx`
const pageDest = name => `components/marketing/v3-uat/pages/${name}.tsx`

export function pageOutput(name) {
  const [oldName, newName] = PAGES[name].rename
  let next = pageCommon(uatBlob(pageSource(name)))
  next = stripMetadata(next, METADATA_RE)
  next = edit(next, `export default function ${oldName}(`, `export function ${newName}(`)
  if (name === 'learn') next = edit(next, 'import styles from "./learn.module.css"', 'import styles from "@/app/(marketing-v3)/learn/learn.module.css"')
  if (name === 'pricing') {
    // D5, as in the home pricing section above.
    next = edit(next, 'import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"\n', 'import { PRICING_TIERS } from "@/lib/marketing/homepage-v2-pricing"\nimport { studioLandingTiers } from "@/lib/studio-billing"\nimport { studioUatBetaLine } from "@/lib/studio-uat-marketing"\n')
    next = edit(next, 'const copy = V3_CONTENT.pages.pricing\n', 'const copy = V3_CONTENT.pages.pricing\n\n// PASS2 ACC-14 (NEXT_PUBLIC_STUDIO_P2_ACCOUNT, default off): the plan words come from the shared plan list (PRICING_TIERS), the list Billing reads too. Off: UAT\'s copy as written.\nconst STUDIO_P2_ACCOUNT = process.env.NEXT_PUBLIC_STUDIO_P2_ACCOUNT === "true"\n')
    next = edit(next, '{copy.start.tiers.map((tier) => {', '{studioLandingTiers(copy.start.tiers, PRICING_TIERS, STUDIO_P2_ACCOUNT).map((tier) => {')
    next = edit(next, '"betaFeature" in tier && feature === tier.betaFeature &&', '"betaFeature" in tier && feature === studioUatBetaLine(tier.features, tier.betaFeature) &&')
  }
  return next
}

/** components/marketing/v3-uat/pages/metadata.ts: what each page's `export const metadata` was in UAT, from the UAT view of the copy. */
export const METADATA_MODULE = `import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"
import { v3Metadata } from "@/lib/marketing/v3-metadata"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING: the title, description and share card UAT gives each Landing page (the same v3Metadata calls its page files made). The route files pick these only with the flag on. */
const pages = V3_CONTENT.pages

export const uatMarketingMetadata = {
  home: v3Metadata({ path: "/", title: V3_CONTENT.metadata.title, description: V3_CONTENT.metadata.description }),
  about: v3Metadata({ path: "/about", title: pages.about.metadata.title, description: pages.about.metadata.description }),
  bring: v3Metadata({ path: "/bring", title: pages.bring.title, description: pages.bring.description }),
  experts: v3Metadata({ path: "/experts", title: pages.experts.title, description: pages.experts.description }),
  learn: v3Metadata({ path: "/learn", title: pages.learn.metadata.title, description: pages.learn.metadata.description }),
  present: v3Metadata({ path: "/present", title: pages.present.title, description: pages.present.description }),
  pricing: v3Metadata({ path: "/pricing", title: pages.pricing.metadata.title, description: pages.pricing.metadata.description }),
} as const
`

/** components/marketing/v3-uat/shell.tsx: UAT's (marketing-v3)/layout.tsx body. The layout renders it only with the flag on, through an import() that runs only then (a build that defines the variable as anything but true leaves it out of the bundle altogether). The stylesheet is imported by the layout itself, after the base sheet: see ROUTE_EDITS. */
export const SHELL_MODULE = `import type { ReactNode } from "react"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"
import { STUDIO_UAT_ROOT_CLASS } from "@/lib/studio-uat-marketing"
import { HeaderV3 } from "./HeaderV3"
import { SvgDefs } from "./SvgDefs"
import { V3Runtime } from "./V3Runtime"
import { V3Spotlight } from "./V3Spotlight"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING: the UAT Landing shell (UAT's layout: its header with the phone menu, the pointer light, no on-screen up/down arrows). \`fonts\` is the layout's own font class list. */
export function UatMarketingShell({ fonts, children }: { fonts: string; children: ReactNode }) {
  return (
    <div className={\`mv3 \${STUDIO_UAT_ROOT_CLASS} \${fonts}\`}>
      <SvgDefs />
      <SnapDeck headerOffsetPx={56} />
      <V3Runtime />
      <V3Spotlight />
      <HeaderV3 copy={{ nav: V3_CONTENT.nav, menuExtra: V3_CONTENT.menuExtra, header: V3_CONTENT.header }} />
      {children}
      <SlideProgressRail variant="v3" />
    </div>
  )
}
`

/** lib/marketing/v3-uat-view.ts: the one module the UAT tree reads its copy from. UAT's copy file (v3-uat-content.ts, byte-identical to UAT's) with the LAND-05 ruling applied when NEXT_PUBLIC_STUDIO_P2_LANDING is on. */
export const VIEW_MODULE = `import { studioP2LandingOn } from "@/lib/studio-p2-landing"
import { studioUatContent, studioUatFeatures } from "@/lib/studio-uat-marketing"
import { SHOWCASE_SLOTS, V3_CONTENT as UAT_CONTENT, V3_FEATURES as UAT_FEATURES, V3_STATUS_WORDS, showcaseAlt } from "./v3-uat-content"
import type { V3Feature, V3Status } from "./v3-uat-content"

// PASS2 LAND-05 (NEXT_PUBLIC_STUDIO_P2_LANDING, default off): Narration and Viewers-ask are "Live" (the ruling is later than UAT's "Beta"); the sentences that said beta for them are reworded. Off: UAT's copy as written.
const STUDIO_P2_LANDING = studioP2LandingOn(process.env.NEXT_PUBLIC_STUDIO_P2_LANDING)

export const V3_FEATURES: Record<V3Feature, V3Status> = studioUatFeatures<Record<V3Feature, V3Status>>(UAT_FEATURES, STUDIO_P2_LANDING)
export const V3_CONTENT = studioUatContent(UAT_CONTENT, STUDIO_P2_LANDING)
export { SHOWCASE_SLOTS, V3_STATUS_WORDS, showcaseAlt }
export type { V3Feature, V3Status }
`

// ---------------------------------------------------------------- hook: the dev hook plus UAT's one change
export const HOOK_SOURCE = 'hooks/use-v3-deck.ts'
export const HOOK_DEST = 'hooks/use-v3-deck-uat.ts'
export function hookOutput() {
  let next = baseBlob(HOOK_SOURCE)
  next = edit(next, 'export function useV3Deck() {', '// NEXT_PUBLIC_STUDIO_UAT_MARKETING: the UAT tree\'s copy of use-v3-deck.ts. Same as it, with UAT\'s one addition (html.mv3-on-paper, which the pointer light reads); the LAND-01 night class is kept.\nexport function useV3DeckUat() {')
  next = edit(next, '        header?.classList.toggle("is-light", slides[active]?.classList.contains("slide--paper") ?? false)\n', '        const onPaper = slides[active]?.classList.contains("slide--paper") ?? false\n        header?.classList.toggle("is-light", onPaper)\n        html.classList.toggle("mv3-on-paper", onPaper)\n')
  next = edit(next, '      html.classList.remove("mv3-page")\n', '      html.classList.remove("mv3-page", "mv3-on-paper")\n')
  return next
}

// ---------------------------------------------------------------- the unflagged route files: dev's file with the dispatch added (reversible: ROUTE_EDITS pairs)
const FLAG_EXPR = 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"'
const FLAG_NOTE = '// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on this page is the UAT design (components/marketing/v3-uat). Off: the page below, as it was.\n'
const metadataImport = 'import { uatMarketingMetadata } from "@/components/marketing/v3-uat/pages/metadata"\n'
// The two pages the Landing and Account tests execute read the flag through components/marketing/v3-uat/flag.ts: the Landing test allows no other NEXT_PUBLIC_ name in present/page.tsx (not even in a comment) and the Account test's loader
// allows no import of a lib module in pricing/page.tsx beyond the ones it provides, but lets @/components/* through.
const GOVERNED_FLAG = 'studioUatMarketing.on'
const GOVERNED_NOTE = '// UAT marketing flag (default off; components/marketing/v3-uat/flag.ts): with it on this page is the UAT design (components/marketing/v3-uat). Off: the page below, as it was.\n'
const flagImport = 'import { studioUatMarketing } from "@/components/marketing/v3-uat/flag"\n'
const pageImport = (name, Component) => `import { ${Component} } from "@/components/marketing/v3-uat/pages/${name}"\n`
const asyncBody = (Component, name) => `  if (${FLAG_EXPR}) {\n    const { ${Component} } = await import("@/components/marketing/v3-uat/pages/${name}")\n    return <${Component} />\n  }\n`

/** Each entry: the dev file, then [from, to] pairs applied to it in order. \`to\` always contains \`from\` untouched as a suffix or is a pure insertion, so undoing the pairs gives the dev file back byte for byte. */
export const ROUTE_EDITS = {
  'app/(marketing-v3)/page.tsx': [
    ['import { V3_CONTENT } from "@/lib/marketing/v3-content"\n', 'import { V3_CONTENT } from "@/lib/marketing/v3-content"\n' + metadataImport],
    ['export const metadata: Metadata = {\n  title: { absolute: V3_CONTENT.metadata.title },', FLAG_NOTE + `export const metadata: Metadata = ${FLAG_EXPR} ? uatMarketingMetadata.home : {\n  title: { absolute: V3_CONTENT.metadata.title },`],
    ['export default function MarketingV3HomePage() {\n  return (', 'export default async function MarketingV3HomePage() {\n' + asyncBody('UatHomePage', 'home') + '  return ('],
  ],
  'app/(marketing-v3)/about/page.tsx': [
    ['import { BuildCta } from "@/components/marketing/v3/BuildCta"\n', 'import { BuildCta } from "@/components/marketing/v3/BuildCta"\n' + metadataImport],
    ['export const metadata: Metadata = {\n  title: { absolute: copy.metadata.title },', FLAG_NOTE + `export const metadata: Metadata = ${FLAG_EXPR} ? uatMarketingMetadata.about : {\n  title: { absolute: copy.metadata.title },`],
    ['export default function AboutV3Page() {\n  return (', 'export default async function AboutV3Page() {\n' + asyncBody('UatAboutPage', 'about') + '  return ('],
  ],
  'app/(marketing-v3)/bring/page.tsx': [
    ['import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"\n', 'import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"\n' + metadataImport],
    ['export const metadata: Metadata = { title: { absolute: copy.title }, alternates: { canonical: "/bring" } }', FLAG_NOTE + `export const metadata: Metadata = ${FLAG_EXPR} ? uatMarketingMetadata.bring : { title: { absolute: copy.title }, alternates: { canonical: "/bring" } }`],
    ['export default function BringPage() { return ', 'export default async function BringPage() {\n' + asyncBody('UatBringPage', 'bring') + '  return '],
  ],
  'app/(marketing-v3)/experts/page.tsx': [
    ['import { V3_CONTENT } from "@/lib/marketing/v3-content"\n', 'import { V3_CONTENT } from "@/lib/marketing/v3-content"\n' + metadataImport],
    ['export const metadata: Metadata = { title: { absolute: copy.title }, alternates: { canonical: "/experts" } }', FLAG_NOTE + `export const metadata: Metadata = ${FLAG_EXPR} ? uatMarketingMetadata.experts : { title: { absolute: copy.title }, alternates: { canonical: "/experts" } }`],
    ['export default function ExpertsPage() {\n  return <>', 'export default async function ExpertsPage() {\n' + asyncBody('UatExpertsPage', 'experts') + '  return <>'],
  ],
  'app/(marketing-v3)/learn/page.tsx': [
    ['import { BuildCta } from "@/components/marketing/v3/BuildCta"\n', 'import { BuildCta } from "@/components/marketing/v3/BuildCta"\n' + metadataImport],
    ['export const metadata: Metadata = {\n  title: { absolute: copy.metadata.title },', FLAG_NOTE + `export const metadata: Metadata = ${FLAG_EXPR} ? uatMarketingMetadata.learn : {\n  title: { absolute: copy.metadata.title },`],
    ['export default function LearnV3Page() {\n  return (', 'export default async function LearnV3Page() {\n' + asyncBody('UatLearnPage', 'learn') + '  return ('],
  ],
  // The two pages the Landing and Account tests execute: a plain (not async) early return, so the flag-off tree is the very same one.
  'app/(marketing-v3)/present/page.tsx': [
    ['import { studioP2LandingOn, studioP2Status } from "@/lib/studio-p2-landing"\n', 'import { studioP2LandingOn, studioP2Status } from "@/lib/studio-p2-landing"\n' + flagImport + metadataImport + pageImport('present', 'UatPresentPage')],
    ['export const metadata: Metadata = { title: { absolute: copy.title }, alternates: { canonical: "/present" } }', GOVERNED_NOTE + `export const metadata: Metadata = ${GOVERNED_FLAG} ? uatMarketingMetadata.present : { title: { absolute: copy.title }, alternates: { canonical: "/present" } }`],
    ['export default function PresentPage() { return ', `export default function PresentPage() {\n  if (${GOVERNED_FLAG}) return <UatPresentPage />\n  return `],
  ],
  'app/(marketing-v3)/pricing/page.tsx': [
    ['import { studioLandingTiers } from "@/lib/studio-billing"\n', 'import { studioLandingTiers } from "@/lib/studio-billing"\n' + flagImport + metadataImport + pageImport('pricing', 'UatPricingPage')],
    ['export const metadata: Metadata = {\n  title: { absolute: copy.metadata.title },', GOVERNED_NOTE + `export const metadata: Metadata = ${GOVERNED_FLAG} ? uatMarketingMetadata.pricing : {\n  title: { absolute: copy.metadata.title },`],
    ['export default function PricingV3Page() {\n  return (', `export default function PricingV3Page() {\n  if (${GOVERNED_FLAG}) return <UatPricingPage />\n  return (`],
  ],
  'app/(marketing-v3)/layout.tsx': [
    ['import "@/styles/marketing-v3.css"\n', 'import "@/styles/marketing-v3.css"\n// NEXT_PUBLIC_STUDIO_UAT_MARKETING: UAT\'s rules, every one scoped to .mv3:where(.mv3-uat), so inert on any page that is not the UAT tree. Imported here, straight after the base sheet, so they come after it in the cascade whatever the flag (a stylesheet pulled in only by the shell\'s import() lands before the base sheet).\nimport "@/styles/marketing-v3-uat.css"\n'],
    ['export default function MarketingV3Layout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return (', `// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on the page is wrapped in UAT's shell (its header, runtime and pointer light; components/marketing/v3-uat/shell.tsx). The import() sits inside the flag test: the shell is loaded only then (and a build that defines the variable as anything but true leaves it out of the bundle). Off: the layout below, as it was.\nexport default async function MarketingV3Layout({ children }: Readonly<{ children: React.ReactNode }>) {\n  if (${FLAG_EXPR}) {\n    const { UatMarketingShell } = await import("@/components/marketing/v3-uat/shell")\n    return <UatMarketingShell fonts={\`\${display.variable} \${body.variable} \${human.variable} \${mono.variable} \${slide.variable}\`}>{children}</UatMarketingShell>\n  }\n  return (`],
  ],
  // The share card every page without its own uses: with the flag on UAT's L-B card (a static JPEG), otherwise the generated card as it was.
  'app/opengraph-image.tsx': [
    ['import { ImageResponse } from "next/og"\n', 'import { ImageResponse } from "next/og"\nimport { readFile } from "node:fs/promises"\nimport { join } from "node:path"\n'],
    ['export const alt = "Deckster — A team of AI agents builds your deck"', `// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on the card is UAT's (public/marketing/v3/og-image.jpg: the hero line, two real slides and the L-B logo). Off: the generated card below, as it was.\nconst STUDIO_UAT_MARKETING = ${FLAG_EXPR}\nexport const alt = STUDIO_UAT_MARKETING ? "Deckster — Your knowledge. Your decks. Your voice." : "Deckster — A team of AI agents builds your deck"`],
    ['export const contentType = "image/png"', 'export const contentType = STUDIO_UAT_MARKETING ? "image/jpeg" : "image/png"'],
    ['export default function OpengraphImage() {\n  return new ImageResponse(', 'export default async function OpengraphImage() {\n  if (STUDIO_UAT_MARKETING) {\n    const image = await readFile(join(process.cwd(), "public/marketing/v3/og-image.jpg"))\n    return new Response(image, { headers: { "Content-Type": contentType } })\n  }\n  return new ImageResponse('],
  ],
  // Types only: three more CtaLocation names the UAT components send.
  'lib/analytics.ts': [
    ['  | "v3_header_sign_in"\n', '  | "v3_header_sign_in"\n  | "v3_zoom_try"\n  | "v3_menu"\n  | "v3_realdeck_open"\n'],
  ],
}

export function routeOutput(rel) {
  let next = baseBlob(rel)
  for (const [from, to] of ROUTE_EDITS[rel]) next = edit(next, from, to)
  return next
}
export function routeUndo(rel, text) {
  let next = text
  for (const [from, to] of [...ROUTE_EDITS[rel]].reverse()) next = edit(next, to, from)
  return next
}

// ---------------------------------------------------------------- app/sitemap.ts: UAT's file; robots.txt already advertises /sitemap.xml, which is a 404 today. Off: still the 404.
export function sitemapOutput() {
  let next = uatBlob('app/sitemap.ts')
  next = edit(next, "import type { MetadataRoute } from 'next'\n", "import type { MetadataRoute } from 'next'\nimport { notFound } from 'next/navigation'\n")
  next = edit(next, 'export default function sitemap(): MetadataRoute.Sitemap {\n', `// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): robots.txt names /sitemap.xml, which is a 404 on this branch without the flag; with it on the sitemap is UAT's. Off: still a 404.\nexport default function sitemap(): MetadataRoute.Sitemap {\n  if (${FLAG_EXPR.replace('process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING !== "true"')}) notFound()\n`)
  return next
}

// ---------------------------------------------------------------- the CSS: UAT's appended block, scoped to the UAT tree
const UAT_CSS = 'styles/marketing-v3.css'
export const CSS_DEST = 'styles/marketing-v3-uat.css'
/** Selectors the scoping leaves alone: classes only the UAT tree renders (the pointer light and the paper marker its runtime sets), at-rules with their own names. */
export const CSS_UNSCOPED = [/^\.v3-spot$/, /^html\.mv3-spot-on \.v3-spot$/, /^html\.mv3-on-paper \.v3-spot$/]
export const CSS_HEADER = `/* NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off). GENERATED by scripts/studio-uat-marketing-port.mjs from the block UAT appended to styles/marketing-v3.css (pass 2, 3-4 Oct 2026); do not edit by hand.
   Every selector of UAT's rules starts \`.mv3:where(.mv3-uat)\` (the root the UAT shell renders; :where() adds no specificity, so each rule keeps the specificity it had in UAT), so none of it can match a page that is not the UAT
   tree. Three selectors are not scoped because only the UAT tree renders their elements: .v3-spot and the two html markers its runtime sets. UAT's one change to an existing rule (the late .xchg width, moved inside
   min-width:901px) is restated for phones below the block. Keyframes and the @property keep their own (new) names. */
`
export const CSS_XCHG_FIX = `/* UAT wrapped the late \`.mv3 .xchg{right:66px;width:min(330px,30vw)}\` rule in min-width:901px so the phone rule (\`right:16px;width:auto\`) wins again; that rule is not touched here, so the phone layout is restated. */
@media (max-width:900px){.mv3:where(.mv3-uat) .xchg{right:16px;width:auto}}
`
export const CSS_VOICE = `/* LAND-05 (NEXT_PUBLIC_STUDIO_P2_LANDING): the player's voice label takes the narration status colour (UAT's rule above is the Beta one). */
.mv3:where(.mv3-uat) .player__voice--live{border-color:var(--st-live);color:var(--st-live)}
`

/** \`.mv3\` becomes \`.mv3:where(.mv3-uat)\`: :where() adds no specificity, so every rule keeps exactly the specificity it had in UAT and the cascade inside the UAT tree is UAT's own (an extra plain class would let UAT's rules beat base rules they lost to). */
export const SCOPE = '.mv3:where(.mv3-uat)'

export function scopeSelector(selector) {
  const trimmed = selector.trim()
  if (CSS_UNSCOPED.some(re => re.test(trimmed))) return trimmed
  if (trimmed === '.mv3') return SCOPE
  if (trimmed.startsWith('.mv3 ')) return SCOPE + ' ' + trimmed.slice('.mv3 '.length)
  if (trimmed.startsWith('.mv3.') || trimmed.startsWith('.mv3:')) return SCOPE + trimmed.slice('.mv3'.length)
  throw new Error(`selector not scopable: ${trimmed}`)
}

export function cssOutput() {
  const uat = uatBlob(UAT_CSS)
  const base = baseBlob(UAT_CSS)
  const oldXchg = '.mv3 .xchg{right:66px;width:min(330px,30vw)}\n'
  const newXchg = '@media (min-width:901px){.mv3 .xchg{right:66px;width:min(330px,30vw)}}\n'
  if (edit(uat, newXchg, oldXchg) .slice(0, base.length) !== base) throw new Error('the UAT stylesheet no longer starts with the base stylesheet (apart from the .xchg line)')
  const tail = edit(uat, newXchg, oldXchg).slice(base.length)
  const root = postcss.parse(tail)
  root.walkRules(rule => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    rule.selectors = rule.selectors.map(scopeSelector)
  })
  return CSS_HEADER + root.toString().replace(/^\n+/, '\n') + '\n' + CSS_XCHG_FIX + CSS_VOICE
}

// ---------------------------------------------------------------- the whole table
/** Every text file the port writes: [destination, content]. Binary files (stills, share card, logos) are copied by copyBinaries. */
export function textOutputs() {
  const out = new Map()
  for (const name of COMPONENT_FILES) out.set(componentDest(name), componentOutput(name))
  for (const name of PAGE_NAMES) out.set(pageDest(name), pageOutput(name))
  out.set('components/marketing/v3-uat/pages/metadata.ts', METADATA_MODULE)
  out.set('components/marketing/v3-uat/shell.tsx', SHELL_MODULE)
  out.set('app/sitemap.ts', sitemapOutput())
  out.set('lib/marketing/v3-uat-content.ts', uatBlob('lib/marketing/v3-content.ts'))
  out.set('lib/marketing/v3-uat-view.ts', VIEW_MODULE)
  out.set('components/marketing/v3-uat/flag.ts', FLAG_MODULE)
  out.set('lib/marketing/v3-metadata.ts', uatBlob('lib/marketing/v3-metadata.ts'))
  out.set(HOOK_DEST, hookOutput())
  out.set(CSS_DEST, cssOutput())
  for (const rel of Object.keys(ROUTE_EDITS)) out.set(rel, routeOutput(rel))
  // neutral shared edit: UAT's rail (a chapter label only for a slide that has data-chapter; no Landing page of dev has one)
  out.set('components/marketing/SnapDeck/SlideProgressRail.tsx', uatBlob('components/marketing/SnapDeck/SlideProgressRail.tsx'))
  return out
}

/** components/marketing/v3-uat/flag.ts: the flag as one object (\`.on\`), for the two route files whose tests allow no other NEXT_PUBLIC_ name / lib import in their source. */
export const FLAG_MODULE = `import { studioUatMarketingOn } from "@/lib/studio-uat-marketing"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off), read once at build time. */
export const studioUatMarketing = { on: studioUatMarketingOn(process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING) }
`

/** The still images and the share card: [uat path, destination]. */
export function binaryOutputs() {
  const slides = git(['ls-tree', '-r', '--name-only', UAT_COMMIT, '--', 'public/marketing/v3/slides']).trim().split('\n').filter(Boolean)
  return [
    ...slides.map(rel => [rel, rel.replace('public/marketing/v3/slides/', 'public/marketing/v3-uat/slides/')]),
    ['public/marketing/v3/og-image.jpg', 'public/marketing/v3/og-image.jpg'],
  ]
}

/** The D1 brand files (own commit): same names, UAT's pixels. */
export const LOGO_FILES = [
  'app/apple-icon.png', 'app/icon.png', 'app/icon.svg',
  'public/apple-touch-icon.png', 'public/favicon.svg', 'public/icon-192.png', 'public/icon-512.png', 'public/icon.svg',
  'public/logo-icon-sm.png', 'public/logo-icon.png', 'public/logo-wordmark-sm.png', 'public/logo-wordmark.png',
]

export function copyBinaries(which) {
  const pairs = which === 'logos' ? LOGO_FILES.map(rel => [rel, rel]) : binaryOutputs()
  for (const [from, to] of pairs) {
    const target = path.join(repoRoot, to)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, uatBlob(from, 'buffer'))
  }
  return pairs.length
}

function main() {
  const mode = process.argv[2]
  if (mode === '--write') {
    const outputs = textOutputs()
    for (const [rel, content] of outputs) { const target = path.join(repoRoot, rel); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content) }
    const images = copyBinaries('images')
    console.log(`wrote ${outputs.size} text files and ${images} images`)
    if (process.argv.includes('--logos')) console.log(`wrote ${copyBinaries('logos')} brand files`)
  } else if (mode === '--check') {
    let bad = 0
    for (const [rel, content] of textOutputs()) if (!fs.existsSync(path.join(repoRoot, rel)) || fs.readFileSync(path.join(repoRoot, rel), 'utf8') !== content) { console.log(`differs: ${rel}`); bad++ }
    process.exit(bad ? 1 : 0)
  } else {
    console.log('usage: node scripts/studio-uat-marketing-port.mjs --write [--logos] | --check')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
