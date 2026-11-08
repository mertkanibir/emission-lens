"""Build the isolated Emission Lens vector kit and local review sheet.

Run from the repository root with the optional authoring tools documented in
branding/README.md. No application source, camera data or runtime is changed.
"""
from __future__ import annotations

import json
from pathlib import Path
from xml.etree import ElementTree as ET

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/public/brand"
BRANDING = ROOT / "branding"
GREEN = "#058247"
INK = "#24392E"
CREAM = "#F1E7D8"
PANEL = "#FFF9F0"
WHITE = "#FFFCF6"
MARK = (
    "M8 28C9.5 17 17 9.5 28 8V20C23.9 21.1 21.1 23.9 20 28Z "
    "M36 8C47 9.5 54.5 17 56 28H44C42.9 23.9 40.1 21.1 36 20Z "
    "M56 36C54.5 47 47 54.5 36 56V44C40.1 42.9 42.9 40.1 44 36Z "
    "M28 56C17 54.5 9.5 47 8 36H20C21.1 40.1 23.9 42.9 28 44Z "
    "M32 24L40 32L32 40L24 32Z"
)


def svg(body: str, width: float, height: float, description: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}" height="{height:g}" '
        f'viewBox="0 0 {width:g} {height:g}" role="img" aria-labelledby="title desc">\n'
        '<title id="title">Emission Lens</title>\n'
        f'<desc id="desc">{description}</desc>\n{body}\n</svg>\n'
    )


def mark(color: str) -> str:
    return f'<path fill="{color}" d="{MARK}"/>'


def badge() -> str:
    return f'<rect width="64" height="64" rx="14" fill="{GREEN}"/>{mark(WHITE)}'


def wordmark_paths() -> tuple[list[tuple[str, str]], float]:
    font = TTFont(ROOT / "frontend/src/app/fonts/manrope.ttf")
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": 800}, inplace=False)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = 64 / font["head"].unitsPerEm
    cursor = 0.0
    pieces = []
    ntos = lambda value: f"{value:.2f}".rstrip("0").rstrip(".")
    for index, char in enumerate("Emission Lens"):
        glyph_name = cmap[ord(char)]
        pen = SVGPathPen(glyphs, ntos=ntos)
        glyphs[glyph_name].draw(pen)
        path = pen.getCommands()
        if path:
            pieces.append(("Lens" if index >= 9 else "Emission", f'<path transform="translate({80 + cursor:.3f} 66) scale({scale:.6f} {-scale:.6f})" d="{path}"/>'))
        cursor += glyphs[glyph_name].width * scale - (1.6 if char != " " else 0)
    return pieces, cursor + 88


def lockup(pieces: list[tuple[str, str]], width: float, variant: str) -> str:
    color = WHITE if variant == "cream" else INK if variant == "mono" else GREEN
    text_color = WHITE if variant == "cream" else INK
    body = f'<g transform="translate(0 8)">{mark(color)}</g>'
    for word, path in pieces:
        body += f'<g fill="{GREEN if variant == "primary" and word == "Lens" else text_color}">{path}</g>'
    return svg(body, width, 80, "Junction Lens mark beside the Emission Lens wordmark, set in outlined Manrope ExtraBold.")


def sheet(pieces: list[tuple[str, str]], width: float) -> str:
    primary = lockup(pieces, width, "primary")
    reversed_logo = lockup(pieces, width, "cream")
    # Embed only vector groups; titles and IDs belong to the individual assets.
    def contents(asset: str) -> str:
        node = ET.fromstring(asset)
        return "".join(ET.tostring(child, encoding="unicode") for child in node if child.tag.rsplit("}", 1)[-1] not in {"title", "desc"})
    body = f'<rect width="1200" height="960" fill="{CREAM}"/>'
    body += f'<text x="64" y="61" fill="{INK}" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2">EMISSION LENS / IDENTITY KIT</text>'
    body += f'<text x="64" y="115" fill="{INK}" font-family="Arial,sans-serif" font-size="38" font-weight="700">A junction. A clearer perspective.</text>'
    body += f'<rect x="48" y="150" width="1104" height="232" rx="16" fill="{PANEL}"/>'
    body += f'<g transform="translate(98 218) scale(1.52)">{contents(primary)}</g>'
    body += f'<text x="72" y="356" fill="{INK}" font-family="Arial,sans-serif" font-size="15">Primary lockup · transparent SVG · outlined lettering</text>'
    body += f'<rect x="48" y="406" width="690" height="192" rx="16" fill="{INK}"/>'
    body += f'<g transform="translate(84 450) scale(1.05)">{contents(reversed_logo)}</g>'
    body += f'<text x="72" y="572" fill="{WHITE}" font-family="Arial,sans-serif" font-size="15">Reversed on forest ink</text>'
    body += f'<rect x="762" y="406" width="390" height="192" rx="16" fill="{PANEL}"/>'
    body += f'<g transform="translate(808 428) scale(1.6)">{mark(INK)}</g>'
    body += f'<g transform="translate(992 440) scale(1.25)">{badge()}</g>'
    body += f'<text x="786" y="572" fill="{INK}" font-family="Arial,sans-serif" font-size="15">Single color / app icon</text>'
    body += f'<text x="64" y="653" fill="{INK}" font-family="Arial,sans-serif" font-size="20" font-weight="700">Small-size checks</text>'
    x = 64
    for size in (16, 24, 32, 48, 64):
        body += f'<g transform="translate({x} 684) scale({size / 64})">{badge()}</g>'
        body += f'<text x="{x}" y="782" fill="{INK}" font-family="Arial,sans-serif" font-size="14">{size} px</text>'
        x += 116
    body += f'<g transform="translate(696 688) scale(.5)">{contents(primary)}</g>'
    body += f'<text x="696" y="782" fill="{INK}" font-family="Arial,sans-serif" font-size="14">Sidebar / compact lockup</text>'
    for x, color, label in ((64, GREEN, "Forest / #058247"), (340, INK, "Ink / #24392E"), (616, CREAM, "Cream / #F1E7D8"), (892, PANEL, "Panel / #FFF9F0")):
        body += f'<rect x="{x}" y="830" width="244" height="40" rx="6" fill="{color}" stroke="{INK}" stroke-opacity=".15"/>'
        body += f'<text x="{x}" y="902" fill="{INK}" font-family="Arial,sans-serif" font-size="15">{label}</text>'
    return svg(body, 1200, 960, "Review sheet showing the Junction Lens identity, reversed and monochrome variants, and small-size checks.")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pieces, width = wordmark_paths()
    assets = {
        "mark.svg": svg(mark(GREEN), 64, 64, "Four curved intersection corners frame a central observation diamond."),
        "mark-cream.svg": svg(mark(WHITE), 64, 64, "Cream Junction Lens mark for dark backgrounds."),
        "mark-mono.svg": svg(mark(INK), 64, 64, "Single-color Junction Lens mark."),
        "wordmark.svg": lockup(pieces, width, "primary"),
        "wordmark-cream.svg": lockup(pieces, width, "cream"),
        "wordmark-mono.svg": lockup(pieces, width, "mono"),
        "favicon.svg": svg(badge(), 64, 64, "Cream Junction Lens mark on a forest-green rounded square."),
    }
    for name, value in assets.items():
        ET.fromstring(value)
        if "<text" in value or "http://" in value.replace('xmlns="http://www.w3.org/2000/svg"', ""):
            raise ValueError("Production logos must be self-contained outlined vectors.")
        (OUTPUT / name).write_text(value)
    for size in (16, 32, 180, 192, 512):
        cairosvg.svg2png(bytestring=assets["favicon.svg"].encode(), write_to=str(OUTPUT / f"icon-{size}.png"), output_width=size, output_height=size)
    Image.open(OUTPUT / "icon-32.png").save(OUTPUT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])
    preview = sheet(pieces, width)
    (BRANDING / "preview.svg").write_text(preview)
    cairosvg.svg2png(bytestring=preview.encode(), write_to=str(BRANDING / "preview.png"))
    (BRANDING / "tokens.json").write_text(json.dumps({
        "name": "Junction Lens", "team": ["Mert", "Carter"],
        "colors": {"forest": GREEN, "ink": INK, "cream": CREAM, "panel": PANEL, "reversed": WHITE},
        "wordmark": {"family": "Manrope", "weight": 800, "outlined": True},
        "clear_space": "At least 8 units on the 64-unit mark grid; keep its built-in padding.",
        "minimum_sizes": {"standalone_mark_px": 24, "badge_favicon_px": 16, "horizontal_lockup_width_px": 168},
        "status": "Review kit; not activated in the application."
    }, indent=2) + "\n")
    print(f"Built {len(assets)} SVGs, 5 icon PNGs and a 1200 × 960 review sheet.")


if __name__ == "__main__":
    main()
