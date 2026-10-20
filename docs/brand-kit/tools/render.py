"""Render SVG -> PNG with the real Chromium that ships with the sandbox (Playwright)."""
import base64
import os
from playwright.sync_api import sync_playwright


class Renderer:
    def __enter__(self):
        self._p = sync_playwright().start()
        self.b = self._p.chromium.launch()
        return self

    def __exit__(self, *a):
        self.b.close()
        self._p.stop()

    def png(self, svg_path, out, w, h, bg=None, scale=1):
        data = base64.b64encode(open(svg_path, "rb").read()).decode()
        style = f"html,body{{margin:0;padding:0;background:{bg or 'transparent'}}}img{{display:block}}"
        pg = self.b.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        pg.set_content(f"<style>{style}</style><img width='{w}' height='{h}' src='data:image/svg+xml;base64,{data}'>")
        pg.wait_for_timeout(50)
        pg.screenshot(path=out, omit_background=bg is None, clip={"x": 0, "y": 0, "width": w, "height": h})
        pg.close()
        return out
