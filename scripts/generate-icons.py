from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parents[1] / "public"
PRIMARY = "#6941e0"
PAPER = "#f7f4ff"
INK = "#29223b"
MUTED = "#6e687b"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


size = 1024
mark = Image.new("RGB", (size, size), PRIMARY)
draw = ImageDraw.Draw(mark)
draw.rounded_rectangle((60, 60, 964, 964), radius=240, fill=PRIMARY)
draw.rectangle((230, 320, 794, 744), fill="white")
draw.line([(230, 320), (512, 552), (794, 320)], fill=PRIMARY, width=60, joint="curve")
draw.line([(382, 744), (512, 616), (642, 744)], fill=PRIMARY, width=49, joint="curve")

mark.save(OUT / "brand-mark-1024.png")
for edge, filename in [(96, "favicon-96.png"), (180, "apple-touch-icon.png")]:
    mark.resize((edge, edge), Image.Resampling.LANCZOS).save(OUT / filename)
mark.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
    '<rect width="40" height="40" rx="12" fill="#6941e0"/>'
    '<path d="M9 13h22v16H9z" fill="white"/>'
    '<path d="m9 13 11 9 11-9m-16 16 5-5 5 5" fill="none" '
    'stroke="#6941e0" stroke-width="2.5"/></svg>'
)
(OUT / "brand-mark.svg").write_text(svg, encoding="utf-8")

card = Image.new("RGB", (1200, 630), PAPER)
card_draw = ImageDraw.Draw(card)
regular_font = "/System/Library/Fonts/Supplemental/Arial.ttf"
bold_font = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
card_draw.text((72, 62), "Muse Invite Hub", font=font(bold_font, 30), fill=PRIMARY)

title = "Muse invite codes."
title_size = 76
title_font = font(bold_font, title_size)
while card_draw.textbbox((0, 0), title, font=title_font)[2] > 780:
    title_size -= 1
    title_font = font(bold_font, title_size)
card_draw.text((70, 185), title, font=title_font, fill=INK)
card_draw.text(
    (76, 310),
    "Copy a free code. Get more Muse tokens.",
    font=font(regular_font, 28),
    fill=MUTED,
)
card_draw.text((76, 539), "museinvitehub.org", font=font(regular_font, 22), fill=MUTED)
card.paste(mark.resize((210, 210), Image.Resampling.LANCZOS), (894, 207))
card.save(OUT / "social-card.png")

print(
    "Generated favicon.ico (16/32/48), PNG 96, Apple 180, source 1024, SVG, "
    "and 1200x630 social card"
)
