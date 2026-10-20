"""Build every catat brand asset (SVG, PNG, favicon, web set) from geometry.

Icon      : filled outlines only, real holes (evenodd) -> one-colour, dark and tiled versions all work.
Wordmark  : monoline rounded letters, one stroke width, round caps (stroked paths, editable weight).
Signature : 'by coreboylabs' outlined from Poppins Medium (SIL OFL), so no font is needed at runtime.
Run       : python3 tools/build_catat.py
"""
import json
import os
import shutil
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catat_lib import (EMERALD, NAVY, SLATE, SLATE_DARK, LIGHT_TXT, WHITE, PAPER, MINT,  # noqa: E402
                       doc, f, horizontal, mark, signature, wordmark)
from render import Renderer  # noqa: E402

ROOT = "/home/claude/catat"
BRAND, PNG, WEB, PUB = f"{ROOT}/brand", f"{ROOT}/brand/png", f"{ROOT}/brand/web", f"{ROOT}/public"
for d in (BRAND, PNG, WEB, PUB, f"{PUB}/brand"):
    os.makedirs(d, exist_ok=True)
for fn in os.listdir(BRAND):                     # drop stale assets from the earlier "struk" concept
    p = os.path.join(BRAND, fn)
    if os.path.isfile(p):
        os.remove(p)

EM_BRIGHT, FLAP_DARK = "#10B981", "#047857"       # #10B981 = brief's emerald; used on dark surfaces
LIGHT = dict(body=EMERALD, flap=NAVY, word=NAVY, sig=SLATE)
DARK = dict(body=EM_BRIGHT, flap=FLAP_DARK, word=LIGHT_TXT, sig=SLATE_DARK)
MONO = dict(body=NAVY, flap=NAVY, word=NAVY, sig=NAVY)
MONOW = dict(body=WHITE, flap=WHITE, word=WHITE, sig=WHITE)

BASE_TITLE, SIG_TITLE = "catat", "catat by coreboylabs"


def put(name, text):
    open(f"{BRAND}/{name}.svg", "w").write(text)


# ------------------------------------------------------------------ lockups
def logo(name, pal, with_sig=True):
    body, vb = horizontal(mark(pal["body"], pal["flap"]), pal["word"], pal["sig"], with_sig=with_sig)
    title = SIG_TITLE if with_sig else BASE_TITLE
    desc = "Logo catat dengan tanda tangan merek by coreboylabs" if with_sig else "Logo catat versi ringkas"
    put(name, doc(vb, body, title, desc))
    return vb


vb_logo = logo("catat-logo", LIGHT)
logo("catat-logo-dark", DARK)
logo("catat-logo-mono", MONO)
logo("catat-logo-mono-white", MONOW)
vb_compact = logo("catat-logo-compact", LIGHT, with_sig=False)
logo("catat-logo-compact-dark", DARK, with_sig=False)
logo("catat-logo-compact-mono", MONO, with_sig=False)

# ------------------------------------------------------------------ mark only (no tile), separable from the wordmark
MVB = (36, 16, 184, 224)
for name, pal in (("catat-mark", LIGHT), ("catat-mark-dark", DARK), ("catat-mark-mono", MONO)):
    put(name, doc(MVB, f'<g id="icon">{mark(pal["body"], pal["flap"])}</g>', BASE_TITLE, "Ikon catat: halaman dengan centang"))

# wordmark only
for name, pal in (("catat-wordmark", LIGHT), ("catat-wordmark-dark", DARK)):
    g, ww = wordmark(pal["word"])
    put(name, doc((-8, -140, ww + 16, 148), f'<g id="wordmark">{g}</g>', BASE_TITLE, "Wordmark catat"))


# ------------------------------------------------------------------ app icons (tile)
def tile(frac, rx=56, small=False, bg=EMERALD, body=WHITE, flap=NAVY):
    """Mark centred on a 256 tile; frac = page height / tile height."""
    s = frac * 256 / 208
    k = 128 - 128 * s
    rect = f'<rect width="256" height="256"{f" rx=\"{rx}\"" if rx else ""} fill="{bg}"/>'
    return rect + f'<g transform="translate({f(k)} {f(k)}) scale({f(s)})">{mark(body, flap, small=small)}</g>'


def icon(name, desc, **kw):
    put(name, doc((0, 0, 256, 256), tile(**kw), BASE_TITLE, desc))


icon("catat-icon", "Ikon aplikasi catat", frac=0.66)
icon("catat-icon-small", "Ikon aplikasi catat untuk ukuran kecil", frac=0.60, small=True)
# favicon: page only (no tile) so the document silhouette is as large as possible in a 16 px tab
put("favicon", doc((16, 16, 224, 224), mark(EMERALD, NAVY, small=True), BASE_TITLE, "Favicon catat"))
icon("apple-touch-icon", "Ikon layar utama iOS", frac=0.62, rx=0)
icon("catat-icon-maskable", "Ikon PWA maskable (zona aman 80%)", frac=0.50, rx=0)
icon("catat-icon-dark", "Ikon aplikasi catat, tile navy", frac=0.66, bg=NAVY, body=EM_BRIGHT, flap=FLAP_DARK)

print("svg done:", len(os.listdir(BRAND)), "files")

# ------------------------------------------------------------------ PNG + web set (real Chromium)
LW, LH = vb_logo[2], vb_logo[3]
CW, CH = vb_compact[2], vb_compact[3]


def ico(path, pngs):
    """Write a multi-size .ico with PNG-compressed entries (keeps each size hand-rendered, not resampled)."""
    blobs = [(int(os.path.basename(p).split("-")[1].split(".")[0]), open(p, "rb").read()) for p in pngs]
    head = struct.pack("<HHH", 0, 1, len(blobs))
    off = 6 + 16 * len(blobs)
    ent, data = b"", b""
    for size, b in blobs:
        ent += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(b), off + len(data))
        data += b
    open(path, "wb").write(head + ent + data)


with Renderer() as r:
    w = 1400
    r.png(f"{BRAND}/catat-logo.svg", f"{PNG}/catat-logo.png", w, round(w * LH / LW))
    r.png(f"{BRAND}/catat-logo-dark.svg", f"{PNG}/catat-logo-dark.png", w, round(w * LH / LW), bg=NAVY)
    r.png(f"{BRAND}/catat-logo-mono.svg", f"{PNG}/catat-logo-mono.png", w, round(w * LH / LW))
    r.png(f"{BRAND}/catat-logo-compact.svg", f"{PNG}/catat-logo-compact.png", 1000, round(1000 * CH / CW))
    r.png(f"{BRAND}/catat-logo-compact-dark.svg", f"{PNG}/catat-logo-compact-dark.png", 1000, round(1000 * CH / CW), bg=NAVY)
    r.png(f"{BRAND}/catat-icon.svg", f"{PNG}/catat-icon-512.png", 512, 512)
    r.png(f"{BRAND}/catat-icon-dark.svg", f"{PNG}/catat-icon-dark-512.png", 512, 512)
    r.png(f"{BRAND}/catat-mark.svg", f"{PNG}/catat-mark-512.png", 460, 560)
    for n in (16, 32, 48, 64):
        r.png(f"{BRAND}/favicon.svg" if n <= 48 else f"{BRAND}/catat-icon.svg", f"{WEB}/favicon-{n}.png", n, n)
    r.png(f"{BRAND}/apple-touch-icon.svg", f"{WEB}/apple-touch-icon.png", 180, 180)
    r.png(f"{BRAND}/catat-icon.svg", f"{WEB}/icon-192.png", 192, 192)
    r.png(f"{BRAND}/catat-icon.svg", f"{WEB}/icon-512.png", 512, 512)
    r.png(f"{BRAND}/catat-icon-maskable.svg", f"{WEB}/icon-maskable-512.png", 512, 512)
ico(f"{WEB}/favicon.ico", [f"{WEB}/favicon-{n}.png" for n in (16, 32, 48)])

manifest = {"name": "catat", "short_name": "catat", "description": "Catat keuangan, hidup lebih tenang.",
            "start_url": "/", "display": "standalone", "theme_color": NAVY, "background_color": "#FFFFFF",
            "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                      {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
                      {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
open(f"{WEB}/site.webmanifest", "w").write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
open(f"{WEB}/head-snippet.html", "w").write(
    '<link rel="icon" href="/favicon.ico" sizes="48x48" />\n'
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n'
    '<link rel="manifest" href="/site.webmanifest" />\n'
    f'<meta name="theme-color" content="{NAVY}" />\n')

# ------------------------------------------------------------------ public/ for the Vite app (copy-ready)
for fn in ("favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "site.webmanifest"):
    shutil.copy(f"{WEB}/{fn}", f"{PUB}/{fn}")
shutil.copy(f"{BRAND}/favicon.svg", f"{PUB}/favicon.svg")
for fn in os.listdir(BRAND):
    if fn.startswith("catat-") and fn.endswith(".svg"):
        shutil.copy(f"{BRAND}/{fn}", f"{PUB}/brand/{fn}")
print("png + web done")
