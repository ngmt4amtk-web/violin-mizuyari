# 生成した部品の絵（images_原本/）を、ゲームの枠に合わせて images/ へ仕上げる。
# 使い方: uv run --with pillow python 試験/shiage.py <原本フォルダ> <出力フォルダ>
# - 植物（seed・sprout・stem・bud・flower）: 透明な余白を切り、根元（いちばん下の行の中央）が絵の左右中央にくるよう左右に足す。
# - can: 注ぎ口の先（右端）が、正方形の 95% / 67% の位置にくるよう縮めて置く（水の粒の出る位置 app.html #drops に合わせる）。
# - drop: 余白を切るだけ。soil・bg: 大きさだけそろえる。
import sys, pathlib
from PIL import Image

src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
A = 16  # これより濃いアルファを「描いてある」とみなす

def trim(im):
    a = im.getchannel('A').point(lambda v: 255 if v > A else 0)
    bb = a.getbbox()
    return im.crop(bb) if bb else im

def limit(im, side):
    s = side / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS) if s < 1 else im

def base_x(im):
    # いちばん下から数行の、描いてある画素の左右の中央
    a = im.getchannel('A'); w, h = im.size; xs = []
    for y in range(h - 1, max(-1, h - 1 - max(3, h // 40)), -1):
        row = [x for x in range(w) if a.getpixel((x, y)) > A]
        if row: xs.append((row[0] + row[-1]) / 2)
    return sum(xs) / len(xs) if xs else w / 2

def plant(name, side=1200):
    im = trim(Image.open(src / name).convert('RGBA'))
    bx = base_x(im); w, h = im.size
    half = max(bx, w - bx); W = int(round(half * 2))
    c = Image.new('RGBA', (W, h), (0, 0, 0, 0)); c.paste(im, (int(round(half - bx)), 0), im)
    c = limit(c, side); c.save(out / name, optimize=True)
    return c.size

def can(name='can.png', S=800):
    # ジョウロ全体を正方形に収め（切らない）、注ぎ口の先（右端）を右の端の近くに置く。
    # ゲームは傾ける時に (60%, 25%) を中心に24度回すので、回した後の注ぎ口の先を出す。
    # この値を app.html と yubi.src.html の「#canBox.img-ok ~ #drops」の left / top に書く。
    import math
    im = trim(Image.open(src / name).convert('RGBA'))
    a = im.getchannel('A'); w, h = im.size
    ys = [y for y in range(h) if any(a.getpixel((x, y)) > A for x in range(max(0, w - max(3, w // 60)), w))]
    ty = (ys[0] + ys[-1]) / 2 if ys else h * 0.6
    k = 0.90 * S / max(w, h)
    nw, nh = round(w * k), round(h * k)
    im2 = im.resize((nw, nh), Image.LANCZOS)
    left = round(0.97 * S - nw); top = round((S - nh) / 2)
    c = Image.new('RGBA', (S, S), (0, 0, 0, 0)); c.paste(im2, (left, top), im2)
    c.save(out / name, optimize=True)
    tx, tyf = 0.97, (top + ty * k) / S
    r = math.radians(24); cx, cy = 0.60, 0.25
    rx = cx + (tx - cx) * math.cos(r) - (tyf - cy) * math.sin(r)
    ry = cy + (tx - cx) * math.sin(r) + (tyf - cy) * math.cos(r)
    return (S, S), {'tip': (round(tx * 100, 1), round(tyf * 100, 1)), 'drops_left_top_pct': (round(rx * 100, 1), round(ry * 100, 1))}

def simple(name, side, do_trim=True):
    im = Image.open(src / name)
    im = im.convert('RGBA') if im.mode != 'RGB' else im
    if do_trim and im.mode == 'RGBA': im = trim(im)
    im = limit(im, side); im.save(out / name, optimize=True)
    return im.size

for n in ['seed.png', 'sprout.png', 'stem.png', 'bud.png', 'flower.png']:
    if (src / n).exists(): print(n, plant(n))
if (src / 'can.png').exists(): print('can.png', can())
if (src / 'drop.png').exists(): print('drop.png', simple('drop.png', 160))
def soil(name='soil.png'):
    # 土の山は CSS の丸い枠で切り抜くので、絵は「全部が土」の横長の帯にする（上の透明な角を除く）
    im = Image.open(src / name).convert('RGBA'); a = im.getchannel('A'); w, h = im.size
    y0 = next((y for y in range(h) if min(a.crop((0, y, w, y + 1)).getdata()) > 200), 0)
    y0 += max(4, h // 100)
    hh = min(h - y0, round(w / 4))
    c = im.crop((0, y0, w, y0 + hh)).convert('RGB')
    c = limit(c, 1400); c.save(out / name, optimize=True)
    return c.size, {'y0': y0}

if (src / 'soil.png').exists(): print('soil.png', soil())
if (src / 'bg.png').exists(): print('bg.png', simple('bg.png', 1600, do_trim=False))
