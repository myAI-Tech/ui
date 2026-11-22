import * as React from "react";
import { useSpatial } from "./context";
import { cx } from "./ExperienceView";

/** Non-blocking floating panel (overlay chat): drag by the header, minimise to a bubble. */
export function OverlayPanel({ id = "overlay", open, onClose, title, subtitle, initial, children }: {
  id?: string; open: boolean; onClose: () => void; title: string; subtitle?: string; initial: { x: number; y: number }; children?: React.ReactNode;
}) {
  const { scale, state, viewport, dispatch } = useSpatial();
  const saved = state.overlays[id];
  const [pos, setPos] = React.useState(() => saved ? { x: saved.x, y: saved.y } : initial);
  const min = saved?.minimized ?? false;
  const clampPosition = React.useCallback((value: { x: number; y: number }, minimized = min) => {
    const width = minimized ? 44 : Math.min(290, viewport.app.w), height = minimized ? 44 : Math.min(330, viewport.app.h);
    return {
      x: Math.min(Math.max(value.x, viewport.app.x), viewport.app.x + Math.max(0, viewport.app.w - width)),
      y: Math.min(Math.max(value.y, viewport.app.y), viewport.app.y + Math.max(0, viewport.app.h - height)),
    };
  }, [min, viewport]);
  React.useLayoutEffect(() => {
    const source = saved ? { x: saved.x, y: saved.y } : initial, next = clampPosition(source, saved?.minimized ?? false);
    setPos(next);
    if (!saved || next.x !== saved.x || next.y !== saved.y) dispatch({ type: "setOverlay", id, overlay: { ...next, minimized: saved?.minimized ?? false } });
  }, [id, initial.x, initial.y, saved?.x, saved?.y, saved?.minimized, clampPosition, dispatch]);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const x0 = e.clientX, y0 = e.clientY, p0 = pos; let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (Math.hypot(dx, dy) > 4) moved = true;
      setPos({ x: p0.x + dx, y: p0.y + dy });
    };
    const up = () => {
      removeEventListener("pointermove", track); removeEventListener("pointerup", up);
      const next = clampPosition({ x: p0.x + (lastX - x0) / scale, y: p0.y + (lastY - y0) / scale });
      setPos(next);
      dispatch({ type: "setOverlay", id, overlay: { ...next, minimized: !moved && min ? false : min } });
    };
    let lastX = x0, lastY = y0;
    const track = (ev: PointerEvent) => { lastX = ev.clientX; lastY = ev.clientY; move(ev); };
    addEventListener("pointermove", track); addEventListener("pointerup", up);
  };
  return (
    <div className={cx("sp-panel", !open && "is-off", min && "is-min")} style={{ left: pos.x, top: pos.y }} aria-hidden={!open}>
      <div className="sp-panel-h" onPointerDown={onPointerDown}>
        <span className="sp-panel-dot" /><b>{title}</b>{subtitle && <span className="sp-panel-sub">· {subtitle}</span>}
        <button type="button" onClick={() => dispatch({ type: "setOverlay", id, overlay: { ...pos, minimized: true } })} aria-label="Minimise">–</button>
        <button type="button" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="sp-panel-b">{children}</div>
    </div>
  );
}
