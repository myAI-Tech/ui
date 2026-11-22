import * as React from "react";
import type { Rect } from "../device";
import { postureActions, type ExperienceSpec } from "../experience";
import { useFoldFrame, useSpatial } from "./context";
import { PaneFrame, cx } from "./ExperienceView";

const ROWS: [string, string[], string[]][] = [
  ["1234567890-=", [], ["Backspace"]],
  ["QWERTYUIOP[]", ["Tab"], []],
  ["ASDFGHJKL;'", ["CapsLock"], ["Enter"]],
  ["ZXCVBNM,./", ["Shift"], ["Shift"]],
];
const GLYPH: Record<string, string> = { Backspace: "⌫", Tab: "⇥", CapsLock: "⇪", Enter: "⏎", Shift: "⇧", Control: "⌃", Alt: "⌥", Meta: "⌘", ArrowLeft: "◀", ArrowRight: "▶", " ": "space" };

/** On-screen keyboard for the deck. `onKey` receives KeyboardEvent.key values. */
export function VirtualKeyboard({ onKey }: { onKey: (key: string) => void }) {
  const key = (k: string, wide?: string) => (
    <button key={k + (wide ?? "")} type="button" className={cx("sp-key", wide)} onPointerDown={e => { e.preventDefault(); onKey(k); }}>{GLYPH[k] ?? k}</button>
  );
  return (
    <div className="sp-keys">
      {ROWS.map(([chars, pre, post], r) => (
        <div key={r} className="sp-krow">{pre.map(k => key(k, "is-wide"))}{[...chars].map(c => key(c))}{post.map(k => key(k, "is-wide"))}</div>
      ))}
      <div className="sp-krow">{key("Control", "is-wide")}{key("Alt", "is-wide")}{key("Meta", "is-wide")}{key(" ", "is-space")}{key("Meta", "is-wide")}{key("ArrowLeft")}{key("ArrowRight")}</div>
    </div>
  );
}

/** Touch bar: switch workspaces and run the actions the focused experience exposes in this posture. */
export function TouchBar({ experience }: { experience: ExperienceSpec }) {
  const { state, desktop, dispatch, posture, emit, swipeScope } = useSpatial();
  const slot = desktop.focus, run = (id: string) => {
    postureActions(experience, posture.kind).find(a => a.id === id)?.run?.({ slot, experience: experience.id, posture: posture.kind });
    emit({ type: "action", experience: experience.id, action: id, slot });
  };
  const go = (dir: 1 | -1) => swipeScope === "device"
    ? dispatch({ type: "switchDesktop", index: state.active + dir })
    : dispatch({ type: "stepSlotWorkspace", slot, dir });
  const ci = experience.panes.length > 1 ? state.pane[experience.id] ?? 0 : -1;
  return (
    <div className="sp-touchbar">
      <button type="button" className="sp-tb" onClick={() => go(-1)}>‹</button>
      <button type="button" className="sp-tb is-on" style={{ "--c": experience.accent } as React.CSSProperties}>{experience.label}</button>
      <button type="button" className="sp-tb" onClick={() => go(1)}>›</button>
      {ci >= 0 && <span className="sp-tb-sep" />}
      {ci >= 0 && experience.panes.map((p, i) => (
        <button key={p.id} type="button" className={cx("sp-tb", i === ci && "is-on")} style={{ "--c": p.color } as React.CSSProperties}
          onClick={() => dispatch({ type: "setPane", experience: experience.id, index: i })}>{p.short ?? p.title}</button>
      ))}
      <span className="sp-tb-sep" />
      {postureActions(experience, posture.kind).map(a => <button key={a.id} type="button" className="sp-tb" onClick={() => run(a.id)}>{a.glyph} {a.label}</button>)}
    </div>
  );
}

/**
 * Lower surface in the half-fold (laptop) posture. The experience decides what
 * it exposes there via `postures.laptop.deck`; the default is a keyboard.
 * The deck tilts with the hinge so it reads as the base of a laptop.
 */
export function HalfFoldDeck({ rect, experience, onKey }: { rect: Rect; experience: ExperienceSpec; onKey?: (key: string) => void }) {
  const { desktop, posture, surfaces } = useSpatial();
  const ref = React.useRef<HTMLDivElement>(null);
  useFoldFrame(f => { if (ref.current) ref.current.style.transform = `perspective(1100px) rotateX(${((180 - f.angle) * 0.22).toFixed(1)}deg)`; });
  const deck = experience.postures?.laptop?.deck ?? { kind: "keyboard" as const };
  const ctx = { slot: desktop.focus, experience: experience.id, posture: posture.kind };
  const surface = surfaces.find(s => s.slot === desktop.focus) ?? surfaces[0];
  const send = onKey ?? ((k: string) => {   // default: forward to whatever has focus in the page
    const el = document.activeElement as HTMLInputElement | null;
    if (el && "value" in el && k.length === 1) { el.value += k.toLowerCase(); el.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  return (
    <div ref={ref} className="sp-deck" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <TouchBar experience={experience} />
      {deck.kind === "keyboard" && <VirtualKeyboard onKey={send} />}
      {deck.kind === "controls" && <div className="sp-deck-controls">{deck.render(ctx)}</div>}
      {deck.kind === "pane" && <PaneFrame spec={experience.panes.find(p => p.id === deck.pane)!}
        ctx={{ experience: experience.id, slot: desktop.focus, surface: { ...surface, ...rect }, posture: posture.kind, condensed: false }} />}
    </div>
  );
}
