/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import {
  Appear, ArrowDown, At, Check, Cursor, Label, Logo, PauseIcon, PersonIcon, Txt, clamp, formatInt, useAbsFrame, useCount, usePress,
} from './components';
import {COLORS, EASE_OUT, EXIT_FRAMES, FONT, SPRING, color, sec} from './theme';

/** timeline.json-дағы бір элемент. Барлық уақыт — секунд, орын — ортадан ығысу. */
export type Item = {type: string; [k: string]: any};

/** Элементтің экрандағы соңғы сәті (шығуымен қоса) — Sequence ұзақтығы үшін. */
export const itemEnd = (it: Item) => (it.until ?? 0) + EXIT_FRAMES / 60 + 0.05;
export const itemStart = (it: Item): number => {
  const ts = [it.t, it.labelAt, ...(it.items ?? []).map((x: any) => x.t)].filter((x) => typeof x === 'number');
  return Math.min(...ts);
};

// ---------------- text ----------------
const TextItem: React.FC<{it: Item}> = ({it}) => (
  <At dx={it.dx} dy={it.dy} align={it.align}>
    <Appear from={it.t} to={it.until} variant={it.variant}>
      {it.label ? <Label size={it.size}>{it.text}</Label> : <Txt size={it.size ?? 64} weight={it.weight ?? 900} color={color(it.color)}>{it.text}</Txt>}
    </Appear>
  </At>
);

// ---------------- list: жинақталатын нөмірлі тізім ----------------
const ListItem: React.FC<{it: Item}> = ({it}) => (
  <>
    {it.items.map((row: any, k: number) => (
      <At key={k} dx={it.dx} dy={it.dy + k * (it.gap ?? 88)} align="left">
        <Appear from={row.t} to={it.until}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            {row.n && <Txt size={(it.size ?? 60) * 0.53} weight={700} color={COLORS.accent}>{row.n}</Txt>}
            <Txt size={it.size ?? 60} weight={800}>{row.text}</Txt>
          </div>
        </Appear>
      </At>
    ))}
  </>
);

// ---------------- counter: санауыш (+ label, + «+», + sub) ----------------
const CounterValue: React.FC<{it: Item}> = ({it}) => {
  const frame = useAbsFrame();
  const frames = Math.round((it.dur ?? 1) * 60);
  const v = useCount(it.countFrom ?? it.t, it.v0 ?? 0, it.v1, frames);
  const done = frame >= sec(it.countFrom ?? it.t) + frames;
  let num: string;
  if (it.format === 'decimal') num = done && Number.isInteger(it.v1) ? String(it.v1) : v.toFixed(1).replace('.', ',');
  else num = formatInt(it.round ? Math.round(v / it.round) * it.round : v);
  const plus = it.plusAt !== undefined && frame >= sec(it.plusAt);
  const plusColor = it.color === 'accent' ? COLORS.text : COLORS.accent;
  return (
    <Txt size={it.size ?? 104} color={color(it.color)} tracking={-0.03}>
      {it.prefix ?? ''}
      {num}
      {it.suffix ?? ''}
      {plus && <span style={{color: plusColor}}>+</span>}
    </Txt>
  );
};

const CounterItem: React.FC<{it: Item}> = ({it}) => (
  <>
    {it.label && (
      <At dx={it.dx} dy={it.dy - 95}>
        <Appear from={it.t} to={it.until}><Label>{it.label}</Label></Appear>
      </At>
    )}
    <At dx={it.dx} dy={it.dy}>
      <Appear from={it.t + 0.05} to={it.until}><CounterValue it={it} /></Appear>
    </At>
    {it.sub && (
      <At dx={it.dx} dy={it.dy + (it.size ?? 104) * 0.85}>
        <Appear from={it.sub.at} to={it.until}><Txt size={40} weight={800} tracking={0.04}>{it.sub.text}</Txt></Appear>
      </At>
    )}
  </>
);

// ---------------- lowerThird: есім тақтасы ----------------
const LowerThird: React.FC<{it: Item}> = ({it}) => {
  const frame = useAbsFrame();
  const role = interpolate(frame, [sec(it.roleAt ?? it.t), sec(it.roleAt ?? it.t) + 18], [0, 1], {...clamp, easing: EASE_OUT});
  return (
    <div
      style={{
        width: 470, height: 132, borderRadius: 18, background: 'rgba(20,20,20,0.78)', border: '1px solid rgba(255,255,255,0.22)',
        position: 'relative', boxShadow: '0 12px 40px rgba(0,0,0,.4)',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 22, bottom: 22, width: 5, background: COLORS.accent, borderRadius: 3}} />
      <div style={{position: 'absolute', left: 30, top: 18}}>
        <Txt size={46} weight={400} tracking={0}>{it.name}</Txt>
      </div>
      <div style={{position: 'absolute', left: 30, top: 80, opacity: role, transform: `translateX(${(1 - role) * -12}px)`}}>
        <Txt size={26} weight={700} color={COLORS.accent} tracking={0}>{it.role}</Txt>
      </div>
    </div>
  );
};
const LowerThirdItem: React.FC<{it: Item}> = ({it}) => (
  <At dx={it.dx} dy={it.dy} align="left">
    <Appear from={it.t} to={it.until}><LowerThird it={it} /></Appear>
  </At>
);

// ---------------- logos: атауы айтылғанда «сплывать» ----------------
const LogosItem: React.FC<{it: Item}> = ({it}) => {
  const size = it.size ?? 225;
  const cols = it.cols ?? 2;
  const step = size + 25;
  const rows = Math.ceil(it.items.length / cols);
  return (
    <>
      {it.label && (
        <At dx={it.dx} dy={it.dy - (rows * step) / 2 - 30}>
          <Appear from={it.labelAt ?? it.items[0].t} to={it.until}><Label size={24}>{it.label}</Label></Appear>
        </At>
      )}
      {it.items.map((l: any, k: number) => {
        const c = k % cols;
        const r = Math.floor(k / cols);
        const n = Math.min(cols, it.items.length - r * cols);
        return (
          <At key={k} dx={it.dx + (c - (n - 1) / 2) * step} dy={it.dy + (r - (rows - 1) / 2) * step}>
            <Appear from={l.t} to={it.until} variant="pop"><Logo file={l.file} size={size} /></Appear>
          </At>
        );
      })}
    </>
  );
};

// ---------------- icons: адам иконкалары тобы (2–4 кадр offset) ----------------
const IconsItem: React.FC<{it: Item}> = ({it}) => (
  <>
    {(it.positions as [number, number, number][]).map(([dx, dy, size], k) => (
      <At key={k} dx={it.dx + dx} dy={it.dy + dy}>
        <Appear from={it.t + k * (4 / 60)} to={it.until} variant="pop">
          <PersonIcon size={size} color={k % 3 ? COLORS.text : COLORS.accent} />
        </Appear>
      </At>
    ))}
  </>
);

// ---------------- strike: сөз қызылға ауысып сызылады ----------------
const Strike: React.FC<{it: Item}> = ({it}) => {
  const frame = useAbsFrame();
  const red = frame >= sec(it.redAt);
  const p = interpolate(frame, [sec(it.redAt), sec(it.redAt) + 18], [0, 1], {...clamp, easing: EASE_OUT});
  return (
    <div style={{position: 'relative'}}>
      <Txt size={it.size ?? 66} color={red ? COLORS.negative : COLORS.text} style={{textShadow: '0 0 26px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.7)'}}>
        {it.text}
      </Txt>
      <div style={{position: 'absolute', left: -6, top: '52%', height: 7, width: `calc(${p * 100}% + 12px)`, opacity: red ? 1 : 0, background: '#fff', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,.4)'}} />
    </div>
  );
};
const StrikeItem: React.FC<{it: Item}> = ({it}) => (
  <At dx={it.dx} dy={it.dy}>
    <Appear from={it.t} to={it.until}><Strike it={it} /></Appear>
  </At>
);

// ---------------- checks: тізім + stagger ✓ ----------------
const ChecksItem: React.FC<{it: Item}> = ({it}) => (
  <>
    {it.items.map((row: any, k: number) => (
      <React.Fragment key={k}>
        <At dx={it.dx + 44} dy={it.dy + k * (it.gap ?? 80)} align="left">
          <Appear from={row.t} to={it.until}><Txt size={it.size ?? 50} weight={800}>{row.text}</Txt></Appear>
        </At>
        {it.checksAt !== undefined && (
          <At dx={it.dx} dy={it.dy + 2 + k * (it.gap ?? 80)}>
            <Appear from={it.checksAt + k * (3 / 60)} to={it.until} variant="pop"><Check size={44} /></Appear>
          </At>
        )}
      </React.Fragment>
    ))}
  </>
);

// ---------------- subscribe: YouTube батырмасы + доғалы курсор ----------------
const SubscribeBtn: React.FC<{it: Item}> = ({it}) => {
  const frame = useAbsFrame();
  const {fps} = useVideoConfig();
  const grow = spring({frame: frame - sec(it.t + 0.45), fps, config: SPRING, durationInFrames: 30});
  const clicked = frame >= sec(it.clickAt);
  const press = usePress(it.clickAt);
  const bell = spring({frame: frame - sec(it.clickAt) - 4, fps, config: SPRING, durationInFrames: 30});
  return (
    <div style={{position: 'relative', width: 560, height: 90}}>
      <div style={{display: 'flex', gap: 14, transform: `scale(${press})`, transformOrigin: '60% 50%'}}>
        <div style={{width: 225, height: 90, borderRadius: 18, background: '#FF0000', display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 22, boxShadow: '0 10px 30px rgba(0,0,0,.35)'}}>
          <svg width={46} height={34} viewBox="0 0 46 34"><rect width={46} height={34} rx={9} fill="#fff" /><path d="M18 9 L18 25 L31 17 Z" fill="#FF0000" /></svg>
          <span style={{fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#fff'}}>YouTube</span>
        </div>
        <div
          style={{
            width: 300 * Math.max(0, grow), height: 90, borderRadius: 18, overflow: 'hidden', background: clicked ? '#3A3A3A' : COLORS.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          }}
        >
          <span style={{fontFamily: FONT, fontWeight: 800, fontSize: 30, color: clicked ? '#fff' : COLORS.ink, opacity: grow > 0.8 ? 1 : 0}}>
            {clicked ? it.done ?? 'Subscribed' : it.label ?? 'SUBSCRIBE'}
          </span>
          {clicked && (
            <svg width={30} height={30} viewBox="0 0 24 24" style={{transform: `scale(${bell}) rotate(${(1 - bell) * -30}deg)`}}>
              <path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" fill={COLORS.accent} />
            </svg>
          )}
        </div>
      </div>
      {frame < sec(it.until) && <Cursor from={it.cursorFrom ?? it.clickAt - 0.85} travel={0.8} p0={[720, 230]} p1={[420, 46]} pressAt={it.clickAt} />}
    </div>
  );
};
const SubscribeItem: React.FC<{it: Item}> = ({it}) => (
  <At dx={it.dx} dy={it.dy}>
    <Appear from={it.t} to={it.until} variant="pop"><SubscribeBtn it={it} /></Appear>
  </At>
);

// ---------------- pause: ⏸ + мәтін ----------------
const PauseItem: React.FC<{it: Item}> = ({it}) => (
  <>
    <At dx={it.dx} dy={it.dy - 55}>
      <Appear from={it.t} to={it.until} variant="pop"><PauseIcon /></Appear>
    </At>
    <At dx={it.dx} dy={it.dy + 55}>
      <Appear from={it.t + 0.3} to={it.until}><Txt size={44} weight={800}>{it.text}</Txt></Appear>
    </At>
  </>
);

// ---------------- timer: N → 1 кері санақ сақинасы ----------------
const Timer: React.FC<{it: Item}> = ({it}) => {
  const frame = useAbsFrame();
  const count = it.count ?? 5;
  const step = it.step ?? 1.2;
  const el = (frame - sec(it.start ?? it.t)) / 60;
  const frac = Math.min(1, Math.max(0, 1 - el / (step * count)));
  const k = Math.floor(Math.max(0, el) / step);
  const n = Math.max(1, count - k);
  const bump = 1 + 0.18 * (1 - EASE_OUT(Math.min(1, (Math.max(0, el) - k * step) / 0.25)));
  const r = 84;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={190} height={190} viewBox="0 0 190 190" style={{filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.45))'}}>
      <circle cx={95} cy={95} r={r} fill="rgba(16,16,16,.7)" stroke="rgba(255,255,255,.18)" strokeWidth={8} />
      <circle cx={95} cy={95} r={r} fill="none" stroke={COLORS.accent} strokeWidth={8} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform="rotate(-90 95 95)" />
      <text x={95} y={95} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={900} fontSize={92} fill="#fff" style={{transformOrigin: '95px 95px', transform: `scale(${bump})`}}>
        {n}
      </text>
    </svg>
  );
};
const TimerItem: React.FC<{it: Item}> = ({it}) => (
  <>
    <At dx={it.dx} dy={it.dy}>
      <Appear from={it.t} to={it.until} variant="pop"><Timer it={it} /></Appear>
    </At>
    {it.label && (
      <At dx={it.dx} dy={it.dy + 135}>
        <Appear from={it.t + 0.3} to={it.until}><Label size={26}>{it.label}</Label></Appear>
      </At>
    )}
  </>
);

// ---------------- arrow ----------------
const ArrowItem: React.FC<{it: Item}> = ({it}) => (
  <At dx={it.dx} dy={it.dy}>
    <Appear from={it.t} to={it.until} variant="pop"><ArrowDown /></Appear>
  </At>
);

const REGISTRY: Record<string, React.FC<{it: Item}>> = {
  text: TextItem,
  list: ListItem,
  counter: CounterItem,
  lowerThird: LowerThirdItem,
  logos: LogosItem,
  icons: IconsItem,
  strike: StrikeItem,
  checks: ChecksItem,
  subscribe: SubscribeItem,
  pause: PauseItem,
  timer: TimerItem,
  arrow: ArrowItem,
};

export const RenderItem: React.FC<{it: Item}> = ({it}) => {
  const C = REGISTRY[it.type];
  if (!C) throw new Error(`timeline.json: белгісіз элемент типі "${it.type}"`);
  return <C it={it} />;
};
