#!/usr/bin/env python3
"""Жергілікті Whisper (large-v3) транскрипциясы — сөз-деңгейіндегі уақытпен. API кілт керек емес.

  python3 scripts/transcribe.py work/voice_stt.mp3 --lang kk
  python3 scripts/transcribe.py work/voice_stt.mp3 --lang kk --model large-v3-turbo   # жылдамырақ

Бэкенд автоматты таңдалады (не --backend):
  mlx      — Apple Silicon (M1–M4): pip install mlx-whisper          ← Mac-та ең жылдам
  faster   — кез келген CPU / NVIDIA GPU: pip install faster-whisper
  openai   — түпнұсқа openai-whisper: pip install openai-whisper
Модель бірінші іске қосқанда жүктеледі (~3 ГБ large-v3), кейін офлайн жұмыс істейді.

Шығыс: <аудио папкасы>/transcript.json (сөз тайм-кодтары) және transcript.txt (оқуға ыңғайлы).
Ескерту: Whisper қазақшаны жиі қате жазады — сөздердің УАҚЫТЫ дұрыс, мәтінін өзіңіз түзетесіз.
Whisper-ге initial prompt бермеңіз: уақыттарды бұзуы мүмкін.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

MLX_MODELS = {"large-v3": "mlx-community/whisper-large-v3-mlx", "large-v3-turbo": "mlx-community/whisper-large-v3-turbo"}


def have(mod):
    return importlib.util.find_spec(mod) is not None


def run_mlx(audio, lang, model):
    import mlx_whisper

    r = mlx_whisper.transcribe(audio, path_or_hf_repo=MLX_MODELS.get(model, model), language=lang,
                               word_timestamps=True, condition_on_previous_text=False)
    return r["segments"]


def run_faster(audio, lang, model):
    from faster_whisper import WhisperModel

    m = WhisperModel(model, device="auto", compute_type="auto")
    segs, _ = m.transcribe(audio, language=lang, word_timestamps=True, condition_on_previous_text=False, vad_filter=False)
    return [{"start": s.start, "end": s.end, "text": s.text,
             "words": [{"word": w.word, "start": w.start, "end": w.end} for w in (s.words or [])]} for s in segs]


def run_openai(audio, lang, model):
    import whisper

    r = whisper.load_model(model).transcribe(audio, language=lang, word_timestamps=True, condition_on_previous_text=False)
    return r["segments"]


BACKENDS = {"mlx": ("mlx_whisper", run_mlx), "faster": ("faster_whisper", run_faster), "openai": ("whisper", run_openai)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--lang", default=None, help="kk / ru / en … (бос болса — автоанықтау)")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--backend", choices=list(BACKENDS), default=None)
    a = ap.parse_args()

    names = [a.backend] if a.backend else [b for b in BACKENDS if have(BACKENDS[b][0])]
    if not names or not have(BACKENDS[names[0]][0]):
        sys.exit("Whisper табылмады. Орнатыңыз: pip install mlx-whisper (Mac M-чип) не pip install faster-whisper")
    backend = names[0]
    print(f"Whisper: {backend} · {a.model} · тіл={a.lang or 'авто'}")
    segments = BACKENDS[backend][1](a.audio, a.lang, a.model)

    segs = [{"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()} for s in segments]
    words = [{"word": w["word"].strip(), "start": round(float(w["start"]), 3), "end": round(float(w["end"]), 3)}
             for s in segments for w in s.get("words", [])]
    res = {"backend": backend, "model": a.model, "language": a.lang, "segments": segs, "words": words}

    out = Path(a.audio).with_name("transcript.json")
    out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")

    def ts(s):
        return f"{int(s // 60)}:{s % 60:05.2f}"

    lines = [f"[{ts(s['start'])}–{ts(s['end'])}] {s['text']}" for s in segs]
    lines += ["", "# сөздер (басталу уақыты, с)", " ".join(f"{w['word']}[{w['start']:.2f}]" for w in words)]
    out.with_suffix(".txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"сөз саны: {len(words)} → {out}, {out.with_suffix('.txt')}")


if __name__ == "__main__":
    main()
