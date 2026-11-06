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
from native_viewer import NativeViewer, SAMPLE, CACHE, LAYOUT_REF
ACTION={'id':'fixture-action','messageType':'action_request','timestamp':NOW,'payload':{'prompt_text':'What should this presentation help your audience decide?','actions':[{'label':'Align on priorities','value':'align_priorities','primary':True,'requires_input':False},{'label':'Review progress','value':'review_progress','primary':False,'requires_input':False},{'label':'Something else','value':'clarify_goal','primary':False,'requires_input':True}]}}
QUESTIONS={'id':'fixture-questions','messageType':'action_request','timestamp':NOW,'payload':{'prompt_text':'Two details before we start.','actions':[],'question_set':{'id':'fixture-set','intro':'Let’s shape the story together.','questions':[{'id':'audience','text':'Who is this for?','suggestions':[{'label':'Leadership','recommended':True},{'label':'Working team'}],'allow_free_text':True},{'id':'outcome','text':'What should they take away?','suggestions':[{'label':'A decision'},{'label':'A shared direction'}],'allow_free_text':True}]}}}

# Interactive harness only; the application code and runtime remain unchanged.
import os,signal,datetime
from types import SimpleNamespace
STATUS=Path('/private/tmp/studio-v4-walkthrough-status.json')
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');parser.add_argument('--headless',action='store_true');parser.add_argument('--status-path',default='/private/tmp/studio-v4-walkthrough-status.json');options=parser.parse_args()
 global STATUS;STATUS=Path(options.status_path)
 args=SimpleNamespace(area='walkthrough')
 native=NativeViewer()
 sample_slides=[{**slide,'title':SAMPLE['slides'][i]['content']['slide_title'],'thumbnail_presentation_id':'studio-v4-local-renderer','thumbnail_url':BASE+'/studio-local-sample/slides/'+str(i+1)+'.png'} for i,slide in enumerate(SLIDES)]
 workspace=json.loads((ROOT/'scripts/studio-v4/workspace-fixtures.json').read_text())
 knowledge=json.loads((ROOT/'scripts/studio-v4/ten-hour-knowledge-fixture.json').read_text())
 fixture_areas=[];fixture_name=''
 config=json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text())
 assert config['shell']=='true' and config['tokens']=='true' and config['labels']=='true' and config['type']=='false',config
 async with async_playwright() as pw:
  await native.thumbnails(pw)
  browser=await pw.chromium.launch(headless=options.headless,args=['--window-size=1440,960'])
  ctx=await browser.new_context(no_viewport=True,service_workers='block')
  await ctx.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())])
  await ctx.add_init_script("if(location.origin==='"+BASE+"'){localStorage.setItem('theme','light');localStorage.setItem("+json.dumps('deckster:last_session_id:'+USER['id'])+","+json.dumps(SESSION)+");}")
  await ctx.add_init_script("if(window===window.top)addEventListener('DOMContentLoaded',()=>{const prefix='LOCAL SAMPLE WALKTHROUGH — ';const label=()=>{if(!document.title.startsWith(prefix))document.title=prefix+document.title};label();new MutationObserver(label).observe(document.head,{childList:true,subtree:true,characterData:true});})")
  auth_release=asyncio.Event();session_release=asyncio.Event();switch_release=asyncio.Event();theme_preview_release=asyncio.Event();theme_preview_started=asyncio.Event()
  errors=[];violations=[];reads=[];denied=[];blocked_sockets=[];shots={};checks={};proof_meta={};messages=[];refuse_detail=False;refuse_graph=False;refuse_settings=False;settings_subscribed=True;questions_enabled=True;refuse_inbox=False;refuse_preferences=False;help_signed_out=False;quota_flags={};profile_quota_unavailable=False;composer_library_mode='loaded'
  session={'id':SESSION,'userId':USER['id'],'title':'Quarterly strategy · LOCAL SAMPLE','createdAt':NOW,'updatedAt':NOW,'currentStage':6,'slideCount':2,'status':'active','messages':messages,'finalPresentationUrl':VIEWER,'finalPresentationId':'studio-v4-local-renderer','stateCache':{'activeVersion':'final','slideStructure':{'metadata':{'main_title':'Quarterly strategy','overall_theme':'Minimal','target_audience':'Leadership','presentation_duration':5},'slides':sample_slides}}}
  if args.area=='mention-titles':
   session['stateCache']['slideStructure']['slides']=[{**slide,'title':('Quarterly priorities and the complete next decision to review with the leadership team' if i==0 else 'Evidence and the full supporting context for the second decision')+' — '+('retained slide title detail ' * 3)} for i,slide in enumerate(SLIDES)]
  async def route(route):
   r=route.request;u=urlparse(r.url);path=u.path
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
   if await native.route(route):reads.append(r.url);return
   if r.method=='GET' and r.url in [BASE+'/studio-local-sample/slides/1.png',BASE+'/studio-local-sample/slides/2.png']:
    reads.append(r.url);await route.fulfill(content_type='image/png',body=(CACHE / ('slide-'+path.split('/')[-1])).read_bytes());return
   if args.area=='theme-source' and r.method=='GET' and r.url==VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables':
    reads.append(r.url);theme_preview_started.set();await theme_preview_release.wait();await route.fulfill(status=503,json={'error':'Local theme preview read refused.'},headers={'Access-Control-Allow-Origin':BASE});return
   if r.method=='GET' and r.url in [VIEWER.replace('/p/','/api/presentations/'),VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables']:
    data={'css_variables':{'--theme-text':'#27463b','--theme-background':'#f7f9f3'}} if path.endswith('/theme/css-variables') else {**SAMPLE,'id':'studio-v4-local-renderer','slides':[{**slide,'slide_index':i,'slide_number':i+1,'title':slide['content']['slide_title'],'sections':[],'elements':[]} for i,slide in enumerate(SAMPLE['slides'])]}
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
    denied.append({'method':r.method,'path':path});await route.fulfill(status=405,json={'error':'Local sample walkthrough: changes are refused; nothing is saved or sent.'});return
   reads.append(path+('?' + u.query if u.query else ''))
   if path=='/api/composer-library/templates':
    assert not u.query
    if composer_library_mode=='failed':
     await route.fulfill(status=503,json={'error':('Local read refused; no template upload or deck creation occurred. '*22)+'Full diagnostic ending retained.'});return
    if composer_library_mode=='empty':await route.fulfill(json={'templates':[]});return
    await asyncio.sleep(2)
    await route.fulfill(json={'templates':[{'id':'local-composer-'+str(i),'name':('Quarterly planning evidence and a complete original presentation name '+str(i)+' ')*5,'slide_count':i+2} for i in range(9)]});return
   if path=='/api/preferences':
    assert not u.query
    if refuse_preferences:await route.fulfill(status=503,json={'error':'Local preferences unavailable'});return
    data={'emailAccountActivity':True,'emailProductUpdates':False,'emailMarketing':False,'activityTracking':False if args.area=='privacy' else True}
   elif args.area=='help' and help_signed_out and path=='/api/auth/session':await route.fulfill(json={});return
   elif path=='/api/auth/session':
    if args.area=='waiting-native':await auth_release.wait()
    data={'user':{**USER,**({'tier':'pro'} if args.area=='billing' else {})},'expires':'2099-01-01T00:00:00Z'}
   elif args.area=='billing' and path=='/api/subscription':data={'subscription':{'status':'active','tier':'pro','billingCycle':'monthly','currentPeriodEnd':'2026-11-02T00:00:00Z','cancelAtPeriodEnd':False}}
   elif path=='/api/subscription':data=knowledge.get('subscription',{'subscription':None})
   elif path in knowledge['reads']:
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
   elif path==f'/api/publish/by-session/{SESSION}':assert u.query in ['', 'checkStale=1'];data={'deck':PUBLISHED if args.area in ['manage','owner-inbox'] else None,'staleness':'unknown','currentSlideCount':2}
   elif args.area=='owner-inbox' and path=='/api/publish/fixture-shared-deck/questions':
    data={'questions':[{'id':'fixture-'+status,'question':question,'status':status,'gateReason':'no_evidence' if status=='deferred' else None,'aiAnswer':None,'askerName':'Local visitor','askerEmail':None,'ownerAnswer':'Review the priorities at the next team meeting.' if status=='owner_answered' else None,'ownerAnsweredAt':NOW if status=='owner_answered' else None,'createdAt':NOW} for status,question in [('deferred','Who owns the next decision and when will the team review it?'),('owner_answered','What happens after the review?'),('blocked','An unrelated request')]],'nextCursor':None,'unansweredCount':1,'qaEnabled':questions_enabled,'corpusStatus':'ready'}
   elif args.area=='manage' and path=='/api/publish/fixture-shared-deck/qa-sources':data={'sources':[{'sourceRef':'fixture-deck-source','sourceKind':'deck','sourceLabel':'Presentation content','chunkCount':2,'allowedForQa':True}]}
   elif args.area=='manage' and path=='/api/publish/fixture-shared-deck/qa-corpus':data={'status':'ready'}
   elif path=='/api/narration/manifest':
    if args.area=='published':assert u.query=='slug=fixture-shared-deck';await route.fulfill(status=404,json={'error':'No local narration'});return
    assert u.query=='presentationId=studio-v4-local-renderer';data={'slides':[],'voiceName':None}
   elif path=='/api/narration/voice':assert u.query=='sessionId='+SESSION;data=json.loads((ROOT/'scripts/studio-v4/narration-voice-fixture.json').read_text()) if args.area=='manage' else {'voices':[],'selectedVoiceId':None,'effectiveVoiceId':None,'persistenceReady':False,'samplesReady':False}
   elif path=='/api/account/usage':data={'presentationCount':14,'storageBytes':5242880}
   elif path=='/api/wallet/balance':data={'balanceCents':1250,'transactions':[{'id':'fixture-credit','type':'credit','amountCents':1000,'reason':'Local_credit_record_for_display_only','balanceAfterCents':1250,'sourceRef':None,'createdAt':NOW},{'id':'fixture-debit','type':'debit','amountCents':250,'reason':'Local_generation_record_for_display_only','balanceAfterCents':1250,'sourceRef':None,'createdAt':NOW}]}
   elif path=='/api/billing/invoices':data={'invoices':[{'id':'local-invoice-'+str(i),'date':'2026-09-'+str(i+1).zfill(2)+'T12:00:00Z','amount':20+i,'status':'Paid · local specimen','downloadUrl':'https://fixtures.invalid/invoice-'+str(i)} for i in range(9)]}
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
  page=await ctx.new_page();page.set_default_timeout(20000)
  ctx.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
  page.on('pageerror',lambda e:errors.append(str(e)))
  async def status():
   STATUS.write_text(json.dumps({'pid':os.getpid(),'running':True,'browser':'Dedicated headed Chromium, isolated intercepted context','url':page.url,'pages':[p.url for p in ctx.pages if not p.is_closed()],'read_count':len(reads),'refused_write_count':len(denied),'unexpected_transport':violations,'page_errors':errors,'blocked_product_socket_count':len(blocked_sockets),'sample_data':True,'real_services_contacted':False,'layout_source_ref':LAYOUT_REF,'browser_viewport_emulation':False},indent=2)+'\n')
  response=await page.goto(BASE+'/builder?session_id='+SESSION,wait_until='domcontentloaded');assert response.status==200
  await required(page.locator('[data-studio-v4-shell-workspace=true]'))
  await expect(page.get_by_title('Presentation Viewer',exact=True)).to_have_count(1)
  await expect(page.get_by_title('Presentation Viewer',exact=True).content_frame.locator('body')).to_contain_text('Make the next decision clear.')
  await page.get_by_title('Presentation Viewer',exact=True).content_frame.locator('.reveal').wait_for()
  assert not errors and not violations,(errors,violations)
  if options.verify:
   from verify_walkthrough import verify
   await verify(page,ctx,browser,errors,violations,denied,native,session)
   await browser.close();return
  await page.bring_to_front();await status()
  print('READY: Interactive local sample walkthrough in dedicated Chromium window. URL '+page.url+' PID '+str(os.getpid()),flush=True)
  try:
   while browser.is_connected() and not page.is_closed():
    await status();await asyncio.sleep(1)
  finally:
   await browser.close();STATUS.write_text(json.dumps({'pid':os.getpid(),'running':False})+'\n')
if __name__=='__main__':asyncio.run(main())
