import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { TH } from "@/components/mapControls";

// Space reserved at the right edge for the "⋯" overflow button.
const RESERVE = 30;

export default function OverflowToolbar({ barStyle, children }) {
  const items = Array.isArray(children) ? children : [children];
  const barRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [overflowStart, setOverflowStart] = useState(null);
  const [open, setOpen] = useState(false);
  const [floatRect, setFloatRect] = useState(null);

  // Measure the REAL bar (all items rendered, overflow clipped) so positions
  // always match what the user sees — no separate measure container to drift.
  function measure() {
    const bar = barRef.current;
    if (!bar) return;
    const cw = bar.clientWidth;
    if (cw === 0) return;
    const kids = bar.children;
    // First pass: does everything fit without an overflow button?
    let start = null;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (el === btnRef.current) continue;
      if (el.offsetLeft + el.offsetWidth > cw - 1) { start = i; break; }
    }
    // Second pass: overflow needed — reserve just enough for the "⋯" button.
    if (start !== null) {
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        if (el === btnRef.current) continue;
        if (el.offsetLeft + el.offsetWidth > cw - RESERVE) { start = i; break; }
      }
    }
    setOverflowStart(start);
  }

  useLayoutEffect(() => { measure(); });

  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, []);

  const hasOverflow = overflowStart !== null && overflowStart < items.length;

  // Close when clicking outside the panel and the trigger button.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      const t = e.target;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (btnRef.current && btnRef.current.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close the floating panel after a click inside it (e.g. pressing the
  // full-screen button) so it doesn't linger on top of the media.
  function onPanelClick(e) {
    if (e.target.closest("button")) setOpen(false);
  }

  function closeFloat() { setOpen(false); }
  function toggleFloat() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 368));
      setFloatRect({ left, top: r.bottom + 2 });
    }
    setOpen(true);
  }

  return (
    <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
      {/* Single row: all items rendered (overflow items kept in layout for
          accurate measuring but hidden from view/interaction). */}
      <div ref={barRef} style={{ ...barStyle, overflow: "hidden", position: "relative" }}>
        {items.map((child, i) => (
          <div key={i} style={{ flexShrink: 0, display: "flex", visibility: (overflowStart !== null && i >= overflowStart) ? "hidden" : "visible" }}>{child}</div>
        ))}
        {hasOverflow && (
          <button
            ref={btnRef}
            onPointerDown={e => e.preventDefault()}
            onClick={toggleFloat}
            title={open ? "Close" : "More controls"}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 28, background: TH.controlBar, borderLeft: `1px solid ${TH.controlBarBorder}`, cursor: "pointer", fontSize: 16, fontWeight: "bold", color: "#333", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >⋯</button>
        )}
      </div>

      {/* Floating panel: only the items that did NOT fit. */}
      {open && hasOverflow && floatRect && createPortal(
        <div
          ref={panelRef}
          onClick={onPanelClick}
          style={{ position: "fixed", left: floatRect.left, top: floatRect.top, background: "#fff", border: `1px solid ${TH.controlBarBorder}`, borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", padding: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", zIndex: 9999, minWidth: 180, maxWidth: 360 }}
        >
          {items.slice(overflowStart).map((child, i) => (
            <div key={i} style={{ flexShrink: 0 }}>{child}</div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}