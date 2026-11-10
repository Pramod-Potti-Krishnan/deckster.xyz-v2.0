"""Replay the immutable current UAT Layout viewer with local sample JSON.

Preparation downloads public static dependencies only. Browser replay never
contacts Layout or a CDN. The native viewer/bridge/assets are not substituted.
"""
import argparse, hashlib, io, json, mimetypes, re, ssl, subprocess, tarfile
import certifi
from pathlib import Path
from urllib.parse import urlparse, urljoin
from urllib.request import Request, urlopen
from urllib.error import HTTPError

LAYOUT_REF = '7cbe25cb818cb9c7009242a4ec14a6187c529d2f'
LAYOUT_REPO = Path('/Users/pk1980/Software/Deckster/.worktrees/layout-restyle-ref')
CACHE = Path('/private/tmp/studio-v4-native-layout') / LAYOUT_REF
ORIGIN = 'https://layout-builder-v75-uat.up.railway.app'
PRESENTATION_ID = 'studio-v4-local-renderer'
VIEWER = ORIGIN + '/p/' + PRESENTATION_ID
BASE = 'http://127.0.0.1:8792'
SAMPLE = {
    'presentation_id': PRESENTATION_ID,
    'title': 'Quarterly strategy · LOCAL SAMPLE',
    'theme_config': {'theme_id': 'corporate-blue', 'theme_mode': 'light'},
    'slides': [
        {'slide_id': 'local-slide-1', 'layout': 'L25', 'content': {
            'slide_title': 'Make the next decision clear.',
            'subtitle': 'Quarterly strategy · A shared direction',
            'rich_content': '<div style="display:flex;gap:90px;height:100%;align-items:center"><div style="width:55%;font-size:48px;line-height:1.55;color:var(--theme-text-secondary)">Connect the priorities.<br>Make the trade-offs visible.<br>Move forward with confidence.</div><div style="display:flex;align-items:end;gap:40px;width:38%;height:420px"><div style="width:100px;height:45%;background:#397f72"></div><div style="width:100px;height:70%;background:#6e9a82"></div><div style="width:100px;height:100%;background:#b3c6a4"></div></div></div>',
            'presentation_name': 'Local sample · Quarterly strategy · 01 / 02'}},
        {'slide_id': 'local-slide-2', 'layout': 'L25', 'content': {
            'slide_title': 'Turn evidence into the next action.',
            'subtitle': 'Quarterly strategy · Evidence and ownership',
            'rich_content': '<div style="display:flex;gap:60px;align-items:center;height:100%"><div style="width:33%;padding:50px;background:#e8f1ed"><div style="font-size:110px;font-weight:700;color:#397f72">3</div><div style="font-size:36px;color:#27463b">shared priorities</div></div><div style="font-size:44px;line-height:1.55;color:var(--theme-text-secondary)">Assign an owner to every decision.<br>Agree the evidence to review.<br>Set the next checkpoint.</div></div>',
            'presentation_name': 'Local sample · Quarterly strategy · 02 / 02'}}
    ]
}

def prepare():
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = subprocess.check_output(['git', '-C', str(LAYOUT_REPO), 'archive', LAYOUT_REF, 'viewer/presentation-viewer.html', 'src'])
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar:
            if member.isfile():
                destination = CACHE / member.name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(tar.extractfile(member).read())
    html = (CACHE / 'viewer/presentation-viewer.html').read_text()
    urls = re.findall(r'(?:src|href)="(https://[^"\s]+)"', html)
    urls = [url for url in urls if urlparse(url).netloc in ['cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'fonts.googleapis.com'] and (urlparse(url).path or urlparse(url).netloc == 'cdn.tailwindcss.com')]
    manifest = {'layout_ref': LAYOUT_REF, 'static_dependencies': {}}
    queue = list(dict.fromkeys(urls))
    while queue:
        url = queue.pop(0)
        if url in manifest['static_dependencies']:
            continue
        name = hashlib.sha256(url.encode()).hexdigest()
        asset = CACHE / 'public' / name
        asset.parent.mkdir(exist_ok=True)
        meta_path = asset.with_suffix('.json')
        if asset.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text())
            data = asset.read_bytes()
            assert hashlib.sha256(data).hexdigest() == meta['sha256'], url
        else:
            assert urlparse(url).netloc in ['cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'], url
            print('Caching public static asset: ' + url, flush=True)
            try:
                response = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40, context=ssl.create_default_context(cafile=certifi.where()))
            except HTTPError as error:
                # Preserve an upstream missing optional library response. Never
                # replace it with a stub or silently change the UAT dependency.
                if error.code != 404:
                    raise
                response = error
            with response:
                data = response.read()
                meta = {'file': 'public/' + name, 'sha256': hashlib.sha256(data).hexdigest(), 'content_type': response.headers.get_content_type(), 'resolved_url': response.url, 'status': response.status}
            asset.write_bytes(data)
            meta_path.write_text(json.dumps(meta, indent=2) + '\n')
        manifest['static_dependencies'][url] = meta
        if meta['content_type'] == 'text/css':
            for reference in re.findall(r'url\(([^)]+)\)', data.decode()):
                dependency = urljoin(meta['resolved_url'], reference.strip(' \'"'))
                if dependency.startswith('https://'):
                    assert urlparse(dependency).netloc in ['cdn.jsdelivr.net', 'fonts.gstatic.com'], dependency
                    queue.append(dependency)
    manifest['viewer_sha256'] = hashlib.sha256((CACHE / 'viewer/presentation-viewer.html').read_bytes()).hexdigest()
    (CACHE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'layout_ref': LAYOUT_REF, 'public_assets': len(manifest['static_dependencies']), 'cache': str(CACHE), 'total_bytes': sum(p.stat().st_size for p in CACHE.rglob('*') if p.is_file())}))

class NativeViewer:
    def __init__(self):
        self.manifest = json.loads((CACHE / 'manifest.json').read_text())
        html = (CACHE / 'viewer/presentation-viewer.html').read_text()
        data = json.dumps(SAMPLE, ensure_ascii=False).replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
        assert html.count('const PRESENTATION_DATA = null;') == 1
        assert html.count('const ALLOWED_PARENT_ORIGINS = Object.freeze([]);') == 1
        self.html = html.replace('const PRESENTATION_DATA = null;', 'const PRESENTATION_DATA = ' + data + ';').replace('const ALLOWED_PARENT_ORIGINS = Object.freeze([]);', 'const ALLOWED_PARENT_ORIGINS = Object.freeze(' + json.dumps([BASE]) + ');')

    async def route(self, route):
        request = route.request
        if request.method != 'GET':
            return False
        url = request.url
        parsed = urlparse(url)
        # Browsers canonicalize the document's empty-path Tailwind URL to /.
        if url == 'https://cdn.tailwindcss.com/':
            url = 'https://cdn.tailwindcss.com'
        if url == VIEWER:
            await route.fulfill(content_type='text/html', body=self.html)
            return True
        if parsed.scheme + '://' + parsed.netloc == ORIGIN and parsed.path.startswith('/src/'):
            local = (CACHE / parsed.path.lstrip('/')).resolve()
            assert local.is_relative_to(CACHE.resolve()) and local.is_file(), url
            await route.fulfill(body=local.read_bytes(), content_type=mimetypes.guess_type(str(local))[0] or 'application/octet-stream')
            return True
        if url in self.manifest['static_dependencies']:
            meta = self.manifest['static_dependencies'][url]
            await route.fulfill(status=meta.get('status', 200), body=(CACHE / meta['file']).read_bytes(), content_type=meta['content_type'], headers={'Access-Control-Allow-Origin': '*'})
            return True
        return False

    async def thumbnails(self, playwright):
        """Capture the two rendered native slides, with no service responses."""
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080}, service_workers='block')
        errors, unexpected = [], []
        async def route(request_route):
            if not await self.route(request_route):
                unexpected.append(request_route.request.method + ' ' + request_route.request.url)
                await request_route.abort()
        await context.route('**/*', route)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            response = await page.goto(VIEWER, wait_until='networkidle')
            assert response.status == 200
            await page.wait_for_function('window.Reveal && Reveal.isReady() && Reveal.getTotalSlides() === 2')
            await page.evaluate('document.fonts.ready')
            for index, slide in enumerate(SAMPLE['slides']):
                await page.evaluate('(index) => Reveal.slide(index)', index)
                await page.wait_for_function('(index) => Reveal.getIndices().h === index', arg=index)
                await page.wait_for_timeout(450)
                assert await page.locator('.reveal .slides > section.present .slide-title').inner_text() == slide['content']['slide_title']
                await page.screenshot(path=str(CACHE / f'slide-{index + 1}.png'), animations='disabled')
            assert not errors and not unexpected, (errors, unexpected)
        finally:
            await browser.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true', required=True)
    parser.parse_args()
    prepare()
