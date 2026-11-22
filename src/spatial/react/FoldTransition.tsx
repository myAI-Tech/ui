import * as React from "react";
import type { Rect } from "../device";
import type { FlowProfile } from "../experience";
import { Spring, clamp, lerp, smooth, ticker } from "../physics";
import { useSpatial } from "./context";
import { cx } from "./ExperienceView";

export type FlowItem = {
  id: string;
  /** Rect while folded (openness 0), in the transition's local px. */
  from: Rect;
  /** Rect when fully unfolded (openness 1). */
  to: Rect;
  flow: FlowProfile;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export type FoldTransitionProps = {
  width: number;
  height: number;
  /** X of the vertical crease in local px. */
  crease: number;
  /** Top margin melting elements back up against. */
  topMargin?: number;
  items: FlowItem[];
  /** Override the progress source (default: the provider's fold openness). */
  progress?: () => number;
  /** Static content that does not travel. */
  children?: React.ReactNode;
};

type Lane = { body: HTMLDivElement | null; blob: HTMLDivElement | null; drops: (HTMLDivElement | null)[]; fill: Spring };

const centre = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const;
const along = (pts: (readonly [number, number])[], t: number) => {
  const seg = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1])), tot = seg.reduce((a, b) => a + b, 0) || 1;
  let d = clamp(t, 0, 1) * tot, k = 0;
  while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; }
  const u = seg[k] ? d / seg[k] : 0;
  return [lerp(pts[k][0], pts[k + 1][0], u), lerp(pts[k][1], pts[k + 1][1], u)] as const;
};
const place = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
  const s = el.style; s.left = `${x}px`; s.top = `${y}px`; s.width = `${Math.max(0, w)}px`; s.height = `${Math.max(0, h)}px`;
};

/**
 * Moves elements between their folded and unfolded positions as a book-style
 * foldable opens. Melting items back up against the top margin, route into the
 * crease, run down it as a bead stream (merged by an SVG goo filter) and
 * re-solidify at the destination with a jelly settle. Everything except the
 * settle is a pure function of fold progress, so scrubbing the hinge scrubs it.
 */
export function FoldTransition({ width, height, crease, topMargin = 52, items, progress, children }: FoldTransitionProps) {
  const { fold, tokens } = useSpatial();
  const env = React.useRef({ tokens, items, progress });
  env.current = { tokens, items, progress };
  const lag = React.useRef(new Spring(progress?.() ?? fold.openness, { k: tokens.foldViscosityK, c: tokens.foldViscosityC }));
  const lanes = React.useRef<Lane[]>([]);
  lanes.current = items.map((_, i) => lanes.current[i] ?? { body: null, blob: null, drops: [], fill: new Spring(0, { k: tokens.jellyK, c: tokens.jellyC }) });

  const frame = React.useCallback((dt: number, now: number) => {
    const { tokens: t, items: its, progress: pg } = env.current;
    lag.current.target = pg?.() ?? fold.openness; lag.current.step(dt, t);
    const o = clamp(lag.current.x, 0, 1), n = its.length, st = t.flowStagger, span = Math.max(0.2, 1 - (n - 1) * st), sec = now / 1000;
    const tintMax = t.meltTint * 100;
    its.forEach((it, i) => {
      const lane = lanes.current[i], body = lane?.body; if (!body) return;
      const oi = clamp((o - i * st) / span, 0, 1), { from: A, to: B } = it, content = body.firstElementChild as HTMLElement | null;
      if (it.flow === "pin") { place(body, A.x, A.y, A.w, A.h); return; }
      if (it.flow === "crossfade") {
        const r = oi < 0.5 ? A : B; place(body, r.x, r.y, r.w, r.h);
        body.style.opacity = String(oi < 0.5 ? 1 - smooth(0, 0.35, oi) : smooth(0.65, 1, oi)); return;
      }
      if (it.flow === "slide") {
        const [ax, ay] = centre(A), [bx, by] = centre(B), tt = smooth(0.1, 0.9, oi);
        const crosses = (ax < crease) !== (bx < crease);   // same-side moves take the direct path
        const [cxp, cyp] = along(crosses ? [[ax, ay], [crease, ay], [crease, by], [bx, by]] : [[ax, ay], [bx, by]], tt);
        const w = lerp(A.w, B.w, tt), h = lerp(A.h, B.h, tt); place(body, cxp - w / 2, cyp - h / 2, w, h); return;
      }
      // melt
      const s1 = smooth(0, 0.2, oi), s2 = smooth(0.18, 0.45, oi), sl = smooth(0.18, 0.3, oi), gone = smooth(0.42, 0.52, oi);
      const towardLeft = crease < A.x + A.w / 2, grow = A.w * 0.06 * s1;
      const near0 = towardLeft ? A.x - grow : A.x + A.w + grow, far0 = towardLeft ? A.x + A.w + grow : A.x - grow;
      const near = lerp(near0, towardLeft ? crease - 11 : crease + 11, sl), far = lerp(far0, towardLeft ? crease + 11 : crease - 11, s2);
      const y = lerp(A.y, topMargin, s1), hh = lerp(A.h, A.h * 0.58, s1) * lerp(1, 0.34, s2) * (1 - gone);
      const f = lane.fill; f.k = t.jellyK; f.c = t.jellyC; f.target = smooth(0.46, 0.66, oi); f.step(dt, t);
      let x: number, yy: number, w: number, h: number, sy = 1, tint: number, vis: number;
      if (oi < 0.44) { x = Math.min(near, far); w = Math.abs(far - near); yy = y; h = hh; tint = tintMax * s1; vis = 1 - smooth(0.03, 0.15, oi); }
      else {
        const fc = clamp(f.x, 0, 1); sy = f.x > 1 ? 1 + (f.x - 1) * 1.4 : 1;   // jelly overshoot
        h = B.h * fc; w = lerp(B.w * 0.6, B.w, smooth(0, 0.6, fc)); x = B.x + (B.w - w) / 2; yy = B.y + B.h - h;
        tint = tintMax * (1 - smooth(0.7, 1, fc)); vis = smooth(0.75, 1, fc);
      }
      const tr = `scale(${(1 / Math.sqrt(sy)).toFixed(3)},${sy.toFixed(3)})`;
      for (const el of [body, lane.blob]) if (el) { place(el, x, yy, w, h); el.style.transform = tr; el.style.transformOrigin = "50% 100%"; }
      if (lane.blob) lane.blob.style.background = `color-mix(in srgb, var(--sp-accent) ${Math.round(tint)}%, var(--sp-surface-2))`;
      if (content) content.style.opacity = vis.toFixed(2);
      body.style.pointerEvents = vis > 0.5 ? "" : "none";
      body.style.borderColor = `color-mix(in srgb, var(--sp-line-2) ${Math.round(vis * 100)}%, transparent)`;
      // stream down the crease
      const endY = B.y + B.h - 16, endX = B.x + B.w * 0.6, route: [number, number][] = [[crease, topMargin + 24], [crease, endY], [endX, endY]];
      const L = Math.hypot(0, endY - topMargin - 24) + Math.abs(endX - crease);
      const head = smooth(0.24, 0.52, oi), tail = smooth(0.44, 0.74, oi), live = (head - tail) * L > 1, nd = lane.drops.length;
      lane.drops.forEach((d, k) => {
        if (!d) return;
        if (!live) { d.style.opacity = "0"; return; }
        const u = nd === 1 ? 1 : k / (nd - 1), [px, py] = along(route, lerp(tail, head, u)), r = (u > 0.92 ? 7 : 10) + Math.sin(sec * 9 + k) * 1.2;
        d.style.opacity = "1"; d.style.width = d.style.height = `${2 * r}px`; d.style.transform = `translate(${(px - r).toFixed(1)}px,${(py - r).toFixed(1)}px)`;
      });
    });
  }, [fold, crease, topMargin]);

  React.useLayoutEffect(() => { frame(0, performance.now()); }, [frame, items]);
  React.useEffect(() => ticker.add(frame), [frame]);

  const melts = items.filter(it => it.flow === "melt").length > 0;
  return (
    <div className="sp-flow" style={{ width, height }}>
      {children}
      {melts && (
        <div className="sp-goo-wrap"><div className="sp-goo">
          {items.map((it, i) => it.flow !== "melt" ? null : (
            <React.Fragment key={it.id}>
              {Array.from({ length: tokens.meltDroplets }, (_, k) => <div key={k} className="sp-drop" ref={el => { lanes.current[i].drops[k] = el; }} />)}
              <div className="sp-blob" ref={el => { lanes.current[i].blob = el; }} />
            </React.Fragment>
          ))}
        </div></div>
      )}
      {items.map((it, i) => (
        <div key={it.id} ref={el => { lanes.current[i].body = el; }} className={cx("sp-flow-item", `is-${it.flow}`, it.className)} onClick={it.onClick}>
          <div className="sp-flow-c">{it.children}</div>
        </div>
      ))}
    </div>
  );
}

/** The SVG goo filter FoldTransition relies on. Render once per document (SpatialShell does). */
export function GooFilter({ id = "sp-goo" }: { id?: string }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs><filter id={id} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b" />
        <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
      </filter></defs>
    </svg>
  );
}
