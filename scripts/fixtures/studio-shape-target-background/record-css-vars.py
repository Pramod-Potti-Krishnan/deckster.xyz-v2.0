# Calls the REAL layout-builder GET /api/presentations/{id}/theme/css-variables handler (server.py:2980) via FastAPI TestClient,
# storage.load stubbed to return a stored deck's theme_config (no network, no keys).
import json, os, sys
sys.path.insert(0, sys.argv[1]); os.chdir(sys.argv[1])
os.environ.setdefault("STORAGE_BACKEND", "filesystem")
import server
from fastapi.testclient import TestClient
PREDEFINED_THEMES = server.PREDEFINED_THEMES
decks = {
  "default": {"theme_config": None},
  "custom-hero-navy": {"theme_config": {"theme_id": "custom", "is_custom": True, "custom_theme": {"--theme-bg": "#0f172a", "--theme-hero-bg": "#16203a", "--theme-primary": "#16203a", "--theme-accent": "#38bdf8"}}},
  "custom-rgb-bg": {"theme_config": {"theme_id": "custom", "is_custom": True, "custom_theme": {"--theme-bg": "rgb(15, 23, 42)", "--theme-hero-bg": "linear-gradient(135deg,#16203a,#0f172a)"}}},
}
for tid in list(PREDEFINED_THEMES)[:12]:
    decks[f"theme:{tid}"] = {"theme_config": {"theme_id": tid}}
client = TestClient(server.app)
out = {}
for name, deck in decks.items():
    async def load(_id, deck=deck): return {"id": "x", "slides": [], **deck}
    server.storage.load = load
    r = client.get("/api/presentations/x/theme/css-variables")
    j = r.json()
    out[name] = {"status": r.status_code, "css_variables": {k: v for k, v in (j.get("css_variables") or {}).items() if k in ("--theme-bg","--theme-bg-alt","--theme-hero-bg","--theme-primary","--theme-accent","--theme-primary-light","--theme-primary-dark","--theme-text-primary","--theme-text-body")}, "keys_total": len(j.get("css_variables") or {}), "theme_id": j.get("theme_id"), "is_custom": j.get("is_custom")}
json.dump(out, open(sys.argv[2], "w"), indent=1)
print({k: (v["status"], v["css_variables"].get("--theme-bg"), v["css_variables"].get("--theme-hero-bg")) for k, v in out.items()})
