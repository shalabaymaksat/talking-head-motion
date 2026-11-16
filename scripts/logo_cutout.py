#!/usr/bin/env python3
"""Дөңгелек логотиптің (мыс. Instagram аватары скриншоты) бір түсті фонын алып тастау.

  python3 scripts/logo_cutout.py in.png template/public/logos/out.png

Фон түсін сол жақ жоғарғы бұрыштан алады, логотип шеңберін табады да, шетін
жұмсартылған (antialiased) мөлдір PNG қып қияды. Шеңберден тыс фон — мөлдір.
"""
import sys

import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert("RGB")).astype(float)
bg = a[2, 2]
fg = np.abs(a - bg).sum(2) > 60
ys, xs = np.nonzero(fg)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
r = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4 - 1.5  # фонмен араласқан шеттен 1.5 px ішке
Y, X = np.mgrid[: a.shape[0], : a.shape[1]]
alpha = np.clip(r - np.hypot(X - cx, Y - cy) + 0.5, 0, 1)
im = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8))
im.crop((int(cx - r - 1), int(cy - r - 1), int(cx + r + 2), int(cy + r + 2))).save(dst)
print("saved", dst)
