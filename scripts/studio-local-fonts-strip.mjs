// PL-1: the original root and marketing layout text for older source pins.
const ROOT = 'app/layout.tsx'
const MARKETING = 'app/(marketing-v3)/layout.tsx'
const PUBLISH_PROOF = 'scripts/test-studio-p2-publish.mjs'
const PL70_PROOF = 'scripts/test-studio-pl70-session-patch-allowlist.mjs'

export const LOCAL_FONT_SCOPE_FILES = [
  ROOT, MARKETING,
  'scripts/studio-later-changes.mjs',
  'scripts/studio-local-fonts-strip.mjs',
  'scripts/test-studio-audit-console.mjs',
  PUBLISH_PROOF,
  PL70_PROOF,
  'scripts/test-studio-uat-marketing.mjs',
  'app/fonts/bricolage-grotesque-OFL.txt',
  'app/fonts/bricolage-grotesque-latin-ext.woff2',
  'app/fonts/bricolage-grotesque-latin.woff2',
  'app/fonts/bricolage-grotesque-vietnamese.woff2',
  'app/fonts/instrument-sans-OFL.txt',
  'app/fonts/instrument-sans-italic-latin-ext.woff2',
  'app/fonts/instrument-sans-italic-latin.woff2',
  'app/fonts/instrument-sans-latin-ext.woff2',
  'app/fonts/instrument-sans-latin.woff2',
  'app/fonts/instrument-serif-OFL.txt',
  'app/fonts/instrument-serif-italic-latin-ext.woff2',
  'app/fonts/instrument-serif-italic-latin.woff2',
  'app/fonts/instrument-serif-latin-ext.woff2',
  'app/fonts/instrument-serif-latin.woff2',
  'app/fonts/inter-OFL.txt',
  'app/fonts/inter-cyrillic-ext.woff2',
  'app/fonts/inter-cyrillic.woff2',
  'app/fonts/inter-greek-ext.woff2',
  'app/fonts/inter-greek.woff2',
  'app/fonts/inter-latin-ext.woff2',
  'app/fonts/inter-latin.woff2',
  'app/fonts/inter-vietnamese.woff2',
  'app/fonts/jetbrains-mono-OFL.txt',
  'app/fonts/jetbrains-mono-cyrillic-ext.woff2',
  'app/fonts/jetbrains-mono-cyrillic.woff2',
  'app/fonts/jetbrains-mono-greek.woff2',
  'app/fonts/jetbrains-mono-latin-ext.woff2',
  'app/fonts/jetbrains-mono-latin.woff2',
  'app/fonts/jetbrains-mono-vietnamese.woff2',
  'app/fonts/marketing-subsets.css',
  'app/fonts/root-subsets.css',
]

const MARKETING_GOOGLE_IMPORT =
  'import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google"'
const MARKETING_GOOGLE_CALLS = [
  'const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], weight: "variable", variable: "--font-display" })',
  'const body = Instrument_Sans({ subsets: ["latin"], weight: "variable", style: ["normal", "italic"], variable: "--font-body" })',
  'const human = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-human" })',
  'const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" })',
  'const slide = Inter({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-inter" })',
].join('\n')

export function stripStudioLocalFonts(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === ROOT) {
    return text
      .replace("import localFont from 'next/font/local'\nimport './fonts/root-subsets.css'", "import { Inter } from 'next/font/google'")
      .replace(/^const inter = localFont\(\{\n[\s\S]*?^\}\)$/m, "const inter = Inter({ subsets: ['latin'] })")
  }
  if (rel === MARKETING) {
    return text
      .replace('import localFont from "next/font/local"\nimport "../fonts/marketing-subsets.css"', MARKETING_GOOGLE_IMPORT)
      .replace(/^const display = localFont\(\{\n[\s\S]*?^const slide = localFont\(\{\n[\s\S]*?^\}\)$/m, MARKETING_GOOGLE_CALLS)
  }
  if (rel === PUBLISH_PROOF) {
    return text
      .replace(/^.* \/\/ PL-1-LOCAL-FONTS\n/gm, '')
      .replace('function stripChecks(rawSources, base = baseSources) {', 'function stripChecks(sources, base = baseSources) {')
  }
  if (rel === PL70_PROOF) {
    return text.replace(/^.* \/\/ PL-1-LOCAL-FONTS\n/gm, '')
  }
  return text
}
