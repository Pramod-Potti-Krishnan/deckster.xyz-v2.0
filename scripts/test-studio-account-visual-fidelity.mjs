import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

// Actual account leaf/handlers with supplied offline auth/quota values. No
// provider, navigation, logout, storage, browser or service operation runs.
const root = new URL('../', import.meta.url), baseline = 'ceed8089475f6653ddded57a19f0f40a895daf7e'
const file = 'components/user-profile-menu.tsx', cssFile = 'components/user-profile-studio-v4.css'
const read = name => fs.readFileSync(new URL(name, root), 'utf8')
const before = name => execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' })
const source = read(file), prior = before(file), css = read(cssFile), oldCss = before(cssFile)
const jsx = (type, props) => ({ type, props: props ?? {} })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const rendered = value => JSON.stringify(value, (key, item) => key === 'children' && Array.isArray(item) ? item.filter(x => x !== false && x !== undefined && x !== null) : item)
const compile = code => { const out = ts.transpileModule(code, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0); return out.outputText }
const user = { id: 'actual-owned-account', name: 'Ada Morgan', email: 'owned@example.invalid', image: null }
const suppliedQuota = { tierLabel: 'Actual supplied plan', remainingPct: { daily: .37, weekly: .82 }, flags: { dailyNear: true, dailyAt: false, weeklyNear: false, weeklyAt: false }, resetAt: { daily: '2099-01-01T00:00:00Z', weekly: '2099-01-08T00:00:00Z' }, caps: { dailyCents: 10, weeklyCents: 20 }, spent: { dailyCents: 6, weeklyCents: 3 } }
function harness({ code = source, flag = 'true', palette = true, labels = true, account = user, loading = false, theme = 'light', sessionUsage = { type: 'SuppliedSessionUsage', props: { children: 'Exact supplied session total' } } } = {}) {
  const slots = [], effects = [], events = []; let cursor = 0, tree
  const environment = { user: account, loading, theme, quota: suppliedQuota, ok: true }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((x,index) => x !== previous.deps[index])) { slots[i] = { deps }; effects.push(fn) } },
  }
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'next/navigation': { useRouter: () => ({ push: path => events.push(['navigate', path]) }) },
    '@/hooks/use-auth': { useAuth: () => ({ user: environment.user, isLoading: environment.loading, logout: async () => events.push(['logout']) }) },
    'next-themes': { useTheme: () => ({ theme: environment.theme, setTheme: next => { events.push(['theme', next]); environment.theme = next } }) },
    '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' ') }, './user-profile-studio-v4.css': {},
  }
  const mod = { exports: {} }
  vm.runInNewContext(compile(code), { module: mod, exports: mod.exports, Date, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag === '__absent__' ? undefined : flag } }, require: name => {
    if (name in dependencies) return dependencies[name]
    if (name === 'lucide-react' || name.startsWith('@/components/')) return new Proxy({}, { get: (_target, key) => key })
    assert.fail(`Unexpected import ${name}`)
  }, fetch: async (url, options) => { events.push(['read', url, options]); return { ok: environment.ok, json: async () => environment.quota } } })
  const h = {
    environment, events,
    render() { cursor = 0; tree = mod.exports.UserProfileMenu({ studioLabels: labels, studioPalette: palette, sessionUsage }); return tree },
    get tree() { return tree },
    get menu() { return nodes(tree).find(x => x.type === 'DropdownMenuContent') },
    get trigger() { return nodes(tree).find(x => x.type === 'Button') },
    async flush() { while (effects.length) effects.shift()(); for(let i=0;i<40;i++)await Promise.resolve(); h.render() },
    open(value) { nodes(tree).find(x => x.type === 'DropdownMenu').props.onOpenChange(value); return h.render() },
    get usage() { return nodes(tree).find(x => typeof x.type === 'function') },
  }
  h.render(); return h
}
let checks = 0
const check = async (label, fn) => { await fn(); checks++; console.log(`PASS ${label}`) }
const expectedRoutes = [['Dashboard','/dashboard'],['Knowledge','/knowledge'],['Settings','/settings'],['Help','/help']]
await check('Only the literal Studio shell plus existing palette gate opts into account presentation', () => {
  for(const flag of ['true','__absent__','','false','TRUE','1']) for(const palette of [true,false]) {
    const h=harness({flag,palette});const active=flag==='true'&&palette
    assert.equal(h.trigger.props['data-studio-profile-trigger'],active?'true':undefined)
    assert.equal(h.menu.props['data-studio-profile-fidelity'],active?'true':undefined)
    assert.equal(h.menu.props['data-studio-v4-profile'],palette?'true':undefined)
    assert.equal(h.menu.props.side,active?'right':undefined);assert.equal(h.menu.props.sideOffset,active?8:undefined);assert.equal(h.menu.props.align,'end')
  }
})
for(const account of [user,{...user,image:'/supplied-owned-avatar.png'},{...user,name:null,image:null},{...user,name:'One Long Account Name',email:'long-account-name-with-complete-identity@example.invalid'}])await check(`Genuine account image/name/email/initials are unchanged: ${account.name}`,()=>{
  const h=harness({account}),old=harness({code:prior,account})
  for(const type of ['AvatarImage','AvatarFallback'])assert.equal(text(nodes(h.tree).find(x=>x.type===type)),text(nodes(old.tree).find(x=>x.type===type)))
  const image=nodes(h.tree).find(x=>x.type==='AvatarImage'),original=nodes(old.tree).find(x=>x.type==='AvatarImage')
  assert.equal(image.props.src,original.props.src);assert.equal(image.props.alt,original.props.alt)
  assert.match(text(h.menu),new RegExp(account.email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
})
await check('Loading and missing-account branches preserve auth gates and classic skeleton exactly',()=>{
  for(const loading of [false,true])for(const account of [null,user])for(const flag of ['true','false','__absent__']){
    const h=harness({loading,account,flag}),old=harness({code:prior,loading,account,flag})
    if(loading||!account){assert.equal(h.trigger,undefined);assert.equal(h.menu,undefined);assert.equal(h.tree.props['data-studio-profile-loading'],flag==='true'?'true':undefined)}
    if(flag!=='true')assert.equal(rendered(h.tree),rendered(old.tree))
    assert.equal(h.events.length,0)
  }
})
await check('Native quota GET/tier/percentages/reset/billing and disclosure toggle remain exact',async()=>{
  const h=harness(),old=harness({code:prior});await h.flush();await old.flush();assert.equal(h.events.length,0)
  h.open(true);old.open(true);await h.flush();await old.flush();assert.equal(JSON.stringify(h.events),JSON.stringify(old.events));assert.equal(h.events[0][1],'/api/usage/quota')
  assert.equal(nodes(h.tree).find(x=>x.type==='Badge').props.children,suppliedQuota.tierLabel)
  const usage=h.usage,oldUsage=old.usage;assert.equal(JSON.stringify(usage.props.data),JSON.stringify(oldUsage.props.data))
  const ui=usage.type(usage.props),oldUi=oldUsage.type(oldUsage.props);assert.equal(rendered(ui),rendered(oldUi))
  const toggle=nodes(ui).find(x=>x.type==='button');let prevented=0,stopped=0;toggle.props.onClick({preventDefault(){prevented++},stopPropagation(){stopped++}});h.render()
  const expanded=h.usage.type(h.usage.props);assert.equal(prevented,1);assert.equal(stopped,1);assert.match(text(expanded),/37%/);assert.match(text(expanded),/82%/)
  assert.equal(nodes(expanded).find(x=>x.type==='a').props.href,'/billing');assert.match(text(expanded),/Upgrade for more usage/)
})
await check('Quota refusal retains original nonfatal menu and no fabricated quota values',async()=>{
  const h=harness(),old=harness({code:prior});h.environment.ok=old.environment.ok=false;h.open(true);old.open(true);await h.flush();await old.flush()
  assert.equal(nodes(h.tree).some(x=>x.type==='Badge'),false);assert.equal(h.usage,undefined);assert.equal(JSON.stringify(h.events),JSON.stringify(old.events))
})
await check('Exact native routes/theme/logout/About handlers and close gates are preserved',async()=>{
  const h=harness(),old=harness({code:prior})
  for(const [label,path]of expectedRoutes){for(const item of[h,old]){item.open(true);nodes(item.tree).find(x=>x.type==='DropdownMenuItem'&&text(x)===label).props.onClick();item.render();assert.equal(nodes(item.tree).find(x=>x.type==='DropdownMenu').props.open,false)}assert.equal(h.events.at(-1)[1],path)}
  for(const item of[h,old]){nodes(item.tree).find(x=>x.type==='DropdownMenuItem'&&text(x)==='Dark Mode').props.onClick();item.render();assert.match(text(item.menu),/Light Mode/);item.open(true);await nodes(item.tree).find(x=>x.type==='DropdownMenuItem'&&text(x)==='Sign Out').props.onClick();item.render();assert.equal(nodes(item.tree).find(x=>x.type==='DropdownMenu').props.open,false)}
  assert.equal(JSON.stringify(h.events),JSON.stringify(old.events))
  let prevented=0;nodes(h.tree).find(x=>x.type==='DropdownMenuItem'&&text(x)==='About Studio').props.onSelect({preventDefault(){prevented++}});h.render()
  assert.equal(prevented,1);assert.equal(nodes(h.tree).find(x=>x.type==='StudioAboutDialog').props.open,true)
})
for(const flag of ['__absent__','','false','TRUE','1'])await check(`Classic/default-off tree and real handlers stay exact againstceed8089: ${flag}`,async()=>{
  const h=harness({flag}),old=harness({code:prior,flag});assert.equal(rendered(h.tree),rendered(old.tree));h.open(true);old.open(true);await h.flush();await old.flush();assert.equal(rendered(h.tree),rendered(old.tree));assert.equal(JSON.stringify(h.events),JSON.stringify(old.events))
})
await check('Palette-off callers retain exact prior tree even under literal shell',()=>{
  assert.equal(rendered(harness({palette:false}).tree),rendered(harness({code:prior,palette:false}).tree))
})
await check('Session usage child remains supplied by identity and independent of quota',()=>{
  const supplied={type:'SameUsageObject',props:{children:'Exact native session tokens'}}
  for(const flag of ['true','false','__absent__']){const h=harness({flag,sessionUsage:supplied});const slot=nodes(h.tree).find(x=>x.props['data-studio-session-usage']);assert.equal(Boolean(slot),flag==='true');if(slot)assert.equal(slot.props.children,supplied)}
})
await check('Negative control rejects legacy visual opt-out and loosened nonliteral flag gates',()=>{
  const reverted=harness({code:prior});assert.throws(()=>assert.equal(reverted.trigger.props['data-studio-profile-trigger'],'true'),assert.AssertionError)
  const loosened=source.replace("process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && studioPalette","Boolean(process.env.NEXT_PUBLIC_STUDIO_V4_SHELL) && studioPalette")
  assert.notEqual(loosened,source);assert.throws(()=>assert.equal(harness({code:loosened,flag:'TRUE'}).trigger.props['data-studio-profile-trigger'],undefined),assert.AssertionError)
})
await check('Entire native component reverses after only presentation markers and literal palette declaration',()=>{
  const restored=source.replace("  const studioProfile = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && studioPalette\n",'').replace(/ data-studio-profile-(?:trigger|avatar|fallback|identity|name|email|loading|fidelity)=\{studioProfile \? "true" : undefined\}/g,'')
  assert.equal(restored.replace(' side={studioProfile ? "right" : undefined} sideOffset={studioProfile ? 8 : undefined}', ''),prior)
})
await check('Scoped CSS keeps30px neutral avatar inside40px hit target; menu bounds/focus/readability/default styles preserved',()=>{
  const divider='\n/* Accepted v4 account presentation; literal shell and existing palette opt-in. */\n';assert.equal(css.split(divider).length,2);assert.equal(css.split(divider)[0],oldCss)
  const rules=postcss.parse(css.split(divider)[1]);rules.walkRules(rule=>assert.match(rule.selector,/data-studio-profile-(?:trigger|avatar|fallback|identity|name|email|loading|fidelity)="true"/))
  const decls=selector=>Object.fromEntries(rules.nodes.find(x=>x.type==='rule'&&x.selector===selector).nodes.map(x=>[x.prop,x.value]))
  const trigger=decls('button[data-studio-profile-trigger="true"]'),avatar=decls('[data-studio-profile-trigger="true"] [data-studio-profile-avatar="true"]'),fallback=decls('[data-studio-profile-trigger="true"] [data-studio-profile-fallback="true"]'),menu=decls('[data-studio-profile-fidelity="true"]')
  assert.equal(trigger.width,'40px');assert.equal(trigger.height,'40px');assert.equal(avatar.width,'30px');assert.equal(avatar.height,'30px')
  assert.equal(fallback['background-image'],'none');assert.equal(fallback['background-color'],'#eaf0f3');assert.equal(menu.width,'295px');assert.match(menu['max-width'],/100vw/);assert.match(menu['max-height'],/radix-dropdown-menu-content-available-height/);assert.equal(menu['overflow-y'],'auto')
  assert.match(css,/data-studio-profile-trigger="true"\]:focus-visible/);assert.doesNotMatch(css.split(divider)[1],/nextjs|dev.?badge|display:\s*none/)
})
await check('Readable neutral initials keep accepted pale-avatar role with explicit contrast correction',()=>{
  const luminance=color=>{const linear=color.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722}
  const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
  assert.match(css,/color: #566b77/);assert.match(css,/background-color: #eaf0f3/);assert.ok(ratio('#566b77','#eaf0f3')>=4.5);assert.ok(ratio('#b9cbd3','#27383f')>=4.5)
  assert.ok(ratio('#657c8a','#eaf0f3')<4.5,'Reference foreground deviation is for small-text legibility')
})
console.log(`${checks} actual account presentation/native/default-off checks passed; supplied offline values only. Rendered geometry/theme/contrast remain lead-owned.`)
