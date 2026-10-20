"""Build every catat brand asset from geometry (no fonts at runtime, no strokes, no live text)."""
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catat_lib import *  # noqa: F401,F403
from catat_lib import f

BRAND = "/home/claude/catat/brand"
PNG = f"{BRAND}/png"
WEB = f"{BRAND}/web"
for d in (BRAND, PNG, WEB):
    os.makedirs(d, exist_ok=True)

CUR = "currentColor"
LIGHT = dict(word=NAVY, sig=SLATE, mark=EMERALD)
DARK = dict(word="#F9FAFB", sig=SLATE_LIGHT, mark=EMERALD_BRIGHT)
MONO = dict(word=CUR, sig=CUR, mark=CUR)

# ------------------------------------------------------------------ the mark: "Struk Centang"
BOX = (54, 16, 202, 244)           # receipt slip, 148 x 228
BW, BH = BOX[2] - BOX[0], BOX[3] - BOX[1]


def receipt(l=54, r=202, top=16, valley=222, tip=244, n=3):
    w = (r - l) / n
    pts = [(l, top), (r, top), (r, valley)]
    for i in range(n):
        xr = r - i * w
        pts += [(xr - w / 2, tip), (xr - w, valley)]
    pts = pts[:-1] + [(l, valley)]
    rad = [26, 26, 0] + [4, 5] * n
    rad = rad[:len(pts)]
    rad[-1] = 0
    return rpoly(pts, rad)


def mark_d(small=False):
    if small:  # small-size cut: no ledger line, heavier check
        return receipt() + stroke_poly([(86, 100), (116, 130), (170, 76)], 32)
    return receipt() + stroke_poly([(90, 84), (116, 110), (164, 62)], 26) + stadium((88, 164), (168, 164), 18)


def mark_path(fill, small=False, pid=None):
    i = f' id="{pid}"' if pid else ""
    return f'<path{i} fill="{fill}" fill-rule="evenodd" d="{mark_d(small)}"/>'


def place(markup, k, x, y, box=BOX):
    """Scale a 256-canvas fragment by k so box's top-left lands at (x, y)."""
    return f'<g transform="translate({f(x - box[0] * k)} {f(y - box[1] * k)}) scale({f(k)})">{markup}</g>'


# ------------------------------------------------------------------ wordmark + signature
WORD_PARTS, WORD_W = wordmark_parts(0)
ASC = -34
SIG_SIZE, SIG_BASE = 34, 112 + 46
SIG_D, SIG_W = text_d("by coreboylabs", SIG_SIZE, 0, SIG_BASE, FONT_MED)


def wordmark_group(fill, gid="wordmark"):
    letters = {}
    out, n = [], 0
    for p in WORD_PARTS:
        pid = p[0]
        letter = pid.split("-")[0]
        letters.setdefault(letter, [])
    # group parts per letter occurrence (c a t a t): parts arrive in order
    order, cur, seq = [], [], 0
    idx, seen = 0, []
    buckets = []
    for p in WORD_PARTS:
        key = p[0].split("-")[0]
        if not buckets or buckets[-1][0] != key or (key in ("a", "t") and p[0] in [q[0] for q in buckets[-1][1]]):
            buckets.append((key, []))
        buckets[-1][1].append(p)
    g = [f'<g id="{gid}">']
    for i, (key, ps) in enumerate(buckets, 1):
        g.append(f'<g id="letter-{i}-{key}">' + parts_markup(ps, fill) + "</g>")
    g.append("</g>")
    return "".join(g)


def signature_path(fill, pid="signature"):
    return f'<path id="{pid}" fill="{fill}" fill-rule="evenodd" d="{SIG_D}"/>'


# ------------------------------------------------------------------ lockups
def logo_markup(pal, with_sig=True):
    """Returns (markup, width, height). Origin at 0,0; padded by PAD."""
    pad = 4
    top = ASC
    bottom = SIG_BASE + 9 if with_sig else 112
    content_h = bottom - top
    k = (content_h if with_sig else 146) / BH
    iw = BW * k
    gap = 44 if with_sig else 34
    tx = pad + iw + gap
    ty = pad - top
    icon = f'<g id="icon" transform="translate({f(pad - BOX[0] * k)} {f(pad - BOX[1] * k)}) scale({f(k)})">{mark_path(pal["mark"], small=not with_sig and False)}</g>'
    word = f'<g transform="translate({f(tx)} {f(ty)})">{wordmark_group(pal["word"])}'
    if with_sig:
        word += f'<g id="signature-group">{signature_path(pal["sig"])}</g>'
    word += "</g>"
    return icon + word, tx + WORD_W + pad, content_h + 2 * pad


def write_logo(name, pal, with_sig=True, title=None):
    mk, w, h = logo_markup(pal, with_sig)
    title = title or ("catat by coreboylabs" if with_sig else "catat")
    open(f"{BRAND}/{name}.svg", "w").write(svg_doc((0, 0, w, h), mk, title, (round(w), round(h))))
    return w, h


def write_mark(name, pal, small=False):
    fill = pal["mark"]
    open(f"{BRAND}/{name}.svg", "w").write(
        svg_doc((0, 0, BW, BH), f'<g transform="translate({-BOX[0]} {-BOX[1]})">{mark_path(fill, small, "mark")}</g>', "catat", (BW, BH)))


def write_wordmark(name, pal):
    m = 4
    body = f'<g transform="translate({m} {m - ASC})">{wordmark_group(pal["word"])}</g>'
    open(f"{BRAND}/{name}.svg", "w").write(
        svg_doc((0, 0, WORD_W + 2 * m, 146 + 2 * m), body, "catat", (round(WORD_W + 2 * m), 146 + 2 * m)))


# ------------------------------------------------------------------ app icons (tile)
TILE = EMERALD


def tile_icon(kfrac=0.74, rx=56, full_bleed=False, small=False, bg=TILE, fg=WHITE):
    k = kfrac * 256 / BH
    x = (256 - BW * k) / 2
    y = (256 - BH * k) / 2
    rect = f'<rect width="256" height="256"{"" if full_bleed else f" rx=\"{rx}\""} fill="{bg}"/>'
    return rect + place(mark_path(fg, small), k, x, y)


def write_icon(name, title="catat", **kw):
    open(f"{BRAND}/{name}.svg", "w").write(svg_doc((0, 0, 256, 256), tile_icon(**kw), title, (256, 256)))


write_logo("catat-logo", LIGHT)
write_logo("catat-logo-dark", DARK)
write_logo("catat-logo-mono", MONO)
write_logo("catat-logo-compact", LIGHT, with_sig=False)
write_logo("catat-logo-compact-dark", DARK, with_sig=False)
write_logo("catat-logo-compact-mono", MONO, with_sig=False)
write_mark("catat-mark", LIGHT)
write_mark("catat-mark-dark", DARK)
write_mark("catat-mark-mono", MONO)
write_mark("favicon", LIGHT, small=True)
write_wordmark("catat-wordmark", LIGHT)
write_wordmark("catat-wordmark-dark", DARK)
write_icon("catat-icon")
write_icon("catat-icon-maskable", kfrac=0.60, full_bleed=True)
write_icon("catat-icon-small", kfrac=0.80, small=True)
write_icon("apple-touch-icon", kfrac=0.70, full_bleed=True)
print("svg done")
