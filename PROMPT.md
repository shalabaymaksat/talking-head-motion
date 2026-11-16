# Дайын промпт

Claude Code-та (терминал, desktop не claude.ai/code) видеоңыз тұрған папкада ашып, төмендегі мәтінді көшіріп жіберіңіз. Тек **видео файлының атын** өзіңіздікіне ауыстырыңыз.

---

## Қазақша

```
https://github.com/shalabaymaksat/talking-head-motion репосын ~/talking-head-motion папкасына клонда да, ондағы SKILL.md нұсқаулығы бойынша жұмыс істе.

Менің видеом: ./video.mov (тілі — қазақша).

1. Видеоны дайында, жергілікті Whisper-мен транскрибацияла.
2. Транскриптті оқып, анимация керек жерлерді тап: әсіресе табыс, пайда, адам саны, сандар айтылған жерлер міндетті; тізімдер, есімдер, компания атаулары, «А емес, Б» қарама-қарсылықтар, CTA.
3. STORYBOARD.md жасап маған көрсет. Мен мақұлдаған соң timeline.json жаз.
4. Әр анимацияның still кадрын тексер: мәтін бетімді жаппасын, кадрдан шықпасын.
5. Толық рендерле, әр анимацияға immersive (binaural) дыбыс эффектілерін қос.
6. Дайын видеоны out/final.mp4 етіп сақта да, қай жерге қандай анимация қойғаныңды кестемен көрсет.
```

## English

```
Clone https://github.com/shalabaymaksat/talking-head-motion into ~/talking-head-motion and follow its SKILL.md.

My video: ./video.mov (language: English).

1. Prepare the video and transcribe it with local Whisper.
2. Find the moments that deserve animation — numbers, revenue, profit and audience counts are mandatory; also lists, names, company names, "not A but B" contrasts and CTAs.
3. Write STORYBOARD.md and show it to me. After I approve, write timeline.json.
4. Check a still of every animation: no text over my face, nothing off-frame.
5. Render the full video and add immersive (binaural) SFX to every animation.
6. Save it as out/final.mp4 and give me a table of what you animated and where.
```

---

## Түзету промпттары (рендерден кейін)

```
1:12-дегі санауышты 0,3 секунд кешірек шығар, ал «ПАЙДА» сөзін акцент түске боя.
```
```
Камера қозғалмасын: кадр тұрақты тұрсын, ауысулар таза кесумен болсын.
```
```
Дыбыс эффектілерін 3 дБ тыныштат, 5 МЛРД кезіндегі impact-ты қалдыр.
```
Әр түзету — `timeline.json`-да бір-екі жол; Claude тек сол жерді өзгертіп, қайта рендерлейді.
