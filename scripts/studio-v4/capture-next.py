"""Bounded eligible Knowledge + current inspector journeys. Exact reads only; no mutation success."""
import asyncio,argparse,json,hashlib,subprocess,importlib.util
from urllib.parse import urlparse
from playwright.async_api import async_playwright,expect
from capture import ROOT,BASE,USER,NOW,SLIDES,SAVED,PRESETS_URL,socket_kind,required
spec=importlib.util.spec_from_file_location('populated',ROOT/'scripts/studio-v4/capture-populated.py');pop=importlib.util.module_from_spec(spec);spec.loader.exec_module(pop)
SESSION=pop.SESSION;VIEWER=pop.VIEWER
TEXT={'type':'refineElementRequested','elementId':'fixture-text-1','elementType':'text','componentType':'TEXT_BOX','slideIndex':0,'isBlank':False,'semanticRole':'BODY_TEXT','slotKind':'body','gridPosition':{'startCol':3,'startRow':4,'width':26,'height':12},'content':'<p>Local fixture operating model</p>','generationConfig':{'prompt':'Explain the operating model','showAdvanced':True,'structure':'simple','count':1,'layoutChoice':'auto','textboxOverrides':{'simple_subtype':'phrase'},'zIndex':10}}
IMAGE={'type':'refineElementRequested','elementId':'fixture-image-1','elementType':'image','componentType':'IMAGE','slideIndex':0,'isBlank':False,'gridPosition':{'startCol':3,'startRow':4,'width':12,'height':8},'properties':{'image_url':'https://fixtures.invalid/source.svg'},'content':{'image_url':'https://fixtures.invalid/source.svg'},'generationConfig':{'prompt':'Preserve the subject and lighten the background','showAdvanced':True}}
SLOTS={'canvas_type':'standard','template_id':'C1-text','slots':[{'slot_name':'body','label':'Body text','role':'BODY_TEXT','kind':'body','single_instance':False,'geometry':{'start_col':3,'start_row':4,'position_width':26,'position_height':12}}]}
fixture_html=pop.HTML.replace("const allowed=d.action==='getCurrentSlideInfo';","const allowed=['getCurrentSlideInfo','getTemplateSlotCatalog'].includes(d.action);").replace("data:{index:0,total:2,current_visual_index:0,real_slide_count:2,visual_section_count:2}","data:d.action==='getTemplateSlotCatalog'?"+json.dumps(SLOTS)+":{index:0,total:2,current_visual_index:0,real_slide_count:2,visual_section_count:2}")
buttons='<div style="display:flex;gap:8px;margin-top:12px">'+''.join('<button style="padding:6px;border:1px solid #9bacad;background:#f2f6f5;color:#243438" onclick=\'parent.postMessage('+json.dumps(event)+',"'+BASE+'")\'>Inspect fixture '+name+'</button>' for name,event in [('Text',TEXT),('Image',IMAGE)])+'</div>'
fixture_html=fixture_html.replace('</footer>','</footer>'+buttons)
async def main():
 parser=argparse.ArgumentParser();parser.add_argument('--area',choices=['inspectors','knowledge','fit','short-fit'],required=True);args=parser.parse_args()
 config=json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text());features=json.loads((ROOT/'.env.studio-v4-runtime/preview-features.json').read_text());assert config['shell']=='true' and config['type']=='false';assert features['slideRefiner']=='true'
 out=ROOT.parent/'studio-v4-next-captures-20261001'/args.area;out.mkdir(parents=True,exist_ok=True)
 files=['app/builder/page.tsx','components/builder/studio-panels.css','app/(app)/knowledge/page.tsx','components/knowledge/studio-knowledge.css','components/studio-libraries/libraries.css','components/studio-personal/personal-workspaces.css','scripts/studio-v4/preview.mjs','scripts/studio-v4/capture-next.py','components/studio-libraries/templates-workspace.tsx','components/studio-libraries/library-controls.tsx']
 identity={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files if (ROOT/f).exists()}}
 results=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch()
  try:
   cases=[('dark-1030x600',1030,600,True)] if args.area=='short-fit' else [('light-1280x720',1280,720,False),('dark-1030x600',1030,600,True)]+([('narrow-390x844',390,844,False)] if args.area=='knowledge' else [])
   for label,w,h,dark in cases:
    ctx=await browser.new_context(viewport={'width':w,'height':h},color_scheme='dark' if dark else 'light',service_workers='block');await ctx.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())])
    await ctx.add_init_script("if(location.origin==='"+BASE+"'){localStorage.setItem('theme',"+json.dumps('dark' if dark else 'light')+");localStorage.setItem("+json.dumps('deckster:last_session_id:'+USER['id'])+","+json.dumps(SESSION)+");}")
    errors=[];violations=[];requests=[];sockets=[];snapshots={};checks={}
    session={'id':SESSION,'userId':USER['id'],'title':'Local renderer fixture','createdAt':NOW,'updatedAt':NOW,'currentStage':6,'slideCount':2,'status':'active','messages':[],'finalPresentationUrl':VIEWER,'finalPresentationId':'studio-v4-local-renderer','stateCache':{'activeVersion':'final','slideStructure':{'metadata':{'main_title':'Local renderer fixture','overall_theme':'Minimal','target_audience':'Review','presentation_duration':5},'slides':SLIDES}}}
    knowledge=json.loads((ROOT/'scripts/studio-v4/knowledge-fixtures.json').read_text()) if args.area in ['knowledge','short-fit'] else {}
    workspace=json.loads((ROOT/'scripts/studio-v4/workspace-fixtures.json').read_text())
    async def route(route):
     r=route.request;u=urlparse(r.url);path=u.path
     if r.method=='GET' and r.url==VIEWER:requests.append({'method':'GET','url':r.url,'disposition':'exact-synthetic-iframe'});await route.fulfill(content_type='text/html',body=fixture_html);return
     if r.method=='GET' and r.url=='https://fixtures.invalid/source.svg':requests.append({'method':'GET','url':r.url,'disposition':'exact-synthetic-image'});await route.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#dce9e3"/><text x="20" y="80" fill="#294139">Local image fixture</text></svg>');return
     if r.method=='GET' and r.url in [VIEWER.replace('/p/','/api/presentations/'),VIEWER.replace('/p/','/api/presentations/')+'/theme/css-variables']:
      data={'css_variables':{'--theme-text':'#243438','--theme-background':'#fff'}} if path.endswith('/theme/css-variables') else {'id':'studio-v4-local-renderer','slides':[{'slide_id':'fixture-slide-1','slide_index':0,'slide_number':1,'title':'Overview','layout':'L25','sections':[],'elements':[]},{'slide_id':'fixture-slide-2','slide_index':1,'slide_number':2,'title':'Evidence','layout':'L25','sections':[],'elements':[]}]}
      requests.append({'method':'GET','url':r.url,'disposition':'exact-read-only-metadata'});await route.fulfill(json=data,headers={'Access-Control-Allow-Origin':BASE});return
     if u.netloc!='127.0.0.1:8792':
      if r.url==PRESETS_URL and r.method=='GET':await route.fulfill(json=[],headers={'Access-Control-Allow-Origin':'*'});return
      if u.hostname not in ['va.vercel-scripts.com','vitals.vercel-insights.com']:violations.append(r.method+' '+r.url)
      await route.abort();return
     if not path.startswith('/api/'):await route.continue_();return
     requests.append({'method':r.method,'path':path,'query':u.query})
     if r.method!='GET':violations.append('Refused mutation '+r.method+' '+path);await route.fulfill(status=405,json={'error':'Read-only fixture'});return
     if path=='/api/auth/session':data={'user':USER,'expires':'2099-01-01T00:00:00Z'}
     elif path=='/api/subscription':data=knowledge.get('subscription',{'subscription':None})
     elif args.area in ['knowledge','short-fit'] and path in knowledge['reads']:data=knowledge['reads'][path];assert u.query==('limit=100' if path.endswith('/graph') else ''),(path,u.query)
     elif path=='/api/director/ws-token':data={'auth_enabled':False,'auth_token':None}
     elif path==f'/api/publish/by-session/{SESSION}':data={'deck':None}
     elif path=='/api/usage/quota':data={'tier':'free','tierLabel':'Free','caps':{'dailyCents':20,'weeklyCents':50,'monthlyCents':100},'spent':{'dailyCents':0,'weeklyCents':0,'monthlyCents':0},'remainingPct':{'daily':1,'weekly':1,'monthly':1},'flags':{'dailyNear':False,'dailyAt':False,'weeklyNear':False,'weeklyAt':False},'resetAt':{'daily':NOW,'weekly':NOW},'walletBalanceCents':0,'totals':{'monthTokens':0,'monthSpendCents':0}}
     elif path=='/api/sessions':data={'sessions':[session],'pagination':{'total':1,'limit':20,'offset':0,'hasMore':False}}
     elif path==f'/api/sessions/{SESSION}':data={'session':session}
     elif path==f'/api/sessions/{SESSION}/files':data={'files':[]}
     elif path==f'/api/sessions/{SESSION}/messages':data={'messages':[]}
     elif path=='/api/themes/standard':data={'theme':None}
     elif path=='/api/themes':data=workspace['themes']
     elif path=='/api/templates':data=workspace['templates']
     elif path=='/api/templates/fixture-template-review':data=workspace['template']
     else:violations.append('Unexpected GET '+path);await route.fulfill(status=404,json={});return
     await route.fulfill(json=data)
    await ctx.route('**/*',route)
    async def ws(ws):
     sockets.append(ws.url)
     if socket_kind(ws.url)=='development':ws.connect_to_server();return
     violations.append(ws.url);await ws.close()
    await ctx.route_web_socket('**/*',ws)
    page=await ctx.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:errors.append(e.stack or str(e)));page.on('dialog',lambda d:d.accept())
    async def shot(name):
     await page.wait_for_timeout(350);assert not errors and not violations,(errors,violations)
     m=await page.evaluate('''()=>({url:location.href,width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,scrollers:[...document.querySelectorAll('*')].filter(e=>e.scrollLeft).map(e=>({tag:e.tagName,cls:e.className,left:e.scrollLeft,data:e.dataset})),fields:[...document.querySelectorAll('input,textarea,select')].map(e=>({id:e.id,label:e.getAttribute('aria-label')||e.closest('label')?.textContent,value:e.value})),panels:[...document.querySelectorAll('[data-studio-v4-panel]')].map(e=>{const r=e.getBoundingClientRect();return {kind:e.dataset.studioV4Panel,mode:e.dataset.studioV4PanelMode,x:r.x,y:r.y,width:r.width,height:r.height}})})''')
     assert m['pageWidth']<=w,m;snapshots[name]=m;await page.add_style_tag(content='nextjs-portal{display:none!important}');await page.screenshot(path=str(out/(label+'-'+name+'.png')),full_page=True,animations='disabled')
    try:
     if args.area=='short-fit':await short_fit_proof(page,shot,checks,w,h)
     elif args.area=='knowledge':await knowledge_proof(page,shot,checks,requests)
     elif args.area=='fit':await fit_proof(page,shot,checks,w,h)
     else:await inspector_proof(page,shot,checks,w,requests)
     assert not errors and not violations and all(r['method']=='GET' for r in requests),(errors,violations)
     results.append({'state':label,'page_errors':errors,'violations':violations,'requests':requests,'sockets':sockets,'snapshots':snapshots,'checks':checks});(out/'results.json').write_text(json.dumps({'source_identity':identity,'config':config,'features':features,'states':results},indent=2)+'\n');print(args.area,label,'passed',flush=True)
    except Exception as e:
     await page.screenshot(path=str(out/(label+'-rejected.png')),full_page=True);(out/(label+'-rejected.json')).write_text(json.dumps({'error':str(e),'page_errors':errors,'violations':violations,'requests':requests,'snapshots':snapshots},indent=2)+'\n');raise
    finally:await ctx.close()
  finally:await browser.close()
async def knowledge_proof(page,shot,checks,requests):
 response=await page.goto(BASE+'/knowledge',wait_until='domcontentloaded');assert response.status==200
 await required(page.get_by_role('heading',name='Knowledge map',exact=True));
 if await page.get_by_role('group',name='Knowledge graph with 6 entities and 5 relations',exact=True).count():await required(page.get_by_role('group',name='Knowledge graph with 6 entities and 5 relations',exact=True))
 else:await required(page.get_by_label('Knowledge graph entities',exact=True))
 
 if await page.evaluate('innerWidth')>=1024:
  geometry=await page.locator('[data-studio-knowledge=true]').evaluate('e=>({bottom:e.getBoundingClientRect().bottom,pageHeight:document.documentElement.scrollHeight,height:innerHeight})');assert geometry['bottom']<=geometry['height']+1 and geometry['pageHeight']<=geometry['height']+1,geometry;checks['desktopEligibleOverviewFits']=geometry
 await shot('eligible-map')
 await page.locator('[data-studio-knowledge-role=inspector]').get_by_role('button').filter(has_text='Product strategy').click();evidence=page.get_by_text('Local fixture passage: product strategy connects planning priorities with measurable outcomes.',exact=False);await expect(evidence).to_be_visible();await evidence.scroll_into_view_if_needed();await shot('source-evidence')
 count=len(requests);filters=page.get_by_label('Filter entities by type',exact=True);button=filters.get_by_role('button',name='person 1',exact=True);await button.click();await expect(button).to_have_attribute('aria-pressed','false');
 if await page.get_by_role('group',name='Knowledge graph with 5 entities and 4 relations',exact=True).count():await required(page.get_by_role('group',name='Knowledge graph with 5 entities and 4 relations',exact=True))
 else:await expect(page.get_by_label('Knowledge graph entities',exact=True).locator('li')).to_have_count(5)
 await shot('type-filter')
 await filters.get_by_role('button',name='Show all',exact=True).click();
 if await page.get_by_role('group',name='Knowledge graph with 6 entities and 5 relations',exact=True).count():await required(page.get_by_role('group',name='Knowledge graph with 6 entities and 5 relations',exact=True))
 else:await expect(page.get_by_label('Knowledge graph entities',exact=True).locator('li')).to_have_count(6)
 assert len(requests)==count
 
 if await page.get_by_role('button',name='Zoom in',exact=True).count():
  await page.get_by_role('button',name='Zoom in',exact=True).click();await page.get_by_role('button',name='Fit graph to view',exact=True).click();await page.get_by_role('button',name='Reset graph view',exact=True).click()
 checks['eligibleGraphEvidenceFilterAndViewport']=True
 await page.get_by_label('Search your knowledge graph',exact=True).fill('Northstar');await page.get_by_role('button',name='Clear search',exact=True).click();assert len(requests)==count;checks['noSearchOrImportMutation']=True
async def inspector_proof(page,shot,checks,w,requests):
 response=await page.goto(BASE+'/builder?session_id='+SESSION,wait_until='domcontentloaded');assert response.status==200
 iframe=await required(page.get_by_title('Presentation Viewer',exact=True));await expect(page.get_by_title('Present fullscreen',exact=True)).to_be_enabled(timeout=30000);await expect(iframe.content_frame.get_by_text('LOCAL READ-ONLY FIXTURE',exact=True)).to_be_visible();await page.wait_for_timeout(1000)
 await page.locator('[data-studio-v4-composer] textarea').fill('Keep this unsent inspector review draft.')
 await page.evaluate("window.proofIframe=document.querySelector('iframe[title=\"Presentation Viewer\"]')")
 for label,kind in [('Text','TEXT_BOX'),('Image','IMAGE')]:
  await iframe.content_frame.get_by_role('button',name='Inspect fixture '+label,exact=True).click();panel=await required(page.locator('[data-studio-v4-panel="element-generation"]'));await expect(panel).to_have_attribute('data-studio-v4-panel-mode','refine')
  await expect(panel.locator('textarea').first).to_have_value(TEXT['generationConfig']['prompt'] if label=='Text' else IMAGE['generationConfig']['prompt']);await shot(label.lower()+'-refine')
  if label=='Text':await expect(panel.locator('#textbox-role')).to_be_visible()
  else:await expect(panel.get_by_label('Image operation',exact=True)).to_have_value('edit')
  await panel.locator('textarea').first.fill('Unsent '+label+' refinement draft.');await shot(label.lower()+'-draft-focus')
  assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')")
  checks[label.lower()+'ActualRefineForm']=True
 await page.get_by_title('Open slide panel',exact=True).click();panel=await required(page.locator('[data-studio-v4-panel="slide-generation"]'));await panel.locator('textarea').first.fill('Unsent slide composition draft.');await shot('slide-compose')
 if await page.get_by_title('Show thumbnails',exact=True).count():await page.get_by_title('Show thumbnails',exact=True).click()
 await page.get_by_role('button',name='Refine slide',exact=True).first.click();panel=await required(page.locator('[data-studio-v4-panel="slide-generation"]'));await expect(panel.get_by_placeholder('What should change?',exact=True)).to_be_visible();await panel.get_by_placeholder('What should change?',exact=True).fill('Keep the evidence; clarify the title.');await shot('slide-refine');checks['actualComposeAndRefineWithoutSubmission']=True
 if w>=1100:
  count=len(requests);resize=[];slide=await page.locator('.studio-canvas-caption').inner_text();await iframe.content_frame.locator('body').evaluate('e=>window.fixtureRequests=[]')
  for name in ['Resize chat panel','Resize inspector panel']:
   sep=await required(page.get_by_role('separator',name=name,exact=True));before=await sep.get_attribute('aria-valuenow')
   for key in ['Home','ArrowRight','Shift+ArrowRight','ArrowLeft']:
    await sep.press(key);await page.wait_for_timeout(50)
   after=await sep.get_attribute('aria-valuenow');assert before!=after
   resize.append({'name':name,'before':before,'after':after})
  assert not await iframe.content_frame.locator("body").evaluate("e=>window.fixtureRequests.some(r=>r.action==='nextSlide'||r.action==='prevSlide'||r.action==='goToSlide')")
  assert len(requests)==count and await page.locator('.studio-canvas-caption').inner_text()==slide;checks['paneResizeDoesNotNavigateSlide']={'slideBeforeAndAfter':slide,'panes':resize};await shot('pane-resize-focus')
 assert await page.locator('[data-studio-v4-composer] textarea').input_value()=='Keep this unsent inspector review draft.';assert await page.evaluate("window.proofIframe===document.querySelector('iframe[title=\"Presentation Viewer\"]')");checks['chatDraftAndIframeRetained']=True
async def fit_proof(page,shot,checks,w,h):
 for path,root,action in [('/studio/templates','[data-studio-library=templates]','Back to Studio'),('/studio/themes','[data-studio-library=themes]','Save reusable theme'),('/studio/intelligence','[data-studio-personal=intelligence]','Apply to Deckster'),('/studio/details','[data-studio-personal=details]','Save as defaults')]:
  r=await page.goto(BASE+path,wait_until='domcontentloaded');assert r.status==200;await page.wait_for_load_state('networkidle');area=await required(page.locator(root))
  await shot(path.split('/')[-1]+'-fit')
  m=await area.evaluate('''e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,pageHeight:document.documentElement.scrollHeight}}''');assert m['bottom']<=h+1 and m['pageHeight']<=h+1,(path,m,h)
  controls=area.get_by_role('button',name=action,exact=True)
  if not await controls.count():controls=area.get_by_role('link',name=action,exact=True)
  await expect(controls).to_be_visible();box=await controls.bounding_box();assert box['y']+box['height']<=h,(path,action,box)
  
  returns=area.locator('[data-studio-v4-account-return]')
  for n in range(await returns.count()):
   box=await returns.nth(n).bounding_box();assert box and box['y']+box['height']<=h,(path,box)
  stage=area.locator('.sl-stage,.sp-sample-slide')
  if await stage.count():
   rect=await stage.first.bounding_box();assert rect and rect['height']>0 and abs(rect['width']/rect['height']-16/9)<.02 and rect['y']+rect['height']<=h,(path,rect);m['preview']=rect
  fields=area.locator('input:visible,textarea:visible,select:visible')
  if await fields.count():
   await fields.last.scroll_into_view_if_needed();assert await area.evaluate('e=>document.documentElement.scrollHeight')<=h+1
   actionBox=await controls.bounding_box();assert actionBox['y']+actionBox['height']<=h
  checks[path+'FitsWithVisibleActionAndInnerFields']=m
async def short_fit_proof(page,shot,checks,w,h):
 r=await page.goto(BASE+'/knowledge',wait_until='domcontentloaded');assert r.status==200
 await required(page.get_by_role('group',name='Knowledge graph with 6 entities and 5 relations',exact=True));await page.wait_for_timeout(500)
 geometry=await page.locator('[data-studio-knowledge-role=map-content]').evaluate("""e=>{
  const box=n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const s=getComputedStyle(e),r=box(e),child=e.firstElementChild,svg=child.querySelector('svg[role=group]');
  const visible={left:r.left+parseFloat(s.paddingLeft),top:r.top+parseFloat(s.paddingTop),right:r.right-parseFloat(s.paddingRight),bottom:r.bottom-parseFloat(s.paddingBottom)};
  return {visible,child:box(child),svg:box(svg),scroll:{top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight},nodes:[...svg.querySelectorAll('[data-kg-node]')].map(n=>({name:n.getAttribute('aria-label'),...box(n)})),controls:[...child.querySelectorAll('button[aria-label]')].map(n=>({name:n.getAttribute('aria-label'),...box(n)})),hint:box(child.querySelector('.pointer-events-none.absolute.bottom-3')),pageHeight:document.documentElement.scrollHeight};
 }""")
 def inside(a,b):return a['left']>=b['left']-1 and a['top']>=b['top']-1 and a['right']<=b['right']+1 and a['bottom']<=b['bottom']+1
 assert geometry['scroll']['top']==0 and geometry['scroll']['height']<=geometry['scroll']['client']+1,geometry
 assert inside(geometry['child'],geometry['visible']) and inside(geometry['svg'],geometry['visible']),geometry
 assert len(geometry['nodes'])==6 and all(inside(n,geometry['svg']) for n in geometry['nodes']),geometry
 assert {n['name'] for n in geometry['controls']}=={'Zoom in','Zoom out','Fit graph to view','Reset graph view'} and all(inside(n,geometry['child']) for n in geometry['controls']) and inside(geometry['hint'],geometry['child']),geometry
 assert geometry['pageHeight']<=h+1;checks['fullGraphAndControlsFitOnEntry']=geometry;await shot('knowledge-full-graph')
 r=await page.goto(BASE+'/studio/templates',wait_until='domcontentloaded');assert r.status==200;await page.wait_for_load_state('networkidle');area=await required(page.locator('[data-studio-library=templates]'))
 await area.get_by_role('button',name='Library',exact=True).click();await expect(area.get_by_label('Search saved templates',exact=True)).to_be_visible();await area.get_by_role('button',name='Create',exact=True).click()
 await area.get_by_label('Template name',exact=True).fill('Quarterly story');await area.get_by_label('Deck purpose',exact=True).fill('Align on the next priorities.');await area.get_by_label('Slide title',exact=True).fill('A clear direction');await area.get_by_label('Slide purpose',exact=True).fill('Make the next decision clear.');await page.wait_for_timeout(400)
 geometry=await area.locator('.sl-stage').evaluate("""e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,labels:[...e.querySelectorAll('.sl-blueprint-elements span,.sl-blueprint-elements strong')].map(n=>({text:n.textContent,font:parseFloat(getComputedStyle(n).fontSize),scrollHeight:n.scrollHeight,height:n.clientHeight,rect:{top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}})),pageHeight:document.documentElement.scrollHeight}}""")
 assert geometry['width']>=400 and geometry['height']>=225 and abs(geometry['width']/geometry['height']-16/9)<.02,geometry
 assert len(geometry['labels'])==2 and all(n['font']>=10 and n['rect']['top']>=geometry['top'] and n['rect']['bottom']<=geometry['bottom'] and n['scrollHeight']<=n['height']+1 for n in geometry['labels']),geometry
 assert geometry['pageHeight']<=h+1;checks['readableStructuralPreview']=geometry;await shot('templates-readable-preview')
 workflow=area.locator('.sl-workflow-link');await workflow.locator('summary').click();await expect(workflow.get_by_text('Create a deck, then use Save as Template.',exact=False)).to_be_visible();await workflow.locator('summary').click()
 # Populated planning notes remain reachable in the existing form scroll region.
 notes=area.locator('.sl-form-scroll .sl-draft-summary');await notes.scroll_into_view_if_needed();await expect(notes.get_by_text('Align on the next priorities.',exact=True)).to_be_visible()
 for control in [area.locator('.sl-side-footer .sl-primary'),area.locator('[data-studio-v4-account-return]')]:
  b=await control.bounding_box();assert b and b['y']+b['height']<=h
 checks['allPlanningNotesAndWorkflowReachableActionsVisible']=True
if __name__=='__main__':asyncio.run(main())
