import * as React from "react";
import type { Rect } from "../device";
import { Spring, clamp, easeOutBack, smooth, ticker } from "../physics";
import { useSpatial } from "./context";

export type FlyoutItem = { id: string; label: string; code?: string; icon?: React.ReactNode; color: string; /** 1 = outer arc (default), 2 = inner arc */ ring?: 1 | 2 };

export type EdgeFlyoutOptions = {
  side: "left" | "right";
  /** Region (viewport px) the membrane grows into; usually one screen half. */
  region: Rect;
  items: () => FlyoutItem[];
  current?: string;
  onSelect: (item: FlyoutItem) => void;
  /** A plain tap on the handle toggles the flyout (for glow handles; not for a rail full of buttons). */
  tapToggle?: boolean;
};

export type EdgeFlyoutController = {
  /** Spread onto any element to make it the pull handle. */
  handleProps: Pick<React.HTMLAttributes<HTMLElement>, "onPointerDown" | "onClickCapture">;
  /** Render inside the shell's overlay layer (covers the viewport). */
  overlay: React.ReactNode;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
};

const NODE = 36;

/**
 * Liquid-glass membrane pulled from a screen edge, with items fanning out on
 * one or two radial arcs. Release on a node to pick it; release past
 * `latchThreshold` to keep it open. Per-frame rendering is imperative.
 */
export function useEdgeFlyout(options: EdgeFlyoutOptions): EdgeFlyoutController {
  const { tokens, scale } = useSpatial();
  const opts = React.useRef(options);
  opts.current = options;
  const env = React.useRef({ tokens, scale });
  env.current = { tokens, scale };

  const s = React.useRef({ p: new Spring(0, { eps: 0.0008 }), anchorY: 0, hover: -1, latched: false, dragging: false, moved: false,
    down: null as null | { x: number; y: number }, list: [] as FlyoutItem[] }).current;
  const [list, setList] = React.useState<FlyoutItem[] | null>(null);
  const root = React.useRef<HTMLDivElement>(null), scrim = React.useRef<HTMLDivElement>(null), glass = React.useRef<HTMLDivElement>(null),
    rim = React.useRef<SVGPathElement>(null), nodes = React.useRef<(HTMLButtonElement | null)[]>([]);
  const dir = options.side === "left" ? 1 : -1;

  const geometry = React.useCallback((p: number) => {
    const t = env.current.tokens, r = opts.current.region, d = opts.current.side === "left" ? 1 : -1;
    const ex = d > 0 ? r.x : r.x + r.w, pc = Math.pow(Math.min(p, 1.12), 0.85), fan = (0.35 + 0.65 * smooth(0, 1, p)) * t.flyoutSpread * Math.PI / 180;
    const n2 = s.list.filter(i => i.ring === 2).length, n1 = s.list.length - n2;
    const R1 = (t.flyoutRadius + (n1 > 9 ? 26 : n1 > 6 ? 16 : 0)) * pc, R2 = R1 * 0.5;
    let i1 = 0, i2 = 0;
    return s.list.map(it => {
      const two = it.ring === 2, n = two ? n2 : n1, i = two ? i2++ : i1++, f = n === 1 ? 0 : i / (n - 1) - 0.5, a = f * fan * (two ? 0.9 : 1), R = two ? R2 : R1;
      return { x: ex + d * Math.cos(a) * R, y: s.anchorY + Math.sin(a) * R, f: two ? 0.35 + Math.abs(f) * 0.6 : f };
    });
  }, [s]);

  const clampY = (y: number) => {
    const t = env.current.tokens, r = opts.current.region, half = (t.flyoutRadius + 26) * Math.sin(t.flyoutSpread * Math.PI / 360) + 26;
    return clamp(y, r.y + Math.min(half, r.h / 2), r.y + Math.max(r.h - half, r.h / 2));
  };

  const build = () => { s.list = opts.current.items(); setList(s.list); };
  const close = React.useCallback(() => { s.latched = false; s.p.target = 0; s.hover = -1; }, [s]);
  const open = React.useCallback(() => {
    build(); s.anchorY = opts.current.region.y + opts.current.region.h / 2; s.latched = true; s.p.target = 1;
  }, [s]);   // eslint-disable-line react-hooks/exhaustive-deps
  const select = (i: number) => { const it = s.list[i]; close(); if (it) opts.current.onSelect(it); };

  // Per-frame membrane + node rendering while mounted.
  React.useEffect(() => {
    if (!list) return;
    return ticker.add(dt => {
      const t = env.current.tokens, r = opts.current.region, d = opts.current.side === "left" ? 1 : -1;
      if (!s.dragging) s.p.step(dt, t);
      const p = s.p.x;
      if (p <= 0.002 && !s.latched && !s.dragging) { setList(null); return; }
      const ay = s.anchorY, pc = Math.min(p, 1), bulge = (t.flyoutRadius + 56) * p, span = 170 + 95 * pc, c = span * t.membraneTension;
      const top = Math.max(r.y + 4, ay - span), bot = Math.min(r.y + r.h - 4, ay + span), ex = d > 0 ? r.x : r.x + r.w;
      const X = (v: number) => (ex + d * v).toFixed(1);
      const path = `M${X(0)} ${top} C${X(0)} ${top + c * 0.4} ${X(bulge)} ${ay - c} ${X(bulge)} ${ay} C${X(bulge)} ${ay + c} ${X(0)} ${bot - c * 0.4} ${X(0)} ${bot}Z`;
      if (scrim.current) { scrim.current.style.opacity = (pc * 0.5).toFixed(3); scrim.current.style.pointerEvents = s.latched ? "auto" : "none"; }
      if (glass.current) glass.current.style.clipPath = `path('${path}')`;
      if (rim.current) { rim.current.setAttribute("d", path); rim.current.style.opacity = String(Math.min(1, p * 1.4)); }
      geometry(p).forEach((g, i) => {
        const n = nodes.current[i]; if (!n) return;
        const tt = clamp((p - 0.12 - Math.abs(g.f) * 2 * 0.22) / 0.4, 0, 1);   // plop: centre first, ends last
        const sc = (t.reduceMotion ? (tt > 0 ? 1 : 0) : easeOutBack(tt)) * (i === s.hover ? 1.18 : 1);
        n.style.transform = `translate(${g.x - NODE / 2}px,${g.y - NODE / 2}px) scale(${sc.toFixed(3)})`;
        n.style.opacity = Math.min(1, tt * 3).toFixed(2);
        n.classList.toggle("is-hot", i === s.hover);
      });
    });
  }, [list, s, geometry]);

  const local = (e: PointerEvent) => {
    const rr = root.current!.getBoundingClientRect(), sc = env.current.scale;
    return [(e.clientX - rr.left) / sc, (e.clientY - rr.top) / sc] as const;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button > 0) return;
    s.down = { x: e.clientX, y: e.clientY };
    s.moved = false;
    const move = (ev: PointerEvent) => {
      if (!s.down) return;
      const sc = env.current.scale, t = env.current.tokens, dx = (ev.clientX - s.down.x) / sc * dir, dy = (ev.clientY - s.down.y) / sc;
      if (!s.dragging) {
        if (dx > t.pullSlop && dx > Math.abs(dy)) { s.dragging = s.moved = true; s.latched = false; build(); }
        else { if (Math.abs(dy) > 14) s.down = null; return; }
      }
      const [lx, ly] = local(ev), r = opts.current.region, pull = dir > 0 ? lx - r.x : r.x + r.w - lx;
      const raw = pull / Math.min(t.pullDistance, r.w * 0.62);
      s.p.snap(raw > 1 ? 1 + Math.min(0.14, (raw - 1) * 0.18) : Math.max(0, raw));   // rubber-band past full pull
      s.anchorY = clampY(ly);
      let best = -1, md = 30;
      geometry(s.p.x).forEach((g, i) => { const dd = Math.hypot(lx - g.x, ly - g.y); if (dd < md) { md = dd; best = i; } });
      s.hover = best;
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      if (s.dragging) {
        s.dragging = false;
        if (s.hover >= 0) select(s.hover);
        else if (s.p.x > env.current.tokens.latchThreshold) { s.latched = true; s.p.target = 1; }
        else s.p.target = 0;
      }
      s.down = null;
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (s.moved) { e.stopPropagation(); e.preventDefault(); s.moved = false; return; }
    const tgt = e.target as HTMLElement;
    if (opts.current.tapToggle && (tgt === e.currentTarget || tgt.parentElement === e.currentTarget)) (s.latched ? close() : open());
  };

  const overlay = (
    <div ref={root} className="sp-fly" data-side={options.side} aria-hidden={!list}>
      {list && <>
        <div ref={scrim} className="sp-fly-scrim" onClick={close} />
        <div ref={glass} className="sp-fly-glass" />
        <svg className="sp-fly-svg"><path ref={rim} className="sp-fly-rim" /></svg>
        {list.map((it, i) => (
          <button key={it.id} ref={el => { nodes.current[i] = el; }} type="button"
            className={["sp-fly-node", dir > 0 ? "is-left" : "is-right", it.id === options.current ? "is-current" : "", it.ring === 2 ? "is-inner" : ""].join(" ")}
            style={{ "--c": it.color } as React.CSSProperties} onClick={e => { e.stopPropagation(); select(i); }}>
            <span className="sp-fly-ic">{it.icon ?? it.code ?? "•"}</span><span className="sp-fly-lb">{it.label}</span>
          </button>
        ))}
      </>}
    </div>
  );

  return {
    handleProps: { onPointerDown, onClickCapture },
    overlay,
    open,
    close,
    toggle: () => (s.latched ? close() : open()),
    isOpen: () => s.latched || s.dragging,
  };
}
