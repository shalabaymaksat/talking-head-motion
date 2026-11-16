import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {OffsetCtx} from './components';
import {Item, RenderItem, itemEnd, itemStart} from './items';
import {EASE_IN_OUT, FPS, sec} from './theme';
import TL from './timeline.json';

type Cam = {s: number; x: number; y: number};
const CAMERA = TL.camera as {style: 'ease' | 'cut'; pan: number; microPush: number; states: Record<string, Cam>; keys: [number, string][]};

/**
 * Камера: кілттер арасында easy-ease (≥0.8 с) + үздіксіз micro-push.
 * style: "cut" — ауысу бір кадрда (таза кесу), micro-push жоқ: спикер кадры тұрақты.
 */
const cameraAt = (t: number): Cam => {
  const keys = CAMERA.keys;
  let k = 0;
  while (k + 1 < keys.length && keys[k + 1][0] <= t) k++;
  const cur = CAMERA.states[keys[k][1]];
  if (CAMERA.style === 'cut') return cur;
  const prev = k > 0 ? CAMERA.states[keys[k - 1][1]] : cur;
  const p = EASE_IN_OUT(Math.min(1, Math.max(0, (t - keys[k][0]) / CAMERA.pan)));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  const micro = 1 + CAMERA.microPush * (1 - Math.cos((2 * Math.PI * t) / 22)) / 2;
  return {s: lerp(prev.s, cur.s) * micro, x: lerp(prev.x, cur.x), y: lerp(prev.y, cur.y)};
};

const Camera: React.FC = () => {
  const frame = useCurrentFrame();
  const {s, x, y} = cameraAt(frame / FPS);
  return (
    <AbsoluteFill style={{transform: `translate(${x}px, ${y}px) scale(${s})`, transformOrigin: '50% 50%'}}>
      <OffthreadVideo src={staticFile(TL.video)} muted style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};

const ITEMS = TL.items as Item[];

/** Бір сахна = бір <Sequence>. Элемент басталған сахнаға тиесілі; шығу анимациясы кесілмейді. */
const Scenes: React.FC = () => (
  <>
    {TL.scenes.map((s, i) => {
      const own = ITEMS.filter((it) => {
        const st = itemStart(it);
        return st >= s.from && (st < s.to || i === TL.scenes.length - 1);
      });
      const from = sec(s.from);
      const end = Math.max(s.to, ...own.map(itemEnd));
      return (
        <Sequence key={i} from={from} durationInFrames={Math.max(1, sec(end) - from)} name={`Scene ${i + 1} · ${s.name}`} layout="none">
          <OffsetCtx.Provider value={from}>
            {own.map((it, k) => (
              <RenderItem key={k} it={it} />
            ))}
          </OffsetCtx.Provider>
        </Sequence>
      );
    })}
  </>
);

export const Main: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
    <Camera />
    <AbsoluteFill>
      <Scenes />
    </AbsoluteFill>
  </AbsoluteFill>
);
