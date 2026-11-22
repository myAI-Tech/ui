import * as React from "react";
import { measuredDevice, type DeviceProfile, type MeasureOptions, type Orientation, type Rect } from "../device";

type SegmentsHost = { viewport?: { segments?: DOMRect[] | null }; visualViewport?: { segments?: DOMRect[] | null } | null };

/** What the browser reports right now: window size plus viewport segments, if any. */
export function readViewport(win: Window = window): { size: { w: number; h: number }; segments: Rect[] | null } {
  const host = win as unknown as SegmentsHost, segs = host.viewport?.segments ?? host.visualViewport?.segments ?? null;
  return { size: { w: win.innerWidth, h: win.innerHeight }, segments: segs && segs.length > 1 ? [...segs].map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height })) : null };
}

/** Live device profile + orientation measured from the real window (resize, rotation, fold segment changes). */
export function useMeasuredDevice(opts: MeasureOptions = {}): { device: DeviceProfile; orientation: Orientation } {
  const { chrome, compactBelow } = opts;
  const measure = React.useCallback(() => { const v = readViewport(); return measuredDevice(v.size, v.segments, { chrome, compactBelow }); }, [chrome, compactBelow]);
  const [m, setM] = React.useState(measure);
  React.useEffect(() => {
    let raf = 0;
    const update = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setM(prev => {
      const next = measure();
      const same = JSON.stringify(prev) === JSON.stringify(next);   // keep identity so the provider doesn't re-render on no-op resizes
      return same ? prev : next;
    })); };
    const mqs = ["(horizontal-viewport-segments: 2)", "(vertical-viewport-segments: 2)"].map(q => matchMedia(q));
    const listenMq = (mq: MediaQueryList) => mq.addEventListener ? mq.addEventListener("change", update) : mq.addListener?.(update);
    const unlistenMq = (mq: MediaQueryList) => mq.removeEventListener ? mq.removeEventListener("change", update) : mq.removeListener?.(update);
    addEventListener("resize", update);
    addEventListener("orientationchange", update);
    addEventListener("pageshow", update);
    visualViewport?.addEventListener("resize", update);
    mqs.forEach(listenMq);
    update();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", update);
      removeEventListener("orientationchange", update);
      removeEventListener("pageshow", update);
      visualViewport?.removeEventListener("resize", update);
      mqs.forEach(unlistenMq);
    };
  }, [measure]);
  return m;
}
