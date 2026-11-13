"""Gráficos de la ficha de Google Play a partir de store.json (junto a este script).

  python make_store.py [carpeta-de-la-ficha]

Lee de la carpeta de la ficha:
  store.json          colores, textos, icono y lista de capturas (titular + archivo en bruto)
  crudas/movil/*.jpg  capturas en bruto del emulador de móvil (1080x2400)
  crudas/tablet/*.jpg capturas en bruto del emulador de tablet (1600x2560)
y escribe:
  icono-512.png                    512x512, sin transparencia (Play aplica su máscara)
  grafico-destacado-1024x500.png   24 bits, sin transparencia
  capturas-movil/NN-*.png          1080x1920 (9:16)
  capturas-tablet/NN-*.png         1440x2560 (9:16)
Necesita Pillow. Fuentes: Segoe UI de Windows.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
CFG = json.loads((DIR / 'store.json').read_text(encoding='utf-8'))
FONT_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
FONT = 'C:/Windows/Fonts/segoeui.ttf'


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


TOP = rgb(CFG['bg_top'])
BOTTOM = rgb(CFG['bg_bottom'])
TEXT = rgb(CFG.get('text', '#ffffff'))
SUB = rgb(CFG.get('subtext', '#d0d0d8'))
ACCENT = rgb(CFG['accent'])


def gradient(w, h, top=TOP, bottom=BOTTOM, diagonal=False):
    g = Image.new('RGB', (256, 256))
    px = g.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510 if diagonal else y / 255
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return g.resize((w, h), Image.BICUBIC)


def glow(img, cx, cy, r, color, alpha=110):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r // 2)))


def wrap(draw, text, font, width):
    lines, line = [], ''
    for w in text.split():
        test = f'{line} {w}'.strip()
        if draw.textlength(test, font=font) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = w
    lines.append(line)
    if len(lines) == 2:  # dos líneas equilibradas en vez de una viuda al final
        words = text.split()
        best = min(range(1, len(words)), key=lambda k: max(draw.textlength(' '.join(words[:k]), font=font),
                                                           draw.textlength(' '.join(words[k:]), font=font)))
        lines = [' '.join(words[:best]), ' '.join(words[best:])]
    return lines


def rounded(im, radius):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im.convert('RGBA'), (0, 0), mask)
    return out


def shadow_under(img, box, radius, blur, alpha=150, offset=(0, 14)):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    ImageDraw.Draw(layer).rounded_rectangle([x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]],
                                            radius=radius, fill=(0, 0, 0, alpha))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def icon_art():
    """El icono a sangre (cuadrado, opaco)."""
    ic = CFG['icon']
    src = Image.open(DIR / ic['src']).convert('RGBA')
    if ic.get('crop'):
        src = src.crop(tuple(ic['crop']))
    if ic.get('mode') == 'foreground':
        # foreground adaptativo sobre color de fondo; 'scale' amplía el dibujo dentro de la zona segura
        bg = Image.new('RGBA', (1024, 1024), rgb(ic['bg']) + (255,))
        s = int(1024 * ic.get('scale', 1.0))
        fg = src.resize((s, s), Image.LANCZOS)
        bg.alpha_composite(fg, ((1024 - s) // 2, (1024 - s) // 2))
        return bg.convert('RGB')
    flat = Image.new('RGBA', src.size, rgb(ic.get('bg', '#000000')) + (255,))
    flat.alpha_composite(src)
    return flat.convert('RGB').resize((1024, 1024), Image.LANCZOS)


def make_icon():
    icon_art().resize((512, 512), Image.LANCZOS).save(DIR / 'icono-512.png', optimize=True)


def make_feature():
    W, H = 1024, 500
    img = gradient(W, H, diagonal=True).convert('RGBA')
    glow(img, 760, 250, 260, ACCENT, 70)
    d = ImageDraw.Draw(img)
    # captura del móvil asomando a la derecha, algo girada
    f = CFG['feature']
    if not f.get('shot'):
        # sin captura (p. ej. para no enseñar arte de terceros): el icono grande a la derecha
        big = rounded(icon_art().resize((300, 300), Image.LANCZOS), 66)
        shadow_under(img, (668, 100, 968, 400), 66, 24, 170, (0, 16))
        img.alpha_composite(big, (668, 100))
        return feature_text(img, f, icon=False)
    shot = Image.open(DIR / 'crudas' / 'movil' / f['shot']).convert('RGB')
    sw = 330
    shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
    shot = shot.crop((0, 0, sw, min(shot.height, 640)))
    frame = Image.new('RGBA', (sw + 20, shot.height + 20), (18, 18, 22, 255))
    frame = rounded(frame, 46)
    frame.alpha_composite(rounded(shot, 36), (10, 10))
    frame = frame.rotate(f.get('tilt', -8), resample=Image.BICUBIC, expand=True)
    fx, fy = 640, 48
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sh.alpha_composite(Image.new('RGBA', frame.size, (0, 0, 0, 170)), (fx + 10, fy + 24))
    a = frame.split()[3]
    mask = Image.new('L', img.size, 0)
    mask.paste(a, (fx + 10, fy + 24))
    shade = Image.new('RGBA', img.size, (0, 0, 0, 160))
    shade.putalpha(mask.filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(shade)
    img.alpha_composite(frame, (fx, fy))
    feature_text(img, f)


def feature_text(img, f, icon=True):
    """Icono pequeño (opcional) + nombre + lema a la izquierda, y guarda el gráfico destacado."""
    dy = 0
    if icon:
        ic = rounded(icon_art().resize((132, 132), Image.LANCZOS), 30)
        shadow_under(img, (64, 70, 196, 202), 30, 12, 120, (0, 8))
        img.alpha_composite(ic, (64, 70))
    else:
        dy = -70
    d = ImageDraw.Draw(img)
    name_font = ImageFont.truetype(FONT_BOLD, f.get('name_size', 76))
    d.text((60, 224 + dy), CFG['name'], font=name_font, fill=TEXT)
    sub = ImageFont.truetype(FONT, 30)
    y = 330 + dy
    for line in f['tagline']:
        d.text((64, y), line, font=sub, fill=SUB)
        y += 42
    img.convert('RGB').save(DIR / 'grafico-destacado-1024x500.png', optimize=True)


def framed(src, caption, out, W, H, side, radius, bezel):
    img = gradient(W, H).convert('RGBA')
    glow(img, W // 2, int(H * 0.62), int(W * 0.55), ACCENT, 55)
    d = ImageDraw.Draw(img)
    size = int(min(W, H) * 0.074)
    font = ImageFont.truetype(FONT_BOLD, size)
    lines = wrap(d, caption, font, W - int(W * 0.12))
    y = int(H * 0.055)
    for line in lines:
        tw = d.textlength(line, font=font)
        d.text(((W - tw) / 2, y), line, font=font, fill=TEXT)
        y += int(size * 1.25)
    shot = Image.open(src).convert('RGB')
    top = y + int(H * 0.035)
    avail_h = H - top + int(H * 0.25)  # el marco se sale por abajo: más pantalla y más grande
    scale = min((W - 2 * side) / shot.width, avail_h / shot.height)
    shot = shot.resize((int(shot.width * scale), int(shot.height * scale)), Image.LANCZOS)
    x = (W - shot.width) // 2
    box = (x - bezel, top - bezel, x + shot.width + bezel, top + shot.height + bezel)
    shadow_under(img, box, radius + bezel, 28, 170, (0, 18))
    body = rounded(Image.new('RGB', (box[2] - box[0], box[3] - box[1]), (14, 14, 17)), radius + bezel)
    img.alpha_composite(body, (box[0], box[1]))
    img.alpha_composite(rounded(shot, radius), (x, top))
    img.convert('RGB').save(out, optimize=True)


def make_shots():
    for kind, (W, H, side, radius, bezel) in {
        'movil': (1080, 1920, 110, 54, 14),
        'tablet': (1440, 2560, 150, 46, 18),
    }.items():
        out_dir = DIR / f'capturas-{kind}'
        out_dir.mkdir(exist_ok=True)
        for old in out_dir.glob('*.png'):
            old.unlink()
        for i, s in enumerate(CFG['shots'], 1):
            src = DIR / 'crudas' / kind / s['file']
            if not src.exists():
                print('falta', src)
                continue
            stem = Path(s['file']).stem.lstrip('0123456789-')
            dims = (W, H, side, radius, bezel)
            with Image.open(src) as probe:
                if probe.width > probe.height:  # captura apaisada (tablet en horizontal): lienzo 16:9
                    dims = (2560, 1440, 260, 40, 18)
            caption = s.get(f'caption_{kind}', s['caption'])
            framed(src, caption, out_dir / f'{i:02d}-{stem}.png', *dims)
            print(kind, i, s['file'])


if __name__ == '__main__':
    make_icon()
    make_shots()
    make_feature()
    print('ok', DIR)
