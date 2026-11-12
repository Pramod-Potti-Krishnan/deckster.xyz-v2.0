// PASS2B J2-04: writes the HTML of the Add Slide panel in each state, drawn by the shipped component (real icons) after the page's own
// handlers have run on the recorded frames (scripts/studio-add-slide-status-harness.mjs). A browser then screenshots them with the app's
// compiled CSS (.next/static/css/*.css from `pnpm build`); nothing here starts a browser or a server.
//
//   node scripts/render-studio-add-slide-status.mjs <out dir> <compiled css dir>
//
// Writes <out>/<name>.html, one per state, each linking the compiled stylesheets by file:// URL:
//   before-queued, before-landed        flag off: "Queued." right after Generate, and still "Queued." once the slide has landed
//   after-building, after-added         flag on, the generate-ready recording
//   after-failed, after-retrying        flag on, the fail-retry-ready recording
import fs from 'node:fs'
import path from 'node:path'
import { createPageWorld } from './studio-add-slide-status-harness.mjs'

const out = path.resolve(process.argv[2] ?? '.')
const cssDir = path.resolve(process.argv[3] ?? '.next/static/css')
fs.mkdirSync(out, { recursive: true })
const sheets = fs.readdirSync(cssDir).filter(name => name.endsWith('.css')).sort()
if (sheets.length === 0) throw new Error(`no compiled CSS in ${cssDir}: run pnpm build first`)

const page = (name, panelHtml) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${name}</title>
${sheets.map(sheet => `<link rel="stylesheet" href="file://${path.join(cssDir, sheet)}">`).join('\n')}
<style>html,body{margin:0;height:100%;background:#e9eeec;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}</style></head>
<body><div data-studio-v4-shell="true" style="display:flex;height:900px;width:1600px">
<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#8a9a95;font-size:13px">slide canvas (not drawn in this render)</div>
<div style="width:400px;position:relative;height:900px;border-left:1px solid #dde5e2;background:#fff">${panelHtml}</div>
</div></body></html>
`
const write = (name, html) => fs.writeFileSync(path.join(out, `${name}.html`), page(name, html))
const typeAndGenerate = async world => {
  world.panel.type('Why a phased rollout beats a big-bang launch, with the three milestones')
  await world.panel.click(world.panel.button('Generate slide'))
}

for (const [prefix, env] of [['before', {}], ['after', { NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS: 'true' }]]) {
  const world = createPageWorld({ scenario: 'generate-ready', env, realIcons: true })
  await typeAndGenerate(world)
  write(prefix === 'before' ? 'before-queued' : 'after-building', world.panel.html())
  await world.deliverReady(0)
  world.panel.render()
  write(prefix === 'before' ? 'before-landed' : 'after-added', world.panel.html())
}
{
  const world = createPageWorld({ scenario: 'fail-retry-ready', env: { NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS: 'true' }, realIcons: true })
  await typeAndGenerate(world)
  await world.deliverFailed(0)
  world.panel.render()
  write('after-failed', world.panel.html())
  await world.panel.click(world.panel.button('Try again'))
  write('after-retrying', world.panel.html())
}
console.log('wrote', fs.readdirSync(out).filter(name => name.endsWith('.html')).join(' '), 'in', out)
