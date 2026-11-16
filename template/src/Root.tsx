import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Main} from './Main';
import {DURATION, FPS, H, W} from './theme';
import TL from './timeline.json';

// Шрифттер бірінші кадрға дейін жүктеледі (fallback шрифт = баг).
// Әдепкі: public/fonts/InterTight-VF.ttf (OFL, кириллица + қазақ әріптері + ₸), желіге тәуелді емес.
// Өз шрифтіңіз: public/fonts/ ішіне TTF салып, timeline.json-да
//   "font": {"family": "MyFont", "files": [["MyFont-Bold.ttf", 700], ["MyFont-Black.ttf", 900]]}
const font = TL.font as {family: string; files?: [string, number | string][]};

if (font.files) {
  const handle = delayRender(`font ${font.family}`);
  Promise.all(
    font.files.map(([file, weight]) =>
      new FontFace(font.family, `url(${staticFile(`fonts/${file}`)})`, {weight: String(weight)}).load().then((f) => document.fonts.add(f)),
    ),
  )
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch((e) => {
      throw e;
    });
}

export const Root: React.FC = () => <Composition id="Main" component={Main} durationInFrames={DURATION} fps={FPS} width={W} height={H} />;
