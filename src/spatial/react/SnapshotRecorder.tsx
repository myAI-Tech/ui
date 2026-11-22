import * as React from "react";
import type { SnapshotStore, SpatialSnapshot } from "../persistence";
import { useFoldFrame, useSpatial } from "./context";

/**
 * Saves a SpatialSnapshot while the app runs: debounced on state/posture
 * changes, sampled from the fold clock, and flushed on pagehide so a reload
 * can restore state and animate the fold from its last angle. Renders nothing.
 *
 *   const store = browserSnapshotStore();
 *   const snap = store.load();
 *   <SpatialProvider initialState={snap?.state ?? fallback} resumeAngle={snap?.angle} …>
 *     <SnapshotRecorder store={store} />
 */
export function SnapshotRecorder({ store, delayMs = 400, onRestore }: { store: SnapshotStore; delayMs?: number; onRestore?: (snapshot: SpatialSnapshot) => void }) {
  const { state, posture, fold } = useSpatial();
  const angle = React.useRef(fold.frame().angle), timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoreRef = React.useRef(onRestore);
  restoreRef.current = onRestore;
  const latest = React.useRef({ state, posture });
  latest.current = { state, posture };
  const flush = React.useCallback(() => {
    clearTimeout(timer.current);
    const { state: s, posture: p } = latest.current;
    store.save({ v: 1, at: Date.now(), angle: angle.current, posture: p.kind, orientation: p.orientation, state: s });
  }, [store]);
  const schedule = React.useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(flush, delayMs); }, [flush, delayMs]);

  useFoldFrame(f => { if (Math.abs(f.angle - angle.current) > 0.5) { angle.current = f.angle; schedule(); } });
  React.useEffect(schedule, [state, posture, schedule]);
  React.useEffect(() => {
    const onHide = () => flush();
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const snapshot = store.load();
      if (snapshot) restoreRef.current?.(snapshot);
    };
    addEventListener("pagehide", onHide);
    addEventListener("pageshow", onShow);
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { removeEventListener("pagehide", onHide); removeEventListener("pageshow", onShow); document.removeEventListener("visibilitychange", onVis); clearTimeout(timer.current); };
  }, [flush, store]);
  return null;
}
