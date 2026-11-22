import * as React from "react";
import { useSpatial } from "./context";
import { cx } from "./ExperienceView";

/** Non-blocking floating panel (overlay chat): drag by the header, minimise to a bubble. */
export function OverlayPanel({ open, onClose, title, subtitle, initial, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; initial: { x: number; y: number }; children?: React.ReactNode;
}) {
  const { scale } = useSpatial();
  const [pos, setPos] = React.useState(initial);
  const [min, setMin] = React.useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const x0 = e.clientX, y0 = e.clientY, p0 = pos; let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (Math.hypot(dx, dy) > 4) moved = true;
      setPos({ x: p0.x + dx, y: p0.y + dy });
    };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); if (!moved && min) setMin(false); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  return (
    <div className={cx("sp-panel", !open && "is-off", min && "is-min")} style={{ left: pos.x, top: pos.y }} aria-hidden={!open}>
      <div className="sp-panel-h" onPointerDown={onPointerDown}>
        <span className="sp-panel-dot" /><b>{title}</b>{subtitle && <span className="sp-panel-sub">· {subtitle}</span>}
        <button type="button" onClick={() => setMin(true)} aria-label="Minimise">–</button>
        <button type="button" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="sp-panel-b">{children}</div>
    </div>
  );
}
