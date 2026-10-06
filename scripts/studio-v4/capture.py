"""Studio v4 local Builder proof. Fresh contexts; product HTTP/WS intercepted.
Explicit independent palette/type flags and existing mentions flag. Containment
CSS is capture-only, separately reviewed. No connected/account/persistence proof.
"""
import argparse, asyncio, json, time, re, hashlib, subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://127.0.0.1:8792'
HMR = 'ws://127.0.0.1:8792/_next/webpack-hmr'
DIRECTOR = 'wss://directorv40-uat.up.railway.app/ws'
PRESETS_URL = 'https://themebuilderv10-uat.up.railway.app/api/v1/themes/presets'
USER = {'id':'studio-v4-cp0-local','name':'CP0 Local Fixture','email':'cp0@example.invalid','tier':'free','approved':True,'walletBalanceCents':0,'subscription':None}
NOW = '2026-10-01T16:30:00Z'
SAVED = {'id':'local-theme','name':'Local minimal','theme_payload':{'mode':'preset','preset_id':'minimal'},'is_standard':False}
SLIDES = [{'slide_id':f'local-slide-{i+1}','slide_number':i+1,'slide_type':'content','title':title,'narrative':'Local metadata only','key_points':[],'analytics_needed':None,'visuals_needed':None,'diagrams_needed':None,'structure_preference':None} for i,title in enumerate(['Overview','Evidence'])]

async def required(locator, timeout=20000):
    await expect(locator).to_have_count(1, timeout=timeout)
    await expect(locator).to_be_visible()
    return locator

async def shot(page, out, name, errors, violations, allow_non_builder=False):
    if not allow_non_builder:
        assert await page.locator("[data-studio-v4-composer]").count() == 1
    assert not errors, f'Uncaught page errors: {errors}'
    assert not violations, f'Unexpected product transport: {violations}'
    await page.wait_for_timeout(300)
    assert not errors and not violations,(errors,violations)
    measured=await page.evaluate("""() => {
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,right:r.right,left:r.left}};
      const visible=e=>e.getBoundingClientRect().height>0 && getComputedStyle(e).display!=='none';
      const roots=[...document.querySelectorAll('[data-studio-v4-composer],[data-studio-v4-menu]')];
      return {viewport:{width:innerWidth,height:innerHeight},pageWidth:document.body.scrollWidth,scopes:roots.filter(visible).map(e=>({kind:e.dataset.studioV4Menu||'composer',type:e.dataset.studioV4Type||'off',rect:rect(e),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight})),roles:[...document.querySelectorAll('[data-studio-v4-type-role]')].filter(visible).map(e=>{const s=getComputedStyle(e);return {role:e.dataset.studioV4TypeRole,tag:e.tagName,text:(e.textContent||e.placeholder||'').trim(),fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,fontFamily:s.fontFamily,color:s.color,rect:rect(e)}}),controls:roots.flatMap(root=>[...root.querySelectorAll('button,input:not([type=file]),select,textarea')].filter(visible).map(e=>({kind:root.dataset.studioV4Menu||'composer',tag:e.tagName,type:e.type||null,text:e.textContent.trim(),label:e.getAttribute('aria-label'),title:e.getAttribute('title'),value:e.value||null,disabled:!!e.disabled,checked:e.checked??e.getAttribute('data-state'),rect:rect(e)}))),headerControls:[...document.querySelectorAll('header button,header a')].filter(visible).map(e=>({tag:e.tagName,text:e.textContent.trim(),label:e.getAttribute('aria-label'),href:e.getAttribute('href'),title:e.getAttribute('title'),rect:rect(e),focused:e===document.activeElement,focusVisible:e.matches(':focus-visible')})),accountRoles:[...document.querySelectorAll('[data-studio-v4-account-header],[data-studio-v4-account-nav],[data-studio-v4-account-return],[data-studio-v4-account-home],[data-studio-v4-access-role]')].filter(visible).map(e=>{const s=getComputedStyle(e);return {role:e.dataset.studioV4AccessRole||(['Header','Nav','Return','Home'].find(k=>e.dataset['studioV4Account'+k])||'unknown').toLowerCase(),tag:e.tagName,text:e.textContent.trim(),current:e.getAttribute('aria-current'),color:s.color,background:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,focusVisible:e.matches(':focus-visible'),fontSize:s.fontSize,lineHeight:s.lineHeight,rect:rect(e),backgroundImage:s.backgroundImage}}),accountFrame:document.querySelector('[data-studio-v4-account-header]')?{background:getComputedStyle(document.querySelector('[data-studio-v4-account-header]').parentElement).backgroundColor,rect:rect(document.querySelector('[data-studio-v4-account-header]').parentElement)}:null,illustration:document.querySelector('[data-studio-v4-access] .grid > div:nth-child(2)')?{rect:rect(document.querySelector('[data-studio-v4-access] .grid > div:nth-child(2)')),html:document.querySelector('[data-studio-v4-access] .grid > div:nth-child(2)').outerHTML}:null,pane:{header:rect(document.querySelector('header')),composerWidth:document.querySelector('[data-studio-v4-composer]')?.getBoundingClientRect().width??null}};
    }""")
    (out/(name+'.json')).write_text(json.dumps(measured,indent=2)+'\n')
    await page.screenshot(path=str(out/(name+'.png')), animations='disabled')

def socket_kind(url):
    if url == HMR:
        return 'development'
    parsed=urlparse(url)
    if parsed.scheme=='wss' and parsed.netloc=='directorv40-uat.up.railway.app' and parsed.path=='/ws':
        return 'product'
    return 'blocked'

def contrast(a,b):
    def luminance(color):
        channels=[int(v)/255 for v in re.findall(r'\d+',color)[:3]]
        linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels]
        return sum(c*w for c,w in zip(linear,[.2126,.7152,.0722]))
    la,lb=sorted([luminance(a),luminance(b)])
    return round((lb+.05)/(la+.05),2)

# Architect-authorized CAPTURE-ONLY trial. Never imported by application code.
CONTAINMENT_TRIAL_CSS = '''
[data-studio-v4-type="true"][data-studio-v4-composer] {
  min-height: 0;
  overflow-y: auto;
}
[data-studio-v4-type="true"] [data-studio-v4-prompt] > .bottom-full {
  position: static;
  bottom: auto;
  left: auto;
}
'''

async def containment_trial(page,out,label,textarea,upload,theme,options,upload_release,errors,violations,args,frames):
    composer=page.locator('[data-studio-v4-composer]')
    observations={}; access=[]; records={}
    async def visible_hit(loc):
        return await loc.evaluate("""e=>{
          const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
          if(r.width<=0||r.height<=0||y<56||y>=innerHeight||x<0||x>=innerWidth)return false;
          for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll|hidden/.test(s.overflowY)&&(y<q.top||y>=q.bottom))return false;}
          return e.contains(document.elementFromPoint(x,y));
        }""")
    async def wheel_root(delta):
        r=await composer.bounding_box()
        await page.mouse.move(r['x']+r['width']-4,max(60,min(page.viewport_size['height']-8,r['y']+r['height']/2)))
        await page.mouse.wheel(0,delta);await page.wait_for_timeout(180)
    async def reveal(loc):
        for _ in range(8):
            if await visible_hit(loc):return True
            port=await loc.evaluate("""e=>{const r=e.getBoundingClientRect();for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect();if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight&&(r.top<q.top||r.bottom>q.bottom)){return {x:q.right-4,y:Math.max(60,Math.min(innerHeight-8,q.top+q.height/2)),delta:r.top<q.top?-180:180};}}return {x:414,y:Math.max(60,Math.min(innerHeight-8,r.top)),delta:r.top<56?-180:180};}""")
            await page.mouse.move(port['x'],port['y']);await page.mouse.wheel(0,port['delta']);await page.wait_for_timeout(180)
        return await visible_hit(loc)
    async def real_click(loc,kind):
        if await loc.is_disabled():
            access.append({'action':kind,'disabledRetained':True,'activated':False})
            return False
        reachable=await reveal(loc)
        access.append({'action':kind,'reachableByNormalWheel':reachable})
        if not reachable:return False
        r=await loc.bounding_box();await page.mouse.click(r['x']+r['width']/2,r['y']+r['height']/2)
        return True
    async def snapshot(name):
        await page.wait_for_timeout(350)
        m=await page.evaluate("""() => {
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom}};
          const c=document.querySelector('[data-studio-v4-composer]'),t=c.querySelector('textarea'),pane=c.parentElement;
          const transcript=pane.querySelector('[data-radix-scroll-area-viewport]');
          const list=c.querySelector('[data-studio-v4-type-role=mention-heading]')?.parentElement;
          return {viewport:{width:innerWidth,height:innerHeight},composer:{...rect(c),scrollTop:c.scrollTop,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight,overflowY:getComputedStyle(c).overflowY,minHeight:getComputedStyle(c).minHeight},transcript:transcript?{...rect(transcript),clientHeight:transcript.clientHeight,scrollTop:transcript.scrollTop,scrollHeight:transcript.scrollHeight}:null,pane:{...rect(pane),scrollTop:pane.scrollTop},draft:t.value,caret:{start:t.selectionStart,end:t.selectionEnd,focused:document.activeElement===t},textarea:{...rect(t),height:t.clientHeight,scrollTop:t.scrollTop,scrollHeight:t.scrollHeight},suggestions:list?{...rect(list),position:getComputedStyle(list).position,scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight}:null,focused:{text:document.activeElement?.textContent?.trim(),label:document.activeElement?.getAttribute('aria-label'),rect:rect(document.activeElement)},controls:[...c.querySelectorAll('button')].map(e=>({text:e.textContent.trim(),label:e.getAttribute('aria-label'),disabled:e.disabled,rect:rect(e)})),menus:[...document.querySelectorAll('[data-studio-v4-menu]')].map(e=>({kind:e.dataset.studioV4Menu,rect:rect(e)})),iframes:document.querySelectorAll('iframe').length};
        }""")
        records[name]=m
        (out/(label+'-trial.json')).write_text(json.dumps({'mode':args.containment_trial,'variant':args.early_variant,'injected_rules':CONTAINMENT_TRIAL_CSS if args.containment_trial=='candidate' else None,'states':records,'access':access,'observations':observations},indent=2)+'\n')
        await shot(page,out,label+'-'+name,errors,violations)
        return m
    await snapshot('initial')
    if args.early_variant in ['action-review','action-mention']:
        assert await real_click(page.get_by_role('button',name='Provide audience and source details',exact=True),'history-action')
        await expect(page.locator('[data-studio-v4-type-role="action-label"]')).to_be_visible()
        assert await reveal(textarea)
        await textarea.fill('Long draft for local containment review.\n'*20+'x'*160)
        await page.locator('input[type=file]').set_input_files([{'name':'Very-long-source-'+str(i)+'-'+'context-'*12+'.txt','mimeType':'text/plain','buffer':b'Local fixture bytes'} for i in range(5)])
        await expect(page.locator('[data-studio-v4-prompt] [role=status]')).to_have_count(5)
        await expect(page.locator('[data-studio-v4-type-role="upload-status"]')).to_be_visible()
        await snapshot('crowded-uploading')
        await wheel_root(-5000);await snapshot('crowded-uploading-top')
        await wheel_root(5000);await snapshot('crowded-uploading-bottom')
        # Native backward traversal naturally scrolls each ancestor, with no
        # focus(), scrollTop assignment or forced scrollIntoView in the trial.
        if await real_click(textarea,'prompt-for-keyboard'):
            traversal=[]
            for _ in range(12):
                await page.keyboard.press('Shift+Tab');await page.wait_for_timeout(100)
                traversal.append(await page.evaluate("""()=>{const e=document.activeElement,r=e.getBoundingClientRect(),c=document.querySelector('[data-studio-v4-composer]');return {text:e.textContent.trim(),label:e.getAttribute('aria-label'),top:r.top,bottom:r.bottom,composerScrollTop:c.scrollTop,hit:r.y+r.height/2>=56&&r.y+r.height/2<innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}"""))
            observations['backwardTab']=traversal
        await snapshot('crowded-keyboard')
        for loc,kind in [(theme,'theme'),(options,'research')]:
            if await real_click(loc,kind+'-trigger'):
                menu=await required(page.locator('[data-studio-v4-menu="'+kind+'"]'))
                before=await textarea.input_value()
                await snapshot('crowded-'+kind+'-menu')
                await wheel_root(-180)
                await snapshot('crowded-'+kind+'-menu-wheel')
                await page.keyboard.press('Escape');await expect(loc).to_be_focused()
                assert await textarea.input_value()==before
                observations[kind+'FocusReturn']=True
        upload_release.set()
        await expect(page.locator('[data-studio-v4-type-role="upload-status"]')).to_contain_text("couldn't be uploaded",timeout=15000)
        await wheel_root(-5000);await snapshot('crowded-error-top')
        await wheel_root(5000);await snapshot('crowded-error-bottom')
    else:
        await expect(page.locator('[data-studio-v4-type-role="selection-label"]')).to_have_count(0)
    if args.early_variant=='action-review':
        assert await page.locator('[data-studio-v4-type-role="mention-heading"]').count()==0
        observations['noSuggestionsWithoutSlideMetadata']=True
    # Actual cached metadata drives the existing list; no replacement picker.
    frames_before=len([f for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message'])
    if args.early_variant!='action-review' and await reveal(textarea):
        await textarea.fill(('Long draft\n'*20 if args.early_variant=='action-mention' else 'Preserved caret draft ')+'@')
        heading=await required(page.locator('[data-studio-v4-type-role="mention-heading"]'))
        await snapshot('mention-open')
        discoverable=await reveal(heading);observations['suggestionsDiscoverableByWheel']=discoverable
        await snapshot('mention-discovered')
        first=page.locator('[data-studio-v4-type-role="mention-row"]').first
        title=(await first.locator('span').last.text_content())[:60] # Existing mentionToken wire-label cap
        if await real_click(first,'mention-mouse'):
            await expect(textarea).to_be_focused()
            assert (await textarea.input_value()).endswith('@[Slide 1: '+title+'] ')
            observations['mouseSelectKeepsCaret']=True
            await snapshot('mention-mouse-selected')
        if await reveal(textarea):
            await textarea.fill('Preserved caret draft @1')
            await page.keyboard.press('Enter');await expect(textarea).to_be_focused()
            assert (await textarea.input_value()).endswith('@[Slide 1: '+title+'] ')
            observations['enterSelectNoSend']=True
            await textarea.fill('Preserved caret draft @2')
            await page.keyboard.press('Tab');await expect(textarea).to_be_focused()
            assert '@[Slide 2: ' in await textarea.input_value()
            observations['tabSelectNoSend']=True
            await snapshot('mention-keyboard-selected')
    assert frames_before==len([f for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message'])
    if args.early_variant in ['action-review','action-mention']:
        # Removal opens the existing Upload gate again; no real upload follows.
        remove=page.get_by_role('button',name=re.compile('^Remove Very-long-source-4-'))
        if await real_click(remove,'remove-last-file'):
            await expect(page.locator('[data-studio-v4-prompt] [role=status]')).to_have_count(4)
            observations['uploadGateReenabled']=not await upload.is_disabled()
        before=await textarea.input_value()
        if await real_click(page.get_by_role('button',name='Clear all',exact=True),'clear-all-files'):
            await expect(page.locator('[data-studio-v4-prompt] [role=status]')).to_have_count(0)
            assert await textarea.input_value()==before
            observations['clearFilesPreservesDraft']=True
        await snapshot('files-cleared')
        if args.early_variant=='action-review':
            for kind in ['theme','template']:
                clear=await required(page.get_by_role('button',name='Clear '+kind,exact=True))
                if await real_click(clear,'clear-'+kind):
                    assert await textarea.input_value()==before
        else:
            assert await page.get_by_role('button',name='Clear theme',exact=True).count()==0
            assert await page.get_by_role('button',name='Clear template',exact=True).count()==0
            observations['generationClearGatesRetained']=True
        if await real_click(page.get_by_role('button',name='Cancel',exact=True),'cancel-action'):
            await expect(textarea).to_have_value('') # Existing explicit Cancel clears draft.
            observations['explicitCancelKeepsExistingDraftClear']=True
            await textarea.fill(before)
        await snapshot('banners-cleared')
    if args.trial_actions:
        before_upload=await textarea.input_value()
        assert not await upload.is_disabled()
        assert await reveal(upload)
        async with page.expect_file_chooser() as chooser:
            assert await real_click(upload,'native-upload-chooser')
        assert (await chooser.value).is_multiple()
        assert await textarea.input_value()==before_upload
        observations['nativeUploadChooserPreservesDraft']=True
        send=await required(page.locator('button[type=submit]'))
        observations['sendReachableByNormalWheel']=await reveal(send)
        assert observations['sendReachableByNormalWheel']
        observations['sendDisabledMatchesDisconnectedState']=await send.is_disabled()
        assert observations['sendDisabledMatchesDisconnectedState']
        await snapshot('native-upload-send')
    before=await textarea.input_value()
    await page.set_viewport_size({'width':1280,'height':900});await snapshot('resized-tall')
    await page.set_viewport_size({'width':int(label.split('-')[1].split('x')[0]),'height':int(label.split('x')[1])})
    assert await textarea.input_value()==before
    await snapshot('resized-back')
    assert not errors and not violations,(errors,violations)
    assert await page.locator('iframe').count()==0
    return {'trial':args.containment_trial,'variant':args.early_variant,'records':records,'access':access,'observations':observations}

async def early_readability(page,out,label,textarea,upload,theme,options,upload_release,errors,violations,args,ws,fixture_session):
    # Existing file input and hook create every attachment/status. No component
    # state override: hold then fail the intercepted URL preparation request.
    await expect(page.locator('[data-studio-v4-type-role="selection-label"]')).to_have_count(2)
    if args.early_variant in ['action-review','action-mention']:
        action_label='Provide audience and source details'
        await (await required(page.get_by_role('button',name=action_label,exact=True))).click()
        await expect(page.locator('[data-studio-v4-type-role="action-label"]')).to_have_text(action_label)
    await textarea.fill('Long draft for local containment review.\n'*20 + 'x'*160)
    await page.locator('input[type=file]').set_input_files([{'name':('Very-long-attached-source-'+str(i)+'-'+'context-'*12+'.txt'),'mimeType':'text/plain','buffer':b'Local fixture bytes'} for i in range(5)])
    await expect(page.locator('[data-studio-v4-type-role="upload-status"]')).to_be_visible()
    await expect(page.locator('[data-studio-v4-prompt] [role=status]')).to_have_count(5)
    await expect(page.locator('button[type=submit]')).to_be_disabled()
    records={}
    async def measure(name):
        await page.wait_for_timeout(350)
        records[name]=await page.evaluate("""() => {
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,right:r.right,left:r.left}};
          const c=document.querySelector('[data-studio-v4-composer]');
          return {viewport:{width:innerWidth,height:innerHeight},bodyWidth:document.body.scrollWidth,composer:rect(c),textarea:{...rect(c.querySelector('textarea')),fontSize:getComputedStyle(c.querySelector('textarea')).fontSize,lineHeight:getComputedStyle(c.querySelector('textarea')).lineHeight,scrollHeight:c.querySelector('textarea').scrollHeight},controls:[...c.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:e.textContent.trim(),label:e.getAttribute('aria-label'),disabled:e.disabled,rect:rect(e)})),feedback:[...c.querySelectorAll('[data-studio-v4-type-role], [role=status]')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({role:e.getAttribute('data-studio-v4-type-role'),text:e.textContent.trim(),fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,rect:rect(e),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight})),menus:[...document.querySelectorAll('[data-studio-v4-menu]')].map(e=>({kind:e.dataset.studioV4Menu,rect:rect(e),availableHeight:getComputedStyle(e).getPropertyValue('--radix-dropdown-menu-content-available-height'),maxHeight:getComputedStyle(e).maxHeight,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}))};
        }""")
        (out/(label+'-measurements.json')).write_text(json.dumps(records,indent=2)+'\n')
        await shot(page,out,label+'-'+name,errors,violations)
    await measure('crowded-uploading')
    await theme.click()
    await required(page.locator('[data-studio-v4-menu="theme"]'))
    await measure('crowded-theme-menu')
    await page.keyboard.press('Escape');await expect(theme).to_be_focused()
    await options.click();await required(page.locator('[data-studio-v4-menu="research"]'))
    await measure('crowded-research-menu')
    await page.keyboard.press('Escape');await expect(options).to_be_focused()
    upload_release.set()
    await expect(page.locator('[data-studio-v4-type-role="upload-status"]')).to_contain_text("couldn't be uploaded",timeout=15000)
    await measure('crowded-error')
    await page.get_by_role('button',name='Clear all',exact=True).click()
    await expect(page.locator('[data-studio-v4-prompt] [role=status]')).to_have_count(0)
    if args.early_variant in ['action-review','action-mention']:
        await expect(page.locator('button[type=submit]')).to_be_disabled()
    else:
        await expect(page.locator('button[type=submit]')).to_be_enabled()
    await measure('crowded-cleared')
    assert not errors and not violations,(errors,violations)
    assert await page.locator('iframe').count()==0
    return records

async def capture_header_labels(page, out, label, enabled, errors, violations, palette_mode=None):
    checks = {}
    async def keyboard_hint(control, text, suffix):
        await page.mouse.move(600, 300)
        for _ in range(30):
            await page.keyboard.press('Tab')
            if await control.evaluate('e=>e===document.activeElement'):
                break
        await expect(control).to_be_focused()
        await expect(page.get_by_role('tooltip', name=text, exact=True)).to_be_attached()
        await shot(page, out, label + suffix, errors, violations, allow_non_builder=True)
        await page.keyboard.press('Escape')
        checks[suffix] = {'label': text, 'keyboardFocus': True}

    header = page.locator('header')
    if enabled:
        await expect(header).to_have_attribute('aria-label', 'Studio')
    else:
        await expect(header).not_to_have_attribute('aria-label', 'Studio')
    await shot(page, out, label + '-builder', errors, violations, allow_non_builder=True)
    home = header.get_by_role('link', name='Go to home', exact=True)
    assert await home.get_attribute('href') == 'https://deckster.xyz'
    if enabled:
        await home.hover()
        await expect(page.get_by_role('tooltip', name='Home', exact=True)).to_be_attached()
        await shot(page, out, label + '-home-hover', errors, violations, allow_non_builder=True)
        await page.keyboard.press('Escape')
        await keyboard_hint(header.get_by_role('link', name='Open Knowledge', exact=True), 'Knowledge', '-knowledge-focus')
    decks = header.get_by_role('button', name='Open deck list', exact=True)
    await decks.click()
    await expect(header.get_by_role('button', name='Close deck list', exact=True)).to_be_visible()
    await header.get_by_role('button', name='Close deck list', exact=True).click()
    checks['deckListToggle'] = True
    if enabled:
        account = header.get_by_role('button', name='Open account menu', exact=True)
        await keyboard_hint(account, 'Account menu', '-account-focus')
        await account.click()
        await expect(page.get_by_role('menu')).to_be_visible()
        await page.keyboard.press('Escape')
        await expect(account).to_be_focused()
        checks['accountEscapeFocus'] = True
    await header.get_by_role('link', name='Open Knowledge', exact=True).click()
    await page.wait_for_url('**/knowledge')
    back_text = 'Back to Studio' if enabled else 'Back to builder'
    back = page.locator('header').get_by_role('button', name=back_text, exact=True)
    await expect(back).to_be_visible()
    await expect(page.get_by_role('link', name='Back to Studio' if enabled else 'Back to Builder', exact=True)).to_have_attribute('href', '/builder')
    await shot(page, out, label + '-return', errors, violations, allow_non_builder=True)
    if enabled:
        await keyboard_hint(back, 'Back to Studio', '-return-focus')
    if palette_mode:
        if palette_mode=='on':
            m=json.loads((out/(label+'-return.json')).read_text())
            assert m['accountFrame']['background']==('rgb(34, 45, 48)' if label.startswith('dark') else 'rgb(245, 247, 246)'),m['accountFrame']
        decks_nav=page.locator('[data-studio-v4-account-nav]').filter(has_text='Decks')
        await decks_nav.hover()
        await shot(page,out,label+'-nav-hover',errors,violations,allow_non_builder=True)
        for role in ['primary','secondary']:
            control=page.locator(f'[data-studio-v4-access-role="{role}"]')
            await page.mouse.move(600,300)
            for _ in range(30):
                await page.keyboard.press('Tab')
                if await control.evaluate('e=>e===document.activeElement'):break
            await expect(control).to_be_focused()
            await shot(page,out,label+'-'+role+'-focus',errors,violations,allow_non_builder=True)
        await page.locator('[data-studio-v4-access-role="primary"]').hover()
        await shot(page,out,label+'-primary-hover',errors,violations,allow_non_builder=True)
        checks['paletteCtaFocus']=True
    remembered = await page.evaluate("localStorage.getItem('deckster:last_session_id:studio-v4-cp0-local')")
    assert remembered, 'Existing Builder must retain its last-session key'
    await back.click()
    await page.wait_for_url('**/builder?session_id=' + remembered)
    checks['rememberedReturn'] = remembered
    await expect(page.locator('[data-studio-v4-composer] textarea:visible')).to_be_visible()
    await page.locator('header').get_by_role('link', name='Open Knowledge', exact=True).click()
    await page.wait_for_url('**/knowledge')
    if enabled and '1030x600' in label:
        await page.set_viewport_size({'width': 640, 'height': 600})
        nav = page.locator('header nav')
        await expect(nav.get_by_role('link', name='Decks', exact=True)).to_be_visible()
        await expect(nav.get_by_role('link', name='Knowledge', exact=True)).to_be_visible()
        await keyboard_hint(nav.get_by_role('link', name='Decks', exact=True), 'Decks', '-narrow-decks-focus')
        await shot(page, out, label + '-narrow-return', errors, violations, allow_non_builder=True)
        checks['narrowIconNames'] = True
    await page.get_by_role('link', name='Back to Studio' if enabled else 'Back to Builder', exact=True).click()
    await page.wait_for_url('**/builder')
    checks['freshReturnPath'] = '/builder'
    assert not errors and not violations
    return checks

async def capture_profile_palette(page,out,label,errors,violations,mode,account=False):
    if account:
        await page.locator('header').get_by_role('link',name='Open Knowledge',exact=True).click()
        await page.wait_for_url('**/knowledge')
    trigger=page.locator('header button.rounded-full')
    await expect(trigger).to_have_count(1)
    snapshots={}
    async def snapshot(name):
        await shot(page,out,label+'-'+name,errors,violations,allow_non_builder=True)
        menu=page.get_by_role('menu')
        measured=await menu.evaluate('''e=>{
          const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
          const sample=n=>{const s=getComputedStyle(n);return {tag:n.tagName,role:n.getAttribute('role'),ownedRole:n.dataset.studioV4ProfileRole||null,text:n.textContent.trim(),rect:rect(n),color:s.color,background:s.backgroundColor,border:s.borderColor,fontSize:s.fontSize,lineHeight:s.lineHeight,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineOffset:s.outlineOffset,highlighted:n.hasAttribute('data-highlighted'),focusVisible:n.matches(':focus-visible'),focused:n===document.activeElement}};
          return {menu:sample(e),tier:e.querySelector('[data-studio-v4-profile-role="tier"]')?sample(e.querySelector('[data-studio-v4-profile-role="tier"]')):null,ownPalette:e.dataset.studioV4Profile||'off',portaled:!document.querySelector('header').contains(e),viewport:{width:innerWidth,height:innerHeight},children:[...e.querySelectorAll('p,span,button,a,[role=menuitem]')].filter(n=>n.getBoundingClientRect().height>0).map(sample)};
        }''')
        assert measured['portaled']
        assert measured['ownPalette']==('true' if mode=='on' else 'off')
        r=measured['menu']['rect'];assert r['width']==256 and r['left']>=0 and r['right']<=measured['viewport']['width'] and r['top']>=0 and r['bottom']<=measured['viewport']['height'],r
        snapshots[name]=measured
    await trigger.click()
    menu=page.get_by_role('menu');await expect(menu.get_by_text('Free',exact=True)).to_be_visible()
    await page.mouse.move(500,500)
    await snapshot('menu-collapsed')
    order=[]
    if mode=='on':
        await menu.get_by_role('menuitem',name='Dashboard',exact=True).hover();await snapshot('item-hover')
        await page.mouse.move(500,500);await page.keyboard.press('Home')
        await expect(menu.get_by_role('menuitem',name='Dashboard',exact=True)).to_be_focused();await snapshot('item-focus')
        order.append(await page.evaluate('document.activeElement.textContent.trim()'))
        for _ in range(5):
            await page.keyboard.press('ArrowDown');await page.wait_for_timeout(50);order.append(await page.evaluate('document.activeElement.textContent.trim()'))
    signout=menu.get_by_role('menuitem',name='Sign Out',exact=True)
    await signout.hover();await snapshot('danger-hover')
    # Radix's existing roving focus: never activate Sign Out.
    await page.mouse.move(500,500)
    await page.keyboard.press('Home')
    await page.keyboard.press('End')
    await expect(signout).to_be_focused();await snapshot('danger-focus')
    await menu.get_by_role('button',name='Usage remaining',exact=True).click()
    await expect(menu.get_by_role('link',name='Upgrade for more usage',exact=True)).to_be_visible()
    await snapshot('menu-expanded')
    if mode=='on':
        await page.keyboard.press('Tab');await snapshot('usage-tab')
    await menu.get_by_role('button',name='Usage remaining',exact=True).click()
    await expect(menu.get_by_role('link',name='Upgrade for more usage',exact=True)).to_have_count(0)
    await page.keyboard.press('Escape');await expect(trigger).to_be_focused()
    checks={'observedArrowOrder':order,'usageToggle':True,'escapeFocusReturn':True,'noSignOutOrBillingActivation':True,'header':'account' if account else 'builder'}
    if '1030x600' not in label or mode=='on':
        initial=await page.locator('html').get_attribute('class') or ''
        await trigger.click();menu=page.get_by_role('menu')
        await menu.get_by_role('menuitem',name='Light Mode' if label.startswith('dark') else 'Dark Mode',exact=True).click()
        await expect(page.locator('html')).to_have_class(re.compile('.*'+('light' if label.startswith('dark') else 'dark')+'.*'))
        await expect(trigger).to_be_focused()
        await trigger.click();menu=page.get_by_role('menu')
        if '1030x600' in label:
            await menu.get_by_text('Free',exact=True).wait_for();await snapshot('theme-opposite')
        await menu.get_by_role('menuitem',name='Dark Mode' if label.startswith('dark') else 'Light Mode',exact=True).click()
        await expect(page.locator('html')).to_have_class(re.compile('.*'+('dark' if label.startswith('dark') else 'light')+'.*'))
        checks['themeToggleAndRestore']=True
    assert not errors and not violations
    return {'snapshots':snapshots,'checks':checks}

# S1.6 fixture: truthy foreign URLs retain existing tab membership while policy
# rejects their origins. No live presentation is fabricated or loaded.
DASHBOARD_SESSIONS = [
    {'id':f'local-deck-{i}', 'title':title, 'createdAt':NOW, 'updatedAt':NOW,
     'lastMessageAt':NOW, 'currentStage':stage, 'slideCount':count,
     'status':'active', 'isFavorite':False,
     'finalPresentationUrl':f'https://example.invalid/final/{i}' if stage==6 else None,
     'strawmanPreviewUrl':f'https://example.invalid/strawman/{i}' if stage!=6 else None,
     'messages':[{'userText':description}]}
    for i,(title,stage,count,description) in enumerate([
      ('Quarterly planning and investment priorities',6,12,'A local fixture covering priorities, progress and decisions for the coming quarter.'),
      ('Customer research and product opportunities',6,18,'Evidence, audience needs and next steps for a focused product discussion.'),
      ('LongMetadataWithoutSpacesForReadableCardWrapping',6,240,'A deliberately long title and slide count to inspect existing card metadata.'),
      ('Market outlook and growth scenarios',4,8,'An existing preview-ready stage with an intentionally blocked preview URL.'),
      ('Operating review and refinement priorities',5,15,'An existing refining stage; this is metadata and fallback evidence only.')],1)
]

async def capture_dashboard(page,out,label,errors,violations,mode):
    search=await required(page.get_by_placeholder('Search presentations...'))
    tabs=page.get_by_role('tab');cards=page.locator('[role=tabpanel][data-state=active] > div.grid > div')
    await expect(tabs.first).to_contain_text('(3)')
    await expect(tabs.last).to_contain_text('(2)')
    snapshots={}
    async def snap(phase):
        await page.wait_for_timeout(200)
        assert not errors and not violations
        assert await page.locator('iframe').count()==0
        measured=await page.evaluate("""() => {
          const main=document.querySelector('main'),panel=main.querySelector('[role=tabpanel][data-state=active]');
          const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
          const item=e=>{const s=getComputedStyle(e);return {role:e.dataset.studioV4DashboardRole,tag:e.tagName,text:(e.textContent||e.placeholder||'').trim(),value:e.value??null,href:e.getAttribute('href'),selected:e.getAttribute('data-active')||e.getAttribute('data-state'),color:s.color,background:s.backgroundColor,border:s.borderColor,fontSize:s.fontSize,lineHeight:s.lineHeight,weight:s.fontWeight,outline:s.outlineColor,outlineWidth:s.outlineWidth,focusVisible:e.matches(':focus-visible'),rect:rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}};
          return {pageWidth:document.documentElement.scrollWidth,viewport:{width:innerWidth,height:innerHeight},palette:main.getAttribute('data-studio-v4-dashboard'),mainText:main.innerText,controls:[...main.querySelectorAll('button,input,a')].filter(e=>e.getBoundingClientRect().height>0).map(item),roles:[...main.querySelectorAll('[data-studio-v4-dashboard-role]')].filter(e=>e.getBoundingClientRect().height>0).map(item),cards:[...panel.querySelector('.grid').children].map(e=>({text:e.innerText,rect:rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,preview:rect(e.firstElementChild)})),warnings:[...panel.querySelectorAll('span')].filter(e=>e.textContent.includes('Preview unavailable')).length,focusedText:document.activeElement.textContent?.trim(),gridColumns:getComputedStyle(panel.querySelector('.grid')).gridTemplateColumns};
        }""")
        snapshots[phase]=measured
        await page.screenshot(path=str(out/(label+'-'+phase+'.png')),full_page=True,animations='disabled')
        if mode=='on':
            assert measured['pageWidth']<=measured['viewport']['width'],(label,phase,'page overflow')
            assert all(c['scrollWidth']<=c['clientWidth']+1 for c in measured['cards']),(label,phase,'card overflow')
        return measured
    await expect(cards).to_have_count(3);await snap('completed')
    await cards.first.hover();await snap('card-hover')
    await search.fill('Quarterly');await expect(cards).to_have_count(1);await snap('search-match')
    await search.fill('local-no-match');await expect(cards).to_have_count(0)
    await expect(page.get_by_text('No completed presentations found',exact=True)).to_be_visible();await snap('completed-empty')
    await tabs.last.click();await expect(page.get_by_text('No strawman previews found',exact=True)).to_be_visible();await snap('strawman-empty')
    await search.fill('');await expect(cards).to_have_count(2);await snap('strawman')
    await page.get_by_role('button',name=re.compile('^General')).click()
    filters=page.get_by_role('button',name=re.compile('^Filters'))
    await filters.click();await page.get_by_role('button',name='in-progress',exact=True).click()
    await expect(cards).to_have_count(2);await snap('filters-selected')
    await page.get_by_role('button',name='completed',exact=True).click()
    await page.get_by_role('button',name='in-progress',exact=True).click()
    await expect(cards).to_have_count(0)
    await page.get_by_role('button',name='Clear all',exact=True).click();await expect(cards).to_have_count(2)
    await filters.click();await tabs.first.click();await expect(cards).to_have_count(3)
    await search.click();await page.keyboard.press('Tab');await expect(filters).to_be_focused();await snap('filters-focus')
    assert not errors and not violations
    return {'snapshots':snapshots,'checks':{'searchTabsStatusFolderClear':True,'filterKeyboardFocus':True,'noIframe':True,'noCardOrMutationActivation':True,'tagsEmptyFromExistingTransform':True}}

async def capture_shell(page,out,label,errors,violations,mode,sockets,intercepted):
    textarea=await required(page.locator('[data-studio-v4-composer] textarea:visible'))
    await expect(textarea).to_be_enabled()
    snapshots={};checks={}
    async def snap(name):
        await page.wait_for_timeout(400)
        assert not errors and not violations
        assert await page.locator('iframe').count()==0
        m=await page.evaluate("""()=>{
          const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
          const root=document.querySelector('[data-studio-v4-shell]')||document.querySelector('[data-studio-v4-tokens]');
          const t=document.querySelector('[data-studio-v4-composer] textarea'),w=document.querySelector('[data-studio-v4-shell-workspace]');
          return {viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,shell:root.dataset.studioV4Shell??'off',rail:rect(document.querySelector('[data-studio-v4-rail]')),header:rect(document.querySelector('header')),workspace:rect(w),presentation:rect(document.querySelector('[data-studio-v4-shell-presentation]')),drawer:rect(document.querySelector('[data-builder-panel=deck]')),draft:t?.value??null,toolbarTarget:rect(document.querySelector('[data-studio-v4-toolbar-target]')),sessionList:rect(document.querySelector('[data-studio-v4-session-list]')),toolbarSame:window.shellTarget?window.shellTarget===document.querySelector('[data-studio-v4-toolbar-target]'):null,railControls:[...document.querySelectorAll('[data-studio-v4-rail] a,[data-studio-v4-rail] button')].map(e=>({label:e.getAttribute('aria-label'),href:e.getAttribute('href'),unavailable:e.getAttribute('aria-disabled'),current:e.getAttribute('aria-current'),rect:rect(e)})),heading:document.querySelector('[data-studio-v4-shell-chat-heading]')?.textContent};
        }""")
        snapshots[name]=m;await page.screenshot(path=str(out/(label+'-'+name+'.png')),animations='disabled');return m
    await page.wait_for_timeout(700)
    first=await snap('initial')
    if mode in ['on','first']:
        closed=first.get('sessionList')
        assert closed is None or closed['right']<=0.1, 'Closed Sessions drawer overlaps rail'
    if mode=='first':return {'snapshots':snapshots,'checks':{'firstVisibleFrameOnly':True}}
    if mode=='off':
        assert first['shell']=='off' and first['rail'] is None and first['header']['height']==56
        return {'snapshots':snapshots,'checks':{'legacyFrameRestored':True}}
    assert first['rail']['width']==56 and first['header']['height']==48
    assert first['pageWidth']<=first['viewport']['width']
    assert first['workspace']['right']<=first['viewport']['width'] and first['workspace']['bottom']<=first['viewport']['height']
    await page.evaluate("window.shellTarget=document.querySelector('[data-studio-v4-toolbar-target]')")
    unavailable=page.get_by_role('button',name='Templates',exact=True)
    await unavailable.hover();await expect(page.get_by_role('tooltip',name=re.compile('^Templates workspace'))).to_contain_text('unavailable in this local build')
    await page.mouse.move(600,20)
    await textarea.click()
    focus_path=[]
    for _ in range(40):
        await page.keyboard.press('Shift+Tab');await page.wait_for_timeout(50)
        focus_path.append(await page.evaluate('document.activeElement.getAttribute("aria-label")||document.activeElement.textContent?.trim().slice(0,60)'))
        if await unavailable.evaluate('e=>e===document.activeElement'):break
    checks['backwardFocusPathToUnavailable']=focus_path
    await expect(unavailable).to_be_focused()
    await page.wait_for_timeout(150)
    await page.keyboard.press('Tab');await expect(page.get_by_role('button',name='Themes & brand',exact=True)).to_be_focused()
    await expect(page.get_by_role('tooltip',name=re.compile('^Themes & brand workspace'))).to_contain_text('unavailable in this local build')
    await snap('unavailable-focus')
    checks['unavailableHoverKeyboardLabels']=True
    product_before=sum(socket_kind(s)=='product' for s in sockets);url_before=page.url
    draft='Retained real draft through the Studio frame checks.';await textarea.fill(draft)
    separator=await required(page.get_by_role('separator',name='Resize builder panel'))
    b=await separator.bounding_box();await page.mouse.move(b['x']+4,b['y']+b['height']/2);await page.mouse.down();await page.mouse.move(b['x']+64,b['y']+b['height']/2,steps=6);await page.mouse.up()
    resized=await snap('resized');assert resized['draft']==draft and resized['toolbarSame']
    await page.get_by_title('Close chat panel',exact=True).click();closed=await snap('chat-closed');assert closed['toolbarSame']
    await page.get_by_title('Open chat panel',exact=True).click();await expect(textarea).to_have_value(draft)
    await page.get_by_role('button',name='Open deck list',exact=True).click()
    await snap('sessions-open')
    await page.get_by_role('button',name='Close deck list',exact=True).click()
    await expect(textarea).to_have_value(draft)
    restored=await snap('restored');assert restored['toolbarSame'] and page.url==url_before
    assert sum(socket_kind(s)=='product' for s in sockets)==product_before
    checks['productSocketCountBeforeAndAfterFrameInteractions']=[product_before,sum(socket_kind(s)=='product' for s in sockets)]
    checks.update({'draftRetainedResizeChatSessions':True,'toolbarTargetStable':True,'noExtraProductSocketOnFrameInteractions':True,'sessionUrlStableDuringFrameInteractions':True,'drawerPreferenceKeyRetained':True})
    # Navigate via real rail, then use the existing remembered-session return handler.
    await page.get_by_role('link',name='Knowledge',exact=True).click();await page.wait_for_url('**/knowledge')
    await required(page.locator('[data-studio-v4-account-frame][data-studio-v4-shell=true]'))
    await snap('account')
    await page.get_by_role('button',name='Studio',exact=True).click();await page.wait_for_url('**/builder?session_id=*')
    await required(page.locator('[data-studio-v4-composer] textarea:visible'))
    checks['accountRailRememberedReturn']=True
    new_button=await required(page.get_by_role('button',name='Presentation',exact=True))
    await page.locator('[data-studio-v4-composer] textarea:visible').fill('Draft cleared by existing new presentation handler')
    await new_button.click();await expect(page.locator('[data-studio-v4-composer] textarea:visible')).to_have_value('')
    await snap('new-presentation');checks['existingNewPresentationClearsDraft']=True
    assert not errors and not violations
    return {'snapshots':snapshots,'checks':checks}

async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--shell',choices=['first','off','on'],help='S2.1 visible frame and targeted lifecycle proof')
    parser.add_argument('--dashboard', choices=['baseline','off','on'], help='S1.6 bounded Dashboard presentation proof')
    parser.add_argument('--profile-palette', choices=['baseline','off','on'], help='S1.5 existing profile palette proof only')
    parser.add_argument('--account-palette', choices=['off','on'], help='S1.4 owned account colors in existing navigation proof')
    parser.add_argument('--header-labels', choices=['off','on'], help='Small S1.3 header/navigation proof only')
    parser.add_argument('--tokens', choices=['off','on'], required=True)
    parser.add_argument('--type', choices=['off','on'], default='off')
    parser.add_argument('--early-variant', choices=['ready','action-review','action-mention','sparse'], default='ready')
    parser.add_argument('--trial-actions', action='store_true', help='Representative extra native Upload/Send reachability proof')
    parser.add_argument('--containment-trial', choices=['none','baseline','candidate'], default='none', help='Capture-only scroll/in-flow mention trial; never app source')
    parser.add_argument('--early-readability', action='store_true', help='Crowded 600px real-page composition before full proof')
    parser.add_argument('--stop-only', action='store_true', help='Focused template Stop proof with seeded disposable session options')
    parser.add_argument('--output-directory', type=Path, help='Explicit local capture destination; omit to retain historical defaults')
    args=parser.parse_args()
    if args.containment_trial!='none':
        assert args.type=='on', 'Containment trial needs the approved type candidate'
        if not args.stop_only:args.early_readability=True
    out=ROOT.parent/'studio-v4-cp12-captures-20261001'/('stop-'+args.tokens+'-'+args.type if args.stop_only else 'tokens-'+args.tokens+'-type-'+args.type)
    if args.early_readability:
        out=ROOT.parent/'studio-v4-cp12-captures-20261001'/('early-'+args.early_variant+'-'+args.tokens+'-'+args.type)
    if args.containment_trial!='none':
        out=ROOT.parent/'studio-v4-cp12-captures-20261001'/('containment-'+('stop' if args.stop_only else args.early_variant)+'-'+args.containment_trial)
    if args.trial_actions:out=out.with_name(out.name+'-actions')
    if args.header_labels:
        out=ROOT.parent/'studio-v4-cp13-captures-20261001'/args.header_labels
    if args.account_palette:
        assert args.header_labels=='on' and args.type=='off' and args.tokens==args.account_palette
        out=ROOT.parent/'studio-v4-cp14-captures-20261001'/args.account_palette
    if args.profile_palette:
        assert args.type=='off' and args.tokens==('off' if args.profile_palette=='off' else 'on')
        out=ROOT.parent/'studio-v4-cp15-captures-20261001'/(args.profile_palette+('-labels-off' if args.header_labels=='off' else ''))
    if args.dashboard:
        assert args.type=='off' and args.tokens==('off' if args.dashboard=='off' else 'on')
        out=ROOT.parent/'studio-v4-cp16-captures-20261001'/args.dashboard
    if args.shell:
        assert args.type=='off'
        out=ROOT.parent/'studio-v4-cp21-captures-20261001'/args.shell
    if args.output_directory is not None:
        out=args.output_directory.resolve()
        assert out.is_relative_to(ROOT.parent.resolve()), 'Keep proof outputs inside the local Studio worktree area'
    out.mkdir(parents=True,exist_ok=True)
    config=json.loads((ROOT/'.env.studio-v4-runtime/preview-config.json').read_text())
    assert config == {'port':'8792','shell':'true' if args.shell in ['on','first'] else 'false','tokens':'true' if args.tokens=='on' else 'false','type':'true' if args.type=='on' else 'false','labels':'true' if args.header_labels=='on' else 'false','mentions':'true'}, config
    identity={'base_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in ['app/builder/page.tsx','app/builder/studio-v4.css','app/builder/studio-v4-type.css','components/builder/chat-input.tsx','components/builder/chat/mention-popover.tsx','scripts/studio-v4/preview.mjs','scripts/studio-v4/capture.py','components/builder/builder-header.tsx','components/layout/app-header.tsx','components/layout/studio-navigation-hint.tsx','components/user-profile-menu.tsx','app/(app)/knowledge/page.tsx','app/(app)/layout.tsx','app/(app)/studio-v4-account.css','components/user-profile-studio-v4.css']}}
    if args.shell:
        for path in ['components/layout/studio-rail.tsx','components/layout/studio-shell.css','components/builder/studio-director.css']:
            identity['files'][path]=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
    if args.dashboard:
        for path in ['app/(app)/dashboard/page.tsx','app/(app)/dashboard/studio-v4-dashboard.css']:
            if (ROOT/path).exists():identity['files'][path]=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
    results=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        try:
            viewports = [('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True)] if args.stop_only else [('light-1280x720',1280,720,False),('light-1030x720',1030,720,False),('dark-1280x720',1280,720,True),('light-1440x900',1440,900,False)]
            if args.early_readability:
                viewports=[('light-1280x600',1280,600,False),('light-1030x600',1030,600,False)]
            if args.containment_trial!='none' and args.stop_only:
                viewports=[('light-1030x600',1030,600,False),('dark-1280x720',1280,720,True)]
            if args.containment_trial!='none' and not args.stop_only:
                viewports=[('light-1030x600',1030,600,False),('dark-1030x600',1030,600,True),('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True)]
            if args.containment_trial!='none' and args.early_variant=='action-mention':
                viewports=[('light-1030x600',1030,600,False),('dark-1280x720',1280,720,True)]
            if args.trial_actions:
                viewports=[('light-1030x600',1030,600,False),('dark-1280x720',1280,720,True)]
            if args.header_labels and not args.stop_only:
                viewports=[('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True),('light-1030x600',1030,600,False)] if args.header_labels=='on' else [('light-1280x720',1280,720,False)]
            if args.account_palette=='off':viewports=[('light-1280x720',1280,720,False)]
            if args.profile_palette:
                viewports=[('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True),('light-1030x600',1030,600,False)]
                if args.profile_palette=='off':viewports=viewports[:1]
                if args.header_labels=='off':viewports=viewports[-1:]
            if args.dashboard:
                viewports=[('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True),('light-640x600',640,600,False)]
                if args.dashboard=='off':viewports=viewports[:1]
            if args.shell:
                viewports=[('light-1280x720',1280,720,False),('dark-1280x720',1280,720,True),('light-1030x600',1030,600,False)]
                if args.shell in ['first','off']:viewports=viewports[:1]
            for label,width,height,dark in viewports:
                context=await browser.new_context(viewport={'width':width,'height':height},color_scheme='dark' if dark else 'light',service_workers='block')
                await context.add_cookies([json.loads((ROOT/'.env.studio-v4-runtime/s0-cookie.json').read_text())])
                await context.add_init_script(f"localStorage.setItem('theme', {json.dumps('dark' if dark else 'light')});")
                fixture_session='11111111-1111-4111-8111-111111111111'
                if args.stop_only or args.early_readability:
                    stored={'version':2,'ownerUserId':USER['id'],'activeTemplate':{'id':'local-stop-template','name':'Stop contrast fixture','blueprint_generation_method':'llm','blueprint_enrichment_status':'complete','template_purity_status':'clean'},'buildThemeSelection':{'mode':'auto'},'activeBuildThemeProfile':None}
                    if args.early_readability:
                        if args.early_variant in ['action-review','action-mention']:
                            stored['activeTemplate']['template_purity_status']='failed'
                        stored['activeTemplate']['name']='Long selected template '+('template-context-'*10)
                        stored['buildThemeSelection']={'mode':'preset','preset_id':'minimal'}
                        stored['activeBuildThemeProfile']={**SAVED,'name':'Long selected theme '+('theme-context-'*10)}
                    if args.containment_trial!='none' and args.early_variant=='sparse':
                        stored['activeTemplate']=None
                        stored['buildThemeSelection']={'mode':'auto'}
                        stored['activeBuildThemeProfile']=None
                    key=f"deckster_builder_options_v2_{USER['id']}_{fixture_session}"
                    await context.add_init_script(f"sessionStorage.setItem({json.dumps(key)}, {json.dumps(json.dumps(stored))});")
                intercepted=[]; external=[]; errors=[]; sockets=[]; frames=[]; violations=[]; controls={}; colors={}
                upload_release=asyncio.Event()
                theme_hold=False; theme_requested=asyncio.Event(); theme_release=asyncio.Event(); product_socket=[]
                async def route_handler(route):
                    req=route.request; parsed=urlparse(req.url); path=parsed.path
                    if args.early_readability and req.url in ['https://researcher-v11-uat.up.railway.app/api/v1/sessions/create','https://researcher-v11-uat.up.railway.app/api/v1/files/storage-upload-url']:
                        external.append({'url':req.url,'disposition':'local-upload-fixture','method':req.method,'body':req.post_data_json if req.post_data else None})
                        if req.method=='OPTIONS':
                            await route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'});return
                        if parsed.path.endswith('/create'):
                            await route.fulfill(json={'session_id':fixture_session},headers={'Access-Control-Allow-Origin':'*'});return
                        await asyncio.wait_for(upload_release.wait(),timeout=120)
                        await route.fulfill(status=503,json={'error':'Local intercepted upload unavailable'},headers={'Access-Control-Allow-Origin':'*'});return
                    if parsed.netloc != '127.0.0.1:8792':
                        external.append({'url':req.url,'disposition':'local-fixture' if req.url==PRESETS_URL else 'aborted'})
                        if req.url==PRESETS_URL:
                            await route.fulfill(json=[],headers={'Access-Control-Allow-Origin':'*'});return
                        # Optional telemetry is blocked. Every other service escape fails.
                        if parsed.hostname not in ['va.vercel-scripts.com','vitals.vercel-insights.com']:
                            violations.append(req.url)
                        await route.abort();return
                    if path.startswith('/api/'):
                        intercepted.append({'method':req.method,'path':path,'body':req.post_data_json if req.post_data else None})
                        data={}
                        if path=='/api/auth/session':data={'user':USER,'expires':'2099-01-01T00:00:00Z'}
                        elif path=='/api/director/ws-token':data={'auth_enabled':False,'auth_token':None}
                        elif path=='/api/subscription':data={'subscription':None}
                        elif path=='/api/usage/quota':data={'tier':'free','tierLabel':'Free','caps':{'monthlyCents':100,'weeklyCents':50,'dailyCents':20},'spent':{'dailyCents':0,'weeklyCents':0,'monthlyCents':0},'remainingPct':{'daily':100,'weekly':100,'monthly':100},'flags':{'dailyNear':False,'dailyAt':False,'weeklyNear':False,'weeklyAt':False},'walletBalanceCents':0,'resetAt':{'daily':NOW,'weekly':NOW},'totals':{'monthTokens':0,'monthSpendCents':0,'lifetimeTokens':0,'lifetimeSpendCents':0}}
                        elif path=='/api/sessions':
                            if req.method=='GET':data={'sessions':DASHBOARD_SESSIONS if args.dashboard else [],'pagination':{'total':len(DASHBOARD_SESSIONS) if args.dashboard else 0,'limit':100 if args.dashboard else 20,'offset':0,'hasMore':False}}
                            else:
                                body=req.post_data_json or {};sid=body.get('sessionId','cp11-fixture-session')
                                data={'session':{'id':sid,'userId':USER['id'],'title':'CP1.1 Local Fixture','createdAt':NOW,'updatedAt':NOW,'lastMessageAt':NOW,'currentStage':0,'slideCount':0,'status':'active','isFavorite':False,'messages':[]}}
                        elif path.startswith('/api/sessions/') and path.endswith('/files'):data={'files':[]}
                        elif path.startswith('/api/sessions/') and path.endswith('/messages'):data={'messages':[]}
                        elif path.startswith('/api/sessions/') and req.method=='GET':
                            if (args.stop_only or args.early_readability) and path==f'/api/sessions/{fixture_session}':
                                data={'session':{'id':fixture_session,'userId':USER['id'],'title':'Stop contrast fixture','createdAt':NOW,'updatedAt':NOW,'currentStage':0,'slideCount':0,'status':'active','messages':([{'id':'local-pending-action','messageType':'action_request','timestamp':NOW,'userText':None,'payload':{'prompt_text':'Local pending action fixture','actions':[{'label':'Provide audience and source details','value':'local-provide-details','primary':True,'requires_input':True}]}}] if args.early_readability and args.early_variant=='action-review' else [])}}
                            elif args.header_labels:
                                data={'session':{'id':path.rsplit('/',1)[-1],'userId':USER['id'],'title':'Local navigation fixture','createdAt':NOW,'updatedAt':NOW,'currentStage':0,'slideCount':0,'status':'active','messages':[]}}
                            else:
                                await route.fulfill(status=404,json={'error':'Local fixture not yet created'});return
                        elif path.startswith('/api/sessions/') and req.method in ['PATCH','PUT']:data={'success':True}
                        elif path=='/api/themes/standard':data={'theme':None}
                        elif path=='/api/themes':
                            if theme_hold:
                                theme_requested.set()
                                await asyncio.wait_for(theme_release.wait(),timeout=15)
                            data={'themes':[{**SAVED,'name':'Long selected theme '+('theme-context-'*10)} if args.early_readability else SAVED],'count':1}
                        elif path=='/api/templates':data={'templates':[]}
                        else:violations.append(f'{req.method} {path}')
                        if args.containment_trial!='none' and not args.stop_only and path==f'/api/sessions/{fixture_session}' and req.method=='GET':
                            data['session']['messages']=[{'id':'local-history','messageType':'chat_message','timestamp':NOW,'userText':None,'payload':{'text':'Existing conversation: source details, constraints and decisions remain available here.'}}, {'id':'local-pending-action','messageType':'action_request','timestamp':NOW,'userText':None,'payload':{'prompt_text':'Local pending action fixture','actions':[{'label':'Provide audience and source details','value':'local-provide-details','primary':True,'requires_input':True}]}}]
                            if args.early_variant in ['sparse','action-mention']:
                                data['session']['stateCache']={'slideStructure':{'metadata':{'main_title':'Local metadata only','overall_theme':'Minimal','target_audience':'Review','presentation_duration':5},'slides':[{**SLIDES[i%2],'slide_id':f'local-slide-{i+1}','slide_number':i+1,'title':('Overview' if i==0 else 'Evidence')+' long title '+('context '*12)} for i in range(12)]}}
                        await route.fulfill(json=data);return
                    await route.continue_()
                await context.route('**/*',route_handler)
                async def ws_handler(ws):
                    sockets.append(ws.url)
                    if socket_kind(ws.url) == 'development':
                        ws.connect_to_server();return
                    if socket_kind(ws.url) != 'product':
                        violations.append(ws.url);await ws.close();return
                    product_socket.append(ws)
                    def received(message):
                        frames.append(message)
                        if message=='ping':ws.send('pong')
                        elif isinstance(message,str) and message.startswith('{') and json.loads(message).get('type')=='user_message' and not args.stop_only:
                            ws.send(json.dumps({'type':'chat_message','message_id':f'local-ack-{len(frames)}','timestamp':NOW,'payload':{'text':'Local fixture acknowledged. No service was contacted.'}}))
                    ws.on_message(received)
                    asyncio.get_running_loop().call_later(0.5, lambda: ws.send(json.dumps({'type':'chat_message','message_id':'local-welcome','timestamp':NOW,'payload':{'text':'Tell me about the presentation you want to create.'}})))
                await context.route_web_socket('**/*',ws_handler)
                page=await context.new_page()
                page.on('pageerror',lambda e:errors.append(str(e)))
                start=time.monotonic()
                try:
                    if args.dashboard:
                        response=await page.goto(BASE+'/dashboard',wait_until='domcontentloaded',timeout=120000)
                        assert response and response.status==200
                        await page.add_style_tag(content='nextjs-portal { display: none !important; }')
                        dashboard=await capture_dashboard(page,out,label,errors,violations,args.dashboard)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'external_requests':external,'websockets':sockets,'dashboard':dashboard})
                        continue
                    response=await page.goto(BASE+'/builder?session_id='+ (fixture_session if args.stop_only or args.early_readability else 'new'),wait_until='domcontentloaded',timeout=120000)
                    assert response and response.status==200, f'Builder load failed: {response}'
                    textarea=await required(page.locator('[data-studio-v4-composer] textarea:visible'))
                    await expect(textarea).to_be_enabled(timeout=20000)
                    await page.add_style_tag(content='nextjs-portal { display: none !important; }')
                    if args.shell and not args.stop_only:
                        shell=await capture_shell(page,out,label,errors,violations,args.shell,sockets,intercepted)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'websockets':sockets,'shell':shell})
                        continue
                    if args.profile_palette:
                        profile=await capture_profile_palette(page,out,label,errors,violations,args.profile_palette,account='1030x600' in label)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'websockets':sockets,'outbound_fixture_frames':frames,'profile':profile})
                        continue
                    if args.header_labels and not args.stop_only:
                        checks=await capture_header_labels(page,out,label,args.header_labels=='on',errors,violations,args.account_palette)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'websockets':sockets,'outbound_fixture_frames':frames,'header_labels':checks})
                        continue
                    disconnected_review=args.early_readability and (args.early_variant in ['action-review','action-mention'] or args.containment_trial!='none')
                    if (args.stop_only or args.early_readability) and not disconnected_review and (await textarea.get_attribute('placeholder'))=='Disconnected - send to reconnect':
                        await textarea.fill('Local Stop contrast proof')
                        await textarea.press('Enter')  # Existing resumed-session reconnect guard retains the draft.
                    if disconnected_review:
                        await expect(textarea).to_have_attribute('placeholder','Disconnected - send to reconnect',timeout=20000)
                        assert len(product_socket)==0,sockets
                    else:
                        await expect(textarea).to_have_attribute('placeholder','Message Director...',timeout=20000)
                        await page.get_by_text('Tell me about the presentation you want to create.',exact=True).wait_for(timeout=10000)
                        assert (1 <= len(product_socket) <= 3) if args.stop_only or args.early_readability else len(product_socket)==3, sockets
                    assert await page.locator('[data-studio-v4-tokens="true"]').count()==(1 if args.tokens=='on' else 0)
                    assert await page.locator('[data-studio-v4-composer][data-studio-v4-type="true"]').count()==(1 if args.type=='on' else 0)
                    # Capture-only exclusion of Next's development badge (not application UI).
                    upload=await required(page.get_by_role('button',name='Upload a file',exact=True))
                    theme=await required(page.get_by_role('button',name='Build theme',exact=True))
                    options=await required(page.locator('button[aria-haspopup=menu]:has(svg.lucide-sliders-horizontal)'))
                    if args.containment_trial=='candidate':
                        await page.add_style_tag(content=CONTAINMENT_TRIAL_CSS)
                    if args.containment_trial!='none' and not args.stop_only:
                        composition=await containment_trial(page,out,label,textarea,upload,theme,options,upload_release,errors,violations,args,frames)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'external_requests':external,'websockets':sockets,'outbound_fixture_frames':frames,'composition':composition,'trial':args.containment_trial,'injected_rules':CONTAINMENT_TRIAL_CSS if args.containment_trial=='candidate' else None})
                        continue
                    if args.early_readability:
                        composition=await early_readability(page,out,label,textarea,upload,theme,options,upload_release,errors,violations,args,product_socket[-1] if product_socket else None,fixture_session)
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'external_requests':external,'websockets':sockets,'outbound_fixture_frames':frames,'composition':composition})
                        continue
                    if args.stop_only:
                        if args.shell in ['on','first']:
                            workspace=await required(page.locator('[data-studio-v4-shell-workspace=true]'))
                            assert await workspace.evaluate("e=>!!e.closest('[data-studio-v4-shell=true]')")
                        await expect(page.get_by_text('Template selected: Stop contrast fixture',exact=True)).to_be_visible()
                        await textarea.fill('Local Stop contrast proof')
                        await textarea.press('Enter')
                        stop=await required(page.get_by_role('button',name='Stop template reuse',exact=True))
                        await expect(textarea).to_be_disabled()
                        await page.mouse.move(800,100)
                        await page.wait_for_timeout(250)  # Existing Send→Stop color transition must settle.
                        states={}
                        async def capture_stop(state):
                            measured=await stop.evaluate("e=>({background:getComputedStyle(e).backgroundColor,foreground:getComputedStyle(e).color,icon:getComputedStyle(e.querySelector('svg')).color,outline:getComputedStyle(e).outlineColor,outlineStyle:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth,adjacent:getComputedStyle(e.closest('[data-studio-v4-composer-toolbar]')).backgroundColor,focusVisible:e.matches(':focus-visible'),hover:e.matches(':hover')})")
                            measured['icon_contrast']=contrast(measured['icon'],measured['background'])
                            assert measured['icon_contrast']>=4.5,measured
                            if args.tokens=='on':
                                assert measured['background']==('rgb(239, 154, 143)' if dark else 'rgb(176, 63, 53)'),measured
                                assert measured['foreground']==('rgb(27, 36, 38)' if dark else 'rgb(255, 255, 255)'),measured
                            if state=='focus':
                                assert measured['focusVisible'] and not measured['hover'],measured
                                measured['focus_contrast']=contrast(measured['outline'],measured['adjacent'])
                                if args.tokens=='on':
                                    assert measured['outlineStyle']=='solid' and measured['outlineWidth']=='2px' and measured['focus_contrast']>=3,measured
                            await shot(page,out,label+'-stop-'+state,errors,violations)
                            states[state]=measured
                        await capture_stop('normal')
                        await stop.hover();await page.wait_for_timeout(250)
                        await capture_stop('hover')
                        await page.mouse.move(800,100)
                        await upload.focus()
                        for _ in range(8):
                            await page.keyboard.press('Tab')
                            if await stop.evaluate('e=>e===document.activeElement'):break
                        await expect(stop).to_be_focused()
                        await page.wait_for_timeout(250)
                        await capture_stop('focus')
                        await stop.press('Enter')
                        await expect(stop).to_have_count(0)
                        assert len([f for f in frames if f.startswith('{') and json.loads(f).get('type')=='cancel_template_reuse'])==1,frames
                        assert len([f for f in frames if f.startswith('{') and json.loads(f).get('type')=='user_message'])==1,frames
                        assert await page.locator('iframe').count()==0
                        results.append({'state':label,'status':response.status,'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'websockets':sockets,'outbound_fixture_frames':frames,'controls':{'keyboard':{'stop_focus':True,'cancel_once':True}},'stop_states':states})
                        continue
                    send=await required(page.locator('button[type=submit]'))
                    await expect(send).to_be_disabled()
                    await shot(page,out,label+'-baseline',errors,violations)
                    controls['baseline']=await page.evaluate('''() => ({buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent.trim(),label:e.getAttribute('aria-label'),title:e.getAttribute('title'),disabled:e.disabled})),textarea:{placeholder:document.querySelector('[data-studio-v4-composer] textarea').placeholder,rect:document.querySelector('[data-studio-v4-composer] textarea').getBoundingClientRect().toJSON()},scrollWidth:document.body.scrollWidth,iframes:[...document.querySelectorAll('iframe')].map(e=>e.src)})''')
                    assert controls['baseline']['scrollWidth']==width
                    assert controls['baseline']['iframes']==[]
                    if width==1280:
                        deck_list=await required(page.get_by_role('button',name='Open deck list',exact=True))
                        await deck_list.click()
                        await shot(page,out,label+'-deck-list',errors,violations)
                        await (await required(page.get_by_role('button',name='Close deck list',exact=True))).click()
                        # Real keyboard traversal: textarea -> Upload; draft survives menus.
                        await textarea.fill('CP1.1 neutral fixture message')
                        await textarea.focus();await textarea.press('Tab')
                        await expect(upload).to_be_focused()
                        await expect(send).to_be_enabled()
                        await shot(page,out,label+'-keyboard-focus-send',errors,violations)
                        colors['enabled']=await send.evaluate("e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color,prompt:getComputedStyle(e.closest('[data-studio-v4-prompt]')).backgroundColor,focus:getComputedStyle(e.closest('[data-studio-v4-prompt]')).borderColor})")
                        async with page.expect_file_chooser() as chooser:
                            await upload.press('Enter')
                        assert (await chooser.value).is_multiple()
                        await theme.click()
                        menu=await required(page.locator('[data-studio-v4-menu="theme"]'))
                        controls['theme_options']=await menu.locator('select').first.locator('option').evaluate_all('(es)=>es.map(e=>({value:e.value,text:e.textContent}))')
                        assert [o['value'] for o in controls['theme_options']]==['auto','corporate_light','corporate_dark','minimal','vibrant','executive','pastel']
                        await expect(menu.get_by_role('button',name='Save current theme',exact=True)).to_be_disabled()
                        await shot(page,out,label+'-theme-menu',errors,violations)
                        await page.keyboard.press('Escape');await expect(theme).to_be_focused()
                        await expect(textarea).to_have_value('CP1.1 neutral fixture message')
                        await theme.click();await expect(menu).to_be_visible()
                        await menu.locator('select').first.select_option('minimal')
                        await menu.get_by_role('textbox',name='Theme name',exact=True).fill('Draft retained')
                        await expect(menu.get_by_role('button',name='Save current theme',exact=True)).to_be_enabled()
                        await menu.locator('select').nth(1).select_option('local-theme')
                        await expect(menu.get_by_role('button',name='Set as standard',exact=True)).to_be_visible()
                        await expect(menu.get_by_role('button',name='Delete saved theme',exact=True)).to_be_visible()
                        controls['selected_theme_menu']=await menu.evaluate('e=>({controls:[...e.querySelectorAll("button,input,select")].map(n=>({tag:n.tagName,type:n.type,label:n.getAttribute("aria-label"),value:n.value,disabled:n.disabled,options:n.options?[...n.options].map(o=>({value:o.value,text:o.text})):null}))})')
                        colors['theme']=await menu.evaluate('''e=>({surface:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color,field:getComputedStyle(e.querySelector('select')).color})''')
                        await shot(page,out,label+'-theme-selected-menu',errors,violations)
                        await page.keyboard.press('Escape');await theme.click()
                        await expect(menu.get_by_role('textbox',name='Theme name',exact=True)).to_have_value('Draft retained')
                        await page.keyboard.press('Escape')
                        await expect(page.get_by_text('Theme selected: Local minimal',exact=True)).to_be_visible()
                        await shot(page,out,label+'-theme-selected-chip',errors,violations)
                        # Hold the existing saved-theme GET to prove genuine loading state.
                        theme_hold=True;theme_requested.clear();theme_release.clear()
                        await theme.click();await asyncio.wait_for(theme_requested.wait(),5)
                        await expect(menu.locator('svg.animate-spin')).to_be_visible()
                        await expect(menu.get_by_role('button',name='Save current theme',exact=True)).to_be_disabled()
                        await shot(page,out,label+'-theme-loading',errors,violations)
                        theme_hold=False;theme_release.set()
                        await expect(menu.locator('svg.animate-spin')).to_have_count(0)
                        await page.keyboard.press('Escape')
                        await options.click()
                        research=await required(page.locator('[data-studio-v4-menu="research"]'))
                        await expect(research.get_by_text('Deep research (includes web)',exact=True)).to_be_visible()
                        await expect(research.get_by_text('Web search',exact=True)).to_be_visible()
                        await expect(research.get_by_role('button',name='Pro',exact=True)).to_be_visible()
                        switches=research.get_by_role('switch');assert await switches.count()==2
                        await switches.nth(0).click()
                        await expect(switches.nth(0)).to_be_checked();await expect(switches.nth(1)).to_be_checked()
                        await switches.nth(1).click()
                        await expect(switches.nth(0)).not_to_be_checked();await expect(switches.nth(1)).not_to_be_checked()
                        await shot(page,out,label+'-research-menu',errors,violations)
                        colors['research']=await research.evaluate('e=>({surface:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color})')
                        await page.keyboard.press('Escape');await expect(options).to_be_focused()
                        # Metadata-only inbound frame: no preview URL and no renderer substitute.
                        product_socket[-1].send(json.dumps({'type':'slide_update','message_id':'local-slide-metadata','timestamp':NOW,'payload':{'operation':'full_update','metadata':{'main_title':'Local metadata','overall_theme':'Minimal','design_suggestions':'','target_audience':'Review','presentation_duration':5},'slides':SLIDES,'affected_slides':None}}))
                        await textarea.fill('Please review @Over')
                        await expect(page.get_by_text('Tag a slide',exact=True)).to_be_visible()
                        before=len([f for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message'])
                        await shot(page,out,label+'-slide-picker',errors,violations)
                        await textarea.press('Enter')
                        await expect(textarea).to_have_value('Please review @[Slide 1: Overview] ')
                        assert before==len([f for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message'])
                        await expect(textarea).to_be_focused()
                        await textarea.fill('Please review @2');await textarea.press('Tab')
                        await expect(textarea).to_have_value('Please review @[Slide 2: Evidence] ')
                        assert before==len([f for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message'])
                        await expect(textarea).to_be_focused()
                        await textarea.press('Shift+Enter')
                        assert '\n' in await textarea.input_value()
                        await textarea.fill('Please review @[Slide 2: Evidence]')
                        await textarea.press('Enter')
                        await page.get_by_text('Local fixture acknowledged. No service was contacted.',exact=True).wait_for(timeout=10000)
                        messages=[json.loads(f) for f in frames if isinstance(f,str) and f.startswith('{') and json.loads(f).get('type')=='user_message']
                        assert len(messages)==before+1,messages
                        assert messages[-1]['data']['references']==[{'kind':'slide','index':1,'slide_id':'local-slide-2','label':'Evidence'}],messages
                        await expect(theme).to_be_disabled(timeout=10000)
                        await expect(page.get_by_text('Theme locked: Local minimal',exact=True)).to_be_visible()
                        assert await page.get_by_role('button',name='Clear theme',exact=True).count()==0
                        await shot(page,out,label+'-theme-locked',errors,violations)
                        controls['keyboard']={'enter_select_no_send':True,'tab_select_no_send':True,'shift_enter_newline':True,'one_normal_enter_send':True,'file_chooser_multiple':True,'escape_focus_return':True,'draft_retained':True,'theme_locked':True}
                    colors['chrome']=await page.evaluate('''() => {const c=document.querySelector('[data-studio-v4-composer]'),p=document.querySelector('[data-studio-v4-prompt]'),t=p.querySelector('textarea'),s=p.querySelector('[data-studio-v4-send]');return {header:getComputedStyle(document.querySelector('header')).backgroundColor,composer:getComputedStyle(c).backgroundColor,prompt:getComputedStyle(p).backgroundColor,text:getComputedStyle(t).color,placeholder:getComputedStyle(t,'::placeholder').color,focus:getComputedStyle(p).borderColor,sendBackground:getComputedStyle(s).backgroundColor,sendText:getComputedStyle(s).color}}''')
                    if args.tokens=='on':
                        c=colors['chrome']
                        assert c['prompt']==('rgb(34, 45, 48)' if dark else 'rgb(245, 247, 246)'),c
                        assert c['header']==('rgb(27, 36, 38)' if dark else 'rgb(255, 255, 255)'),c
                        ratios={'prompt_text':contrast(c['text'],c['prompt']),'placeholder':contrast(c['placeholder'],c['prompt']),'disabled_send':contrast(c['sendText'],c['sendBackground'])}
                        if 'enabled' in colors:
                            e=colors['enabled']
                            ratios['enabled_send']=contrast(e['text'],e['background'])
                            ratios['focus_adjacent']=contrast(e['focus'],e['prompt'])
                            ratios['theme_menu']=contrast(colors['theme']['text'],colors['theme']['surface'])
                        assert all(v >= (3 if k=='focus_adjacent' else 4.5) for k,v in ratios.items()),ratios
                        colors['contrast_ratios']=ratios
                    assert not errors,errors
                    assert not violations,violations
                    assert len(product_socket)==3,sockets
                    assert await page.locator('iframe').count()==0
                    results.append({'state':label,'status':response.status,'load_seconds':round(time.monotonic()-start,2),'page_errors':errors,'violations':violations,'intercepted_requests':intercepted,'external_requests':external,'websockets':sockets,'outbound_fixture_frames':frames,'controls':controls,'colors':colors})
                except Exception as exc:
                    theme_release.set();upload_release.set()
                    await page.screenshot(path=str(out/(label+'-failure.png')))
                    (out/'failure.json').write_text(json.dumps({'source_identity':identity,'state':label,'error':str(exc),'page_errors':errors,'violations':violations,'requests':intercepted,'websockets':sockets},indent=2))
                    raise
                finally:
                    await context.close()
        finally:
            await browser.close()
    (out/'browser-proof.json').write_text(json.dumps({'tokens':args.tokens,'type':args.type,'labels':args.header_labels or 'off','source_identity':identity,'preview_config':config,'states':results,'coverage':'Intercepted real frontend. No connected integration or presentation toolbar proof.'},indent=2)+'\n')
    print(json.dumps([{'state':r['state'],'status':r['status'],'page_errors':r['page_errors'],'violations':r['violations'],'keyboard':r.get('controls',{}).get('keyboard')} for r in results],indent=2))

if __name__=='__main__':asyncio.run(main())
