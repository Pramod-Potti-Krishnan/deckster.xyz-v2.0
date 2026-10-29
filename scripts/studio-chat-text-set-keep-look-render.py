"""FRONTEND-2 (B49b, 29 Oct): the render half of scripts/test-studio-chat-text-set-keep-look.mjs (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK).

Puts a text box's markup (the DOM the Layout viewer holds after a chat exact-text set) in a 1600x900 slide frame, styles it with Layout's REAL stylesheets (the ones viewer/presentation-viewer.html links, in its order,
read from the layout-builder checkout) in headless Chromium, and measures what is drawn: the computed size / weight / colour of the first text, the box's own size, and the number of lines. Optionally saves a PNG.

No network: every request the page makes is aborted (the page is set from a string; the stylesheets are inlined, their @import lines dropped). Nothing is written but the PNGs asked for.
Usage: python3 -B studio-chat-text-set-keep-look-render.py <spec.json>   (spec: {layoutDir, css: [relative paths], viewport: {width, height}, pngDir, cases: [{name, html, png}]})
Prints "@@RESULT@@" and a JSON object {name: {boxFontSize, boxFontWeight, leafTag, fontSize, fontWeight, color, lines}}.
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

MEASURE = """() => {
  const box = document.querySelector('.textbox-content');
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: node => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const first = walker.nextNode();
  const leaf = first ? first.parentElement : box;
  const leafStyle = getComputedStyle(leaf);
  const boxStyle = getComputedStyle(box);
  return {
    boxFontSize: boxStyle.fontSize,
    boxFontWeight: boxStyle.fontWeight,
    leafTag: leaf === box ? 'div' : leaf.tagName.toLowerCase(),
    fontSize: leafStyle.fontSize,
    fontWeight: leafStyle.fontWeight,
    color: leafStyle.color,
    lines: box.innerText.split('\\n').filter(line => line.trim() !== '').length,
  };
}"""


def stylesheet(layout_dir, rel):
    text = open(os.path.join(layout_dir, rel), encoding="utf-8").read()
    return re.sub(r"@import[^;]*;", "", text)


def page_html(css, body):
    return (
        '<!doctype html><html><head><meta charset="utf-8"><style>' + css + "</style></head>"
        '<body style="margin:0;background:#ffffff"><div class="reveal"><div class="slides">'
        '<section style="position:relative;width:1600px;height:900px;overflow:hidden">' + body + "</section></div></div></body></html>"
    )


def main(spec_path):
    spec = json.load(open(spec_path, encoding="utf-8"))
    css = "\n".join(stylesheet(spec["layoutDir"], rel) for rel in spec["css"])
    viewport = spec.get("viewport") or {"width": 1600, "height": 900}
    png_dir = spec.get("pngDir")
    results = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for case in spec["cases"]:
                page = browser.new_page(viewport=viewport)
                page.route("**/*", lambda route: route.abort())
                page.set_content(page_html(css, case["html"]), wait_until="load")
                results[case["name"]] = page.evaluate(MEASURE)
                if png_dir and case.get("png"):
                    os.makedirs(png_dir, exist_ok=True)
                    page.screenshot(path=os.path.join(png_dir, case["png"] + ".png"))
                page.close()
        finally:
            browser.close()
    sys.stdout.write("\n@@RESULT@@" + json.dumps(results))


if __name__ == "__main__":
    main(sys.argv[1])
