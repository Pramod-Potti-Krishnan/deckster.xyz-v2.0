import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Actual component hooks, effects, callbacks and native command receipts; supplied
// local values only. Real file/network/service operations remain refused.
const path = 'components/presentation-settings-panel.tsx', baseline = '083c250b44da5c11049511e6f86049d12acff759'
const source = fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const prior = execFileSync('git',['show',baseline + ':' + path],{encoding:'utf8'})
const bridgeSource = fs.readFileSync(new URL('../lib/layout-viewer-messaging.ts',import.meta.url),'utf8')
const jsx = (type,props,key) => ({type,props:props ?? {},key})
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value,...nodes(value.props?.children)] : []
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? textOf(value.props?.children) : String(value)
const rendered = tree => JSON.stringify(tree,(key,value)=> { if(key!=='children')return value;const items=(Array.isArray(value)?value.flat(Infinity):[value]).filter(v=>v!==false&&v!==null&&v!==undefined);return items.length===1?items[0]:items })
const compile = code => { const c=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});assert.deepEqual((c.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);return c.outputText }
function fixture(flag='true',code=source) {
  const names=[...code.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(m=>m[1])
  const state={},slots=[],pending=new Map(),messages=new Set(),timers=new Map(),events=[]
  let cursor=0,stateCursor=0,dirty=false,now=0,nextTimer=0,closed=0,tree
  const frame = (name='A') => {
    const listeners=new Set()
    const f={src:'https://layout.local/v1/p/'+name,getAttribute:n=>n==='src'?f.src:null,addEventListener:(type,fn)=>{assert.equal(type,'load');listeners.add(fn)},removeEventListener:(type,fn)=>listeners.delete(fn),load:()=>{for(const fn of [...listeners])fn()}}
    f.contentWindow={postMessage:(data,origin)=>events.push({kind:'command',frame:f,data,origin})};return f
  }
  const props={isOpen:true,onClose:()=>{closed++},iframeRef:{current:frame()},viewerOrigin:'https://configured.local',currentSlide:2,totalSlides:6,presentationId:'owned-A'}
  const react={
    useState(initial){const name=names[stateCursor++],i=cursor++;assert.ok(name,'Actual named state');if(!(name in state))state[name]=typeof initial==='function'?initial():initial;if(!slots[i])slots[i]={setter:value=>{const next=typeof value==='function'?value(state[name]):value;if(!Object.is(state[name],next)){state[name]=next;dirty=true}}};return[state[name],slots[i].setter]},
    useRef(initial){const i=cursor++;return slots[i]??=( {current:initial} )},
    useCallback(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))slots[i]={fn,deps};return slots[i].fn},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps,effect:fn,cleanup:old?.cleanup};pending.set(i,fn)}},
  }
  const bridge={exports:{}};vm.runInNewContext(compile(bridgeSource),{module:bridge,exports:bridge.exports,URL})
  const imports={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'./studio-editor-dialogs.css':{},'./studio-master-panel.css':{},'lucide-react':new Proxy({},{get:(_,n)=>n}),'@/hooks/use-toast':{useToast:()=>({toast:data=>events.push({kind:'toast',data})})},'@/components/ui/button':{Button:'Button'},'@/components/ui/input':{Input:'Input'},'@/components/ui/label':{Label:'Label'},'@/lib/layout-viewer-messaging':bridge.exports}
  const mod={exports:{}}
  vm.runInNewContext(compile(code),{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag==='__absent__'?undefined:flag}},require:n=>{assert.ok(n in imports,n);return imports[n]},console:{error:(...data)=>events.push({kind:'log',data})},fetch:()=>assert.fail('No real network/file operation allowed'),window:{addEventListener:(type,fn)=>{assert.equal(type,'message');messages.add(fn)},removeEventListener:(type,fn)=>messages.delete(fn)},setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,time:now+ms});return id},clearTimeout:id=>timers.delete(id),Error,Set,WeakMap})
  const h={state,events,props,frame,
    render(overrides={},extra={}){Object.assign(state,overrides);Object.assign(props,extra);cursor=stateCursor=0;dirty=false;tree=mod.exports.PresentationSettingsPanel(props);return tree},
    get tree(){return tree},get closed(){return closed},
    async flush(){let idle=0;for(let n=0;n<100;n++){for(const[i,fn]of [...pending]){pending.delete(i);slots[i].cleanup?.();slots[i].cleanup=fn()}await Promise.resolve();if(dirty){h.render();idle=0}else if(!pending.size&&++idle>=12)return}assert.fail('Actual hook/effect work did not settle')},
    receipt(action,data={},f=props.iframeRef.current,origin=new URL(f.src).origin){for(const fn of [...messages])fn({source:f.contentWindow,origin,data:{action,...data}})},
    async read(data=null){h.receipt('getDerivativeElements',{success:true,derivativeElements:data});await h.flush();return tree},
    commands(action){return events.filter(e=>e.kind==='command'&&(!action||e.data.action===action))},
    button(label){const b=nodes(tree).find(n=>n.type==='Button'&&textOf(n)===label);assert.ok(b,label);return b},
    field(id){const f=nodes(tree).find(n=>n.props.id===id);assert.ok(f,id);return f},
    edit(id,value){h.field(id).props.onChange({target:{value}});h.render()},
    async tick(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!due)break;now=due[1].time;timers.delete(due[0]);due[1].fn();await h.flush()}now=end;await h.flush()},
    async start(){h.render();await h.flush();return h},
    unmount(){for(const s of slots)s?.cleanup?.();pending.clear()},
    async replayEffects(){for(const s of slots)s?.cleanup?.();slots.forEach((s,i)=>{if(s?.effect){s.cleanup=undefined;pending.set(i,s.effect)}});await h.flush()},
  };return h
}
const populated={footer:{template:'{title} | Page {page}',values:{title:'Loaded title',date:'Loaded date',author:'Loaded author'}},logo:{image_url:'https://example.invalid/kept-logo.svg',alt_text:'Loaded alt'}}
let cases=0
const check=async(label,fn)=>{await fn();cases++;console.log('PASS '+label)}
const ready=async(flag='true',data=populated,code=source)=>{const h=await fixture(flag,code).start();assert.equal(h.commands('getDerivativeElements').length,1);await h.read(data);return h}
await check('Unknown/refused settings visibly fail; displayed and actual Save/Clear/preview admission is guarded',async()=>{
 const h=await fixture().start();const save=h.button('Save').props.onClick,clear=h.button('Clear All Settings').props.onClick
 assert.equal(h.button('Save').props.disabled,true);assert.equal(h.button('Clear All Settings').props.disabled,true)
 await save();await clear();await h.tick(300);assert.equal(h.commands().length,1)
 h.receipt('getDerivativeElements',{success:false,error:'Supplied refused settings read'});await h.flush();assert.match(textOf(h.tree),/Supplied refused settings read/);assert.ok(nodes(h.tree).some(n=>n.props.role==='alert'));assert.match(textOf(h.tree),/Logo settings have not loaded/)
 h.edit('footer-template','Draft {title}');h.edit('footer-title','Unsent owned title');await h.button('Save').props.onClick();await h.button('Clear All Settings').props.onClick();await h.tick(300);assert.equal(h.commands().length,1)
 h.button('Cancel').props.onClick();assert.equal(h.closed,1)
})
await check('Retry actual read preserves touched fields and hydrates untouched server logo/author; ready gates reopen',async()=>{
 const h=await fixture().start();h.receipt('getDerivativeElements',{success:false,error:'Read failed'});await h.flush();h.edit('footer-title','Authored while unknown');h.button('Retry settings').props.onClick();await h.flush();assert.equal(h.commands('getDerivativeElements').length,2);await h.read(populated)
 assert.equal(h.field('footer-title').props.value,'Authored while unknown');assert.equal(h.field('footer-author').props.value,'Loaded author');assert.equal(h.field('logo-url').props.value,populated.logo.image_url);assert.equal(h.button('Save').props.disabled,false);assert.equal(h.button('Clear All Settings').props.disabled,false)
 await h.tick(300);assert.equal(h.commands('previewFooter').at(-1).data.params.footer.values.title,'Authored while unknown')
})
await check('Successful native null and empty object are known empty, not a failure or fabricated configuration',async()=>{
 for(const data of [null,{}]){const h=await ready('true',data);assert.equal(h.field('footer-template').props.value,'');assert.match(textOf(h.tree),/No logo configured/);assert.equal(h.button('Clear All Settings').props.disabled,false);assert.equal(h.button('Save').props.disabled,true)}
})
await check('Incomplete success receipt stays unknown and cannot admit destructive commands',async()=>{
 for(const data of [undefined,[],42]){const h=await fixture().start();h.receipt('getDerivativeElements',{success:true,derivativeElements:data});await h.flush();assert.ok(nodes(h.tree).some(n=>n.props.role==='alert'));await h.button('Clear All Settings').props.onClick();assert.equal(h.commands().length,1)}
})
await check('Retrying failed same-owner reads retains confirmed values and newer authored draft through recovery',async()=>{
 const h=await ready();h.edit('footer-title','Before retry draft');h.render({}, {isOpen:false});await h.flush();h.render({}, {isOpen:true});await h.flush();assert.equal(h.commands('getDerivativeElements').length,2);h.receipt('getDerivativeElements',{success:false,error:'Reopen read failed'});await h.flush();assert.equal(h.field('footer-title').props.value,'Before retry draft');assert.equal(h.field('logo-url').props.value,populated.logo.image_url);h.button('Retry settings').props.onClick();await h.flush();await h.read({...populated,footer:{...populated.footer,values:{title:'New remote title',author:'New untouched author'}}});assert.equal(h.field('footer-title').props.value,'Before retry draft');assert.equal(h.field('footer-author').props.value,'New untouched author')
})
await check('Same-window presentation switch drains older receipt before a fresh read; old record never hydrates new owner',async()=>{
 const h=await fixture().start();h.render({}, {presentationId:'owned-B'});await h.flush();assert.equal(h.commands('getDerivativeElements').length,1);await h.read(populated);assert.equal(h.commands('getDerivativeElements').length,2);assert.equal(h.state.footerTitle,'');await h.read({...populated,footer:{template:'B',values:{title:'Owner B'}}});assert.equal(h.field('footer-title').props.value,'Owner B')
})
await check('Iframe/source and close/reopen lifetimes retire late results and stale Save/Clear callbacks',async()=>{
 for(const mode of ['iframe','src','open']){
  const h=await ready();h.edit('footer-title','Owned A draft');const save=h.button('Save').props.onClick,clear=h.button('Clear All Settings').props.onClick
  h.render({}, {isOpen:false});await h.flush();h.render({}, {isOpen:true});await h.flush();const old=h.props.iframeRef.current
  if(mode==='iframe')h.props.iframeRef.current=h.frame('B')
  if(mode==='src')old.src='https://layout.local/v1/p/B'
  if(mode==='open'){h.render({}, {isOpen:false});await h.flush();h.render({}, {isOpen:true});await h.flush()}
  if(mode!=='open'){h.render({}, {presentationId:'owned-B'});await h.flush()}
  await save();await clear();assert.equal(h.commands('updateDerivativeElements').length,0);assert.equal(h.commands('clearDerivativeElements').length,0)
  h.receipt('getDerivativeElements',{success:true,derivativeElements:populated},old);await h.flush()
  if(mode==='iframe'){await h.read({footer:{template:'B',values:{title:'New frame'}}});assert.equal(h.field('footer-title').props.value,'New frame')}
  else {assert.equal(h.button('Save').props.disabled,true);await h.read(mode==='src'?{footer:{template:'B',values:{title:'New src'}}}:populated);assert.equal(h.field('footer-title').props.value,mode==='src'?'New src':'Owned A draft')}
 }
})
await check('Untrusted origin/window receipts cannot fulfill the actual read; trusted native ACK remains required',async()=>{
 const h=await fixture().start();h.receipt('getDerivativeElements',{success:true,derivativeElements:populated},h.props.iframeRef.current,'https://other.invalid');h.receipt('getDerivativeElements',{success:true,derivativeElements:populated},h.frame('foreign'));await h.flush();assert.equal(h.button('Clear All Settings').props.disabled,true);await h.read();assert.equal(h.button('Clear All Settings').props.disabled,false)
})
await check('Timed-out unversioned read is quarantined; late receipt only drains it, fresh retry/load can recover',async()=>{
 const h=await fixture().start();await h.tick(10000);assert.match(textOf(h.tree),/Reload the presentation/);h.button('Retry settings').props.onClick();await h.flush();assert.equal(h.commands('getDerivativeElements').length,1);await h.read(populated);assert.equal(h.state.footerTitle,'');h.button('Retry settings').props.onClick();await h.flush();assert.equal(h.commands('getDerivativeElements').length,2);await h.read();assert.equal(h.button('Clear All Settings').props.disabled,false)
 const other=await fixture().start();await other.tick(10000);other.props.iframeRef.current.load();await other.flush();assert.equal(other.commands('getDerivativeElements').length,2);await other.read();assert.equal(other.button('Clear All Settings').props.disabled,false)
})
await check('Unmount and Strict Mode effect replay cannot apply an old read or overlap fresh reads',async()=>{
 const h=await fixture().start();h.unmount();await h.read(populated);assert.equal(h.state.footerTitle,'')
 const replay=await fixture().start();await replay.replayEffects();assert.equal(replay.commands('getDerivativeElements').length,1);await replay.read(populated);assert.equal(replay.state.footerTitle,'');assert.equal(replay.commands('getDerivativeElements').length,2);await replay.read(populated);assert.equal(replay.field('footer-title').props.value,'Loaded title')
})
await check('Known Save/Clear retain exact payloads and ACK/refusal semantics; late acknowledgements keep newer drafts',async()=>{
 for(const action of ['Save','Clear All Settings']){
  const h=await ready();h.edit('footer-title','Edited title');const pending=h.button(action).props.onClick();await h.flush();const command=h.commands(action==='Save'?'updateDerivativeElements':'clearDerivativeElements').at(-1);assert.equal(command.data.params.presentationId,'owned-A');assert.equal(command.origin,'https://layout.local')
  if(action==='Save'){assert.equal(command.data.params.footer.values.title,'Edited title');assert.equal(command.data.params.logo.image_url,populated.logo.image_url)}else assert.deepEqual(JSON.parse(JSON.stringify(command.data.params)),{presentationId:'owned-A',clearFooter:true,clearLogo:true})
  h.receipt(command.data.action,{success:false,error:'Supplied refused write'});await pending;await h.flush();assert.equal(h.field('footer-title').props.value,'Edited title');assert.equal(h.state.hasChanges,true);assert.equal(h.closed,0)
  const pending2=h.button(action).props.onClick();await h.flush();h.render({isLoading:false});h.edit('footer-title','Newer unsent title');h.receipt(command.data.action,{success:true});await pending2;await h.flush();assert.equal(h.field('footer-title').props.value,'Newer unsent title');assert.equal(h.state.hasChanges,true);assert.equal(h.closed,0)
 }
 const h=await ready();h.edit('footer-title','Saved title');const saved=h.button('Save').props.onClick();h.receipt('updateDerivativeElements',{success:true});await saved;await h.flush();assert.equal(h.closed,1);assert.equal(h.state.hasChanges,false);assert.equal(h.events.filter(e=>e.kind==='toast').at(-1).data.title,'Settings saved')
 const cleared=await ready();const pending=cleared.button('Clear All Settings').props.onClick();cleared.receipt('clearDerivativeElements',{success:true});await pending;await cleared.flush();assert.equal(cleared.state.footerTitle,'');assert.equal(cleared.state.logoUrl,'');assert.equal(cleared.events.filter(e=>e.kind==='toast').at(-1).data.title,'Settings cleared')
})
await check('Late preview receipt cannot overwrite a newer edited draft or a different lifetime',async()=>{
 const h=await ready();await h.tick(300);h.edit('footer-title','Newer preview title');h.receipt('previewFooter',{success:true,previewText:'Stale preview'});await h.flush();assert.notEqual(h.state.previewText,'Stale preview');await h.tick(300);h.receipt('previewFooter',{success:true,previewText:'Current exact preview'});await h.flush();assert.equal(h.state.previewText,'Current exact preview')
})
const reopenedWrite = async (code=source) => {
 for(const action of ['Save','Clear All Settings']){
  const wire=action==='Save'?'updateDerivativeElements':'clearDerivativeElements'
  const h=await ready('true',populated,code);h.edit('footer-title','Kept reopen draft');const first=h.button(action).props.onClick();await h.flush()
  h.render({}, {isOpen:false});await h.flush();h.render({}, {isOpen:true});await h.flush();await h.read(populated)
  assert.equal(h.state.isSaving,false);assert.equal(h.state.isLoading,false);assert.equal(h.field('footer-title').props.value,'Kept reopen draft')
  const second=h.button(action).props.onClick();await h.flush();assert.equal(h.commands(wire).length,1,'New lifetime waits for retired write')
  h.receipt(wire,{success:true});await first;await h.flush();assert.equal(h.commands(wire).length,2);assert.equal(h.closed,0);assert.equal(h.state.hasChanges,true)
  assert.equal(h.events.filter(e=>e.kind==='toast').length,0,'Retired write is not acknowledged in reopened UI')
  h.receipt(wire,{success:true});await second;await h.flush();assert.equal(h.state.isSaving,false);assert.equal(h.state.isLoading,false);assert.equal(h.closed,action==='Save'?1:0)
 }
}
await check('Pending Save/Clear close and same-owner reopen recover busy UI, preserve draft and wait for a distinct fresh ACK',reopenedWrite)
const switchedWrite = async (code=source) => {
 for(const pair of [['Save','Save'],['Clear All Settings','Clear All Settings'],['Save','Clear All Settings'],['Clear All Settings','Save']]){
  const wire=label=>label==='Save'?'updateDerivativeElements':'clearDerivativeElements'
  const h=await ready('true',populated,code);h.edit('footer-title','Owner A draft');const first=h.button(pair[0]).props.onClick();await h.flush()
  h.render({}, {presentationId:'owned-B'});await h.flush();await h.read(populated);h.edit('footer-title','Owner B draft');const second=h.button(pair[1]).props.onClick();await h.flush()
  assert.equal(h.commands().filter(e=>['updateDerivativeElements','clearDerivativeElements'].includes(e.data.action)).length,1,'Shared write lane prevents old ACK from fulfilling a new owner')
  h.receipt(wire(pair[0]),{success:true});await first;await h.flush();const commands=h.commands().filter(e=>['updateDerivativeElements','clearDerivativeElements'].includes(e.data.action));assert.equal(commands.length,2);assert.equal(commands[1].data.params.presentationId,'owned-B')
  assert.equal(h.closed,0);assert.equal(h.state.hasChanges,true);assert.equal(h.events.filter(e=>e.kind==='toast').length,0)
  h.receipt(wire(pair[1]),{success:true});await second;await h.flush();assert.equal(h.events.filter(e=>e.kind==='toast').length,1)
 }
}
await check('Same-window A→B Save/Clear writes serialize; old native ACK cannot close, clear or toast B',switchedWrite)
await check('Write admission prevents same-lifetime double callbacks and retires queued newer-draft writes before dispatch',async()=>{
 const h=await ready();h.edit('footer-title','A draft');const first=h.button('Save').props.onClick();await h.flush();const double=h.button('Clear All Settings').props.onClick();await double;assert.equal(h.commands('clearDerivativeElements').length,0)
 h.render({}, {presentationId:'owned-B'});await h.flush();await h.read(populated);h.edit('footer-title','B queued draft');const second=h.button('Save').props.onClick();await h.flush();h.edit('footer-title','B newer draft');h.receipt('updateDerivativeElements',{success:true});await first;await second;await h.flush();assert.equal(h.commands('updateDerivativeElements').length,1);assert.equal(h.field('footer-title').props.value,'B newer draft');assert.equal(h.state.hasChanges,true);assert.equal(h.closed,0);assert.equal(h.state.isSaving,false);assert.equal(h.events.filter(e=>e.kind==='toast').length,0)
})
await check('Timed-out Save/Clear lanes quarantine late replies until drained; trusted ACK and viewer load remain required',async()=>{
 for(const action of ['Save','Clear All Settings']){
  const wire=action==='Save'?'updateDerivativeElements':'clearDerivativeElements',h=await ready();h.edit('footer-title','A draft');const first=h.button(action).props.onClick();await h.flush();await h.tick(10000);await first;assert.equal(h.commands(wire).length,1)
  assert.match(h.events.filter(e=>e.kind==='toast').at(-1).data.description,/Reload the presentation before retrying settings/,'Current timeout must display recovery instruction')
  const blocked=h.button(action).props.onClick();await h.flush();await blocked;assert.equal(h.commands(wire).length,1);assert.equal(h.closed,0);assert.equal(h.state.hasChanges,true)
  assert.match(h.events.filter(e=>e.kind==='toast').at(-1).data.description,/Reload the presentation before retrying settings/,'Quarantined retry must display recovery instruction')
  h.receipt(wire,{success:true},h.props.iframeRef.current,'https://foreign.invalid');await h.flush();const stillBlocked=h.button(action).props.onClick();await h.flush();await stillBlocked;assert.equal(h.commands(wire).length,1)
  h.receipt(wire,{success:true});await h.flush();assert.equal(h.closed,0);assert.equal(h.state.hasChanges,true)
  const fresh=h.button(action).props.onClick();await h.flush();assert.equal(h.commands(wire).length,2);h.receipt(wire,{success:false,error:'Fresh native refusal'});await fresh;await h.flush();assert.equal(h.state.hasChanges,true)
  const timed=h.button(action).props.onClick();await h.flush();await h.tick(10000);await timed;h.props.iframeRef.current.load();await h.flush();await h.read(populated);const loaded=h.button(action).props.onClick();await h.flush();assert.equal(h.commands(wire).length,4);h.receipt(wire,{success:true});await loaded;await h.flush()
 }
})
await check('Old same-window preview drains before new-owner preview dispatch and cannot populate its current UI',async()=>{
 const h=await ready();await h.tick(300);assert.equal(h.commands('previewFooter').length,1);h.render({}, {presentationId:'owned-B'});await h.flush();await h.read(populated);h.edit('footer-title','B preview');await h.tick(300);assert.equal(h.commands('previewFooter').length,1);h.receipt('previewFooter',{success:true,previewText:'Old A preview'});await h.flush();assert.notEqual(h.state.previewText,'Old A preview');assert.equal(h.commands('previewFooter').length,2);h.receipt('previewFooter',{success:true,previewText:'B current preview'});await h.flush();assert.equal(h.state.previewText,'B current preview')
})
const templates=['Page {page}','Page {page} of {total}','{title} | Page {page}','{title} | {date} | Page {page}'],labels=['Page only','Page X of Y','Title + Page','Professional']
// Preserve all original local options/fields/reveal/pressed/busy assertions, now
// after the actual successful settings ACK instead of fabricated unknown state.
for(const flag of ['true','false','TRUE',''])await check('Original successful-control preservation '+JSON.stringify(flag),async()=>{
 const test=await ready(flag,null)
 for(const selected of ['',...templates,'Custom {author} footer']){
  const tree=test.render({footerTemplate:selected});const presets=nodes(tree).filter(n=>n.key&&templates.includes(n.key));assert.equal(presets.length,4);assert.deepEqual(presets.map(textOf),labels);assert.deepEqual(presets.map(n=>n.key),templates);assert.deepEqual(presets.map(n=>n.props['aria-pressed']),templates.map(v=>flag==='true'?v===selected:undefined));assert.deepEqual(presets.map(n=>n.props['data-studio-master-preset']),templates.map(v=>flag==='true'?v:undefined))
  for(const[index,preset]of presets.entries()){preset.props.onClick();assert.equal(test.state.footerTemplate,templates[index]);assert.equal(test.state.hasChanges,true)}
 }
 const fullPreview='Synthetic complete footer '+'VeryLongUnbrokenLocalTitle'.repeat(40)+' END OF PREVIEW',fullName='Synthetic-'+'complete-original-logo-filename-'.repeat(12)+'END.svg'
 let tree=test.render({isLoading:false,isSaving:false,hasChanges:false,previewText:fullPreview,logoUrl:'data:image/svg+xml,<svg/>',logoFileName:fullName,logoAltText:'Exact local alt text',footerTitle:'Native title',footerDate:'Native date',footerAuthor:'Native author'});assert.equal(nodes(tree).find(n=>textOf(n)===fullPreview).props.children,fullPreview);assert.ok(nodes(tree).find(n=>textOf(n)===fullName));assert.equal(nodes(tree).find(n=>n.type==='img').props.alt,'Exact local alt text');const fields=nodes(tree).filter(n=>n.type==='Input');assert.deepEqual(fields.map(n=>n.props.id),['footer-template','footer-title','footer-date','footer-author','logo-url','logo-alt']);assert.equal(fields.find(n=>n.props.id==='footer-title').props.value,'Native title');fields.find(n=>n.props.id==='footer-author').props.onChange({target:{value:'Revised author locally'}});assert.equal(test.state.footerAuthor,'Revised author locally');assert.equal(test.state.hasChanges,true);nodes(tree).find(n=>n.type==='Button'&&textOf(n)==='Generate').props.onClick();tree=test.render();assert.equal(nodes(tree).find(n=>n.props.id==='logo-prompt').props.value,'');assert.equal(test.button('Generate Logo').props.disabled,true);tree=test.render({logoPrompt:'Synthetic local prompt',isGeneratingLogo:true});assert.equal(nodes(tree).find(n=>n.type==='Button'&&textOf(n).includes('Generating...')).props.disabled,true);assert.equal(nodes(tree).find(n=>n.props.type==='file').props.accept,'image/*');assert.equal(tree.props.role,'dialog');assert.equal(tree.props['aria-modal'],'false');assert.equal(tree.props['aria-label'],'Footer and logo');assert.equal(test.render({}, {isOpen:false}),null)
})
for(const flag of ['true','false'])for(const state of [{isLoading:true},{isSaving:true},{isLoading:true,isSaving:true},{hasChanges:true}])await check('Original busy gates plus Studio usable Cancel '+flag+' '+JSON.stringify(state),async()=>{
 const h=await ready(flag,null);h.render(state);assert.equal(h.button('Clear All Settings').props.disabled,Boolean(state.isLoading||state.isSaving));assert.equal(h.button('Cancel').props.disabled,flag==='true'?false:Boolean(state.isSaving));const save=nodes(h.tree).find(n=>n.type==='Button'&&(textOf(n)==='Save'||textOf(n).includes('Saving...')));assert.equal(save.props.disabled,Boolean(state.isSaving||!state.hasChanges));const close=nodes(h.tree).find(n=>n.props['data-studio-master-part']==='close');if(flag==='true'){assert.equal(close.props['aria-label'],'Close footer and logo panel');assert.equal(close.props.disabled,undefined);close.props.onClick();assert.equal(h.closed,1)}if(state.isLoading){assert.equal(nodes(h.tree).some(n=>n.type==='Input'),false);if(flag==='true')assert.equal(nodes(h.tree).find(n=>n.props.role==='status').props['aria-label'],'Loading footer and logo controls')}
})
for(const flag of ['__absent__','false','TRUE','1',''])await check('Exact classic/default-off tree and native callback/command behavior '+JSON.stringify(flag),async()=>{
 const h=await fixture(flag).start(),old=await fixture(flag,prior).start();assert.equal(rendered(h.tree),rendered(old.tree));await h.read(populated);await old.read(populated);assert.equal(rendered(h.tree),rendered(old.tree));h.edit('footer-title','Same classic draft');old.edit('footer-title','Same classic draft');assert.equal(rendered(h.tree),rendered(old.tree));await h.tick(300);await old.tick(300);assert.equal(JSON.stringify(h.commands().map(e=>[e.data,e.origin])),JSON.stringify(old.commands().map(e=>[e.data,e.origin])));h.receipt('previewFooter',{success:false,error:'Same native fallback'});old.receipt('previewFooter',{success:false,error:'Same native fallback'});await h.flush();await old.flush();assert.equal(rendered(h.tree),rendered(old.tree));const save=h.button('Save').props.onClick(),priorSave=old.button('Save').props.onClick();h.receipt('updateDerivativeElements',{success:false,error:'Refused classic Save'});old.receipt('updateDerivativeElements',{success:false,error:'Refused classic Save'});await save;await priorSave;await h.flush();await old.flush();assert.equal(rendered(h.tree),rendered(old.tree));assert.equal(h.closed,old.closed)
 const clear=h.button('Clear All Settings').props.onClick(),priorClear=old.button('Clear All Settings').props.onClick();h.receipt('clearDerivativeElements',{success:false,error:'Specific native Clear error'});old.receipt('clearDerivativeElements',{success:false,error:'Specific native Clear error'});await clear;await priorClear;await h.flush();await old.flush();assert.equal(rendered(h.tree),rendered(old.tree));assert.equal(h.events.filter(e=>e.kind==='toast').at(-1).data.description,'Failed to clear settings');assert.equal(JSON.stringify(h.events.filter(e=>e.kind==='toast').at(-1).data),JSON.stringify(old.events.filter(e=>e.kind==='toast').at(-1).data))
})

await check('Native populated logo filename fallback remains exact',async()=>{
 const h=await ready('true',{logo:{image_url:'https://example.invalid/path/'}});assert.equal(h.state.logoFileName,'logo.png')
})
await check('Negative actual-source mutations reject dropped admission, hidden failure, draft overwrite and late-owner hydration',async()=>{
 const admission=async(code)=>{const h=await fixture('true',code).start();h.receipt('getDerivativeElements',{success:false,error:'Read refused'});await h.flush();h.edit('footer-template','Draft');void h.button('Save').props.onClick();await h.flush();assert.equal(h.commands('updateDerivativeElements').length,0)}
 await assert.rejects(()=>admission(source.replaceAll('!studioKnown()', 'false').replaceAll('() => studioKnown()', '() => true')),assert.AssertionError)
 const visible=async(code)=>{const h=await fixture('true',code).start();h.receipt('getDerivativeElements',{success:false,error:'Read refused'});await h.flush();assert.ok(nodes(h.tree).some(n=>n.props.role==='alert'))}
 await assert.rejects(()=>visible(source.replace("status: 'error', error: error instanceof Error", "status: 'ready', error: error instanceof Error")),assert.AssertionError)
 const draft=async(code)=>{const h=await fixture('true',code).start();h.receipt('getDerivativeElements',{success:false,error:'Read refused'});await h.flush();h.edit('footer-title','Keep unsent');h.button('Retry settings').props.onClick();await h.flush();await h.read(populated);assert.equal(h.field('footer-title').props.value,'Keep unsent')}
 await assert.rejects(()=>draft(source.replace('if (!studioDraft.current.fields.has(field)) setters[field](values[field])','setters[field](values[field])')),assert.AssertionError)
 const owner=async(code)=>{const h=await fixture('true',code).start();h.render({}, {presentationId:'owned-B'});await h.flush();await h.read(populated);assert.equal(h.state.footerTitle,'')}
 await assert.rejects(()=>owner(source.replace('if (!studioIsCurrent() || studioReadSequence.current !== sequence) return','if (false) return')),assert.AssertionError)
})
await check('Negative actual-source mutations reproduce stuck reopened busy state and overlapping old/new ACK consumption',async()=>{
 const stuck=source.replace('    studioPendingWrite.current = null\n    setIsSaving(false); setIsLoading(false); setIsGeneratingLogo(false)','    studioPendingWrite.current = null')
 assert.notEqual(stuck,source);await assert.rejects(()=>reopenedWrite(stuck),assert.AssertionError)
 const overlapping=source.replace('const previous = lanes.get(lane)','const previous = undefined')
 assert.notEqual(overlapping,source);await assert.rejects(()=>switchedWrite(overlapping),assert.AssertionError)
})
const nativeBridge = code=>code.slice(code.indexOf('  const sendCommand ='),code.indexOf('  }, [iframeRef, viewerOrigin])')+'  }, [iframeRef, viewerOrigin])'.length)
assert.equal(nativeBridge(source),nativeBridge(prior),'General native command bridge remains byte-exact')
console.log(JSON.stringify({passed:true,cases,negativeMutations:6,baseline,generalBridgeByteExact:true,scope:'Actual local leaf/normal command receipts, no real iframe/browser/service writes. All original control assertions retained after successful ACK; classic behavior compared against exact predecessor. Rendered geometry and native transport remain lead proof.'}))
