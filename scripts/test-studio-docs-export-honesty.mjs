// FRONTEND-1 UX G-06 (no flag): the Docs Export article lists only the formats the product downloads, PowerPoint and PDF (the same honesty rule as the Google Slides cut).
// Run: node scripts/test-studio-docs-export-honesty.mjs   (plain node: transpile + vm, git show for the base; no network, no browser, no env)
//   1. content/docs.ts, builder-guide/exports: no Images (PNG/JPEG) zip, no Embed Code, no Export Settings (quality, slide range, speaker-note / animation / web toggles, PDF password), no "choose quality" step,
//      no Google Slides; the only "Export" menu targets are PowerPoint and PDF; both are still there. The whole article, the Download Limits block included, names no quality ("one fixed quality, no selector");
//   2. with the agent and fact rules applied (the P2 docs path) the article has no such claim at all, "quality" included; the fact rule that replaces the Download Limits block still matches the article (it follows the two lines this change cut);
//   3. the code agrees: the download service offers pdf and pptx only, the download control has one fixed quality and no selector, no image / zip / password option;
//   4. the honesty strip (scripts/studio-ux-honesty-strip.mjs) puts the removed text back byte for byte, so the older base-identity pins read content/docs.ts and content/studio-p2-docs-facts.ts as they were; both are read through the strips
//      of the changes registered after the honesty strip (the registry), so a later change's lines never fail this proof;
//   5. mutants: each claim put back (and each code feature added) is caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import * as strip from './studio-ux-honesty-strip.mjs'
import * as registry from './studio-later-changes.mjs' // LATER-CHANGES: registry read (UX-HONESTY)

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const applyAll = (list, rel, text) => list.reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text) // LATER-CHANGES: registry read (UX-HONESTY)
/** Only the strips of the changes registered AFTER the honesty strip, in the registry's order: a later change's own lines come out first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(strip.stripUxHonesty); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) } // LATER-CHANGES: registry read (UX-HONESTY)
const readLater = rel => laterStrips(rel, read(rel)) // LATER-CHANGES: registry read (UX-HONESTY)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
let checks = 0
const ok = (value, message) => { checks++; assert.ok(value, message) }

const DOCS = 'content/docs.ts', LIB = 'lib/studio-p2-docs.ts', AGENTS = 'content/studio-p2-docs-agents.ts', FACTS = 'content/studio-p2-docs-facts.ts'
const DOWNLOAD_SERVICE = 'lib/api/download-service.ts', DOWNLOAD_CONTROLS = 'components/presentation-download-controls.tsx'

function load(text) {
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const sandbox = { module: { exports: {} }, exports: {}, require: () => ({}), process: { env: {} } }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(js, sandbox)
  return sandbox.module.exports
}
const exportsOf = sections => String(sections.flatMap(section => section.items).find(item => item.category === 'builder-guide' && item.slug === 'exports').content)

// what the Export article must not say: each is a feature the product does not have
const REMOVED = [
  /Images \(PNG\/JPEG\)/, /\bPNG\b/, /\bJPEG\b/, /zip file/i, /Set resolution/i, /Transparent backgrounds/i, /Custom dimensions/i,
  /Embed Code/i, /How to embed/i, /embed/i, /Responsive iframe/i,
  /Export Settings/, /Quality Options/, /Slide Selection/, /Slide range/i, /Selected slides/i,
  /Include speaker notes/i, /Include animations/i, /Optimize for web/i, /Password protect/i,
  /High Resolution/i, /High Quality/, /\*\*Draft\*\*/, /With Notes/,
  /Choose quality/i, /Select quality/i, /lower quality/i, /social media teasers/i, /Google Slides/i,
]
function checkArticle(docs) {
  const text = exportsOf(load(docs).docSections)
  for (const re of REMOVED) ok(!re.test(text), `the Export article does not match ${re}`)
  ok(!/quality/i.test(text), 'the Export article names no quality option anywhere, the Download Limits block included')
  const targets = [...text.matchAll(/Click "Export" → "([^"]+)"/g)].map(match => match[1])
  ok(targets.length === 2 && targets[0] === 'PowerPoint' && targets[1] === 'PDF', `the only Export menu targets are PowerPoint and PDF (found ${JSON.stringify(targets)})`)
  const formats = (text.split('## Export Formats')[1] || '').split(/\n## /)[0]
  const headings = [...formats.matchAll(/^### (.+)$/gm)].map(match => match[1])
  ok(headings.includes('PowerPoint (.pptx)') && headings.includes('PDF Document'), 'PowerPoint and PDF are listed under Export Formats')
  ok(!headings.some(heading => /image|png|jpe?g|embed|google/i.test(heading)), 'no other file or embed format is listed under Export Formats')
  ok(/1\. Click "Export" → "PowerPoint"\n2\. Download \.pptx file\n/.test(text) && /1\. Click "Export" → "PDF"\n2\. Download PDF file\n/.test(text), 'each export is two steps: pick the format, download the file')
}

// the P2 docs path: the agent rules, then the fact rules, applied by the real lib to the live article
function checkFlagOn(docs, agents, facts) {
  const lib = load(read(LIB))
  const rules = [...load(agents).STUDIO_DOCS_AGENT_RULES, ...load(facts).STUDIO_DOCS_FACT_RULES]
  const text = exportsOf(lib.studioDocsCurrent(load(docs).docSections, rules))
  for (const re of REMOVED) ok(!re.test(text), `with the P2 rules applied the Export article does not match ${re}`)
  ok(!/quality/i.test(text), 'with the P2 rules applied the Export article names no quality option at all')
  ok(/## Downloads on Every Plan\n\nStarter, Pro and Max can all download PowerPoint and PDF/.test(text), 'with the P2 rules applied the downloads are PowerPoint and PDF')
}

// the code says what the docs may say
function checkCode(service, controls) {
  ok(/export type DownloadFormat = 'pdf' \| 'pptx';/.test(service), 'the download service has two formats: pdf and pptx')
  ok(!/\b(png|jpe?g|zip)\b/i.test(service) && !/\b(png|jpe?g|zip)\b/i.test(controls), 'no image or zip export in the download service or its control')
  ok(/const \[quality\] = useState<DownloadQuality>\('high'\)/.test(controls) && !/setQuality/.test(controls), 'the download control has one fixed quality and no selector')
  ok(!/password/i.test(service) && !/password/i.test(controls), 'no password option on a download')
  ok(/downloadPDF\(presentationUrl, quality\)/.test(controls) && /downloadPPTX\(presentationUrl, effectiveSlideCount, quality\)/.test(controls), 'the control offers a PDF download and a PowerPoint download')
}

// the older pins read content/docs.ts and the P2 docs fact rules through the honesty strip: with the rewrites put back they are the base commit's files
function checkStrip(docs, facts) {
  ok(strip.stripUxHonesty(DOCS, docs) === git('show', `${strip.BASE_COMMIT}:${DOCS}`), 'content/docs.ts with the honesty rewrites put back is the base commit\'s file, byte for byte')
  ok(strip.stripUxHonesty(FACTS, facts) === git('show', `${strip.BASE_COMMIT}:${FACTS}`), 'content/studio-p2-docs-facts.ts with the honesty rewrites put back is the base commit\'s file, byte for byte')
  ok(strip.stripUxHonesty(DOCS, strip.stripUxHonesty(DOCS, docs)) === strip.stripUxHonesty(DOCS, docs) && strip.stripUxHonesty(FACTS, strip.stripUxHonesty(FACTS, facts)) === strip.stripUxHonesty(FACTS, facts), 'the strip is idempotent on both files')
}

const real = { docs: readLater(DOCS), agents: read(AGENTS), facts: readLater(FACTS), service: read(DOWNLOAD_SERVICE), controls: read(DOWNLOAD_CONTROLS) } // LATER-CHANGES: registry read (UX-HONESTY)
function all(files) {
  checkArticle(files.docs); checkFlagOn(files.docs, files.agents, files.facts); checkCode(files.service, files.controls); checkStrip(files.docs, files.facts)
}
all(real)
const realChecks = checks

// ---- mutants: each claim put back, each feature added, must be caught
const SHARE = '### Web Link (Hosted)\n'
const MUTANTS = [
  ['docs', SHARE, `### Images (PNG/JPEG)\n**Best for:** Social media\n\n1. Click "Export" → "Images"\n\n${SHARE}`, 'the Images PNG/JPEG section'],
  ['docs', SHARE, `### Images\n**Best for:** Slides\n\n5. Download zip file\n\n${SHARE}`, 'the zip download'],
  ['docs', '## Sharing Options\n', '### Embed Code\n**Best for:** Embedding on websites\n\n## Sharing Options\n', 'the Embed Code section'],
  ['docs', '## Sharing Options\n', '## Export Settings\n\n### Quality Options\n\n## Sharing Options\n', 'the Export Settings section'],
  ['docs', '## Sharing Options\n', '- **Password protect**: Add password to PDF\n\n## Sharing Options\n', 'the PDF password option'],
  ['docs', '## Sharing Options\n', '- **Slide range**: Slides 3-7, for example\n\n## Sharing Options\n', 'the slide range option'],
  ['docs', '## Sharing Options\n', '- **Optimize for web**: Smaller file sizes\n\n## Sharing Options\n', 'the optimize-for-web toggle'],
  ['docs', '2. Download .pptx file', '2. Choose quality settings\n3. Download .pptx file', 'the PowerPoint quality step'],
  ['docs', '2. Download PDF file', '2. Select quality option\n3. Download PDF file', 'the PDF quality step'],
  ['docs', SHARE, `**Options:**\n- **High Resolution**: Print quality, larger size\n\n${SHARE}`, 'the PDF options list'],
  ['docs', '- PDF for client deliverables\n', '- PDF for client deliverables\n- Images for social media teasers\n', 'the images best practice'],
  ['docs', '- Check internet connection\n', '- Check internet connection\n- Try lower quality setting\n', 'the lower-quality troubleshooting step'],
  ['docs', '- Reduce file size (fewer slides', '- Lower the quality to reduce file size (fewer slides', 'a quality option in the troubleshooting tips'],
  ['docs', '### Free Tier\n- 3 exports per presentation\n', '### Free Tier\n- 3 exports per presentation\n- Standard quality only\n', 'the Free tier quality line back in the Download Limits block'],
  ['docs', '### Pro Tier\n- Unlimited exports\n', '### Pro Tier\n- Unlimited exports\n- All formats and quality levels\n', 'the Pro tier quality line back in the Download Limits block'],
  ['facts', '### Free Tier\n- 3 exports per presentation\n', '### Free Tier\n- 3 exports per presentation\n- Standard quality only\n', 'a fact rule that no longer matches the article (the P2 docs path would show the old limits)'],
  ['facts', '### Pro Tier\n- Unlimited exports\n', '### Pro Tier\n- Unlimited exports\n- All formats and quality levels\n', 'a fact rule that no longer matches the Pro tier lines'],
  ['docs', 'Click "Export" → "PDF"', 'Click "Export" → "Images"', 'an Images target on the Export menu'],
  ['docs', '### PDF Document\n', '', 'PDF dropped from the formats'],
  ['docs', '### PowerPoint (.pptx)\n', '### Google Slides\n', 'PowerPoint swapped for Google Slides'],
  ['docs', SHARE, `${SHARE}**Best for:** Online sharing, embedding\n`, 'the embedding claim on the web link'],
  ['docs', SHARE, ` ${SHARE}`, 'a rewrite the honesty strip does not know'],
  ['facts', 'with no watermark.', 'with no watermark. Choose Draft, Standard or High Quality.', 'a fact rule that brings the quality levels back'],
  ['facts', 'with no watermark.', 'with no watermark. Export slides as PNG images.', 'a fact rule that brings the images back'],
  ['service', "'pdf' | 'pptx'", "'pdf' | 'pptx' | 'png'", 'a third download format'],
  ['service', "'pdf' | 'pptx'", "'pdf' | 'pptx'\n// zip of slide images", 'an image zip in the download service'],
  ['controls', 'const [quality] =', 'const [quality, setQuality] =', 'a quality selector'],
  ['controls', "downloadPDF(presentationUrl, quality)", "downloadPDF(presentationUrl, quality, password)", 'a password on the PDF download'],
]
let killed = 0
for (const [file, from, to, label] of MUTANTS) {
  assert.ok(real[file].includes(from), `mutant anchor present in ${file}: ${from}`)
  let caught = false
  try { all({ ...real, [file]: real[file].replace(from, () => to) }) } catch { caught = true }
  assert.ok(caught, `mutant survived: ${label}`)
  killed++
}

console.log(`Studio docs Export honesty (G-06): ${realChecks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
