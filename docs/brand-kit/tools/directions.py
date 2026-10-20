"""Three icon directions for catat, each on a 256 canvas. markup(colors) -> svg fragments."""
from catat_lib import *


# ---------------------------------------------------------------- A  Lembar Centang (folded page + check cut-out)
def A_parts():
    body = rpoly([(44, 20), (144, 20), (144, 88), (212, 88), (212, 236), (44, 236)], [26, 8, 8, 8, 26, 26])
    chk = stroke_poly([(84, 154), (114, 184), (174, 124)], 28)
    flap = rpoly([(152, 20), (212, 80), (152, 80)], 6)
    return body + chk, flap


def A(c):
    page, flap = A_parts()
    return (f'<path fill="{c["main"]}" fill-rule="evenodd" d="{page}"/>'
            f'<path fill="{c["accent"]}" d="{flap}"/>')


A_BOX = (44, 20, 212, 236)


# ---------------------------------------------------------------- B  C-Centang (letter c that turns into a check)
def B(c):
    cx, cy, r, w = 112, 124, 68, 30
    p0 = P(cx, cy, r, 135)
    v = (p0[0] + 40, p0[1] + 40)
    e = (v[0] + 120, v[1] - 120)
    return (f'<path fill="{c["main"]}" d="{band(cx, cy, r, w, 135, 315)}"/>'
            f'<path fill="{c["main"]}" d="{stadium(p0, v, w)}"/>'
            f'<path fill="{c["accent"]}" d="{stadium(v, e, w)}"/>')


B_BOX = (29, 41, 239, 227)


# ---------------------------------------------------------------- C  Pita Catatan (bookmark-note + check cut-out)
def C(c):
    body = rpoly([(60, 16), (196, 16), (196, 240), (128, 192), (60, 240)], [26, 26, 12, 10, 12])
    chk = stroke_poly([(96, 100), (120, 124), (162, 80)], 26)
    return f'<path fill="{c["main"]}" fill-rule="evenodd" d="{body + chk}"/>'


C_BOX = (60, 16, 196, 240)

DIRECTIONS = [
    ("A", "Lembar Centang", A, A_BOX, {"main": EMERALD, "accent": NAVY}),
    ("B", "C-Centang", B, B_BOX, {"main": EMERALD, "accent": NAVY}),
    ("C", "Pita Catatan", C, C_BOX, {"main": EMERALD, "accent": NAVY}),
]


# ---------------------------------------------------------------- D  Struk Centang (receipt slip, saw-tooth edge + check cut-out)
def _receipt(l=54, r=202, top=16, valley=222, tip=244, n=3):
    w = (r - l) / n
    pts = [(l, top), (r, top), (r, valley)]
    for i in range(n):
        xr = r - i * w
        pts += [(xr - w / 2, tip), (xr - w, valley)]
    rad = [26, 26, 0] + [4, 5] * n
    rad[2 + 2 * n] = 0  # last valley sits on the left edge: keep the edge straight
    return rpoly(pts[:-1] + [(l, valley)], rad[:len(pts)])


def D1(c):
    chk = stroke_poly([(90, 104), (118, 132), (168, 82)], 28)
    return f'<path fill="{c["main"]}" fill-rule="evenodd" d="{_receipt() + chk}"/>'


def D2(c):
    chk = stroke_poly([(90, 84), (116, 110), (164, 62)], 26)
    bar = stadium((88, 164), (168, 164), 18)
    return f'<path fill="{c["main"]}" fill-rule="evenodd" d="{_receipt() + chk + bar}"/>'


D_BOX = (54, 16, 202, 244)
