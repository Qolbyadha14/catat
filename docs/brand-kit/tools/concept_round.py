import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from catat_lib import *
from directions import DIRECTIONS

OUT = "/home/claude/catat/concepts"
os.makedirs(OUT, exist_ok=True)


def lockup(icon_fn, box, colors, word_color=NAVY, sig_color=SLATE, with_sig=True):
    """Icon + catat (+ by coreboylabs). Returns (markup, width, height) with origin at 0,0."""
    parts, ww = wordmark_parts(0)
    sig_size = 34
    base_sig = 112 + 46
    top, bottom = -34, (base_sig + 9 if with_sig else 112)
    content_h = bottom - top
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = content_h / bh if with_sig else (146 / bh)
    iw = bw * k
    gap = 44 if with_sig else 36
    tx = iw + gap
    icon = f'<g transform="translate({f(-box[0] * k)} {f(-box[1] * k + (0 if with_sig else 0))}) scale({f(k)})">{icon_fn(colors)}</g>'
    word = f'<g transform="translate({f(tx)} {f(-top)})">{parts_markup(parts, word_color)}'
    if with_sig:
        d, _ = text_d("by coreboylabs", sig_size, 0, base_sig, FONT_MED)
        word += f'<path fill="{sig_color}" fill-rule="evenodd" d="{d}"/>'
    word += "</g>"
    return icon + word, tx + ww, content_h


def card(x, y, w, h, key, name, fn, box, colors):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="#fff" stroke="#E5E7EB"/>']
    ix = x + 36
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = 230 / bh
    out.append(f'<g transform="translate({f(x + w / 2 - bw * k / 2 - box[0] * k)} {f(y + 40 - box[1] * k)}) scale({f(k)})">{fn(colors)}</g>')
    mk, lw, lh = lockup(fn, box, colors)
    sc = (w - 72) / lw
    out.append(f'<g transform="translate({f(ix)} {f(y + 310)}) scale({f(sc)})">{mk}</g>')
    # small sizes
    sx = ix
    for s in (64, 32, 16):
        k2 = s / bh
        out.append(f'<g transform="translate({f(sx - box[0] * k2)} {f(y + 450 + 64 - s - box[1] * k2)}) scale({f(k2)})">{fn(colors)}</g>')
        out.append(f'<text x="{f(sx + s * bw / bh / 2)}" y="{y + 548}" font-family="Inter,sans-serif" font-size="12" fill="#6B7280" text-anchor="middle">{s}px</text>')
        sx += s * bw / bh + 30
    out.append(f'<text x="{ix}" y="{y + 586}" font-family="Inter,sans-serif" font-size="24" font-weight="700" fill="#111827">{key} · {name}</text>')
    return "".join(out)


W, Hh = 1600, 700
body = [f'<rect width="{W}" height="{Hh}" fill="#F3F4F6"/>',
        '<text x="60" y="70" font-family="Inter,sans-serif" font-size="38" font-weight="700" fill="#111827">catat - tiga arah ikon</text>']
cw = (W - 120 - 2 * 28) / 3
for i, (key, name, fn, box, colors) in enumerate(DIRECTIONS):
    body.append(card(60 + i * (cw + 28), 100, cw, 590, key, name, fn, box, colors))
open(f"{OUT}/directions.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{Hh}" viewBox="0 0 {W} {Hh}">{"".join(body)}</svg>\n')
print("ok")
