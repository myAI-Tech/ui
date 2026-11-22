import { clamp } from "./physics";
import type { PhysicsTokens } from "./tokens";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Orientation = "portrait" | "landscape";
export type FoldState = "closed" | "half" | "flat";
export type CreaseAxis = "vertical" | "horizontal";

export type DeviceProfile = {
  id: string;
  label: string;
  kind: "slab" | "foldable" | "tablet" | "desktop";
  /** Portrait size of the main display. For a foldable this is the cover screen. */
  screen: Size;
  /** Foldable inner display, described as one half in book orientation. Continuous displays have creaseWidth 0. */
  inner?: { half: Size; creaseWidth: number };
  /** Where global controls live: a right control rail, or floating buttons over full-width content. */
  chrome: "rail" | "floating";
  frame: { bezel: number; radius: number; innerRadius?: number; island?: boolean };
  /** Managed tiles available on large displays (experimental). */
  maxTiles?: 1 | 2 | 3 | 4;
};

// Dimensions are CSS px. The iPhone Duo values are placeholders until real specs exist.
export const devices = {
  slab: { id: "slab", label: "Slab phone", kind: "slab", screen: { w: 390, h: 844 }, chrome: "floating", frame: { bezel: 12, radius: 48, island: true } },
  iphoneDuo: {
    id: "iphone-duo", label: "iPhone Duo", kind: "foldable", screen: { w: 520, h: 740 },
    inner: { half: { w: 520, h: 740 }, creaseWidth: 0 }, chrome: "rail", frame: { bezel: 10, radius: 46, innerRadius: 38, island: true },
  },
  ipadPro: { id: "ipad-pro", label: "iPad Pro", kind: "tablet", screen: { w: 1024, h: 1366 }, chrome: "rail", frame: { bezel: 18, radius: 34 }, maxTiles: 4 },
  desktop: { id: "desktop", label: "Desktop", kind: "desktop", screen: { w: 1680, h: 1050 }, chrome: "rail", frame: { bezel: 8, radius: 12 }, maxTiles: 4 },
} satisfies Record<string, DeviceProfile>;

/**
 * Posture is what layouts react to. It only changes at thresholds, so it is
 * React state; the continuous angle/openness is delivered per frame instead.
 *  - single  slab / tablet with one surface
 *  - cover   foldable closed, cover screen
 *  - book    foldable open with a vertical crease (fold = half | flat)
 *  - laptop  foldable half-open with a horizontal crease: app on top, deck below
 *  - canvas  foldable flat with a horizontal crease: one tall surface
 *  - tiles   large display with managed tiles
 */
export type PostureKind = "single" | "cover" | "book" | "laptop" | "canvas" | "tiles";
export type Posture = { kind: PostureKind; fold: FoldState | null; axis: CreaseAxis | null; orientation: Orientation };

export function foldStateFor(angle: number, t: PhysicsTokens): FoldState {
  return angle < t.closedBelow ? "closed" : angle < t.halfFoldBelow ? "half" : "flat";
}

export function computePosture(device: DeviceProfile, orientation: Orientation, angle: number, t: PhysicsTokens): Posture {
  if (device.kind === "foldable" && device.inner) {
    const fold = foldStateFor(angle, t);
    if (fold === "closed") return { kind: "cover", fold, axis: null, orientation };
    if (orientation === "portrait") return { kind: "book", fold, axis: "vertical", orientation };
    return { kind: fold === "half" ? "laptop" : "canvas", fold, axis: "horizontal", orientation };
  }
  if (device.maxTiles && device.maxTiles > 1) return { kind: "tiles", fold: null, axis: null, orientation };
  return { kind: "single", fold: null, axis: null, orientation };
}

export const samePosture = (a: Posture, b: Posture) =>
  a.kind === b.kind && a.fold === b.fold && a.axis === b.axis && a.orientation === b.orientation;

/** 0 → 1 as a book-style foldable unfolds; drives fold transitions. Always 1 on displays that don't fold. */
export function foldOpenness(device: DeviceProfile, orientation: Orientation, angle: number, t: PhysicsTokens): number {
  if (device.kind !== "foldable") return 1;
  if (orientation === "landscape") return angle < t.closedBelow ? 0 : 1;
  return clamp((angle - t.closedBelow - 2) / 150, 0, 1);
}

export type ViewportLayout = {
  /** Full drawable size, including parts hidden while folded. */
  w: number;
  h: number;
  /** Where experiences render. */
  app: Rect;
  /** Crease position in viewport coordinates (null on unfolded / non-foldable displays). */
  crease: { axis: CreaseAxis; at: number } | null;
  /** Half-fold lower surface (laptop deck), if any. */
  deck: Rect | null;
};

export function viewportFor(device: DeviceProfile, posture: Posture): ViewportLayout {
  const land = posture.orientation === "landscape";
  if (device.kind === "foldable" && device.inner) {
    const { w: hw, h: hh } = device.inner.half;
    if (!land) {   // book: the cover sits on the right half's footprint, the left half unfolds from it
      const app = posture.kind === "cover" ? { x: hw, y: 0, w: hw, h: hh } : { x: 0, y: 0, w: hw * 2, h: hh };
      return { w: hw * 2, h: hh, app, crease: posture.kind === "book" ? { axis: "vertical", at: hw } : null, deck: null };
    }
    const top = { x: 0, y: 0, w: hh, h: hw };
    return {
      w: hh, h: hw * 2,
      app: posture.kind === "canvas" ? { x: 0, y: 0, w: hh, h: hw * 2 } : top,
      crease: posture.kind === "cover" ? null : { axis: "horizontal", at: hw },
      deck: posture.kind === "laptop" ? { x: 0, y: hw, w: hh, h: hw } : null,
    };
  }
  const { w, h } = land && device.kind !== "desktop" ? { w: device.screen.h, h: device.screen.w } : device.screen;   // desktops don't rotate
  return { w, h, app: { x: 0, y: 0, w, h }, crease: null, deck: null };
}

export type InnerMode = "split" | "span";
export type SurfaceSide = "left" | "right" | "single" | "tile";
export type Surface = Rect & {
  /** Index into SpatialState.slots. 0 = primary (cover / right half / span); 1 = left half; 2–3 large displays only. */
  slot: number;
  side: SurfaceSide;
  /** True when the control rail overlays this surface's right edge. */
  rail: boolean;
  /** True when floating controls overlay this surface's top edge. */
  floating: boolean;
  /** True when one experience covers both halves of an unfolded display. */
  span: boolean;
};

export function surfacesFor(device: DeviceProfile, posture: Posture, vp: ViewportLayout, inner: InnerMode, tiles = 2, tileRatio = 0.5): Surface[] {
  const { app } = vp, rail = device.chrome === "rail", floating = device.chrome === "floating";
  const one = (extra: Partial<Surface> = {}): Surface => ({ ...app, slot: 0, side: "single", rail, floating, span: false, ...extra });
  if (posture.kind === "book") {
    if (inner === "span") return [one({ span: true })];
    const half = app.w / 2;
    return [
      { x: app.x, y: app.y, w: half, h: app.h, slot: 1, side: "left", rail: false, floating, span: false },
      { x: app.x + half, y: app.y, w: half, h: app.h, slot: 0, side: "right", rail, floating, span: false },
    ];
  }
  if (posture.kind !== "tiles") return [one()];
  const n = clamp(tiles, 1, device.maxTiles ?? 1), g = 10, W = app.w, H = app.h;
  const w1 = Math.round((W - g) * (n === 2 ? tileRatio : 0.5)), h2 = Math.round((H - g) / 2), xr = w1 + g, wr = W - xr;
  const grid: Record<number, [number, number, number, number, number][]> = {
    1: [[0, 0, 0, W, H]],
    2: [[1, 0, 0, w1, H], [0, xr, 0, wr, H]],
    3: [[1, 0, 0, w1, H], [0, xr, 0, wr, h2], [2, xr, h2 + g, wr, H - h2 - g]],
    4: [[1, 0, 0, w1, h2], [0, xr, 0, wr, h2], [2, 0, h2 + g, w1, H - h2 - g], [3, xr, h2 + g, wr, H - h2 - g]],
  };
  return grid[n].map(([slot, x, y, w, h]) => ({ x, y, w, h, slot, side: "tile" as const, rail: rail && x + w >= W - 1, floating, span: false }));
}

/** Which slot each spatial handle drives, and the region its flyout occupies. */
export function handleTargets(posture: Posture, vp: ViewportLayout, inner: InnerMode, focus: number) {
  const { app } = vp;
  if (posture.kind === "book" && inner === "split") {
    const half = app.w / 2;
    return { left: { slot: 1, region: { ...app, w: half } }, right: { slot: 0, region: { ...app, x: app.x + half, w: half } } };
  }
  const slot = posture.kind === "tiles" ? focus : 0;
  return { left: { slot: posture.kind === "book" ? 1 : slot, region: app }, right: { slot, region: app } };
}
