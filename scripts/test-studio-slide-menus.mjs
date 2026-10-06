import fs from 'node:fs'
import ts from 'typescript'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'
const file = 'components/slide-generation-panel/index.tsx'
const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const before = execFileSync('git', ['show', '84b4cb6:' + file], { encoding: 'utf8' })
function canonical(text, strip = false) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result = ts.transform(ast, [context => {
    function visit(node) {
      if (strip) {
        if (ts.isImportDeclaration(node) && ['./studio-slide-generation-menus.css', '@/lib/studio-slide-shortcuts'].includes(node.moduleSpecifier.text)) return undefined
        if (ts.isIfStatement(node) && node.expression.getText(ast).includes('shouldYieldStudioSlidePanelShortcut(e)')) return undefined
        if (ts.isJsxAttribute(node)) {
          const name = node.name.getText(ast), value = node.initializer?.getText(ast) || ''
          if (name === 'data-studio-slide-menu' || (value.includes("process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'") && ((name === 'aria-pressed' && value.includes('? isSelected :')) || (name === 'aria-label' && (value.includes('? label :') || value.includes('? `${label} options` :')))))) return undefined
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return node => ts.visitNode(node, visit)
  }])
  const printed = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0])
  result.dispose(); return printed
}
assert.equal(canonical(source, true), canonical(before), 'all existing options, callbacks, payloads, guards, classes and classic shortcuts remain exact')
const transpiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX } })
assert.equal(transpiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
const css = postcss.parse(fs.readFileSync(new URL('../components/slide-generation-panel/studio-slide-generation-menus.css', import.meta.url), 'utf8'))
css.walkRules(rule => assert.ok(rule.selector.includes('[data-studio-slide-menu'), 'each portal rule has its own literal Studio marker'))
console.log('Native slide portal syntax and complete source preservation passed')
