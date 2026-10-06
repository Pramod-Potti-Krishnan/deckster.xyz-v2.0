import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import postcss from 'postcss'

// Executes the actual transpiled ChatInput, actual theme hook and mention helpers.
// Deferred fetch responses are local fixtures; no server/browser/storage runs.
const root = new URL('../', import.meta.url), leaf = 'components/builder/chat-input.tsx'
const accepted = execFileSync('git', ['show', `17ef94f:${leaf}`], { cwd: root, encoding: 'utf8' })
const source = fs.readFileSync(new URL(leaf, root), 'utf8')
const hookSource = fs.readFileSync(new URL('hooks/use-theme-profiles.ts', root), 'utf8')
const baseline = process.argv.includes('--before')
const initialCacheBefore = process.argv.includes('--initial-cache-before')
const mutationBefore = process.argv.includes('--mutation-before')
const legacyRecovery = initialCacheBefore || mutationBefore
const checkpoint = legacyRecovery ? execFileSync('git', ['show', `${initialCacheBefore ? '816b351' : '616ad44'}:${leaf}`], { cwd: root, encoding: 'utf8' }) : null
const accountCacheBefore = process.argv.includes('--account-cache-before')
const candidate = accountCacheBefore ? execFileSync('git', ['show', `19ad755:${leaf}`], { cwd: root, encoding: 'utf8' }) : baseline ? accepted : legacyRecovery ? checkpoint : source
const hash = value => createHash('sha256').update(value).digest('hex')
const jsx = (type, props, key) => ({ type, props: props || {}, key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value && typeof value === 'object' ? textOf(value.props?.children) : value == null || value === false ? '' : String(value)
const same = (a, b) => a?.length === b?.length && a?.every((value, i) => Object.is(value, b[i]))
function compile(value) {
  const result = ts.transpileModule(value, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } })
  assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  return result.outputText
}
const theme = (id, extra = {}) => ({ id, name: `Theme ${id}`, theme_payload: { mode: 'custom', primary_hex: '#123456' }, ...extra })
const A = theme('A', { is_standard: true }), B = theme('B')
const json = value => JSON.parse(JSON.stringify(value))
const results = [], observations = []
async function test(name, callback) { await callback(); results.push(name) }
// Only named recovery additions may be removed. Everything else must equal the
// accepted whole leaf, including all handlers, native fields/options and geometry.
function restoreAcceptedComposer(value) {
  const replace = (from, to, count = 1) => {
    assert.equal(value.split(from).length - 1, count, `Named Theme transform ${from.slice(0, 70)}`)
    value = value.replaceAll(from, to)
  }
  replace("import { StudioThemeMenu, type StudioThemeView, type StudioThemeMutationKind, type StudioThemeMutationNotice } from './studio-theme-menu'\n", '')
  for (const name of ['read ownership', 'refresh', 'read recovery', 'mutations']) {
    const pattern = new RegExp(`^  +// Studio theme ${name} START[^\\n]*\\n[\\s\\S]*?^  +// Studio theme ${name} END\\.\\n`, 'gm')
    assert.equal([...value.matchAll(pattern)].length, 1, `One marked ${name} block`)
    value = value.replace(pattern, '')
  }
  const presentation = /^                  \{\/\* Studio theme presentation START \*\/\}\n[\s\S]*?^                  \{\/\* Studio theme classic body START \*\/\}\n([\s\S]*?)^                  \{\/\* Studio theme classic body END \*\/\}\n[\s\S]*?^                  \{\/\* Studio theme presentation END \*\/\}\n/gm
  const matches = [...value.matchAll(presentation)]
  assert.equal(matches.length, 1, 'One named Studio presentation branch with preserved classic body')
  value = value.replace(presentation, (_whole, body) => body)
  replace("data-studio-v4-menu=\"theme\" align=\"start\" className={studio ? 'studio-theme-popover' : 'w-72 p-2'}", 'data-studio-v4-menu="theme" align="start" className="w-72 p-2"')
  for (const kind of ['save', 'set-standard', 'clear-standard', 'delete']) replace(`    if (studio) { await runStudioThemeMutation('${kind}'); return }\n`, '')
  replace('  }, [listThemes, studio, studioThemeOwner])', '  }, [listThemes])')
  replace(`      const pendingRead = refreshSavedThemes(true)
      const readSequence = studioThemeReadSequence.current
      const result = await pendingRead
      if (cancelled || studioThemeOwnerRef.current !== studioThemeOwner
        || studioThemeReadSequence.current !== readSequence || !studioThemeMount.current.active) return
      studioThemeRequestOwner.current = studioThemeOwner`, `      const result = await refreshSavedThemes(true)
      if (cancelled) return`)
  replace(`    : activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner
      && unavailableSavedThemeRequest?.key === activeSavedThemeRequest.key`, '    : activeSavedThemeRequest && unavailableSavedThemeRequest?.key === activeSavedThemeRequest.key')
  replace('    && (!studio || (activeSavedThemeRequest && studioThemeRequestOwner.current === studioThemeOwner))\n', '')
  replace('visibleSavedThemes', 'savedThemes', 4)
  replace('    if (studio) studioThemeSelection.current.epoch += 1\n', '', 3)
  for (const line of [
    "      recordStudioThemeSelection(null, { mode: 'auto' }, false)",
    "      recordStudioThemeSelection(null, { mode: 'preset', preset_id: normalized }, false)",
    "    recordStudioThemeSelection(null, isValidThemeHex(normalized) ? { mode: 'custom', primary_hex: normalized.toLowerCase() } : buildTheme, false)",
    '      recordStudioThemeSelection(null, buildTheme, false)',
    '    recordStudioThemeSelection(profile.id, profile.theme_payload, false)',
  ]) replace(line + '\n', '')
  replace(`<DropdownMenuContent onKeyDownCapture={studio ? (event) => {
                  // Native form Tab traversal must run before Radix menu key handling.
                  if (event.key === 'Tab') event.stopPropagation()
                } : undefined} data-studio-composer-menu={studio ? 'theme' : undefined}`, `<DropdownMenuContent data-studio-composer-menu={studio ? 'theme' : undefined}`)
  return value
}
function harness(options = {}) {
  const { code = candidate, override = {}, leafCode = fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8') } = options
  const flag = Object.hasOwn(options, 'flag') ? options.flag : 'true'
  let cursor = 0, dirty = true, mounted = true, tree, hookKind = false
  const slots = [], pendingEffects = [], requests = [], calls = [], writes = []
  const props = {
    inputMessage: 'Keep unsent draft', uploadedFiles: [], pendingActionInput: null,
    user: { id: 'user-A' }, currentSessionId: 'session-A', isReady: true, isLoadingSession: false,
    connected: true, connecting: false, researchEnabled: false, webSearchEnabled: false, knowledgeGraphEnabled: false,
    showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'unavailable', buildTheme: { mode: 'auto' }, activeBuildThemeProfile: null,
    onInputChange: value => { calls.push(['draft', value]); props.inputMessage = value; dirty = true },
    onBuildThemeChange: value => { calls.push(['theme', json(value)]); props.buildTheme = value; dirty = true },
    onActiveBuildThemeProfileChange: value => { calls.push(['profile', json(value)]); props.activeBuildThemeProfile = value; dirty = true },
    onSubmit: () => calls.push(['send']), onFilesSelected() {}, onRemoveFile() {}, onClearAllFiles() {}, onCancelAction() {},
    onRequestSession: async () => {}, onResearchEnabledChange() {}, onWebSearchEnabledChange() {}, onKnowledgeGraphEnabledChange() {}, onKnowledgeGraphAccessClick() {}, ...override,
  }
  const react = {
    useState(initial) { const i = cursor++, kind = hookKind ? 'hook' : 'leaf'; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; const slot = slots[i]; return [slot.value, value => { const next = typeof value === 'function' ? value(slot.value) : value; writes.push({ kind, index: i, mounted }); if (!Object.is(next, slot.value)) { slot.value = next; dirty = true } }] },
    useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }) },
    useCallback(callback, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: callback, deps }; return slots[i].value },
    useEffect(callback, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup }; pendingEffects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback() }) } },
  }
  const fetch = (url, options = {}) => {
    if (url === 'https://fixture.invalid/api/v1/themes/presets') return Promise.resolve({ ok: true, json: async () => imports['@/lib/theme-builder'].FALLBACK_THEME_PRESETS })
    assert.ok(url.startsWith('/api/themes'), `Unknown fixture request ${url}`)
    return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject, done: false }))
  }
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/lib/config': { config: { api: { themeBuilderUrl: 'https://fixture.invalid' } }, features: { enableFileUploads: true } },

    '@/lib/mdc-flags': { CHAT_MENTIONS: true }, '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  }
  function load(value) { const mod = { exports: {} }; vm.runInNewContext(compile(value), { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch, console, require: name => {
    if (name in imports) return imports[name]
    if (name.endsWith('.css')) return {}
    if (name === 'lucide-react' || name.startsWith('@/components/') || name === './template-picker') return new Proxy({}, { get: (_, key) => key === 'Textarea' ? 'textarea' : key })
    throw new Error(`Unknown native theme dependency ${name}`)
  } }); return mod.exports }
  imports['@/lib/theme-builder'] = load(fs.readFileSync(new URL('lib/theme-builder.ts', root), 'utf8'))
  imports['./studio-theme-menu'] = load(leafCode)
  imports['@/lib/mdc-mentions'] = load(fs.readFileSync(new URL('lib/mdc-mentions.ts', root), 'utf8'))
  const actualHook = load(hookSource).useThemeProfiles
  imports['@/hooks/use-theme-profiles'] = { useThemeProfiles() { hookKind = true; try { return actualHook() } finally { hookKind = false } } }
  const ChatInput = load(code).ChatInput
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand)
    if (!value || typeof value !== 'object') return value
    if (value.type === imports['./studio-theme-menu'].StudioThemeMenu) return expand(value.type(value.props))
    return { ...value, props: { ...value.props, children: expand(value.props?.children) } }
  }
  function render(extra = {}) {
    Object.assign(props, extra); dirty = true
    for (let pass = 0; dirty && pass < 20; pass++) { dirty = false; cursor = 0; tree = expand(ChatInput(props)); pendingEffects.splice(0).forEach(effect => effect()) }
    assert.equal(dirty, false, 'Native leaf effects settle')
    return tree
  }
  const byAction = action => nodes(tree).find(node => node.props['data-studio-theme-action'] === action)
  const showChoices = () => { const back = byAction('back'); if (back) { back.props.onClick(); render() } }
  const find = label => {
    let matches = nodes(tree).filter(node => node.props['aria-label'] === label)
    if (!matches.length && flag === 'true') {
      if (label === 'Brand hex color' || label === 'Brand color') showChoices()
      else { const action = ['Theme name', 'Save current theme'].includes(label) ? 'save-entry' : 'manage-entry'; if (!byAction(action)) showChoices(); const entry = byAction(action); if (entry) { entry.props.onClick(); render() } }
      matches = nodes(tree).filter(node => node.props['aria-label'] === label)
    }
    assert.equal(matches.length, 1, `${label} actual native control`); return matches[0]
  }
  const preset = id => {
    showChoices()
    const row = nodes(tree).find(node => node.props['data-studio-theme-choice'] === (id === 'auto' ? 'auto' : `preset:${id}`))
    if (row) row.props.onClick(); else find('Build theme preset').props.onChange({ target: { value: id } })
    render()
  }
  const pending = () => requests.filter(request => !request.done)
  async function tick() { for (let i = 0; i < 10; i++) await Promise.resolve(); if (mounted) render() }
  async function resolve(request, body, { ok = true, status = 200, reject = false } = {}) { request.done = true; if (reject) request.reject(new Error('Read refused fixture')); else request.resolve({ ok, status, json: async () => body }); await tick() }
  function open() { const menu = nodes(tree).find(node => node.type === 'DropdownMenu' && nodes(node).some(child => child.props['aria-label'] === 'Build theme')); assert.ok(menu); menu.props.onOpenChange(true); render(); return pending().at(-1) }
  function refresh() { const button = nodes(tree).find(node => node.props['data-studio-theme-read-refresh'] === 'true'); assert.ok(button, 'Actual explicit refresh/retry control exists'); button.props.onClick(); render(); return pending().at(-1) }
  const choose = id => { const select = nodes(tree).find(node => node.props['aria-label'] === 'Saved theme'), row = nodes(tree).find(node => node.props['data-studio-theme-choice'] === `saved:${id}`); if (select) select.props.onChange({ target: { value: id } }); else if (row) row.props.onClick(); else find('Saved theme').props.onChange({ target: { value: id } }); render() }
  render()
  return { render, find, open, refresh, choose, preset, byAction, showChoices, resolve, tick, pending, requests, calls, writes, props,
    get tree() { return tree }, get text() { return textOf(tree) }, get ids() { const select = nodes(tree).find(node => node.props['aria-label'] === 'Saved theme'); return select ? nodes(select).filter(node => node.type === 'option' && node.props.value).map(node => node.props.value) : nodes(tree).filter(node => node.props['data-studio-theme-choice']?.startsWith('saved:')).map(node => node.props['data-studio-theme-choice'].slice(6)) },
    get selected() { return nodes(tree).find(node => node.props['data-studio-theme-view'])?.props['data-studio-theme-selection'] ?? find('Saved theme').props.value },
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()) },
  }
}

await test('Actual read refusal reproduces historical cache/selection loss; candidate retains both', async () => {
  const h = harness(); await h.resolve(h.open(), { themes: [A, B], count: 2 }); h.choose('A')
  h.find('Theme name').props.onChange({ target: { value: 'Unsent library name' } }); h.render()
  const beforeCalls = json(h.calls)
  await h.resolve(h.open(), { error: 'database refused' })
  if (baseline) { assert.deepEqual(h.ids, []); assert.equal(h.selected, ''); observations.push('HTTP 200 error null clears successful library and selected ID') }
  else { assert.deepEqual(h.ids, ['A', 'B']); assert.equal(h.selected, 'A'); assert.ok(h.text.includes('Could not refresh saved themes')); assert.ok(h.text.includes('Retry')); assert.deepEqual(h.calls, beforeCalls) }
  assert.equal(h.find('Theme name').props.value, 'Unsent library name')
})

await test('Reversed refresh responses reproduce historical stale overwrite', async () => {
  const h = harness(), first = h.open(), second = h.open()
  await h.resolve(second, { themes: [B] }); await h.resolve(first, { themes: [A] })
  assert.deepEqual(h.ids, baseline ? ['A'] : ['B'])
  if (baseline) observations.push('Older read overwrites newer successful library')
})

await test('Account and session roundtrips fence historical stale admission', async () => {
  for (const axis of ['user', 'currentSessionId']) {
    const h = harness(), old = h.open()
    h.render(axis === 'user' ? { user: { id: 'user-B' } } : { currentSessionId: 'session-B' })
    h.render(axis === 'user' ? { user: { id: 'user-A' } } : { currentSessionId: 'session-A' })
    await h.resolve(old, { themes: [A] }); assert.deepEqual(h.ids, baseline ? ['A'] : [])
  }
  if (baseline) observations.push('A → B → A account/session admits obsolete original read')
})

await test('Late read cannot prune a newer deliberate saved selection', async () => {
  const h = harness(); await h.resolve(h.open(), { themes: [A, B] }); const old = h.open(); h.choose('B')
  await h.resolve(old, { themes: [A] }); assert.equal(h.selected, baseline ? '' : 'B')
  assert.deepEqual(json(h.props.buildTheme), B.theme_payload)
  if (baseline) observations.push('Refresh prunes newer B selection when old snapshot excludes B')
})

if (!baseline) {
  await test('First successful library survives newer Brand hex and preset intent without false empty or selection rollback', async () => {
    for (const choice of ['brand', 'preset']) {
      const h = harness(), first = h.open()
      if (choice === 'brand') { h.find('Brand hex color').props.onChange({ target: { value: '#abcdef' } }); h.render() } else h.preset('corporate_light')
      const calls = json(h.calls), selection = json(h.props.buildTheme)
      await h.resolve(first, { themes: [A, B], count: 2 })
      if (initialCacheBefore) {
        assert.deepEqual(h.ids, []); assert.ok(h.text.includes('No saved themes yet.'))
        observations.push(`816b351 first GET returns two themes after ${choice} choice, but library stays empty and false-empty status is shown`)
      } else { assert.deepEqual(h.ids, ['A', 'B']); assert.ok(!h.text.includes('No saved themes yet.')) }
      assert.deepEqual(json(h.props.buildTheme), selection); assert.deepEqual(h.calls, calls); assert.equal(h.selected, '')
      assert.equal(h.find('Refresh saved themes').props['aria-busy'], undefined); assert.equal(h.requests.filter(request => request.options.method).length, 0)
    }
  })
  await test('Unadopted older snapshot retains prior cache and newer saved choice without clearing unresolved refusal or sticking busy', async () => {
    const h = harness(); await h.resolve(h.open(), { themes: [A, B], count: 2 }); h.choose('A')
    await h.resolve(h.open(), { error: 'refusal' }); const pending = h.refresh(); h.choose('B'); const calls = json(h.calls)
    await h.resolve(pending, { themes: [A], count: 1 })
    assert.deepEqual(h.ids, ['A', 'B']); assert.equal(h.selected, 'B'); assert.deepEqual(h.calls, calls)
    if (initialCacheBefore) { assert.ok(!h.text.includes('Could not refresh')); observations.push('816b351 clears unresolved read refusal despite retaining the old library after newer saved selection') }
    else assert.ok(h.text.includes('Could not refresh'))
    const button = nodes(h.tree).find(node => node.props['data-studio-theme-read-refresh'] === 'true')
    assert.equal(button.props['aria-busy'], undefined); assert.equal(button.props.disabled, false)
    await h.resolve(h.refresh(), { themes: [], count: 0 }); assert.deepEqual(h.ids, []); assert.equal(h.selected, ''); assert.ok(h.text.includes('No saved themes yet.')); assert.ok(!h.text.includes('Could not refresh'))
    assert.deepEqual(h.calls, calls); assert.equal(h.requests.filter(request => request.options.method).length, 0)
  })
  await test('Named source restoration rejects unknown handlers, gates and markup', async () => {
    assert.equal(restoreAcceptedComposer(source), accepted)
    for (const [from, to] of [['onSubmit(e)', 'onSubmit()'], ['disabled={templateSelectionLocked}', 'disabled={false}'], ['Select saved theme', 'Unknown saved choice']]) {
      assert.notEqual(source.replace(from, to), source)
      assert.throws(() => assert.equal(restoreAcceptedComposer(source.replace(from, to)), accepted), assert.AssertionError)
    }
  })
  await test('Current HTTP refusal/network refusal keep cache; explicit retry returns real empty success', async () => {
    for (const refusal of [{ body: {}, options: { ok: false, status: 503 } }, { body: {}, options: { reject: true } }]) {
      const h = harness(); await h.resolve(h.open(), { themes: [A] }); h.choose('A');
      h.find('Brand hex color').props.onChange({ target: { value: '#bad' } }); h.render()
      await h.resolve(h.open(), refusal.body, refusal.options)
      assert.deepEqual(h.ids, ['A']); assert.equal(h.find('Brand hex color').props.value, '#bad')
      const retry = nodes(h.tree).find(node => node.props['data-studio-theme-read-refresh'] === 'true')
      assert.equal(retry.type, 'button'); assert.equal(retry.props.type, 'button'); assert.equal(retry.props['aria-label'], 'Retry loading saved themes')
      const read = h.refresh(); assert.equal(h.find('Retry loading saved themes').props.disabled, false); assert.equal(h.find('Retry loading saved themes').props['aria-disabled'], true)
      await h.resolve(read, { themes: [], count: 0 }); assert.deepEqual(h.ids, []); assert.ok(h.text.includes('No saved themes yet.')); assert.ok(!h.text.includes('Could not refresh'))
      assert.equal(h.find('Refresh saved themes').props.type, 'button'); assert.equal(h.calls.filter(call => call[0] === 'send').length, 0)
      assert.equal(h.requests.some(request => request.options.method), false)
    }
    const h = harness(); await h.resolve(h.open(), { themes: [A] }); h.choose('A'); const calls = json(h.calls)
    await h.resolve(h.refresh(), { themes: [], count: 0 }); assert.equal(h.selected, ''); assert.ok(h.text.includes('No saved themes yet.'))
    assert.deepEqual(h.calls, calls); assert.deepEqual(json(h.props.buildTheme), A.theme_payload)
  })
  await test('Superseded error cannot replace successful library or create warning under current owner', async () => {
    const h = harness(), stale = h.open(), latest = h.open(); await h.resolve(latest, { themes: [B] }); await h.resolve(stale, { error: 'old refusal' })
    assert.deepEqual(h.ids, ['B']); assert.ok(!h.text.includes('Saved themes unavailable')); assert.ok(!h.text.includes('Could not refresh'))
    const oldOwner = h.open(); h.render({ user: { id: 'user-B' } }); assert.deepEqual(h.ids, []); const current = h.open()
    await h.resolve(current, { themes: [A] }); await h.resolve(oldOwner, { error: 'another account refusal' })
    assert.deepEqual(h.ids, ['A']); assert.ok(!h.text.includes('Could not refresh'))
  })
  await test('Account cache hidden immediately; same-account session keeps successful library and stable identity', async () => {
    const h = harness(); await h.resolve(h.open(), { themes: [A] }); h.choose('A')
    h.render({ currentSessionId: 'session-B' }); assert.deepEqual(h.ids, ['A']); assert.equal(h.selected, 'A')
    const old = h.open(); h.render({ user: { id: 'user-A', display: 'updated metadata' } }); await h.resolve(old, { themes: [B] }); assert.deepEqual(h.ids, ['B'])
    h.render({ user: { id: 'user-B' } }); assert.deepEqual(h.ids, [])
    h.render({ user: null }); assert.equal(h.find('Build theme').props.disabled, true)
  })
  await test('Unmount rejects every late leaf adoption while preserving hook contract', async () => {
    const h = harness(), read = h.open(); h.unmount(); const before = h.writes.length; await h.resolve(read, { themes: [A] })
    assert.equal(h.writes.slice(before).filter(write => write.kind === 'leaf').length, 0)
  })
  await test('A callback retained under an old owner cannot start a current read or clear current recovery', async () => {
    const h = harness()
    const oldMenu = nodes(h.tree).find(node => node.type === 'DropdownMenu' && nodes(node).some(child => child.props['aria-label'] === 'Build theme'))
    h.render({ currentSessionId: 'session-B' }); await h.resolve(h.open(), { error: 'current refusal' })
    const before = h.requests.length; oldMenu.props.onOpenChange(true); await h.tick()
    assert.equal(h.requests.length, before); assert.ok(h.text.includes('Could not refresh'))
    h.unmount(); oldMenu.props.onOpenChange(true); await h.tick(); assert.equal(h.requests.length, before)
  })
  await test('External selection and preset/custom intent survive in-flight reads; Auto/default payload exact', async () => {
    const h = harness(); await h.resolve(h.open(), { themes: [A, B] }); h.choose('A')
    const read = h.open(); h.render({ activeBuildThemeProfile: { id: 'B', name: B.name, theme_payload: B.theme_payload } })
    await h.resolve(read, { themes: [A] }); assert.equal(h.selected, 'B')
    assert.deepEqual(h.ids, ['A', 'B'], 'A snapshot predating selection retains the actual native B option')
    const read2 = h.open(); h.preset('auto'); await h.resolve(read2, { themes: [B] })
    assert.equal(h.selected, ''); assert.deepEqual(json(h.props.buildTheme), { mode: 'auto' })
    h.preset('corporate_light'); assert.deepEqual(json(h.props.buildTheme), { mode: 'preset', preset_id: 'corporate_light' })
    h.find('Brand hex color').props.onChange({ target: { value: 'ABCDEF' } }); h.render(); assert.deepEqual(json(h.props.buildTheme), { mode: 'custom', primary_hex: '#abcdef' })
  })
  await test('Saved theme handoff refusal retries and missing success is distinct; never automatically applies', async () => {
    const h = harness({ override: { studioSavedThemeRequest: { id: 'B', key: 'handoff-B' } } })
    await h.resolve(h.pending()[0], { error: 'refusal' }); assert.ok(h.text.includes('could not be loaded')); assert.equal(h.props.buildTheme.mode, 'auto')
    await h.resolve(h.refresh(), { themes: [B] }); assert.ok(h.text.includes('From Themes:')); assert.ok(!h.text.includes('unavailable because')); assert.equal(h.props.buildTheme.mode, 'auto')
    await h.resolve(h.refresh(), { themes: [] }); assert.ok(h.text.includes('unavailable in My themes')); assert.ok(!h.text.includes('could not be loaded')); assert.equal(h.calls.length, 0)
  })
  await test('Superseded handoff identities and removed requests cannot reopen or retain a stale requested theme', async () => {
    const C = theme('C')
    const h = harness({ override: { studioSavedThemeRequest: { id: 'B', key: 'request-B' } } }), old = h.pending()[0]
    h.render({ studioSavedThemeRequest: { id: 'C', key: 'request-C' } }); const current = h.pending().at(-1)
    await h.resolve(current, { themes: [C] }); await h.resolve(old, { error: 'obsolete handoff refusal' })
    assert.deepEqual(h.ids, ['C']); assert.ok(h.text.includes('From Themes: Theme C')); assert.ok(!h.text.includes('Could not refresh')); assert.deepEqual(h.calls, [])
    h.render({ studioSavedThemeRequest: null }); assert.ok(!h.text.includes('From Themes:'))
  })
  await test('Read refresh locks, local busy and unsent draft preserve native controls', async () => {
    const h = harness(); const read = h.open(); assert.equal(h.find('Refresh saved themes').props.disabled, false); assert.equal(h.find('Refresh saved themes').props['aria-disabled'], true)
    h.render({ templateSelectionLocked: true }); assert.equal(h.find('Refresh saved themes').props.disabled, true); assert.equal(h.find('Saved theme').props.disabled, true)
    await h.resolve(read, { themes: [A] }); h.render({ templateSelectionLocked: false, isLoadingSession: true }); assert.equal(h.find('Refresh saved themes').props.disabled, true)
    h.render({ isLoadingSession: false }); assert.equal(h.find('Refresh saved themes').props.disabled, false)
    const input = nodes(h.tree).find(node => node.type === 'textarea'); assert.equal(input.props.value, 'Keep unsent draft')
    assert.deepEqual(h.calls, [])
  })
  await test('Studio theme form preserves native Tab/Shift+Tab default and all other key propagation', async () => {
    for (const flag of ['true', undefined, 'false', 'TRUE', '1']) {
      const h = harness({ flag }), content = nodes(h.tree).find(node => node.props['data-studio-v4-menu'] === 'theme')
      if (flag !== 'true') { assert.equal(content.props.onKeyDownCapture, undefined); continue }
      for (const [key, shiftKey] of [['Tab', false], ['Tab', true], ['Escape', false], ['ArrowDown', false], ['ArrowUp', false], ['ArrowLeft', false], ['ArrowRight', false], ['Enter', false], [' ', false]]) {
        let stopped = 0, prevented = 0
        content.props.onKeyDownCapture({ key, shiftKey, stopPropagation() { stopped++ }, preventDefault() { prevented++ } })
        assert.equal(stopped, key === 'Tab' ? 1 : 0); assert.equal(prevented, 0, 'Native default focus traversal is never cancelled')
      }
      assert.deepEqual(h.calls, []); assert.equal(h.requests.length, 0, 'Key propagation guard never sends, applies or reads')
    }
  })
  await test('Read pending keeps the persistent native button focus-eligible and rejects duplicate reads', async () => {
    const h = harness(); await h.resolve(h.open(), { error: 'refusal' })
    const read = h.refresh(), busy = h.find('Retry loading saved themes')
    assert.equal(busy.props.disabled, false); assert.equal(busy.props['aria-disabled'], true); assert.equal(busy.props['aria-busy'], true)
    const before = h.requests.length; busy.props.onClick(); await h.tick(); assert.equal(h.requests.length, before)
    await h.resolve(read, { themes: [A] }); const recovered = h.find('Refresh saved themes')
    assert.equal(recovered.type, busy.type); assert.equal(recovered.key, busy.key); assert.equal(recovered.props['data-studio-theme-read-refresh'], busy.props['data-studio-theme-read-refresh'])
    assert.equal(recovered.props.disabled, false); assert.equal(recovered.props['aria-disabled'], undefined); assert.equal(recovered.props['aria-busy'], undefined)
    h.render({ user: null }); assert.equal(h.find('Refresh saved themes').props.disabled, true)
    h.render({ user: { id: 'user-A' }, isLoadingSession: true }); assert.equal(h.find('Refresh saved themes').props.disabled, true)
    h.render({ isLoadingSession: false, templateSelectionLocked: true }); assert.equal(h.find('Refresh saved themes').props.disabled, true)
    assert.equal(h.requests.filter(request => request.options.method).length, 0); assert.deepEqual(h.calls, [])
  })
  await test('Actual mention Enter/Tab preserve tokens and never send during theme recovery', async () => {
    const slide = { index: 0, slide_id: 'native-id', title: 'Native supplied slide' }
    const h = harness({ override: { inputMessage: 'Keep @Native', mentionSlides: [slide] } }); await h.resolve(h.open(), { error: 'refusal' })
    for (const key of ['Enter', 'Tab']) {
      h.render({ inputMessage: 'Keep @Native' }); let prevented = 0
      nodes(h.tree).find(node => node.type === 'textarea').props.onKeyDown({ key, shiftKey: false, preventDefault() { prevented++ } })
      assert.equal(prevented, 1); assert.equal(h.calls.filter(call => call[0] === 'send').length, 0); assert.equal(h.props.inputMessage, 'Keep @[Slide 1: Native supplied slide] ')
    }
  })
  await test('Real mutation refusal retains original save draft and existing warning without accepting stale read error', async () => {
    const h = harness({ override: { buildTheme: { mode: 'custom', primary_hex: '#123456' } } })
    h.find('Theme name').props.onChange({ target: { value: ' Keep name ' } }); h.render()
    h.find('Save current theme').props.onClick(); h.render(); const write = h.pending().at(-1)
    assert.equal(write.options.method, 'POST'); assert.deepEqual(JSON.parse(write.options.body), { name: 'Keep name', description: null, theme: { mode: 'custom', primary_hex: '#123456' }, set_standard: false })
    await h.resolve(write, { error: 'write refused' }, { ok: false, status: 503 }); assert.ok(h.text.includes(legacyRecovery ? 'Saved themes unavailable' : 'Could not confirm theme save')); assert.equal(h.find('Theme name').props.value, ' Keep name '); assert.deepEqual(h.calls, [])
  })
  await test('Successful native Save/standard/clear/delete keep exact wire payloads and callbacks against accepted leaf', async () => {
    for (const operation of ['save', 'standard', 'clear', 'delete']) {
      const snapshots = []
      for (const code of [accepted, candidate]) {
        const h = harness({ code }); await h.resolve(h.open(), { themes: [A, B] }); h.choose('A')
        if (operation === 'save') {
          h.find('Theme name').props.onChange({ target: { value: '  Native name  ' } }); h.render()
          const checkbox = nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox')
          checkbox.props.onChange({ target: { checked: true } }); h.render(); h.find('Save current theme').props.onClick()
        } else if (operation === 'standard') h.find('Set as standard').props.onClick()
        else if (operation === 'delete') h.find('Delete saved theme').props.onClick()
        else { if (h.byAction('manage-entry')) h.byAction('manage-entry').props.onClick(); h.render(); const clear = nodes(h.tree).find(node => node.type === 'button' && textOf(node) === 'Clear'); assert.ok(clear); clear.props.onClick() }
        h.render(); const write = h.pending().at(-1); assert.ok(write.options.method)
        const expectedRoute = operation === 'save' ? '/api/themes' : operation === 'standard' ? '/api/themes/A/standard' : operation === 'clear' ? '/api/themes/standard' : '/api/themes/A'
        assert.equal(write.url, expectedRoute); assert.equal(write.options.method, operation === 'save' ? 'POST' : operation === 'standard' ? 'PUT' : 'DELETE')
        if (operation === 'save') assert.deepEqual(JSON.parse(write.options.body), { name: 'Native name', description: null, theme: A.theme_payload, set_standard: true })
        await h.resolve(write, operation === 'save' ? B : { theme: A })
        const list = h.pending().at(-1); assert.equal(list.url, '/api/themes'); assert.equal(list.options.cache, 'no-store')
        await h.resolve(list, { themes: operation === 'delete' ? [B] : [A, B] })
        snapshots.push({ calls: json(h.calls), ids: h.ids, selected: h.selected, name: h.find('Theme name').props.value, writes: h.requests.filter(request => request.options.method).map(request => ({ url: request.url, options: request.options })) })
      }
      assert.deepEqual(json(snapshots[1]), json(snapshots[0]), `Accepted ${operation} contracts unchanged`)
    }
  })
  const setupMutation = async (kind, override = {}) => {
    const h = harness({ override }); await h.resolve(h.open(), { themes: [A, B], count: 2 }); h.choose('A')
    if (kind === 'save') { h.find('Theme name').props.onChange({ target: { value: 'Saved native theme' } }); h.render() }
    return h
  }
  const startMutation = (h, kind) => {
    if (kind === 'save') h.find('Save current theme').props.onClick()
    else if (kind === 'set-standard') h.find('Set as standard').props.onClick()
    else if (kind === 'delete') h.find('Delete saved theme').props.onClick()
    else { if (h.byAction('manage-entry')) h.byAction('manage-entry').props.onClick(); h.render(); const clear = nodes(h.tree).find(node => node.type === 'button' && textOf(node) === 'Clear'); assert.ok(clear); clear.props.onClick() }
    h.render(); const request = h.pending().at(-1); assert.ok(request?.options.method); return request
  }
  const ack = kind => kind === 'save' ? { ...B, name: 'Saved native theme', is_standard: false } : kind === 'set-standard' ? { theme: A } : {}
  const mutationState = h => nodes(h.tree).find(node => node.props['data-studio-theme-mutation-state'])?.props['data-studio-theme-mutation-state']
  await test('Late Save/Delete cannot adopt under changed account/session or its roundtrip; historical checkpoint reproduces adoption', async () => {
    for (const kind of ['save', 'delete']) for (const axis of ['user', 'currentSessionId']) for (const roundtrip of [false, true]) {
      const h = await setupMutation(kind), write = startMutation(h, kind)
      h.render(axis === 'user' ? { user: { id: 'user-B' }, activeBuildThemeProfile: B, buildTheme: B.theme_payload } : { currentSessionId: 'session-B', activeBuildThemeProfile: B, buildTheme: B.theme_payload })
      if (roundtrip) h.render(axis === 'user' ? { user: { id: 'user-A' } } : { currentSessionId: 'session-A' })
      const calls = h.calls.length, ids = [...h.ids], count = h.requests.length
      await h.resolve(write, ack(kind))
      if (mutationBefore) { assert.ok(h.calls.length > calls); observations.push(`616ad44 late ${kind} adopts after ${axis}${roundtrip ? ' roundtrip' : ' change'}`) }
      else { assert.equal(h.calls.length, calls); assert.deepEqual(h.ids, ids); assert.equal(h.selected, 'B'); assert.equal(h.requests.length, count); assert.equal(mutationState(h), undefined) }
    }
  })
  await test('Set/Clear refusal retains truthful failure and makes no GET; historical checkpoint erases refusal by unconditional GET', async () => {
    for (const kind of ['set-standard', 'clear-standard']) {
      const h = await setupMutation(kind), write = startMutation(h, kind), calls = json(h.calls)
      await h.resolve(write, { error: 'refusal' }, { ok: false, status: 503 })
      if (mutationBefore) { const read = h.pending().at(-1); assert.ok(read && !read.options.method); await h.resolve(read, { themes: [A, B] }); assert.ok(!h.text.includes('Could not')); observations.push(`616ad44 ${kind} failure is followed by GET and disappears`) }
      else { assert.equal(h.pending().length, 0); assert.equal(mutationState(h), 'failed'); assert.ok(h.text.includes('Could not')); assert.deepEqual(h.ids, ['A', 'B']); assert.equal(h.selected, 'A'); assert.deepEqual(h.calls, calls) }
    }
  })
  if (!legacyRecovery) {
    const assertNewAccountSaveCache = async (code, { refusedInitialRead = false, asStandard = false } = {}) => {
      const h = harness({ code })
      await h.resolve(h.open(), { themes: [A, B], count: 2 }); h.choose('A')
      h.render({ user: { id: 'user-B' }, activeBuildThemeProfile: null, buildTheme: { mode: 'custom', primary_hex: '#abcdef' } })
      assert.deepEqual(h.ids, [], 'Previous account library is immediately hidden')
      if (refusedInitialRead) await h.resolve(h.refresh(), { error: 'B list refused' }, { ok: false, status: 503 })
      h.find('Theme name').props.onChange({ target: { value: 'New owner name' } }); h.render()
      const checkbox = nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox')
      checkbox.props.onChange({ target: { checked: asStandard } }); h.render()
      const write = startMutation(h, 'save')
      assert.deepEqual(JSON.parse(write.options.body), { name: 'New owner name', description: null, theme: { mode: 'custom', primary_hex: '#abcdef' }, set_standard: asStandard })
      const saved = theme('B-owned', { name: 'New owner name', is_standard: asStandard, theme_payload: { mode: 'custom', primary_hex: '#abcdef' } })
      await h.resolve(write, saved)
      h.showChoices()
      assert.deepEqual(h.ids, ['B-owned'], 'Save receipt may only merge into the mutation account library')
      assert.equal(h.selected, 'B-owned'); assert.equal(mutationState(h), 'success')
      assert.deepEqual(json(h.props.activeBuildThemeProfile), { id: saved.id, name: saved.name, theme_payload: saved.theme_payload })
      const read = h.pending().at(-1); assert.equal(read.url, '/api/themes'); assert.ok(!read.options.method)
      await h.resolve(read, { error: 'B reconciliation refused' }, { ok: false, status: 503 })
      h.showChoices(); assert.deepEqual(h.ids, ['B-owned']); assert.ok(h.text.includes('Could not refresh'))
      assert.ok(!h.text.includes('Theme A')); assert.ok(!h.text.includes('Theme B'))
      h.byAction('manage-entry').props.onClick(); h.render()
      assert.ok(!h.text.includes('Theme A')); assert.ok(!h.text.includes('Theme B'))
      const clear = nodes(h.tree).find(node => node.type === 'button' && textOf(node) === 'Clear')
      assert.equal(!!clear, asStandard, 'Only an acknowledged new-owner standard offers Clear')
      const requestCount = h.requests.length
      h.showChoices(); h.choose('A'); h.choose('B')
      assert.deepEqual(h.ids, ['B-owned']); assert.equal(h.selected, 'B-owned'); assert.equal(h.requests.length, requestCount)
    }
    await test('New-account Save before an owned list or after refused list never republishes previous account themes or standard controls', async () => {
      for (const refusedInitialRead of [false, true]) for (const asStandard of [false, true]) {
        await assertNewAccountSaveCache(candidate, { refusedInitialRead, asStandard })
      }
    })
    await test('New account cannot select or manage hidden previous-account cache rows before an owned read', async () => {
      const h = harness(); await h.resolve(h.open(), { themes: [A, B] }); h.choose('A')
      h.render({ user: { id: 'user-B' } }); assert.deepEqual(h.ids, [])
      const calls = json(h.calls), requests = h.requests.length
      h.byAction('manage-entry').props.onClick(); h.render()
      assert.deepEqual(h.ids, [])
      for (const action of ['set-standard', 'clear-standard', 'delete']) assert.equal(h.byAction(action), undefined)
      h.choose('A'); h.choose('B')
      assert.deepEqual(json(h.calls), calls); assert.equal(h.requests.length, requests)
      await h.resolve(h.refresh(), { error: 'New account list refused' }, { ok: false, status: 503 })
      assert.deepEqual(h.ids, [])
      for (const action of ['set-standard', 'clear-standard', 'delete']) assert.equal(h.byAction(action), undefined)
    })
    const assertSavedColors = async (leafCode) => {
      const profiles = [A, B,
        theme('override', { theme_payload: { mode: 'custom', primary_hex: '#123456', color_overrides: { primary: '#abcdef' } } }),
        theme('preset-override', { theme_payload: { mode: 'preset', preset_id: 'future-preset', color_overrides: { primary: '#654321' } } }),
        theme('unknown', { theme_payload: { mode: 'preset', preset_id: 'future-preset' } }),
        theme('invalid', { theme_payload: { mode: 'custom', primary_hex: ['#abcdef'], color_overrides: { primary: 'red' } } }),
        theme('non-primary', { theme_payload: { mode: 'preset', preset_id: 'minimal', primary_hex: '#123456', color_overrides: { background: '#abcdef' } } }),
      ]
      const h = harness({ leafCode }); await h.resolve(h.open(), { themes: profiles })
      const expected = { A: '#123456', B: '#123456', override: '#abcdef', 'preset-override': '#654321', unknown: undefined, invalid: undefined, 'non-primary': undefined }
      for (const [id, color] of Object.entries(expected)) {
        const row = nodes(h.tree).find(node => node.props['data-studio-theme-choice'] === `saved:${id}`)
        assert.ok(row); assert.equal(row.props['aria-label'], `Choose Theme ${id}`)
        const glyph = nodes(row).find(node => node.props.className === 'studio-theme-glyph')
        assert.equal(glyph.props['aria-hidden'], 'true'); assert.equal(glyph.props['data-studio-theme-color'], color)
        assert.equal(glyph.props.style?.backgroundColor, color)
        assert.equal(nodes(glyph).some(node => node.type === 'Palette'), color === undefined)
      }
      for (const row of nodes(h.tree).filter(node => node.props['data-studio-theme-choice']?.startsWith('preset:'))) {
        assert.equal(nodes(row).find(node => node.props.className === 'studio-theme-glyph').props['data-studio-theme-color'], undefined)
      }
      h.choose('override'); assert.equal(h.selected, 'override')
      const row = nodes(h.tree).find(node => node.props['data-studio-theme-choice'] === 'saved:override')
      assert.equal(row.props['aria-pressed'], true); assert.ok(nodes(row).some(node => node.type === 'Check'))
      assert.deepEqual(json(h.props.buildTheme), profiles[2].theme_payload)
    }
    await test('Actual saved-profile chips respect explicit primary override precedence, reject coercible colors and retain unknown preset fallback', async () => {
      await assertSavedColors(fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8'))
    })
    const assertMissingSavedPayloads = async (leafCode) => {
      const missing = theme('missing'); delete missing.theme_payload
      const profiles = [A, missing, theme('null', { theme_payload: null }), theme('primitive', { theme_payload: 42 }), theme('array', { theme_payload: [] })]
      const h = harness({ leafCode }); await h.resolve(h.open(), { themes: profiles })
      for (const id of ['missing', 'null', 'primitive', 'array']) {
        const row = nodes(h.tree).find(node => node.props['data-studio-theme-choice'] === `saved:${id}`)
        assert.ok(row); assert.equal(row.props['aria-label'], `Choose Theme ${id}`)
        const glyph = nodes(row).find(node => node.props.className === 'studio-theme-glyph')
        assert.equal(glyph.props['data-studio-theme-color'], undefined); assert.equal(glyph.props.style, undefined)
        assert.ok(nodes(glyph).some(node => node.type === 'Palette'))
      }
      h.choose('A'); const calls = json(h.calls)
      for (const id of ['missing', 'null']) h.choose(id)
      assert.deepEqual(json(h.calls), calls); assert.equal(h.selected, 'A')
    }
    await test('Actual choices keep neutral rows for missing/null/nonobject payloads and retain existing no-apply behavior for missing/null', async () => {
      await assertMissingSavedPayloads(fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8'))
    })
    await test('Exact d905ec14 and removed missing-payload guard reproduce the actual choices crash', async () => {
      const presentation = fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8')
      const variant = presentation.replace("  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return undefined\n", '')
      assert.notEqual(variant, presentation)
      const previous = execFileSync('git', ['show', 'd905ec14:components/builder/studio-theme-menu.tsx'], { cwd: root, encoding: 'utf8' })
      for (const code of [previous, variant]) await assert.rejects(() => assertMissingSavedPayloads(code), error => error.name === 'TypeError' && /color_overrides/.test(error.message))
    })
    await test('Negative saved-chip witness detects removed real primary override precedence', async () => {
      const presentation = fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8')
      const variant = presentation.replace('  if (valid(primaryOverride)) return primaryOverride', '')
      assert.notEqual(variant, presentation)
      await assert.rejects(() => assertSavedColors(variant), assert.AssertionError)
    })
    await test('Exact 19ad755 and removed publication-account fence reproduce new-owner cache contamination', async () => {
      const previous = execFileSync('git', ['show', `19ad755:${leaf}`], { cwd: root, encoding: 'utf8' })
      const unfenced = source.replace(`const ownedThemes = studioThemeCacheAccount.current === owner.account
      ? studioThemeCacheThemes.current : []`, 'const ownedThemes = studioThemeCacheThemes.current')
      assert.notEqual(unfenced, source, 'Publication-account fence is present exactly once')
      for (const code of [previous, unfenced]) for (const refusedInitialRead of [false, true]) {
        await assert.rejects(() => assertNewAccountSaveCache(code, { refusedInitialRead }), error => error instanceof assert.AssertionError && error.message.includes('Save receipt may only merge'), 'Actual account-switch sequence detects old-account rows')
      }
    })
    await test('Actual supported palette rows, selected ticks, Auto payload and separate native advanced entries', async () => {
      const h = harness(); await h.tick()
      const presets = fs.readFileSync(new URL('lib/theme-builder.ts', root), 'utf8')
      assert.ok(presets.includes('Corporate Light'))
      const rows = nodes(h.tree).filter(node => node.props['data-studio-theme-choice'])
      assert.deepEqual(rows.map(node => node.props['data-studio-theme-choice']), ['auto', 'preset:corporate_light', 'preset:corporate_dark', 'preset:minimal', 'preset:vibrant', 'preset:executive', 'preset:pastel'])
      assert.ok(!h.text.includes('Sage Editorial')); assert.ok(!h.text.includes('Deckster Default'))
      h.preset('corporate_dark'); assert.deepEqual(json(h.props.buildTheme), { mode: 'preset', preset_id: 'corporate_dark' })
      const selected = nodes(h.tree).filter(node => node.props['data-studio-theme-selected'] === 'true'); assert.equal(selected.length, 1); assert.equal(selected[0].props['aria-pressed'], true)
      h.preset('auto'); assert.deepEqual(json(h.props.buildTheme), { mode: 'auto' })
      assert.ok(h.byAction('save-entry')); assert.ok(h.byAction('manage-entry')); assert.equal(nodes(h.tree).some(node => node.props['aria-label'] === 'Theme name'), false)
      h.byAction('save-entry').props.onClick(); h.render(); assert.ok(h.find('Theme name')); assert.ok(h.byAction('back')); assert.equal(h.find('Save current theme').props.disabled, false); assert.equal(h.find('Save current theme').props['aria-disabled'], true)
      h.showChoices(); h.byAction('manage-entry').props.onClick(); h.render(); assert.equal(nodes(h.tree).some(node => node.props['aria-label'] === 'Theme name'), false)
    })
    await test('Every mutation rejects duplicated activation while owned pending and retains same-owner editable drafts', async () => {
      for (const kind of ['save', 'set-standard', 'clear-standard', 'delete']) {
        const h = await setupMutation(kind), write = startMutation(h, kind), count = h.requests.length
        assert.equal(mutationState(h), 'loading')
        if (kind === 'save') h.find('Save current theme').props.onClick()
        else if (kind === 'set-standard') h.find('Set as standard').props.onClick()
        else if (kind === 'delete') h.find('Delete saved theme').props.onClick()
        else h.byAction('clear-standard').props.onClick()
        await h.tick(); assert.equal(h.requests.length, count)
        h.find('Theme name').props.onChange({ target: { value: 'New unsent name' } }); h.render()
        assert.equal(h.find('Theme name').props.disabled, false)
        await h.resolve(write, { error: 'refusal' }, { ok: false, status: 503 })
        assert.equal(mutationState(h), 'failed'); assert.equal(h.find('Theme name').props.value, 'New unsent name'); assert.equal(h.pending().length, 0)
      }
    })
    await test('Save ACK preserves newer choice/name/checkbox intent while reconciling only the owned library', async () => {
      const h = await setupMutation('save'), write = startMutation(h, 'save')
      h.find('Theme name').props.onChange({ target: { value: 'Future unsent name' } }); h.render()
      nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); h.render()
      h.preset('pastel'); const calls = json(h.calls)
      await h.resolve(write, ack('save')); assert.deepEqual(h.calls, calls); assert.deepEqual(json(h.props.buildTheme), { mode: 'preset', preset_id: 'pastel' }); assert.equal(h.selected, '')
      assert.equal(h.find('Theme name').props.value, 'Future unsent name'); assert.equal(nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true)
      assert.equal(mutationState(h), 'success'); await h.resolve(h.pending().at(-1), { themes: [A, B] }); assert.deepEqual(h.calls, calls)
    })
    await test('Same-choice Save applies its valid ACK without consuming a newer name/standard draft; acknowledged reset keeps button focus eligible', async () => {
      for (const initialStandard of [false, true]) {
        const h = await setupMutation('save')
        if (initialStandard) { nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } }); h.render() }
        const write = startMutation(h, 'save'); h.find('Theme name').props.onChange({ target: { value: 'Next unsent save' } }); h.render()
        nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: !initialStandard } }); h.render()
        await h.resolve(write, { ...B, is_standard: initialStandard }); assert.equal(h.selected, 'B'); assert.equal(h.find('Theme name').props.value, 'Next unsent save')
        assert.equal(nodes(h.tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, !initialStandard)
        await h.resolve(h.pending().at(-1), { themes: [A, B] })
      }
      const h = await setupMutation('save'), write = startMutation(h, 'save'), button = h.find('Save current theme')
      assert.equal(button.props.disabled, false); assert.equal(button.props['aria-busy'], true)
      await h.resolve(write, ack('save')); const after = h.find('Save current theme')
      assert.equal(after.type, button.type); assert.equal(after.key, button.key); assert.equal(after.props.disabled, false); assert.equal(after.props['aria-disabled'], true)
      const count = h.requests.length; after.props.onClick(); await h.tick(); assert.equal(h.requests.length, count, 'Empty acknowledged draft cannot send another Save')
      await h.resolve(h.pending().at(-1), { themes: [A, B] })
    })
    await test('Delete ACK removes its original profile but cannot clear a newer selected profile', async () => {
      const h = await setupMutation('delete'), write = startMutation(h, 'delete'); h.choose('B'); const calls = json(h.calls)
      await h.resolve(write, ack('delete')); assert.equal(h.selected, 'B'); assert.deepEqual(h.calls, calls); assert.deepEqual(h.ids, ['B'])
      await h.resolve(h.pending().at(-1), { themes: [B] }); assert.equal(h.selected, 'B'); assert.deepEqual(h.calls, calls)
    })
    await test('All late mutation ACKs after unmount have zero native leaf adoption or reconciliation', async () => {
      for (const kind of ['save', 'set-standard', 'clear-standard', 'delete']) {
        const h = await setupMutation(kind), write = startMutation(h, kind); h.unmount(); const count = h.writes.length, calls = json(h.calls), requests = h.requests.length
        await h.resolve(write, ack(kind)); assert.equal(h.writes.slice(count).filter(item => item.kind === 'leaf').length, 0); assert.deepEqual(h.calls, calls); assert.equal(h.requests.length, requests)
      }
    })
    await test('Admission honors authentication/session/template readiness; a lock during Save/Delete preserves current choice/draft', async () => {
      for (const blocked of [{ user: null }, { isLoadingSession: true }, { templateSelectionLocked: true }]) {
        const h = await setupMutation('save'), button = h.find('Save current theme'), count = h.requests.length
        h.render(blocked); button.props.onClick(); await h.tick(); assert.equal(h.requests.length, count)
      }
      for (const kind of ['save', 'delete']) {
        const h = await setupMutation(kind), write = startMutation(h, kind), calls = json(h.calls)
        h.render({ templateSelectionLocked: true }); await h.resolve(write, ack(kind)); assert.deepEqual(h.calls, calls); assert.equal(h.selected, 'A'); assert.equal(h.pending().length, 0)
        if (kind === 'save') assert.equal(h.find('Theme name').props.value, 'Saved native theme')
      }
    })
    await test('Owned ACK invalidates a later in-flight GET even when readiness prevents reconciliation', async () => {
      for (const kind of ['save', 'set-standard']) {
        const h = await setupMutation(kind), write = startMutation(h, kind), read = h.refresh()
        h.render({ templateSelectionLocked: true }); await h.resolve(write, ack(kind)); const cache = [...h.ids]
        await h.resolve(read, { themes: [], count: 0 }); assert.deepEqual(h.ids, cache); assert.deepEqual(h.ids, ['A', 'B']); assert.ok(!h.text.includes('No saved themes yet.'))
        assert.equal(nodes(h.tree).find(node => node.props['data-studio-theme-read-refresh'])?.props['aria-busy'], undefined); assert.equal(mutationState(h), 'success')
      }
    })
    await test('Failed mutation leaves a later independent successful GET valid and cannot lose its refusal', async () => {
      const h = await setupMutation('set-standard'), write = startMutation(h, 'set-standard'), read = h.refresh()
      await h.resolve(write, {}, { ok: false, status: 503 }); await h.resolve(read, { themes: [B], count: 1 })
      assert.deepEqual(h.ids, ['B']); assert.equal(mutationState(h), 'failed'); assert.ok(h.text.includes('Could not confirm standard theme'))
    })
    await test('POST/PUT usable profile validation rejects malformed and coercible literals with no GET/callback', async () => {
      const malformed = [{ error: 'HTTP 200 refusal' }, {}, { ...B, theme_payload: { mode: 'auto' } }, { ...B, theme_payload: { mode: 'custom' } }, { ...B, theme_payload: { mode: 'custom', primary_hex: ['#abcdef'] } }, { ...B, theme_payload: { mode: 'custom', primary_hex: '#abcdef', secondary_hex: ['#123456'] } }, { ...B, theme_payload: { mode: 'custom', color_overrides: { primary: ['#abcdef'] } } }, { ...B, theme_payload: { mode: 'custom', color_overrides: ['#abcdef'] } }, { ...B, theme_payload: { mode: 'preset', preset_id: ['pastel'] } }, { ...B, id: ['B'] }, { ...B, name: null }, { ...B, theme_payload: { mode: 'custom', primary_hex: '#abcdef', tertiary_hex: 123 } }, { ...B, theme_payload: { mode: 'custom', primary_hex: '#abcdef', neutral_hex: 'invalid' } }]
      for (const kind of ['save', 'set-standard']) for (const profile of malformed) {
        const h = await setupMutation(kind), write = startMutation(h, kind), calls = json(h.calls), beforeIds = [...h.ids]
        await h.resolve(write, kind === 'save' ? profile : { theme: { ...profile, ...(typeof profile.id === 'string' ? { id: 'A' } : {}) } })
        assert.equal(mutationState(h), 'failed'); assert.deepEqual(h.calls, calls); assert.deepEqual(h.ids, beforeIds); assert.equal(h.pending().length, 0)
      }
      const h = await setupMutation('set-standard'), write = startMutation(h, 'set-standard'); await h.resolve(write, { theme: B }); assert.equal(mutationState(h), 'failed'); assert.equal(h.pending().length, 0)
    })
    await test('Valid override-only custom and future/alias preset ACKs remain usable without raw equality requirements', async () => {
      for (const payload of [{ mode: 'custom', color_overrides: { primary: '#abcdef' } }, { mode: 'preset', preset_id: 'corporate-blue' }, { mode: 'preset', preset_id: 'future_service_theme' }]) {
        const h = await setupMutation('save'), write = startMutation(h, 'save'), saved = { ...B, theme_payload: payload }
        await h.resolve(write, saved); assert.equal(mutationState(h), 'success'); assert.deepEqual(json(h.props.buildTheme), payload); assert.equal(h.selected, 'B')
        await h.resolve(h.pending().at(-1), { themes: [A, saved] }); assert.deepEqual(json(h.props.buildTheme), payload)
      }
    })
    await test('Unconfirmed standard flag stays uncertain and is never promoted by issued request or unrelated library', async () => {
      for (const is_standard of [undefined, false]) {
        const h = await setupMutation('set-standard'), write = startMutation(h, 'set-standard'); await h.resolve(write, { theme: { ...A, is_standard } })
        assert.equal(mutationState(h), 'uncertain'); assert.equal(h.pending().length, 0); assert.ok(h.text.includes('Standard status was not confirmed'))
        await h.resolve(h.refresh(), { themes: [A, B] }); assert.equal(mutationState(h), 'uncertain')
      }
    })
    await test('Negative actual-mutation witnesses reject missing ownership, readiness, pending, selection, ACK/literal and read invalidation fences', async () => {
      const prepare = async (code, kind = 'save') => {
        const h = harness({ code }); await h.resolve(h.open(), { themes: [A, B] }); h.choose('A')
        if (kind === 'save') { h.find('Theme name').props.onChange({ target: { value: 'Saved native theme' } }); h.render() }
        return h
      }
      const variants = [
        { name: 'ACK owner', code: source.replace('      || studioThemeOwnerRef.current !== owner\n      || studioThemeMutationRequest.current?.sequence', '      || studioThemeMutationRequest.current?.sequence'), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'); h.render({ currentSessionId: 'B' }); h.render({ currentSessionId: 'session-A' }); await h.resolve(write, { ...B, id: 'new-owned-ack' }); assert.deepEqual(h.ids, ['A', 'B']) } },
        { name: 'pending admission', code: source.replace('      || (prior?.owner === owner && prior.mountEpoch === mountEpoch)', ''), run: async code => { const h = await prepare(code); startMutation(h, 'save'); const count = h.requests.length; h.find('Save current theme').props.onClick(); await h.tick(); assert.equal(h.requests.length, count) } },
        { name: 'readiness adoption', code: source.replace('const stillReady = studioThemeReady.current.owner === owner && studioThemeReady.current.allowed', 'const stillReady = true'), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'), calls = json(h.calls); h.render({ templateSelectionLocked: true }); await h.resolve(write, ack('save')); assert.deepEqual(h.calls, calls) } },
        { name: 'newer choice', code: source.replace('const choiceUnchanged = studioThemeSelection.current.epoch === selectionEpoch', 'const choiceUnchanged = true'), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'); h.preset('pastel'); await h.resolve(write, ack('save')); assert.deepEqual(json(h.props.buildTheme), { mode: 'preset', preset_id: 'pastel' }) } },
        { name: 'usable Auto rejection', code: source.replace("payload.mode === 'preset'\n          ?", "payload.mode === 'auto' || payload.mode === 'preset'\n          ?"), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'); await h.resolve(write, { ...B, theme_payload: { mode: 'auto', preset_id: 'any' } }); assert.equal(mutationState(h), 'failed') } },
        { name: 'literal string type', code: source.replace("typeof literal === 'string' && isValidThemeHex(literal)", 'isValidThemeHex(literal as string)'), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'); await h.resolve(write, { ...B, theme_payload: { mode: 'custom', primary_hex: ['#abcdef'] } }); assert.equal(mutationState(h), 'failed') } },
        { name: 'ACK read invalidation', code: source.replace(`      ++studioThemeReadSequence.current
      studioThemeReadActivity.current = null
      setStudioThemeRead((previous) => previous?.owner === owner && previous.phase === 'loading'
        ? { ...previous, phase: previous.failed ? 'failed' : 'loaded' } : previous)
`, ''), run: async code => { const h = await prepare(code), write = startMutation(h, 'save'), read = h.refresh(); h.render({ templateSelectionLocked: true }); await h.resolve(write, ack('save')); await h.resolve(read, { themes: [] }); assert.deepEqual(h.ids, ['A', 'B']) } },
        { name: 'refusal terminates write', code: source.replace("      setStudioThemeMutation({ owner, kind, phase: 'failed', message: refusal[kind] })\n      return", "      setStudioThemeMutation({ owner, kind, phase: 'failed', message: refusal[kind] })"), run: async code => { const h = await prepare(code, 'set-standard'), write = startMutation(h, 'set-standard'); await h.resolve(write, {}, { ok: false, status: 503 }); assert.equal(h.pending().length, 0); assert.equal(mutationState(h), 'failed') } },
      ]
      for (const variant of variants) { assert.notEqual(variant.code, source, variant.name); await assert.rejects(() => variant.run(variant.code), assert.AssertionError, `Removed ${variant.name} fails an actual invariant`) }
    })
  }
  await test('Negative actual-leaf witnesses reject removed read fences, native Tab traversal and pending focus eligibility', async () => {
    const variants = [
      { name: 'null retention', code: source.replace("      if (res === null) {", "      if (res === null) {\n        setSavedThemes([]); setSelectedSavedThemeId(null)"), run: async h => { await h.resolve(h.open(), { themes: [A] }); h.choose('A'); await h.resolve(h.open(), { error: 'refusal' }); assert.deepEqual(h.ids, ['A']); assert.equal(h.selected, 'A') } },
      { name: 'latest sequence', code: source.replace(' || studioThemeReadSequence.current !== sequence', ''), run: async h => { const old = h.open(), latest = h.open(); await h.resolve(latest, { themes: [B] }); await h.resolve(old, { themes: [A] }); assert.deepEqual(h.ids, ['B']) } },
      { name: 'owner identity', code: source.replaceAll(' || studioThemeOwnerRef.current !== studioThemeOwner', '').replaceAll('|| studioThemeOwnerRef.current !== studioThemeOwner ||', '||'), run: async h => { const old = h.open(); h.render({ currentSessionId: 'session-B' }); h.render({ currentSessionId: 'session-A' }); await h.resolve(old, { themes: [A] }); assert.deepEqual(h.ids, []) } },
      { name: 'selection intent', code: source.replace('if (selectionChanged && cachedSelectionKnown && !res.themes.some', 'if (false && cachedSelectionKnown && !res.themes.some').replace('if (!preserveSelection && !selectionChanged)', 'if (!preserveSelection)'), run: async h => { await h.resolve(h.open(), { themes: [A, B] }); const old = h.open(); h.choose('B'); await h.resolve(old, { themes: [A] }); assert.equal(h.selected, 'B'); assert.deepEqual(h.ids, ['A', 'B']) } },
      { name: 'initial cache truth', code: source.replace('if (selectionChanged && cachedSelectionKnown && !res.themes.some((theme) => theme.id === currentSelectionId))', 'if (selectionChanged)'), run: async h => { const first = h.open(); h.find('Brand hex color').props.onChange({ target: { value: '#abcdef' } }); h.render(); await h.resolve(first, { themes: [A, B], count: 2 }); assert.deepEqual(h.ids, ['A', 'B']); assert.ok(!h.text.includes('No saved themes yet.')) } },
      { name: 'unresolved prior refusal', code: source.replace("phase: previous?.owner === studioThemeOwner && previous.failed ? 'failed' : 'loaded',\n          failed: previous?.owner === studioThemeOwner && previous.failed,", "phase: 'loaded',\n          failed: false,"), run: async h => { await h.resolve(h.open(), { themes: [A, B] }); h.choose('A'); await h.resolve(h.open(), { error: 'refusal' }); const pending = h.refresh(); h.choose('B'); await h.resolve(pending, { themes: [A] }); assert.ok(h.text.includes('Could not refresh')) } },
      { name: 'native Tab default', code: source.replace("if (event.key === 'Tab') event.stopPropagation()", "if (event.key === 'Tab') event.preventDefault()"), run: async h => { const content = nodes(h.tree).find(node => node.props['data-studio-v4-menu'] === 'theme'); let prevented = 0; content.props.onKeyDownCapture({ key: 'Tab', stopPropagation() {}, preventDefault() { prevented++ } }); assert.equal(prevented, 0) } },
      { name: 'pending native focus', code: source, leafCode: fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8').replace('disabled={p.locked} aria-disabled={p.readBusy', 'disabled={p.locked || p.readBusy} aria-disabled={p.readBusy'), run: async h => { h.open(); assert.equal(h.find('Refresh saved themes').props.disabled, false) } },
    ]
    for (const variant of variants) { assert.ok(variant.code !== source || variant.leafCode); await assert.rejects(() => variant.run(harness({ code: variant.code, leafCode: variant.leafCode })), assert.AssertionError, `Removed ${variant.name} must fail a real invariant`) }
  })
}

if (!baseline && !legacyRecovery) await test('Theme CSS parses, stays inside its Studio portal and retains pending/focus/reduced-motion roles', () => {
  const css = fs.readFileSync(new URL('components/builder/studio-theme-menu.css', root), 'utf8')
  const verifyScope = value => postcss.parse(value).walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return
    assert.ok(rule.selector.startsWith('[data-studio-composer-menu="theme"]') || rule.selector.startsWith('.dark [data-studio-composer-menu="theme"]'), `Unscoped theme rule: ${rule.selector}`)
  })
  verifyScope(css)
  assert.match(css, /:focus-visible\s*\{[^}]*outline:/)
  assert.match(css, /\[aria-disabled="true"\]\s*\{[^}]*opacity:/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.throws(() => verifyScope(css + '\nbutton { color: red; }'), assert.AssertionError, 'Unknown global CSS leakage fails the scope witness')
})

if (!baseline && !legacyRecovery) await test('Actual Save color declarations beat the inherited chrome cascade in light/dark and either load order', () => {
  const css = fs.readFileSync(new URL('components/builder/studio-theme-menu.css', root), 'utf8')
  const inherited = fs.readFileSync(new URL('app/builder/studio-v4.css', root), 'utf8') + '\n' + fs.readFileSync(new URL('components/builder/studio-director.css', root), 'utf8')
  const before = fs.readFileSync(new URL('docs/studio-v4/overnight-fidelity-20261002/evidence/native-theme-recovery/save-foreground-before.css', root), 'utf8')
  // These actual Save selectors are simple attribute/class/type compounds. This
  // bounded cascade witness is not a browser selector or geometry substitute.
  const foreground = (value, dark, disabled, reverse = false) => {
    const candidates = []
    for (const sheet of reverse ? [value, inherited] : [inherited, value]) postcss.parse(sheet).walkRules(rule => {
      for (const selector of rule.selector.split(',')) {
        if (!selector.includes('[aria-label="Save current theme"]') && !selector.includes('[data-studio-theme-action="save"]')) continue
        if ((!dark && selector.includes('.dark')) || (!disabled && selector.includes(':disabled'))) continue
        const attrs = selector.match(/\[[^\]]+\]/g) || []
        const rest = selector.replace(/\[[^\]]+\]/g, '')
        const weight = attrs.length + (rest.match(/\.[\w-]+|:[\w-]+/g) || []).length
        rule.walkDecls('color', declaration => candidates.push({ weight, value: declaration.value }))
      }
    })
    return candidates.sort((a, b) => a.weight - b.weight).at(-1)?.value
  }
  assert.equal(foreground(before, true, false), 'var(--sv4-panel)', 'Exact pre-fix CSS reproduces inherited dark foreground')
  const verify = value => { for (const dark of [false, true]) for (const disabled of [false, true]) for (const reverse of [false, true]) assert.equal(foreground(value, dark, disabled, reverse), '#fff') }
  verify(css)
  assert.throws(() => verify(before), assert.AssertionError, 'Restoring the old dedicated selector reproduces the actual foreground failure')
})

const normalizeTree = value => Array.isArray(value) ? value.filter(item => item != null && item !== false).flatMap(item => normalizeTree(item)) : value?.type === 'Fragment' ? normalizeTree(value.props?.children) : value && typeof value === 'object' ? { type: String(value.type), key: value.key, props: Object.fromEntries(Object.entries(value.props || {}).filter(([key, item]) => typeof item !== 'function' && key !== 'ref' && !(key === 'children' && (item == null || item === false))).map(([key, item]) => [key, normalizeTree(item)])) } : value
await test('Literal/default-off classic actual DOM, callbacks and null refresh semantics are unchanged', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const original = harness({ code: accepted, flag }), current = harness({ code: candidate, flag })
    assert.deepEqual(json(normalizeTree(current.tree)), json(normalizeTree(original.tree)))
    for (const h of [original, current]) { await h.resolve(h.open(), { themes: [A] }); h.choose('A'); await h.resolve(h.open(), { error: 'refusal' }) }
    assert.deepEqual(json(normalizeTree(current.tree)), json(normalizeTree(original.tree))); assert.deepEqual(current.calls, original.calls); assert.deepEqual(current.ids, []); assert.equal(current.selected, '')
    assert.equal(nodes(current.tree).some(node => node.props['data-studio-theme-read-refresh']), false)
  }
})
console.log(JSON.stringify({ mode: accountCacheBefore ? '19ad755-account-cache-before' : baseline ? 'historical-before' : initialCacheBefore ? '816b351-initial-cache-before' : mutationBefore ? '616ad44-mutation-before' : 'candidate', anchor: '17ef94f', leafSha256: hash(candidate), actualHookSha256: hash(hookSource), dependencyProvenance: { actualMentionSha256: hash(fs.readFileSync(new URL('lib/mdc-mentions.ts', root), 'utf8')), currentReadOnlyTemplateHookSha256: hash(fs.readFileSync(new URL('hooks/use-templates.ts', root), 'utf8')), actualPresentationLeafSha256: hash(fs.readFileSync(new URL('components/builder/studio-theme-menu.tsx', root), 'utf8')), actualPresentationCssSha256: hash(fs.readFileSync(new URL('components/builder/studio-theme-menu.css', root), 'utf8')), actualThemeBuilderSha256: hash(fs.readFileSync(new URL('lib/theme-builder.ts', root), 'utf8')), scope: 'Theme hook, theme builder helpers, Studio presentation leaf and mention helpers execute; template readiness is a fixture adapter. No connected service proof.' }, passed: results.length, cases: results, historicalFailures: observations, limitations: ['Deferred actual-leaf/hook fixture; no browser geometry, focus movement, service writes, session persistence or Director roundtrip claimed.'] }, null, 2))
