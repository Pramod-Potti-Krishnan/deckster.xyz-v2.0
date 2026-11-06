"""Actual frontend + exact local read fixtures. Writes fail; no service traffic escapes."""
import argparse,asyncio,json,hashlib,subprocess,importlib.util,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright,expect
from capture import ROOT,BASE,USER,NOW,SLIDES,PRESETS_URL,required,socket_kind
spec=importlib.util.spec_from_file_location('previous',ROOT/'scripts/studio-v4/capture-next.py');previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
SESSION=previous.SESSION;VIEWER=previous.VIEWER
WAITING_SESSION='22222222-2222-4222-8222-222222222222'
MASTER_LOGO='https://fixtures.invalid/master-logo/'+('full-returned-logo-file-name-'*7)+'local.png'
PUBLISHED={'id':'fixture-published','slug':'fixture-shared-deck','sessionId':SESSION,'sourcePresentationId':'studio-v4-local-renderer','snapshotPresentationId':'fixture-snapshot','title':'Quarterly strategy','slideCount':2,'visibility':'unlisted','hasPasscode':False,'allowPdf':True,'allowPptx':True,'viewCount':0,'publishedAt':NOW,'republishedAt':None,'revokedAt':None,'sourceUpdatedAt':None,'publicUrl':'https://fixtures.invalid/p/fixture-shared-deck','qaEnabled':True,'qaCorpusStatus':'ready','qaDailyCap':20,'qaMonthlyCap':100,'qaVisitorBurstLimit':10,'qaVisitorDailyLimit':40,'qaTonePreset':'professional','qaToneInstruction':None,'qaCiteWebSources':False,'qaAutoAnswer':True,'narrationEnabled':True,'narrationBudgetMinutes':5,'qaReserveMinutes':1}
HTML=previous.fixture_html.replace("if(!d||typeof d.action!=='string'||typeof d.requestId!=='string')return;", "if(!d||typeof d.action!=='string')return;")
HTML=HTML.replace("const allowed=['getCurrentSlideInfo','getTemplateSlotCatalog'].includes(d.action);", "if(d.action==='getDerivativeElements'){window.fixtureRequests.push({action:d.action,allowed:true});parent.postMessage({action:d.action,success:true,derivativeElements:{footer:{template:'{title} | {author} | Page {page}',values:{title:'Quarterly strategy',author:'Local reviewer'}},logo:{image_url:null}}},e.origin);return;}const allowed=['getCurrentSlideInfo','getTemplateSlotCatalog'].includes(d.action);")
# The specimen is explicitly synthetic. Keep original trusted, read-only bridge script.
script=HTML[HTML.index('<script>'):]
HTML='''<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Arial,sans-serif;background:#f7f9f3;color:#27463b;padding:6%;position:relative}.eyebrow{font-size:2.1vw;letter-spacing:.16em;color:#6a8a75}h1{font:500 6vw/1.05 Georgia,serif;letter-spacing:-.025em;margin:4% 0 5%}.content{display:flex;gap:5%;align-items:end}.copy{width:48%;font-size:2.35vw;line-height:1.6;color:#657e6f}.chart{display:flex;gap:8%;align-items:end;width:40%;height:20vh}.bar{background:#397f72;width:20%;border-radius:4px 4px 0 0}.bar:nth-child(2){background:#6e9a82}.bar:nth-child(3){background:#b3c6a4}footer{position:absolute;bottom:5%;left:6%;right:6%;border-top:1px solid #d6e1d5;padding-top:2%;display:flex;justify-content:space-between;font-size:1.5vw;color:#819283}</style></head><body><span class="eyebrow">QUARTERLY STRATEGY · A SHARED DIRECTION</span><h1>Make the next<br>decision clear.</h1><div class="content"><p class="copy">Connect the priorities.<br>Make the trade-offs visible.<br>Move forward with confidence.</p><div class="chart" aria-label="Illustrative chart"><div class="bar" style="height:45%"></div><div class="bar" style="height:70%"></div><div class="bar" style="height:100%"></div></div></div><footer><span>Local slide specimen · visual review only</span><span>01 / 02</span></footer>'''+script
ACTION={'id':'fixture-action','messageType':'action_request','timestamp':NOW,'payload':{'prompt_text':'What should this presentation help your audience decide?','actions':[{'label':'Align on priorities','value':'align_priorities','primary':True,'requires_input':False},{'label':'Review progress','value':'review_progress','primary':False,'requires_input':False},{'label':'Something else','value':'clarify_goal','primary':False,'requires_input':True}]}}
QUESTIONS={'id':'fixture-questions','messageType':'action_request','timestamp':NOW,'payload':{'prompt_text':'Two details before we start.','actions':[],'question_set':{'id':'fixture-set','intro':'Let’s shape the story together.','questions':[{'id':'audience','text':'Who is this for?','suggestions':[{'label':'Leadership','recommended':True},{'label':'Working team'}],'allow_free_text':True},{'id':'outcome','text':'What should they take away?','suggestions':[{'label':'A decision'},{'label':'A shared direction'}],'allow_free_text':True}]}}}
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--area',choices=['studio','workspaces','delivery','asks','fresh','manage','navigation','intelligence','templates','knowledge','controls','presentation','composer','authoring','template-flows','template-params','outline','published','knowledge-settings','owner-inbox','generation-forms','appearance','guide','profile','notifications','privacy','security','continuation','notes','help','build-status','billing','usage','specialist-forms','file-details','stage-placeholder','session-history','manual-deck-conflict','generation-feedback','theme-panel','theme-states','director','rollback','slide-options','template-metadata','master','edit-guide','composer-library','deck-identity','director-presence','toolbar-save','arrange','theme-support','thumbnail-failure','mention-titles','director-code','waiting','waiting-native','theme-source','generation-cover','header-fit','pending-action','websocket-error','template-readiness','upload-status','version-state','narrow-workspace','narrow-stage','format-failures','publish-drafts','add-element-entry','ownership-smoke','toolbar-fit'],required=True);parser.add_argument('--question-failure-check',action='store_true');parser.add_argument('--typed-cancel-check',action='store_true');parser.add_argument('--output-directory',type=Path);parser.add_argument('--toolbar-fit-after',action='store_true');args=parser.parse_args()
 if args.toolbar_fit_after and args.area!='toolbar-fit':parser.error('Toolbar fitting requires --area toolbar-fit')
 if (args.question_failure_check or args.typed_cancel_check) and args.area!='asks':parser.error('Director failure/cancel checks require --area asks')
 if args.question_failure_check and args.typed_cancel_check:parser.error('Use one focused Director check per run')
 final_out=args.output_directory or ROOT.parent/'studio-v4-ten-hour-captures-20261002'/args.area
 out=final_out/'runs'/uuid.uuid4().hex;out.mkdir(parents=True,exist_ok=False)
 workspace=json.loads((ROOT/'scripts/studio-v4/workspace-fixtures.json').read_text())
 if args.area=='template-readiness':
  optimization_error=('Exact locally returned optimization diagnostic. '*25)+'[OPTIMIZATION END]'
  cleanup_error=('Exact locally returned source-cleanup diagnostic. '*25)+'[CLEANUP END]'
  patch={'blueprint_enrichment_status':'failed','blueprint_enrichment_error':optimization_error,'template_purity_status':'failed','template_purity_error':cleanup_error}
  workspace['template'].update(patch);workspace['templates']['templates'][0].update(patch)
 if args.area=='theme-support':workspace['themes']['themes'][0]['description']=('Full returned theme description remains readable by keyboard. '*35)+'Description ending retained.'
 knowledge=json.loads((ROOT/'scripts/studio-v4/ten-hour-knowledge-fixture.json').read_text()) if args.area in ['knowledge','knowledge-settings'] else {}
 def source_hashes():
  names=subprocess.check_output(['git','diff','--name-only','d974036'],cwd=ROOT,text=True).splitlines()+subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines()
  names=[f for f in names if f.startswith(('app/','components/','hooks/','lib/','scripts/')) and '/__pycache__/' not in f and Path(f).suffix in ['.ts','.tsx','.css','.mjs','.js','.py','.json']]
  return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in sorted(set(names)) if (ROOT/f).is_file()}
 identity={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'preview_flags':{**json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text()),**json.loads((ROOT/'.env.studio-v4-runtime/preview-features.json').read_text())},'files':source_hashes()}


 # Preserve exact executable probe/imports and tracked working-tree provenance, never private runtime files.
 snapshots={}
 for name in ['capture-ten-hour.py','capture.py','capture-next.py','capture-populated.py','workspace-fixtures.json','preview.mjs']+(['ten-hour-knowledge-fixture.json'] if args.area in ['knowledge','knowledge-settings'] else []):
  source=ROOT/'scripts/studio-v4'/name;target=out/'probe-sources'/name
  target.parent.mkdir(parents=True,exist_ok=True);data=source.read_bytes();target.write_bytes(data)
  snapshots['probe-sources/'+name]=hashlib.sha256(data).hexdigest()
 patch=subprocess.check_output(['git','diff','HEAD','--','app','components','lib','scripts'],cwd=ROOT)
 (out/'source-working-tree.patch').write_bytes(patch)
 identity['probe_source_snapshots']=snapshots
 identity['working_tree_patch_sha256']=hashlib.sha256(patch).hexdigest()

 results=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch()
  fixture_areas=['published','build-status','usage','file-details','specialist-forms','stage-placeholder','manual-deck-conflict','generation-feedback','theme-states','edit-guide','director-presence','toolbar-save','arrange','thumbnail-failure','waiting','theme-source','generation-cover','websocket-error','upload-status','format-failures']
  fixture_name='file-details' if args.area=='upload-status' else 'specialist-forms' if args.area=='theme-source' else 'edit-mode-guide' if args.area=='edit-guide' else 'theme-panel' if args.area=='theme-states' else 'specialist-forms' if args.area=='generation-feedback' else args.area if args.area in fixture_areas else 'published'
  fixture_route=ROOT/f'app/studio-local-review/{fixture_name}/page.tsx'
  fixture_source=(ROOT/f'scripts/studio-v4/ten-hour-{fixture_name}-fixture.tsx').read_text()
  if args.area in fixture_areas:
   fixture_snapshot=out/'probe-sources'/('ten-hour-'+fixture_name+'-fixture.tsx')
   fixture_snapshot.write_text(fixture_source)
   identity['probe_source_snapshots']['probe-sources/'+fixture_snapshot.name]=hashlib.sha256(fixture_snapshot.read_bytes()).hexdigest()
   assert not fixture_route.exists(),'Do not replace another task route'
   fixture_route.parent.mkdir(parents=True,exist_ok=True);fixture_route.write_text(fixture_source)
   await asyncio.sleep(2) # Let Next register this disposable route before asserting its first response.
  try:
   cases=[('light-390x844',390,844,False),('dark-390x844',390,844,True)] if args.area=='narrow-stage' else [('light-390x844',390,844,False),('dark-390x844',390,844,True),('light-666x800-workspace600',666,800,False),('light-900x600-wide-parity',900,600,False)] if args.area=='narrow-workspace' else [('light-1440x600',1440,600,False)] if args.area=='fresh' else [('light-1440x900',1440,900,False),('dark-1030x600',1030,600,True),('light-900x600',900,600,False)] if args.area=='header-fit' else [('light-1440x900',1440,900,False),('dark-1030x600',1030,600,True)]+([('narrow-390x844',390,844,False)] if args.area in ['knowledge','published','knowledge-settings','appearance','guide','profile','notifications','privacy','security','help','build-status','billing','usage','stage-placeholder','manual-deck-conflict','theme-states','edit-guide','composer-library','deck-identity','director-presence','toolbar-save','arrange','thumbnail-failure','waiting','generation-cover','websocket-error','template-readiness','upload-status'] else [])
   if args.area=='toolbar-fit' and args.toolbar_fit_after:cases.append(('dark-1030x450-short',1030,450,True))
   if args.area=='format-failures':cases=[('light-1440x900',1440,900,False),('dark-1030x600',1030,600,True)]
   if args.typed_cancel_check:cases=[('dark-1030x600',1030,600,True)]
   for label,w,h,dark in cases:
    ctx=await browser.new_context(viewport={'width':w,'height':h},color_scheme='dark' if dark else 'light',service_workers='block');await ctx.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())])
    await ctx.add_init_script("if(location.origin==='"+BASE+"'){localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+");localStorage.setItem("+json.dumps('deckster:last_session_id:'+USER['id'])+","+json.dumps(SESSION)+");}")
    if args.area=='narrow-workspace':await ctx.add_init_script("if(location.origin==="+json.dumps(BASE)+"){localStorage.setItem('deckster_builder_chat_width','328');localStorage.setItem('deckster_builder_drawer_width','372');}")
    if args.area=='fresh':await ctx.add_init_script("if(location.origin==='"+BASE+"'){localStorage.removeItem("+json.dumps('deckster:last_session_id:'+USER['id'])+");Object.defineProperty(crypto,'randomUUID',{value:()=>"+json.dumps(SESSION)+"});}")
    auth_release=asyncio.Event();session_release=asyncio.Event();switch_release=asyncio.Event();theme_preview_release=asyncio.Event();theme_preview_started=asyncio.Event()
    errors=[];violations=[];reads=[];denied=[];blocked_sockets=[];shots={};checks={};proof_meta={};messages=[];refuse_detail=False;refuse_graph=False;refuse_settings=False;settings_subscribed=True;questions_enabled=True;refuse_inbox=False;refuse_preferences=False;help_signed_out=False;quota_flags={};profile_quota_unavailable=False;composer_library_mode='loaded'
    panel_release=asyncio.Event();panel_started=asyncio.Event();panel_finished=asyncio.Event();panel_requests=[]
    alternate_viewer=VIEWER.replace('studio-v4-local-renderer','studio-v4-local-renderer-B')
    format_failure=('Exact local native viewer refusal. '*35)+'[REFUSAL END]'
    publish_failure=('Exact local session-setting refusal. '*35)+'[SESSION REFUSAL END]'
    capture_html=HTML
    if args.area=='add-element-entry':
     capture_html=capture_html.replace('window.fixtureRequests=[];', 'window.fixtureRequests=[];window.fixtureResponses=[];')
     insertion_bridge="""if(d.action==='insertTextBox'){
       const params=d.params;window.fixtureRequests.push({action:d.action,requestId:d.requestId,params,allowed:true,localSupplied:true});
       const reply=()=>{window.fixtureResponses.push({requestId:d.requestId,componentType:params.componentType});parent.postMessage({action:d.action,requestId:d.requestId,success:true,elementId:'synthetic-local-'+params.elementId,themeVariantId:'local-response-variant',themeBindings:{text:'text-primary'}},e.origin);};
       if(params.componentType==='CHART')window.releaseHeldChartReceipt=reply;else setTimeout(reply,100);return;
     }"""
     capture_html=capture_html.replace("const allowed=['getCurrentSlideInfo','getTemplateSlotCatalog'].includes(d.action);", insertion_bridge+"const allowed=['getCurrentSlideInfo','getTemplateSlotCatalog'].includes(d.action);")
     capture_html=capture_html.replace('</footer>', '</footer><button style="position:fixed;top:8px;left:8px;padding:6px" onclick="if(window.releaseHeldChartReceipt){const reply=window.releaseHeldChartReceipt;window.releaseHeldChartReceipt=null;reply();}">Release older local Chart receipt</button>')
    if args.area=='format-failures':
     capture_html=capture_html.replace('{action:d.action,requestId:d.requestId,allowed}', '{action:d.action,requestId:d.requestId,allowed,params:d.params}')
     capture_html=capture_html.replace("error:'Read-only local fixture refuses this action'",'error:'+json.dumps(format_failure))
     capture_html=capture_html.replace(' parent.postMessage({action:d.action,requestId:d.requestId,success:allowed',' setTimeout(()=>parent.postMessage({action:d.action,requestId:d.requestId,success:allowed')
     capture_html=capture_html.replace('},e.origin);\n});','},e.origin),allowed?0:800);\n});')
    session={'id':SESSION,'userId':USER['id'],'title':'Quarterly strategy','createdAt':NOW,'updatedAt':NOW,'currentStage':6,'slideCount':2,'status':'active','messages':messages,'finalPresentationUrl':VIEWER,'finalPresentationId':'studio-v4-local-renderer','stateCache':{'activeVersion':'final','slideStructure':{'metadata':{'main_title':'Quarterly strategy','overall_theme':'Minimal','target_audience':'Leadership','presentation_duration':5},'slides':SLIDES}}}
    if args.area=='mention-titles':
     session['stateCache']['slideStructure']['slides']=[{**slide,'title':('Quarterly priorities and the complete next decision to review with the leadership team' if i==0 else 'Evidence and the full supporting context for the second decision')+' — '+('retained slide title detail ' * 3)} for i,slide in enumerate(SLIDES)]
    if args.area=='ownership-smoke':session.update({'strawmanPreviewUrl':alternate_viewer,'strawmanPresentationId':'studio-v4-local-renderer-B'})
    async def route(route):
     r=route.request;u=urlparse(r.url);path=u.path
     if args.area=='ownership-smoke' and r.method=='POST' and path=='/api/slides/compose':
      body=r.post_data_json
      assert not panel_requests and body['session_id']==SESSION and body['presentation_id']=='studio-v4-local-renderer' and body['assume_on_missing'] is False,body
      panel_requests.append(body);panel_started.set();await panel_release.wait()
      await route.fulfill(json={'status':'built','presentation_id':'studio-v4-local-renderer','presentation_url':VIEWER,'slide_index':2,'slides_built':3});panel_finished.set();return
     if args.area=='ownership-smoke' and r.method=='GET' and r.url==alternate_viewer:
      reads.append(r.url);await route.fulfill(content_type='text/html',body=HTML.replace('Local slide specimen','Local alternate slide specimen'));return
     if args.area=='ownership-smoke' and r.method=='GET' and r.url in [alternate_viewer.replace('/p/','/api/presentations/'),alternate_viewer.replace('/p/','/api/presentations/')+'/theme/css-variables']:
      reads.append(r.url);await route.fulfill(json={'css_variables':{}} if path.endswith('/theme/css-variables') else {'id':'studio-v4-local-renderer-B','slides':[{'slide_id':'fixture-B-1','slide_index':0,'slide_number':1,'title':'Alternate','layout':'L25','sections':[],'elements':[]},{'slide_id':'fixture-B-2','slide_index':1,'slide_number':2,'title':'Alternate evidence','layout':'L25','sections':[],'elements':[]}]},headers={'Access-Control-Allow-Origin':BASE});return
     if args.area=='publish-drafts' and r.method=='PATCH' and path=='/api/publish/fixture-shared-deck':
      body=r.post_data_json
      denied.append({'method':r.method,'path':path,'body':body,'scope':'Intercepted local response only; no persistence'})
      await asyncio.sleep(0.7)
      if body=={'narrationBudgetMinutes':10.9}:
       await route.fulfill(json={'deck':{**PUBLISHED,'narrationBudgetMinutes':10}});return
      assert body=={'narrationBudgetMinutes':9},body
      await route.fulfill(status=503,json={'error':publish_failure});return
     if args.area=='master' and r.method=='GET' and r.url==MASTER_LOGO:
      reads.append(r.url);await route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="48"><rect width="100" height="48" fill="#397f72"/><text x="8" y="29" fill="white">Local logo</text></svg>');return
     if args.area=='notes' and r.url==VIEWER.replace('/p/','/api/presentations/')+'/slides/local-slide-1/narration':
      cors={'Access-Control-Allow-Origin':BASE,'Access-Control-Allow-Methods':'PATCH, OPTIONS','Access-Control-Allow-Headers':'*'}
      if r.method=='OPTIONS':await route.fulfill(status=204,headers=cors);return
      if r.method=='PATCH':
       denied.append({'method':r.method,'path':path,'body':r.post_data_json})
       await route.fulfill(status=503,headers=cors,json={'error':'Local fixture refuses note saves.'});return
     if args.area=='generation-forms' and r.method=='GET' and r.url=='https://fixtures.invalid/source.svg':
      reads.append(r.url);await route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#dce9e3"/><text x="20" y="80" fill="#294139">Local image fixture</text></svg>');return
     if r.method=='GET' and (r.url==VIEWER or (args.area=='published' and r.url==VIEWER+'?viewOnly=true')):reads.append(r.url);await route.fulfill(content_type='text/html',body=HTML.replace('</footer>','</footer>'+previous.buttons.replace('display:flex;gap:8px;margin-top:12px','display:flex;gap:8px;position:fixed;top:8px;left:8px;z-index:10')) if args.area=='generation-forms' else HTML.replace('logo:{image_url:null}', 'logo:{image_url:'+json.dumps(MASTER_LOGO)+',alt_text:"Local returned logo specimen"}') if args.area=='master' else capture_html);return
     if args.area=='theme-source' and r.method=='GET' and r.url==VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables':
      reads.append(r.url);theme_preview_started.set();await theme_preview_release.wait();await route.fulfill(status=503,json={'error':'Local theme preview read refused.'},headers={'Access-Control-Allow-Origin':BASE});return
     if r.method=='GET' and r.url in [VIEWER.replace('/p/','/api/presentations/'),VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables']:
      data={'css_variables':{'--theme-text':'#27463b','--theme-background':'#f7f9f3'}} if path.endswith('/theme/css-variables') else {'id':'studio-v4-local-renderer','slides':[{'slide_id':'fixture-slide-1','slide_index':0,'slide_number':1,'title':'Overview','layout':'L25','sections':[],'elements':[]},{'slide_id':'fixture-slide-2','slide_index':1,'slide_number':2,'title':'Evidence','layout':'L25','sections':[],'elements':[]}]}
      if args.area=='notes' and not path.endswith('/theme/css-variables'):
       data['updated_at']=NOW
       for i,slide in enumerate(data['slides']):
        slide.update({'slide_id':SLIDES[i]['slide_id'],'script':'Bring the audience back to the decision. These are the spoken words for this slide.','speaker_notes':'Pause for questions, then point to the three priorities.','references':['Local source: quarterly strategy brief','Local source: decision review notes']})
      reads.append(r.url);await route.fulfill(json=data,headers={'Access-Control-Allow-Origin':BASE});return
     if args.area=='specialist-forms' and r.method=='GET' and r.url=='https://web-uat-19a9.up.railway.app/api/diagram/catalog':
      reads.append('Expected native versioned diagram fallback after local503');await route.fulfill(status=503,json={'error':'Local fixture uses the native versioned fallback'},headers={'Access-Control-Allow-Origin':BASE});return
     if r.method=='GET' and r.url==PRESETS_URL:reads.append(r.url);await route.fulfill(json={'presets':[{'id':'minimal','name':'Minimal','description':'Local preset','color_scheme':{'background':'#F7F9F3','text':'#27463B','accent':'#397F72'}}]});return
     if r.method=='GET' and r.url=='https://va.vercel-scripts.com/v1/script.debug.js':reads.append('blocked exact development analytics');await route.fulfill(content_type='application/javascript',body='/* Analytics disabled in isolated preview */');return
     if u.netloc!=urlparse(BASE).netloc:violations.append('External '+r.method+' '+r.url);await route.abort();return
     if r.method=='GET' and (path.startswith('/_next/') or path in ['/builder','/studio/templates','/studio/themes','/studio/details','/studio/intelligence','/dashboard','/knowledge','/settings/knowledge-graph','/settings/appearance','/settings/profile','/settings/notifications','/settings/privacy','/settings/security','/help','/billing'] or (args.area in fixture_areas and path=='/studio-local-review/'+fixture_name) or path.startswith('/logo-') or path.endswith(('.png','.svg','.ico','.woff2'))):await route.continue_();return
     if r.method=='POST' and path=='/__nextjs_original-stack-frames':await route.continue_();return
     if r.method!='GET':
      if args.area=='usage' and r.method=='POST' and path=='/api/stripe/create-topup-session':
       denied.append({'method':r.method,'path':path,'body':r.post_data_json});await asyncio.sleep(1.8);await route.fulfill(status=503,json={'error':'Local fixture refuses checkout. No purchase or redirect occurred.'});return
      if args.area=='owner-inbox' and r.method=='POST' and path=='/api/publish/fixture-shared-deck/questions/fixture-deferred/answer':
       denied.append({'method':r.method,'path':path,'body':r.post_data_json});await route.fulfill(status=503,json={'error':'Local fixture refuses answers; keep your draft.'});return
      if args.area in ['notifications','privacy'] and r.method=='PATCH' and path=='/api/preferences':
       denied.append({'method':r.method,'path':path,'body':r.post_data_json});await route.fulfill(status=503,json={'error':'Local fixture refuses preference changes.'});return
      if args.area=='profile' and r.method=='POST' and path=='/api/profile/avatar':
       denied.append({'method':r.method,'path':path,'fixture':'local PNG avatar'});await route.fulfill(status=503,json={'error':'Local fixture refuses avatar changes.'});return
      if args.area=='knowledge-settings' and r.method=='POST' and path in ['/api/knowledge-graph/subscribe','/api/knowledge-graph/unsubscribe']:
       denied.append({'method':r.method,'path':path,'body':r.post_data_json});await route.fulfill(status=503,json={'error':'Local fixture refuses consent changes.'});return
      if args.area=='published' and r.method=='POST' and path in ['/api/publish/fixture-shared-deck/ask','/api/publish/fixture-shared-deck/unlock']:
       denied.append({'method':r.method,'path':path,'body':r.post_data_json});await route.fulfill(status=401 if path.endswith('/unlock') else 503,json={'error':'Local component fixture refuses writes.'});return
      if (path=='/api/profile' and r.method=='PATCH') or (args.area=='delivery' and path=='/api/publish' and r.method=='POST') or (args.area=='fresh' and path=='/api/sessions' and r.method=='POST') or (args.area in ['asks','outline'] and path==f'/api/sessions/{SESSION}/messages' and r.method=='POST') or (args.area=='template-flows' and path=='/api/templates' and r.method=='POST') or (args.area in ['navigation','session-history'] and path==f'/api/sessions/{SESSION}' and r.method=='DELETE'):denied.append({'method':r.method,'path':path,'body':r.post_data_json});await route.fulfill(status=503,json={'error':'Local fixture refuses writes; your edit is preserved.'});return
      violations.append('Unexpected mutation '+r.method+' '+path);await route.fulfill(status=405,json={'error':'Read-only fixture'});return
     reads.append(path+('?' + u.query if u.query else ''))
     if args.area=='composer-library' and path=='/api/composer-library/templates':
      assert not u.query
      if composer_library_mode=='failed':
       await route.fulfill(status=503,json={'error':('Local read refused; no template upload or deck creation occurred. '*22)+'Full diagnostic ending retained.'});return
      if composer_library_mode=='empty':await route.fulfill(json={'templates':[]});return
      await asyncio.sleep(2)
      await route.fulfill(json={'templates':[{'id':'local-composer-'+str(i),'name':('Quarterly planning evidence and a complete original presentation name '+str(i)+' ')*5,'slide_count':i+2} for i in range(9)]});return
     if args.area in ['notifications','privacy'] and path=='/api/preferences':
      assert not u.query
      if refuse_preferences:await route.fulfill(status=503,json={'error':'Local preferences unavailable'});return
      data={'emailAccountActivity':True,'emailProductUpdates':False,'emailMarketing':False,'activityTracking':False if args.area=='privacy' else True}
     elif args.area=='help' and help_signed_out and path=='/api/auth/session':await route.fulfill(json={});return
     elif path=='/api/auth/session':
      if args.area=='waiting-native':await auth_release.wait()
      data={'user':{**USER,**({'tier':'pro'} if args.area=='billing' else {})},'expires':'2099-01-01T00:00:00Z'}
     elif args.area=='billing' and path=='/api/subscription':data={'subscription':{'status':'active','tier':'pro','billingCycle':'monthly','currentPeriodEnd':'2026-11-02T00:00:00Z','cancelAtPeriodEnd':False}}
     elif path=='/api/subscription':data=knowledge.get('subscription',{'subscription':None})
     elif args.area in ['knowledge','knowledge-settings'] and path in knowledge['reads']:
      assert u.query==('limit=100' if path.endswith('/graph') else ''),(path,u.query)
      if args.area=='knowledge-settings' and path=='/api/knowledge-graph/settings':
       if refuse_settings:await route.fulfill(status=503,json={'error':'Local settings unavailable','reason':'Local service readiness unverified'});return
       await route.fulfill(json={**knowledge['reads'][path],'subscribed':settings_subscribed});return
      if refuse_graph and path in ['/api/knowledge-graph/stats','/api/knowledge-graph/graph']:await route.fulfill(status=503,json={'error':'Local graph unavailable'});return
      if refuse_detail and path=='/api/knowledge-graph/nodes/strategy':await route.fulfill(status=503,json={'error':'Local source details unavailable'});return
      data=knowledge['reads'][path]
     elif path=='/api/director/ws-token':data={'auth_enabled':False,'auth_token':None}
     elif args.area=='owner-inbox' and refuse_inbox and path==f'/api/publish/by-session/{SESSION}':
      reads.append('Expected caught local inbox read failure');await route.abort('failed');return
     elif path==f'/api/publish/by-session/{SESSION}':assert u.query in ['', 'checkStale=1'];data={'deck':PUBLISHED if args.area in ['manage','owner-inbox','publish-drafts'] else None,'staleness':'unknown','currentSlideCount':2}
     elif args.area=='owner-inbox' and path=='/api/publish/fixture-shared-deck/questions':
      data={'questions':[{'id':'fixture-'+status,'question':question,'status':status,'gateReason':'no_evidence' if status=='deferred' else None,'aiAnswer':None,'askerName':'Local visitor','askerEmail':None,'ownerAnswer':'Review the priorities at the next team meeting.' if status=='owner_answered' else None,'ownerAnsweredAt':NOW if status=='owner_answered' else None,'createdAt':NOW} for status,question in [('deferred','Who owns the next decision and when will the team review it?'),('owner_answered','What happens after the review?'),('blocked','An unrelated request')]],'nextCursor':None,'unansweredCount':1,'qaEnabled':questions_enabled,'corpusStatus':'ready'}
     elif args.area=='manage' and path=='/api/publish/fixture-shared-deck/qa-sources':data={'sources':[{'sourceRef':'fixture-deck-source','sourceKind':'deck','sourceLabel':'Presentation content','chunkCount':2,'allowedForQa':True}]}
     elif args.area=='manage' and path=='/api/publish/fixture-shared-deck/qa-corpus':data={'status':'ready'}
     elif path=='/api/narration/manifest':
      if args.area=='published':assert u.query=='slug=fixture-shared-deck';await route.fulfill(status=404,json={'error':'No local narration'});return
      assert u.query=='presentationId=studio-v4-local-renderer';data={'slides':[],'voiceName':None}
     elif path=='/api/narration/voice':assert u.query=='sessionId='+SESSION;data=json.loads((ROOT/'scripts/studio-v4/narration-voice-fixture.json').read_text()) if args.area=='manage' else {'voices':[],'selectedVoiceId':None,'effectiveVoiceId':None,'persistenceReady':False,'samplesReady':False}
     elif args.area=='billing' and path=='/api/account/usage':data={'presentationCount':14,'storageBytes':5242880}
     elif args.area=='billing' and path=='/api/wallet/balance':data={'balanceCents':1250,'transactions':[{'id':'fixture-credit','type':'credit','amountCents':1000,'reason':'Local_credit_record_for_display_only','balanceAfterCents':1250,'sourceRef':None,'createdAt':NOW},{'id':'fixture-debit','type':'debit','amountCents':250,'reason':'Local_generation_record_for_display_only','balanceAfterCents':1250,'sourceRef':None,'createdAt':NOW}]}
     elif args.area=='billing' and path=='/api/billing/invoices':data={'invoices':[{'id':'local-invoice-'+str(i),'date':'2026-09-'+str(i+1).zfill(2)+'T12:00:00Z','amount':20+i,'status':'Paid · local specimen','downloadUrl':'https://fixtures.invalid/invoice-'+str(i)} for i in range(9)]}
     elif args.area=='usage' and profile_quota_unavailable and path=='/api/usage/quota':
      await route.fulfill(status=503,json={'error':'Local fixture refuses the account quota read; supplied session usage remains independent.'});return
     elif path=='/api/usage/quota':data={'tier':'free','tierLabel':'Free','caps':{'dailyCents':20,'weeklyCents':50,'monthlyCents':100},'spent':{'dailyCents':0,'weeklyCents':0,'monthlyCents':0},'remainingPct':{'daily':1,'weekly':1,'monthly':1},'flags':quota_flags,'resetAt':{'daily':NOW,'weekly':NOW},'walletBalanceCents':0,'totals':{'monthTokens':0,'monthSpendCents':0}}
     elif args.area=='waiting-native' and path==f'/api/sessions/{WAITING_SESSION}':
      await switch_release.wait();data={'session':{**session,'id':WAITING_SESSION,'title':'Quarterly evidence','messages':[]}}
     elif args.area=='waiting-native' and path==f'/api/sessions/{WAITING_SESSION}/files':data={'files':[]}
     elif args.area=='waiting-native' and path==f'/api/sessions/{WAITING_SESSION}/messages':data={'messages':[]}
     elif args.area=='waiting-native' and path==f'/api/publish/by-session/{WAITING_SESSION}':data={'deck':None,'staleness':'unknown','currentSlideCount':2}
     elif path=='/api/sessions':
      sessions=[session]+([{**session,'id':WAITING_SESSION,'title':'Quarterly evidence'}] if args.area=='waiting-native' else [])
      data={'sessions':sessions,'pagination':{'total':len(sessions),'limit':20,'offset':0,'hasMore':False}}
     elif path==f'/api/sessions/{SESSION}':
      if args.area=='waiting-native':await session_release.wait()
      session['messages']=messages;data={'session':None if args.area=='fresh' else session}
     elif path==f'/api/sessions/{SESSION}/files':data={'files':[]}
     elif path==f'/api/sessions/{SESSION}/messages':data={'messages':messages}
     elif path=='/api/themes/standard':data={'theme':None}
     elif path=='/api/themes':data=workspace['themes']
     elif path=='/api/templates':data=workspace['templates']
     elif path=='/api/templates/fixture-template-review':data=workspace['template']
     elif path=='/api/templates/fixture-template-cleanup':data={**workspace['template'],'id':'fixture-template-cleanup','name':'Customer growth story','blueprint_enrichment_status':'failed','template_purity_status':'needs_cleanup'}
     else:violations.append('Unexpected GET '+path+'?'+u.query);await route.fulfill(status=404,json={});return
     await route.fulfill(json=data)
    async def ws(ws):
     if socket_kind(ws.url)=='development':ws.connect_to_server();return
     u=urlparse(ws.url)
     if u.scheme=='wss' and u.netloc=='directorv40-uat.up.railway.app' and u.path=='/ws' and any(('session_id='+item) in u.query.split('&') for item in ([SESSION,WAITING_SESSION] if args.area=='waiting-native' else [SESSION])):blocked_sockets.append(ws.url);await ws.close();return
     violations.append('Unexpected socket '+ws.url);await ws.close()
    await ctx.route('**/*',route);await ctx.route_web_socket('**/*',ws)
    page=await ctx.new_page();page.set_default_timeout(20000);page.on('pageerror',lambda e:errors.append(e.stack or str(e)))
    async def load(path):
     response=await page.goto(BASE+path,wait_until='domcontentloaded');assert response.status==200,(path,response.status);await page.wait_for_load_state('networkidle')
    async def shot(name):
     await page.wait_for_timeout(400);assert not errors and not violations,(errors,violations)
     geometry=await page.evaluate("""({scrollLeft:document.scrollingElement.scrollLeft,horizontalScrolls:[...document.querySelectorAll('*')].filter(e=>e.scrollLeft).map(e=>({tag:e.tagName,cls:e.className,scrollLeft:e.scrollLeft,width:e.clientWidth,content:e.scrollWidth})),workspace:document.querySelector('[data-studio-v4-shell-workspace]')?.getBoundingClientRect().toJSON(),inspector:document.querySelector('[data-studio-workspace-visible=\"true\"][data-studio-workspace-drawer=\"element\"]')?.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,scrolls:[...document.querySelectorAll('[data-radix-scroll-area-viewport]')].map(e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight})),welcomeHeading:document.querySelector('[data-studio-director-welcome] h2')?.getBoundingClientRect().toJSON()})""");assert geometry['pageWidth']<=w+1,geometry
     if args.area=='generation-forms':
      assert geometry['scrollLeft']==0 and not geometry['horizontalScrolls'],geometry
      assert geometry['workspace']['x']==56 and geometry['workspace']['right']<=w,geometry
      drawers=await page.locator('[data-studio-workspace-drawer][data-studio-workspace-visible=true]:not([data-studio-workspace-drawer=deck])').all()
      for drawer in drawers:
       box=await drawer.bounding_box();assert box and abs(box['x']+box['width']-geometry['workspace']['right'])<=2,box
     if args.area=='specialist-forms':
      assert geometry['scrollLeft']==0,geometry
      allowed=await page.locator('[data-studio-v4-panel=element-generation] .absolute.bottom-0 > .overflow-x-auto').count();assert allowed==1
      assert await page.evaluate("[...document.querySelectorAll('*')].filter(e=>e.scrollLeft).every(e=>e.matches('[data-studio-v4-panel=element-generation] .absolute.bottom-0 > .overflow-x-auto'))"),geometry
      box=await page.locator('[data-studio-specialist-specimen-panel=true]').bounding_box();assert box and abs(box['x']+box['width']-w)<=1 and abs(box['width']-400)<=1,box
     shots[name]=geometry;await page.add_style_tag(content='nextjs-portal{display:none!important}');await page.screenshot(path=str(out/(label+'-'+name+'.png')),full_page=True,animations='disabled');print(args.area,label,name,flush=True)
    async def fits_clip(locator,hit=False):
     data=await locator.evaluate("""(e,hit)=>{const b=e.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}if(/hidden|clip|auto|scroll/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}}return {box:b.toJSON(),clip:{left,top,right,bottom},fits:b.left>=left-1&&b.top>=top-1&&b.right<=right+1&&b.bottom<=bottom+1,hit:!hit||e.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2))}}""",hit)
     assert data['fits'] and data['hit'],data
    try:
     if args.area=='narrow-stage':
      await load('/builder?session_id='+SESSION)
      workspace=await required(page.locator('[data-studio-v4-shell-workspace=true]'))
      panes=await required(page.get_by_role('group',name='Workspace pane',exact=True))
      canvas=page.locator('[data-studio-v4-shell-presentation=true]')
      header=await required(page.locator('[data-studio-v4-shell-header=true]'))
      toolbar=header.locator('[data-studio-v4-toolbar-target=true]')
      composer=page.locator('[data-studio-v4-composer] textarea').first
      iframe=page.get_by_title('Presentation Viewer',exact=True)
      await expect(iframe).to_have_count(1);await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      draft='Keep this unsent narrow Stage readability draft.'
      await panes.get_by_role('button',name='Chat',exact=True).click();await composer.fill(draft)
      controls=[]
      for name,control in [('present',toolbar.get_by_title('Present fullscreen',exact=True)),('download',toolbar.get_by_role('button',name='Download presentation',exact=True)),('publish',toolbar.get_by_role('button',name='Publish',exact=True))]:
       await panes.get_by_role('button',name='Chat',exact=True).click()
       await expect(canvas).to_have_attribute('data-studio-canvas-covered','true')
       await control.focus();await expect(control).to_be_focused();await fits_clip(control,True)
       await expect(panes.get_by_role('button',name='Stage',exact=True)).to_have_attribute('aria-pressed','true')
       assert await canvas.evaluate("e=>!e.inert&&e.getAttribute('aria-hidden')!=='true'&&e.getAttribute('data-studio-canvas-covered')!=='true'")
       await expect(composer).to_have_value(draft)
       controls.append({'control':name,'bounds':await control.bounding_box(),'native_focus_revealed_stage':True})
       await shot('narrow-stage-native-header-'+name+'-focus')
      presentation=header.get_by_role('button',name='Presentation',exact=True)
      await presentation.focus();await expect(presentation).to_be_focused();await expect(presentation).to_have_text('Presentation');await fits_clip(presentation,True)
      compact=await presentation.evaluate("e=>({fontSize:getComputedStyle(e).fontSize,bounds:e.getBoundingClientRect().toJSON(),text:e.textContent,icon:!!e.querySelector('svg')})")
      assert compact['fontSize']=='0px' and abs(compact['bounds']['width']-34)<=1 and abs(compact['bounds']['height']-34)<=1 and compact['icon'],compact
      await shot('narrow-stage-native-presentation-accessible-focus')
      await panes.get_by_role('button',name='Stage',exact=True).click()
      await expect(canvas).not_to_have_attribute('data-studio-canvas-covered','true')
      show=page.get_by_role('button',name='Show thumbnails',exact=True);await required(show)
      await page.wait_for_timeout(400);await fits_clip(iframe);initial=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
      assert initial['width']>0 and initial['height']>0 and abs(initial['width']/initial['height']-16/9)<0.02,initial
      await show.click();hide=page.get_by_role('button',name='Hide thumbnails',exact=True);await required(hide);await page.wait_for_timeout(400);await hide.focus();await fits_clip(hide,True)
      await fits_clip(iframe);before=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
      assert before['width']>0 and before['height']>0 and abs(before['width']/before['height']-16/9)<0.02,before
      await shot('narrow-stage-native-thumbnails-visible')
      await hide.click();show=page.get_by_role('button',name='Show thumbnails',exact=True);await required(show)
      await page.wait_for_timeout(400);await fits_clip(iframe);expanded=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
      assert expanded['width']>before['width']+1 and expanded['height']>0 and abs(expanded['width']/expanded['height']-16/9)<0.02,(before,expanded)
      assert abs(expanded['width']-initial['width'])<=1 and abs(expanded['height']-initial['height'])<=1,(initial,expanded)
      await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await expect(composer).to_have_value(draft)
      await shot('narrow-stage-native-full-slide-thumbnails-hidden')
      await show.click();await required(page.get_by_role('button',name='Hide thumbnails',exact=True));await page.wait_for_timeout(400)
      await fits_clip(iframe);restored=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
      assert abs(restored['width']-before['width'])<=1 and abs(restored['height']-before['height'])<=1,(before,restored)
      await page.set_viewport_size({'width':900,'height':600});await page.wait_for_timeout(600)
      await required(page.get_by_role('button',name='Hide thumbnails',exact=True))
      await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(600)
      await required(page.get_by_role('button',name='Hide thumbnails',exact=True));await fits_clip(iframe)
      resized=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
      assert abs(resized['width']-before['width'])<=1 and abs(resized['height']-before['height'])<=1,(before,resized)
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await expect(composer).to_have_value(draft)
      await shot('narrow-stage-native-thumbnails-and-draft-restored')
      bridge=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      assert all(row['allowed'] and row['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for row in bridge),bridge
      assert not denied and not violations and not errors,(denied,violations,errors)
      proof_meta={'header_focus_controls':controls,'compact_presentation':compact,'iframe_initial_default_collapsed':initial,'iframe_before':before,'iframe_expanded':expanded,'iframe_restored':restored,'iframe_after_resize_choice_retained':resized,'bridge_requests':bridge}
      checks['compactStudioInitialThumbnailsCollapsedWithWholeSlideFit']=True
      checks['explicitThumbnailChoiceSurvivesSameSessionResize']=True
      checks['allNativeDeliveryControlsFullyClippedAndHitWithFocusOnly']=True
      checks['everyNativeDeliveryFocusRevealsStage']=True
      checks['compactPlusRetainsNativePresentationAccessibleName']=True
      checks['nativeThumbnailToggleExposesBiggerWholeAspectFitSlide']=True
      checks['thumbnailRestorationRetainsExactIframeAndUnsentDraft']=True
      checks['focusAndNativeLocalToggleNoWritesOrCanvasMutation']=True
     elif args.area=='narrow-workspace':
      await load('/builder?session_id='+SESSION)
      workspace=await required(page.locator('[data-studio-v4-shell-workspace=true]'))
      panes=await required(page.get_by_role('group',name='Workspace pane',exact=True))
      canvas=page.locator('[data-studio-v4-shell-presentation=true]')
      chat=page.locator('[data-studio-workspace-drawer=deck]')
      composer=page.get_by_role('textbox',name='Message Director',exact=True)
      iframe=page.get_by_title('Presentation Viewer',exact=True)
      await expect(iframe).to_have_count(1)
      await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      chat_draft='Keep this unsent narrow-workspace Director draft.'
      slide_draft='Keep this unsent native slide Inspector draft.'
      await panes.get_by_role('button',name='Chat',exact=True).click()
      await expect(composer).to_be_visible();await composer.fill(chat_draft)
      await composer.focus();await fits_clip(composer,True)
      bounds=await workspace.bounding_box();overlay=bounds['width']<=600
      assert overlay==(w<=666),(w,bounds)
      if w==666:assert abs(bounds['width']-600)<=1,bounds
      prefs=await page.evaluate("({chat:localStorage.getItem('deckster_builder_chat_width'),inspector:localStorage.getItem('deckster_builder_drawer_width')})")
      assert prefs=={'chat':'328','inspector':'372'},prefs
      async def settle_pane(pane):
       await expect(pane).to_have_css('width',await pane.evaluate('e=>e.style.width'))
      observations=[]
      async def observe(name,surface=None,covered=False):
       await page.wait_for_timeout(120)
       wb=await workspace.bounding_box();content=await workspace.evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x+e.clientLeft,y:r.y+e.clientTop,width:e.clientWidth,height:e.clientHeight}}');cb=await canvas.evaluate('e=>e.getBoundingClientRect().toJSON()');ib=await iframe.evaluate('e=>e.getBoundingClientRect().toJSON()')
       assert wb and cb and ib and cb['width']>0 and ib['width']>0 and ib['height']>0,(wb,cb,ib)
       if overlay:assert abs(cb['x']-content['x'])<=1 and abs(cb['width']-content['width'])<=1,(wb,content,cb)
       state=await canvas.evaluate("e=>({covered:e.getAttribute('data-studio-canvas-covered'),hidden:e.getAttribute('aria-hidden'),inert:e.inert})")
       assert state['inert']==covered and (state['hidden']=='true')==covered and (state['covered']=='true')==covered,state
       if surface is not None:
        sb=await surface.bounding_box();assert sb and sb['width']>0,(name,sb)
        if overlay:assert abs(sb['x']-content['x'])<=1 and abs(sb['width']-content['width'])<=1,(wb,content,sb)
        else:assert sb['width']<wb['width'],(wb,sb)
       if overlay:await expect(page.locator('[data-studio-workspace-resize]')).to_have_count(0)
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       assert await page.evaluate("({chat:localStorage.getItem('deckster_builder_chat_width'),inspector:localStorage.getItem('deckster_builder_drawer_width')})")==prefs
       observations.append({'state':name,'overlay':overlay,'workspace':wb,'workspace_content':content,'canvas':cb,'iframe':ib,'canvas_state':state,'preferences':prefs})
       await shot(name)
      async def reveal_stage():
       if overlay:
        stage=panes.get_by_role('button',name='Stage',exact=True);await stage.click();await expect(stage).to_have_attribute('aria-pressed','true')
        await stage.focus();await expect(stage).to_be_focused();await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');await expect(stage).to_have_attribute('aria-pressed','true')
       else:await expect(panes.get_by_role('button',name='Stage',exact=True)).to_have_count(0)
      await page.keyboard.press('ArrowDown');await expect(composer).to_have_value(chat_draft)
      await observe('workspace-native-chat-full-width-draft',chat,overlay)
      await reveal_stage()
      await required(page.get_by_role('button',name='Show thumbnails' if w<=666 else 'Hide thumbnails',exact=True))
      checks['nativeInitialThumbnailVisibilityMatchesExactCompactBoundary']=True
      await observe('workspace-native-stage-after-chat')
      await page.get_by_title('Open slide panel',exact=True).click()
      inspector=await required(page.locator('[data-studio-workspace-drawer=slide][data-studio-workspace-visible=true]'))
      panel=await required(inspector.locator('[data-studio-v4-panel=slide-generation]'))
      # Inspect the original width transition only after it reaches its assigned pane width.
      await expect(inspector).to_have_css('width',await inspector.evaluate('e=>e.style.width'))
      prompt=panel.locator('textarea').first;await prompt.fill(slide_draft);await prompt.focus();await fits_clip(prompt,True)
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await expect(prompt).to_have_value(slide_draft)
      await observe('workspace-native-slide-inspector-full-width-draft',inspector,overlay)
      await reveal_stage()
      hidden_shortcut_proof=[]
      if overlay:
       hidden_panel=page.locator('[data-studio-workspace-drawer=slide] [data-studio-v4-panel=slide-generation]')
       hidden_prompt=hidden_panel.locator('textarea').first
       hidden_owner=await hidden_panel.evaluate("e=>{const p=e.closest('[data-studio-workspace-content=true]');return {inert:p?.inert,hidden:p?.getAttribute('aria-hidden'),ownerVisible:e.closest('[data-studio-workspace-drawer]')?.getAttribute('data-studio-workspace-visible')}}")
       assert hidden_owner=={'inert':True,'hidden':'true','ownerVisible':'false'},hidden_owner
       await expect(hidden_prompt).to_have_value(slide_draft)
       before_generation=await hidden_panel.evaluate("e=>({text:e.textContent,promptDisabled:e.querySelector('textarea').disabled,spinners:e.querySelectorAll('.animate-spin').length})")
       assert before_generation['promptDisabled'] is False and before_generation['spinners']==0,before_generation
       stage=panes.get_by_role('button',name='Stage',exact=True)
       for key in ['Control+Enter','Meta+Enter']:
        await stage.focus();await expect(stage).to_be_focused();await page.keyboard.press(key);await page.wait_for_timeout(300)
        await expect(stage).to_have_attribute('aria-pressed','true');await expect(stage).to_be_focused();await expect(hidden_prompt).to_have_value(slide_draft)
        after_generation=await hidden_panel.evaluate("e=>({text:e.textContent,promptDisabled:e.querySelector('textarea').disabled,spinners:e.querySelectorAll('.animate-spin').length})")
        assert after_generation==before_generation,(key,before_generation,after_generation)
        assert not denied and not violations,(key,denied,violations)
        key_bridge=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
        assert all(row['allowed'] and row['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for row in key_bridge),(key,key_bridge)
        hidden_shortcut_proof.append({'key':key,'hidden_owner':hidden_owner,'prompt_retained':True,'generation_state_unchanged':True,'denied_writes':list(denied),'bridge_requests':key_bridge})
      await observe('workspace-native-stage-after-inspector')
      await panes.get_by_role('button',name='Chat',exact=True).click();await expect(composer).to_have_value(chat_draft)
      await settle_pane(chat);await composer.focus();await fits_clip(composer,True);await observe('workspace-native-chat-draft-retained',chat,overlay)
      await panes.get_by_role('button',name='Inspector',exact=True).click();await expect(prompt).to_have_value(slide_draft)
      await settle_pane(inspector);await prompt.focus();await fits_clip(prompt,True);await observe('workspace-native-inspector-draft-retained',inspector,overlay)
      await panes.get_by_role('button',name='Chat',exact=True).click()
      header=page.locator('[data-studio-v4-shell-header=true]');present=header.locator('[data-studio-v4-toolbar-target=true]').get_by_title('Present fullscreen',exact=True)
      await present.focus();await expect(present).to_be_focused();await fits_clip(present,True)
      if overlay:await expect(panes.get_by_role('button',name='Stage',exact=True)).to_have_attribute('aria-pressed','true')
      await observe('workspace-native-header-present-reveals-stage')
      await present.click();assert await page.evaluate('!!document.fullscreenElement')
      await expect(page.locator('[data-studio-v4-viewer=true]')).to_have_attribute('data-studio-v4-fullscreen','true')
      await shot('workspace-native-present-fullscreen')
      await page.mouse.move(w/2,h-60);await page.mouse.move(w/2,12)
      exit=page.locator('[data-studio-presentation-toolbar=true]').get_by_title('Exit fullscreen (ESC)',exact=True)
      await required(exit);await exit.click();assert not await page.evaluate('!!document.fullscreenElement')
      await observe('workspace-native-stage-after-fullscreen-exit')
      await panes.get_by_role('button',name='Inspector',exact=True).click();await expect(prompt).to_have_value(slide_draft)
      await panes.get_by_role('button',name='Chat',exact=True).click();await expect(composer).to_have_value(chat_draft)
      await settle_pane(chat);await composer.focus();await observe('workspace-native-final-drafts-and-iframe-retained',chat,overlay)
      resize_observations=[]
      if overlay:
       await page.set_viewport_size({'width':900,'height':600})
       await expect(panes.get_by_role('button',name='Stage',exact=True)).to_have_count(0)
       await page.wait_for_timeout(350)
       await panes.get_by_role('button',name='Chat',exact=True).click();await expect(composer).to_have_value(chat_draft)
       await settle_pane(chat)
       wide_chat=await chat.bounding_box();wide_workspace=await workspace.bounding_box();wide_canvas=await canvas.bounding_box()
       assert wide_chat and wide_workspace and wide_canvas and abs(wide_chat['width']-int(prefs['chat']))<=1 and wide_chat['width']<wide_workspace['width'] and wide_canvas['width']>0,(wide_chat,wide_workspace,wide_canvas)
       assert await canvas.evaluate("e=>!e.inert&&e.getAttribute('aria-hidden')!=='true'&&e.getAttribute('data-studio-canvas-covered')!=='true'")
       await panes.get_by_role('button',name='Inspector',exact=True).click();await expect(prompt).to_have_value(slide_draft)
       await settle_pane(inspector)
       wide_inspector=await inspector.bounding_box();assert wide_inspector and abs(wide_inspector['width']-int(prefs['inspector']))<=1 and wide_inspector['width']<wide_workspace['width'],(wide_inspector,wide_workspace)
       resize_observations.append({'viewport':{'width':900,'height':600},'workspace':wide_workspace,'chat':wide_chat,'inspector':wide_inspector,'canvas':wide_canvas})
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       assert await page.evaluate("({chat:localStorage.getItem('deckster_builder_chat_width'),inspector:localStorage.getItem('deckster_builder_drawer_width')})")==prefs
       await page.set_viewport_size({'width':w,'height':h})
       await expect(panes.get_by_role('button',name='Stage',exact=True)).to_have_count(1)
       await panes.get_by_role('button',name='Chat',exact=True).click();await expect(composer).to_have_value(chat_draft)
       await page.wait_for_timeout(350)
       restored=await workspace.evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x+e.clientLeft,width:e.clientWidth}}')
       await settle_pane(chat)
       restored_chat=await chat.bounding_box();assert restored_chat and abs(restored_chat['x']-restored['x'])<=1 and abs(restored_chat['width']-restored['width'])<=1,(restored_chat,restored)
       assert await canvas.evaluate("e=>e.inert&&e.getAttribute('aria-hidden')==='true'&&e.getAttribute('data-studio-canvas-covered')==='true'")
       await panes.get_by_role('button',name='Inspector',exact=True).click();await expect(prompt).to_have_value(slide_draft)
       await panes.get_by_role('button',name='Chat',exact=True).click();await expect(composer).to_have_value(chat_draft);await composer.focus()
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       assert await page.evaluate("({chat:localStorage.getItem('deckster_builder_chat_width'),inspector:localStorage.getItem('deckster_builder_drawer_width')})")==prefs
       resize_observations.append({'viewport':{'width':w,'height':h},'workspace_content':restored,'chat':restored_chat,'original_chat_restored':True})
      bridge=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      assert all(row['allowed'] and row['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for row in bridge),bridge
      assert not denied,denied
      proof_meta={'native_narrow_workspace_states':observations,'bridge_requests':bridge,'same_context_resize':resize_observations,'hidden_inspector_modifier_shortcuts':hidden_shortcut_proof}
      checks['hiddenInspectorControlAndMetaEnterDoNotGenerateWhenOverlayApplies']=True
      checks['nativeComposeInspectorOpenedWithoutLayoutInsertionOrSubmission']=True
      checks['bothUnsentDraftsAndExactIframeRetained']=True
      checks['coveredMountedPositiveCanvasInertAndAriaHiddenWhenOverlayApplies']=True
      checks['headerPresentRevealsStageAndNativeFullscreenExits']=True
      checks['savedWidthPreferencesUntouchedNoOverlayResizeControls']=True
      checks['nativeKeyboardNoCanvasNavigationOrMutation']=True
      checks['originalWideSinglePaneAllocationRetainedWhereWideApplies']=True
      checks['viewportResizePreservesNativeStateWhereOverlayApplies']=True
     elif args.area=='template-readiness':
      await load('/studio/templates');area=await required(page.locator('[data-studio-library=templates]'));await area.get_by_role('button',name='Library',exact=True).click()
      record=await required(area.locator('.sl-record').filter(has_text='Quarterly business review'));await record.click()
      warning=await required(area.get_by_role('alert',name='Template generation readiness',exact=True));await expect(warning.locator('p').nth(0)).to_have_text('Optimization: '+optimization_error);await expect(warning.locator('p').nth(1)).to_have_text('Cleanup: '+cleanup_error)
      await warning.scroll_into_view_if_needed();await fits_clip(warning);await shot('template-native-readiness-full-errors-bounded')
      await warning.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(warning).to_be_focused();await fits_clip(warning,True);assert await warning.evaluate('e=>parseFloat(getComputedStyle(e).outlineWidth)>=2');await shot('template-native-readiness-keyboard-focus')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(400)
      proof=await warning.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight,focused:e===document.activeElement})');assert proof['top']>0 and proof['top']+proof['height']>=proof['content']-2 and proof['focused'],proof
      await fits_clip(warning,True);await shot('template-native-readiness-complete-cleanup-ending')
      await expect(record).to_have_attribute('aria-pressed','true');retry=area.get_by_role('button',name='Retry optimization',exact=True);await expect(retry).to_be_enabled();await retry.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(retry).to_be_focused();await fits_clip(retry,True);await shot('template-native-readiness-retry-keyboard-without-click')
      assert not denied,denied
      checks['actualTemplateReadExactFullOptimizationAndCleanupReasons']=True
      checks['nativeAlertRoleNameBoundedKeyboardFocusAndCompleteEnd']=True
      checks['selectedTemplateAndOriginalRetryActionRetainedWithoutOptimization']=True
     elif args.area=='upload-status':
      await load('/studio-local-review/file-details');area=await required(page.locator('[data-studio-file-details-fixture=true]'));selector=await required(area.locator('#local-upload-notice'))
      composer=await required(area.get_by_role('textbox',name='Message Director',exact=True));retained=await composer.input_value();assert retained.startswith('Retained local Director draft')
      iframe=await required(area.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next');await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      long_name='SyntheticLocalUnbrokenOriginalFilename'+'QuarterlyLeadershipDecisionContext'*5+'EndOfFilename.pdf'
      status=area.locator('[data-studio-v4-type-role=upload-status][role=status]');send=area.locator('[data-studio-v4-send]');footer=area.locator('[data-studio-composer-part=footer]')
      for state,expected_text in [('pending','Waiting for '+long_name+' to finish uploading…'),('failed',long_name+" couldn't be uploaded — remove it or try again")]:
       await selector.select_option(state);await expect(status).to_have_text(expected_text);await expect(status).to_have_attribute('aria-live','polite');await expect(send).to_be_disabled()
       await footer.scroll_into_view_if_needed();await fits_clip(footer);await fits_clip(status);await fits_clip(composer);await fits_clip(send,True);assert await status.evaluate('e=>e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).overflowWrap==="anywhere"')
       assert await status.locator('svg').evaluate('e=>getComputedStyle(e).flexShrink==="0"&&e.getBoundingClientRect().width>=11')
       await shot('upload-native-complete-'+state+'-filename')
      await composer.focus();await expect(composer).to_be_focused();await expect(composer).to_have_value(retained);await fits_clip(composer);await shot('upload-native-retained-draft-keyboard-focus')
      await selector.select_option('original');await expect(area.locator('[data-studio-file-status=uploading]')).to_have_count(1);await expect(area.locator('[data-studio-file-status=error]')).to_have_count(1)
      await expect(status).to_have_text('Waiting for Synthetic upload progress.pdf to finish uploading…');await status.scroll_into_view_if_needed();await fits_clip(status);await shot('upload-native-original-supplied-props-restored')
      await expect(area.locator('[data-local-callback-counters]')).to_have_text('Submit 0 · Remove 0 · Files selected 0 · Clear all 0 · Session requests 0 · Settings 0 · Cancel 0');await expect(composer).to_have_value(retained)
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')");assert not denied,denied
      checks['suppliedNativePendingAndFailedFullUnbrokenFilenamesWrap']=True
      checks['nativePoliteStatusSpinnerErrorIconAndSendBlockingRetained']=True
      checks['fullNativeComposerStatusInputSendAndFooterFitTogether']=True
      checks['localPropSelectionRetainsDraftSameIframeZeroCallbacks']=True
      checks['originalSixFileSpecimenRemainsDefaultNoUploadOrSend']=True
     elif args.area=='version-state':
      for active in ['final','strawman']:
       session.update({'strawmanPreviewUrl':VIEWER,'strawmanPresentationId':'studio-v4-local-renderer','stateCache':{**session['stateCache'],'activeVersion':active}})
       if active=='strawman':await page.evaluate("({owner,id})=>{for(const prefix of ['deckster_session_v2_','deckster_metadata_v2_'])sessionStorage.removeItem(prefix+encodeURIComponent(owner)+'_'+id)}",{'owner':USER['id'],'id':SESSION})
       await load('/builder?session_id='+SESSION);composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent '+active+' version review draft.')
       iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next');await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       trigger=await required(page.get_by_title('Switch version',exact=True));await expect(trigger).to_contain_text('Final' if active=='final' else 'Strawman');await trigger.click()
       menu=await required(page.get_by_role('menu'));await expect(menu.get_by_role('menuitem')).to_have_count(3);current=menu.get_by_role('menuitem',name='Final' if active=='final' else 'Strawman',exact=True)
       await expect(current).to_have_attribute('aria-current','true');await expect(menu.locator('[aria-current=true]')).to_have_count(1);await current.focus();await fits_clip(current,True);await shot('version-native-'+active+'-current-keyboard-focus')
       await page.keyboard.press('Escape');await expect(trigger).to_be_focused();await expect(composer).to_have_value('Keep this unsent '+active+' version review draft.')
       await page.get_by_title('Present fullscreen',exact=True).click();assert await page.evaluate('!!document.fullscreenElement');await page.mouse.move(w/2,h-60);await page.mouse.move(w/2,12);await page.wait_for_timeout(350);await page.get_by_title('Switch version',exact=True).click()
       menu=await required(page.get_by_role('menu'));current=menu.get_by_role('menuitem',name='Final' if active=='final' else 'Strawman',exact=True);await expect(current).to_have_attribute('aria-current','true');await expect(menu.locator('[aria-current=true]')).to_have_count(1);await current.focus();await fits_clip(current,True);await shot('version-native-'+active+'-fullscreen-current-focus')
       await page.keyboard.press('Escape');await page.locator('[data-studio-presentation-toolbar=true]').get_by_title('Exit fullscreen (ESC)',exact=True).click();assert not await page.evaluate('!!document.fullscreenElement')
       await expect(composer).to_have_value('Keep this unsent '+active+' version review draft.');assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeLoadedFinalAndStrawmanCurrentCueAccessibleExactlyOne']=True
      checks['originalThreeVersionMenuItemsRetainedNormalAndFullscreen']=True
      checks['keyboardFocusEscapeFullscreenSameIframeDraftNoVersionSelection']=True
     elif args.area=='pending-action':
      action_label=('Preserve the full pending decision and supporting audience context without losing any supplied label details. '*7)+'Pending label ending retained.'
      messages=[{**ACTION,'id':'fixture-pending-long','payload':{'prompt_text':'Supply context for this decision.','actions':[{'label':action_label,'value':'clarify_goal','primary':False,'requires_input':True}]}}]
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent pending-input draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      choice=await required(page.locator('[data-studio-director-ask=choice]').get_by_role('button',name=action_label,exact=True));await choice.click()
      pending=await required(page.locator('[data-studio-composer-pending-action=true]'));region=await required(pending.get_by_role('region',name='Pending Director action',exact=True));cancel=await required(pending.get_by_role('button',name='Cancel',exact=True))
      await expect(composer).to_be_focused();await expect(composer).to_have_value('Keep this unsent pending-input draft.')
      await expect(region.locator('[data-studio-v4-type-role=action-label]')).to_have_text(action_label);await expect(region.locator('[data-studio-v4-type-role=action-helper]')).to_have_text('Type your input and press Enter')
      await fits_clip(region);await fits_clip(cancel,True);await fits_clip(composer);await shot('pending-native-full-label-bounded-with-cancel')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await region.focus();await expect(region).to_be_focused();await fits_clip(region,True);await shot('pending-native-details-keyboard-focus')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(400)
      proof=await region.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight,focused:e===document.activeElement})');assert proof['top']>0 and proof['top']+proof['height']>=proof['content']-2 and proof['focused'],proof
      await fits_clip(region,True);await fits_clip(cancel,True);await shot('pending-native-complete-ending-keyboard-scroll')
      await page.keyboard.press('Tab');await expect(cancel).to_be_focused();await fits_clip(cancel,True);await shot('pending-native-cancel-keyboard-focus')
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert all(r['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for r in requests),requests
      await expect(composer).to_have_value('Keep this unsent pending-input draft.');assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await cancel.press('Enter');await expect(pending).to_have_count(0);await expect(composer).to_have_value('');await composer.focus();await fits_clip(composer);await shot('pending-native-existing-cancel-clears-input')
      assert not denied,denied
      checks['nativeRequiresInputActionPreservesDraftAndFocusWithoutSend']=True
      checks['completeNativeLabelAndHelperScrollWithinBoundedBanner']=True
      checks['keyboardScrollStaysOutsideCanvasSameIframeDraft']=True
      checks['nativeCancelRemovesPendingAndClearsInputAsBefore']=True
     elif args.area=='websocket-error':
      await load('/studio-local-review/websocket-error')
      specimen=await required(page.locator('[data-studio-websocket-error-specimen=true]'));selector=await required(specimen.locator('[data-studio-websocket-error-specimen-selector=true]'))
      fallback=await required(specimen.locator('[data-studio-websocket-error=true]'));details=await required(fallback.get_by_role('region',name='Connection error details',exact=True));reconnect=await required(fallback.get_by_role('button',name='Reconnect',exact=True))
      await expect(details).to_have_text('Failed to establish connection with AI agents. Please check your internet connection and try again.');await fits_clip(fallback);await fits_clip(details);await fits_clip(reconnect,True);await shot('websocket-native-exact-default-message')
      await selector.select_option('long')
      long_reason='Supplied native userMessage diagnostic.\nSecond supplied line stays intact.\n'+'Long supplied connection detail and retained identifier local_diagnostic_0123456789. '*36
      await expect(details).to_have_text(long_reason);assert await details.evaluate('e=>getComputedStyle(e).whiteSpace==="pre-wrap"')
      await details.focus();await expect(details).to_be_focused();await fits_clip(details,True);await fits_clip(reconnect,True);await shot('websocket-native-supplied-multiline-keyboard-focus')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(400)
      proof=await details.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight,focused:e===document.activeElement})');assert proof['top']>0 and proof['top']+proof['height']>=proof['content']-2 and proof['focused'],proof
      await fits_clip(details,True);await fits_clip(reconnect,True);await shot('websocket-native-complete-diagnostic-keyboard-end')
      await page.keyboard.press('Tab');await expect(reconnect).to_be_focused();await fits_clip(reconnect,True);assert await reconnect.evaluate('e=>parseFloat(getComputedStyle(e).outlineWidth)>=2');await shot('websocket-native-reconnect-keyboard-focus-without-retry')
      await reconnect.hover();await fits_clip(reconnect,True);await shot('websocket-native-reconnect-hover-without-retry')
      await expect(specimen.locator('[data-studio-websocket-error-specimen-refused=true]')).to_have_count(0);assert not denied,denied
      checks['suppliedNativeLeafExactDefaultAndFullDiagnosticRetained']=True
      checks['standaloneLightDarkFallbackFitAndScrollableDetails']=True
      checks['nativeReconnectHoverAndKeyboardFocusFitWithoutClick']=True
      checks['noUncaughtErrorBoundaryResetClassificationOrRecoveryAttempt']=True
     elif args.area=='usage':
      await load('/studio-local-review/usage')
      area=await required(page.locator('[data-studio-usage-fixture=true]'))
      await expect(area).to_contain_text('No quota hook, ledger debit or connected checkout.')
      draft=area.get_by_role('textbox',name='Local fixture draft',exact=True);await draft.fill('Keep this local draft through usage inspection.')
      strip=await required(area.locator('[data-studio-usage-fixture-stage] > [data-studio-token-usage=true]'))
      for state in ['partial','full','near','hard','reserve']:
       await area.locator('[data-studio-usage-fixture-state='+state+']').click()
       coverage=strip.locator('[data-studio-token-coverage]')
       await expect(coverage).to_have_attribute('data-studio-token-coverage','full' if state=='full' else 'partial')
       await expect(coverage).to_have_attribute('aria-description','All reported service tokens are included.' if state=='full' else "Some services' tokens aren't counted yet, so the true total may be higher.")
       await expect(strip.locator('[data-studio-token-warning]')).to_have_count(0 if state in ['partial','full'] else 1)
       if state=='hard':await expect(strip.locator('[data-studio-token-warning=hard]')).to_be_visible()
       await shot('usage-'+state)
      await area.locator('[data-studio-usage-fixture-open]').click()
      modal=await required(page.locator('[data-studio-topup=true]'))
      await expect(modal.locator('[data-studio-topup-pack]')).to_have_count(4)
      pack=modal.get_by_role('button',name='Start checkout for $10 reserve credits',exact=True)
      await pack.focus();await expect(pack).to_be_focused();await shot('usage-topup-pack-focus')
      await pack.click();await expect(modal.locator('[data-studio-topup-pack]:disabled')).to_have_count(4)
      await shot('usage-topup-busy-local-refusal')
      await expect(modal.get_by_role('alert')).to_have_text('Local fixture refuses checkout. No purchase or redirect occurred.')
      await expect(modal.locator('[data-studio-topup-pack]:disabled')).to_have_count(0)
      await shot('usage-topup-refused-retained')
      await page.keyboard.press('Escape');await expect(modal).to_have_count(0);await expect(draft).to_have_value('Keep this local draft through usage inspection.')
      assert len(denied)==1 and denied[0]['body']=={'packId':'pack_10'},denied
      await area.locator('[data-studio-usage-fixture-state=partial]').click()
      await area.get_by_role('checkbox',name='Long session counter in account menu',exact=True).check()
      profile_quota_unavailable=True
      trigger=area.get_by_role('button',name='Open account menu',exact=True);await trigger.click()
      menu=await required(page.get_by_role('menu'))
      counter=await required(menu.locator('[data-studio-token-counter=true]'))
      await expect(counter).to_contain_text('1,234,567,890')
      await expect(menu.locator('[data-studio-token-explanation=true]')).to_have_text("Some services' tokens aren't counted yet, so the true total may be higher.")
      await expect(menu.locator('[data-studio-token-coverage=partial]')).to_be_visible()
      await fits_clip(counter)
      assert await counter.evaluate("e=>{const m=e.closest('[role=menu]').getBoundingClientRect();return [...e.querySelectorAll('span')].every(s=>{const r=s.getBoundingClientRect();return r.left>=m.left && r.right<=m.right})}")
      await shot('usage-account-long-counter-refused-quota')
      await page.keyboard.press('Escape');await expect(trigger).to_be_focused();await trigger.click()
      menu=await required(page.get_by_role('menu'));await expect(menu.locator('[data-studio-token-counter=true]')).to_contain_text('1,234,567,890')
      await expect(menu.locator('[data-studio-token-delta=true]')).to_contain_text('+934')
      await shot('usage-account-long-counter-native-reopen')
      await page.keyboard.press('Escape');await expect(draft).to_have_value('Keep this local draft through usage inspection.')
      checks['longSessionCounterFullCoverageExplanationIndependentRefusedQuota']=True
      checks['nativeAccountReopenCurrentTurnDeltaWithoutNewUsage']=True
      checks['fiveActualNativeUsagePropStatesAndCoverageDetails']=True
      checks['fourNativePacksFocusBusyRefusalNoPurchaseRedirect']=True
      checks['localDraftRetainedNoQuotaHookLedgerDebit']=True
     elif args.area=='file-details':
      await load('/studio-local-review/file-details')
      area=await required(page.locator('[data-studio-file-details-fixture=true]'))
      await expect(area).to_contain_text('No upload, send, persistence or enrichment runs here.')
      iframe=await required(area.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      composer=area.get_by_role('textbox',name='Message Director',exact=True)
      retained=await composer.input_value();assert retained.startswith('Retained local Director draft')
      chips=area.locator('[data-studio-composer-attachments]')
      await expect(chips.locator('[data-studio-file-chip]')).to_have_count(6)
      for state in ['uploading','stored','processing','success','degraded','error']:await expect(chips.locator('[data-studio-file-status='+state+']')).to_have_count(1)
      await shot('file-details-native-six-statuses')
      details=chips.locator('[data-studio-file-detail=true]');summary=details.locator('summary')
      assert not await details.evaluate('e=>e.open')
      await summary.focus();await expect(summary).to_be_focused();await page.keyboard.press('Enter');await expect(details).to_have_attribute('open','')
      await expect(details.locator('p')).to_contain_text('End of the synthetic local diagnostic.')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      before=await chips.evaluate('e=>e.scrollTop')
      await page.keyboard.press('ArrowDown');await page.wait_for_timeout(250)
      after=await chips.evaluate('e=>e.scrollTop');assert after>before,{'before':before,'after':after}
      assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      await expect(composer).to_have_value(retained)
      await expect(area.locator('[data-local-callback-counters]')).to_have_text('Submit 0 · Remove 0 · Files selected 0 · Clear all 0 · Session requests 0 · Settings 0 · Cancel 0')
      await shot('file-details-open-keyboard-scroll')
      await summary.focus();await page.keyboard.press('Enter');assert not await details.evaluate('e=>e.open')
      await expect(composer).to_have_value(retained);await shot('file-details-closed-retained')
      await page.locator('body').evaluate('e=>{e.tabIndex=-1;e.focus()}');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
      assert any(r['action']=='nextSlide' for r in await iframe.content_frame.locator('body').evaluate('window.fixtureRequests'))
      assert not denied,denied
      checks['sixNativeAttachmentStatusPropsCompleteDiagnostic']=True
      checks['focusedActualComposerDetailsScrollWithoutCanvasCommands']=True
      checks['nativeDraftRetainedZeroCallbacksNoUploadOrSend']=True
      checks['ordinaryCanvasNavigationPreservedDeniedMutation']=True
     elif args.area=='billing':
      await load('/billing')
      area=await required(page.locator('[data-studio-billing=true]'))
      for name in ['plan','wallet','payment','invoices','usage']:await required(area.locator('[data-studio-billing-card='+name+']'))
      await expect(area.get_by_role('list',name='Invoice History',exact=True).get_by_role('listitem')).to_have_count(9)
      await expect(area.locator('[data-studio-billing-balance]')).to_contain_text('$12.50')
      await expect(area.locator('[data-studio-billing-packs]').get_by_role('button')).to_have_count(4)
      await expect(area.locator('[data-studio-billing-transactions]')).to_contain_text('Local credit record for display only')
      await shot('billing-native-cards')
      manage=area.get_by_role('button',name='Manage Subscription',exact=True).first
      await page.keyboard.press('Tab');await manage.focus();await expect(manage).to_be_focused()
      await shot('billing-manage-keyboard-focus')
      pack=area.locator('[data-studio-billing-packs]').get_by_role('button',name='$100',exact=True)
      await pack.focus();await expect(pack).to_be_focused();await shot('billing-pack-focus-no-checkout')
      last=area.locator('[data-studio-billing-invoice]').last
      link=last.get_by_role('link',name='Download invoice',exact=True)
      await link.focus();await expect(link).to_be_focused();await expect(link).to_have_attribute('href','https://fixtures.invalid/invoice-8')
      await shot('billing-last-invoice-focus-no-download')
      assert not denied and not any('invoice-' in item and 'fixtures.invalid' in item for item in reads),(denied,reads)
      checks['allFiveNativeCardsNineInvoicesFourPacksPreserved']=True
      checks['nativeReadOnlyAccountWalletInvoiceMetadata']=True
      checks['keyboardFinancialControlsFocusOnlyNoActionOrDownload']=True
     elif args.area=='build-status':
      for phase in ['planning','building','awaiting_user','paused','error','complete','qa']:
       await load('/studio-local-review/build-status?state='+phase)
       area=await required(page.locator('[data-studio-build-specimen=true]'))
       await expect(area).to_contain_text('No build, control request or service action runs here.')
       iframe=await required(area.get_by_title('Presentation Viewer',exact=True))
       await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
       ribbon=await required(area.locator('[data-studio-build-ribbon=true]'))
       await expect(ribbon).to_have_attribute('data-studio-build-phase',phase)
       footer=await required(area.get_by_role('region',name='Build updates',exact=True))
       await expect(footer).to_contain_text('the specimen does not run a build or contact a service.')
       await expect(area.locator('[data-studio-build-dot-state]')).to_have_count(3)
       if phase=='building':
        assert await area.locator('[data-studio-build-dot-state]').evaluate_all("els=>els.map(e=>e.dataset.studioBuildDotState)")==['done','active','idle']
       if phase=='complete':
        assert await area.locator('[data-studio-build-dot-state]').evaluate_all("els=>els.map(e=>e.dataset.studioBuildDotState)")==['done','done','done']
        await expect(area.locator('[data-studio-build-evidence]')).to_have_attribute('data-studio-build-evidence','ready')
       if phase=='error':
        await expect(ribbon).to_contain_text('Keep the full diagnostic and current stage visible')
        await expect(area.locator('[data-studio-build-dot-state=error]')).to_have_count(1)
       await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
       await page.keyboard.press('Tab');await footer.focus();await expect(footer).to_be_focused()
       await page.keyboard.press('ArrowDown');await page.wait_for_timeout(250)
       requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
       assert not requests,requests
       scroll=await footer.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight})')
       assert scroll['content']<=scroll['height'] or scroll['top']>0,scroll
       await page.keyboard.press('ArrowUp');await page.wait_for_timeout(150)
       assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
       box=await footer.bounding_box();assert box and box['y']+box['height']<=h,box
       await shot('build-status-'+phase)
       if phase=='qa':
        qa=await required(area.locator('[data-studio-qa=true]'))
        await expect(qa).to_contain_text('1 green · 1 amber')
        entry=qa.get_by_role('button',name='Inspect quality checks',exact=True)
        async def within_clips(locator,hit=False):
         data=await locator.evaluate("""(e,hit)=>{const b=e.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}if(/hidden|clip|auto|scroll/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}}return {box:b.toJSON(),clip:{left,top,right,bottom},fits:b.left>=left-1&&b.top>=top-1&&b.right<=right+1&&b.bottom<=bottom+1,hit:!hit||e.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2))}}""",hit)
         assert data['fits'] and data['hit'],data
         return data
        await within_clips(qa)
        await within_clips(entry,True)
        rect=await iframe.bounding_box()
        await entry.focus();await expect(entry).to_be_focused();await page.keyboard.press('Enter')
        dialog=await required(page.locator('[data-studio-qa-dialog=true]'))
        await within_clips(dialog)
        await within_clips(dialog.get_by_role('button',name='Close',exact=True),True)
        await expect(dialog.locator('[data-studio-qa-dialog-message]')).to_have_text('Connect each priority to its evidence and make the next decision visible.')
        await expect(dialog).to_contain_text('QA skipped on 15 slides: slide 3')
        await expect(dialog).to_contain_text('slide 17')
        assert await iframe.bounding_box()==rect
        reasons=await required(dialog.locator('[data-studio-qa-dialog-report]'))
        await reasons.focus();await expect(reasons).to_be_focused()
        await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
        await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
        assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
        scroll=await reasons.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight})');assert scroll['content']<=scroll['height'] or scroll['top']>0,scroll
        if label!='light-1440x900':assert scroll['content']>scroll['height'] and scroll['top']>0,scroll
        await shot('build-status-qa-details-keyboard')
        await dialog.get_by_role('button',name='Close',exact=True).click();await expect(dialog).to_have_count(0);await expect(entry).to_be_focused();await within_clips(entry,True)
        assert await iframe.bounding_box()==rect
        checks['fullTypedQaReasonsScrollWithoutCanvasCommands']=True
        checks['collapsedQaFitsActualStageClipAndPortalCloseHitTest']=True
        checks['qaPortalCloseReturnsFocusWithoutIframeGeometryChange']=True
       if phase=='building':
        await page.locator('body').evaluate('e=>{e.tabIndex=-1;e.focus()}')
        await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
        requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
        assert any(r['action']=='nextSlide' for r in requests),requests
      assert not denied,denied
      checks['sevenActualNativeComponentPhasesCompleteTextAndTypedDots']=True
      checks['focusedNativeFooterScrollsWithoutCanvasCommands']=True
      checks['ordinaryCanvasNavigationPreservedFixtureDeniesMutation']=True
      checks['propsOnlyNoBuildProviderControlOrServiceAction']=True
     elif args.area=='help':
      await load('/help')
      area=await required(page.locator('[data-studio-help=true]'))
      await expect(area.locator('[data-studio-help-part=faq-item]')).to_have_count(24)
      await shot('help-native-faq')
      search=area.get_by_role('textbox',name='Search FAQ',exact=True)
      await search.fill('attachments')
      await expect(area.locator('[data-studio-help-part=faq-item]')).to_have_count(1)
      await shot('help-search-focus')
      await search.fill('No matching local fixture result 493')
      await expect(area.locator('[data-studio-help-part=faq-item]')).to_have_count(0)
      await shot('help-empty-results')
      await area.get_by_role('button',name='Clear filters',exact=True).click()
      await expect(search).to_have_value('');await expect(area.locator('[data-studio-help-part=faq-item]')).to_have_count(24)
      await area.locator('[data-studio-help-part=quick-links]').get_by_role('button',name='Getting started',exact=False).click()
      await expect(area.get_by_role('tab',name='Getting Started',exact=True)).to_have_attribute('data-state','active')
      await shot('help-native-guides')
      await area.get_by_role('tab',name='Contact Support',exact=True).click()
      draft=await required(area.locator('[data-studio-help-part=support-draft]'))
      subject=draft.get_by_role('textbox',name='Subject',exact=True)
      message=draft.get_by_role('textbox',name='Message',exact=True)
      await subject.fill('Keep my Studio support draft & details')
      await message.fill('Describe the issue.\nRetain these details until I choose to send.')
      link=draft.get_by_role('link',name='Open email draft',exact=True)
      from urllib.parse import parse_qs
      href=urlparse(await link.get_attribute('href'));assert href.scheme=='mailto' and href.path=='support@deckster.xyz'
      assert parse_qs(href.query)=={'subject':['Keep my Studio support draft & details'],'body':['Describe the issue.\nRetain these details until I choose to send.']}
      await page.keyboard.press('Tab');await link.focus();await expect(link).to_be_focused()
      await expect(draft).to_contain_text('does not submit a ticket or send your message')
      await shot('help-unsent-email-draft-focus')
      await area.get_by_role('tab',name='FAQ',exact=True).click()
      await area.get_by_role('tab',name='Contact Support',exact=True).click()
      await expect(subject).to_have_value('Keep my Studio support draft & details')
      await expect(message).to_have_value('Describe the issue.\nRetain these details until I choose to send.')
      help_signed_out=True
      await load('/help');area=await required(page.locator('[data-studio-help=true]'))
      await expect(area.get_by_role('link',name='Sign in',exact=True)).to_have_attribute('href','/auth/signin')
      await expect(area.locator('[data-studio-v4-rail]')).to_have_count(0)
      await expect(area.locator('[data-studio-help-part=faq-item]')).to_have_count(24)
      await shot('help-public-access')
      assert not denied,denied
      checks['allNativeFaqsSearchEmptyResetAndGuideQuickLink']=True
      checks['supportIsUnsentEncodedDraftRetainedAcrossTabs']=True
      checks['signedOutPublicHelpAccessNoTicketOrEmailRequest']=True
     elif args.area=='notes':
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Show script and notes',exact=True).click()
      panel=await required(page.locator('[data-studio-slide-notes=true]'))
      for tab,label_name,value,name in [
       ('Notes','Speaker notes','Pause for questions, then point to the three priorities.','notes-populated-focus'),
       ('Script','Slide script','Bring the audience back to the decision. These are the spoken words for this slide.','script-populated-focus'),
       ('References','Slide references','Local source: quarterly strategy brief\nLocal source: decision review notes','references-populated-focus')]:
       await panel.get_by_role('tab',name=tab,exact=True).click()
       field=panel.get_by_role('textbox',name=label_name,exact=True)
       await expect(field).to_have_value(value);await field.focus();await expect(field).to_be_focused()
       help=await required(panel.locator('[data-studio-notes-field-help=true]'))
       await expect(field).to_have_attribute('aria-describedby',await help.get_attribute('id'))
       box=await field.bounding_box();pb=await panel.bounding_box()
       assert box and pb and box['height']>=50 and box['y']>=pb['y'] and box['y']+box['height']<=h,(box,pb)
       await shot(name)
      await panel.get_by_role('tab',name='Notes',exact=True).click()
      field=panel.get_by_role('textbox',name='Speaker notes',exact=True)
      await field.fill('Retain this unsaved note after the refused local save.')
      error=panel.locator('[data-studio-notes-save-help=error]')
      await expect(field).to_have_value('Retain this unsaved note after the refused local save.')
      await expect(error).to_be_visible(timeout=10000);await expect(error).to_contain_text('Studio will retry')
      await expect(field).to_have_value('Retain this unsaved note after the refused local save.')
      assert denied and all(d['method']=='PATCH' and d['body'].get('speaker_notes')=='Retain this unsaved note after the refused local save.' for d in denied),denied
      await shot('notes-refused-save-retained')
      await panel.get_by_role('tab',name='References',exact=True).click()
      await expect(panel.get_by_role('textbox',name='Slide references',exact=True)).to_have_value('Local source: quarterly strategy brief\nLocal source: decision review notes')
      await panel.get_by_role('tab',name='Notes',exact=True).click()
      await expect(panel.get_by_role('textbox',name='Speaker notes',exact=True)).to_have_value('Retain this unsaved note after the refused local save.')
      checks['nativePopulatedThreeFieldsPersistentHelpFocusAndFit']=True
      checks['refusedNativeStableSlideSaveRetainsDraftAndRetryExplanation']=True
      checks['nativeTabsRetainDifferentFieldsNoPersistenceAcknowledged']=True
     elif args.area=='security':
      await load('/settings/security')
      area=await required(page.locator('[data-studio-security=true]'))
      await expect(area).to_contain_text('Google Sign-In')
      await expect(area).to_contain_text('App-level TOTP is planned')
      opener=area.locator('[data-studio-security-open]')
      await page.keyboard.press('Tab');await opener.focus();await expect(opener).to_be_focused()
      await shot('security-delete-entry-focus')
      await page.keyboard.press('Enter')
      confirm=await required(area.locator('[data-studio-security-confirmation]'))
      field=confirm.get_by_role('textbox',name='Type DELETE to confirm.',exact=True)
      await expect(confirm).to_contain_text('This permanently deletes your account, presentations, uploads, and billing')
      await expect(confirm.locator('[data-studio-security-delete]')).to_be_disabled()
      await field.fill('DO NOT DELETE')
      await expect(confirm.locator('[data-studio-security-delete]')).to_be_disabled()
      await shot('security-invalid-confirmation')
      cancel=confirm.locator('[data-studio-security-cancel]')
      await cancel.focus();await expect(cancel).to_be_focused()
      await shot('security-cancel-focus')
      await page.keyboard.press('Enter');await expect(confirm).to_have_count(0)
      await opener.click();confirm=await required(area.locator('[data-studio-security-confirmation]'))
      await expect(confirm.get_by_role('textbox',name='Type DELETE to confirm.',exact=True)).to_have_value('')
      await expect(confirm.locator('[data-studio-security-delete]')).to_be_disabled()
      await confirm.locator('[data-studio-security-cancel]').click()
      assert not denied,denied
      checks['nativeFullAuthPlannedWarningAndAssociatedInput']=True
      checks['invalidConfirmationDisabledCancelResetsNoDelete']=True
      checks['keyboardEntryAndCancelFocusNoRequests']=True
     elif args.area=='continuation':
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      guide=await required(page.locator('[data-studio-director-welcome-context=presentation]'))
      await expect(guide.get_by_role('heading',name='What would you like to change?',exact=True)).to_be_visible()
      await expect(guide.locator('[data-studio-director-welcome-part=presentation]')).to_contain_text('Quarterly strategy')
      await expect(guide.locator('[data-studio-director-welcome-part=presentation]')).to_contain_text('2 slides')
      await expect(guide.locator('[data-studio-director-starter]')).to_have_count(3)
      await shot('continuation-current-deck')
      composer=page.locator('[data-studio-v4-composer] textarea').first
      starter=guide.locator('[data-studio-director-starter=refine-message]')
      await page.keyboard.press('Tab');await starter.focus();await expect(starter).to_be_focused()
      await shot('continuation-starter-keyboard')
      await page.keyboard.press('Enter');await expect(composer).to_have_value('Help me refine [slide or section] in the current presentation for [audience]. I want to improve [message or outcome].')
      await expect(composer).to_be_focused();await shot('continuation-editable-draft')
      await composer.fill('Keep my own unsent change.')
      await guide.locator('[data-studio-director-starter=review-story]').click()
      choice=await required(page.get_by_role('region',name='Brief ready',exact=True))
      await choice.get_by_role('button',name='Keep my message',exact=True).click()
      await expect(composer).to_have_value('Keep my own unsent change.')
      await guide.locator('[data-studio-director-starter=update-content]').click()
      choice=await required(page.get_by_role('region',name='Brief ready',exact=True))
      await choice.get_by_role('button',name='Use brief',exact=True).click()
      await expect(composer).to_have_value('Help me update [slide or section] in the current presentation with [new content]. Keep [parts that should stay the same].')
      await shot('continuation-replacement-by-choice')
      messages.append({'id':'fixture-restored-user','messageType':'chat_message','timestamp':NOW,'userText':'Keep the leadership story focused.'})
      await load('/builder?session_id='+SESSION)
      await expect(page.locator('[data-studio-director-welcome=true]')).to_have_count(0)
      await expect(page.get_by_text('Keep the leadership story focused.',exact=True)).to_be_visible()
      await shot('continuation-restored-transcript')
      messages.clear();session.update({'currentStage':0,'slideCount':0,'finalPresentationUrl':None,'finalPresentationId':None,'stateCache':{}})
      await page.evaluate("({owner,id})=>{for(const prefix of ['deckster_session_v2_','deckster_metadata_v2_'])sessionStorage.removeItem(prefix+encodeURIComponent(owner)+'_'+id)}",{'owner':USER['id'],'id':SESSION})
      await load('/builder?session_id='+SESSION)
      guide=await required(page.locator('[data-studio-director-welcome=true]'))
      await expect(guide.get_by_role('heading',name='What are we making?',exact=True)).to_be_visible()
      await expect(page.locator('[data-studio-director-welcome-context=presentation]')).to_have_count(0)
      await expect(guide.locator('[data-studio-director-starter]')).to_have_count(3)
      await shot('continuation-fresh-context-preserved')
      assert not denied,denied
      checks['actualArtifactTitleCountAndThreeContinuationDrafts']=True
      checks['keyboardDraftFocusKeepUseNoSend']=True
      checks['restoredTranscriptSuppressesGuideFreshUnchanged']=True
     elif args.area=='privacy':
      refuse_preferences=True
      await load('/settings/privacy')
      area=await required(page.locator('[data-studio-privacy=true]'))
      control=area.get_by_role('switch',name='Activity Tracking',exact=True)
      await expect(control).to_be_disabled();await expect(area.get_by_role('alert')).to_be_visible()
      await expect(area.get_by_role('button',name='Export',exact=True)).to_be_enabled()
      await expect(area).to_contain_text('Public profiles and team sharing are planned')
      await shot('privacy-unavailable-disabled')
      refuse_preferences=False
      await area.get_by_role('button',name='Retry loading',exact=True).click()
      await expect(control).to_be_enabled();await expect(control).not_to_be_checked()
      await shot('privacy-confirmed-off')
      await page.keyboard.press('Tab');await control.focus();await page.keyboard.press('Space')
      row=area.locator('[data-studio-privacy-tracking]')
      await expect(row).to_have_attribute('data-unsaved','true')
      await expect(control).to_be_checked();await expect(row.get_by_role('alert')).to_be_visible()
      await expect(row).to_contain_text('last confirmed off')
      await shot('privacy-refused-choice-retained')
      await area.get_by_role('button',name='Refresh',exact=True).click()
      await expect(row).to_have_attribute('data-unsaved','true');await expect(control).to_be_checked()
      await row.get_by_role('button',name='Retry choice',exact=True).click()
      await expect(row.get_by_role('alert')).to_be_visible()
      assert [item['body'] for item in denied]==[{'activityTracking':True},{'activityTracking':True}],denied
      await row.get_by_role('button',name='Discard local choice',exact=True).click()
      await expect(control).not_to_be_checked();await expect(row).to_have_attribute('data-unsaved','false')
      await shot('privacy-discard-last-confirmed')
      assert not any('/api/account/export' in item for item in reads),reads
      checks['verifiedFalseRecordUnavailableSwitchDisabled']=True
      checks['nativeKeyboardRefusedChoiceRefreshRetryAndDiscard']=True
      checks['exactActivityTrackingOnlyPatchExportPreservedNotInvoked']=True
     elif args.area=='notifications':
      refuse_preferences=True
      await load('/settings/notifications')
      area=await required(page.locator('[data-studio-notifications=true]'))
      await expect(area.get_by_role('switch')).to_have_count(3)
      for control in await area.get_by_role('switch').all():await expect(control).to_be_disabled()
      await expect(area.get_by_role('alert')).to_be_visible()
      await expect(area).not_to_contain_text('Preferences saved')
      await shot('notifications-unavailable-disabled')
      refuse_preferences=False
      await area.get_by_role('button',name='Retry loading',exact=True).click()
      await expect(area.get_by_role('switch',name='Account Activity',exact=True)).to_be_checked()
      await expect(area.get_by_role('switch',name='Product Updates',exact=True)).not_to_be_checked()
      await expect(area.get_by_role('switch',name='Marketing & Promotions',exact=True)).not_to_be_checked()
      await shot('notifications-confirmed-record')
      control=area.get_by_role('switch',name='Product Updates',exact=True)
      await control.focus();await page.keyboard.press('Space')
      row=area.locator('[data-studio-notification=emailProductUpdates]')
      await expect(row).to_have_attribute('data-unsaved','true')
      await expect(control).to_be_checked();await expect(row.get_by_role('alert')).to_be_visible()
      await expect(row).to_contain_text('last confirmed off')
      await shot('notifications-refused-choice-retained')
      await area.get_by_role('button',name='Refresh',exact=True).click()
      await expect(row).to_have_attribute('data-unsaved','true');await expect(control).to_be_checked()
      await row.get_by_role('button',name='Retry choice',exact=True).click()
      await expect(row.get_by_role('alert')).to_be_visible()
      assert [item['body'] for item in denied]==[{'emailProductUpdates':True},{'emailProductUpdates':True}],denied
      await row.get_by_role('button',name='Discard local choice',exact=True).click()
      await expect(control).not_to_be_checked();await expect(row).to_have_attribute('data-unsaved','false')
      await expect(area).to_contain_text('Email delivery will activate when notifications ship.')
      await shot('notifications-discard-last-confirmed')
      checks['unavailableRecordDisabledExactThreeNamedSwitches']=True
      checks['refusedKeyboardChoiceRefreshRetryRetention']=True
      checks['exactEmailPatchDiscardAndDeliveryDisclosure']=True
     elif args.area=='guide':
      await ctx.add_init_script("if(location.origin==='"+BASE+"'){localStorage.setItem('hasSeenOnboarding','true');localStorage.setItem('isNewUser','true');localStorage.setItem('studio-proof-draft','untouched');}")
      if w>=1000:
       await load('/builder?session_id='+SESSION)
       iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
       await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
       composer=page.locator('[data-studio-v4-composer] textarea').first;await composer.fill('Keep my work during the introduction.')
       await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       replay=page.locator('[data-studio-canvas-brand=true] [data-studio-intro-replay=true]')
       await replay.focus();await page.keyboard.press('Enter')
       guide=await required(page.locator('[data-studio-onboarding=true]'))
       for title,name in [('Start with a spark.','guide-spark'),('Shape the story.','guide-story'),('Make it ready to share.','guide-delivery')]:
        await expect(guide.get_by_role('heading',name=title,exact=True)).to_be_visible()
        if name=='guide-spark':await expect(guide.get_by_role('heading',name=title,exact=True)).to_be_focused()
        else:await expect(guide.get_by_role('button',name='Enter Studio' if name=='guide-delivery' else 'Next',exact=True)).to_be_focused()
        await shot(name)
        footer=await guide.locator('footer').bounding_box();assert footer and footer['y']+footer['height']<=h,footer
        await guide.get_by_role('button',name='Enter Studio' if name=='guide-delivery' else 'Next',exact=True).click()
       await expect(guide).to_have_count(0);await expect(replay).to_be_focused()
       await expect(composer).to_have_value('Keep my work during the introduction.')
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       await replay.click();guide=await required(page.locator('[data-studio-onboarding=true]'))
       await expect(guide.get_by_role('heading',name='Start with a spark.',exact=True)).to_be_visible()
       await page.keyboard.press('Escape');await expect(replay).to_be_focused()
      await load('/studio/themes')
      library=await required(page.locator('[data-studio-library=themes]'))
      await library.get_by_role('button',name='Library',exact=True).click()
      search=library.get_by_role('textbox',name='Search saved themes',exact=True)
      await search.fill('Quarterly')
      replay=library.locator('[data-studio-intro-replay=true]')
      await replay.click();guide=await required(page.locator('[data-studio-onboarding=true]'))
      await shot('guide-library-replay')
      await guide.get_by_role('button',name='Skip introduction',exact=True).click()
      await expect(replay).to_be_focused();await expect(search).to_have_value('Quarterly')
      await page.get_by_role('button',name='Open account menu',exact=True).click()
      await page.get_by_role('menuitem',name='About Studio',exact=True).click()
      about=await required(page.locator('[data-studio-about=true]'))
      await shot('about-studio')
      await about.get_by_role('button',name='Replay introduction',exact=True).click()
      guide=await required(page.locator('[data-studio-onboarding=true]'))
      await shot('guide-about-replay')
      await page.keyboard.press('Escape')
      await expect(about.get_by_role('button',name='Replay introduction',exact=True)).to_be_focused()
      await about.get_by_role('button',name='Back to my work',exact=True).click()
      await expect(page.get_by_role('button',name='Open account menu',exact=True)).to_be_focused()
      assert await page.evaluate("localStorage.getItem('studio-proof-draft')==='untouched' && localStorage.getItem('hasSeenOnboarding')==='true' && localStorage.getItem('isNewUser')==='true'")
      checks['nativeManualGuideChaptersReplayAndReturnFocus']=True
      checks['libraryDraftAndUnrelatedUserFlagsPreserved']=True
      checks['aboutAndReplayEntriesNoGenerationOrReset']=True
     elif args.area=='profile':
      await load('/settings/profile')
      area=await required(page.locator('[data-studio-settings-profile=true]'))
      upload=area.get_by_role('button',name='Change avatar',exact=True)
      await page.keyboard.press('Tab');await upload.focus();await expect(upload).to_be_focused()
      await page.wait_for_function("getComputedStyle(document.querySelector('[data-studio-settings-profile-upload=true]')).opacity==='1'")
      assert await upload.evaluate("e=>getComputedStyle(e).opacity")=='1'
      await shot('profile-avatar-keyboard-focus')
      await area.get_by_role('button',name='Edit Profile',exact=True).click()
      field=area.get_by_role('textbox',name='Display Name',exact=True)
      await field.fill('Keep this local profile name')
      await shot('profile-name-focus')
      await area.get_by_role('button',name='Save',exact=True).click()
      await expect(area.get_by_role('alert')).to_contain_text('refuses writes')
      await expect(field).to_have_value('Keep this local profile name')
      await shot('profile-name-refused-retained')
      await area.get_by_role('button',name='Cancel',exact=True).click()
      import base64
      await area.locator('input[type=file]').set_input_files({'name':'local-avatar.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')})
      await expect(area.get_by_role('alert')).to_contain_text('refuses avatar')
      await expect(area.locator('input[type=file]')).to_have_value('')
      await shot('profile-avatar-refused-reselectable')
      checks['nativeProfileKeyboardFocusAndNameLabel']=True
      checks['refusedNameRetainsDraftAvatarInputResets']=True
      assert len(denied)==2,denied
     elif args.area=='appearance':
      await load('/settings/appearance')
      area=await required(page.locator('[data-studio-appearance-settings=true]'))
      initial='dark' if dark else 'light'
      await expect(area.locator('[data-studio-appearance-choice='+initial+']')).to_have_attribute('aria-pressed','true')
      await shot('appearance-current')
      for choice in ['light','dark','system']:
       control=area.locator('[data-studio-appearance-choice='+choice+']')
       await control.focus();await page.keyboard.press('Enter')
       await expect(control).to_have_attribute('aria-pressed','true')
       await expect(control).to_be_focused()
       await expect(page.locator('html')).to_have_class(__import__('re').compile(r'\b'+('dark' if choice=='dark' or choice=='system' and dark else 'light')+r'\b'))
       await shot('appearance-'+choice+'-keyboard')
      await expect(area.locator('.sas-status')).to_contain_text('System · currently '+initial)
      checks['actualBrowserAppearanceChoicesAndSystemPreference']=True
      checks['nativeKeyboardSelectionAndFocus']=True
     elif args.area=='manual-deck-conflict':
      await load('/studio-local-review/manual-deck-conflict')
      area=await required(page.locator('[data-studio-manual-conflict-fixture=true]'))
      draft=area.get_by_role('textbox',name='Retained local draft',exact=True)
      await draft.fill('Keep this unsent draft through the customized-slide choice.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      opener=area.locator('[data-local-conflict-opener=true]')
      async def open_conflict():
       await page.keyboard.press('Tab');await opener.focus();await page.keyboard.press('Enter')
       dialog=await required(page.locator('[data-studio-manual-deck-conflict=true]'))
       await expect(dialog).to_contain_text('3 customized slides')
       await expect(dialog).to_contain_text('7 added elements')
       await fits_clip(dialog.get_by_role('heading',name='Keep your customized slides?',exact=True))
       return dialog
      dialog=await open_conflict()
      cancel=dialog.get_by_role('button',name='Cancel',exact=True)
      await expect(cancel).to_be_focused();await fits_clip(cancel,True)
      for choice in await dialog.locator('[data-studio-manual-conflict-choice]').all():await fits_clip(choice,True)
      await shot('manual-deck-choice-native-cancel-focus')
      await page.keyboard.press('Enter');await expect(dialog).to_have_count(0);await expect(opener).to_be_focused()
      await expect(draft).to_have_value('Keep this unsent draft through the customized-slide choice.')
      checks['nativeConflictCountsChoicesFitAndCancelReturnsActualOpener']=True
      await area.get_by_role('checkbox',name='Supplied complete error',exact=True).check()
      dialog=await open_conflict()
      error=dialog.locator('[data-studio-manual-conflict-part=error]')
      await expect(error).to_contain_text('End of the complete synthetic explanation.')
      await error.focus();await expect(error).to_be_focused();await fits_clip(error)
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown')
      await page.wait_for_function("document.querySelector('[data-studio-manual-conflict-part=error]').scrollTop>0",timeout=2000)
      assert await error.evaluate('e=>e.scrollTop')>0
      assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      await fits_clip(dialog.get_by_role('button',name='Cancel',exact=True),True)
      await shot('manual-deck-choice-full-error-keyboard-scroll')
      await dialog.get_by_role('button',name='Cancel',exact=True).click();await expect(dialog).to_have_count(0);await expect(opener).to_be_focused()
      await expect(draft).to_have_value('Keep this unsent draft through the customized-slide choice.')
      checks['fullSuppliedConflictErrorScrollsWithoutCanvasCommand']=True
      await area.get_by_role('checkbox',name='Supplied busy state',exact=True).check()
      dialog=await open_conflict();await expect(dialog).to_have_attribute('aria-busy','true')
      for button in await dialog.get_by_role('button').all():await expect(button).to_be_disabled()
      await shot('manual-deck-choice-supplied-busy')
      await expect(area.get_by_label('Local conflict callback counters',exact=True)).to_have_text('Cancel 2 · Prepend 0 · New session 0')
      await expect(area.locator('textarea')).to_have_value('Keep this unsent draft through the customized-slide choice.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['suppliedBusyDisablesNativeChoicesDraftIframeNoBuildOrAcknowledgement']=True
     elif args.area=='session-history':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True))
      await composer.fill('Keep this unsent draft after refused session deletion.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      url=page.url
      await page.get_by_role('button',name='Open deck list',exact=True).click()
      history=await required(page.locator('[data-studio-session-history=true]'))
      await history.get_by_role('button',name='Select',exact=True).click()
      await history.get_by_role('checkbox',name='Select All Visible',exact=False).check()
      await expect(history.locator('[data-studio-session-part=bulk-actions]')).to_contain_text('1 selected')
      await history.get_by_role('button',name='Delete Selected',exact=True).click()
      confirm=await required(page.locator('[data-studio-session-dialog=session-history]'))
      await shot('session-bulk-native-confirmation')
      await confirm.get_by_role('button',name='Delete',exact=True).click()
      await expect(confirm).to_have_count(0)
      result=await required(history.locator('[data-studio-session-part=bulk-result]'))
      await expect(result).to_contain_text('No session deletions confirmed.')
      await expect(result).to_contain_text('Deletion could not be confirmed for 1 session.')
      await expect(history.locator('[data-studio-session-row=true]')).to_have_count(1)
      await expect(history.get_by_role('checkbox',name='Select All Visible',exact=False)).to_be_checked()
      await expect(history.locator('[data-studio-session-part=bulk-actions]')).to_contain_text('1 selected')
      await history.get_by_role('button',name='Delete Selected',exact=True).focus();await shot('session-bulk-refused-retained-selection')
      assert page.url==url and len(denied)==1 and denied[0]['method']=='DELETE' and denied[0]['path']==f'/api/sessions/{SESSION}',denied
      await page.keyboard.press('Enter');confirm=await required(page.locator('[data-studio-session-dialog=session-history]'))
      await confirm.get_by_role('button',name='Cancel',exact=True).focus();await shot('session-bulk-retry-confirmation-cancel-focus')
      await page.keyboard.press('Enter');await expect(confirm).to_have_count(0);assert len(denied)==1,denied
      await history.get_by_role('button',name='Dismiss bulk deletion result',exact=True).click();await expect(result).to_have_count(0)
      await history.get_by_role('button',name='Close sessions',exact=True).click()
      await expect(composer).to_have_value('Keep this unsent draft after refused session deletion.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await shot('session-bulk-draft-canvas-retained')
      checks['nativeRefusedSessionDeletionRetainsSelectionRowAndCurrentSession']=True
      checks['retryRequiresExplicitNativeConfirmationCancelDoesNotRetry']=True
      checks['draftAndIframeRetainedNoSuccessAcknowledgement']=True
     elif args.area=='stage-placeholder':
      await load('/studio-local-review/stage-placeholder')
      area=await required(page.locator('[data-studio-stage-specimen=true]'))
      select=area.locator('[data-studio-stage-specimen-selector=true]')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      async def clipped_fit(locator,hit=False):
       data=await locator.evaluate("""(e,hit)=>{const b=e.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}if(/hidden|clip|auto|scroll/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}}return {box:b.toJSON(),clip:{left,top,right,bottom},fits:b.left>=left-1&&b.top>=top-1&&b.right<=right+1&&b.bottom<=bottom+1,hit:!hit||e.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2))}}""",hit)
       assert data['fits'] and data['hit'],data
      for state in ['idle','planning']:
       await select.select_option(state)
       overlay=await required(page.locator('[data-studio-stage-placeholder=overlay]'))
       await expect(overlay).to_have_attribute('data-has-dismiss','true')
       heading=overlay.get_by_text('Your deck will appear here',exact=True)
       help=overlay.get_by_text("Tell Director what you want to build",exact=False)
       dismiss=overlay.get_by_role('button',name='Start on this blank canvas',exact=True)
       await clipped_fit(heading);await clipped_fit(help);await clipped_fit(dismiss,True)
       hb=await help.bounding_box();db=await dismiss.bounding_box();assert hb['y']+hb['height']<=db['y']-2,(hb,db)
       await page.keyboard.press('Tab');await dismiss.focus();await expect(dismiss).to_be_focused()
       await shot('stage-placeholder-'+state+'-dismiss-focus')
       await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
       await page.keyboard.press('Enter')
       await expect(overlay).to_have_count(0);await expect(area).to_have_attribute('data-studio-stage-specimen-dismissed','true')
       await expect(area.locator('[data-studio-stage-specimen-status=true]')).to_contain_text('Manually dismissed')
       assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       await shot('stage-placeholder-'+state+'-dismissed')
       await area.locator('[data-studio-stage-specimen-reset=true]').click();await expect(overlay).to_have_count(1)
      checks['nativePlaceholderOverlayFitsActualClippedStageAndDismissReachable']=True
      checks['nativeExplicitDismissRevealsSameIframeWithoutCanvasCommand']=True
      for state in ['authored','feature-off','strawman']:
       await select.select_option(state);await expect(page.locator('[data-studio-stage-placeholder]')).to_have_count(0)
       await expect(area.locator('[data-studio-stage-specimen-status=true]')).to_contain_text('suppressed')
      await shot('stage-placeholder-strawman-gate-suppressed')
      checks['authoredNarrationOffAndStrawmanGateInputsSuppressOverlay']=True
      await select.select_option('standalone')
      leaf=await required(page.locator('[data-studio-stage-placeholder=standalone]'))
      await expect(leaf).to_have_attribute('data-has-dismiss','false')
      await expect(leaf.get_by_role('button')).to_have_count(0)
      await clipped_fit(leaf.get_by_text('Your deck will appear here',exact=True))
      await clipped_fit(leaf.get_by_text('Tell Director what you want to build',exact=False))
      await shot('stage-placeholder-standalone-fallback')
      checks['nativeStandaloneFallbackFullGuidanceNoDismiss']=True
     elif args.area=='theme-panel':
      await load('/builder?session_id='+SESSION+'&studio_action=theme')
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent draft through unapplied theme review.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      panel=await required(page.locator('[data-studio-theme=true]'))
      locked=await required(panel.locator('[data-studio-theme-notice=locked]'))
      await locked.focus();await fits_clip(locked)
      await expect(panel.locator('[data-studio-theme-mode=custom]')).to_be_disabled()
      await fits_clip(panel.get_by_role('button',name='Close deck theme panel',exact=True),True)
      await shot('theme-native-locked-notice-focus')
      await panel.get_by_role('button',name='Close deck theme panel',exact=True).click()
      await expect(composer).to_have_value('Keep this unsent draft through unapplied theme review.')
      session.update({'currentStage':2,'finalPresentationUrl':None,'finalPresentationId':None,'strawmanPreviewUrl':VIEWER,'strawmanPresentationId':'studio-v4-local-renderer','stateCache':{**session['stateCache'],'activeVersion':'strawman'}})
      await load('/builder?session_id='+SESSION+'&studio_action=theme')
      panel=await required(page.locator('[data-studio-theme=true]'))
      await expect(panel.locator('[data-studio-theme-notice=locked]')).to_have_count(0)
      await expect(panel.locator('[data-studio-theme-preset]')).to_have_count(7)
      await expect(panel.locator('[data-studio-theme-preset=auto]')).to_have_attribute('aria-pressed','true')
      await shot('theme-native-auto-unapplied')
      await panel.locator('[data-studio-theme-preset=corporate_dark]').click();await expect(panel.locator('[data-studio-theme-preset=corporate_dark]')).to_have_attribute('aria-pressed','true')
      await panel.locator('[data-studio-theme-mode=custom]').click();await expect(panel.locator('[data-studio-theme-mode=custom]')).to_have_attribute('aria-pressed','true')
      await expect(panel.locator('[data-studio-theme-color]')).to_have_count(14)
      primary=panel.get_by_role('textbox',name='Primary / brand hex value',exact=True)
      await primary.fill('not-a-hex');await expect(primary).to_have_attribute('aria-invalid','true')
      await expect(panel.get_by_role('button',name='Apply through Director',exact=True)).to_be_disabled()
      await primary.focus();await fits_clip(primary);await shot('theme-native-custom-invalid-focus')
      await primary.fill('#346655');await expect(primary).to_have_attribute('aria-invalid','false')
      last=panel.get_by_role('textbox',name='Border hex value',exact=True);await last.focus();await expect(last).to_be_focused();await fits_clip(last)
      await fits_clip(panel.get_by_role('button',name='Apply through Director',exact=True),True)
      await shot('theme-native-last-override-keyboard')
      assert not denied,denied
      checks['nativeLockedAndAutoThemeNoticesAllSevenPresets']=True
      checks['allFourCustomTenOverrideFieldsInvalidGuardAndLastFocus']=True
      checks['draftRetainedNoThemeApplyOrAcknowledgement']=True
     elif args.area=='theme-states':
      await load('/studio-local-review/theme-panel')
      area=await required(page.locator('[data-studio-theme-fixture=true]'))
      draft=area.get_by_role('textbox',name='Local retained draft',exact=True);await draft.fill('Keep this local draft through supplied native theme statuses.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      for state in ['idle','syncing','applied','failed']:
       await area.locator('[data-studio-theme-fixture-state='+state+']').click()
       panel=await required(page.locator('[data-studio-theme=true]'))
       await expect(panel.locator('[data-studio-theme-sync='+state+']')).to_have_count(1)
       await fits_clip(panel.get_by_role('button',name='Close deck theme panel',exact=True),True)
       if state=='failed':
        error=panel.locator('[data-studio-theme-notice=failed]');await expect(error).to_contain_text('[END OF LOCAL THEME FAILURE]')
        await error.focus();await fits_clip(error)
        await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
        await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_function("document.querySelector('[data-studio-theme-notice=failed]').scrollTop>0")
        assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
       await shot('theme-supplied-'+state)
       await expect(draft).to_have_value('Keep this local draft through supplied native theme statuses.')
      await area.locator('[data-studio-theme-fixture-lock=true]').check()
      panel=await required(page.locator('[data-studio-theme=true]'))
      await required(panel.locator('[data-studio-theme-notice=locked]'))
      await expect(panel.locator('[data-studio-theme-mode=custom]')).to_be_disabled()
      await panel.get_by_role('button',name='Close deck theme panel',exact=True).click();await expect(panel).to_have_count(0)
      await expect(draft).to_have_value('Keep this local draft through supplied native theme statuses.')
      await expect(area.locator('[data-studio-theme-fixture-refusals=true]')).to_contain_text('0')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeSuppliedFourSyncStatusesFullFailureKeyboardAndCloseFit']=True
      checks['suppliedLockCloseRetainsDraftIframeNoApplyCallback']=True
     elif args.area=='generation-feedback':
      await load('/studio-local-review/specialist-forms')
      area=await required(page.locator('[data-studio-specialist-specimen=true]'))
      composer=area.locator('[data-studio-specialist-specimen-draft=true]');await composer.fill('Keep this unsent draft while reading the supplied generation diagnostic.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      panel=await required(page.locator('[data-studio-v4-panel=element-generation]'))
      prompt=panel.get_by_role('textbox',name='Generation prompt',exact=True)
      await prompt.fill('Retained local element prompt through native feedback inspection.')
      advanced=panel.get_by_role('button',name='Show advanced options',exact=True)
      await expect(advanced).to_have_attribute('aria-expanded','false')
      await advanced.click();await expect(panel.get_by_role('button',name='Hide advanced options',exact=True)).to_have_attribute('aria-expanded','true')
      for state,label_name in [('retry','Check generation result'),('fresh','Try fresh generation'),('update',None)]:
       await area.locator('[data-studio-specialist-feedback-case=true]').select_option(state)
       feedback=await required(panel.locator('[data-studio-generation-feedback=true]'))
       error=feedback.get_by_role('region',name='Generation error details',exact=True)
       await expect(error).to_contain_text('End of the complete supplied generation diagnostic.')
       await error.focus();await expect(error).to_be_focused();await fits_clip(error)
       await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
       await page.keyboard.press('End');await page.keyboard.press('ArrowDown')
       await page.wait_for_function("document.querySelector('[data-studio-generation-feedback-text=true]').scrollTop>0")
       assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
       guidance=feedback.locator('[data-studio-generation-feedback-guidance=true]')
       await fits_clip(guidance, bool(label_name))
       if label_name:await expect(guidance).to_have_text(label_name);await expect(guidance).to_be_enabled()
       else:await expect(guidance).to_have_text('Update the prompt or settings before generating again.')
       fields=panel.locator('[data-studio-v4-panel-fields]');box=await fields.bounding_box();assert box and box['height']>=60,box
       await fits_clip(prompt)
       await shot('generation-feedback-'+state+'-full-diagnostic-scroll')
       await expect(prompt).to_have_value('Retained local element prompt through native feedback inspection.')
       await expect(composer).to_have_value('Keep this unsent draft while reading the supplied generation diagnostic.')
      await expect(area.locator('[data-studio-specialist-specimen-attempts=true]')).to_contain_text('0')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['fullNativeGenerationDiagnosticScrollsWithRetryGuidanceVisible']=True
      checks['nativeAdvancedPromptLabelsRemainingFieldsAndDraftsRetained']=True
      checks['noRetryGenerateOrCanvasCommandNoServiceAcknowledgement']=True
     elif args.area=='specialist-forms':
      await load('/studio-local-review/specialist-forms')
      area=await required(page.locator('[data-studio-specialist-specimen=true]'))
      await expect(area).to_contain_text('No Add Element acknowledgement, generation or research runs here.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      composer=area.locator('[data-studio-specialist-specimen-draft=true]')
      await composer.fill('Keep this unsent specialist forms review draft.')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      for name,selector in [('Image','[data-studio-image-form=true]'),('Table','[data-studio-specialist-form=table]'),('Metrics','[data-studio-specialist-form=metrics]'),('Chart','[data-studio-specialist-form=chart]'),('Diagram','[data-studio-specialist-form=diagram]'),('Shape','[data-studio-visual-form=shape]'),('Icon / Label','[data-studio-visual-form=icon-label]'),('Text Box','[data-studio-content-form=text-box]'),('Infographic','[data-studio-content-form=infographic]')]:
       key=name.lower().replace(' / ','-').replace(' ','-')
       component={'Image':'IMAGE','Table':'TABLE','Metrics':'METRICS','Chart':'CHART','Diagram':'DIAGRAM','Shape':'SHAPE','Icon / Label':'ICON_LABEL','Text Box':'TEXT_BOX','Infographic':'INFOGRAPHIC'}[name]
       await area.locator('[data-studio-specialist-specimen-type=true]').select_option(component)
       panel=await required(page.locator('[data-studio-v4-panel=element-generation]'))
       await expect(panel).to_have_attribute('data-studio-v4-panel-mode','generate')
       form=panel.locator(selector);await expect(form).to_be_attached()
       await panel.locator('textarea').first.fill('Local unsent '+name+' prompt.')
       await shot(key+'-native-options')
       await panel.get_by_title('Show advanced options',exact=True).click()
       await required(panel.get_by_title('Hide advanced options',exact=True))
       await required(form)
       if name=='Image':
        await form.get_by_role('button',name='Style',exact=True).click()
        style=form.get_by_role('combobox',name='Image style',exact=True);await expect(style.locator('option')).to_have_count(9)
        await style.select_option(index=2)
        quality=form.get_by_role('combobox',name='Image quality',exact=True);await expect(quality.locator('option')).to_have_count(5);await quality.select_option('high');await quality.focus();await fits_clip(quality)
        await shot('image-native-style-quality-focus')
        await form.get_by_role('button',name='Position & Size',exact=True).click()
        ratios=form.get_by_role('group',name='Image aspect ratio',exact=True).get_by_role('button');await expect(ratios).to_have_count(6)
        ratio=form.get_by_role('button',name='Image aspect ratio 16:9',exact=True);await ratio.click();await expect(ratio).to_have_attribute('aria-pressed','true')
        await form.get_by_role('group',name='Positioning',exact=True).get_by_role('button',name='Positioning: Manual',exact=True).click()
        presets=form.get_by_role('group',name='Image position presets',exact=True).get_by_role('button');await expect(presets).to_have_count(9)
        await presets.last.click();await expect(presets.last).to_have_attribute('aria-pressed','true');await presets.last.focus();await fits_clip(presets.last,True)
        await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
        assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
        await shot('image-native-position-preset-keyboard')
        for field_name in ['Image column (grid)','Image row (grid)','Image width (grid)','Image height (grid)']:
         field=form.get_by_role('spinbutton',name=field_name,exact=True);await field.focus();await fits_clip(field)
        height_field=form.get_by_role('spinbutton',name='Image height (grid)',exact=True);await height_field.fill('8.2');await height_field.focus();await expect(height_field).to_have_value('8.2');await fits_clip(height_field)
        await shot('image-native-final-size-focus')
        checks['nativeImageEightStylesFourQualitiesAspectPresetsFractionalUnitsKeyboard']=True
       elif name=='Table':
        await form.get_by_role('group',name='Table structure mode',exact=True).get_by_role('button',name='Manual',exact=True).click()
        rows=form.get_by_role('combobox',name='Manual table rows',exact=True);await rows.select_option('10');await expect(rows.locator('option')).to_have_count(10)
        cols=form.get_by_role('combobox',name='Manual table columns',exact=True);await cols.select_option('6');await expect(cols.locator('option')).to_have_count(5)
        await form.get_by_role('button',name='Columns & semantics',exact=True).click()
        await form.get_by_role('button',name='Customize',exact=True).click()
        align=form.get_by_role('combobox',name='Column 1 alignment',exact=True);await align.select_option('center');await align.focus()
        await expect(align).to_have_value('center');await shot('table-column-rendering-focus')
        await form.get_by_role('button',name='Totals, alignment & cell marks',exact=True).click()
        mark=form.get_by_role('combobox',name='Cell mark style',exact=True);await mark.select_option('arrow');await mark.focus();await expect(mark).to_have_value('arrow')
        await form.get_by_role('button',name='Positioning',exact=True).click()
        position=await required(form.locator('[data-studio-generation-geometry=position]'))
        await position.get_by_role('group',name='Positioning',exact=True).get_by_role('button',name='Manual',exact=True).click()
        presets=position.get_by_role('group',name='Position presets',exact=True).get_by_role('button');await expect(presets).to_have_count(9)
        await presets.last.click();await expect(presets.last).to_have_attribute('aria-pressed','true');await presets.last.focus()
        await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
        await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
        assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
        await shot('table-position-preset-keyboard')
        await form.get_by_role('button',name='Container padding',exact=True).click()
        padding=await required(form.locator('[data-studio-generation-geometry=padding]'))
        await padding.get_by_role('group',name='Padding mode',exact=True).get_by_role('button',name='Individual',exact=True).click()
        field=padding.get_by_role('spinbutton',name='top padding (px)',exact=True);await field.fill('12');await field.focus();await expect(field).to_have_value('12')
        await shot('table-padding-individual-focus')
        checks['nativeGeometryPresetsUnitsPaddingChoicesAndKeyboardOwnership']=True
       elif name=='Metrics':
        fit=form.get_by_role('combobox',name='Metrics fit mode',exact=True);await fit.select_option('MANUAL')
        await form.get_by_role('button',name='Value',exact=True).click()
        font=form.get_by_role('combobox',name='Value font size',exact=True);await font.select_option('24px');await font.focus();await expect(font).to_have_value('24px')
       elif name=='Chart':
        types=panel.get_by_role('combobox',name='Chart Type',exact=True);await expect(types.locator('option')).to_have_count(15)
        await form.get_by_role('button',name='Data Source: Custom JSON',exact=True).click()
        data=form.get_by_role('textbox',name='Custom Data (JSON)',exact=True);await data.fill('{invalid JSON');await expect(data).to_have_attribute('aria-invalid','true');await expect(form.locator('#chart-custom-data-description')).to_have_attribute('role','alert');await data.focus()
       elif name=='Diagram':
        types=panel.get_by_role('combobox',name='Diagram type',exact=True);await expect(types.locator('option')).to_have_count(10);await types.select_option('CODE_DISPLAY');await types.focus()
       elif name=='Shape':
        await form.get_by_role('button',name='Styling',exact=True).click()
        rotation=form.get_by_role('slider',name='Rotation',exact=True);await rotation.focus();await expect(rotation).to_have_attribute('aria-valuetext', '0 degrees')
       elif name=='Icon / Label':
        await form.get_by_role('button',name='Position & Size',exact=True).click()
        col=form.get_by_role('spinbutton',name='Col',exact=True);await col.fill('3');await col.focus();await expect(col).to_have_value('3')
       elif name=='Text Box':
        await form.get_by_role('button',name='Box Design',exact=True).click()
        transparent=form.get_by_role('button',name='Use transparent box color',exact=True);await transparent.click();await transparent.focus();await expect(transparent).to_have_attribute('aria-pressed','true')
       elif name=='Infographic':
        await form.get_by_role('group',name='Infographic design',exact=True).get_by_role('button',name='Structured',exact=False).click()
        await form.get_by_role('group',name='Structured content mode',exact=True).get_by_role('button',name='Manual rows',exact=True).click()
        for field in ['heading','short explanatory line','relevant icon hint','supporting description']:
         control=form.get_by_role('textbox',name='Row 1 '+field,exact=True);await control.fill('Local unsent '+field);await expect(control).to_have_value('Local unsent '+field)
        await form.get_by_role('textbox',name='Row 1 supporting description',exact=True).focus()
       focus=await panel.evaluate("""e=>{const f=document.activeElement,v=f?.closest('[data-studio-v4-panel-fields]');if(!v||!e.contains(f))return null;return {field:f.getBoundingClientRect().toJSON(),viewport:v.getBoundingClientRect().toJSON(),name:f.getAttribute('aria-label')}}""")
       if focus:
        assert focus['field']['y']>=focus['viewport']['y']+3 and focus['field']['y']+focus['field']['height']<=min(h,focus['viewport']['y']+focus['viewport']['height'])-3,focus
       await shot(key+'-advanced-focus')
       if name=='Icon / Label':
        for label_name in ['Row','Width','Height']:
         await page.keyboard.press('Tab');await expect(form.get_by_role('spinbutton',name=label_name,exact=True)).to_be_focused()
        last=form.get_by_role('spinbutton',name='Height',exact=True)
        box=await last.bounding_box();view=await panel.locator('[data-studio-v4-panel-fields]').bounding_box()
        assert box and view and box['y']>=view['y']+3 and box['y']+box['height']<=min(h,view['y']+view['height'])-3,(box,view)
        await shot('icon-label-final-geometry-keyboard')
        checks['lastGeometryFieldNativeTabReachableWithFocusClearance']=True
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
       await expect(composer).to_have_value('Keep this unsent specialist forms review draft.')
      assert not denied,denied
      await expect(area.locator('[data-studio-specialist-specimen-attempts=true]')).to_have_text('Refused generation attempts: 0')
      checks['eightActualNativeFormRouterComponentsAndAdvancedControls']=True
      checks['tableMetricsChartDiagramShapeIconTextInfographicChoicesFocusRetained']=True
      checks['iframeAndLocalDraftPreservedNoGenerationSubmission']=True
      checks['nativeDiagramVersionedFallbackReadOnlyNoService']=True
      checks['zeroHorizontalShiftAndNative400pxInspectorAnchored']=True
     elif args.area=='generation-forms':
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      composer=page.locator('[data-studio-v4-composer] textarea').first
      await composer.fill('Keep this unsent inspector review draft.')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      for name,event in [('Text',previous.TEXT),('Image',previous.IMAGE)]:
       await iframe.content_frame.get_by_role('button',name='Inspect fixture '+name,exact=True).click()
       panel=await required(page.locator('[data-studio-v4-panel=element-generation]'))
       await expect(panel).to_have_attribute('data-studio-v4-panel-mode','refine')
       await expect(panel.locator('textarea').first).to_have_value(event['generationConfig']['prompt'])
       await panel.locator('textarea').first.fill('Unsent '+name+' refinement draft.')
       await shot(name.lower()+'-refine-native')
       if name=='Text':
        await panel.get_by_role('button',name='Content',exact=True).click()
        font=await required(panel.locator('[data-studio-generation-context=font]'))
        size=font.get_by_role('combobox',name='Content Font size',exact=True)
        await size.select_option('24px');await expect(size).to_have_value('24px')
        await font.get_by_role('button',name='Content Font bold',exact=True).click()
        await expect(font.get_by_role('button',name='Content Font bold',exact=True)).to_have_attribute('aria-pressed','true')
        await font.get_by_role('button',name='Content Font color: Teal',exact=True).click()
        await expect(font.get_by_role('button',name='Content Font color: Teal',exact=True)).to_have_attribute('aria-pressed','true')
        await size.focus();await shot('text-font-native-selected-focus')
        await size.select_option('');await font.get_by_role('button',name='Content Font bold',exact=True).click()
        await font.get_by_role('button',name='Content Font color: Auto',exact=True).click()
        await expect(size).to_have_value('');await expect(font.get_by_role('button',name='Content Font bold',exact=True)).to_have_attribute('aria-pressed','false')
        checks['nativeFontSelectionAndAutoNullReset']=True
       if name=='Image':
        await expect(panel.get_by_label('Image operation',exact=True)).to_have_value('edit')
        await panel.get_by_role('button',name='Image style',exact=True).click()
        options=await required(page.locator('[data-studio-generation-options=true]'))
        await expect(options).to_have_attribute('aria-label','Image style options')
        await options.get_by_role('button').first.focus()
        await shot('image-style-options-focus')
        last=options.get_by_role('button').last
        await last.focus();await expect(last).to_be_focused()
        box=await last.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=h,box
        await shot('image-style-final-option-keyboard')
        checks['lastImageStyleAccessibleInBoundedPopup']=True
        await page.keyboard.press('Escape')
       assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await page.get_by_title('Open slide panel',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      await panel.locator('textarea').first.fill('Unsent slide composition draft.')
      await shot('slide-compose-native')
      if await page.get_by_title('Show thumbnails',exact=True).count():await page.get_by_title('Show thumbnails',exact=True).click()
      await page.get_by_role('button',name='Refine slide 1',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      await panel.get_by_placeholder('What should change?',exact=True).fill('Keep the evidence; clarify the title.')
      await shot('slide-refine-native')
      await expect(composer).to_have_value('Keep this unsent inspector review draft.')
      checks['actualTextImageComposeAndRefineWithoutSubmission']=True
      checks['actualGroupedImageStyleOptionsAndFocus']=True
      checks['iframeAndUnsentChatDraftRetained']=True
      checks['noHorizontalWorkspaceShiftAndInspectorAnchored']=True
     elif args.area=='owner-inbox':
      refuse_inbox=True
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Show script and notes',exact=True).click()
      await page.get_by_role('tab',name='Q&A',exact=False).click()
      inbox=await required(page.locator('[data-studio-qa-inbox=true]'))
      await required(inbox.locator('[role=alert]'))
      await shot('owner-questions-read-error')
      refuse_inbox=False
      await inbox.locator('[data-studio-qa-inbox-retry=true]').click()
      await expect(inbox.locator('.studio-qa-question')).to_have_count(3)
      checks['caughtReadErrorAndNativeRetryRecovery']=True
      await expect(inbox.locator('[data-question-status=blocked]').get_by_role('button')).to_have_count(0)
      await shot('owner-questions-queue')
      item=inbox.locator('[data-question-status=deferred]')
      await item.get_by_role('button',name='Answer',exact=True).click()
      answer=item.get_by_role('textbox',name='Your answer',exact=True)
      await expect(answer).to_be_focused();await expect(answer).to_have_attribute('aria-describedby','studio-qa-question-fixture-deferred')
      await answer.fill('Keep this locally drafted answer.')
      await shot('owner-answer-focus')
      await item.get_by_role('button',name='Send',exact=True).click()
      await expect(page.get_by_text('Local fixture refuses answers; keep your draft.',exact=True)).to_be_visible()
      await expect(answer).to_have_value('Keep this locally drafted answer.')
      await shot('owner-answer-refused-retained')
      await item.get_by_role('button',name='Cancel',exact=True).click()
      await item.get_by_role('button',name='Answer',exact=True).click()
      await expect(answer).to_have_value('Keep this locally drafted answer.')
      checks['actualQueueStatusesAndDescribedAnswerFocus']=True
      checks['refusedAnswerAndCancelReopenKeepDraft']=True
      assert len(denied)==1 and denied[0]['body']=={'answerText':'Keep this locally drafted answer.'},denied
      questions_enabled=False
      await inbox.get_by_role('button',name='Refresh',exact=True).click()
      await expect(inbox).to_contain_text('Sharing')
      await shot('owner-questions-disabled-location')
      checks['disabledQuestionsShowsActualEnableLocation']=True
     elif args.area=='knowledge-settings':
      refuse_settings=True
      await load('/settings/knowledge-graph')
      settings=await required(page.locator('[data-studio-knowledge-settings=true]'))
      await required(settings.locator('[data-studio-knowledge-settings-retry=true]'))
      switch=settings.get_by_role('switch',name='Build a knowledge graph across my decks',exact=True)
      await expect(switch).to_be_disabled()
      await expect(settings.locator('[data-studio-knowledge-settings-record=true]')).to_have_count(0)
      await shot('knowledge-settings-unavailable')
      refuse_settings=False
      await settings.locator('[data-studio-knowledge-settings-retry=true]').click()
      await expect(switch).to_be_enabled();await expect(switch).to_be_checked()
      await settings.locator('[data-studio-knowledge-settings-record=true] summary').click()
      await shot('knowledge-settings-recorded-consent')
      await switch.click()
      await required(settings.locator('[data-studio-knowledge-settings-error=true]'))
      await expect(switch).to_be_checked()
      await shot('knowledge-unsubscribe-refused-consent-retained')
      await settings.locator('[data-studio-knowledge-settings-retry=true]').click()
      await expect(switch).to_be_enabled()
      await settings.locator('[data-studio-knowledge-settings-delete=true]').get_by_role('button',name='Delete',exact=True).click()
      confirm=await required(settings.locator('[data-studio-knowledge-settings-confirm=true]'))
      await confirm.get_by_role('button',name='Cancel',exact=True).focus();await shot('knowledge-purge-confirmation-cancel-only')
      await confirm.get_by_role('button',name='Cancel',exact=True).click()
      settings_subscribed=False
      await load('/settings/knowledge-graph')
      settings=await required(page.locator('[data-studio-knowledge-settings=true]'))
      switch=settings.get_by_role('switch',name='Build a knowledge graph across my decks',exact=True)
      await expect(switch).not_to_be_checked();await switch.click()
      await required(settings.locator('[data-studio-knowledge-settings-error=true]'))
      await expect(switch).not_to_be_checked()
      await shot('knowledge-subscribe-refused-consent-retained')
      assert [write['path'] for write in denied]==['/api/knowledge-graph/unsubscribe','/api/knowledge-graph/subscribe'],denied
      checks['nativeSettingsRetryRecordAndRefusedConsentRetained']=True
      checks['purgeConfirmationCancelledNoDelete']=True
     elif args.area=='published':
      checks['actualClientComponentsLocalAdapterNotPublicSSR']=True
      await load('/studio-local-review/published')
      viewer=await required(page.locator('[data-studio-published-viewer=true]'))
      await expect(viewer.frame_locator('iframe').get_by_text('Make the next',exact=False)).to_be_visible()
      await shot('published-client-viewer')
      await viewer.get_by_role('button',name='Download this presentation',exact=True).click()
      menu=await required(page.locator('[data-studio-published-menu=true]'))
      await expect(menu.get_by_role('menuitem',name='Download as PDF',exact=True)).to_be_visible()
      await expect(menu.get_by_role('menuitem',name='Download as PPTX',exact=True)).to_be_visible()
      await shot('published-format-menu-unsent');await page.keyboard.press('Escape')
      await viewer.get_by_role('button',name='Ask a question about this deck',exact=True).click()
      qa=await required(page.locator('[data-studio-published-qa=true]'))
      await qa.get_by_role('button',name='What decision does this presentation support?',exact=True).click()
      await expect(qa.get_by_text('Align the next priorities.',exact=True)).to_be_visible()
      await shot('published-approved-answer')
      question=qa.get_by_role('textbox',name='Question about this deck',exact=True)
      await question.fill('A local question that must not be persisted.')
      await qa.get_by_role('button',name='Ask',exact=True).click()
      await expect(qa.get_by_role('alert')).to_contain_text('refuses writes')
      await expect(question).to_have_value('A local question that must not be persisted.')
      await shot('published-question-refused-draft-retained')
      await qa.get_by_role('button',name='Close questions',exact=True).click()
      await load('/studio-local-review/published?state=faq-only')
      viewer=await required(page.locator('[data-studio-published-viewer=true]'))
      await viewer.get_by_role('button',name='Read answered questions',exact=True).click()
      qa=await required(page.locator('[data-studio-published-qa=true]'))
      await expect(qa.get_by_role('textbox')).to_have_count(0)
      await qa.get_by_role('button',name='What decision does this presentation support?',exact=True).click()
      await shot('published-faq-questions-closed')
      await load('/studio-local-review/published?state=passcode')
      gate=await required(page.locator('[data-studio-published-passcode=true]'))
      passcode=gate.get_by_label('Passcode',exact=True)
      await passcode.fill('local-invalid');await shot('published-passcode-focus')
      await gate.get_by_role('button',name='View presentation',exact=True).click()
      await expect(gate.get_by_role('alert')).to_contain_text('Incorrect passcode')
      await expect(passcode).to_have_value('local-invalid');await expect(passcode).to_have_attribute('type','password')
      await shot('published-passcode-refused')
      await load('/studio-local-review/published?state=answer')
      thread=await required(page.locator('[data-studio-published-thread=true]'))
      await expect(thread.locator('.studio-published-thread-copy')).to_contain_text('retain the next action and its owner')
      await expect(thread.get_by_role('link',name='Complete priorities and supporting evidence',exact=True)).to_have_attribute('href','/p/fixture-shared-deck#/2')
      await shot('published-followup-answer')
      await load('/studio-local-review/published?state=waiting')
      thread=await required(page.locator('[data-studio-published-thread=true]'))
      await expect(thread.locator('.studio-published-thread-pending')).to_contain_text('Waiting on Local reviewer')
      await shot('published-followup-waiting')
      checks['nativeFaqQuestionRefusalPasscodeAndFormatGates']=True
      checks['pureFollowupViewFullAnswerCitationAndWaiting']=True
     elif args.area=='fresh':
      await load('/builder?studio_action=theme&studio_item=fixture-theme-sage');await page.wait_for_url('**/builder?*session_id='+SESSION+'*');await required(page.get_by_label('Saved theme',exact=True));await expect(page.get_by_label('Saved theme',exact=True)).to_have_value('');await expect(page.locator('[data-studio-v4-saved-theme-request=true]')).to_contain_text('Evergreen studio');await shot('fresh-unapplied-theme');checks['freshNoRememberedSessionIntentRetained']=True;checks['noAutomaticSavedThemeApplication']=True;await page.keyboard.press('Escape');await required(page.get_by_role('region',name='Your presentation stage'));await expect(page.get_by_text('What are we making?',exact=True)).to_be_visible();caption=await page.locator('.studio-welcome-caption').bounding_box();assert caption['y']>=0 and caption['y']+caption['height']<=h,caption;checks['wideShortWelcomeFits']=True;await shot('wide-short-welcome')
     elif args.area=='add-element-entry':
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      panel=page.locator('[data-studio-v4-panel=element-generation]')
      async def add(kind):
       await page.get_by_role('button',name='Add Element',exact=True).click()
       menu=await required(page.locator('[data-studio-authoring-menu=add-element]'))
       item=await required(menu.get_by_role('menuitem',name=kind,exact=True));await expect(item).to_be_enabled();await item.click()
      await add('Chart');await add('Chart')
      await expect(panel).not_to_be_visible()
      await add('Text Box')
      await expect(panel.locator('[data-studio-v4-panel-header] h3')).to_have_text('Text Box')
      prompt=await required(panel.get_by_role('textbox',name='Generation prompt',exact=True))
      draft='Keep the newer native Text Box draft after the older Chart receipt.'
      await prompt.fill(draft);await shot('native-add-newer-textbox-draft')
      await iframe.content_frame.get_by_role('button',name='Release older local Chart receipt',exact=True).click()
      await page.wait_for_timeout(250)
      await expect(panel.locator('[data-studio-v4-panel-header] h3')).to_have_text('Text Box');await expect(prompt).to_have_value(draft)
      await shot('native-add-older-chart-keeps-newer-draft')
      await add('Chart')
      await panel.get_by_role('button',name='Close element panel',exact=True).click()
      await iframe.content_frame.get_by_role('button',name='Release older local Chart receipt',exact=True).click()
      await page.wait_for_timeout(250);await expect(panel).not_to_be_visible()
      await shot('native-add-close-before-older-receipt')
      commands=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests.filter(x=>x.action==="insertTextBox")')
      responses=await iframe.content_frame.locator('body').evaluate('window.fixtureResponses')
      assert [x['params']['componentType'] for x in commands]==['CHART','TEXT_BOX','CHART'],commands
      assert len({x['params']['elementId'] for x in commands})==3,commands
      assert all(x['params']['slideIndex']==0 for x in commands),commands
      assert [x['componentType'] for x in responses]==['TEXT_BOX','CHART','CHART'],responses
      assert not denied,denied
      checks['nativeDefaultAddMenuAndMutationAdapterEntry']=True
      checks['pendingExactDuplicateSuppressedDistinctChoicesPreserved']=True
      checks['olderReceiptKeepsNewerNativeFormDraftAndClose']=True
      proof_meta['commands']=commands;proof_meta['localResponses']=responses
      proof_meta['scope']='Actual Builder default Add Element, generation hooks/panel and native viewer adapter; synthetic local insertion receipts only. No Layout mutation, actual created element, generation, persistence or reopen proof.'
     elif args.area=='publish-drafts':
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Publish',exact=True).click()
      dialog=await required(page.locator('[data-studio-publish=true]'))
      budget=await required(dialog.locator('#publish-budget'))
      reserve=await required(dialog.locator('#publish-qa-reserve'))
      await expect(budget).to_have_value('5');await expect(reserve).to_have_value('1')
      await budget.fill('10.9');await budget.press('Tab')
      await expect(budget).to_be_disabled()
      await expect(budget).to_have_value('10');await expect(budget).to_be_enabled()
      await expect(dialog.locator('#publish-budget-unsaved')).to_have_count(0)
      await shot('session-length-local-canonical-response')
      await budget.fill('9');await budget.press('Tab')
      notice=await required(dialog.locator('#publish-budget-unsaved[role=alert]'))
      await expect(notice).to_contain_text(publish_failure)
      await expect(notice).to_contain_text('Saved value: 10 minutes.')
      await expect(budget).to_have_value('9');await expect(reserve).to_have_value('1')
      await expect(budget).to_be_enabled()
      await expect(page.get_by_text('Session settings not saved',exact=True)).to_be_visible()
      # Leaving the changed budget again is the native retry action. Approach
      # its adjacent notice from the unchanged reserve instead, preserving the
      # two intended requests while proving real keyboard focus traversal.
      await reserve.focus();await page.keyboard.press('Shift+Tab');await expect(notice).to_be_focused()
      assert await notice.evaluate('e=>e.matches(":focus-visible")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
      await fits_clip(notice,True)
      assert await notice.evaluate('e=>{const b=e.getBoundingClientRect();return [b.left+2,(b.left+b.right)/2,b.right-2].every(x=>[b.top+2,(b.top+b.bottom)/2,b.bottom-2].every(y=>e.contains(document.elementFromPoint(x,y))))}')
      await shot('session-length-refused-draft-keyboard-focus')
      await page.keyboard.press('End');await page.wait_for_timeout(250)
      assert await notice.evaluate('e=>e.scrollHeight>e.clientHeight&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await expect(notice).to_contain_text('[SESSION REFUSAL END]')
      await shot('session-length-full-refusal-ending')
      assert [item['body'] for item in denied]==[{'narrationBudgetMinutes':10.9},{'narrationBudgetMinutes':9}],denied
      checks['nativeBlurPayloadAndLocalCanonicalValue']=True
      checks['refusedDraftRetainedWithSavedValueAndFullReason']=True
      checks['nativeTabFocusAndKeyboardScrollableReason']=True
      checks['ordinaryShortToastPresentNoticeUnoccluded']=True
      proof_meta['scope']='Actual Builder PublishDialog and PublishSessionControls; two intercepted local PATCH responses, no API/service or persistence acknowledgement.'
     elif args.area=='manage':
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Publish',exact=True).click()
      dialog=await required(page.locator('[data-studio-publish=true]'))
      await expect(dialog.get_by_role('tab',name='Sharing',exact=True)).to_be_visible()
      await shot('manage-sharing')
      await dialog.get_by_role('tab',name='Q&A',exact=False).click()
      await dialog.get_by_role('button',name='What it can answer from',exact=True).click()
      await expect(dialog.get_by_text('Presentation content',exact=True)).to_be_visible()
      await shot('manage-questions-sources')
      await dialog.get_by_role('tab',name='Voice',exact=False).click()
      await expect(dialog.get_by_text('Alloy',exact=True)).to_be_visible()
      await shot('manage-voice-unavailable')
      await dialog.get_by_text('Alloy',exact=True).scroll_into_view_if_needed()
      await shot('manage-voice-choices')
      await dialog.get_by_role('tab',name='Sharing',exact=True).click()
      await dialog.get_by_role('button',name='Unpublish',exact=True).click()
      await expect(dialog.get_by_role('button',name='Confirm unpublish',exact=True)).to_be_visible()
      await shot('manage-unpublish-armed')
      await dialog.get_by_role('button',name='Keep published',exact=True).click()
      await expect(dialog.get_by_role('button',name='Confirm unpublish',exact=True)).to_have_count(0)
      checks['unpublishArmCancelNoWrite']=True
      checks['voiceUnavailableNoSelectionOrPlayback']=True
     elif args.area=='navigation':
      await load('/dashboard')
      await required(page.locator('[data-studio-deck-card]'))
      await shot('decks-grid')
      await page.get_by_role('button',name='List',exact=True).click()
      await shot('decks-list')
      search=page.get_by_role('textbox',name='Search presentations',exact=True)
      await search.fill('No such saved deck')
      await expect(page.get_by_text('No matching presentations',exact=True)).to_be_visible()
      await shot('decks-no-match')
      await page.get_by_role('button',name='Clear search and filters',exact=True).click()
      await expect(search).to_have_value('')
      await page.get_by_role('button',name='Manage Quarterly strategy',exact=True).click()
      await expect(page.get_by_role('menuitem',name='Duplicate',exact=True)).to_be_disabled()
      await shot('decks-honest-actions')
      await page.locator('[data-studio-deck-delete=true]').click()
      delete=await required(page.locator('[data-studio-deck-delete-dialog=true]'))
      await delete.get_by_role('button',name='Cancel',exact=True).focus()
      await shot('deck-delete-confirm-cancel-focus')
      await delete.get_by_role('button',name='Cancel',exact=True).click()
      await expect(page.locator('[data-studio-deck-card]')).to_have_count(1)
      await page.get_by_role('button',name='Manage Quarterly strategy',exact=True).click()
      await page.locator('[data-studio-deck-delete=true]').click()
      delete=await required(page.locator('[data-studio-deck-delete-dialog=true]'))
      await delete.locator('[data-studio-deck-delete-confirm=true]').click()
      await required(delete.locator('[data-studio-deck-delete-error=true]'))
      await expect(page.locator('[data-studio-deck-card]')).to_have_count(1)
      await shot('deck-delete-refused-record-retained')
      await delete.get_by_role('button',name='Cancel',exact=True).click()
      assert len([write for write in denied if write['method']=='DELETE'])==1,denied
      checks['refusedDeckDeletionRetainsRecordAndCancel']=True
      await page.get_by_role('link',name='Open Quarterly strategy in Studio',exact=True).click()
      await page.wait_for_url('**/builder?session_id='+SESSION)
      await page.get_by_role('button',name='Open deck list',exact=True).click()
      history=await required(page.locator('[data-studio-session-history=true]'))
      await expect(history.locator('[data-studio-session-row=true]')).to_have_count(1)
      await shot('sessions')
      await history.get_by_role('button',name='Delete Quarterly strategy',exact=True).click()
      confirm=await required(page.locator('[data-studio-session-dialog=session-history]'))
      await shot('session-delete-confirm')
      await confirm.get_by_role('button',name='Cancel',exact=True).click()
      await expect(history.locator('[data-studio-session-row=true]')).to_have_count(1)
      checks['deckAndSessionNavigationOwnedUrl']=True
      checks['deleteConfirmationCancelledNoWrite']=True
     elif args.area=='outline':
      session.update({'currentStage':2,'finalPresentationUrl':None,'finalPresentationId':None,'strawmanPreviewUrl':VIEWER,'strawmanPresentationId':'studio-v4-local-renderer','stateCache':{**session['stateCache'],'activeVersion':'strawman'}})
      slides=[{**s,'narrative':'A complete local outline passage that stays available when the slide is expanded.','key_points':['Show the priorities clearly.','Retain every reviewed decision and supporting point.']} for s in SLIDES]
      messages=[{'id':'fixture-outline-user','messageType':'chat_message','timestamp':'2026-10-01T16:20:00Z','userText':'Build a clear decision story for leadership.'},{'id':'fixture-outline','messageType':'slide_update','timestamp':'2026-10-01T16:21:00Z','payload':{'operation':'full_update','metadata':{'main_title':'Quarterly strategy','overall_theme':'Minimal','design_suggestions':'Calm visual hierarchy','target_audience':'Leadership','presentation_duration':5},'slides':slides,'affected_slides':None}},{'id':'fixture-outline-url','messageType':'presentation_url','timestamp':'2026-10-01T16:21:01Z','payload':{'url':VIEWER,'presentation_id':'studio-v4-local-renderer','slide_count':2,'message':'Local read-only outline preview'}},{'id':'fixture-outline-approval','messageType':'action_request','timestamp':'2026-10-01T16:21:02Z','payload':{'prompt_text':'Review the outline before building.','actions':[{'label':'Build this presentation','value':'accept_strawman','primary':True,'requires_input':False},{'label':'Adjust the story','value':'revise_strawman','primary':False,'requires_input':True}]}}]
      await load('/builder?session_id='+SESSION)
      outline=await required(page.locator('[data-studio-director-part=outline-review]'))
      await expect(outline.locator('details')).to_have_count(2)
      await outline.locator('summary').first.click()
      expanded=outline.locator('details').first
      await expect(expanded.get_by_text('A complete local outline passage that stays available when the slide is expanded.',exact=True)).to_be_visible()
      await expect(expanded.get_by_text('Retain every reviewed decision and supporting point.',exact=True)).to_be_visible()
      await shot('director-outline')
      approval=await required(page.locator('[data-studio-director-ask]'))
      await expect(approval.get_by_role('button',name='Build this presentation',exact=False)).to_be_visible()
      await expect(approval.get_by_role('button',name='Adjust the story',exact=False)).to_be_visible()
      await approval.get_by_role('button',name='Adjust the story',exact=False).focus()
      await shot('outline-approval-focus-unsent')
      checks['fullOutlineNarrativePointsAndNativeApprovalRetained']=True
     elif args.area=='template-params':
      assert identity['preview_flags'].get('blueprintEditorV2')=='true','This area requires the existing blueprint editor flag in the isolated preview'
      session.update({'currentStage':2,'finalPresentationUrl':None,'finalPresentationId':None,'strawmanPreviewUrl':VIEWER,'strawmanPresentationId':'studio-v4-local-renderer','stateCache':{**session['stateCache'],'activeVersion':'strawman'}})
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Reuse a saved template',exact=True).click()
      picker=await required(page.locator('[data-studio-template-picker=true]'))
      await picker.get_by_role('menuitem',name='Quarterly business review',exact=False).click()
      await page.get_by_role('button',name='Template',exact=True).click()
      await page.get_by_role('menuitem',name='Template Mode',exact=True).click()
      params=await required(page.locator('[data-studio-template-params=true]'))
      await expect(params.get_by_text('Loaded template',exact=True)).to_be_visible()
      await expect(params.get_by_text('Quarterly business review',exact=True)).to_be_visible()
      await shot('template-mode-loaded-params')
      scope=params.get_by_role('group',name='Blueprint details scope',exact=True)
      await required(scope)
      if await scope.count():
       await scope.get_by_role('button',name='Deck',exact=True).click()
       purpose=params.get_by_label('Deck purpose',exact=True);await purpose.fill('Local unsaved decision story')
       await scope.get_by_role('button',name='Current slide · 1',exact=True).click()
       await expect(params.locator('[data-stbp-scope=slide]')).to_be_visible()
       await shot('current-slide-blueprint')
       await scope.get_by_role('button',name='Deck',exact=True).click()
       await expect(purpose).to_have_value('Local unsaved decision story')
       await expect(params.get_by_text('Unsaved blueprint edits',exact=True)).to_be_visible()
       await shot('deck-blueprint-draft-retained')
       checks['deckSlideScopeRetainsUnsavedNativeBlueprint']=True
       await params.locator('[data-stbp-scope=deck]').get_by_role('combobox').click()
       await required(page.locator('[data-studio-template-param-select=true]'))
       await shot('blueprint-scope-options-focus');await page.keyboard.press('Escape')
       await page.get_by_role('button',name='Expand Title intent',exact=True).click()
       await expect(params.locator('[data-stbp-header=true]').get_by_role('heading',name='Title intent',exact=True)).to_be_visible()
       await expect(params.get_by_role('group',name='Blueprint details scope',exact=True)).to_have_count(0)
       await params.get_by_label('Title intent',exact=True).fill('Local unsaved title abstraction')
       await shot('selected-title-intent')
       await params.get_by_title('Collapse template details',exact=True).click()
       await params.get_by_role('button',name='Expand template details',exact=True).click()
       await expect(params.get_by_label('Title intent',exact=True)).to_have_value('Local unsaved title abstraction')
       checks['selectedTitleOverridesScopeAndSurvivesCollapse']=True
      checks['nativeTemplateSelectionAndModeSnapshotLoaded']=True
     elif args.area=='toolbar-fit':
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      chat=page.get_by_role('textbox',name='Message Director',exact=True)
      await chat.fill('Keep this chat draft while fitting the native toolbar.')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await page.get_by_title('Open slide panel',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      prompt=panel.get_by_role('textbox',name='Generation prompt',exact=True)
      await prompt.fill('Keep this unsent slide-panel fitting draft.')
      strip=await required(page.get_by_role('group',name='Slide authoring controls',exact=True))
      async def toolbar_state(name):
       await page.wait_for_timeout(350) # Existing 300ms native drawer/layout transition.
       measured=await strip.evaluate("""e=>{const r=x=>x.getBoundingClientRect().toJSON(),slot=e.closest('[data-studio-authoring-slot]'),viewer=e.closest('[data-studio-v4-viewer]'),b=e.getBoundingClientRect();return{strip:r(e),slot:r(slot),slotWidth:slot.clientWidth,viewer:r(viewer),viewerWidth:viewer.clientWidth,scrollLeft:e.scrollLeft,width:e.clientWidth,content:e.scrollWidth,buttons:[...e.querySelectorAll('button')].map(x=>({name:x.getAttribute('aria-label')||x.textContent.trim(),title:x.title,box:r(x),complete:x.getBoundingClientRect().left>=b.left-1&&x.getBoundingClientRect().right<=b.right+1}))}}""")
       proof_meta[name]=measured
       assert len(measured['buttons'])==6,measured
       if args.toolbar_fit_after:
        assert measured['content']<=measured['width']+1 and measured['scrollLeft']==0 and all(x['complete'] for x in measured['buttons']),measured
        for button in await strip.get_by_role('button').all():await fits_clip(button,True)
       await shot(name)
      await page.get_by_role('button',name='Show',exact=True).click()
      await required(page.locator('[data-studio-authoring-menu=show]'))
      await page.keyboard.press('Escape');await prompt.focus()
      await toolbar_state('inspector-open-original-thumbnails')
      resize=page.get_by_role('separator',name='Resize slide thumbnails',exact=True)
      await resize.focus();await page.keyboard.press('End');await expect(resize).to_have_attribute('aria-valuenow','180')
      await toolbar_state('inspector-open-thumbnails-maximum')
      await page.get_by_role('button',name='Hide thumbnails',exact=True).click()
      await toolbar_state('inspector-open-thumbnails-collapsed')
      # The baseline preserves the witnessed overlap; the repair must pass real pointer reopening.
      toggle=page.get_by_role('button',name='Show thumbnails',exact=True)
      if args.toolbar_fit_after:
       await fits_clip(toggle,True);await toggle.click()
      else:
       await toggle.focus();await page.keyboard.press('Enter')
      await resize.focus();await page.keyboard.press('Home');await expect(resize).to_have_attribute('aria-valuenow','96')
      await toolbar_state('inspector-open-thumbnails-minimum')
      if args.toolbar_fit_after:
       for name,marker in [('Add Element','add-element'),('Template','template'),('Mode','mode'),('Show','show')]:
        button=strip.get_by_role('button',name=name,exact=True);await button.focus();await fits_clip(button,True)
        await page.keyboard.press('Enter');await required(page.locator('[data-studio-authoring-menu='+marker+']'))
        await page.keyboard.press('Escape');await expect(button).to_be_focused()
       button=strip.get_by_role('button',name='Add Slide',exact=True);await button.focus();await fits_clip(button,True);await page.keyboard.press('Enter')
       picker=await required(page.locator('[data-studio-slide-layout-picker=true]'));await expect(picker.locator('.slp-card')).to_have_count(19)
       await picker.get_by_role('button',name='Close slide layouts',exact=True).click()
       checks['nativeMenusAndAddSlideCatalogueKeyboardReachableWithoutMutation']=True
      await expect(prompt).to_have_value('Keep this unsent slide-panel fitting draft.')
      if args.toolbar_fit_after:
       close_handle=page.get_by_title('Close slide panel',exact=True)
       await fits_clip(close_handle,True);await close_handle.click()
      else:await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      await toolbar_state('inspector-closed-thumbnails-minimum')
      await page.get_by_title('Open slide panel',exact=True).click()
      # Native context initialization clears this panel on intentional close/reopen.
      await expect(prompt).to_have_value('')
      await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      panes=page.get_by_role('group',name='Workspace pane',exact=True)
      if await panes.count():await panes.get_by_role('button',name='Chat',exact=True).click()
      await expect(chat).to_have_value('Keep this chat draft while fitting the native toolbar.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied and not violations and not errors
      checks['sameIframePanelDraftRetainedThroughResizeCollapseAndChatThroughNativeCloseReset']=True
      checks['nativeThumbnailHomeEndBoundsPreserved']=True
      if args.toolbar_fit_after:checks['nativePointerThumbnailHideShowAndInspectorCloseOpenIndependent']=True
      checks['noServiceMutation']=True
      checks['allControlsFitActualSlotInEveryMeasuredState']=bool(args.toolbar_fit_after)
      proof_meta['proofScope']='Actual native local UI; before-fit measurements allow recorded clipping' if not args.toolbar_fit_after else 'Actual native local UI; every measured authoring control fits and hit-tests'
     elif args.area=='ownership-smoke':
      await load('/studio/templates')
      await page.get_by_role('button',name='Import presentation',exact=True).click()
      ingest=await required(page.locator('[data-studio-template-flow=import]'))
      await expect(ingest.get_by_role('button',name='Upload & convert',exact=True)).to_be_disabled()
      await ingest.locator('input[type=file]').set_input_files({'name':'Studio-v4-first-selection.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 isolated first file selection; never uploaded'})
      await expect(ingest.get_by_text('Studio-v4-first-selection.pdf',exact=True)).to_be_visible()
      await expect(ingest.get_by_role('button',name='Upload & convert',exact=True)).to_be_enabled()
      await expect(ingest.get_by_role('alert')).to_have_count(0)
      await ingest.get_by_role('button',name='Upload & convert',exact=True).focus()
      await shot('template-first-selection-strict-entry-unsent')
      await ingest.get_by_role('button',name='Cancel',exact=True).click()
      assert not denied and not panel_requests
      checks['actualStrictModeFirstTemplateSelectionUsableWithoutServices']=True
      await load('/builder?session_id='+SESSION)
      iframe=page.get_by_title('Presentation Viewer',exact=True)
      await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      composer=page.get_by_role('textbox',name='Message Director',exact=True)
      await composer.fill('Keep this separate chat draft through the local response.')
      await page.get_by_role('button',name='Add Slide',exact=True).click()
      picker=await required(page.locator('[data-studio-slide-layout-picker=true]'))
      await expect(picker.locator('.slp-card')).to_have_count(19)
      await picker.get_by_role('textbox',name='Find a slide layout',exact=True).focus()
      await shot('add-slide-native-catalogue-focus-unsent')
      await picker.get_by_role('button',name='Close slide layouts',exact=True).click()
      checks['unchangedNativeAddSlideNineteenControlsNoMutation']=True
      await page.get_by_title('Open slide panel',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      prompt=panel.get_by_role('textbox',name='Generation prompt',exact=True)
      await prompt.fill('Original A synchronous local request')
      await panel.get_by_role('button',name='Generate (⌘↵)',exact=True).click()
      await asyncio.wait_for(panel_started.wait(),10)
      await expect(prompt).to_be_disabled()
      await shot('original-sync-request-held-native-busy')
      await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      async def select_version(name):
       await page.get_by_role('button',name='Show',exact=True).click()
       await page.get_by_role('menuitem',name=name,exact=True).click()
       await page.get_by_role('button',name='Show',exact=True).click()
       await expect(page.get_by_role('menuitem',name=name,exact=True)).to_have_attribute('aria-current','true')
       await page.keyboard.press('Escape')
      await select_version('Strawman')
      await expect(iframe).to_have_attribute('src',alternate_viewer)
      await page.get_by_title('Open slide panel',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      prompt=panel.get_by_role('textbox',name='Generation prompt',exact=True)
      await expect(prompt).to_be_enabled();await prompt.fill('New B draft after actual version switch')
      await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      await select_version('Final')
      await expect(iframe).to_have_attribute('src',VIEWER)
      await page.get_by_title('Open slide panel',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      prompt=panel.get_by_role('textbox',name='Generation prompt',exact=True)
      await expect(prompt).to_be_enabled();await prompt.fill('New A return draft survives the old response')
      await panel.get_by_role('button',name='More options',exact=True).click()
      key=panel.get_by_placeholder('Optional',exact=True);await key.fill('New return key message')
      panel_release.set();await asyncio.wait_for(panel_finished.wait(),10);await page.wait_for_timeout(800)
      await expect(prompt).to_have_value('New A return draft survives the old response')
      await expect(key).to_have_value('New return key message')
      await expect(panel.get_by_text('Built slide 3.',exact=True)).to_have_count(0)
      await expect(page.get_by_text('Slide built',exact=True)).to_have_count(0)
      await expect(iframe).to_have_attribute('src',VIEWER)
      await prompt.focus();await shot('late-sync-result-return-draft-retained-focus')
      await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      panes=page.get_by_role('group',name='Workspace pane',exact=True)
      if await panes.count():await panes.get_by_role('button',name='Chat',exact=True).click()
      await expect(composer).to_have_value('Keep this separate chat draft through the local response.')
      checks['actualNativePanelHeldResultVersionRoundtripRetainsNewDraftKeyAndChat']=True
      checks['retiredOriginalSyncResultCannotOverrideSelectionOrReportCurrentSuccess']=True
      assert len(panel_requests)==1 and not denied
      proof_meta['suppliedComposeRequests']=panel_requests
      proof_meta['responseScope']='Intercepted local synchronous built object only; no generation, iframe mutation, service acknowledgement or persistence proof.'
     elif args.area=='template-flows':
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Template',exact=True).click()
      await page.get_by_role('menuitem',name='Save Template',exact=True).click()
      save=await required(page.locator('[data-studio-template-flow=save]'))
      name=save.get_by_label('Template name',exact=True);await name.fill('Local quarterly draft')
      await shot('save-template-name-focus')
      await name.press('Enter')
      await expect(page.get_by_text('Could not save template',exact=True)).to_be_visible()
      await expect(name).to_have_value('Local quarterly draft')
      await shot('save-template-refused-draft-retained')
      assert any(write['path']=='/api/templates' for write in denied),denied
      checks['refusedTemplateSaveRetainsName']=True
      await save.get_by_role('button',name='Cancel',exact=True).click()
      await load('/studio/templates')
      await page.get_by_role('button',name='Import presentation',exact=True).click()
      ingest=await required(page.locator('[data-studio-template-flow=import]'))
      await expect(ingest.get_by_role('button',name='Upload & convert',exact=True)).to_be_disabled()
      await ingest.get_by_role('button',name='Choose a presentation file',exact=True).focus()
      await shot('import-presentation-file-focus')
      file=ingest.locator('input[type=file]')
      await file.set_input_files({'name':'wrong-format.txt','mimeType':'text/plain','buffer':b'Local validation specimen'})
      await expect(ingest.get_by_role('alert')).to_be_visible()
      await expect(ingest.get_by_role('button',name='Upload & convert',exact=True)).to_be_disabled()
      await shot('import-file-rejected')
      await file.set_input_files({'name':'local-review.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 local selection specimen only'})
      await expect(ingest.get_by_text('local-review.pdf',exact=True)).to_be_visible()
      await expect(ingest.get_by_role('button',name='Upload & convert',exact=True)).to_be_enabled()
      await expect(ingest.get_by_role('alert')).to_have_count(0)
      await shot('import-file-reselected-unsent')
      await ingest.get_by_role('button',name='Cancel',exact=True).click()
      await expect(ingest).to_have_count(0)
      checks['nativeImportValidationReselectionAndCancelNoUpload']=True
     elif args.area=='authoring':
      await load('/builder?session_id='+SESSION)
      await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible()
      for label_name,marker in [('Add Element','add-element'),('Template','template'),('Mode','mode')]:
       await page.get_by_role('button',name=label_name,exact=True).click()
       await required(page.locator('[data-studio-authoring-menu='+marker+']'))
       await shot(marker+'-menu')
       await page.keyboard.press('Escape')
      await page.get_by_role('button',name='Add Slide',exact=True).click()
      picker=await required(page.locator('[data-studio-slide-layout-picker=true]'))
      await expect(picker.locator('.slp-card')).to_have_count(19)
      box=await picker.bounding_box();assert box['y']>=0 and box['y']+box['height']<=h+1,box
      await shot('slide-layout-catalogue')
      search=picker.get_by_role('textbox',name='Find a slide layout',exact=True)
      await search.fill('No such canonical structure')
      await expect(picker.get_by_text('No matching layouts',exact=True)).to_be_visible()
      await shot('slide-layout-no-match')
      await picker.get_by_role('button',name='Show all layouts',exact=True).click()
      await expect(search).to_have_value('');await expect(search).to_be_focused()
      await expect(picker.locator('.slp-card')).to_have_count(19)
      await picker.get_by_role('button',name='Close slide layouts',exact=True).click()
      options=page.get_by_role('button',name='Options for slide 1',exact=True)
      await options.focus()
      await required(page.locator('[data-studio-thumbnail-hint=true]'))
      await shot('thumbnail-options-focus-hint')
      await options.click()
      await expect(page.locator('[data-studio-thumbnail-hint=true]')).to_have_count(0)
      await shot('thumbnail-options-menu')
      await page.keyboard.press('Escape')
      checks['all19CanonicalLayoutsAndLocalSearchRecovered']=True
      checks['authoringMenusAndThumbnailKeyboardHintsReachable']=True
     elif args.area=='controls':
      await load('/builder?session_id='+SESSION)
      frame=page.frame_locator('iframe[title="Presentation Viewer"]')
      await expect(frame.get_by_text('Make the next',exact=False)).to_be_visible()
      before=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
      await page.get_by_role('button',name='Show',exact=True).click()
      await required(page.get_by_role('menu'))
      await page.keyboard.press('ArrowDown');await page.wait_for_timeout(200)
      after=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
      assert after==before,(before,after)
      await shot('show-menu-keyboard')
      await page.keyboard.press('Escape');await page.wait_for_timeout(200)
      after=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
      assert after==before,(before,after)
      checks['popupKeyboardDoesNotSendCanvasCommands']=True
      for action in ['master','theme']:
       await load('/builder?session_id='+SESSION+'&studio_action='+action)
       panel=await required(page.locator('[data-studio-v4-dialog='+action+']'))
       before=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
       await panel.get_by_title('Close panel',exact=True).focus()
       for key in ['ArrowRight','g','b','e','Escape']:await page.keyboard.press(key)
       await page.wait_for_timeout(200)
       after=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
       assert after==before,(action,before,after)
       await expect(panel).to_be_visible();await shot(action+'-panel-keyboard')
      checks['nonmodalPanelButtonsOwnTheirKeys']=True
      await load('/builder?session_id='+SESSION)
      await expect(frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_role('button',name='Options for slide 1',exact=True).click()
      await page.get_by_role('menuitem',name='Delete Slide',exact=True).click()
      confirm=await required(page.locator('[data-studio-slide-delete=true]'))
      before=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
      await confirm.get_by_role('button',name='Cancel',exact=True).focus()
      for key in ['ArrowRight','g','b','e']:await page.keyboard.press(key)
      await page.wait_for_timeout(200)
      after=await frame.locator('body').evaluate('()=>window.fixtureRequests.map(r=>r.action)')
      assert after==before,(before,after)
      await shot('delete-confirmation-cancel-focus')
      await confirm.get_by_role('button',name='Cancel',exact=True).click()
      await expect(confirm).to_have_count(0)
      await expect(page.get_by_role('button',name='Options for slide 1',exact=True)).to_be_visible()
      checks['deleteConfirmationCancelOwnsKeysAndRetainsSlide']=True
     elif args.area=='presentation':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True))
      await composer.fill('Keep this unsent thumbnail action review draft.')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      refine=await required(page.get_by_role('button',name='Refine slide 1',exact=True))
      caption=page.locator('[data-studio-thumbnail-card=true][data-active=true] [data-studio-thumbnail-caption=true]')
      await expect(caption.locator('[data-studio-thumbnail-refine=true]')).to_have_count(1)
      preview=page.locator('[data-studio-thumbnail-card=true][data-active=true] [data-studio-thumbnail-preview=true]')
      rbox=await refine.bounding_box();pbox=await preview.bounding_box();cbox=await caption.bounding_box()
      assert rbox and pbox and cbox and rbox['y']>=pbox['y']+pbox['height'] and rbox['y']>=cbox['y'] and rbox['y']+rbox['height']<=cbox['y']+cbox['height'],(rbox,pbox,cbox)
      await shot('thumbnail-actions-label-row')
      await refine.hover();await shot('thumbnail-refine-label-hover')
      navigation=page.get_by_role('button',name='Go to slide 1: Overview',exact=True)
      await page.keyboard.press('Tab');await navigation.focus();await page.keyboard.press('Tab');await expect(refine).to_be_focused()
      await shot('thumbnail-refine-label-keyboard-focus')
      await page.keyboard.press('Tab');await expect(page.get_by_role('button',name='Options for slide 1',exact=True)).to_be_focused()
      await refine.focus();await page.keyboard.press('Enter')
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      await expect(panel.get_by_placeholder('What should change?',exact=True)).to_be_visible()
      await panel.get_by_placeholder('What should change?',exact=True).fill('Keep all notes and comments; clarify only the title.')
      await shot('thumbnail-refine-existing-inspector')
      await panel.get_by_title('Close panel',exact=True).click()
      await expect(composer).to_have_value('Keep this unsent thumbnail action review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['thumbnailRefineInLabelRowNativeTabOrderAndUnsentInspector']=True
      for name in ['slide','director']:
       handle=await required(page.locator('[data-studio-drawer-handle='+name+']'))
       initial=await handle.get_attribute('aria-expanded')
       await handle.hover();await shot('drawer-'+name+'-hover')
       await page.keyboard.press('Tab');await handle.focus();await expect(handle).to_be_focused()
       assert await handle.evaluate("e=>getComputedStyle(e).outlineStyle")=='solid'
       frame=page.get_by_title('Presentation Viewer',exact=True).content_frame
       await frame.locator('body').evaluate('window.fixtureRequests=[]')
       await page.keyboard.press('ArrowDown');assert not await frame.locator('body').evaluate('window.fixtureRequests')
       await shot('drawer-'+name+'-keyboard-focus')
       await page.keyboard.press('Enter');await expect(handle).to_have_attribute('aria-expanded','false' if initial=='true' else 'true')
       await shot('drawer-'+name+'-alternate-state')
       await page.keyboard.press('Enter');await expect(handle).to_have_attribute('aria-expanded',initial)
      await expect(composer).to_have_value('Keep this unsent thumbnail action review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeDrawerHandleStatesFocusOwnKeysAndRetainDraftIframe']=True
      toggle=await required(page.locator('[data-studio-v4-thumbnail-toggle=true]'))
      initial=await toggle.get_attribute('aria-expanded')
      await page.keyboard.press('Tab');await toggle.focus();await expect(toggle).to_be_focused();await shot('thumbnail-toggle-keyboard-focus')
      await page.keyboard.press('Enter');await expect(toggle).to_have_attribute('aria-expanded','false' if initial=='true' else 'true');await shot('thumbnail-toggle-alternate-state')
      await page.keyboard.press('Enter');await expect(toggle).to_have_attribute('aria-expanded',initial)
      checks['nativeThumbnailToggleStatesFocusAndReturn']=True
      frame=page.frame_locator('iframe[title="Presentation Viewer"]')
      await expect(frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.get_by_title('Present fullscreen',exact=True).click()
      await expect(page.locator('[data-studio-presentation-toolbar=true]')).to_have_count(1)
      assert await page.evaluate('!!document.fullscreenElement')
      await page.mouse.move(w/2,25);await page.wait_for_timeout(200)
      await required(page.locator('[data-studio-presentation-toolbar=true]'))
      await shot('presentation-chrome')
      await page.locator('[data-studio-presentation-toolbar=true]').get_by_title('Exit fullscreen (ESC)',exact=True).focus()
      await shot('presentation-exit-focus')
      await page.locator('[data-studio-presentation-toolbar=true]').get_by_title('Exit fullscreen (ESC)',exact=True).click()
      await expect(page.locator('[data-studio-presentation-toolbar=true]')).to_have_count(0)
      assert not await page.evaluate('!!document.fullscreenElement')
      checks['nativeFullscreenEnterExitSameViewer']=True
     elif args.area=='composer':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True))
      await composer.fill('Review @Overview')
      await required(page.locator('[data-studio-composer-mentions=true]'))
      await shot('slide-mention-picker')
      await composer.press('Enter')
      await expect(composer).to_have_value('Review @[Slide 1: Overview] ')
      await expect(composer).to_be_focused()
      await expect(page.locator('[data-studio-composer-mentions=true]')).to_have_count(0)
      await composer.fill('Review @Evidence');await composer.press('Tab')
      await expect(composer).to_have_value('Review @[Slide 2: Evidence] ');await expect(composer).to_be_focused()
      await shot('mention-retained-draft')
      checks['mentionEnterTabSelectWithoutSending']=True
      await expect(page.get_by_role('button',name='Build theme',exact=True)).to_be_disabled()
      await shot('composer-theme-locked')
      session.update({'currentStage':2,'finalPresentationUrl':None,'finalPresentationId':None,'strawmanPreviewUrl':VIEWER,'strawmanPresentationId':'studio-v4-local-renderer','stateCache':{**session['stateCache'],'activeVersion':'strawman'}})
      await load('/builder?session_id='+SESSION)
      await page.get_by_role('button',name='Build theme',exact=True).click()
      theme=await required(page.locator('[data-studio-composer-menu=theme]'))
      await expect(theme.get_by_label('Build theme preset',exact=True)).to_be_enabled()
      await expect(theme.get_by_label('Saved theme',exact=True)).to_have_value('')
      await theme.get_by_label('Build theme preset',exact=True).focus()
      await shot('composer-theme-focus')
      await page.keyboard.press('Escape')
      await page.get_by_role('button',name='Research options',exact=True).click()
      research=await required(page.locator('[data-studio-composer-menu=research]'))
      await expect(research.get_by_role('switch',name='Deep research (includes web)',exact=True)).to_be_visible()
      await expect(research.get_by_role('switch',name='Web search',exact=True)).to_be_visible()
      await research.get_by_role('switch',name='Deep research (includes web)',exact=True).focus()
      await shot('composer-research-focus')
      await page.keyboard.press('Escape')
      checks['nativeThemeLockedUnlockedAndResearchMenusFit']=True
     elif args.area=='knowledge':
      refuse_graph=True
      await load('/knowledge')
      area=await required(page.locator('[data-studio-knowledge=true]'))
      await expect(area.locator('[data-studio-knowledge-role=summary]').get_by_text('Not loaded',exact=True)).to_have_count(4)
      recovery=await required(area.locator('[data-studio-knowledge-role=map-recovery]'))
      if label=='dark-1030x600':
       for control in [recovery.locator('h3'),recovery.get_by_role('button',name='Retry graph',exact=True),recovery.get_by_role('link',name='Review settings',exact=True)]:
        box=await control.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=h,box
      await shot('knowledge-unavailable')
      await area.locator('[data-studio-knowledge-role=summary-disclosure] summary').click()
      await expect(area.locator('[data-studio-knowledge-role=summary]').get_by_text('Not loaded',exact=True).first).to_be_visible()
      await area.locator('[data-studio-knowledge-role=summary-disclosure] summary').click()
      checks['summaryDefinitionsRetainedAndRecoveryControlsFit']=True
      refuse_graph=False
      await area.get_by_role('button',name='Retry graph',exact=True).click()
      await expect(area.locator('[data-studio-knowledge-role=map-recovery]')).to_have_count(0)
      inspector=await required(area.locator('[data-studio-knowledge-inspector=true]'))
      await shot('knowledge-overview')
      refuse_graph=True
      await area.get_by_role('button',name='Refresh',exact=True).click()
      await expect(area.locator('.sk-stale-note')).to_contain_text('Showing the last loaded snapshot')
      await expect(area.locator('[data-studio-knowledge-role=summary]').get_by_text('Not loaded',exact=True)).to_have_count(0)
      if label=='dark-1030x600':
       svg=area.locator('[data-studio-knowledge-role=map-content] svg[role=group]')
       box=await svg.bounding_box();assert box and box['height']>=190 and box['y']+box['height']<=h,box
       await expect(svg.locator('[data-kg-node]')).to_have_count(6)
       for node in await svg.locator('[data-kg-node]').all():
        node_box=await node.bounding_box();assert node_box and node_box['y']>=box['y'] and node_box['y']+node_box['height']<=min(h,box['y']+box['height']),node_box
      await shot('knowledge-stale-snapshot')
      checks['shortWindowLoadedAndStaleMapRetainsUsefulHeight']=True
      refuse_graph=False
      await area.locator('[data-studio-knowledge-role=load-error]').get_by_role('button',name='Retry',exact=True).click()
      await expect(area.locator('[data-studio-knowledge-role=load-error]')).to_have_count(0)
      checks['unavailableRetryAndStaleSnapshotRecovery']=True
      refuse_detail=True
      await inspector.get_by_role('button',name='Product strategy',exact=False).click()
      await expect(inspector.get_by_role('button',name='Retry details',exact=True)).to_be_visible()
      await shot('knowledge-detail-refused')
      refuse_detail=False
      await inspector.get_by_role('button',name='Retry details',exact=True).click()
      await expect(inspector.get_by_role('button',name='Evidence 8',exact=True)).to_be_visible()
      await inspector.get_by_role('button',name='Evidence 8',exact=True).click()
      await expect(inspector.locator('.ski-evidence')).to_have_count(8)
      await inspector.locator('.ski-passage summary').first.click()
      await expect(inspector.locator('.ski-passage').first.locator('blockquote')).to_contain_text('Full passage ending retained.')
      await shot('knowledge-full-passage')
      field=inspector.get_by_role('textbox',name='Filter recorded evidence',exact=True)
      await field.fill('No such returned passage')
      await expect(inspector.get_by_text('No matching recorded passages',exact=True)).to_be_visible()
      await shot('knowledge-local-no-match')
      await inspector.get_by_role('button',name='Clear evidence filter',exact=True).click()
      await expect(field).to_be_focused();await expect(inspector.locator('.ski-evidence')).to_have_count(8)
      await inspector.get_by_role('button',name='Relations 10',exact=True).click()
      await expect(inspector.locator('.ski-relation-list article')).to_have_count(10)
      await inspector.locator('.ski-relation-list article').last.scroll_into_view_if_needed()
      await shot('knowledge-all-relations')
      await inspector.get_by_role('button',name='Clear selected entity',exact=True).click()
      await expect(inspector.get_by_text('Follow an idea to its sources.',exact=True)).to_be_visible()
      checks['allReturnedEvidenceAndRelationsAccessible']=True
      checks['fullPassageLocalSearchFocusClearRetry']=True
     elif args.area=='templates':
      session.update({'currentStage':0,'slideCount':0,'finalPresentationUrl':None,'finalPresentationId':None,'stateCache':{}})
      await load('/builder?session_id='+SESSION+'&studio_action=templates&studio_item=fixture-template-review')
      picker=await required(page.locator('[data-studio-template-picker=true][data-standalone=true]'))
      await expect(picker.get_by_text('From your library: Quarterly business review',exact=True)).to_be_visible()
      header=await page.get_by_role('heading',name='Choose a template',exact=True).bounding_box()
      close=await page.locator('[data-studio-v4-dialog=workflow]').get_by_role('button',name='Close',exact=True).bounding_box()
      assert header['y']>=0 and header['y']+header['height']<=h,(header,h)
      assert close['y']>=0 and close['y']+close['height']<=h,(close,h)
      await shot('template-standalone')
      search=picker.get_by_role('textbox',name='Search saved templates',exact=True)
      await search.fill('Customer')
      unavailable=picker.get_by_role('button',name='Customer growth story',exact=False)
      await expect(unavailable).to_have_attribute('aria-disabled','true')
      await unavailable.focus();await unavailable.press('Enter')
      await expect(picker).to_be_visible()
      await shot('template-locked-readiness')
      await picker.get_by_role('button',name='Clear saved template search',exact=True).click()
      await expect(search).to_have_value('')
      await search.focus();await page.keyboard.press('Escape');await page.wait_for_timeout(250);await page.keyboard.press('Escape')
      await expect(picker).to_have_count(0)
      await required(page.locator('[data-studio-v4-composer]'))
      checks['standaloneSearchEscapeAndReadinessPreserved']=True
      checks['templateDialogHeadingAndCloseFit']=True
      checks['preferredTemplateNotAutomaticallySelected']=True
     elif args.area=='intelligence':
      await load('/studio/intelligence')
      area=await required(page.locator('[data-studio-personal=intelligence]'))
      draft=area.get_by_label('Your brief for Director',exact=False)
      await draft.fill('Keep the strategic priorities visible.')
      fitted=await required(area.locator('[data-studio-workflow-fit=true]'))
      await draft.focus();await expect(draft).to_be_focused();await fits_clip(draft)
      box=await draft.bounding_box();assert box and box['height']>=90,box
      actions=fitted.locator('.sp-workflow-actions')
      await fits_clip(actions.get_by_role('button',name='Review brief in Studio',exact=False),True)
      guidance=fitted.locator('.sp-workflow-guidance')
      await expect(guidance).not_to_have_attribute('open','')
      await shot('intelligence-current')
      await actions.get_by_role('button',name='Review brief in Studio',exact=False).hover();await shot('intelligence-brief-action-hover')
      await guidance.locator('summary').focus();await page.keyboard.press('Enter');await expect(guidance).to_have_attribute('open','')
      await expect(guidance).to_contain_text('No personal model assignment is applied here.')
      await fitted.locator('.sp-workflow-content').evaluate('e=>e.scrollTop=e.scrollHeight')
      await fits_clip(actions.get_by_role('button',name='Review brief in Studio',exact=False),True)
      await shot('intelligence-guidance-open-actions-visible')
      await guidance.locator('summary').click()
      await draft.focus();await fits_clip(draft)
      checks['nativeBriefFullHeightAndGuidanceDisclosureWithVisibleActions']=True
      await area.get_by_role('button',name='Design preview',exact=True).click()
      await shot('intelligence-design-disclosure')
      await area.get_by_role('button',name='Current workflows',exact=True).click()
      await expect(draft).to_have_value('Keep the strategic priorities visible.')
      checks['taskViewDraftRetention']=True
     elif args.area=='header-fit':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent header-fit review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      header=await required(page.locator('[data-studio-v4-shell-header=true]'));title=header.locator('.studio-shell-heading > span')
      await expect(title).to_have_text('Quarterly strategy');await fits_clip(title)
      assert await title.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),await title.evaluate('e=>({width:e.clientWidth,content:e.scrollWidth})')
      await fits_clip(header.get_by_role('button',name='Open deck list',exact=True),True);await fits_clip(header.get_by_role('button',name='Presenter details',exact=True),True)
      await shot('header-native-complete-deck-title-and-controls')
      target=header.locator('[data-studio-v4-toolbar-target=true]')
      for label_name,button in [('present',target.get_by_title('Present fullscreen',exact=True)),('download',target.get_by_role('button',name='Download presentation',exact=True)),('publish',target.get_by_role('button',name='Publish',exact=True))]:
       await button.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(button).to_be_focused();await fits_clip(button,True)
       await expect(composer).to_have_value('Keep this unsent header-fit review draft.');await shot('header-native-'+label_name+'-keyboard-focus')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      long_title='Quarterly priorities and the complete decision evidence for our leadership team — '+('Full retained presentation title detail '*5)
      session['stateCache']['slideStructure']['metadata']['main_title']=long_title
      await page.evaluate("({owner,id})=>{for(const prefix of ['deckster_session_v2_','deckster_metadata_v2_'])sessionStorage.removeItem(prefix+encodeURIComponent(owner)+'_'+id)}",{'owner':USER['id'],'id':SESSION})
      await load('/builder?session_id='+SESSION)
      header=await required(page.locator('[data-studio-v4-shell-header=true]'));title=header.locator('.studio-shell-heading > span');await expect(title).to_have_text(long_title);await expect(title).to_have_attribute('title',long_title);await fits_clip(title)
      assert await title.evaluate('e=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).textOverflow==="ellipsis"')
      await fits_clip(header.get_by_role('button',name='Presentation',exact=True),True);await shot('header-native-long-title-retained-with-bounded-ellipsis')
      assert not denied,denied
      checks['nativeCompleteOrdinaryDeckTitleWithPresenterAndSessionsFit']=True
      checks['nativeDeliveryKeyboardFocusControlsDraftAndIframeRetained']=True
      checks['nativeLongTitleFullTextAndAttributeRetainedBoundedEllipsis']=True
     elif args.area=='generation-cover':
      await load('/studio-local-review/generation-cover')
      area=await required(page.locator('[data-studio-generation-specimen=true]'));await expect(area).to_contain_text('synthetic local isGenerating prop')
      draft=area.locator('[data-studio-generation-specimen-draft=true]');await draft.fill('Keep this unsent draft while reading the supplied generation cover.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      if w<500:await page.get_by_role('button',name='Hide thumbnails',exact=True).click()
      await expect(area.locator('[data-studio-generation-cover=true]')).to_have_count(0);await shot('generation-cover-native-viewer-before-supplied-prop')
      toggle=area.locator('[data-studio-generation-specimen-toggle=true]');await toggle.check()
      cover=await required(area.locator('[data-studio-generation-cover=true]'));await fits_clip(cover,True)
      assert await cover.evaluate('e=>getComputedStyle(e).backgroundColor===getComputedStyle(e.parentElement).backgroundColor')
      authoring=area.locator('[data-studio-v4-authoring]');assert await authoring.evaluate('e=>getComputedStyle(e).pointerEvents==="none"&&parseFloat(getComputedStyle(e).opacity)===0.5')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await area.locator('.studio-canvas-caption').click(position={'x':5,'y':8},force=True);await page.keyboard.press('ArrowRight');await page.wait_for_timeout(300)
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert all(r['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for r in requests),requests
      await shot('generation-cover-native-supplied-neutral-loader')
      await toggle.uncheck();await expect(cover).to_have_count(0)
      assert await authoring.evaluate('e=>getComputedStyle(e).pointerEvents!=="none"&&parseFloat(getComputedStyle(e).opacity)===1')
      await expect(draft).to_have_value('Keep this unsent draft while reading the supplied generation cover.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await shot('generation-cover-native-supplied-prop-cleared')
      assert not denied,denied
      checks['nativeSuppliedGenerationCoverFitsUsesNeutralCanvasPalette']=True
      checks['originalGeneratingPointerAndCanvasKeyboardGatesRetained']=True
      checks['clearingSuppliedPropPreservesSameViewerDraftNoGenerationOrResult']=True
     elif args.area=='theme-source':
      response=await page.goto(BASE+'/studio-local-review/specialist-forms',wait_until='domcontentloaded');assert response.status==200;await page.wait_for_load_state('networkidle')
      area=await required(page.locator('[data-studio-specialist-specimen=true]'))
      draft=area.locator('[data-studio-specialist-specimen-draft=true]');await draft.fill('Keep this unsent theme-preview review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await area.locator('[data-studio-specialist-specimen-type=true]').select_option('IMAGE')
      panel=await required(page.locator('[data-studio-v4-panel=element-generation]'));await panel.get_by_title('Show advanced options',exact=True).click()
      form=await required(panel.locator('[data-studio-image-form=true]'));await form.get_by_role('button',name='Style',exact=True).click()
      await asyncio.wait_for(theme_preview_started.wait(),20)
      theme=await required(form.locator('[data-studio-generation-context=theme]'));loading=await required(theme.locator('[data-studio-theme-source-status=deck-loading]'))
      await expect(loading).to_have_text('Loading deck theme preview…');await loading.scroll_into_view_if_needed();await fits_clip(loading);await shot('theme-source-native-existing-preview-read-loading')
      deck=theme.get_by_role('button',name='Deck theme',exact=True);await expect(deck).to_have_attribute('aria-pressed','true')
      theme_preview_release.set();await page.wait_for_load_state('networkidle')
      failure=await required(theme.locator('[data-studio-theme-source-status=deck-error]'));await expect(loading).to_have_count(0);await expect(failure).not_to_have_attribute('open','')
      await failure.scroll_into_view_if_needed();await fits_clip(failure);await shot('theme-source-native-existing-preview-read-unavailable')
      await failure.locator('summary').click();error=await required(theme.get_by_role('region',name='Deck theme preview error',exact=True));await expect(error).to_have_text('HTTP 503');await error.focus();await fits_clip(error,True)
      await expect(error).to_be_focused();await fits_clip(error,True);await shot('theme-source-native-exact-error-keyboard-focus')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]');await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(250)
      assert all(r['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for r in await iframe.content_frame.locator('body').evaluate('window.fixtureRequests'))
      await expect(deck).to_have_attribute('aria-pressed','true');none=theme.get_by_role('button',name='No theme',exact=True);await none.click();await expect(none).to_have_attribute('aria-pressed','true');await deck.click();await expect(deck).to_have_attribute('aria-pressed','true')
      await expect(area.locator('[data-studio-specialist-specimen-attempts=true]')).to_contain_text('0');await expect(draft).to_have_value('Keep this unsent theme-preview review draft.')
      assert '/api/themes' not in reads,reads
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeExistingThemePreviewReadLoadingAndExactFailureDisclosed']=True
      checks['nativeModeOptionsAndSelectionRetainedNoAutomaticFallback']=True
      checks['disabledAnotherThemeHasNoSavedReadOrDiagnostic']=True
      checks['focusedThemeErrorNoCanvasGenerationRequestSameDraftAndIframe']=True
     elif args.area=='waiting-native':
      response=await page.goto(BASE+'/builder?session_id='+SESSION,wait_until='domcontentloaded');assert response.status==200
      waiting=await required(page.locator('[data-studio-waiting=true][data-waiting-scope=screen]'))
      await expect(waiting).to_have_attribute('role','status');await expect(waiting).to_have_text('Loading builder...');await fits_clip(waiting)
      await shot('waiting-actual-auth-read-held')
      assert '/api/auth/session' in reads,reads
      auth_release.set();session_release.set();await page.wait_for_load_state('networkidle')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent draft through local session loading.')
      await page.get_by_role('button',name='Open deck list',exact=True).click()
      history=await required(page.locator('[data-studio-session-history=true]'));await history.get_by_text('Quarterly evidence',exact=True).click()
      waiting=await required(page.locator('[data-studio-waiting=true][data-waiting-scope=canvas]'));await expect(waiting).to_have_text('Loading session...');await fits_clip(waiting)
      await expect(page.locator('[data-studio-director-presence=true]')).to_have_attribute('hidden','');await expect(page.locator('[data-studio-director-presence=true]')).not_to_be_visible()
      await shot('waiting-actual-session-read-held')
      assert '/api/sessions/'+WAITING_SESSION in reads,reads
      switch_release.set();await page.wait_for_load_state('networkidle')
      await expect(page.locator('[data-studio-waiting=true]')).to_have_count(0)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next');await expect(page.locator('[data-studio-director-presence=true]')).to_be_visible();await shot('waiting-actual-read-released-native-builder')
      assert not denied,denied
      checks['actualAuthAndSessionReadPredicatesShowExactNativeLoadingStatus']=True
      checks['nativeMountedDirectorCueHiddenOnlyDuringExistingSessionLoading']=True
      checks['heldReadsReleasedSameNativeBuilderNoLifecycleOrServiceSuccessInvented']=True
     elif args.area=='waiting':
      await load('/studio-local-review/waiting')
      area=await required(page.locator('[data-studio-waiting-specimen=true]'));await expect(area).to_contain_text('synthetic supplied props')
      select=area.locator('[data-studio-waiting-specimen-selector=true]')
      for value,scope,message in [('builder','screen','Loading builder...'),('session','canvas','Loading session...'),('account','screen','Loading builder...'),('redirect','screen','Redirecting to sign in...')]:
       await select.select_option(value)
       leaf=await required(area.locator('[data-studio-waiting=true]'));await expect(leaf).to_have_attribute('data-waiting-scope',scope);await expect(leaf).to_have_attribute('role','status');await expect(leaf).to_have_attribute('aria-live','polite');await expect(leaf).to_have_text(message)
       await fits_clip(leaf);await fits_clip(leaf.locator('p'))
       await shot('waiting-supplied-native-'+value)
      await select.select_option('builder');await page.emulate_media(reduced_motion='reduce')
      assert await area.locator('[data-studio-waiting-spinner=true]').evaluate('e=>getComputedStyle(e).animationName==="none"')
      await shot('waiting-supplied-native-reduced-motion')
      assert not denied,denied
      checks['suppliedExactNativeScopeMessagesAnnouncedAndFit']=True
      checks['suppliedReducedMotionStopsDecorativeSpinner']=True
      checks['noAuthSessionRedirectOrServiceLifecycleInLeafSpecimen']=True
     elif args.area=='director-code':
      code_text='const original = "<native & value>";\n'+('\n'.join('native_line_'+str(i)+' = "'+('UnbrokenOriginalValue'*12)+'";' for i in range(90)))+'\nEND_COMPLETE_NATIVE_CODE\n'
      markdown='### Native Director reply\n\n##### Retained fifth-level heading\n\n###### Retained sixth-level heading\n\n---\n\n[Native source](https://example.invalid/source)\n\n```text\n'+code_text+'```\n\nInline `original_value` remains exact.\n\n<script>raw source stays text</script>\n'
      messages=[{'id':'fixture-chat-code','messageType':'chat_message','timestamp':NOW,'payload':{'text':markdown}}]
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent code review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      code=await required(page.get_by_role('region',name='Director code block',exact=True))
      await expect(code.locator('code')).to_have_text(code_text)
      await expect(page.locator('[data-studio-director-code=true] script')).to_have_count(0)
      await code.focus();await expect(code).to_be_focused();await fits_clip(code,True)
      await shot('director-code-native-complete-formatted-focus')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await page.evaluate("window.codeKeyProof=[];window.addEventListener('keydown',e=>window.codeKeyProof.push({key:e.key,prevented:e.defaultPrevented,code:e.target.dataset.studioDirectorCode}),false)")
      await page.keyboard.press('Control+End');await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(400)
      position=await code.evaluate('e=>({top:e.scrollTop,height:e.clientHeight,content:e.scrollHeight,overflow:getComputedStyle(e).overflow,keys:window.codeKeyProof,focused:e===document.activeElement})');position['iframeRequests']=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert position['top']>0 and position['top']+position['height']>=position['content']-2,position
      await fits_clip(code,True);await shot('director-code-native-full-ending-keyboard-scroll')
      for _ in range(12):await page.keyboard.press('ArrowRight')
      await page.wait_for_timeout(300);assert await code.evaluate('e=>e.scrollLeft>0')
      await shot('director-code-native-horizontal-keyboard-scroll')
      link=await required(page.get_by_role('link',name='Native source',exact=True));await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(link).to_be_focused();await fits_clip(link,True)
      assert await link.evaluate('e=>getComputedStyle(e).textDecorationLine.includes("underline")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
      await expect(link).to_have_attribute('target','_blank');await expect(link).to_have_attribute('rel','noopener noreferrer');await shot('director-prose-native-link-keyboard-focus')
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert all(r['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for r in requests),requests
      await expect(composer).to_have_value('Keep this unsent code review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await page.locator('.studio-canvas-caption').click(position={'x':5,'y':8});await page.keyboard.press('ArrowRight');await page.wait_for_timeout(300)
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert any(r['action']=='nextSlide' and r['allowed'] is False for r in requests),requests
      assert not denied,denied
      checks['ordinaryCanvasKeyOutsideCodeRetainsOriginalRefusedNavigationAttempt']=True
      checks['actualNativeMarkdownFullFormattedCodeAndEscapedHtmlRetained']=True
      checks['nativeCodeFocusEndAndHorizontalArrowsScrollInsideRegion']=True
      checks['nativeProseHeadingSeparatorsAndUnderlinedLinkKeyboardFocus']=True
      checks['codeKeyboardNoCanvasCommandsSameIframeDraftNoSend']=True
     elif args.area=='mention-titles':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True))
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      titles=[s['title'] for s in session['stateCache']['slideStructure']['slides']]
      token=lambda i:'@[Slide '+str(i+1)+': '+titles[i][:60]+']'
      await composer.fill('Review @Quarterly')
      popup=await required(page.get_by_role('region',name='Choose a slide to mention',exact=True));row=await required(popup.get_by_role('button',name='Mention slide 1: '+titles[0],exact=True))
      await expect(row).to_contain_text(titles[0]);await fits_clip(row,True)
      assert await row.locator('span').last.evaluate('e=>getComputedStyle(e).whiteSpace==="normal"&&e.scrollWidth<=e.clientWidth+1')
      await shot('mention-native-complete-title-wrapped')
      await row.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(composer).to_be_focused();await expect(composer).to_have_value('Review '+token(0)+' ')
      await expect(popup).to_have_count(0);await shot('mention-native-row-enter-restores-composer')
      await composer.fill('Review @Evidence');popup=await required(page.get_by_role('region',name='Choose a slide to mention',exact=True));row=await required(popup.get_by_role('button',name='Mention slide 2: '+titles[1],exact=True));await row.focus();await page.keyboard.press('Space')
      await expect(composer).to_be_focused();await expect(composer).to_have_value('Review '+token(1)+' ');await shot('mention-native-row-space-restores-composer')
      await composer.fill('Review @Quarterly');await composer.press('Enter');await expect(composer).to_have_value('Review '+token(0)+' ');await expect(composer).to_be_focused()
      await composer.fill('Review @Evidence');await composer.press('Tab');await expect(composer).to_have_value('Review '+token(1)+' ');await expect(composer).to_be_focused();await shot('mention-native-textarea-enter-tab-still-select')
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests');assert all(r['action'] in ['getCurrentSlideInfo','getTemplateSlotCatalog'] for r in requests),requests
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['fullNativeReturnedSlideTitlesWrapAndFit']=True
      checks['nativeRowEnterSpaceRestoreComposerWithoutSending']=True
      checks['textareaEnterTabStillSelectOriginalSixtyCharacterToken']=True
      checks['focusedRowArrowNoCanvasCommandSameIframeNoSend']=True
     elif args.area=='thumbnail-failure':
      await load('/studio-local-review/thumbnail-failure')
      area=await required(page.locator('[data-studio-thumbnail-failure-specimen=true]'))
      await expect(area).to_contain_text('synthetic local error props, not generated failures')
      draft=area.locator('[data-studio-thumbnail-failure-specimen-draft=true]');await draft.fill('Keep this local thumbnail-failure draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      if w<500:await page.get_by_role('button',name='Hide thumbnails',exact=True).click()
      strip=area.locator('[data-studio-thumbnail-failure-specimen-strip=true]')
      await expect(strip.locator('[data-studio-thumbnail-failure-trigger=true]')).to_have_count(2)
      await shot('thumbnail-failure-native-supplied-cards')
      for kind,slide,last in [('build',2,'Second supplied build reason.'),('refinement',3,'Second supplied refinement reason.')]:
       trigger=strip.get_by_role('button',name='Inspect failed '+kind+' for slide '+str(slide),exact=True)
       await trigger.focus();await page.keyboard.press('Enter')
       dialog=await required(page.locator('[data-studio-thumbnail-failure=true]'))
       region=await required(dialog.get_by_role('region',name='Slide '+str(slide)+' failure details',exact=True));await expect(region).to_contain_text(last)
       await region.focus();await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(300);await fits_clip(region,True)
       assert await region.evaluate('e=>e.scrollTop>0&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
       await shot('thumbnail-failure-native-'+kind+'-full-reasons-keyboard')
       await page.keyboard.press('Escape');await expect(dialog).to_have_count(0);await expect(trigger).to_be_focused()
      await expect(area.locator('[data-studio-thumbnail-failure-specimen-selection=true]')).to_have_text('Local selected source indices: 0')
      await expect(area.locator('[data-studio-thumbnail-failure-specimen-refused=true]')).to_have_count(0)
      await expect(draft).to_have_value('Keep this local thumbnail-failure draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeBuildAndRefinementFullReasonsKeyboardScrollAndClose']=True
      checks['nativeDialogReturnFocusNoSelectionNavigationOrAction']=True
      checks['suppliedErrorPropsNoRetryRefineGenerationAcknowledgement']=True
      checks['draftSelectionAndSameIframePreserved']=True
     elif args.area=='format-failures':
      await load('/studio-local-review/format-failures')
      area=await required(page.locator('[data-studio-format-failure-fixture=true]'))
      await expect(area.get_by_label('Native adapter readiness',exact=True)).to_have_text('Native adapter ready')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True))
      await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      draft=area.get_by_role('textbox',name='Separate sample draft',exact=True)
      await draft.fill('Keep this independent native failure specimen draft.')
      panel=await required(area.locator('[data-studio-v4-panel=element-format]'))
      order=panel.get_by_role('button',name='Send to Back',exact=True)
      await order.click();await expect(order).to_be_disabled()
      await shot('native-element-format-refusal-pending')
      failure=await required(panel.locator('[data-studio-format-failure=true]'))
      await expect(failure).to_contain_text(format_failure)
      await expect(order).to_be_enabled()
      await failure.focus();await page.keyboard.press('End');await page.wait_for_timeout(250)
      assert await failure.evaluate('e=>e.scrollTop>0&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await shot('native-element-format-refusal-reason-end')
      await area.get_by_role('button',name='Switch synthetic target',exact=True).click()
      await expect(area.locator('[data-studio-format-failure=true]')).to_have_count(0)
      await area.get_by_role('button',name='Text specimen',exact=True).click()
      text=await required(area.locator('[data-studio-v4-panel=text-format]'))
      bold=text.get_by_title('Bold',exact=True)
      await bold.click();await expect(bold).to_be_disabled()
      await expect(text.locator('[data-studio-format-failure=true]')).to_contain_text(format_failure)
      await expect(bold).to_be_enabled()
      await shot('native-text-format-refusal')
      await expect(draft).to_have_value('Keep this independent native failure specimen draft.')
      commands=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      refused=[item for item in commands if not item['allowed']]
      assert len(refused)==2,commands
      assert [item['action'] for item in refused]==['sendToBack','applyTextFormatCommand'],refused
      assert refused[0]['params']=={'elementId':'synthetic-local-format-1'},refused
      assert refused[1]['params']=={'elementId':'synthetic-local-format-2','command':'bold'},refused
      assert not denied,denied
      proof_meta['nativeRefusedCommands']=refused
      proof_meta['scope']='Actual format leaves and native viewer command adapter; synthetic targets and local success:false iframe responses. No service edit, selection acknowledgement or persistence.'
      checks['nativeAdapterRefusalHandledNoPageError']=True
      checks['pendingDisabledThenFailureReasonRetained']=True
      checks['fullExactReasonKeyboardScrollable']=True
      checks['targetSwitchClearsOldNoticeAndIndependentDraftRetained']=True
     elif args.area=='arrange':
      await load('/studio-local-review/arrange')
      area=await required(page.locator('[data-studio-arrange-fixture=true]'))
      await expect(area).to_contain_text('Native selection enters edit mode and sends an ordering command; that entry is not exercised here.')
      panel=await required(area.locator('[data-studio-arrange=true]'))
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      draft=area.locator('#local-arrange-draft');await draft.fill('Keep this local native Arrange draft.')
      for name,value in [('Width in points','400'),('Height in points','200'),('Horizontal position in points','11'),('Vertical position in points','22')]:
       field=await required(panel.get_by_role('spinbutton',name=name,exact=True));await expect(field).to_have_value(value);await expect(field).to_be_enabled()
      for name in ['Horizontal alignment','Vertical alignment']:await required(panel.get_by_role('combobox',name=name,exact=True))
      order=await required(panel.get_by_role('button',name='Send to Back',exact=True));await order.focus();await page.keyboard.press('Tab')
      next_order=panel.get_by_role('button',name='Send Backward',exact=True);await expect(next_order).to_be_focused();await fits_clip(next_order,True);await shot('arrange-native-order-keyboard-and-labelled-fields')
      await panel.get_by_text('Rotate & Flip',exact=True).click()
      await expect(panel.get_by_role('button',name='Flip horizontally',exact=True)).to_have_attribute('aria-pressed','false')
      await expect(panel.get_by_role('button',name='Flip vertically',exact=True)).to_have_attribute('aria-pressed','true')
      lock=panel.get_by_role('button',name='Lock element',exact=True);await expect(lock).to_have_attribute('aria-pressed','false')
      await shot('arrange-native-supplied-flip-and-lock-selection')
      await area.locator('#local-arrange-locked').check();await expect(lock).to_have_attribute('aria-pressed','true')
      for field in await panel.get_by_role('spinbutton').all():await expect(field).to_be_disabled()
      await shot('arrange-native-supplied-locked-disabled')
      await area.locator('#local-arrange-locked').uncheck()
      angle=panel.get_by_role('spinbutton',name='Rotation angle in degrees',exact=True);await angle.scroll_into_view_if_needed();await angle.focus();await expect(angle).to_have_value('40');await fits_clip(angle,True)
      await shot('arrange-native-final-angle-focus-without-blur')
      await expect(area.locator('[data-local-callback-counters=true]')).to_have_text('Commands refused 0 · Delete refused 0 · Close callbacks 0')
      await expect(draft).to_have_value('Keep this local native Arrange draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['actualHeroPanelAndArrangeFieldsHaveNativeNamesValues']=True
      checks['nativeOrderKeyboardAndSuppliedFlipLockDisabledStatesFit']=True
      checks['finalAngleFocusOnlyNoBlurCommandOrSelectionAcknowledgement']=True
      checks['zeroCommandDeleteCloseCallbacksDraftSameIframe']=True
     elif args.area=='toolbar-save':
      await load('/studio-local-review/toolbar-save')
      area=await required(page.locator('[data-studio-save-specimen=true]'))
      await expect(area).to_contain_text('do not prove actual save, retry, autosave or persistence')
      draft=area.locator('[data-studio-save-specimen-draft=true]');await draft.fill('Keep this local unsent save-feedback draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      select=area.locator('[data-studio-save-specimen-status=true]')
      for state,name in [('unsaved','Unsaved changes. Save changes now'),('error','Save failed. Save changes now')]:
       await select.select_option(state)
       button=await required(page.get_by_role('button',name=name,exact=True));await expect(button).to_be_enabled()
       await button.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(button).to_be_focused();await fits_clip(button,True)
       assert await button.evaluate('e=>e.matches(":focus-visible")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
       await shot('toolbar-save-native-'+state+'-keyboard')
       await button.hover();await shot('toolbar-save-native-'+state+'-hover')
      await area.locator('[data-studio-save-specimen-ready=true]').uncheck();await expect(button).to_be_disabled();await shot('toolbar-save-native-not-ready-disabled')
      await select.select_option('saved');await expect(page.locator('[data-studio-toolbar-save=true]')).to_have_count(0)
      await area.locator('[data-studio-save-specimen-busy=true]').check();await required(page.get_by_role('status',name='Saving changes',exact=True));await shot('toolbar-save-native-busy-overrides-saved')
      await area.locator('[data-studio-save-specimen-busy=true]').uncheck();await expect(page.locator('[data-studio-toolbar-save=true]')).to_have_count(0)
      await expect(area.locator('[data-studio-save-specimen-refused=true]')).to_have_count(0)
      await expect(draft).to_have_value('Keep this local unsent save-feedback draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeUnsavedErrorKeyboardHoverAndDisabledStatesFit']=True
      checks['nativeBusyPrecedenceAndSavedHiddenRetained']=True
      checks['suppliedStatesNoSaveAttemptSameDraftAndIframe']=True
     elif args.area=='theme-support':
      await load('/studio/themes')
      area=await required(page.locator('[data-studio-library=themes]'))
      await area.get_by_role('button',name='Library',exact=True).click()
      await expect(area.get_by_text('Evergreen studio',exact=True).first).to_be_visible()
      await area.locator('.sl-theme-support > summary').click()
      support=await required(page.get_by_role('region',name='Theme details and use',exact=True))
      await expect(support).to_contain_text('Description ending retained.')
      await support.focus();await page.keyboard.press('End');await page.wait_for_timeout(300)
      assert await support.evaluate('e=>e.scrollTop>0&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await fits_clip(support,True);await shot('theme-support-native-full-description-keyboard-end')
      await area.get_by_role('button',name='Customize a copy',exact=True).click()
      field=await required(area.get_by_role('textbox',name='Primary / brand hex value',exact=True));await field.fill('#bad')
      await expect(field).to_have_attribute('aria-invalid','true')
      warning=await required(area.locator('[data-studio-theme-color-warning=\"Primary / brand\"]'))
      assert await field.get_attribute('aria-describedby')==await warning.get_attribute('id')
      await expect(warning).to_have_text('Use a six-digit hex color, such as #287F85.')
      await expect(area.get_by_role('button',name='Save reusable theme',exact=True)).to_be_disabled()
      await field.focus();await fits_clip(field,True);await fits_clip(warning);await shot('theme-support-native-associated-invalid-color')
      await area.get_by_role('button',name='Reset Primary / brand to theme',exact=True).click();await expect(field).to_have_attribute('aria-invalid','false');await expect(warning).to_have_count(0)
      assert not denied,denied
      checks['nativeSupportFullDescriptionAndSettingsKeyboardScrollFit']=True
      checks['existingInvalidColorAssociatedAndSaveBlockedUntilReset']=True
      checks['copyAndResetOnlyNoSaveStandardApplyOrServiceMutation']=True
     elif args.area=='director-presence':
      await load('/studio-local-review/director-presence')
      area=await required(page.locator('[data-studio-director-presence-specimen=true]'))
      await expect(area).to_contain_text('supplied status/events only')
      draft=area.locator('[data-studio-director-presence-specimen-draft=true]');await draft.fill('Keep this local Director status draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      status=await required(page.get_by_role('region',name='Current Director status',exact=True));await status.focus();await page.keyboard.press('End');await page.wait_for_timeout(250);await fits_clip(status,True)
      assert await status.evaluate('e=>e.scrollHeight>e.clientHeight&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await shot('director-presence-full-status-keyboard')
      toggle=await required(page.locator('[data-studio-director-log-toggle=true]'));await expect(toggle).to_have_attribute('aria-expanded','false');await toggle.click();await expect(toggle).to_have_attribute('aria-expanded','true')
      log=await required(page.get_by_role('list',name='Director build log',exact=True));await expect(log.get_by_role('listitem')).to_have_count(30);await expect(log.get_by_role('listitem').first).to_contain_text('Returned local event 1:');await expect(log.get_by_role('listitem').last).to_contain_text('Returned local event 30:')
      await log.focus();await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(250);await fits_clip(log,True)
      assert await log.evaluate('e=>e.scrollTop>0&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await shot('director-presence-native-thirty-events-keyboard')
      await area.locator('[data-studio-director-presence-specimen-state=true]').select_option('paused');await expect(status).to_contain_text('Supplied native Director phase:');await shot('director-presence-native-paused-narration')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await log.focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowDown');await page.keyboard.press('g');await page.keyboard.press('b');await page.keyboard.press('e');await page.keyboard.press('Escape')
      assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      await area.locator('[data-studio-director-presence-specimen-state=true]').select_option('hidden');await expect(page.locator('[data-studio-director-presence=true]')).to_have_count(0);await shot('director-presence-native-inactive-hidden')
      await expect(draft).to_have_value('Keep this local Director status draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['fullNativeStatusAndLastThirtyReturnedEventsKeyboardReadable']=True
      checks['suppliedPausedAndInactiveNativeVisibilityRetained']=True
      checks['foregroundStatusLogKeysKeepCanvasAndDraftIframe']=True
      checks['noBuildTransportControlOrAcknowledgement']=True
     elif args.area=='deck-identity':
      assert identity['preview_flags'].get('deckIdentity')=='true'
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent draft while inspecting presenter details.')
      iframe=page.get_by_title('Presentation Viewer',exact=True);await expect(iframe).to_have_count(1);await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next')
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      storage=await page.evaluate("localStorage.getItem('deckster.deck_identity.v1')")
      trigger=await required(page.get_by_role('button',name='Presenter details',exact=True));await trigger.click()
      dialog=await required(page.locator('[data-studio-deck-identity=true]'))
      await expect(dialog.locator('[data-studio-deck-identity-note=true]')).to_contain_text('kept in this browser')
      await expect(dialog.get_by_role('link',name='edit in your profile',exact=True)).to_have_attribute('href','/settings/profile')
      await fits_clip(dialog.locator('[data-studio-deck-identity-header=true]'));await fits_clip(dialog.locator('[data-studio-deck-identity-footer=true]'))
      await shot('presenter-details-native-browser-fields')
      for field_id in ['company','confidentiality','logo']:
       await expect(dialog.locator('#deck-identity-'+field_id)).to_have_attribute('maxlength','120')
      await dialog.locator('#deck-identity-company').fill('A complete optional local company')
      await dialog.locator('#deck-identity-confidentiality').fill('Confidential — local unsaved review')
      logo=dialog.locator('#deck-identity-logo');await logo.fill('http://fixtures.invalid/unsaved-logo.png');await logo.focus()
      await expect(logo).to_have_attribute('aria-invalid','true');await expect(logo).to_have_attribute('aria-describedby','deck-identity-logo-warning')
      await expect(dialog.get_by_role('alert')).to_have_text('Must start with https:// — anything else is ignored.')
      await fits_clip(logo,True);await fits_clip(dialog.get_by_role('alert'),True);await shot('presenter-details-native-logo-warning')
      await page.keyboard.press('Tab');cancel=dialog.locator('[data-studio-deck-identity-action=cancel]');await expect(cancel).to_be_focused();await fits_clip(cancel,True)
      assert await cancel.evaluate('e=>e.matches(":focus-visible")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
      await shot('presenter-details-native-cancel-keyboard')
      await page.keyboard.press('Enter');await expect(dialog).to_have_count(0);await expect(trigger).to_be_focused()
      await trigger.click();dialog=await required(page.locator('[data-studio-deck-identity=true]'))
      for field_id in ['company','confidentiality','logo']:await expect(dialog.locator('#deck-identity-'+field_id)).to_have_value('')
      await shot('presenter-details-native-cancel-reopen-reset')
      await dialog.locator('[data-studio-deck-identity-action=cancel]').click()
      assert storage==await page.evaluate("localStorage.getItem('deckster.deck_identity.v1')")
      await expect(composer).to_have_value('Keep this unsent draft while inspecting presenter details.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeHeaderEntryBrowserNoteProfileLinkAndFieldCaps']=True
      checks['nativeInvalidLogoWarningAndKeyboardCancelFit']=True
      checks['cancelResetsLocalDraftStorageUnchangedAndFocusReturns']=True
      checks['noSaveSendServiceAndSameIframeComposerPreserved']=True
     elif args.area=='composer-library':
      assert identity['preview_flags'].get('composerLibrary')=='true'
      assert identity['preview_flags'].get('composerNewTopic')=='false'
      await load('/builder?session_id='+SESSION)
      wrapper=await required(page.locator('[data-studio-v4-composer]'));composer=wrapper.locator('textarea')
      await composer.fill('Keep this unsent draft while inspecting the template library.')
      iframe=page.get_by_title('Presentation Viewer',exact=True);await expect(iframe).to_have_count(1)
      await expect(iframe.content_frame.locator('body')).to_contain_text('Make the next') # Narrow Chat pane keeps the stage mounted but hidden.
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      async def open_library():
       await page.get_by_role('button',name='Reuse a saved template',exact=True).click()
       await page.get_by_role('menuitem',name='Template library',exact=True).click()
       return await required(page.locator('[data-studio-composer-library=true]'))
      dialog=await open_library()
      await expect(dialog.get_by_text('Loading templates…',exact=True)).to_be_visible();await fits_clip(dialog.locator('[data-studio-composer-header=true]'))
      await shot('composer-library-native-loading')
      await expect(dialog.locator('[data-studio-composer-record]')).to_have_count(9)
      await expect(dialog.locator('[data-studio-composer-name=true]').first).to_have_text(('Quarterly planning evidence and a complete original presentation name 0 ')*5)
      await expect(dialog.locator('[data-studio-composer-action=upload]')).to_be_disabled()
      await expect(dialog.locator('[data-studio-composer-action=new-topic]')).to_have_count(0)
      await fits_clip(dialog.locator('[data-studio-composer-name=true]').first)
      await shot('composer-library-native-full-names')
      body=dialog.locator('[data-studio-composer-body=true]');await body.focus()
      last=dialog.locator('[data-studio-composer-action=use]').last
      for _ in range(15):
       await page.keyboard.press('Tab')
       if await last.evaluate('e=>e===document.activeElement'):break
      await expect(last).to_be_focused();await fits_clip(last,True)
      assert await last.evaluate('e=>e.matches(":focus-visible")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
      await shot('composer-library-native-last-action-keyboard')
      await page.keyboard.press('Escape');await expect(dialog).to_have_count(0)
      composer_library_mode='empty';dialog=await open_library()
      await expect(dialog.get_by_text('Your uploaded templates will appear here.',exact=True)).to_be_visible();await shot('composer-library-native-empty')
      await page.keyboard.press('Escape');composer_library_mode='failed';dialog=await open_library()
      error=await required(dialog.get_by_role('alert',name='Template library error',exact=True));await error.focus();await page.keyboard.press('End');await page.wait_for_timeout(250)
      await expect(error).to_contain_text('Full diagnostic ending retained.');await fits_clip(error,True)
      assert await error.evaluate('e=>e.scrollHeight>e.clientHeight&&e.scrollTop+e.clientHeight>=e.scrollHeight-2')
      await shot('composer-library-native-refused-read-keyboard')
      await page.keyboard.press('Escape');await expect(dialog).to_have_count(0)
      await expect(composer).to_have_value('Keep this unsent draft while inspecting the template library.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['existingNativeLibraryEntryAndLoadingEmptyFullNamesRetained']=True
      checks['lastNativeActionKeyboardFocusAndFullDiagnosticAccessible']=True
      checks['noUploadUseCreateRecoveryOrMutationAttempt']=True
      checks['defaultOffNewTopicAndUnsentDraftSameIframePreserved']=True
     elif args.area=='rollback':
      flags=identity['preview_flags']
      assert flags['shell']==flags['tokens']==flags['labels']==flags['type']=='false',flags
      await load('/builder?session_id='+SESSION)
      await expect(page.locator('[data-studio-v4-shell=true]')).to_have_count(0)
      await expect(page.locator('[data-studio-director-header=true]')).to_have_count(0)
      await expect(page.locator('[data-studio-v4-rail=true]')).to_have_count(0)
      wrapper=await required(page.locator('[data-studio-v4-composer]'))
      composer=await required(wrapper.locator('textarea'))
      await composer.fill('Keep this unsent classic rollback review draft.');await composer.focus();await fits_clip(composer)
      await expect(page.get_by_text('tokens this session',exact=True)).to_be_visible()
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await shot('rollback-native-builder-composer-focus')
      await composer.fill('Review @Overview')
      await required(wrapper.get_by_text('Tag a slide',exact=True));await shot('rollback-native-slide-mention-picker')
      await composer.press('Enter');await expect(composer).to_have_value('Review @[Slide 1: Overview] ');await expect(composer).to_be_focused()
      await composer.fill('Review @Evidence');await composer.press('Tab');await expect(composer).to_have_value('Review @[Slide 2: Evidence] ');await expect(composer).to_be_focused()
      await shot('rollback-native-mention-enter-tab-draft')
      menus=wrapper.locator('[data-studio-v4-composer-toolbar] button[aria-haspopup=menu]');await expect(menus).to_have_count(3) # Native Template picker, Build theme and Research menus.
      await menus.last.click()
      research=await required(page.locator('[data-studio-v4-menu=research]'));await expect(research.get_by_role('switch')).to_have_count(2)
      await research.get_by_role('switch').last.focus();await expect(research.get_by_role('switch').last).to_be_focused();await fits_clip(research.get_by_role('switch').last,True)
      await shot('rollback-native-research-menu-focus')
      await page.keyboard.press('Escape');await expect(research).to_have_count(0)
      await expect(composer).to_have_value('Review @[Slide 2: Evidence] ')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['allVisualFlagsConfirmedOffAndNativeClassicBuilderLoaded']=True
      checks['classicSessionCounterComposerAndLocalViewerRetained']=True
      checks['classicMentionEnterTabSelectWithoutSending']=True
      checks['nativeClassicResearchMenuFocusCloseDraftAndSameIframe']=True
     elif args.area=='edit-guide':
      await load('/studio-local-review/edit-mode-guide')
      area=await required(page.locator('[data-studio-edit-guide-specimen=true]'))
      await expect(area).to_contain_text('Native Edit entry requires a mutation acknowledgement, which this specimen never supplies.')
      draft=area.locator('[data-studio-edit-guide-specimen-draft=true]');await draft.fill('Keep this unsent native edit-guide leaf review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      guide=await required(page.get_by_role('region',name='Edit mode instructions',exact=True))
      await expect(guide).to_contain_text('Click on any text to edit. Select text for formatting toolbar.')
      await expect(guide).to_contain_text('Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+S (Save)')
      await guide.focus();await expect(guide).to_be_focused();await fits_clip(guide,True)
      geometry=await guide.evaluate("e=>{const b=e.closest('[data-studio-edit-guide-specimen-boundary]').getBoundingClientRect();const r=e.getBoundingClientRect();return {guide:r.toJSON(),boundary:b.toJSON(),font:getComputedStyle(e).fontSize,client:e.clientHeight,content:e.scrollHeight}}")
      assert geometry['font']=='11px' and geometry['guide']['height']<=min(88,geometry['boundary']['height']*.4)+1,geometry
      bottom=await iframe.evaluate("e=>{const r=e.getBoundingClientRect();return {box:r.toJSON(),hit:[r.left+3,(r.left+r.right)/2,r.right-3].map(x=>document.elementFromPoint(x,r.bottom-3)===e)}}")
      assert all(bottom['hit']) and geometry['guide']['top']>=bottom['box']['bottom']-1,(geometry,bottom)
      await shot('edit-guide-native-readable-focus')
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(220)
      if geometry['content']>geometry['client']+1:
       await page.wait_for_function("document.querySelector('[data-studio-edit-guide=true]').scrollTop>0")
      assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      await expect(draft).to_have_value('Keep this unsent native edit-guide leaf review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await shot('edit-guide-native-keyboard-end')
      assert not denied,denied
      checks['completeNativeInstructionsReadableInsideBoundedLeaf']=True
      checks['focusedGuideScrollKeysDoNotReachCanvas']=True
      checks['guideOutsideFittedSlideAndAllThreeBottomTargetsReachable']=True
      checks['draftSameIframeNoEditEntryOrGenerationAcknowledgement']=True
     elif args.area=='master':
      await load('/builder?session_id='+SESSION+'&studio_action=master')
      panel=await required(page.locator('[data-studio-v4-dialog=master]'))
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent footer-and-logo review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      presets=panel.locator('[data-studio-master-preset]');await expect(presets).to_have_count(4)
      await presets.first.click();await expect(presets.first).to_have_attribute('aria-pressed','true')
      await presets.first.focus();await fits_clip(presets.first,True);await shot('master-native-selected-footer-preset')
      await panel.locator('#footer-template').fill('{title} | {author} | Page {page} of {total}')
      long_title='KeepTheCompleteNativeFooterPreviewReadable'*10
      await panel.locator('#footer-title').fill(long_title)
      await panel.locator('#footer-author').fill('Retained local reviewer')
      preview=await required(panel.locator('[data-studio-master-part=preview]'))
      await expect(preview).to_contain_text(long_title)
      await preview.scroll_into_view_if_needed()
      await expect(preview).to_contain_text('Retained local reviewer')
      assert await preview.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
      await shot('master-native-full-footer-preview')
      filename=await required(panel.locator('[data-studio-master-part=logo-file]'))
      await filename.scroll_into_view_if_needed();await expect(filename).to_have_text(MASTER_LOGO.rsplit('/',1)[1])
      assert await filename.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
      await shot('master-native-full-returned-logo-name')
      logo=panel.locator('#logo-url');await logo.focus();await expect(logo).to_have_value(MASTER_LOGO);await fits_clip(logo)
      save=panel.locator('[data-studio-master-action=save]');await expect(save).to_be_enabled()
      last=panel.locator('#logo-alt');await last.focus();await fits_clip(last)
      for _ in range(4):
       await page.keyboard.press('Tab')
       if await save.evaluate('e=>e===document.activeElement'):break
      await expect(save).to_be_focused();await fits_clip(save,True)
      assert await save.evaluate("e=>e.matches(':focus-visible') && parseFloat(getComputedStyle(e).outlineWidth)>=2")
      await shot('master-native-save-focus-without-apply')
      await panel.get_by_role('button',name='Close footer and logo panel',exact=True).click()
      await expect(composer).to_have_value('Keep this unsent footer-and-logo review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      requests=await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      assert all(r['action'] in ['getDerivativeElements','previewFooter','getCurrentSlideInfo'] for r in requests),requests
      assert not denied,denied
      checks['fourNativePresetsTrueSelectionAndFullLocalPreview']=True
      checks['fullReturnedLogoFilenameAndLastUrlFocusFit']=True
      checks['saveFocusOnlyNoUploadGenerationApplyOrClear']=True
      checks['draftSameIframeOnlyReadAndRefusedPreviewCommands']=True
     elif args.area=='slide-options':
      await load('/builder?session_id='+SESSION)
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True));await composer.fill('Keep this unsent slide-options review draft.')
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await page.get_by_role('button',name='Refine slide 1',exact=True).click()
      panel=await required(page.locator('[data-studio-v4-panel=slide-generation]'))
      prompt=panel.get_by_placeholder('What should change?',exact=True);await prompt.fill('Keep all evidence; review the structure without submitting.')
      await expect(panel.get_by_role('button',name='Hide advanced options',exact=True)).to_have_attribute('aria-expanded','true')
      structure=panel.get_by_role('button',name='Change structure (optional)',exact=True);await structure.click()
      menu=await required(page.locator('[data-studio-slide-menu=choices]'))
      await expect(menu).to_have_attribute('aria-label','Change structure (optional) options')
      await expect(menu.get_by_role('button')).to_have_count(5)
      await menu.get_by_role('button',name='Content slide',exact=True).focus();await fits_clip(menu.get_by_role('button',name='Content slide',exact=True),True)
      await shot('slide-structure-native-options-focus')
      await page.keyboard.press('Enter');await expect(menu).to_have_count(0);await expect(structure).to_be_focused()
      await panel.get_by_role('button',name='Content',exact=True).click()
      menu=await required(page.locator('[data-studio-slide-menu=choices]'));await expect(menu.get_by_role('button')).to_have_count(4)
      chart=menu.get_by_role('button',name='Chart',exact=True);await chart.focus();await fits_clip(chart,True)
      await iframe.content_frame.locator('body').evaluate('window.fixtureRequests=[]');await page.keyboard.press('ArrowDown');await page.wait_for_timeout(180)
      assert not await iframe.content_frame.locator('body').evaluate('window.fixtureRequests')
      await shot('slide-content-native-options-keyboard')
      await chart.click()
      await panel.get_by_role('button',name='Layout style',exact=True).click()
      menu=await required(page.locator('[data-studio-slide-menu=choices]'))
      choices=menu.get_by_role('button');assert await choices.count()>=4
      await choices.last.focus();await fits_clip(choices.last,True);await shot('slide-chart-layout-native-options-focus')
      await page.keyboard.press('Enter');await expect(menu).to_have_count(0)
      await panel.get_by_role('button',name='Layout style',exact=True).click()
      menu=await required(page.locator('[data-studio-slide-menu=choices]'));await expect(menu.locator('button[aria-pressed=true]')).to_have_count(1)
      await page.keyboard.press('Escape')
      await structure.click();await page.locator('[data-studio-slide-menu=choices]').get_by_role('button',name='Title slide',exact=True).click()
      await panel.get_by_role('button',name='Hero style',exact=True).click()
      menu=await required(page.locator('[data-studio-slide-menu=choices]'));await expect(menu.get_by_role('button')).to_have_count(3)
      await menu.get_by_role('button').last.focus();await fits_clip(menu.get_by_role('button').last,True);await shot('slide-hero-native-options-focus')
      await page.keyboard.press('Escape')
      await panel.get_by_role('combobox',name='Background',exact=True).click()
      select=await required(page.locator('[data-studio-slide-menu=select]'));await expect(select.get_by_role('option')).to_have_count(3)
      await select.get_by_role('option',name='Light',exact=True).focus();await fits_clip(select.get_by_role('option',name='Light',exact=True),True)
      await shot('slide-background-native-options-focus')
      await page.keyboard.press('Enter');await expect(select).to_have_count(0)
      await expect(prompt).to_have_value('Keep all evidence; review the structure without submitting.')
      await panel.get_by_role('button',name='Close slide generation panel',exact=True).click()
      await expect(composer).to_have_value('Keep this unsent slide-options review draft.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      assert not denied,denied
      checks['nativeStructureContentShapeHeroAndBackgroundPortalsFit']=True
      checks['nativeChoiceKeyboardSelectionAndFocusReturn']=True
      checks['portalArrowDoesNotReachCanvas']=True
      checks['promptsIframeAndNoSubmissionRetained']=True
     elif args.area=='template-metadata':
      await load('/studio/templates')
      area=await required(page.locator('[data-studio-library=templates]'))
      await area.get_by_role('button',name='Library',exact=True).click()
      details=await required(area.locator('[data-studio-template-read-region=true]'))
      await details.locator(':scope > summary').click()
      await details.focus();await expect(details).to_be_focused()
      await shot('template-details-native-keyboard-region')
      await details.get_by_role('button',name='Element',exact=True).click()
      await details.get_by_role('button',name='Element',exact=True).focus();await page.keyboard.press('ArrowDown')
      await details.get_by_text('Full element contract',exact=True).click()
      metadata=await required(details.get_by_role('region',name='Full element contract',exact=True))
      await metadata.focus();await expect(metadata).to_be_focused();await expect(metadata).to_contain_text('Write a fresh headline for the reporting period.')
      await shot('template-element-full-contract-keyboard')
      await details.get_by_role('button',name='Source slots',exact=True).click()
      await expect(details).to_contain_text('This saved template has no original slot metadata.')
      await details.get_by_text('Complete saved snapshot & source metadata',exact=True).click()
      metadata=await required(details.get_by_role('region',name='Complete saved snapshot & source metadata',exact=True))
      await metadata.focus();await expect(metadata).to_be_focused()
      snapshot=await metadata.inner_text();parsed=json.loads(snapshot);assert parsed['id']=='fixture-template-review'
      await expect(metadata).to_contain_text('The decisions that move us forward')
      await page.keyboard.press('End');await page.keyboard.press('ArrowDown')
      await page.wait_for_function("document.activeElement.matches('[data-studio-library-metadata=true]') && document.activeElement.scrollTop>0")
      await page.wait_for_function("document.activeElement.scrollHeight-document.activeElement.clientHeight-document.activeElement.scrollTop<=2")
      assert await area.locator('.sl-stage-space').evaluate('e=>e.getBoundingClientRect().height>=179')
      await shot('template-complete-snapshot-keyboard-end')
      await details.get_by_role('button',name='Deck',exact=True).click()
      await expect(details).to_contain_text('Explain the quarter and align on the next priorities.')
      assert not denied,denied
      checks['nativeNamedDetailsAndFullElementContractFocusable']=True
      checks['completeSnapshotJsonReadableToEndByKeyboard']=True
      action=area.locator('.sl-preview-panel .sl-actions button').first
      await action.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(action).to_be_focused();await fits_clip(action,True)
      await shot('template-action-keyboard-with-expanded-details')
      checks['expandedMetadataRetainsUsefulPreviewAndReachableNativeAction']=True
      await details.locator(':scope > summary').click()
      stage=area.locator('.sl-stage');await stage.scroll_into_view_if_needed();await fits_clip(stage,True)
      await shot('template-collapsed-details-whole-preview')
      checks['existingCollapseRestoresWholePreviewWithinAncestorClip']=True
      checks['allNativeScopesRetainedWithoutActionsOrMutation']=True
     elif args.area=='director':
      saved_session=dict(session)
      session.update({'currentStage':0,'slideCount':0,'finalPresentationUrl':None,'finalPresentationId':None,'stateCache':{}})
      await load('/builder?session_id='+SESSION)
      header=await required(page.locator('[data-studio-director-header=true]'))
      await expect(header.get_by_text('Director',exact=True)).to_be_visible()
      await expect(header.get_by_role('status',name='Director connection',exact=True)).to_have_attribute('data-connection-state','disconnected')
      await fits_clip(header)
      box=await header.bounding_box();assert box and box['height']==(32 if h<=640 else 36),box
      composer=await required(page.get_by_role('textbox',name='Message Director',exact=True))
      await composer.fill('Keep this draft while reviewing the Director heading.')
      await composer.focus();await fits_clip(composer)
      await fits_clip(page.get_by_role('button',name='Upload a file',exact=True),True)
      await expect(page.get_by_text('Enter sends · Shift+Enter for a new line',exact=True)).to_be_visible()
      await shot('director-empty-chat-draft-focus')
      session.clear();session.update(saved_session)
      await load('/builder?session_id='+SESSION)
      iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(iframe.content_frame.get_by_text('Make the next',exact=False)).to_be_visible()
      await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      composer=page.get_by_role('textbox',name='Message Director',exact=True);await composer.fill('Keep this current-deck draft through the account menu.')
      header=page.locator('[data-studio-director-header=true]');await fits_clip(header)
      await composer.focus();await fits_clip(composer)
      await shot('director-current-deck-composer-focus')
      await page.get_by_role('button',name='Open account menu',exact=True).click()
      menu=await required(page.get_by_role('menu'))
      await expect(menu.locator('[data-studio-token-counter=true]')).to_have_count(1)
      await expect(menu).to_contain_text('tokens this session')
      await fits_clip(menu.locator('[data-studio-token-counter=true]'))
      await shot('director-account-session-usage')
      await page.keyboard.press('Escape')
      await expect(composer).to_have_value('Keep this current-deck draft through the account menu.')
      assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
      await expect(page.locator('[data-studio-token-counter=true]')).to_have_count(0)
      await expect(page.locator('[data-studio-director-welcome]')).not_to_contain_text('Disconnected')
      quota_flags.update({'dailyAt':True,'dailyNear':True})
      await load('/builder?session_id='+SESSION)
      warning=await required(page.locator('[data-studio-token-warning=hard]'))
      await expect(warning).to_contain_text('Daily limit reached')
      topup=warning.get_by_role('button',name='Top up',exact=True);await topup.focus();await expect(topup).to_be_focused();await fits_clip(topup,True)
      await fits_clip(page.locator('[data-studio-director-header=true]'))
      await fits_clip(page.get_by_role('textbox',name='Message Director',exact=True))
      await shot('director-native-quota-warning-focus')
      checks['compactActualConnectionHeaderEmptyAndCurrentDeck']=True
      checks['nativeComposerInstructionsUploadAndFocusRetained']=True
      checks['sessionCounterInAccountMenuIndependentOfChat']=True
      checks['accountCloseRetainsDraftAndSameIframe']=True
      checks['nativeQuotaWarningAndTopUpStillVisibleInChat']=True
      assert not denied,denied
     elif args.area=='studio':
      saved_session=dict(session);session.update({'currentStage':0,'slideCount':0,'finalPresentationUrl':None,'finalPresentationId':None,'stateCache':{}})
      await load('/builder?session_id='+SESSION);await required(page.locator('[data-studio-v4-composer]'));await required(page.get_by_role('region',name='Your presentation stage'));await shot('welcome')
      separator=page.get_by_role('separator',name='Resize chat panel',exact=True)
      if await separator.count():
       before=float(await separator.get_attribute('aria-valuenow'));await separator.focus();await separator.press('Shift+ArrowRight');await expect(separator).to_have_attribute('aria-valuenow',str(round(before+32)));checks['welcomeNativeResize']=True
      session.clear();session.update(saved_session)
      await page.evaluate("localStorage.removeItem('deckster_builder_chat_width')")
      await load('/builder?session_id='+SESSION);frame=page.frame_locator('iframe[title="Presentation Viewer"]');await expect(frame.get_by_text('Make the next',exact=False)).to_be_visible();await shot('studio-specimen');await page.get_by_role('button',name='Show script and notes',exact=True).click();await required(page.locator('[data-studio-slide-notes=true]'));await expect(page.get_by_label('Speaker notes',exact=True)).to_be_visible();await shot('speaker-notes');await page.get_by_role('tab',name='References',exact=True).click();await expect(page.get_by_label('Slide references',exact=True)).to_be_visible();await shot('references');await page.get_by_role('button',name='Hide script and notes',exact=True).click()
      await load('/builder?session_id='+SESSION+'&studio_action=master');panel=await required(page.locator('[data-studio-v4-dialog=master]'));await expect(panel.locator('#footer-author')).to_have_value('Local reviewer');await panel.locator('#footer-author').fill('Retained local author');await expect(panel.get_by_role('button',name='Save',exact=True)).to_be_enabled();await shot('master-native');await panel.get_by_title('Close panel',exact=True).click()
      await load('/builder?session_id='+SESSION+'&studio_action=theme');await required(page.locator('[data-studio-v4-dialog=theme]'));await shot('theme-native');checks['workflowOpensWithoutApply']=True
     elif args.area=='workspaces':
      await load('/studio/details')
      area=await required(page.locator('[data-studio-personal=details]'))
      await area.get_by_role('button',name='Edit display name',exact=True).click()
      name=area.get_by_label('Account display name',exact=True);await name.fill('Draft account name')
      fitted=await required(area.locator('[data-studio-account-fit=true]'))
      save=fitted.get_by_role('button',name='Save account name',exact=True)
      cancel=fitted.get_by_role('button',name='Cancel',exact=True)
      await name.focus();await fits_clip(name);await fits_clip(save,True);await fits_clip(cancel,True)
      await shot('account-edit')
      await save.hover();await fits_clip(save,True);await shot('account-save-hover')
      await save.click();await expect(area.get_by_role('alert')).to_contain_text('refuses writes')
      await expect(name).to_have_value('Draft account name')
      status=fitted.locator('.sp-account-result');await status.focus();await expect(status).to_be_focused()
      await fits_clip(status);await fits_clip(save,True);await fits_clip(cancel,True)
      await fitted.locator('.sp-account-body').evaluate('e=>e.scrollTop=e.scrollHeight')
      await fits_clip(save,True);await fits_clip(cancel,True);await fits_clip(status)
      checks['rejectedAccountSaveRetainsDraft']=True
      checks['nativeAccountActionsAndRefusalStayVisibleWhileBodyScrolls']=True
      await shot('account-save-rejected');await cancel.click()
      await area.get_by_role('button',name='Presenter preview',exact=True).click();await area.get_by_label('Author name',exact=False).fill('Local presenter');await area.get_by_role('button',name='Footer & logo',exact=True).click();await area.get_by_role('button',name='Presenter preview',exact=True).click();await expect(area.get_by_label('Author name',exact=False)).to_have_value('Local presenter');await shot('presenter-preview');checks['previewTabRetention']=True
      await load('/studio/templates');area=await required(page.locator('[data-studio-library=templates]'));await area.get_by_role('button',name='Library',exact=True).click();await expect(area.get_by_label('Search saved templates',exact=True)).to_be_visible();await shot('templates-library');await area.get_by_role('button',name='Import presentation',exact=False).click();await required(page.locator('[data-studio-v4-dialog=template-import]'));await shot('template-import');await page.keyboard.press('Escape');await area.get_by_role('button',name='Create',exact=True).click();await area.get_by_label('Template name',exact=True).fill('Decision story');await area.get_by_label('Deck purpose',exact=True).fill('Agree on the next decision');await shot('template-planning');await area.get_by_role('button',name='Continue planning in Studio',exact=True).click();await page.wait_for_url('**/builder?*studio_action=brief*');await required(page.get_by_role('region',name='Brief ready'));composer=page.locator('[data-studio-v4-composer] textarea').first;await composer.fill('Keep this unsent message');await page.get_by_role('button',name='Keep my message',exact=True).click();await expect(composer).to_have_value('Keep this unsent message');checks['briefDoesNotReplaceWithoutConsent']=True;await shot('brief-kept')
      await load('/studio/themes');themearea=await required(page.locator('[data-studio-library=themes]'));await themearea.get_by_role('button',name='Library',exact=True).click();await expect(themearea.get_by_label('Search saved themes',exact=True)).to_be_visible();await shot('themes-library');await page.get_by_role('button',name='Choose theme in Studio',exact=True).click();await page.wait_for_url('**/builder?*studio_action=theme*');await required(page.locator('[data-studio-v4-saved-theme-notice=locked]'));await expect(page.get_by_role('button',name='Build theme',exact=True)).to_be_disabled();checks['lockedThemeUnapplied']=True;checks['themeHandoffSameSession']=SESSION in page.url;await shot('theme-handoff')
     elif args.area=='delivery':
      await load('/builder?session_id='+SESSION);await expect(page.frame_locator('iframe[title="Presentation Viewer"]').get_by_text('Make the next',exact=False)).to_be_visible();await page.get_by_role('button',name='Publish',exact=True).click();dialog=await required(page.locator('[data-studio-publish=true]'));await expect(dialog.get_by_text('Who is this for?',exact=True)).to_be_visible();await shot('publish-audience');await dialog.get_by_role('radio',name='Only with a passcode',exact=False).check();await shot('publish-restricted');await dialog.get_by_role('radio',name='Anyone with the link',exact=False).check();await dialog.get_by_role('button',name='Next · Questions',exact=True).click();await shot('publish-questions');await dialog.get_by_role('button',name='Next · Narration',exact=True).click();await shot('publish-narration');await dialog.get_by_role('button',name='Next · Review',exact=True).click();await shot('publish-review');checks['fourNativeStepsReviewed']=True;await dialog.get_by_role('button',name='Publish',exact=True).click();await expect(dialog.get_by_role('button',name='Back to choices',exact=True)).to_be_visible();await shot('publish-refused');await dialog.get_by_role('button',name='Back to choices',exact=True).click();await expect(dialog.get_by_text('Ready to publish',exact=True)).to_be_visible();checks['failedFirstPublishRetainsChoices']=True;await shot('publish-review-retained')
     else:
      messages=[{'id':'fixture-user','messageType':'chat_message','timestamp':'2026-10-01T16:20:00Z','userText':'I need a clear decision story for our leadership team.'},{'id':'fixture-chat','messageType':'chat_message','timestamp':'2026-10-01T16:25:00Z','payload':{'text':'Let’s keep the priorities clear and connect each section to the decision.'}},ACTION]
      await load('/builder?session_id='+SESSION);card=await required(page.locator('[data-studio-director-ask=choice]'));await expect(card.get_by_role('button')).to_have_count(3);await shot('director-choice');await card.get_by_role('button',name='Something else',exact=False).focus();await shot('director-choice-focus');checks['actualOptionsRetained']=True
      if args.typed_cancel_check:
       # Real native controls; all Director sockets are refused. This is visual
       # reconnect/cancel proof, not an in-flight transport acknowledgement.
       await card.get_by_role('button',name='Something else',exact=False).click()
       pending=await required(page.locator('[data-studio-composer-pending-action=true]'))
       await expect(pending).to_contain_text('Something else')
       composer=page.get_by_role('textbox',name='Message Director',exact=True)
       old_draft='Unsent pending-action input for native cancellation.'
       new_draft='Keep this newer draft after cancelling the old action.'
       await composer.fill(old_draft)
       send=page.get_by_role('button',name='Send message',exact=True)
       await expect(send).to_be_enabled();await send.click()
       await expect(page.get_by_text('Your message is still in the composer. Send it when the connection is ready.',exact=True)).to_be_visible()
       await expect(composer).to_have_value(old_draft)
       await expect(page.locator('[data-studio-director-message=user]').get_by_text(old_draft,exact=True)).to_have_count(0)
       cancel=pending.get_by_role('button',name='Cancel',exact=True)
       await composer.focus()
       for _ in range(20):
        await page.keyboard.press('Shift+Tab')
        if await cancel.evaluate('e=>e===document.activeElement'):break
       await expect(cancel).to_be_focused()
       assert await cancel.evaluate('e=>e.matches(":focus-visible")&&parseFloat(getComputedStyle(e).outlineWidth)>=2')
       await shot('pending-action-native-reconnect-retained-cancel-focus')
       await cancel.click();await expect(pending).to_have_count(0)
       await composer.fill(new_draft);await composer.focus()
       await page.wait_for_timeout(1200)
       await expect(composer).to_have_value(new_draft);await expect(composer).to_be_focused()
       await expect(page.locator('[data-studio-director-message=user]').get_by_text(old_draft,exact=True)).to_have_count(0)
       await expect(page.locator('[data-studio-director-message=user]').get_by_text(new_draft,exact=True)).to_have_count(0)
       for write in denied:
        assert write['method']=='POST' and write['path']==f'/api/sessions/{SESSION}/messages',write
        seeded=write.get('body',{}).get('messages')
        assert isinstance(seeded,list) and seeded and all(str(item.get('id','')).startswith('fixture-') for item in seeded),write
        assert old_draft not in json.dumps(write) and new_draft not in json.dumps(write),write
       checks['nativePointerReconnectRetainsDraftAndAction']=True
       checks['nativeCancelThenNewDraftRetainsNewInput']=True
       checks['nativeCancelFocusReachableAndNoSubmittedEchoOrPersistence']=True
       proof_meta['scope']='Native disconnected reconnect intent, Cancel and subsequent draft only; deep before/after-dispatch races are offline callback tests, not this visual capture.'
       proof_meta['refusedNativeSeedPersistenceCount']=len(denied)
       await shot('pending-action-native-cancel-new-draft-retained')
      else:
       messages=[QUESTIONS];await load('/builder?session_id='+SESSION);card=await required(page.locator('[data-studio-director-ask=questions]'));await card.get_by_role('button',name='Leadership',exact=False).click();await expect(card.get_by_text('What should they take away?',exact=False)).to_be_visible();await shot('director-questions');checks['questionRevealWithoutSend']=True
       if args.question_failure_check:
        own_answer=card.get_by_label('Your own answer: What should they take away?',exact=True)
        await own_answer.fill('Keep this custom answer for retry.')
        composer=page.get_by_role('textbox',name='Message Director',exact=True)
        await composer.fill('Keep this separate composer draft.')
        await expect(card.get_by_role('button',name='Leadership',exact=False)).to_have_attribute('aria-pressed','true')
        send_answers=card.locator('[data-studio-director-part=send]')
        await send_answers.focus();await expect(send_answers).to_be_focused()
        await send_answers.click()
        await expect(page.get_by_text('Your answers were not sent. They are still in the question card; check your connection and try again.',exact=True)).to_be_visible(timeout=20000)
        await expect(own_answer).to_have_value('Keep this custom answer for retry.')
        await expect(composer).to_have_value('Keep this separate composer draft.')
        await expect(card.get_by_role('button',name='Leadership',exact=False)).to_have_attribute('aria-pressed','true')
        await expect(page.get_by_text('Answers: Leadership · Keep this custom answer for retry.',exact=True)).to_have_count(0)
        await expect(send_answers).to_be_enabled()
        # Native session restoration can queue seeded Director messages even
        # before this send. Those writes are refused; failed answers must never
        # join that queue. Require the exact seeded-message shape, not zero I/O.
        for write in denied:
         assert write['method']=='POST' and write['path']==f'/api/sessions/{SESSION}/messages',write
         seeded=write.get('body',{}).get('messages')
         assert isinstance(seeded,list) and seeded and all(str(item.get('id','')).startswith('fixture-') for item in seeded),write
         assert 'Keep this custom answer for retry.' not in json.dumps(write),write
         assert 'Answers: Leadership' not in json.dumps(write),write
        proof_meta['refusedNativeSeedPersistenceCount']=len(denied)
        checks['actualFailedQuestionSendRetainsAnswersAndSeparateDraft']=True
        checks['actualFailedQuestionSendHasNoEchoOrPersistence']=True
        checks['questionRetryRemainsAvailable']=True
        await shot('director-question-send-refused-retained')
     assert not errors and not violations,(errors,violations)
     results.append({'state':label,'page_errors':errors,'violations':violations,'reads':reads,'denied_writes':denied,'blocked_expected_uat_sockets':blocked_sockets,'screenshots':shots,'checks':checks,**({'proof_meta':proof_meta} if proof_meta else {})});(out/'results.json').write_text(json.dumps({'source_identity':identity,'states':results},indent=2)+'\n')
    except Exception as e:
     await page.screenshot(path=str(out/(label+'-rejected.png')),full_page=True);(out/(label+'-rejected.json')).write_text(json.dumps({'error':str(e),'errors':errors,'violations':violations,'reads':reads,'denied_writes':denied,'shots':shots},indent=2));raise
    finally:await ctx.close()
  finally:
   await browser.close()
   if args.area in fixture_areas:
    assert fixture_route.read_text()==fixture_source,'Do not remove a changed fixture route'
    fixture_route.unlink();fixture_route.parent.rmdir();fixture_route.parent.parent.rmdir()
    # Next dev emits a type validator for this disposable route. Remove only
    # its task-owned derivative so a later source check cannot import a deleted
    # fixture; real route validators and native source checks remain untouched.
    generated=ROOT/'.next/types/app/studio-local-review'/fixture_name/'page.ts'
    if generated.exists():generated.unlink()
    if generated.parent.exists() and not any(generated.parent.iterdir()):generated.parent.rmdir()
 # Publish only a complete successful run. A rejected retry cannot overwrite accepted images.
 packet={'source_identity':identity,'capture_directory':str(out.relative_to(final_out)),'states':results}
 current=source_hashes()
 packet['capture_end_commit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 packet['source_changes_during_capture']=[f for f in sorted(set(identity['files'])|set(current)) if current.get(f)!=identity['files'].get(f)]
 (out/'results.json').write_text(json.dumps(packet,indent=2)+'\n')
 temporary=final_out/'results-next.json';temporary.write_text(json.dumps(packet,indent=2)+'\n');temporary.replace(final_out/'results.json')
if __name__=='__main__':asyncio.run(main())
