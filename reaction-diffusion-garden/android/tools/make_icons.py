#!/usr/bin/env python3
"""Draw the launcher icon at every density: a dark rounded square with four glowing dishes.

Needs Pillow (pip install pillow). Writes android/res/mipmap-*/ic_launcher.png.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

RES = pathlib.Path(__file__).resolve().parent.parent / 'res'
BLOBS = [((0.33, 0.36), 0.17, (127, 214, 184)), ((0.66, 0.42), 0.13, (242, 163, 58)),
         ((0.42, 0.68), 0.11, (214, 90, 140)), ((0.70, 0.70), 0.09, (120, 160, 240))]


def icon(size):
    S = size * 4  # draw big, then downsample for smooth edges
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=(7, 19, 31, 255))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for (cx, cy), rad, col in BLOBS:
        R = rad * S * 1.6
        gd.ellipse([cx * S - R, cy * S - R, cx * S + R, cy * S + R], fill=col + (110,))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(S * 0.06)))
    for (cx, cy), rad, col in BLOBS:
        R = rad * S
        ImageDraw.Draw(img).ellipse([cx * S - R, cy * S - R, cx * S + R, cy * S + R], fill=col + (255,))
        hr = R * 0.45
        hx, hy = cx * S - R * 0.35, cy * S - R * 0.4
        hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(hl).ellipse([hx - hr, hy - hr * 0.7, hx + hr, hy + hr * 0.7], fill=(255, 255, 255, 120))
        img = Image.alpha_composite(img, hl.filter(ImageFilter.GaussianBlur(S * 0.012)))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    for folder, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        target = RES / f'mipmap-{folder}'
        target.mkdir(parents=True, exist_ok=True)
        icon(px).save(target / 'ic_launcher.png')
    print('icons written to', RES)
