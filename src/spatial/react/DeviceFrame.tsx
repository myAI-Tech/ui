import * as React from "react";
import { smooth } from "../physics";
import { useFoldFrame, useSpatial } from "./context";

/**
 * Simulated hardware for Storybook and design labs: bezel, Dynamic Island /
 * punch-hole, and the unfold reveal (the frame widens leftward in book
 * orientation, downward in landscape). Real devices don't render this.
 */
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  const { device, viewport, posture } = useSpatial();
  const dev = React.useRef<HTMLDivElement>(null), wake = React.useRef<HTMLDivElement>(null);
  const b = device.frame.bezel, half = device.inner?.half, land = posture.orientation === "landscape";
  const open = posture.kind !== "cover" && posture.kind !== "single" && posture.kind !== "tiles";

  useFoldFrame(f => {
    if (!dev.current || !half) return;
    const reveal = smooth(0, 70, f.angle);
    if (land) { dev.current.style.width = `${viewport.w + b * 2}px`; dev.current.style.height = `${b * 2 + half.w + half.w * reveal}px`; }
    else { dev.current.style.height = `${viewport.h + b * 2}px`; dev.current.style.width = `${b * 2 + half.w + half.w * reveal}px`; }
    if (wake.current) wake.current.style.opacity = ((1 - reveal) * 0.85).toFixed(3);
  }, [viewport, land]);

  const radius = open ? device.frame.innerRadius ?? device.frame.radius : device.frame.radius;
  const island: React.CSSProperties | null = !device.frame.island ? null
    : device.kind === "foldable" && open ? (land ? { left: viewport.w / 2 - 6, top: 12, width: 12, height: 12 } : { left: viewport.w * 0.75 - 6, top: 12, width: 12, height: 12 })
    : land ? { left: 10, top: (half?.w ?? viewport.h) / 2 - 46, width: 28, height: 92 }
    : { left: (device.kind === "foldable" ? viewport.w * 0.75 : viewport.w / 2) - 46, top: 10, width: 92, height: 28 };

  return (
    <div className="sp-device-fit" style={{ width: viewport.w + b * 2, height: viewport.h + b * 2 }}>
      <div ref={dev} className="sp-device" style={{ borderRadius: radius, width: viewport.w + b * 2, height: viewport.h + b * 2 }}>
        <div className="sp-device-screen" style={{ top: b, right: b, width: viewport.w, height: viewport.h, borderRadius: Math.max(4, radius - 8) }}>
          {children}
          {half && <div ref={wake} className="sp-wake" style={land ? { left: 0, top: half.w, width: "100%", height: half.w } : { left: 0, top: 0, width: half.w, height: "100%" }} />}
          {island && <div className="sp-island" style={{ ...island, borderRadius: Math.min(Number(island.width), Number(island.height)) / 2 }} />}
        </div>
      </div>
    </div>
  );
}
