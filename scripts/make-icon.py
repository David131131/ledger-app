#!/usr/bin/env python3
"""
生成「做账」应用图标：
  靛蓝渐变圆角方块 + 白色账本卡片 + ¥金币 + 收入/支出箭头 + 趋势折线
输出：assets/icon.png（1024）与 assets/icon.icns（macOS 图标集）
用法：PYTHONPATH=.icon-tools python3 scripts/make-icon.py
"""

import os
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 1024
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    os.makedirs(ASSETS, exist_ok=True)

    # 1) 渐变背景（上左 #6366f1 -> 下右 #4338ca）
    grad = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    top, bottom = (99, 102, 241), (67, 56, 202)
    for y in range(S):
        gd.line([(0, y), (S, y)], fill=lerp(top, bottom, y / (S - 1)) + (255,))

    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=232, fill=255)

    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # 2) 底部投影
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([0, 18, S - 1, S + 17], radius=232, fill=(16, 24, 40, 110))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(45)))

    # 3) 渐变主体
    bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bg.paste(grad, (0, 0), mask)
    img.alpha_composite(bg)

    # 4) 顶部高光
    gloss = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse([90, 40, 480, 250], fill=(255, 255, 255, 42))
    img.alpha_composite(gloss.filter(ImageFilter.GaussianBlur(50)))

    # 5) 白色账本卡片（含投影）
    card_shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(card_shadow).rounded_rectangle([272, 284, 752, 764], radius=56, fill=(16, 24, 40, 62))
    img.alpha_composite(card_shadow.filter(ImageFilter.GaussianBlur(24)))

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([272, 272, 752, 752], radius=56, fill=(255, 255, 255, 255),
                        outline=(230, 233, 240, 255), width=6)

    # 6) ¥ 金币
    d.ellipse([308, 326, 488, 506], fill=(245, 158, 11, 255))
    d.ellipse([318, 336, 478, 496], fill=(251, 191, 36, 255),
              outline=(255, 255, 255, 70), width=6)
    font = ImageFont.truetype(FONT_BOLD, 128)
    d.text((398, 418), '¥', font=font, fill=(255, 255, 255, 255), anchor='mm')

    # 7) 收入（绿色向上）/ 支出（红色向下）箭头
    green, red = (16, 185, 129, 255), (239, 68, 68, 255)
    d.line([(596, 448), (596, 368)], fill=green, width=26)
    d.polygon([(596, 296), (548, 372), (644, 372)], fill=green)
    d.line([(676, 360), (676, 440)], fill=red, width=26)
    d.polygon([(676, 512), (628, 436), (724, 436)], fill=red)

    # 8) 趋势折线（含面积填充与数据点）
    pts = [(322, 640), (442, 592), (562, 632), (694, 532)]
    area = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(area).polygon([pts[0], *pts, pts[-1], (694, 672), (322, 672)],
                                 fill=(99, 102, 241, 70))
    img.alpha_composite(area)
    d.line(pts, fill=(79, 70, 229, 255), width=26, joint='curve')
    for p in pts:
        d.ellipse([p[0] - 19, p[1] - 19, p[0] + 19, p[1] + 19], fill=(79, 70, 229, 255))

    img.save(os.path.join(ASSETS, 'icon.png'))

    # 9) 构建 iconset -> icns
    iconset = os.path.join(ASSETS, 'icon.iconset')
    shutil.rmtree(iconset, ignore_errors=True)
    os.makedirs(iconset)
    specs = [
        ('icon_16x16.png', 16), ('icon_16x16@2x.png', 32),
        ('icon_32x32.png', 32), ('icon_32x32@2x.png', 64),
        ('icon_128x128.png', 128), ('icon_128x128@2x.png', 256),
        ('icon_256x256.png', 256), ('icon_256x256@2x.png', 512),
        ('icon_512x512.png', 512), ('icon_512x512@2x.png', 1024),
    ]
    for name, size in specs:
        img.resize((size, size), Image.LANCZOS).save(os.path.join(iconset, name))
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(ASSETS, 'icon.icns')],
                   check=True)
    shutil.rmtree(iconset, ignore_errors=True)
    print('OK:', sorted(os.listdir(ASSETS)))


if __name__ == '__main__':
    main()
