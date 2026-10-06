"""Bounded native Studio walkthrough checks; no service operations."""
import hashlib, json, subprocess
from pathlib import Path
from playwright.async_api import expect
from capture import ROOT, BASE
from native_viewer import SAMPLE, LAYOUT_REF, CACHE

OUT = ROOT / 'docs/studio-v4/walkthrough-corrections-20261002/evidence'

async def verify(page, context, browser, errors, violations, denied, native, session_fixture):
    OUT.mkdir(parents=True, exist_ok=True)
    frame = page.get_by_title('Presentation Viewer', exact=True)
    native_frame = frame.content_frame
    await native_frame.locator('.reveal .slides > section.present .slide-title').wait_for()
    await page.wait_for_timeout(1000)
    snapshots = {}
    async def snapshot(name):
        assert not errors and not violations and not denied, (errors, violations, denied)
        await page.wait_for_timeout(350)
        data = await page.evaluate('''() => {
          const rect = element => {if(!element)return null;const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
          const iframe=document.querySelector('iframe[title="Presentation Viewer"]');
          return {viewport:{width:innerWidth,height:innerHeight},pageWidth:document.body.scrollWidth,fullscreen:!!document.fullscreenElement,iframe:rect(iframe),stage:rect(document.querySelector('[data-studio-slide-space=true]')),viewer:rect(document.querySelector('[data-studio-v4-viewer]')),authoring:rect(document.querySelector('[data-studio-v4-authoring-controls=true]')),lower:rect(document.querySelector('[data-studio-slide-controls=true]')),selected:[...document.querySelectorAll('[data-studio-thumbnail-navigation=true][aria-current=true]')].map(e=>e.getAttribute('aria-label')),thumbnailPreviews:[...document.querySelectorAll('[data-studio-thumbnail-preview=true] img')].map(e=>({url:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),counter:document.querySelector('[data-studio-slide-controls=true]')?.textContent,header:rect(document.querySelector('header')),thumbnailRail:rect(document.querySelector('[data-studio-v4-thumbnail-resize=true]'))};
        }''')
        data['native'] = await native_frame.locator('body').evaluate('''() => ({index:Reveal.getIndices().h,count:Reveal.getTotalSlides(),title:Reveal.getCurrentSlide().querySelector('.slide-title').textContent.trim(),footer:Reveal.getCurrentSlide().querySelector('.footer-presentation-name').textContent.trim(),slide: (()=>{let r=Reveal.getCurrentSlide().getBoundingClientRect();return {width:r.width,height:r.height}})()})''')
        assert data['pageWidth'] <= data['viewport']['width'] + 1, data
        assert abs(data['iframe']['width']/data['iframe']['height']-16/9)<0.005, data
        assert abs(data['native']['slide']['width']/data['native']['slide']['height']-16/9)<0.005, data
        if not data['fullscreen']:
            assert len(data['thumbnailPreviews']) == 2 and all(item['loaded'] for item in data['thumbnailPreviews']), data
            # The retained compact workspace-switch strip sits above Viewer at
            # narrow widths; the rail aligns with Viewer's actual top.
            assert abs(data['thumbnailRail']['y'] - data['viewer']['y']) <= 2, data
            assert data['authoring']['y'] + data['authoring']['height'] <= data['iframe']['y'], data
            assert data['lower']['y'] >= data['iframe']['bottom'], data
            assert f"Slide {data['native']['index']+1} / 2" in data['counter'], data
        snapshots[name] = data
        await page.screenshot(path=str(OUT/(name+'.png')), animations='disabled')
    await expect(page.locator('[data-studio-v4-authoring-controls=true]')).to_have_count(1)
    await expect(page.get_by_title('Present fullscreen', exact=True)).to_have_count(1)
    assert not await page.locator('header').get_by_title('Switch version', exact=True).count()
    assert not await page.get_by_text('Create & Edit', exact=True).count()
    assert not await page.locator('header [data-studio-build-fingerprint]').count()
    for label in ['Add Slide', 'Add Element', 'Template', 'Theme', 'Mode', 'Show']:
        await expect(page.locator('[data-studio-v4-authoring-controls=true]').get_by_role('button',name=label,exact=True)).to_be_visible()
    await snapshot('normal-slide-1')
    iframe_identity = await frame.element_handle()
    await page.get_by_role('button',name='Go to slide 2: '+SAMPLE['slides'][1]['content']['slide_title'],exact=True).click()
    await expect(native_frame.locator('.reveal .slides > section.present .slide-title')).to_have_text(SAMPLE['slides'][1]['content']['slide_title'])
    await expect(page.locator('[data-studio-slide-controls=true]')).to_contain_text('Slide 2 / 2')
    await snapshot('normal-slide-2')
    await page.get_by_role('button',name='Show',exact=True).click()
    await expect(page.get_by_role('menuitem',name='Final',exact=False)).to_be_visible()
    await page.keyboard.press('Escape')
    # Resize the actual browser window. No emulated viewport override.
    session = await context.new_cdp_session(page)
    window = await session.send('Browser.getWindowForTarget')
    for name,width,height in [('wide',2400,1500),('narrow',1030,760)]:
        await session.send('Browser.setWindowBounds',{'windowId':window['windowId'],'bounds':{'width':width,'height':height,'windowState':'normal'}})
        await page.wait_for_timeout(650)
        await snapshot(name+'-slide-2')
    await session.send('Browser.setWindowBounds',{'windowId':window['windowId'],'bounds':{'width':1440,'height':960,'windowState':'normal'}})
    await page.wait_for_timeout(650)
    await page.get_by_title('Present fullscreen',exact=True).click()
    await page.wait_for_function('!!document.fullscreenElement')
    await page.wait_for_timeout(900)
    await snapshot('fullscreen-slide-2')
    assert await iframe_identity.evaluate('e=>e===document.querySelector(\'iframe[title="Presentation Viewer"]\')')
    assert await page.locator('[data-studio-slide-space=true]').evaluate("e=>getComputedStyle(e).backgroundColor") == 'rgb(0, 0, 0)'
    await expect(page.locator('[data-studio-thumbnail-navigation=true]')).to_have_count(0)
    # Playwright's synthetic Escape is delivered to the document, not macOS's
    # browser fullscreen shortcut. Use the real existing Exit button instead.
    await page.mouse.move(20,20)
    await page.get_by_title('Exit fullscreen (ESC)',exact=True).click()
    await page.wait_for_function('!document.fullscreenElement')
    await page.wait_for_timeout(650)
    await snapshot('exit-slide-2')
    assert await iframe_identity.evaluate('e=>e===document.querySelector(\'iframe[title="Presentation Viewer"]\')')
    # Reload returns the supplied sample's initial slide, without claiming saved
    # navigation state. Images/content/counter must still agree after restore.
    await page.reload(wait_until='domcontentloaded')
    await expect(native_frame.locator('.reveal .slides > section.present .slide-title')).to_have_text(SAMPLE['slides'][0]['content']['slide_title'])
    await page.wait_for_timeout(700)
    await snapshot('reload-slide-1')
    for slide in session_fixture['stateCache']['slideStructure']['slides']:
        slide['thumbnail_presentation_id'] = 'different-version-same-slide-count'
    await page.reload(wait_until='domcontentloaded')
    await expect(native_frame.locator('.reveal .slides > section.present .slide-title')).to_have_text(SAMPLE['slides'][0]['content']['slide_title'])
    await expect(page.locator('[data-studio-thumbnail-preview=true] img')).to_have_count(0)
    await expect(page.locator('[data-studio-thumbnail-preview=true][data-has-preview=false]')).to_have_count(2)
    await page.screenshot(path=str(OUT/'different-owner-no-images.png'),animations='disabled')
    for slide in session_fixture['stateCache']['slideStructure']['slides']:
        slide['thumbnail_presentation_id'] = 'studio-v4-local-renderer'
    await page.reload(wait_until='domcontentloaded')
    await expect(native_frame.locator('.reveal .slides > section.present .slide-title')).to_have_text(SAMPLE['slides'][0]['content']['slide_title'])
    await page.wait_for_timeout(700)
    await snapshot('restored-owner-slide-1')
    result={'layout_ref':LAYOUT_REF,'source_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'source_hashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['components/presentation-viewer.tsx','components/builder/builder-header.tsx','components/builder/studio-canvas.css','scripts/studio-v4/walkthrough.py','scripts/studio-v4/native_viewer.py','scripts/studio-v4/verify_walkthrough.py']},'viewport_emulation':False,'page_errors':errors,'unexpected_transport':violations,'refused_writes':len(denied),'real_services_contacted':False,'public_dependency_404':[url for url,meta in native.manifest['static_dependencies'].items() if meta.get('status')==404],'snapshots':snapshots}
    (OUT/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    (OUT/'layout-manifest.json').write_text((CACHE/'manifest.json').read_text())
    print('Verified native slide navigation, thumbnails, window resizing, fullscreen/exit and reload; zero service traffic, page errors or writes.',flush=True)
