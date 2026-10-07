// Builds the F8 rail evidence page (webpack, same toolchain as scripts/build-studio-native-crud-render.mjs).
// Run from the repo root: node evidence/f8-rail-slide-identity/build-render.mjs <outDir> [baseRef]
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = path.resolve(new URL('../..', import.meta.url).pathname)
const out = path.resolve(process.argv[2] ?? path.join(root, 'evidence/f8-rail-slide-identity/render-build'))
const baseRef = process.argv[3] ?? 'origin/studio-v4-dev-preparation-code'
const here = path.join(root, 'evidence/f8-rail-slide-identity')
fs.mkdirSync(out, { recursive: true })

// 1. The viewer's slideThumbnails logic, verbatim from the base commit.
const baseViewer = execFileSync('git', ['show', `${baseRef}:components/presentation-viewer.tsx`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const startMarker = '  const slideThumbnails = useMemo<SlideThumbnail[]>(() => {\n'
const start = baseViewer.indexOf(startMarker), end = baseViewer.indexOf('\n  }, [', start)
assert.ok(start > 0 && end > start, 'base slideThumbnails memo not found')
fs.writeFileSync(path.join(out, 'base-memo.ts'), `// Generated: the body of presentation-viewer.tsx's slideThumbnails useMemo at ${baseRef}, unchanged.
import { applyStageFThumbnailUrls, ownedRestoredThumbnailUrl } from '@/lib/stage-f-thumbnails'
export function baseSlideThumbnails(env: any): any[] {
  const { slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide, studioShell, presentationId, studioCanonicalThumbnails, renderSlideMutationOwner, thumbnailNativeRevisionRef, thumbnailMetadataRef } = env
${baseViewer.slice(start + startMarker.length, end)}
}
`)

// 2. Bundle.
const tsLoader = path.join(out, 'ts-loader.cjs'), cssLoader = path.join(out, 'css-loader.cjs')
fs.writeFileSync(tsLoader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){const r=ts.transpileModule(source,{fileName:this.resourcePath,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});const e=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(e.length)throw Error(ts.flattenDiagnosticMessageText(e[0].messageText,'\\n'));return r.outputText};\n`)
fs.writeFileSync(cssLoader, `module.exports=function(){return 'module.exports={};'};\n`)
const webpack = require('next/dist/compiled/webpack/bundle5')().webpack
const compiler = webpack({
  mode: 'development', context: root, entry: path.join(here, 'render-fixture.tsx'), devtool: false, target: 'web', cache: false,
  output: { path: out, filename: 'fixture.js' }, optimization: { minimize: false },
  resolve: { extensions: ['.tsx', '.ts', '.js', '.mjs', '.json'], symlinks: true,
    alias: { '@f8-base-memo': path.join(out, 'base-memo.ts'), '@': root,
      'react$': require.resolve('react'), 'react/jsx-runtime$': require.resolve('react/jsx-runtime'),
      'react-dom$': require.resolve('react-dom'), 'react-dom/client$': require.resolve('react-dom/client') } },
  module: { rules: [{ test: /\.tsx?$/, use: [tsLoader] }, { test: /\.css$/, use: [cssLoader] }] },
  plugins: [new webpack.DefinePlugin({ 'process.env': JSON.stringify({
    NODE_ENV: 'development', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'http://127.0.0.1:9' }) })],
})
const stats = await new Promise((resolve, reject) => compiler.run((error, s) => { compiler.close(() => {}); error ? reject(error) : resolve(s) }))
assert.ok(!stats.hasErrors(), JSON.stringify(stats.toJson({ all: false, errors: true }).errors, null, 2))
new vm.Script(fs.readFileSync(path.join(out, 'fixture.js'), 'utf8'), { filename: 'fixture.js' })

// 3. CSS: tailwind over the files the page really uses + the strip's own Studio stylesheet.
const twModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: twModule, exports: twModule.exports, require })
const used = [...stats.compilation.modules].map(m => m.resource).filter(f => f && f.startsWith(root + '/') && !f.includes('/node_modules/') && /\.(tsx?|jsx?)$/.test(f))
const content = used.map(file => ({ raw: fs.readFileSync(file, 'utf8'), extension: path.extname(file).slice(1) }))
const css = ['app/globals.css', 'components/studio-thumbnails.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
const processed = await require('postcss')([require('tailwindcss')({ ...twModule.exports.default, content }), require('autoprefixer')()]).process(css, { from: path.join(root, 'app/globals.css') })
const fixtureCss = `
html,body{margin:0;height:100%}
body{background:#e8f0ed;color:#243438;font:14px Arial,Helvetica,sans-serif}
[data-fixture-frame]{display:flex;height:100vh;box-sizing:border-box;padding:56px 24px 62px;gap:0}
.canvas{flex:1;display:flex;align-items:center;justify-content:center;background:#141c1e;border-radius:12px 0 0 12px}
.canvas-card{display:flex;flex-direction:column;gap:6px;align-items:center;color:#a0b1ad;font-size:15px}
.canvas-card strong{color:#e2ebe8;font-size:20px;font-weight:600}
.rail{display:flex;flex-direction:column;background:#fff;border:1px solid #dde5e2;border-left:0;border-radius:0 12px 12px 0;overflow:hidden}
.rail > [data-studio-thumbnail-strip]{height:100%;border:0}
#caption,#note{position:fixed;left:24px;right:24px;font:13px/1.35 ui-monospace,Menlo,monospace;color:#243438}
#caption{top:14px;font-size:15px;font-weight:600}
#note{bottom:12px;font-size:11px;color:#566965}
`
fs.writeFileSync(path.join(out, 'fixture.css'), processed.css + '\n' + fixtureCss)
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>F8 rail fixture</title><link rel="stylesheet" href="fixture.css"></head><body><div id="caption"></div><div id="root"></div><div id="note"></div><script src="fixture.js"></script></body></html>`)
console.log('built', out, 'modules', used.length)
