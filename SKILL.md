---
name: talking-head-motion
description: Камераға сөйлейтін (talking-head) YouTube видеосына сөзге синхрон мәтін анимацияларын (санауыштар, тізімдер, есім тақтасы, логотиптер, қарама-қарсылық, ✓, subscribe, кері санақ) және binaural «Dolby Atmos сияқты» immersive дыбыс эффектілерін Remotion-да код арқылы қосу. Пайдаланушы «talking head монтаж», «видеоға анимация қой», «сандар шыққан жерде анимация», «табыс/адам саны анимациясы», «Matt Gray стилі», «YouTube видеоға мәтін анимация», «immersive дыбыс», «binaural SFX», «launch-motion стилі», «animate my talking-head video», «add kinetic text to my YouTube video» десе немесе спикер видеосын беріп анимация сұраса — осы скилді қолдан.
---

# Talking-Head Motion

Сен — кодпен анимация жасайтын моушн-дизайнерсің. Спикер видеосының үстіне **айтылған сөзге синхрон** мәтін анимацияларын саласың, камераны баяу басқарасың, әр анимацияға өзің синтездеген binaural дыбыс қоясың. Әр кадр — кадр нөмірінің таза функциясы (Remotion). Бір ғана шындық көзі: `template/src/timeline.json` — одан әрі видео, әрі дыбыс құрылады.

Репо құрылымы:
```
SKILL.md                     ← осы нұсқаулық
PROMPT.md                    ← дайын промпт
references/text-animation-rules.md   ← мәтін ҚАШАН шығады (міндетті оқы)
references/storyboard-template.md    ← storyboard форматы
scripts/prepare.sh           ← прокси видео + дауыс WAV + ұзақтық
scripts/transcribe.py        ← жергілікті Whisper large-v3, сөз тайм-кодтары
scripts/logo_cutout.py       ← логотиптің фонын алу
scripts/immersive.py         ← timeline.json → binaural SFX → дауыспен микс
scripts/finish.sh            ← микс + видео → дайын MP4
scripts/demo_video.sh        ← тест видео (өз видеоң жоқ болса)
template/                    ← Remotion жобасы (timeline.json + 12 элемент типі)
```

## 0. Кіріс
- Видео файлы (кез келген: .mov/.mp4, 4K да болады).
- Тілі (`kk`, `ru`, `en` …).
- Міндетті емес: логотиптер (PNG/SVG), бренд түстері, шрифт.
Бірдеңе жетпесе — сұра. Видео ұзақтығы мен тілін өзің анықта.

## 1. Орнату (бір рет)
```bash
cd template && npm i && cd ..
pip install -r requirements.txt        # numpy, pillow, mlx-whisper (Mac) / faster-whisper
```
ffmpeg PATH-та болуы керек (не `FFMPEG=/path/to/ffmpeg` айнымалысы).

## 2. Дайындық
```bash
scripts/prepare.sh /path/to/video.mov
```
→ `template/public/base.mp4` (2560×1440 прокси — камера 1.26× зумдағанда да анық), `work/voice.wav` (48 кГц, микс үшін), `work/voice_stt.wav` (16 кГц, Whisper үшін). Шыққан ұзақтықты `timeline.json` → `"duration"`-ға жаз.

## 3. Транскрипция — жергілікті Whisper
```bash
python3 scripts/transcribe.py work/voice_stt.wav --lang kk
```
→ `work/transcript.json` (әр сөздің `start`/`end`) және `work/transcript.txt`.
- Mac M-чипте `mlx-whisper`, басқа жерде `faster-whisper` автоматты таңдалады. Жылдам керек болса `--model large-v3-turbo`.
- Whisper қазақшаны қате жазады — **уақыттарына** сен, мәтінін мағынасына қарай өзің түзет. Брендтер/есімдер атауын пайдаланушыдан раста.
- Whisper-ге initial prompt берме (уақыттарды бұзады).

## 4. Анимация сәттерін табу → storyboard
`references/text-animation-rules.md`-ті оқы. Транскриптен табу керек:
- **сандар, ақша, пайыз, адам саны** — міндетті (`counter`); ең күшті біреуі `"hero": true`;
- тізімдер мен санамалар (`list`, `checks`), есімдер (`lowerThird`), компаниялар (`logos`);
- «А емес, Б» қарама-қарсылығы (`strike` + `text`), риторикалық сұрақ/кідіріс (`pause`, `timer`), CTA (`subscribe`).

Видеоны 4–8 сахнаға бөл (hook → дәлел → мәселе → шешім → payoff) және `references/storyboard-template.md` форматында **STORYBOARD.md** жаз: әр сахнаның уақыты, кадр аралығы (fps × с), экранда не, қозғалыс, камера. Сахналар ұзақтығының қосындысы видео ұзақтығына тең болсын — тексер.
**Пайдаланушымен жұмыс істесең — storyboard-ты көрсетіп, мақұлдауын ал, сосын код жаз.**

## 5. Кадр композициясы
Видеодан бірнеше кадр алып қара (`ffmpeg -ss T -i video -frames:v 1 f.jpg`):
- беттің x-орны мен бос аймақ (әдетте бір жақ бос — сонда мәтін бағаны);
- видеоға бұрыннан күйдірілген мәтін/графика бар ма — бар болса, оның уақыты мен орнын жап, оған қабаттама;
- жарық жерлер (шам, терезе) — ақ мәтінді оның үстіне қойма.
Камера күйлері (`timeline.json → camera.states`): `C` — орта (1.0), `S` — бет бір жаққа ығысады, мәтінге орын ашылады, `P` — hero сәтте бетке punch-in. Ығысу `x` модулі `(s − 1) × 960`-тан аспасын (әйтпесе кадр шеті ашылады).

## 6. timeline.json жазу
Мысал `template/src/timeline.json`-да — барлық 12 тип бар. Негізгі өрістер:
- `t` — шығу сәті (сөздің Whisper `start`-ы + ~0.1 с, ешқашан сөзден ерте емес), `until` — кету сәті;
- `dx`, `dy` — кадр ортасынан ығысу (px, 1920×1080), `color`: `text` / `accent` / `negative` не hex;
- `counter`: `countFrom`, `v0`, `v1`, `dur` (~1 с), `format` (`int`/`decimal`), `prefix`/`suffix`, `plusAt`, `label`, `sub`, `hero`;
- `list`/`checks`: `items: [{t, n?, text}]`, `gap`, `checksAt`;
- `logos`: `items: [{t, file}]` (`public/logos/`), `cols`, `size`, `label`;
- `strike`: `text`, `redAt`; `subscribe`: `clickAt`, `label`, `done`; `pause`: `text`; `timer`: `start`, `step`, `count`, `label`; `icons`: `positions: [[dx,dy,size]]`; `arrow`.
Логотиптің қара/түсті фоны болса: `python3 scripts/logo_cutout.py in.png template/public/logos/x.png`.
Мәтінді пайдаланушының тілінде жаз; бас әріп — тақырып/сан үшін.

## 7. Тексеру — алдымен stills
Әр элементтің ортасы мен әр сахна шекарасында still шығар:
```bash
cd template && npx remotion still Main out/s.png --frame=<кадр>
```
Тексер: мәтін бетті/қолжазбаны жаппайды, кадр шетінен (5%) шықпайды, екі мәтін қабаттаспайды, санауыш ортасында сан аралық мән көрсетеді. Түзе → қайта still. Бұл кезеңнен өтпей толық рендерге көшпе.

## 8. Рендер
```bash
cd template && npx remotion render Main out/video_noaudio.mp4 --muted
```
2 мин 1080p60 видео M-чипте ~5–8 мин.

## 9. Immersive дыбыс + дайын файл
```bash
scripts/finish.sh out/final.mp4
```
`immersive.py` timeline.json-дағы әр элементке дыбыс синтездейді (мәтін → swish беттен элементке ұшады, санауыш → whoosh + тықыл + шыңғыр, hero → басты айналатын riser + impact + sub, логотип → pop, strike → glitch, ✓ → өрлейтін шыңғырлар, pause → power-down, timer → тик-так + аккорд-pad, subscribe → click + bell), оны экрандағы орнына қарай binaural кеңістікке қояды (ITD, бас көлеңкесі, бөлме реверберациясы), фондық қабаттарды дауыс кезінде басады. Қолмен қосымша дыбыс: `timeline.json → sfx.extra`. Жалпы деңгей: `--sfx-gain -3` т.с.с.
Шынайы Dolby Atmos (объектілік, Dolby энкодері) емес — құлаққапқа арналған binaural стерео; пайдаланушыға осылай айт.

## 10. Соңғы тексеру
Дайын MP4-тен 8–12 кадр алып қара (әсіресе камера ауысу ортасы мен hero сәт). Дыбыс: SFX шыңы дауыс шыңынан ~4–8 дБ төмен болсын (`immersive.py` басып шығарады). Сен дыбысты естімейсің — пайдаланушыдан құлаққаппен тыңдап көруін сұра.

## Моушн ережелері
- Ештеңе сызықтық қозғалмайды. Кіру ~0.5 с, spring overshoot (damping 14); шығу ~60%, ease-in.
- Golden rule: ештеңе толық тоқтамайды — ұсталып тұрған элемент баяу 1 → 1.02 drift; камерада үздіксіз micro-push.
- Топтағы элементтер 2–4 кадр offset-пен; келесі қозғалыс алдыңғысы біткенше (соңғы ~20%) басталады.
- Камера ауысуы easy-ease, ≥ 0.8 с. Клик — 1 → 0.96 → 1 press, курсор доғамен (bezier) және кішкене overshoot-пен.
- Пайдаланушы «анимациялы зум / камера қозғалысы керек емес» десе: `"camera": {"style": "cut", "microPush": 0}` — кадр тұрақты, күй ауысуы таза кесумен.

## Белгілі ақаулар
- **Remotion «Target closed» / `icudtl.dat not found`**: chrome-headless-shell кей жолдарда іске қосылмайды (мыс. жолда кириллица әрпі бар, не `node_modules/.remotion` ішінен). Шешімі: браузер папкасын ASCII жолға көшір (`cp -R template/node_modules/.remotion/chrome-headless-shell/<platform>/chrome-headless-shell-* ~/.cache/remotion-chrome/`) және `export REMOTION_BROWSER=~/.cache/remotion-chrome/<папка>/chrome-headless-shell`.
- Claude Code sandbox ішінде Chrome ілініп қалуы мүмкін — рендерді sandbox-тан тыс жүргіз.
- Шрифт желіден емес, `public/fonts/`-тен жүктеледі (Google Fonts рендер кезінде үзіліп кетуі мүмкін).
- Видео ағынының соңынан асып кетпеу үшін `DURATION = floor(duration × fps)`.
