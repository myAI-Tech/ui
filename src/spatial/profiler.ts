export type SpatialLifecycleEvent = {
  type: "pagehide" | "pageshow" | "visibility" | "orientation" | "resize";
  at: number;
  detail?: string;
};

export type SpatialProfilerSnapshot = {
  sampledAt: number;
  frameCount: number;
  averageFps: number;
  p95FrameMs: number;
  droppedFrames: number;
  averageTickerCostMs: number;
  reactCommits: number;
  averageCommitMs: number;
  longTasks: number;
  layoutShiftScore: number;
  lifecycle: SpatialLifecycleEvent[];
};

type FrameSample = { frameMs: number; costMs: number };

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

/** Low-overhead metrics store. Sampling never flows through SpatialContext. */
export class SpatialProfilerStore {
  private frames: FrameSample[] = [];
  private commits: number[] = [];
  private events: SpatialLifecycleEvent[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private longTasks = 0;
  private layoutShiftScore = 0;
  private current = this.calculate();

  recordFrame(frameMs: number, costMs: number) {
    this.frames.push({ frameMs, costMs });
    if (this.frames.length > 240) this.frames.splice(0, this.frames.length - 240);
    this.schedule();
  }

  recordCommit(durationMs: number) {
    this.commits.push(durationMs);
    if (this.commits.length > 100) this.commits.shift();
    this.schedule();
  }

  recordLongTask() { this.longTasks++; this.schedule(); }
  recordLayoutShift(value: number) { if (Number.isFinite(value)) this.layoutShiftScore += value; this.schedule(); }

  recordLifecycle(type: SpatialLifecycleEvent["type"], detail?: string) {
    this.events.push({ type, detail, at: Date.now() });
    if (this.events.length > 20) this.events.shift();
    this.schedule();
  }

  reset() {
    this.frames = [];
    this.commits = [];
    this.events = [];
    this.longTasks = 0;
    this.layoutShiftScore = 0;
    this.publish();
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.current;

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.publish(); }, 250);
  }

  private publish() {
    this.current = this.calculate();
    this.listeners.forEach(listener => listener());
  }

  private calculate(): SpatialProfilerSnapshot {
    const frameMs = this.frames.map(sample => sample.frameMs), costMs = this.frames.map(sample => sample.costMs);
    return {
      sampledAt: Date.now(),
      frameCount: this.frames.length,
      averageFps: frameMs.length ? 1000 / average(frameMs) : 0,
      p95FrameMs: percentile(frameMs, 0.95),
      droppedFrames: frameMs.filter(value => value > 25).length,
      averageTickerCostMs: average(costMs),
      reactCommits: this.commits.length,
      averageCommitMs: average(this.commits),
      longTasks: this.longTasks,
      layoutShiftScore: this.layoutShiftScore,
      lifecycle: [...this.events],
    };
  }
}

export const spatialProfiler = new SpatialProfilerStore();

const activeFrameStores = new Set<SpatialProfilerStore>();
export let activeSpatialProfilerCount = 0;

export function activateSpatialProfiler(store: SpatialProfilerStore) {
  activeFrameStores.add(store);
  activeSpatialProfilerCount = activeFrameStores.size;
  return () => { activeFrameStores.delete(store); activeSpatialProfilerCount = activeFrameStores.size; };
}

/** @internal Called by the shared ticker only while a profiler boundary is active. */
export function recordSpatialFrame(frameMs: number, costMs: number) {
  activeFrameStores.forEach(store => store.recordFrame(frameMs, costMs));
}
