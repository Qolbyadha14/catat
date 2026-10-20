"""Shared geometry + builders for the catat logo.

Icon: filled outlines only (real holes via evenodd), so one-colour, dark and tiled versions all work.
Wordmark: monoline rounded letters drawn as stroked paths (one stroke width, round caps) so weight is editable.
Signature: 'by coreboylabs' outlined from Poppins Medium (SIL OFL).
"""
import math

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

EMERALD = "#059669"      # refined emerald: 3.8:1 on white, 4.7:1 on navy
NAVY = "#111827"
SLATE = "#64748B"
MINT = "#6EE7B7"
WHITE = "#FFFFFF"
LIGHT_TXT = "#F9FAFB"
SLATE_DARK = "#94A3B8"
PAPER = "#F3F4F6"


def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


# ------------------------------------------------------------------ geometry helpers
def rpoly(vs):
    """Closed polygon with per-vertex corner radius (vs = [(x, y, r), ...], clockwise on screen)."""
    n = len(vs)
    segs = []
    for i, (x, y, r) in enumerate(vs):
        px, py, _ = vs[i - 1]
        nx, ny, _ = vs[(i + 1) % n]
        if r <= 0:
            segs.append(((x, y), None, 0, 0))
            continue
        v1, v2 = (px - x, py - y), (nx - x, ny - y)
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1, u2 = (v1[0] / l1, v1[1] / l1), (v2[0] / l2, v2[1] / l2)
        th = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        d = r / math.tan(th / 2)
        t1 = (x + u1[0] * d, y + u1[1] * d)
        t2 = (x + u2[0] * d, y + u2[1] * d)
        cr = (x - px) * (ny - y) - (y - py) * (nx - x)
        segs.append((t1, t2, r, 1 if cr > 0 else 0))
    first = segs[0]
    start = first[0] if first[1] is None else first[1]
    out = [f"M{f(start[0])} {f(start[1])}"]
    for i in list(range(1, n)) + [0]:
        t1, t2, r, sw = segs[i]
        if t2 is None:
            out.append(f"L{f(t1[0])} {f(t1[1])}")
        else:
            out.append(f"L{f(t1[0])} {f(t1[1])}A{f(r)} {f(r)} 0 0 {sw} {f(t2[0])} {f(t2[1])}")
    out.append("Z")
    return "".join(out)


def rr(x, y, w, h, r):
    return rpoly([(x, y, r), (x + w, y, r), (x + w, y + h, r), (x, y + h, r)])


def _unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    return dx / L, dy / L


def _arc(A, B, C, bulge, h):
    sw = 1 if ((A[0] - C[0]) * (bulge[1] - C[1]) - (A[1] - C[1]) * (bulge[0] - C[0])) > 0 else 0
    return f"A{f(h)} {f(h)} 0 0 {sw} {f(B[0])} {f(B[1])}"


def check_outline(P0, P1, P2, w):
    """Filled outline of a 3-point polyline stroke with round caps and a round outer join."""
    h = w / 2
    d1, d2 = _unit(P0, P1), _unit(P1, P2)
    n1, n2 = (-d1[1], d1[0]), (-d2[1], d2[0])
    dot = n1[0] * n2[0] + n1[1] * n2[1]

    def chain(sg):
        a = (P0[0] + sg * h * n1[0], P0[1] + sg * h * n1[1])
        e = (P2[0] + sg * h * n2[0], P2[1] + sg * h * n2[1])
        inner = (sg * n1[0] * d2[0] + sg * n1[1] * d2[1]) > 0
        if inner:
            k = h / (1 + dot)
            m = (P1[0] + sg * (n1[0] + n2[0]) * k, P1[1] + sg * (n1[1] + n2[1]) * k)
            return a, [("L", m)], e
        j1 = (P1[0] + sg * h * n1[0], P1[1] + sg * h * n1[1])
        j2 = (P1[0] + sg * h * n2[0], P1[1] + sg * h * n2[1])
        bx, by = sg * (n1[0] + n2[0]), sg * (n1[1] + n2[1])
        bl = math.hypot(bx, by)
        bulge = (P1[0] + bx / bl * h, P1[1] + by / bl * h)
        return a, [("L", j1), ("A", j1, j2, bulge)], e

    aL, midL, eL = chain(+1)
    aR, midR, eR = chain(-1)
    out = [f"M{f(aL[0])} {f(aL[1])}"]
    for item in midL:
        if item[0] == "L":
            out.append(f"L{f(item[1][0])} {f(item[1][1])}")
        else:
            out.append(_arc(item[1], item[2], P1, item[3], h).replace("A", "A", 1))
            # arc ends at j2
    out.append(f"L{f(eL[0])} {f(eL[1])}")
    out.append(_arc(eL, eR, P2, (P2[0] + h * d2[0], P2[1] + h * d2[1]), h))
    # right chain, walked backwards
    if midR and midR[0][0] == "L" and len(midR) == 1:
        out.append(f"L{f(midR[0][1][0])} {f(midR[0][1][1])}")
    else:
        j1, j2 = midR[1][1], midR[1][2]
        out.append(f"L{f(j2[0])} {f(j2[1])}")
        # walk from j2 to j1 around P1 (reverse of the forward arc)
        bx, by = -(n1[0] + n2[0]), -(n1[1] + n2[1])
        bl = math.hypot(bx, by)
        bulge = (P1[0] + bx / bl * h, P1[1] + by / bl * h)
        out.append(_arc(j2, j1, P1, bulge, h))
    out.append(f"L{f(aR[0])} {f(aR[1])}")
    out.append(_arc(aR, aL, P0, (P0[0] - h * d1[0], P0[1] - h * d1[1]), h))
    out.append("Z")
    return "".join(out)


# ------------------------------------------------------------------ the icon
CHECK = ((92, 152), (116, 176), (164, 128))
CHECK_W = 24
CHECK_SMALL = ((90, 150), (114, 174), (166, 122))
CHECK_SMALL_W = 30


def mark(body, flap, small=False, bar=True):
    """Document mark in a 256 box (page 168x208, centred). Check and title bar are real holes."""
    if small:
        d = rpoly([(44, 24, 30), (152, 24, 6), (212, 84, 6), (212, 232, 30), (44, 232, 30)])
        d += check_outline(*CHECK_SMALL, CHECK_SMALL_W)
        return f'<path fill="{body}" fill-rule="evenodd" d="{d}"/>'
    d = rpoly([(44, 24, 28), (148, 24, 6), (148, 88, 6), (212, 88, 6), (212, 232, 28), (44, 232, 28)])
    d += check_outline(*CHECK, CHECK_W)
    if bar:
        d += rr(76, 54, 48, 14, 7)
    fl = rpoly([(156, 24, 3), (156, 80, 8), (212, 80, 3)])
    return f'<path fill="{body}" fill-rule="evenodd" d="{d}"/><path fill="{flap}" d="{fl}"/>'


# ------------------------------------------------------------------ wordmark (monoline, stroked)
WM_STROKE = 18
R_ = 39           # centre-line radius -> x-height 96 with 18 stroke
W_C, W_A, W_T = 85, 96, 78


def _c(x0):
    cx, dx = x0 + 48, R_ * math.cos(math.radians(45))
    return f"M{f(cx + dx)} {f(-48 - dx)}A{R_} {R_} 0 1 0 {f(cx + dx)} {f(-48 + dx)}"


def _a(x0):
    cx = x0 + 48
    return (f"M{f(cx - R_)} -48A{R_} {R_} 0 1 0 {f(cx + R_)} -48A{R_} {R_} 0 1 0 {f(cx - R_)} -48Z"
            f"M{f(cx + R_)} -87V-9")


def _t(x0):
    xs = x0 + 9
    tx = xs + 30
    return f"M{f(xs)} -87H{f(tx + 30)}M{f(tx)} -123V-33A24 24 0 0 0 {f(tx + 24)} -9"


def wordmark(color):
    xc = 0
    xa = xc + W_C + 8
    xt = xa + W_A + 14
    xa2 = xt + W_T + 8
    xt2 = xa2 + W_A + 14
    width = xt2 + W_T
    d = _c(xc) + _a(xa) + _t(xt) + _a(xa2) + _t(xt2)
    g = (f'<g fill="none" stroke="{color}" stroke-width="{WM_STROKE}" stroke-linecap="round" stroke-linejoin="round">'
         f'<path d="{d}"/></g>')
    return g, width


# ------------------------------------------------------------------ signature (outlined)
_font = TTFont("/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf")
_gs = _font.getGlyphSet()
_cmap = _font.getBestCmap()
_upm = _font["head"].unitsPerEm


def signature(text, size, x, base, color, track=0.05):
    s = size / _upm
    cur = x
    cmds = []
    for ch in text:
        g = _gs[_cmap[ord(ch)]]
        if ch != " ":
            pen = SVGPathPen(_gs, ntos=f)
            g.draw(TransformPen(pen, (s, 0, 0, -s, cur, base)))
            cmds.append(pen.getCommands())
        cur += g.width * s + track * size
    return f'<path fill="{color}" d="{"".join(cmds)}"/>', cur - track * size - x


# ------------------------------------------------------------------ lockups
SIG_TEXT = "by coreboylabs"
SIG_SIZE = 36


def doc(vb, body, title, desc, color=None):
    x, y, w, h = vb
    extra = f' color="{color}"' if color else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}"'
            f'{extra} role="img" aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>{body}</svg>\n')


def horizontal(icon_inner, wm_col, sig_col, with_sig=True, gap=40):
    xw = 212 + gap
    wm, ww = wordmark(wm_col)
    if with_sig:
        yw = 166
        sg, sw = signature(SIG_TEXT, SIG_SIZE, xw, yw + 49, sig_col)
        sig_g = f'<g id="signature">{sg}</g>'
    else:
        yw, sig_g = 194, ""
    body = (f'<g id="icon">{icon_inner}</g>'
            f'<g id="wordmark" transform="translate({f(xw)} {f(yw)})">{wm}</g>{sig_g}')
    vb = (20, 0, xw + ww + 24 - 20, 256)
    return body, vb
