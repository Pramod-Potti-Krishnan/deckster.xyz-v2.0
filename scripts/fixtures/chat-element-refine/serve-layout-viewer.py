"""Serve Layout's real viewer page, in process, for scripts/test-studio-chat-element-refine.mjs (NEXT_PUBLIC_CHAT_ELEMENT_REFINE).

Run with the layout-builder checkout (layout-builder-v7.5 !245, head 8b19344c) and that repo's own Python:

    PYTHONDONTWRITEBYTECODE=1 <layout venv>/bin/python -B <this file> <layout checkout> <out dir> <storage dir>

The process works in <storage dir> (Layout's file store creates storage/versions under the working directory), so the checkout is
only read.

It applies Layout's own hermetic test environment and live-call guard (tests/_hermetic_env.py, tests/_live_call_guard.py: local
storage, no credentials, no service URL, any network attempt fails), puts one synthetic deck in an in-memory store, and GETs
/p/<id> through the ASGI app (no socket, no server) twice: with LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED unset and with it "true".
It writes served-off.html, served-on.html and served.json (sha256 + flag state) into <out dir>. Nothing else is written.
"""
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

LAYOUT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
STORAGE = str(Path(sys.argv[3]).resolve())
FLAG = "LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED"
STUDIO_ORIGIN = "https://studio.synthetic.test"

sys.path.insert(0, str(LAYOUT))
os.chdir(STORAGE)
from tests import _hermetic_env, _live_call_guard  # noqa: E402

_hermetic_env.apply(os.environ, STORAGE, allow_live=False)
_hermetic_env.ignore_dotenv()
_hermetic_env.assert_hermetic(STORAGE)
_live_call_guard.install()
os.environ["FRONTEND_ALLOWED_ORIGINS"] = STUDIO_ORIGIN

import httpx  # noqa: E402
import config  # noqa: E402
import server  # noqa: E402


class MemoryStorage:
    def __init__(self, presentation):
        self.presentation = presentation

    async def load(self, presentation_id):
        return self.presentation


DECK = {"id": "pres-e2e", "title": "Refine from chat", "slides": [
    {"layout": "C1", "slide_id": f"L{i}", "content": {"slide_title": title}}
    for i, title in enumerate(("Overview", "Plan", "Revenue by region"))]}


async def get(flag):
    if flag is None:
        os.environ.pop(FLAG, None)
    else:
        os.environ[FLAG] = flag
    config._settings = None
    config.reload_settings()
    server.storage = MemoryStorage(DECK)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://local") as client:
            response = await client.get("/p/pres-e2e")
            assert response.status_code == 200, response.status_code
            return response.text
    finally:
        config._settings = None


async def main():
    pages = {"off": await get(None), "on": await get("true")}
    violations = _live_call_guard.take_violations()
    assert not violations, violations
    meta = {}
    for name, html in pages.items():
        (OUT / f"served-{name}.html").write_text(html, encoding="utf-8")
        meta[name] = {"flag": None if name == "off" else "true", "sha256": hashlib.sha256(html.encode()).hexdigest(), "bytes": len(html.encode())}
    meta["frontend_allowed_origins"] = STUDIO_ORIGIN
    (OUT / "served.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta))


asyncio.run(main())
