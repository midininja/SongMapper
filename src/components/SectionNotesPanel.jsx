import { useState, useRef, useEffect } from "react";
import SubsectionNotes from "@/components/SubsectionNotes";
import { musicalLengthParts } from "@/lib/musicalTime";

const DYNAMIC_VALUES = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];
const BARS_OPTIONS = Array.from({ length: 120 }, (_, i) => i + 1);

const NP = {
  bg: "#f5f5f5",
  border: "#d0d0d0",
  fg: "#999",
  textFg: "#0f0f0f",
  metaFg: "#666",
  rowBorder: "#e8e8e8",
  inputBg: "#ffffff",
  inputBorder: "#d0d0d0",
  inputFg: "#0f0f0f",
  dynBg: "#ffffff",
  dynFg: "#999",
  dynActiveFg: "#0f0f0f",
  headerFg: "#555",
  collapseFg: "#aaa",
  previewFg: "#888",
  emptyFg: "#ccc",
  footerFg: "#888",
  confirmBg: "#ffffff",
  confirmBorder: "#d0d0d0",
  confirmFg: "#0f0f0f",
};

function toTC(sec) {
  if (!sec && sec !== 0) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${m}:${String(s).padStart(2,"0")}.${String(cs).padStart(2,"0")}`;
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || "";
}

// ── NoteRow ───────────────────────────────────────────────────────────────────
function NoteRow({ row, idx, borderColor, rowCount, selectedSection,
  subLengthLabel, subLengthActive,
  onUpdate, onRequestDelete, collapsed, onToggleCollapse,
  dragIdx, dragOverIdx, onDragStart, onDragEnd, onDragOver, onDrop }) {
  const textareaRef = useRef(null);
  const isOver = dragOverIdx === idx && dragIdx !== idx;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || collapsed) return;
    if (row.text !== el.innerHTML) {
      el.innerHTML = row.text || "";
    }
  }, [row.text, row.id, collapsed]);

  function handleInput(e) {
    const el = e.currentTarget;
    onUpdate(row.id, el.innerHTML, el.scrollHeight);
  }

  const previewText = stripHtml(row.text).split("\n")[0] || "";

  return (
    <div
      onDragOver={e => onDragOver(e, idx)}
      onDrop={e => onDrop(e, idx)}
      style={{
        display: "flex", alignItems: "stretch",
        borderBottom: idx < rowCount - 1 ? "1px solid " + borderColor + "33" : "none",
        borderTop: isOver ? `2px solid ${borderColor}` : "none",
        background: isOver ? borderColor + "18" : "transparent",
        transition: "background 0.1s",
        position: "relative",
      }}
    >
      <div
        draggable
        onDragStart={e => onDragStart(e, idx)}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
        style={{
          width: 20, flexShrink: 0,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: 8,
          cursor: "grab", color: NP.collapseFg, fontSize: 11,
          borderRight: "1px solid " + borderColor + "22",
          userSelect: "none",
        }}
      >⠿</div>

      <div style={{
        width: 20, flexShrink: 0,
        borderRight: "1px solid " + borderColor + "22",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 8,
      }}>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => onToggleCollapse(row.id)}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            background: "transparent", border: "none",
            cursor: "pointer", color: NP.collapseFg, fontSize: 10,
            padding: 0, lineHeight: 1,
          }}
        >{collapsed ? "▶" : "▼"}</button>
      </div>

      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        {collapsed ? (
          <div
            onMouseDown={e => e.preventDefault()}
            onClick={() => onToggleCollapse(row.id)}
            style={{
              padding: "7px 60px 7px 10px",
              fontSize: 13, color: NP.previewFg, cursor: "pointer",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              minHeight: 36, lineHeight: "22px",
            }}
          >{previewText || <span style={{ color: NP.emptyFg, fontStyle: "italic" }}>empty</span>}</div>
        ) : (
          <>
            <div
              ref={textareaRef}
              className="sm-note"
              data-notearea="true"
              data-row-id={row.id}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "transparent",
                color: NP.textFg, fontSize: 13,
                padding: "7px 60px 7px 10px",
                border: "none", outline: "none",
                fontFamily: "inherit", lineHeight: 1.6,
                minHeight: 36,
                userSelect: "text", WebkitUserSelect: "text",
                cursor: "text", display: "block",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}
            />
            {subLengthLabel && (
              <span
                title="Selected subsection length (bars.beats.8ths.16ths)"
                style={{ position: "absolute", top: 7, right: 58, fontSize: 9, fontFamily: "monospace", color: subLengthActive ? "#f39c12" : "#999", userSelect: "none", WebkitUserSelect: "none" }}
              >{subLengthLabel}</span>
            )}
            <select
              data-notearea="true"
              value={row.dynamic || ""}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => onUpdate(row.id, textareaRef.current?.innerHTML ?? row.text, textareaRef.current?.scrollHeight, e.target.value)}
              title="Dynamics"
              style={{
                position: "absolute", top: 5, right: 4,
                height: 22,
                background: NP.dynBg, color: row.dynamic ? NP.dynActiveFg : NP.dynFg,
                border: "1px solid " + borderColor + "44",
                borderRadius: 3, fontSize: 10,
                padding: "0 2px", cursor: "pointer", outline: "none",
                width: 50,
                fontStyle: row.dynamic ? "italic" : "normal",
                fontWeight: row.dynamic ? "bold" : "normal",
              }}
            >
              <option value="">dyn</option>
              {[...DYNAMIC_VALUES].reverse().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <button
        onClick={() => onRequestDelete(row.id)}
        title="Delete row"
        style={{
          width: 20, flexShrink: 0,
          background: "transparent", border: "none",
          cursor: "pointer", color: NP.collapseFg,
          fontSize: 13, display: "flex",
          alignItems: "flex-start", justifyContent: "center",
          paddingTop: 7,
          borderLeft: "1px solid " + borderColor + "22",
        }}
        onMouseOver={e => e.currentTarget.style.color = "#e74c3c"}
        onMouseOut={e => e.currentTarget.style.color = NP.collapseFg}
      >×</button>
    </div>
  );
}

// ── BarsDropdown ──────────────────────────────────────────────────────────────
function BarsDropdown({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value != null ? String(value) : "");
  const inputRef = useRef(null);
  const lastValid = useRef(value != null ? String(value) : "");

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function commit() {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n >= 1 && n <= 120) {
      lastValid.current = String(n);
      onChange(String(n));
      setInputVal(String(n));
    } else {
      setInputVal(lastValid.current);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-notearea="true"
        type="text"
        inputMode="numeric"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setInputVal(lastValid.current); setEditing(false); }
          e.stopPropagation();
        }}
        style={{
          width: 34, background: NP.inputBg, color: NP.inputFg,
          border: "1px solid #f39c12", borderRadius: 3,
          fontSize: 10, padding: "1px 4px",
          outline: "none", textAlign: "center", fontFamily: "inherit",
        }}
      />
    );
  }

  return (
    <select
      data-notearea="true"
      value={value || ""}
      onChange={e => { lastValid.current = e.target.value; onChange(e.target.value); }}
      onDoubleClick={() => { setInputVal(value ? String(value) : ""); setEditing(true); }}
      title="Bars (double-click to type)"
      style={{
        width: 46, background: NP.inputBg,
        color: value ? NP.inputFg : NP.dynFg,
        border: `1px solid ${NP.inputBorder}`, borderRadius: 3,
        fontSize: 10, padding: "1px 2px",
        cursor: "pointer", outline: "none",
      }}
    >
      <option value="">–</option>
      {BARS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function SectionNotesPanel({
  selectedSection, notes, setNotes, previewNotes, onSubsectionFocus, stripFocus,
  onSubSelectionChange, samplerOffset = 0,
  onUndo, onRedo, canUndo, canRedo,
  onUpdateSection,
  currentTime, onSeek,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState(null);
  const [subSel, setSubSel] = useState(null); // { rowId, anchorId, ids: [] } — selected divisions (multi-select capable)
  const subClipboardRef = useRef([]); // copied divisions: { rel, label } relative to section start
  const [copyToast, setCopyToast] = useState(null);
  const copyToastTimerRef = useRef(null);
  function showCopyToast(text) {
    setCopyToast(text);
    clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = setTimeout(() => setCopyToast(null), 1200);
  }
  const [collapsedRows, setCollapsedRows] = useState({});
  const [bars, setBars] = useState("");
  const [beats, setBeats] = useState("");
  const [subExpandedRows, setSubExpandedRows] = useState({});
  const dragNodeRef = useRef(null);

  useEffect(() => {
    if (!selectedSection) return;
    setBars(selectedSection.bars != null ? String(selectedSection.bars) : "");
    setBeats(selectedSection.beats != null ? String(selectedSection.beats) : "");
    setSubExpandedRows({});
    setSubSel(null);
  }, [selectedSection?.id]);

  // Ctrl+C copies the selected divisions (positions relative to section start,
  // labels included — notes are NOT copied); Ctrl+V pastes them into the
  // focused row's strip, skipping divisions that would land outside the
  // section or on top of an existing one. (rows/updateRows are declared after
  // the no-section early return, but this handler always guards on
  // selectedSection first, so they are initialized whenever it proceeds.)
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "c" && k !== "v") return;
      const el = e.target;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName) || el?.isContentEditable) return;
      if (!selectedSection || !stripFocus || stripFocus.sectionId !== selectedSection.id) return;
      const focusRowId = stripFocus.rowId;
      const row = rows.find(r => r.id === focusRowId);
      if (!row) return;
      if (k === "c") {
        if (!subSel || subSel.rowId !== focusRowId || subSel.ids.length === 0) return;
        const subs = [...(row.subsections || [])].sort((a, b) => a.time - b.time);
        subClipboardRef.current = subSel.ids
          .map(id => subs.find(s => s.id === id) || (id === "start" ? subs[0] : null))
          .filter(Boolean)
          .map(s => ({ rel: s.time - selectedSection.time, label: s.label ?? null }));
        e.preventDefault();
        showCopyToast(subSel.ids.length > 1 ? `${subSel.ids.length} subsections copied` : "Subsection copied");
        return;
      }
      if (subClipboardRef.current.length === 0) return;
      const existing = [...(row.subsections || [])];
      const add = [];
      subClipboardRef.current.forEach(c => {
        const t = selectedSection.time + c.rel;
        if (t <= selectedSection.time + 0.05 || t >= selectedSection.endTime - 0.05) return;
        if (existing.some(x => Math.abs(x.time - t) < 0.05) || add.some(x => Math.abs(x.time - t) < 0.05)) return;
        add.push({ id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: t, label: c.label });
      });
      if (add.length === 0) return;
      e.preventDefault();
      updateRows(rows.map(r => r.id === focusRowId
        ? { ...r, subsections: [...(r.subsections || []), ...add].sort((a, b) => a.time - b.time) }
        : r));
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  // Report the subsection selection up so the column can wire loop / slice /
  // sampler keys to subsections instead of sections.
  useEffect(() => {
    if (!selectedSection || !subSel) { onSubSelectionChange?.(null); return; }
    onSubSelectionChange?.({ sectionId: selectedSection.id, rowId: subSel.rowId, ids: [...subSel.ids] });
  }, [subSel, selectedSection?.id]);

  if (!selectedSection) {
    return (
      <div style={{
        width: "100%", minHeight: 140, boxSizing: "border-box",
        background: NP.bg, border: `2px solid ${NP.border}`,
        borderTop: "none",
        borderRadius: "0 4px 4px 4px",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: NP.fg, fontSize: 12,
        userSelect: "none", WebkitUserSelect: "none",
      }}>
        Click a section on the timeline or a tab above to add notes
      </div>
    );
  }

  const sectionId = selectedSection.id;
  const rawNote = notes[sectionId];
  // CRITICAL: use stable ID for empty/placeholder rows so React doesn't remount
  // the textarea on every parent re-render (which happens during playback)
  const emptyRowId = `empty-${sectionId}`;
  const rows = Array.isArray(rawNote)
    ? rawNote
    : rawNote
      ? [{ id: sectionId, text: rawNote, height: 36, dynamic: "" }]
      : [{ id: emptyRowId, text: "", height: 36, dynamic: "" }];

  function updateRows(newRows) { setNotes({ ...notes, [sectionId]: newRows }); }

  function updateRow(rowId, text, height, dynamic) {
    updateRows(rows.map(r => r.id === rowId ? {
      ...r, text,
      height: height || r.height,
      dynamic: dynamic !== undefined ? dynamic : r.dynamic,
    } : r));
  }

  function addRowAfter(idx) {
    const newRow = { id: `row-${Date.now()}-${idx}`, text: "", height: 36, dynamic: "" };
    const next = [...rows];
    next.splice(idx + 1, 0, newRow);
    updateRows(next);
  }

  function deleteRow(rowId) {
    if (rows.length === 1) { updateRows([{ id: emptyRowId, text: "", height: 36, dynamic: "" }]); return; }
    updateRows(rows.filter(r => r.id !== rowId));
  }

  function requestDeleteRow(rowId) {
    const row = rows.find(r => r.id === rowId);
    if (!stripHtml(row?.text).trim()) { deleteRow(rowId); return; }
    setConfirmDeleteRowId(rowId);
  }

  function toggleCollapse(rowId) {
    setCollapsedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  }
  function toggleSubExpanded(rowId) {
    setSubExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  }

  const allCollapsed = rows.length > 0 && rows.every(r => collapsedRows[r.id]);
  function toggleAllCollapse() {
    const next = {};
    rows.forEach(r => { next[r.id] = !allCollapsed; });
    setCollapsedRows(next);
  }

  function closestLi() {
    let n = window.getSelection()?.anchorNode;
    while (n) { if (n.tagName === "LI") return n; n = n.parentElement; }
    return null;
  }

  function handleNotesKey(e) {
    if (e.key === "Tab") {
      const li = closestLi();
      if (!li) return;
      e.preventDefault();
      if (e.shiftKey) { document.execCommand("outdent"); return; }
      // Only allow indenting up to two levels (solid → hollow bullet).
      if (!li.parentElement?.parentElement?.closest("ul")) document.execCommand("indent");
      return;
    }
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === "z" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); onUndo?.(); }
    if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); onRedo?.(); }
    if (e.key === "b") { e.preventDefault(); e.stopPropagation(); toggleBold(); }
  }

  function toggleBold() {
    const el = document.activeElement;
    if (!el || !el.isContentEditable || el.dataset?.notearea !== "true") return;
    document.execCommand("bold");
  }

  function toggleBullets() {
    const el = document.activeElement;
    if (!el || !el.isContentEditable || el.dataset?.notearea !== "true") return;
    document.execCommand("insertUnorderedList");
  }

  function handleBarsChange(val) {
    setBars(val);
    onUpdateSection?.(sectionId, { bars: val });
  }
  function handleBeatsChange(val) {
    setBeats(val);
    onUpdateSection?.(sectionId, { beats: val });
  }

  function onDragStart(e, idx) {
    setDragIdx(idx);
    dragNodeRef.current = e.currentTarget?.parentElement?.parentElement;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { if (dragNodeRef.current) dragNodeRef.current.style.opacity = "0.4"; }, 0);
  }
  function onDragEnd() {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = "1";
    setDragIdx(null); setDragOverIdx(null);
  }
  function onDragOver(e, idx) {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(idx);
  }
  function onDrop(e, idx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...rows];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    updateRows(next);
    setDragIdx(null); setDragOverIdx(null);
  }

  // ── Subsection multi-select / length readout / copy-paste ───────────────────
  // Ctrl+click toggles a division, Shift+click selects the adjacent range from
  // the anchor, plain click selects a single one (clicking the sole selection
  // clears it). Selection lives on one row at a time.
  function handleSubSelect(rowId, key, mods = {}) {
    if (!key) { setSubSel(null); return; }
    const row = rows.find(r => r.id === rowId);
    const ids = [...(row?.subsections || [])].sort((a, b) => a.time - b.time).map(s => s.id);
    const anchorKey = key === "start" ? (ids[0] ?? "start") : key;
    setSubSel(prev => {
      if (mods.shiftKey && prev && prev.rowId === rowId && prev.anchorId) {
        const a = ids.indexOf(prev.anchorId === "start" ? (ids[0] ?? -1) : prev.anchorId);
        const b = ids.indexOf(anchorKey);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          return { rowId, anchorId: prev.anchorId, ids: ids.slice(lo, hi + 1) };
        }
      }
      if (mods.ctrlKey && prev && prev.rowId === rowId) {
        const next = prev.ids.includes(key) ? prev.ids.filter(x => x !== key) : [...prev.ids, key];
        return next.length > 0 ? { rowId, anchorId: key, ids: next } : null;
      }
      if (prev && prev.rowId === rowId && prev.ids.length === 1 && prev.ids[0] === key) return null;
      return { rowId, anchorId: anchorKey, ids: [key] };
    });
  }

  // Total length of the selected subsection(s), decomposed into
  // bars.beats.eighths.sixteenths via the section's time signature and
  // Bars/Beats values. Updates live while a division is being dragged.
  function computeSubLengthLabel(row) {
    const dur = selectedSection.endTime - selectedSection.time;
    const subs = [...(row.subsections || [])].sort((a, b) => a.time - b.time);
    let total = 0;
    (subSel?.ids || []).forEach(k => {
      let start, end;
      if (k === "start") {
        if (subs.length === 0) return;
        start = selectedSection.time; end = subs[0].time;
      } else {
        const i = subs.findIndex(s => s.id === k);
        if (i === -1) return;
        start = subs[i].time;
        end = i < subs.length - 1 ? subs[i + 1].time : selectedSection.endTime;
      }
      total += Math.max(0, end - start);
    });
    if (total <= 0) return null;
    return musicalLengthParts(total, {
      sectionDuration: dur,
      bars,
      timeSigN: selectedSection.timeSigN || 4,
      timeSigD: selectedSection.timeSigD || 4,
      beatsOverride: beats,
    });
  }

  const borderColor = selectedSection.color;
  const beatOptions = Array.from({ length: 15 }, (_, i) => i + 1);
  const inTC = toTC(selectedSection.time);
  const outTC = toTC(selectedSection.endTime);

  return (
    <>
      {copyToast && (
        <div className="sm-toast" style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "#ffffff", border: "1px solid #d0d0d0", borderRadius: 6, padding: "8px 14px", fontSize: 12, color: "#0f0f0f", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}>
          {copyToast}
        </div>
      )}

      {confirmDeleteRowId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: NP.confirmBg, border: `1px solid ${NP.confirmBorder}`, borderRadius: 8, padding: "24px 28px", maxWidth: 320, textAlign: "center", color: NP.confirmFg }}>
            <p style={{ fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>Delete this note row?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { deleteRow(confirmDeleteRowId); setConfirmDeleteRowId(null); }}
                style={{ padding: "7px 18px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Delete</button>
              <button onClick={() => setConfirmDeleteRowId(null)}
                style={{ padding: "7px 18px", background: "#f0f0f0", color: NP.confirmFg, border: `1px solid ${NP.confirmBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div
        onKeyDown={handleNotesKey}
        style={{
          width: "100%", boxSizing: "border-box",
          background: borderColor + "0d",
          border: `2px solid ${borderColor}`,
          borderTop: "none",
          borderRadius: "0 4px 4px 4px",
          overflow: "hidden",
          paddingBottom: 12,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "4px 6px", borderBottom: "1px solid " + borderColor + "22", gap: 6, flexWrap: "wrap" }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={toggleAllCollapse}
            title={allCollapsed ? "Expand all rows" : "Collapse all rows"}
            style={{
              background: "transparent", border: "none",
              color: NP.collapseFg, cursor: "pointer", fontSize: 9,
              padding: "1px 4px", borderRadius: 3,
              display: "flex", alignItems: "center", gap: 2, flexShrink: 0,
            }}
            onMouseOver={e => e.currentTarget.style.color = NP.headerFg}
            onMouseOut={e => e.currentTarget.style.color = NP.collapseFg}
          >
            {allCollapsed ? "▶▶" : "▼▼"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: NP.headerFg, userSelect: "text", cursor: "text" }}>{inTC}</span>
            <span style={{ fontSize: 10, color: NP.headerFg, flexShrink: 0 }}>-</span>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: NP.headerFg, userSelect: "text", cursor: "text" }}>{outTC}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={toggleBold}
              title="Bold (Ctrl+B)"
              style={{
                background: "transparent", border: "none",
                color: NP.collapseFg, cursor: "pointer", fontSize: 11,
                fontWeight: "bold", padding: "0 4px", flexShrink: 0,
              }}
              onMouseOver={e => e.currentTarget.style.color = NP.headerFg}
              onMouseOut={e => e.currentTarget.style.color = NP.collapseFg}
            >B</button>
            <button
            onMouseDown={e => e.preventDefault()}
            onClick={toggleBullets}
            title="Bulleted list (Tab inside a list to indent, Shift+Tab to outdent)"
            style={{
              background: "transparent", border: "none",
              color: NP.collapseFg, cursor: "pointer", fontSize: 10,
              padding: "0 3px", flexShrink: 0,
            }}
            onMouseOver={e => e.currentTarget.style.color = NP.headerFg}
            onMouseOut={e => e.currentTarget.style.color = NP.collapseFg}
            >⋮≡</button>
            <label title="Time signature" style={{ fontSize: 10, color: NP.metaFg, display: "flex", alignItems: "center", gap: 2, userSelect: "none", WebkitUserSelect: "none" }}>
              <select
                data-notearea="true"
                value={selectedSection.timeSigN ?? 4}
                onChange={e => onUpdateSection?.(sectionId, { timeSigN: parseInt(e.target.value, 10) })}
                title="Bars per measure"
                style={{ width: 30, background: NP.inputBg, color: NP.inputFg, border: `1px solid ${NP.inputBorder}`, borderRadius: 3, fontSize: 10, padding: "1px 2px", cursor: "pointer", outline: "none" }}
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 10, color: NP.metaFg }}>/</span>
              <select
                data-notearea="true"
                value={selectedSection.timeSigD ?? 4}
                onChange={e => onUpdateSection?.(sectionId, { timeSigD: parseInt(e.target.value, 10) })}
                title="Note value per beat"
                style={{ width: 34, background: NP.inputBg, color: NP.inputFg, border: `1px solid ${NP.inputBorder}`, borderRadius: 3, fontSize: 10, padding: "1px 2px", cursor: "pointer", outline: "none" }}
              >
                {[1, 2, 4, 8, 16, 32].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 10, color: NP.metaFg, display: "flex", alignItems: "center", gap: 3, userSelect: "none", WebkitUserSelect: "none" }}>
              Bars:
              <BarsDropdown value={bars} onChange={handleBarsChange} />
            </label>
            <label style={{ fontSize: 10, color: NP.metaFg, display: "flex", alignItems: "center", gap: 3, userSelect: "none", WebkitUserSelect: "none" }}>
              Beats:
              <select
                data-notearea="true"
                value={beats}
                onChange={e => handleBeatsChange(e.target.value)}
                style={{ background: NP.inputBg, color: beats ? NP.inputFg : NP.dynFg, border: `1px solid ${NP.inputBorder}`, borderRadius: 3, fontSize: 10, padding: "1px 2px", cursor: "pointer", outline: "none" }}
              >
                <option value="">–</option>
                {beatOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>

        {rows.map((row, idx) => (
          <div key={row.id} style={{ position: "relative", borderTop: "1px solid " + borderColor }}>
            <NoteRow
              row={row} idx={idx} borderColor={borderColor}
              rowCount={rows.length} selectedSection={selectedSection}
              subLengthLabel={subSel?.rowId === row.id ? computeSubLengthLabel(row) : null}
              subLengthActive={stripFocus?.sectionId === sectionId && stripFocus?.rowId === row.id}
              onUpdate={updateRow}
              onRequestDelete={requestDeleteRow}
              collapsed={!!collapsedRows[row.id]}
              onToggleCollapse={toggleCollapse}
              dragIdx={dragIdx} dragOverIdx={dragOverIdx}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onDragOver={onDragOver} onDrop={onDrop}
            />
            <SubsectionNotes
              onStripFocus={() => onSubsectionFocus?.(sectionId, row.id)}
              section={selectedSection}
              row={row}
              rows={rows}
              notes={notes}
              commitNotes={setNotes}
              previewNotes={previewNotes}
              currentTime={currentTime}
              onSeek={onSeek}
              rowCollapsed={!!collapsedRows[row.id]}
              subExpanded={!!subExpandedRows[row.id]}
              onToggleSubExpanded={toggleSubExpanded}
              onEnsureSubExpanded={() => setSubExpandedRows(p => ({ ...p, [row.id]: true }))}
              onAddRowBelow={() => addRowAfter(idx)}
              selectedSubIds={subSel?.rowId === row.id ? subSel.ids : []}
              selectionActive={stripFocus?.sectionId === sectionId && stripFocus?.rowId === row.id}
              onSelectSub={(key, mods) => handleSubSelect(row.id, key, mods)}
              samplerOffset={samplerOffset}
            />
          </div>
        ))}
      </div>
    </>
  );
}