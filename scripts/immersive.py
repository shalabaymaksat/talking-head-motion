#!/usr/bin/env python3
"""Immersive (binaural) SFX — timeline.json-нан автоматты.

Әр анимация элементіне өз дыбысы синтезделіп, экрандағы орнына қарай басты айнала
кеңістікке қойылады, сосын дауыспен араласады:

  python3 scripts/immersive.py template/src/timeline.json voice.wav out/mix.wav [--sfx-only out/sfx.wav]

Нағыз Dolby Atmos — объектілік формат, Dolby энкодерін керек етеді. Мұнда соның
құлаққаптағы әсерін binaural стереомен береміз:
  • ITD — дыбыс құлақтарға әр уақытта жетеді (Woodworth, фракциялық кідіріс);
  • ILD + бас көлеңкесі — алыс құлаққа жоғары жиілік әлсіз жетеді;
  • қозғалатын көздер — whoosh беттен элементке қарай ұшады, riser басты айналады;
  • кеңістік — синтезделген бөлме IR (ерте шағылыстар + декорреляцияланған құйрық);
  • sub-қабат — hero санауыштағы impact-та ортадағы төмен жиілік;
  • ducking — фондық қабаттар (riser, pad) дауыс кезінде ~6 дБ басылады.
Барлық дыбыс — синтез: сырттан sample, лицензия мәселесі жоқ. Тек numpy керек.
"""
import argparse
import json
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(11)

# ======================= DSP =======================


def fftconv(a, b):
    n = len(a) + len(b) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(a, N) * np.fft.rfft(b, N), N)[:n]


def lp_kernel(fc, taps=255):
    t = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * fc / SR * t) * np.hanning(taps)
    return h / h.sum()


LP_SHADOW = lp_kernel(1500)


def lowpass(x, fc, taps=255):
    return np.convolve(x, lp_kernel(fc, taps), mode="same")


def highpass(x, fc, taps=255):
    return x - lowpass(x, fc, taps)


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


def db(v):
    return 10 ** (v / 20)


def tt(n):
    return np.arange(n) / SR


def adsr(n, a, tau):
    t = tt(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / tau)


# ======================= Binaural =======================
HEAD_R, C_SOUND = 0.0875, 343.0


def spatialize(mono, az_deg, dist=1.0):
    """mono → binaural стерео. az_deg: скаляр не әр сэмплге массив (−90 сол … +90 оң)."""
    n = len(mono)
    az = np.radians(np.clip(np.broadcast_to(np.asarray(az_deg, float), (n,)), -90, 90))
    s = np.sin(np.abs(az))
    itd = HEAD_R / C_SOUND * (np.abs(az) + s) * SR
    idx = np.arange(n, dtype=float)
    far = np.interp(idx - itd, idx, mono, left=0.0)
    near = mono.copy()
    far_lo = np.convolve(far, LP_SHADOW, "same")
    far = far_lo + (far - far_lo) * (1 - 0.72 * s)  # бас көлеңкесі
    near_lo = np.convolve(near, LP_SHADOW, "same")
    near = (near_lo + (near - near_lo) * (1 + 0.25 * s)) * (1 + 0.18 * s)
    far *= 1 - 0.32 * s
    L = np.where(az <= 0, near, far)
    R = np.where(az <= 0, far, near)
    return np.stack([L, R], 1) / max(dist, 0.3)


def make_ir(rt60=1.25, length=1.7):
    n = int(length * SR)
    t = tt(n)
    ir = np.zeros((n, 2))
    for ch in range(2):
        noise = rng.standard_normal(n)
        lo = lowpass(noise, 1800, 127)
        tail = lo * np.exp(-6.9 * t / rt60) + 0.6 * (noise - lo) * np.exp(-6.9 * t / (rt60 * 0.45))
        ir[:, ch] = tail * np.minimum(1, t / 0.025) * 0.22
    for ms, gl, gr in [(7, .55, .3), (11, .3, .5), (17, .42, .2), (23, .2, .44), (31, .3, .26), (43, .18, .24), (57, .16, .12)]:
        i = int(ms * SR / 1000)
        ir[i] += (gl, gr)
    return ir / np.abs(ir).sum(0).max() * 6


# ======================= Дыбыс дизайны =======================


def bandnoise_sweep(dur, f0, f1, bw_oct=0.9, curve="bell"):
    n = int(dur * SR)
    nfft, hop = 2048, 256
    noise = rng.standard_normal(n + nfft)
    win = np.hanning(nfft)
    out = np.zeros(len(noise))
    wsum = np.zeros(len(noise))
    lf = np.log2(np.maximum(np.fft.rfftfreq(nfft, 1 / SR), 20))
    for k in range(1 + (len(noise) - nfft) // hop):
        p = min(1, k * hop / n)
        fc = f0 * (f1 / f0) ** ((np.sin(np.pi * p) ** 0.8) if curve == "bell" else p)
        S = np.fft.rfft(noise[k * hop:k * hop + nfft] * win)
        S *= np.exp(-0.5 * ((lf - np.log2(fc)) / (bw_oct / 2)) ** 2)
        out[k * hop:k * hop + nfft] += np.fft.irfft(S, nfft) * win
        wsum[k * hop:k * hop + nfft] += win ** 2
    return (out / np.maximum(wsum, 1e-3))[:n]


def whoosh(dur=0.55, f0=350, f1=3200, peak_at=0.62):
    x = bandnoise_sweep(dur, f0, f1)
    p = np.linspace(0, 1, len(x))
    env = np.where(p < peak_at, (p / peak_at) ** 2.2, ((1 - p) / (1 - peak_at)) ** 1.6)
    return norm(x * env * (1 + 0.18 * np.sin(2 * np.pi * 23 * tt(len(x))) * env))


def swish(dur=0.28):
    return whoosh(dur, 900, 5200, 0.55)


def pop(f0=950, f1=240, dur=0.12):
    n = int(dur * SR)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.016)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * adsr(n, 0.0015, 0.035)
    click = highpass(rng.standard_normal(n), 2500, 63) * np.exp(-t / 0.002) * 0.5
    bubble = np.sin(2 * np.pi * np.cumsum(f * 2.02) / SR) * adsr(n, 0.001, 0.015) * 0.25
    return norm(body + click + bubble)


def tick(f=2600, dur=0.03):
    n = int(dur * SR)
    t = tt(n)
    return norm(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.005) + highpass(rng.standard_normal(n), 3000, 63) * np.exp(-t / 0.0025))


def bell(f=1318.5, dur=1.4, detune=1.0):
    n = int(dur * SR)
    t = tt(n)
    x = sum(a * np.sin(2 * np.pi * f * m * detune * t) * np.exp(-t / tau)
            for m, a, tau in [(1, 1, .55), (2.0, .4, .3), (2.76, .25, .22), (4.07, .12, .12), (5.4, .06, .08)])
    return norm(x * np.minimum(1, t / 0.002))


def stereo_bell(f, dur=1.4, wide=0.004):
    """сол/оң құлаққа сәл басқа тюнинг → кең, «ауада тұрған» шыңғыр."""
    return np.stack([bell(f, dur, 1 - wide), bell(f, dur, 1 + wide)], 1)


def impact(dur=2.2):
    n = int(dur * SR)
    t = tt(n)
    f = 38 + 120 * np.exp(-t / 0.045)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    crack = lowpass(rng.standard_normal(n), 5000, 63) * np.exp(-t / 0.035)
    body = np.tanh(3 * np.sin(2 * np.pi * np.cumsum(f * 2.5) / SR)) * np.exp(-t / 0.12) * 0.5
    return norm((sub * 1.2 + crack * 0.9 + body) * np.minimum(1, t / 0.0015)), norm(sub)


def riser(dur=1.5):
    n = int(dur * SR)
    p = tt(n) / dur
    nz = bandnoise_sweep(dur, 250, 6000, 1.2, curve="up")
    tone = np.sin(2 * np.pi * np.cumsum(180 * 4.5 ** p) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(4 + 22 * p ** 2) / SR))
    x = (norm(nz) * 0.8 + tone * 0.45) * p ** 2.4
    x[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))
    return norm(x)


def mouse_click():
    n = int(0.12 * SR)
    x = np.zeros(n)
    for t0, g in [(0.0, 1.0), (0.065, 0.6)]:
        i = int(t0 * SR)
        tl = tt(n - i)
        x[i:] += g * (highpass(rng.standard_normal(n - i), 1800, 63) * np.exp(-tl / 0.0018) + 0.4 * np.sin(2 * np.pi * 3200 * tl) * np.exp(-tl / 0.004))
    return norm(x)


def glitch(dur=0.42):
    n = int(dur * SR)
    t = tt(n)
    sq = np.round((np.sign(np.sin(2 * np.pi * 92 * t)) * 0.6 + np.sign(np.sin(2 * np.pi * 139 * t)) * 0.4) * 4) / 4
    gate = (np.floor(t / 0.032) % 3 != 1).astype(float)
    gate[: int(0.1 * SR)] = 1
    return norm(lowpass(sq + lowpass(rng.standard_normal(n), 3000, 63) * 0.3, 2400, 127) * gate * adsr(n, 0.003, 0.22))


def power_down(dur=0.9):
    n = int(dur * SR)
    t = tt(n)
    f = 620 * (0.08 ** (t / dur) ** 0.7)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    return norm(lowpass(np.tanh(1.6 * x), 3000, 127) * np.minimum(1, t / 0.01) * (1 - t / dur) ** 0.6)


def pad(dur, freqs=(110.0, 164.81, 246.94, 261.63, 329.63)):
    """кідіріс/кері санақ кезіндегі жұмсақ аккорд (Am add9), баяу «тыныстайды»."""
    n = int(dur * SR)
    t = tt(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for k, f in enumerate(freqs):
        lfo = 1 + 0.003 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t)
        a = 1 / (1 + k * 0.4)
        L += a * np.sin(2 * np.pi * np.cumsum(f * lfo * 0.999) / SR)
        R += a * np.sin(2 * np.pi * np.cumsum(f * lfo * 1.001) / SR + k)
    air = lowpass(rng.standard_normal(n), 4000, 127) - lowpass(rng.standard_normal(n), 800, 127)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.0) * (0.85 + 0.15 * np.sin(2 * np.pi * t / 2.4))
    return np.stack([L, R], 1) * env[:, None] / len(freqs) + (air * env * 0.04)[:, None]


# ======================= Микшер =======================


class Mixer:
    def __init__(self, dur):
        n = int(dur * SR) + SR * 4
        self.dry = np.zeros((n, 2))
        self.verb = np.zeros((n, 2))
        self.bed = np.zeros((n, 2))
        self.sub = np.zeros(n)
        self._sw = [swish(0.26), swish(0.3), swish(0.24)]
        self._k = 0
        self.W = whoosh(0.6)

    def place(self, t, sig, gain_db, az=0.0, send=0.25, bus=None, peak_align=0.0):
        g = db(gain_db)
        if sig.ndim == 1:
            azv = az(np.linspace(0, 1, len(sig))) if callable(az) else az
            st = spatialize(sig, azv)
        else:
            st = sig
        i = int((t - peak_align) * SR)
        if i < 0:
            st, i = st[-i:], 0
        j = min(len(self.dry), i + len(st))
        (self.bed if bus == "bed" else self.dry)[i:j] += st[: j - i] * g
        self.verb[i:j] += st[: j - i] * g * send

    # --- жоғары деңгейлі «рецепттер» ---
    def text_in(self, t, az, gain=-23):
        """мәтін шыққанда: беттен (орта) элемент жаққа ұшатын қысқа swish; шыңы — мәтін көрінген сәт."""
        s = self._sw[self._k % 3]
        self._k += 1
        self.place(t + 0.05, s, gain, fly(az * 0.2, az), send=0.18, peak_align=len(s) / SR * 0.55)

    def big_whoosh(self, t, az, gain=-21):
        self.place(t, self.W, gain, fly(-45 if az >= 0 else 45, az), send=0.3, peak_align=0.37)

    def counter(self, t0, t1, n, az, gain=-29):
        for k in range(n):
            p = k / n
            self.place(t0 + (t1 - t0) * (1 - (1 - p) ** 0.5), tick(2300 + 700 * p), gain, az + rng.uniform(-6, 6), send=0.08)

    def hero_impact(self, t):
        rs = riser(1.45)
        self.place(t, rs, -21, lambda p: -80 * np.cos(np.pi * 1.5 * p), send=0.35, bus="bed", peak_align=len(rs) / SR)
        imp, sub = impact()
        self.place(t, imp, -12, 0.0, send=0.55)
        i = int(t * SR)
        self.sub[i:i + len(sub)] += sub[: len(self.sub) - i] * db(-14)


def fly(a0, a1):
    return lambda p: a0 + (a1 - a0) * (p * p * (3 - 2 * p))


def az_of_dx(dx):
    """кадр ортасынан ығысу (px) → азимут: экранның шеті ≈ ±70°."""
    return float(np.clip(dx / 960 * 70, -85, 85))


# ======================= timeline.json → SFX =======================


def build(tl, mx: Mixer):
    for it in tl["items"]:
        ty = it["type"]
        dx = it.get("dx", 0)
        az = az_of_dx(dx + (250 if ty in ("list", "checks") else 0))  # сол жақтан басталатын мәтіннің ортасы
        if ty == "text":
            mx.text_in(it["t"], az)
        elif ty == "list":
            for row in it["items"]:
                mx.text_in(row["t"], az)
        elif ty == "counter":
            c0 = it.get("countFrom", it["t"])
            dur = it.get("dur", 1.0)
            if it.get("hero"):
                mx.hero_impact(c0)
            else:
                mx.big_whoosh(c0, az)
            mx.counter(c0, c0 + dur, max(6, int(12 * dur)), az, -29 if not it.get("hero") else -30)
            if not it.get("hero"):
                mx.place(c0 + dur, stereo_bell(1318.5 if it.get("color") != "accent" else 1568), -27, send=0.4)
            if "plusAt" in it:
                mx.place(it["plusAt"], pop(1250, 520), -22, az, send=0.2)
            if "sub" in it:
                mx.text_in(it["sub"]["at"], az, -26)
        elif ty == "lowerThird":
            mx.place(it["t"], whoosh(0.5, 300, 2600), -22, fly(30, az), send=0.25, peak_align=0.3)
        elif ty == "logos":
            if it.get("label"):
                mx.text_in(it.get("labelAt", it["items"][0]["t"]), az, -25)
            for k, l in enumerate(it["items"]):
                side = -1 if k % it.get("cols", 2) == 0 else 1
                mx.place(l["t"] + 0.05, pop(), -20, az + side * 8, send=0.22)
        elif ty == "icons":
            for k, (pdx, _, _) in enumerate(it["positions"]):
                mx.place(it["t"] + k * 4 / 60, pop(1150, 420, 0.07), -27, az_of_dx(dx + pdx), send=0.15)
        elif ty == "strike":
            mx.text_in(it["t"], az)
            mx.place(it["redAt"], glitch(), -21, az, send=0.25)
            mx.place(it["redAt"] + 0.03, swish(0.22), -25, fly(az - 15, az + 15), send=0.1, peak_align=0.12)
        elif ty == "checks":
            for row in it["items"]:
                mx.text_in(row["t"], az)
            if "checksAt" in it:
                for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)[: len(it["items"])]):
                    mx.place(it["checksAt"] + k * 3 / 60, stereo_bell(f, 0.8), -28, send=0.3)
                    mx.place(it["checksAt"] + k * 3 / 60, pop(1400, 700, 0.06), -26, az_of_dx(dx), send=0.1)
        elif ty == "subscribe":
            mx.place(it["t"], pop(800, 260, 0.14), -21, az, send=0.2)
            mx.text_in(it["t"] + 0.45, az, -25)
            mx.place(it["clickAt"], mouse_click(), -19, az + 6, send=0.1)
            mx.place(it["clickAt"] + 0.1, stereo_bell(1760, 0.9), -27, send=0.35)
            mx.place(it["clickAt"] + 0.2, stereo_bell(2349, 0.9), -30, send=0.35)
        elif ty == "pause":
            mx.place(it["t"], power_down(), -22, az, send=0.35)
            mx.text_in(it["t"] + 0.3, az, -25)
        elif ty == "timer":
            start, step, count = it.get("start", it["t"]), it.get("step", 1.2), it.get("count", 5)
            mx.place(it["t"], pop(), -22, az, send=0.25)
            for k in range(count):  # тик-так: кезек сол/оң
                mx.place(start + k * step, tick(1500 if k % 2 else 1900, 0.05), -24, az + (-14 if k % 2 else 14), send=0.3)
            mx.place(start - 0.3, pad(step * count + 0.6), -30, send=0.6, bus="bed")
            mx.place(start + step * count, stereo_bell(880, 1.8), -27, send=0.6)
        elif ty == "arrow":
            mx.place(it["t"], pop(800, 300), -26, az, send=0.2)

    # қолмен қосылған оқиғалар
    for e in tl.get("sfx", {}).get("extra", []):
        az = az_of_dx(e.get("dx", 0))
        g = e.get("gain", -22)
        kind = e["type"]
        sig = {
            "whoosh": lambda: whoosh(), "swish": lambda: swish(), "pop": lambda: pop(), "tick": lambda: tick(),
            "click": mouse_click, "glitch": lambda: glitch(), "powerdown": lambda: power_down(), "riser": lambda: riser(),
        }
        if kind == "bell":
            mx.place(e["t"], stereo_bell(e.get("f", 1318.5)), g, send=0.4)
        elif kind == "impact":
            mx.hero_impact(e["t"])
        elif kind == "pad":
            mx.place(e["t"], pad(e.get("dur", 6.0)), g, send=0.6, bus="bed")
        elif kind in sig:
            mx.place(e["t"], sig[kind](), g, az, send=e.get("send", 0.25))
        else:
            raise SystemExit(f"sfx.extra: белгісіз тип {kind}")


# ======================= I/O =======================


def read_wav(path):
    with wave.open(path) as w:
        assert w.getsampwidth() == 2, "16-bit WAV керек (scripts/prepare.sh жасайды)"
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
        x = x.reshape(-1, w.getnchannels())
        if w.getframerate() != SR:
            raise SystemExit(f"{path}: {SR} Гц керек, бар — {w.getframerate()}")
    return np.repeat(x, 2, 1) if x.shape[1] == 1 else x[:, :2]


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("timeline")
    ap.add_argument("voice", help="дауыс жолы, 48 кГц 16-bit WAV")
    ap.add_argument("out", help="араласқан WAV")
    ap.add_argument("--sfx-only", help="тек SFX қабатын да сақтау")
    ap.add_argument("--sfx-gain", type=float, default=0.0, help="SFX қабатын жалпы көтеру/түсіру, дБ")
    a = ap.parse_args()

    tl = json.load(open(a.timeline, encoding="utf-8"))
    voice = read_wav(a.voice)
    N = min(len(voice), int(tl["duration"] * SR) + SR)
    voice = voice[:N]

    mx = Mixer(N / SR)
    build(tl, mx)

    env = np.sqrt(np.convolve((voice ** 2).mean(1), np.ones(2400) / 2400, "same"))
    env /= np.percentile(env, 95) + 1e-9
    duck = np.convolve(1 - 0.5 * np.clip(env, 0, 1), np.ones(4800) / 4800, "same")

    ir = make_ir()
    verb = mx.verb[:N]
    wet = np.stack([fftconv(verb[:, c], ir[:, c])[:N] for c in range(2)], 1)
    sfx = (mx.dry[:N] + mx.bed[:N] * duck[:, None] + wet + lowpass(mx.sub[:N], 120)[:, None]) * db(a.sfx_gain)

    mix = voice + sfx
    over = np.abs(mix) > 0.85
    mix[over] = np.sign(mix[over]) * (0.85 + 0.12 * np.tanh((np.abs(mix[over]) - 0.85) / 0.12))  # жұмсақ шектегіш
    print(f"SFX шыңы {20*np.log10(np.abs(sfx).max()+1e-9):.1f} dBFS | дауыс шыңы {20*np.log10(np.abs(voice).max()+1e-9):.1f} dBFS")
    write_wav(a.out, mix)
    if a.sfx_only:
        write_wav(a.sfx_only, sfx)
    print("saved", a.out)


if __name__ == "__main__":
    main()
