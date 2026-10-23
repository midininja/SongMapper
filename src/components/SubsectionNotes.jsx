import { useState, useRef, useEffect } from "react";
import { SAMPLER_KEYS } from "@/components/mapControls";

const SN = {
  previewFg: "#888",
  emptyFg: "#ccc",
  collapseFg: "#aaa",
  headerFg: "#555",
  confirmBg: "#ffffff",
  confirmBorder: "#d0d0d0",
  confirmFg: "#0f0f0f",
};

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || "";
}

// Per-note-row subsection strip: each section notes row owns a UNIQUE strip
// (its divisions are stored on the row itself, inside notes[<sectionId>]) plus
// its own subsection notes. Subsections are managed like sections: created at
// the playhead via ＋, selected by clicking a cell or division (Delete
// removes, with confirmation), boundaries adjusted by dragging the division
// lines. Below the strip, subsection notes appear once a subsection exists —
// a one-line greyed preview when collapsed, full columns when expanded. The
// "add row" hover button sits at the bottom of the whole block.
export default function SubsectionNotes({ section, row, rows, notes, commitNotes, previewNotes,
  currentTime = 0, onSeek, selectedSubIds = [], selectionActive = true, onSelectSub, samplerOffset = 0,
  rowCollapsed = false, subExpanded = false, onToggleSubExpanded, onEnsureSubExpanded, onAddRowBelow, onStripFocus }) {
  const stripRef = useRef(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [hoverBottom, setHoverBottom] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null);
  const latestPreviewRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);

  const subs = [...(row.subsections || [])].sort((a, b) => a.time - b.time);
  const dur = section.endTime - section.time;
  const borderColor = section.color;
  const parts = [
    { subKey: "start", label: row.startLabel || "1" },
    ...subs.map((s, i) => ({ sub: s, subKey: s.id, label: s.label || String(i + 2) })),
  ];
  const cuts = [section.time, ...subs.map(s => s.time), section.endTime];

  // Sampler key badges: selected subsections get keys in time order (same as
  // the section strip), shown only while the strip holds selection focus.
  function subKeyTime(k) {
    if (k === "start") return section.time;
    return subs.find(s => s.id === k)?.time ?? Infinity;
  }
  const selSorted = [...selectedSubIds].sort((a, b) => subKeyTime(a) - subKeyTime(b));
  function samplerKeyFor(k) {
    if (!selectionActive) return null;
    const idx = selSorted.indexOf(k);
    return idx >= 0 ? SAMPLER_KEYS[samplerOffset + idx] : null;
  }

  const canAdd = dur > 0
    && currentTime > section.time + 0.05 && currentTime < section.endTime - 0.05
    && !subs.some(s => Math.abs(s.time - currentTime) < 0.05);

  // Strip zoom/pan — Ctrl+scroll (mouse) or pinch (trackpad) zooms toward the
  // pointer, left-drag pans, double-click resets.
  const winStart = section.time + zoomOffset * dur;
  const winDur = dur / zoomLevel;
  const winEnd = winStart + winDur;
  useEffect(() => { setZoomLevel(1); setZoomOffset(0); }, [section.id]);

  function zoomAt(newZoom, fracTotal) {
    newZoom = Math.max(1, Math.min(40, newZoom));
    const anchor = fracTotal ?? (zoomOffset + 0.5 / zoomLevel);
    let off = anchor - 0.5 / newZoom;
    off = Math.max(0, Math.min(1 - 1 / newZoom, off));
    setZoomLevel(newZoom);
    setZoomOffset(newZoom <= 1 ? 0 : off);
  }
  function resetZoom() { setZoomLevel(1); setZoomOffset(0); }

  useEffect(() => {
    const el = stripRef.current; if (!el) return;
    function onWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width / zoomLevel + zoomOffset;
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      zoomAt(zoomLevel * (1 + delta), frac);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomLevel, zoomOffset, dur, section.id]);

  function pctOf(t) { return winDur > 0 ? ((t - winStart) / winDur) * 100 : 0; }
  const playheadPct = pctOf(currentTime);
  const playheadVisible = currentTime >= winStart && currentTime <= winEnd;

  function timeFromClientX(clientX) {
    const rect = stripRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return winStart + pct * winDur;
  }

  // Left-drag on the strip pans when zoomed (suppresses the click-select).
  function handleStripMouseDown(e) {
    if (e.button !== 0) return;
    onStripFocus?.();
    const startX = e.clientX;
    const startOffset = zoomOffset;
    const rectW = stripRef.current.getBoundingClientRect().width;
    const move = (ev) => {
      if (zoomLevel <= 1) return;
      const dx = ev.clientX - startX;
      if (Math.abs(dx) <= 3) return;
      dragMovedRef.current = true;
      const delta = (-dx / rectW) / zoomLevel;
      setZoomOffset(Math.max(0, Math.min(1 - 1 / zoomLevel, startOffset + delta)));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setTimeout(() => { dragMovedRef.current = false; }, 50);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // Build a new notes map with this row replaced (materializes legacy rows).
  function withRowNotes(mut) {
    const newNotes = { ...notes };
    newNotes[section.id] = rows.map(r => r.id === row.id ? mut({ ...r }) : r);
    return newNotes;
  }

  function handleAdd() {
    if (!canAdd) return;
    const newNotes = withRowNotes(r => ({
      ...r,
      subsections: [...(r.subsections || []), { id: `sub-${Date.now()}`, time: currentTime, label: null }].sort((a, b) => a.time - b.time),
    }));
    commitNotes(newNotes);
    onEnsureSubExpanded?.();
  }

  function commitEdit(subKey) {
    if (editingKey !== subKey) return;
    const trimmed = editValue.trim();
    const newNotes = withRowNotes(r => subKey === "start"
      ? { ...r, startLabel: trimmed || null }
      : { ...r, subsections: (r.subsections || []).map(x => x.id === subKey ? { ...x, label: trimmed || null } : x) });
    commitNotes(newNotes);
    setEditingKey(null);
  }

  function doDeleteSub(subId) {
    // Deleting the leftmost (start) part: the next subsection takes over its
    // space — its label and note move into the start cell.
    if (subId === "start") {
      if (subs.length === 0) { setConfirmDeleteIds(null); return; }
      const first = subs[0];
      const firstNoteKey = `${section.id}#${row.id}#${first.id}`;
      const startNoteKey = `${section.id}#${row.id}#start`;
      const newNotes = withRowNotes(r => ({ ...r, startLabel: first.label, subsections: (r.subsections || []).filter(x => x.id !== first.id) }));
      delete newNotes[startNoteKey];
      if (newNotes[firstNoteKey] !== undefined) newNotes[startNoteKey] = newNotes[firstNoteKey];
      delete newNotes[firstNoteKey];
      commitNotes(newNotes);
      setConfirmDeleteIds(null);
      if (selectedSubIds.includes("start")) onSelectSub?.(null);
      return;
    }
    const noteKey = `${section.id}#${row.id}#${subId}`;
    const newNotes = withRowNotes(r => ({ ...r, subsections: (r.subsections || []).filter(x => x.id !== subId) }));
    delete newNotes[noteKey];
    commitNotes(newNotes);
    setConfirmDeleteIds(null);
    if (selectedSubIds.includes(subId)) onSelectSub?.(null);
  }

  // Multi-delete: plain removal of every selected division (and its note).
  function doDeleteMany(keys) {
    const ids = new Set();
    keys.forEach(k => ids.add(k === "start" ? (subs[0]?.id ?? k) : k));
    const newNotes = withRowNotes(r => ({ ...r, subsections: (r.subsections || []).filter(x => !ids.has(x.id)) }));
    ids.forEach(id => { delete newNotes[`${section.id}#${row.id}#${id}`]; });
    commitNotes(newNotes);
    setConfirmDeleteIds(null);
    onSelectSub?.(null);
  }

  // Division markers: drag to adjust (live preview, one history entry on
  // release); a click without movement selects the division so Delete can
  // remove it.
  function handleMarkerDown(e, sub) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onStripFocus?.();
    const mods = { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey };
    const i = subs.findIndex(x => x.id === sub.id);
    const lo = i > 0 ? subs[i - 1].time : section.time;
    const hi = i < subs.length - 1 ? subs[i + 1].time : section.endTime;
    let moved = false;
    const move = (ev) => {
      moved = true;
      const t = Math.max(lo + 0.05, Math.min(hi - 0.05, timeFromClientX(ev.clientX)));
      latestPreviewRef.current = withRowNotes(r => ({ ...r, subsections: (r.subsections || []).map(x => x.id === sub.id ? { ...x, time: t } : x) }));
      previewNotes(latestPreviewRef.current);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      if (moved) {
        if (latestPreviewRef.current) { commitNotes(latestPreviewRef.current); latestPreviewRef.current = null; }
      } else {
        onSelectSub?.(sub.id, mods);
      }
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // Draggable playhead — scrubs the media live.
  function handlePlayheadDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onStripFocus?.();
    const move = (ev) => onSeek?.(timeFromClientX(ev.clientX));
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // Delete key on the selected division opens the confirmation dialog
  // (capture phase so it wins over the column's global colour-delete handler).
  useEffect(() => {
    if (!selectionActive || selectedSubIds.length === 0) return;
    const onKey = (e) => {
      if (e.key !== "Delete") return;
      const el = e.target;
      if (el?.closest?.('[data-notearea="true"]') || ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName) || el?.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      setConfirmDeleteIds([...selectedSubIds]);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selectedSubIds, selectionActive]);

  return (
    <div
      onMouseEnter={() => setHoverBottom(true)}
      onMouseLeave={() => setHoverBottom(false)}
      style={{ display: "flex", flexDirection: "column", position: "relative", background: `${borderColor}1a`, borderTop: "1px solid " + borderColor + "33", borderBottom: "1px solid " + borderColor }}
    >
      {confirmDeleteIds && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: SN.confirmBg, border: `1px solid ${SN.confirmBorder}`, borderRadius: 8, padding: "24px 28px", maxWidth: 320, textAlign: "center", color: SN.confirmFg }}>
            <p style={{ fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>{confirmDeleteIds.length > 1 ? `Delete these ${confirmDeleteIds.length} subsections? Their notes will be lost.` : "Delete this subsection? Its notes will be lost."}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => confirmDeleteIds.length === 1 ? doDeleteSub(confirmDeleteIds[0]) : doDeleteMany(confirmDeleteIds)} style={{ padding: "7px 18px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Delete</button>
              <button onClick={() => setConfirmDeleteIds(null)} style={{ padding: "7px 18px", background: "#f0f0f0", color: SN.confirmFg, border: `1px solid ${SN.confirmBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Subsection strip — heading row; its divisions are the column borders.
          The timeline starts right of the add-subsection button. */}
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid " + borderColor + "22" }}>
        <div style={{ width: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: borderColor + "55", borderRight: "1px solid " + borderColor + "22" }}>
          {selectedSubIds.length > 0 ? (
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={e => { e.stopPropagation(); onStripFocus?.(); setConfirmDeleteIds([...selectedSubIds]); }}
              title="Delete the selected subsection(s)"
              style={{
                width: 16, height: 16, borderRadius: 3,
                background: "#e74c3c", color: "#fff", border: "none",
                cursor: "pointer", fontSize: 10, fontWeight: "bold", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          ) : (
            <button
              onPointerDown={e => e.preventDefault()}
              onClick={e => { e.stopPropagation(); onStripFocus?.(); handleAdd(); }}
              disabled={!canAdd}
              title="add subsection"
              style={{
                width: 16, height: 16, borderRadius: 3,
                background: canAdd ? borderColor : "#e8e8e8",
                color: canAdd ? "#fff" : "#bbb",
                border: "none", cursor: canAdd ? "pointer" : "not-allowed",
                fontSize: 10, fontWeight: "bold", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >＋</button>
          )}
        </div>
        <div
          ref={stripRef}
          title="Subsection strip — drag the playhead to scrub · drag the white lines to move divisions · click a cell or line to select · Ctrl+scroll / pinch to zoom · drag to pan · double-click to reset zoom"
          onMouseDown={handleStripMouseDown}
          onDoubleClick={e => { if (!dragMovedRef.current) resetZoom(); }}
          onClick={e => { if (dragMovedRef.current) return; if (e.target === e.currentTarget) onSelectSub?.(null); }}
          style={{ flex: 1, position: "relative", height: 18, background: borderColor + "55", userSelect: "none", WebkitUserSelect: "none", overflow: "hidden" }}
        >
        {cuts.slice(0, -1).map((_, k) => {
          const rawL = pctOf(cuts[k]);
          const rawR = pctOf(cuts[k + 1]);
          const l = Math.max(0, rawL);
          const w = Math.min(100, rawR) - l;
          if (w <= 0) return null;
          const p = parts[k];
          // The leftmost (start) cell counts as selected when the first
          // division is selected, so Shift-ranges highlight the full span.
          const isSel = selectedSubIds.includes(p.subKey)
            || (p.subKey === "start" && subs.length > 0 && selectedSubIds.includes(subs[0].id));
          // Pin the label to the part's TRUE midpoint (in strip coordinates),
          // not the visible sliver — no parallax when zoomed/panned.
          const midPct = w > 0 ? (((rawL + rawR) / 2 - l) / w) * 100 : 50;
          return (
            <div
              key={`cell-${k}`}
              onClick={e => { if (dragMovedRef.current) return; e.stopPropagation(); onSelectSub?.(p.sub ? p.sub.id : (subs.length > 0 ? "start" : null), e); }}
              style={{ position: "absolute", top: 0, bottom: 0, left: `${l}%`, width: `${w}%`, overflow: "hidden", boxShadow: isSel ? "inset 0 0 0 1.5px " + (selectionActive ? "#f39c12" : "#999") : "none" }}
            >
              {editingKey === p.subKey ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(p.subKey); }
                    if (e.key === "Escape") setEditingKey(null);
                    e.stopPropagation();
                  }}
                  onBlur={() => commitEdit(p.subKey)}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onDoubleClick={e => e.stopPropagation()}
                  style={{ position: "absolute", left: `${midPct}%`, top: "50%", transform: "translate(-50%, -50%)", width: "85%", fontSize: 9, background: "rgba(255,255,255,0.95)", color: "#000", border: "1px solid #333", borderRadius: 2, padding: "0 2px", textAlign: "center", fontWeight: "bold", fontFamily: "inherit" }}
                />
              ) : (
                <span
                  className="sm-label"
                  onClick={e => { if (dragMovedRef.current) return; e.stopPropagation(); setEditValue(p.label); setEditingKey(p.subKey); }}
                  title="Click to rename"
                  style={{ position: "absolute", left: `${midPct}%`, top: "50%", transform: "translate(-50%, -50%)", fontSize: 8, fontWeight: "bold", color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%", padding: "1px 3px", cursor: "pointer" }}
                >{p.label}</span>
              )}
              {samplerKeyFor(p.subKey) && (
                <span style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#000", background: "rgba(243,156,18,0.85)", borderRadius: 2, padding: "0 2px", fontWeight: "bold", pointerEvents: "none" }}>{samplerKeyFor(p.subKey)}</span>
              )}
            </div>
          );
        })}
        {subs.map(sub => {
          const p = pctOf(sub.time);
          if (p < 0 || p > 100) return null;
          const isSel = selectedSubIds.includes(sub.id);
          return (
            <div key={sub.id} onMouseDown={e => handleMarkerDown(e, sub)} title="Drag to move · click to select (Delete removes)" style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${p}% - 3px)`, width: 6, cursor: "ew-resize", display: "flex", justifyContent: "center", zIndex: 5 }}>
              <div style={{ width: 2, height: "100%", background: isSel ? (selectionActive ? "#f39c12" : "#999") : "rgba(255,255,255,0.95)", boxShadow: isSel ? (selectionActive ? "0 0 3px rgba(243,156,18,0.9)" : "0 0 3px rgba(153,153,153,0.9)") : "0 0 2px rgba(0,0,0,0.4)" }} />
            </div>
          );
        })}
        {/* Draggable playhead — triangle handle like the section strip */}
        {playheadVisible && (
          <div onMouseDown={handlePlayheadDown} title="Drag to scrub" style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${playheadPct}% - 4px)`, width: 8, cursor: "grab", zIndex: 7, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "7px solid #0f0f0f", flexShrink: 0 }} />
            <div style={{ width: 2, flex: 1, background: "#0f0f0f", minHeight: 0 }} />
          </div>
        )}
        </div>
      </div>

      {/* Subsection notes — no space until the strip has a subsection.
          Collapsed: one-line greyed preview; expanded: full note columns. */}
      {subs.length > 0 && !rowCollapsed && (
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ width: 20, flexShrink: 0, borderRight: "1px solid " + borderColor + "22", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 3 }}>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => onToggleSubExpanded?.(row.id)}
              title={subExpanded ? "Hide subsection notes" : "Show subsection notes"}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: subExpanded ? SN.headerFg : SN.collapseFg, fontSize: 10, padding: 0, lineHeight: 1 }}
            >{subExpanded ? "▼" : "▶"}</button>
          </div>
          {parts.map((p, i) => {
            const noteKey = `${section.id}#${row.id}#${p.subKey}`;
            // Column widths follow the zoomed strip window so columns stay
            // aligned with their subsection cells; text reflows inside them.
            const span = Math.max(Math.min(cuts[i + 1], winEnd) - Math.max(cuts[i], winStart), 0);
            if (span <= 0) return null;
            return (
              <div key={p.subKey} style={{ flex: span, minWidth: 0, display: "flex", flexDirection: "column", borderRight: i < parts.length - 1 ? "1px solid " + borderColor + "22" : "none" }}>
                {subExpanded
                  ? <SubNoteText value={notes[noteKey] || ""} onChange={(html) => commitNotes({ ...notes, [noteKey]: html })} />
                  : <SubNotePreview value={notes[noteKey] || ""} onExpand={() => onToggleSubExpanded?.(row.id)} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-row hover button — sits at the bottom of the sub notes (expanded)
          or the strip (collapsed). */}
      {hoverBottom && (
        <button
          onMouseEnter={() => setHoverBottom(true)}
          onMouseLeave={() => setHoverBottom(false)}
          onClick={() => { onAddRowBelow?.(); setHoverBottom(false); }}
          title="Add row below"
          style={{
            position: "absolute", bottom: -11, left: "50%",
            transform: "translateX(-50%)", zIndex: 20,
            background: borderColor, color: "#fff", border: "none",
            borderRadius: 10, width: 22, height: 22,
            fontSize: 14, fontWeight: "bold", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)", lineHeight: 1,
          }}
        >+</button>
      )}
    </div>
  );
}

function SubNoteText({ value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && value !== el.innerHTML) el.innerHTML = value || "";
  }, [value]);
  return (
    <div
      ref={ref}
      className="sm-note"
      data-notearea="true"
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      style={{
        flex: 1, minWidth: 0, boxSizing: "border-box",
        background: "transparent", color: "#0f0f0f", fontSize: 12,
        padding: "4px 6px", border: "none", outline: "none",
        fontFamily: "inherit", lineHeight: 1.5, minHeight: 26,
        userSelect: "text", WebkitUserSelect: "text", cursor: "text",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}
    />
  );
}

function SubNotePreview({ value, onExpand }) {
  const text = stripHtml(value).split("\n")[0] || "";
  return (
    <div
      onMouseDown={e => e.preventDefault()}
      onClick={onExpand}
      title="Click to show subsection notes"
      style={{
        padding: "4px 6px", fontSize: 12, color: SN.previewFg, cursor: "pointer",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        minHeight: 22, lineHeight: "16px",
        userSelect: "none", WebkitUserSelect: "none",
      }}
    >{text || <span style={{ color: SN.emptyFg, fontStyle: "italic" }}>empty</span>}</div>
  );
}