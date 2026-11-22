/**
 * Physics & layout tokens for the spatial interface. Every animated or
 * threshold-driven behaviour reads from here, so a product can retune the
 * feel without touching components. See docs/13-spatial-interface.md.
 */
export type PhysicsTokens = {
  // ── Edge flyout (liquid-glass radial menu) ───────────────────────────
  /** Radius of the outer node arc, px. Grows automatically for >6 / >9 items. */
  flyoutRadius: number;
  /** Total fan angle of each arc, degrees. */
  flyoutSpread: number;
  /** Bezier control-point ratio of the membrane; higher = rounder bulge. */
  membraneTension: number;
  /** Pull progress (0–1) past which a released pull stays open. */
  latchThreshold: number;
  /** Pull distance (px) that maps to progress = 1, before region clamping. */
  pullDistance: number;
  /** Drag distance (px) before an edge press becomes a pull rather than a tap. */
  pullSlop: number;

  // ── Glass ─────────────────────────────────────────────────────────────
  glassAlpha: number;
  glassBlur: number;

  // ── Springs ───────────────────────────────────────────────────────────
  /** Default spring stiffness (k) for UI motion. */
  springStiffness: number;
  /** Default spring damping (c). c < 2·√k is underdamped (overshoots). */
  springDamping: number;

  // ── Fold ──────────────────────────────────────────────────────────────
  /** Spring that smooths every hinge reading into the animated angle. */
  hingeStiffness: number;
  hingeDamping: number;
  /** Viscous lag between the angle and the melt animation's openness. */
  foldViscosityK: number;
  foldViscosityC: number;
  /** Jelly spring used when a melted element re-solidifies. */
  jellyK: number;
  jellyC: number;
  /** Accent mix (0–1) of an element while it is molten. */
  meltTint: number;
  /** Beads per melting element; the goo filter merges them into one stream. */
  meltDroplets: number;
  /** Fraction of the fold each subsequent element waits before it starts. */
  flowStagger: number;

  // ── Posture thresholds, degrees ───────────────────────────────────────
  /** Below this the device is closed (cover screen). */
  closedBelow: number;
  /** Between closedBelow and this the device is half-folded (laptop / tent). */
  halfFoldBelow: number;
  /** Angles the synthesizer targets when a source only reports discrete states. */
  discreteAngles: { closed: number; half: number; flat: number };

  // ── Layout ────────────────────────────────────────────────────────────
  /** Surface area (px²) below which a multi-pane experience condenses (tabs / banner). */
  compactArea: number;
  /** Width at which a multi-pane experience may split into two halves on one surface. */
  twoUpMinWidth: number;
  /** Divider snaps to the crease within this ratio distance. */
  creaseSnap: number;
  dividerMin: number;
  dividerMax: number;
  /** Spatial handle centre as a fraction of the surface height from the top (0.7 ≈ 30% from bottom). */
  handlePosition: number;
  /** Horizontal swipe distance (px) / velocity (px/s) that steps a slot's experience. */
  swipeDistance: number;
  swipeVelocity: number;

  /** Snap every spring to its target; honours prefers-reduced-motion by default. */
  reduceMotion: boolean;
};

export const defaultPhysics: PhysicsTokens = {
  flyoutRadius: 150,
  flyoutSpread: 136,
  membraneTension: 0.62,
  latchThreshold: 0.45,
  pullDistance: 220,
  pullSlop: 8,

  glassAlpha: 0.62,
  glassBlur: 18,

  springStiffness: 240,
  springDamping: 24,

  hingeStiffness: 90,
  hingeDamping: 19,
  foldViscosityK: 55,
  foldViscosityC: 13,
  jellyK: 150,
  jellyC: 11,
  meltTint: 0.22,
  meltDroplets: 28,
  flowStagger: 0.14,

  closedBelow: 2,
  halfFoldBelow: 150,
  discreteAngles: { closed: 0, half: 100, flat: 180 },

  compactArea: 500_000,
  twoUpMinWidth: 900,
  creaseSnap: 0.03,
  dividerMin: 0.22,
  dividerMax: 0.78,
  handlePosition: 0.7,
  swipeDistance: 60,
  swipeVelocity: 650,

  reduceMotion:
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
};

/** Tokens that styling needs, exposed as CSS custom properties on the shell root. */
export function physicsCssVars(t: PhysicsTokens): Record<string, string> {
  return {
    "--sp-glass-alpha": String(t.glassAlpha),
    "--sp-glass-blur": `${t.glassBlur}px`,
    "--sp-melt-tint": `${Math.round(t.meltTint * 100)}%`,
  };
}

export function withPhysics(overrides: Partial<PhysicsTokens>): PhysicsTokens {
  return { ...defaultPhysics, ...overrides, discreteAngles: { ...defaultPhysics.discreteAngles, ...overrides.discreteAngles } };
}
