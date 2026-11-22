import * as React from "react";
import { activateSpatialProfiler, spatialProfiler, type SpatialProfilerSnapshot, type SpatialProfilerStore } from "../profiler";

export function useSpatialProfiler(store: SpatialProfilerStore = spatialProfiler): SpatialProfilerSnapshot {
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** Adds React/lifecycle/browser performance observations around a spatial shell. */
export function SpatialProfiler({ children, store = spatialProfiler }: { children: React.ReactNode; store?: SpatialProfilerStore }) {
  React.useEffect(() => {
    const deactivate = activateSpatialProfiler(store);
    const lifecycle = (type: "pagehide" | "pageshow" | "orientation" | "resize") => () => store.recordLifecycle(type);
    const onPageHide = lifecycle("pagehide"), onPageShow = lifecycle("pageshow"), onOrientation = lifecycle("orientation"), onResize = lifecycle("resize");
    const onVisibility = () => store.recordLifecycle("visibility", document.visibilityState);
    addEventListener("pagehide", onPageHide);
    addEventListener("pageshow", onPageShow);
    addEventListener("orientationchange", onOrientation);
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    const observers: PerformanceObserver[] = [];
    if (typeof PerformanceObserver !== "undefined") {
      const supported = PerformanceObserver.supportedEntryTypes ?? [];
      if (supported.includes("longtask")) {
        const observer = new PerformanceObserver(list => list.getEntries().forEach(() => store.recordLongTask()));
        observer.observe({ entryTypes: ["longtask"] });
        observers.push(observer);
      }
      if (supported.includes("layout-shift")) {
        const observer = new PerformanceObserver(list => list.getEntries().forEach(entry => {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) store.recordLayoutShift(shift.value ?? 0);
        }));
        observer.observe({ entryTypes: ["layout-shift"] });
        observers.push(observer);
      }
    }
    return () => {
      removeEventListener("pagehide", onPageHide);
      removeEventListener("pageshow", onPageShow);
      removeEventListener("orientationchange", onOrientation);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observers.forEach(observer => observer.disconnect());
      deactivate();
    };
  }, [store]);

  return <React.Profiler id="spatial-shell" onRender={(_, __, duration) => store.recordCommit(duration)}>{children}</React.Profiler>;
}
