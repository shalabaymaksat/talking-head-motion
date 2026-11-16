import React, {createContext, useContext} from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, EASE_IN, EASE_OUT, ENTER_FRAMES, EXIT_FRAMES, FONT, SPRING, TEXT_SHADOW, sec} from './theme';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** <Sequence> ішінде де абсолютті кадр: timeline.json уақыттары видеоның өз секундтары. */
export const OffsetCtx = createContext(0);
export const useAbsFrame = () => useCurrentFrame() + useContext(OffsetCtx);

/** Кадр ортасынан (dx, dy) орналастыру — 9:16 / 1:1 нұсқаларға қайта рендерлеуге ыңғайлы. */
export const At: React.FC<{dx: number; dy: number; align?: 'center' | 'left'; children: React.ReactNode}> = ({
  dx,
  dy,
  align = 'center',
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: `calc(50% + ${dx}px)`,
      top: `calc(50% + ${dy}px)`,
      transform: align === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

/** Элемент өмірі: spring-кіру (overshoot) → ұстау (тоқтамайтын drift) → жылдам ease-in шығу. */
export const Appear: React.FC<{from: number; to: number; variant?: 'rise' | 'pop'; children: React.ReactNode}> = ({
  from,
  to,
  variant = 'rise',
  children,
}) => {
  const frame = useAbsFrame();
  const {fps} = useVideoConfig();
  const f0 = sec(from);
  const f1 = sec(to);
  if (frame < f0 || frame > f1 + EXIT_FRAMES) return null;
  const s = spring({frame: frame - f0, fps, config: SPRING, durationInFrames: ENTER_FRAMES});
  const out = interpolate(frame, [f1, f1 + EXIT_FRAMES], [0, 1], {...clamp, easing: EASE_IN});
  const hold = interpolate(frame, [f0 + ENTER_FRAMES, Math.max(f0 + ENTER_FRAMES + 1, f1)], [0, 1], clamp);
  const drift = 1 + 0.02 * hold; // golden rule: ештеңе толық тоқтамайды
  const opacity = Math.min(1, s * 1.6) * (1 - out);
  const blur = Math.max(0, (1 - Math.min(1, s)) * 12) + out * 8;
  const ty = variant === 'rise' ? (1 - s) * 34 - out * 14 : -out * 10;
  const scale = (variant === 'pop' ? Math.max(0.001, s) : 0.94 + 0.06 * s) * drift * (1 - 0.06 * out);
  return (
    <div style={{opacity, filter: `blur(${blur.toFixed(2)}px)`, transform: `translateY(${ty}px) scale(${scale})`}}>
      {children}
    </div>
  );
};

export const Txt: React.FC<{
  size: number;
  weight?: 400 | 700 | 800 | 900;
  color?: string;
  tracking?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({size, weight = 900, color = COLORS.text, tracking = -0.01, children, style}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      color,
      letterSpacing: `${tracking}em`,
      lineHeight: 1,
      textShadow: TEXT_SHADOW,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{children: React.ReactNode; size?: number}> = ({children, size = 30}) => (
  <Txt size={size} weight={700} color={COLORS.accent} tracking={0.06}>
    {children}
  </Txt>
);

export const formatInt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ |,/g, ' ');

/** Санауыш мәні: ~1 с ease-out, бір кадрда секірмейді. */
export const useCount = (from: number, v0: number, v1: number, frames = 60) => {
  const frame = useAbsFrame();
  return interpolate(frame, [sec(from), sec(from) + frames], [v0, v1], {...clamp, easing: EASE_OUT});
};

/** Клик кезіндегі press: 1 → 0.96 → 1, ~8 кадр. */
export const usePress = (at: number) => {
  const frame = useAbsFrame();
  const f = sec(at);
  return interpolate(frame, [f, f + 4, f + 8], [1, 0.96, 1], clamp);
};

/** Курсор: доғамен (quadratic bezier, бақылау нүктесі ~15%), easy-ease + кішкене overshoot. */
export const Cursor: React.FC<{from: number; travel: number; p0: [number, number]; p1: [number, number]; pressAt: number}> = ({
  from,
  travel,
  p0,
  p1,
  pressAt,
}) => {
  const frame = useAbsFrame();
  const {fps} = useVideoConfig();
  const f0 = sec(from);
  const t = spring({frame: frame - f0, fps, config: {damping: 14, stiffness: 70, mass: 1}, durationInFrames: sec(travel)});
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const cx = (x0 + x1) / 2 - (dy / dist) * dist * 0.15;
  const cy = (y0 + y1) / 2 + (dx / dist) * dist * 0.15;
  const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
  const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
  const pf = sec(pressAt);
  const press = interpolate(frame, [pf, pf + 4, pf + 8], [1, 0.85, 1], clamp);
  const appear = interpolate(frame, [f0 - 8, f0], [0, 1], clamp);
  return (
    <svg
      width={34}
      height={44}
      viewBox="0 0 34 44"
      style={{position: 'absolute', left: x, top: y, opacity: appear, transform: `scale(${press})`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.45))'}}
    >
      <path d="M2 2 L2 34 L10 26 L16 40 L22 37 L16 24 L28 24 Z" fill="#fff" stroke="#111" strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
};

export const PersonIcon: React.FC<{size: number; color?: string}> = ({size, color = COLORS.text}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))'}}>
    <circle cx={50} cy={50} r={46} fill="rgba(16,16,16,.35)" stroke={color} strokeWidth={4} />
    <circle cx={50} cy={38} r={14} fill="none" stroke={color} strokeWidth={4} />
    <path d="M24 78 C28 60 72 60 76 78" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
  </svg>
);

export const Check: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.45))'}}>
    <circle cx={50} cy={50} r={48} fill={COLORS.accent} />
    <path d="M28 52 L44 68 L73 34" fill="none" stroke={COLORS.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo: React.FC<{file: string; size: number}> = ({file, size}) => (
  <Img src={staticFile(`logos/${file}`)} style={{width: size, height: size, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.45))'}} />
);

export const ArrowDown = () => (
  <svg width={40} height={56} viewBox="0 0 40 56" style={{filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.5))'}}>
    <line x1={20} y1={2} x2={20} y2={44} stroke="#fff" strokeWidth={4} />
    <path d="M6 34 L34 34 L20 54 Z" fill="#fff" />
  </svg>
);

export const PauseIcon = () => (
  <svg width={120} height={120} viewBox="0 0 120 120" style={{filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.45))'}}>
    <circle cx={60} cy={60} r={56} fill="rgba(20,20,20,.75)" stroke={COLORS.accent} strokeWidth={3} />
    <rect x={43} y={36} width={11} height={48} rx={3} fill="#fff" />
    <rect x={66} y={36} width={11} height={48} rx={3} fill="#fff" />
  </svg>
);

export {spring};
