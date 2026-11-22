import { clamp } from "./physics";
import type { CreaseAxis, FoldState, Rect } from "./device";
import type { PhysicsTokens } from "./tokens";

/**
 * A hinge reading from whatever the platform can tell us. Sources differ wildly
 * in fidelity: native code may stream an exact angle, the web platform only
 * offers a discrete posture plus viewport segments, and the lab simulates.
 * Every reading becomes a *target* for one shared hinge spring, so animation is
 * smooth regardless of fidelity or sensor jitter.
 */
export type HingeReading = {
  /** Degrees, 0 = closed, 180 = flat. Null when the source has no angle. */
  angle: number | null;
  fold: FoldState | null;
  axis: CreaseAxis | null;
  /** Display segments in CSS px, when the platform reports them. */
  segments: Rect[] | null;
  source: string;
  at: number;
};

export type HingeCapabilities = { continuousAngle: boolean; discretePosture: boolean; segments: boolean };

export interface HingeSource {
  readonly id: string;
  readonly capabilities: HingeCapabilities;
  read(): HingeReading;
  subscribe(listener: (r: HingeReading) => void): () => void;
}

/** The angle the hinge spring should aim at for a reading. */
export function targetAngle(r: HingeReading, t: PhysicsTokens): number {
  if (r.angle != null) return clamp(r.angle, 0, 180);
  if (r.fold) return t.discreteAngles[r.fold];
  return 180;
}

function emitter() {
  const ls = new Set<(r: HingeReading) => void>();
  return {
    emit: (r: HingeReading) => ls.forEach(l => l(r)),
    subscribe: (l: (r: HingeReading) => void) => { ls.add(l); return () => { ls.delete(l); }; },
    get size() { return ls.size; },
  };
}

/** Lab / Storybook / tests: a hinge you drive yourself. */
export function simulatedHinge(initial = 180): HingeSource & { set(angle: number): void } {
  let reading: HingeReading = { angle: initial, fold: null, axis: null, segments: null, source: "simulated", at: Date.now() };
  const ev = emitter();
  return {
    id: "simulated",
    capabilities: { continuousAngle: true, discretePosture: false, segments: false },
    read: () => reading,
    subscribe: ev.subscribe,
    set(angle: number) { reading = { ...reading, angle: clamp(angle, 0, 180), at: Date.now() }; ev.emit(reading); },
  };
}

type PostureApi = { type?: "continuous" | "folded"; addEventListener?(t: "change", f: () => void): void; removeEventListener?(t: "change", f: () => void): void };
type SegmentsHost = { viewport?: { segments?: DOMRect[] | null }; visualViewport?: { segments?: DOMRect[] | null } | null };

/**
 * Browser APIs only: Device Posture API (`navigator.devicePosture`, discrete
 * continuous | folded) and the Viewport Segments API (`window.viewport.segments`
 * plus the `horizontal-/vertical-viewport-segments` media features). Neither
 * gives an angle, so animation runs from the discrete-angle synthesizer.
 */
export function webHinge(win: Window = window): HingeSource {
  const nav = win.navigator as Navigator & { devicePosture?: PostureApi };
  const host = win as unknown as SegmentsHost;
  const hSeg = win.matchMedia?.("(horizontal-viewport-segments: 2)");
  const vSeg = win.matchMedia?.("(vertical-viewport-segments: 2)");
  const read = (): HingeReading => {
    const segs = host.viewport?.segments ?? host.visualViewport?.segments ?? null;
    const axis: CreaseAxis | null = hSeg?.matches ? "vertical" : vSeg?.matches ? "horizontal" : null;
    const posture = nav.devicePosture?.type;
    const fold: FoldState | null = posture === "folded" ? "half" : posture === "continuous" ? "flat" : null;
    return { angle: null, fold, axis, segments: segs ? [...segs].map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height })) : null, source: "web", at: Date.now() };
  };
  const ev = emitter();
  const fire = () => ev.emit(read());
  const listenMq = (mq: MediaQueryList | undefined) => mq?.addEventListener ? mq.addEventListener("change", fire) : mq?.addListener?.(fire);
  const unlistenMq = (mq: MediaQueryList | undefined) => mq?.removeEventListener ? mq.removeEventListener("change", fire) : mq?.removeListener?.(fire);
  return {
    id: "web",
    capabilities: { continuousAngle: false, discretePosture: !!nav.devicePosture, segments: !!(hSeg || host.viewport) },
    read,
    subscribe(l) {
      const off = ev.subscribe(l);
      if (ev.size === 1) {
        win.addEventListener("resize", fire);
        win.addEventListener("orientationchange", fire);
        win.addEventListener("pageshow", fire);
        win.visualViewport?.addEventListener("resize", fire);
        nav.devicePosture?.addEventListener?.("change", fire);
        listenMq(hSeg);
        listenMq(vSeg);
      }
      return () => {
        off();
        if (ev.size === 0) {
          win.removeEventListener("resize", fire);
          win.removeEventListener("orientationchange", fire);
          win.removeEventListener("pageshow", fire);
          win.visualViewport?.removeEventListener("resize", fire);
          nav.devicePosture?.removeEventListener?.("change", fire);
          unlistenMq(hSeg);
          unlistenMq(vSeg);
        }
      };
    },
  };
}

type NativeWindow = Window & {
  webkit?: { messageHandlers?: Record<string, { postMessage(m: unknown): void }> };
  MyAIHinge?: { subscribe?(): void; unsubscribe?(): void };
  __myaiHinge?: (r: Partial<HingeReading>) => void;
};

/**
 * Native host (WKWebView on iOS, WebView on Android) streams readings into the
 * page. Contract (see docs/14-spatial-interface.md §5):
 *  - page → native: `webkit.messageHandlers[channel].postMessage({ type: "subscribe" | "unsubscribe" })`
 *    (Android: `window.MyAIHinge.subscribe()`)
 *  - native → page: `window.__myaiHinge({ angle, fold, axis, segments })` via evaluateJavaScript
 * Only the native host can call `__myaiHinge`; postMessage from other frames is ignored.
 */
export function nativeBridgeHinge({ channel = "myaiHinge", win = window as NativeWindow } = {}): HingeSource {
  let reading: HingeReading = { angle: null, fold: null, axis: null, segments: null, source: "native", at: 0 };
  const ev = emitter();
  const send = (type: "subscribe" | "unsubscribe") => {
    win.webkit?.messageHandlers?.[channel]?.postMessage({ type });
    type === "subscribe" ? win.MyAIHinge?.subscribe?.() : win.MyAIHinge?.unsubscribe?.();
  };
  const onHide = () => send("unsubscribe");
  const onShow = () => { send("subscribe"); ev.emit(reading); };
  return {
    id: "native",
    capabilities: { continuousAngle: true, discretePosture: true, segments: true },
    read: () => reading,
    subscribe(l) {
      const off = ev.subscribe(l);
      if (ev.size === 1) {
        win.__myaiHinge = r => { reading = { ...reading, ...r, source: "native", at: Date.now() }; ev.emit(reading); };
        send("subscribe");
        win.addEventListener("pagehide", onHide);
        win.addEventListener("pageshow", onShow);
      }
      return () => { off(); if (ev.size === 0) {
        send("unsubscribe");
        win.removeEventListener("pagehide", onHide);
        win.removeEventListener("pageshow", onShow);
        delete win.__myaiHinge;
      } };
    },
  };
}

/** True when a native host has installed a hinge bridge. */
export function hasNativeHinge(win: Window = window, channel = "myaiHinge") {
  const w = win as NativeWindow;
  return !!(w.webkit?.messageHandlers?.[channel] || w.MyAIHinge);
}

const detectedSources = new WeakMap<Window, HingeSource>();

/** Best available source: native bridge → web posture APIs → a flat simulated hinge. */
export function detectHinge(win: Window = window): HingeSource {
  const existing = detectedSources.get(win);
  if (existing) return existing;
  const nav = win.navigator as Navigator & { devicePosture?: unknown };
  const source = hasNativeHinge(win) ? nativeBridgeHinge({ win: win as NativeWindow })
    : nav.devicePosture || (win as unknown as SegmentsHost).viewport ? webHinge(win)
      : simulatedHinge(180);
  detectedSources.set(win, source);
  return source;
}
