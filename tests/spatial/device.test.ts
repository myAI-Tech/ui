import { describe, expect, test } from "bun:test";

import { computePosture, devices, measuredDevice, normalizeSegments, surfacesFor, viewportFor } from "../../src/spatial/device";
import { defaultPhysics } from "../../src/spatial/tokens";

describe("spatial device geometry", () => {
  test("normalizes unequal segments and preserves a physical gap", () => {
    const normalized = normalizeSegments([
      { x: 554, y: 0, w: 540, h: 720 },
      { x: 0, y: 0, w: 540, h: 718 },
    ]);

    expect(normalized.axis).toBe("vertical");
    expect(normalized.bounds).toEqual({ x: 0, y: 0, w: 1094, h: 720 });
    expect(normalized.gap).toEqual({ x: 540, y: 0, w: 14, h: 720 });
  });

  test("uses exact measured segments for split surfaces", () => {
    const measured = measuredDevice({ w: 1094, h: 720 }, [
      { x: 0, y: 0, w: 540, h: 720 },
      { x: 554, y: 0, w: 540, h: 720 },
    ]);
    const posture = computePosture(measured.device, measured.orientation, 180, defaultPhysics);
    const viewport = viewportFor(measured.device, posture);
    const surfaces = surfacesFor(measured.device, posture, viewport, "split");

    expect(viewport.occlusion).toEqual({ x: 540, y: 0, w: 14, h: 720 });
    expect(surfaces.map(surface => ({ slot: surface.slot, x: surface.x, w: surface.w }))).toEqual([
      { slot: 1, x: 0, w: 540 },
      { slot: 0, x: 554, w: 540 },
    ]);
  });

  test("keeps a continuous fold crease non-occluding", () => {
    const posture = computePosture(devices.iphoneDuo, "portrait", 100, defaultPhysics);
    const viewport = viewportFor(devices.iphoneDuo, posture);

    expect(viewport.crease?.separating).toBe(false);
    expect(viewport.occlusion).toBeNull();
    expect(viewport.w).toBe(1040);
  });

  test("models the dual-screen preset as separating", () => {
    const posture = computePosture(devices.dualScreen, "portrait", 180, defaultPhysics);
    const viewport = viewportFor(devices.dualScreen, posture);

    expect(viewport.crease).toMatchObject({ axis: "vertical", width: 14, separating: true });
    expect(viewport.w).toBe(1094);
  });

  test("uses independent stacked surfaces for a flat physical dual screen", () => {
    const posture = computePosture(devices.dualScreen, "landscape", 180, defaultPhysics);
    const viewport = viewportFor(devices.dualScreen, posture);
    const surfaces = surfacesFor(devices.dualScreen, posture, viewport, "split");

    expect(viewport.crease).toMatchObject({ axis: "horizontal", width: 14, separating: true });
    expect(surfaces.map(surface => ({ slot: surface.slot, y: surface.y, h: surface.h }))).toEqual([
      { slot: 0, y: 0, h: 540 },
      { slot: 1, y: 554, h: 540 },
    ]);
  });
});
