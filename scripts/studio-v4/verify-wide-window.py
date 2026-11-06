"""One additional large virtual-window proof using the same strict adapter.

The macOS display constrains the headed window height. This separately checks
the removed 1280px Studio width cap at an actual >1280px rendered frame, with
no Playwright viewport emulation. Only the verification callback is replaced.
"""
import asyncio, hashlib, json, sys
from pathlib import Path
import verify_walkthrough, walkthrough
from capture import ROOT

async def wide(page, context, browser, errors, violations, denied, native, session):
    assert page.viewport_size is None
    cdp = await context.new_cdp_session(page)
    window = await cdp.send('Browser.getWindowForTarget')
    await cdp.send('Browser.setWindowBounds',{'windowId':window['windowId'],'bounds':{'width':2400,'height':1500,'windowState':'normal'}})
    await page.wait_for_function('innerWidth === 2400 && innerHeight === 1500')
    await page.wait_for_timeout(650)
    iframe=page.get_by_title('Presentation Viewer',exact=True)
    box=await iframe.bounding_box()
    assert box['width']>1280 and abs(box['width']/box['height']-16/9)<0.005,box
    native_size=await iframe.content_frame.locator('.reveal .slides > section.present').bounding_box()
    assert abs(native_size['width']/native_size['height']-16/9)<0.005,native_size
    assert not errors and not violations and not denied,(errors,violations,denied)
    out=ROOT/'docs/studio-v4/walkthrough-corrections-20261002/evidence'
    await page.screenshot(path=str(out/'virtual-wide-window.png'),animations='disabled')
    files=['components/presentation-viewer.tsx','scripts/studio-v4/walkthrough.py','scripts/studio-v4/native_viewer.py','scripts/studio-v4/verify-wide-window.py']
    (out/'wide-window-results.json').write_text(json.dumps({'headed':False,'viewport_emulation':False,'window':{'width':2400,'height':1500},'iframe':box,'native_slide':native_size,'page_errors':errors,'unexpected_transport':violations,'refused_writes':len(denied),'source_hashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files}},indent=2)+'\n')
    print('Large virtual-window proof passes: native 16:9 frame exceeds1280px with no viewport emulation or service traffic.',flush=True)

if __name__=='__main__':
    verify_walkthrough.verify=wide
    sys.argv=['walkthrough.py','--verify','--headless','--status-path','/private/tmp/studio-v4-wide-window-status.json']
    asyncio.run(walkthrough.main())
