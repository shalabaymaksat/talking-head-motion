import {Easing} from 'remotion';
import TL from './timeline.json';

export const FPS: number = TL.fps;
export const W = 1920;
export const H = 1080;
// Видео ағынынан асып кетпеу үшін төмен қарай дөңгелектейміз
export const DURATION = Math.floor(TL.duration * FPS);

export const COLORS = TL.colors as Record<string, string>;
export const color = (c?: string) => (c && COLORS[c]) || c || COLORS.text;

export const FONT: string = TL.font.family;

// Кіру: ~0.5 с, жеңіл overshoot (spring damping 14). Шығу — кірудің ~60%, ease-in.
export const ENTER_FRAMES = 30;
export const SPRING = {damping: 14, stiffness: 170, mass: 0.9};
export const EXIT_FRAMES = 18;
export const EASE_IN = Easing.in(Easing.cubic);
export const EASE_OUT = Easing.out(Easing.cubic);
export const EASE_IN_OUT = Easing.inOut(Easing.cubic);

export const TEXT_SHADOW = '0 3px 18px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35)';

export const sec = (s: number) => Math.round(s * FPS);
