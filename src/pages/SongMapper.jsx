import { useState, useRef, useCallback, useEffect } from "react";
import MapColumn from "@/components/MapColumn";
import ResizableDivider from "@/components/ResizableDivider";
import ReferencePanel from "@/components/ReferencePanel";
import ColorPicker from "@/components/ColorPicker";
import { TH, iconBoxStyle, ConfirmModal } from "@/components/mapControls";

export default function SongMapper() {
  const [mapCount, setMapCount] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [colStates, setColStates] = useState([]);
  const columnRefs = useRef([]);
  const [columns, setColumns] = useState([0]); // display order of column ids

  const [selectedCols, setSelectedCols] = useState([0]);
  const [colourScope, setColourScope] = useState("all");
  const [collapsedCols, setCollapsedCols] = useState([]);
  const toggleCollapse = (colId) => setCollapsedCols(prev => prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]);
  const [anchorCol, setAnchorCol] = useState(0);
  const [previewCol, setPreviewCol] = useState(null);

  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, side }

  const [confirmReplace, setConfirmReplace] = useState(null); // { kind, index }
  const [compareSave, setCompareSave] = useState(null); // { title, ids }

  const [rightSidebarWidth, setRightSidebarWidth] = useState(340);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refOverlayVisible, setRefOverlayVisible] = useState(false);
  const prevSidebarWidthRef = useRef(null);

  const [pendingEntry, setPendingEntry] = useState(null); // {kind:'new'|'load'}
  const [noteNewMap, setNoteNewMap] = useState(null);
  const [countPrompt, setCountPrompt] = useState(null);   // {kind:'new'|'load'}
  const fileInputRef = useRef(null);
  const loadTarget = useRef(null);
  const pendingLoads = useRef({});

  const compareMode = mapCount > 1;

  // Multi-column loop chain: every column with an active loop AND selected
  // sections joins ONE shared cycle, in visual (left-to-right) order. Each
  // column hands off to the next loop-enabled column (wrapping around).
  const loopChainCols = compareMode
    ? columns.filter(id => colStates[id] && colStates[id].loopSectionId != null && (colStates[id].loopSections || []).length > 0)
    : [];
  const loopChainNextFor = (colId) => {
    const i = loopChainCols.indexOf(colId);
    if (i === -1 || loopChainCols.length < 2) return null;
    return loopChainCols[(i + 1) % loopChainCols.length];
  };
  const handleLoopHandoff = useCallback((nextColId) => {
    columnRefs.current[nextColId]?.continueLoopChain?.();
  }, []);

  // Sampler hotkeys — sections selected across columns share ONE key list,
  // assigned left-to-right in visual column order (each column's by time).
  const samplerCols = compareMode ? columns : [0];
  const samplerKeys = [];
  samplerCols.forEach(id => {
    const n = (colStates[id]?.multiSelectedIds || []).length;
    for (let i = 0; i < n && samplerKeys.length < 15; i++) samplerKeys.push({ colId: id, localIdx: i });
  });
  const samplerOffsetFor = (colId) => {
    const i = samplerKeys.findIndex(a => a.colId === colId);
    return i === -1 ? 0 : i;
  };
  const handleSamplerKey = (keyIdx) => {
    const a = samplerKeys[keyIdx];
    if (!a) return;
    samplerCols.forEach(id => { if (id !== a.colId) columnRefs.current[id]?.pause?.(); });
    columnRefs.current[a.colId]?.triggerSamplerKey?.(a.localIdx);
  };

  const handleColState = useCallback((index, state) => {
    setColStates(prev => { const n = [...prev]; n[index] = state; return n; });
  }, []);

  // Dispatch pending per-column map data once the columns have mounted.
  useEffect(() => {
    const keys = Object.keys(pendingLoads.current);
    if (keys.length === 0) return;
    keys.forEach(k => {
      const colId = Number(k);
      const ref = columnRefs.current[colId];
      if (ref) {
        ref.loadMapData?.(pendingLoads.current[colId]);
        delete pendingLoads.current[colId];
      }
    });
  }, [mapCount, columns]);

  // Shared-strip colour change: recolour every selected section across columns when
  // selections span multiple columns (or a single column has a selection); otherwise
  // apply to the focused column's active colour.
  const handleStripColor = useCallback((hex) => {
    const withSel = colStates.map((s, i) => (s && s.hasSelection) ? i : -1).filter(i => i >= 0);
    if (withSel.length > 0) {
      withSel.forEach(i => columnRefs.current[i]?.recolorSelected(hex));
    } else {
      columnRefs.current[activeIndex]?.changeSelectedColor(hex);
    }
  }, [colStates, activeIndex]);

  function downloadMapData(data) {
    if (!data) return;
    const name = (data.mapName || "Untitled Map").replace(/[^a-z0-9\-_ ]/gi, "_");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${name}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  // ── Column selection (Ctrl = toggle, Shift = left-to-right block) ─────────────
  function handleColumnPointerDown(colId, e) {
    if (!compareMode) { setActiveIndex(colId); return; }
    const mod = e.shiftKey || e.ctrlKey || e.metaKey;
    // Don't hijack Ctrl/Shift clicks inside the timeline or notes — those select
    // sections/subsections within the column.
    if (mod && e.target.closest('.sm-timeline, .sm-notes')) return;
    if (e.shiftKey && anchorCol != null) {
      const a = columns.indexOf(anchorCol);
      const b = columns.indexOf(colId);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      setSelectedCols(columns.slice(lo, hi + 1));
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedCols(prev => {
        const next = prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId];
        return next.length ? next : [colId];
      });
    } else {
      setSelectedCols([colId]);
      setAnchorCol(colId);
    }
    setActiveIndex(colId);
  }
  function handleColumnHover(colId, e) {
    if (!compareMode) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) setPreviewCol(colId);
    else setPreviewCol(null);
  }

  // ── Reorder columns by drag & drop of the grab handle ─────────────────────────
  function onGrabStart(colId) { setDraggingId(colId); }
  // Drop targets are the GAPS between columns (index 0..n in visual order), so
  // exactly one side of a shared border can light up, never the dragged column's
  // own edges, and positions that would leave the order unchanged show nothing.
  function onGrabOver(colId, e) {
    if (draggingId == null || colId === draggingId) return; // passing over the dragged column keeps the last target
    const rect = e.currentTarget.getBoundingClientRect();
    const side = (e.clientX - rect.left) < rect.width / 2 ? "left" : "right";
    const d = columns.indexOf(draggingId);
    const gap = columns.indexOf(colId) + (side === "left" ? 0 : 1);
    if (gap === d || gap === d + 1) { setDropTarget(null); return; } // no-op position
    const target = gap >= columns.length
      ? { id: columns[columns.length - 1], side: "right" }
      : { id: columns[gap], side: "left" };
    setDropTarget(prev => (prev && prev.id === target.id && prev.side === target.side) ? prev : target);
  }
  function onGrabDrop(colId, e) {
    if (draggingId == null) { setDraggingId(null); setDropTarget(null); return; }
    let gap = null;
    if (colId !== draggingId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const side = (e.clientX - rect.left) < rect.width / 2 ? "left" : "right";
      gap = columns.indexOf(colId) + (side === "left" ? 0 : 1);
    }
    const d = columns.indexOf(draggingId);
    if (gap !== null && gap !== d && gap !== d + 1) {
      setColumns(prev => {
        const dd = prev.indexOf(draggingId);
        const without = prev.filter(c => c !== draggingId);
        const next = [...without];
        next.splice(dd < gap ? gap - 1 : gap, 0, draggingId);
        return next;
      });
    }
    setDraggingId(null);
    setDropTarget(null);
  }
  function onGrabEnd() { setDraggingId(null); setDropTarget(null); }

  // ── New / Load / Save ────────────────────────────────────────────────────────
  function handleNew(index) {
    if (compareMode) {
      if (colStates[index]?.videoLoaded) { setConfirmReplace({ kind: "new", index }); return; }
      columnRefs.current[index]?.startNewMap(); return;
    }
    const st = colStates[0];
    if (st && st.dirty && st.videoLoaded) setPendingEntry({ kind: "new" });
    else setCountPrompt({ kind: "new" });
  }
  function handleLoad(index) {
    if (compareMode) {
      if (colStates[index]?.videoLoaded) { setConfirmReplace({ kind: "load", index }); return; }
      loadTarget.current = { index }; fileInputRef.current?.click(); return;
    }
    const st = colStates[0];
    if (st && st.dirty && st.videoLoaded) setPendingEntry({ kind: "load" });
    else openLoadPicker(0);
  }
  function openLoadPicker(index) {
    loadTarget.current = { index };
    setTimeout(() => fileInputRef.current?.click(), 0);
  }
  function handleSave(index) {
    downloadMapData(columnRefs.current[index]?.getMapData?.());
  }
  function handleCompareSave() {
    const ordered = [...selectedCols].sort((a, b) => columns.indexOf(a) - columns.indexOf(b));
    const names = ordered.map(id => colStates[id]?.mapName || "Untitled Map");
    setCompareSave({ title: names.join(" vs "), ids: ordered });
  }
  function confirmCompareSave() {
    const { title, ids } = compareSave;
    const ordered = [...ids].sort((a, b) => columns.indexOf(a) - columns.indexOf(b));
    const maps = ordered.map(id => columnRefs.current[id]?.getMapData?.()).filter(Boolean);
    const data = { version: 3, type: "compare", mapName: title, columns: ordered, maps };
    const name = (title || "Compare Map").replace(/[^a-z0-9\-_ ]/gi, "_");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${name}.json`; a.click(); URL.revokeObjectURL(a.href);
    setCompareSave(null);
  }

  function proceedReplace() {
    const { kind, index } = confirmReplace;
    setConfirmReplace(null);
    if (kind === "new") columnRefs.current[index]?.startNewMap();
    else { loadTarget.current = { index }; setTimeout(() => fileInputRef.current?.click(), 0); }
  }

  function proceedCount(kind, n) {
    setCountPrompt(null);
    pendingLoads.current = {};
    setMapCount(n);
    setActiveIndex(0);
    const order = Array.from({ length: n }, (_, i) => i);
    setColumns(order);
    setCollapsedCols([]);
    setSelectedCols([0]);
    setAnchorCol(0);
    if (kind === "new") {
      columnRefs.current[0]?.startNewMap();
    } else {
      loadTarget.current = { index: 0 };
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  }

  function onFileChange(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const idx = loadTarget.current?.index ?? 0;
    if (/\.json$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data && data.type === "compare" && Array.isArray(data.maps)) {
            loadCompareMap(data);
          } else {
            loadTarget.current = null;
            columnRefs.current[idx]?.loadMapFile(file);
          }
        } catch { alert("Could not parse map file."); }
      };
      reader.readAsText(file);
    } else {
      loadTarget.current = null;
      columnRefs.current[idx]?.loadMediaFile?.(file);
    }
  }
  function loadCompareMap(data) {
    const n = data.maps.length;
    loadTarget.current = null;
    pendingLoads.current = {};
    setMapCount(n);
    // Always reload into a fresh contiguous 0..n-1 layout — a saved subset of a
    // larger comparison (e.g. columns 0 and 2 of 3) must not leave holes.
    setColumns(Array.from({ length: n }, (_, i) => i));
    setCollapsedCols([]);
    setSelectedCols([0]);
    setAnchorCol(0);
    setActiveIndex(0);
    for (let i = 0; i < n; i++) { pendingLoads.current[i] = data.maps[i]; }
  }

  // ── Global undo/redo stack (cross-column, chronological) ─────────────────────
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [, setHistVer] = useState(0);
  const registerHistory = useCallback((colId) => {
    const wasEmpty = undoStackRef.current.length === 0;
    undoStackRef.current.push(colId);
    redoStackRef.current = [];
    if (wasEmpty) setHistVer(v => v + 1);
  }, []);
  const clearColumnHistory = useCallback((colId) => {
    undoStackRef.current = undoStackRef.current.filter(c => c !== colId);
    redoStackRef.current = redoStackRef.current.filter(c => c !== colId);
    setHistVer(v => v + 1);
  }, []);
  const globalUndo = useCallback(() => {
    const id = undoStackRef.current.pop();
    if (id == null) return;
    columnRefs.current[id]?.undo?.();
    redoStackRef.current.push(id);
    setHistVer(v => v + 1);
  }, []);
  const globalRedo = useCallback(() => {
    const id = redoStackRef.current.pop();
    if (id == null) return;
    columnRefs.current[id]?.redo?.();
    undoStackRef.current.push(id);
    setHistVer(v => v + 1);
  }, []);

  // Colour panel blocks — one per column palette (visual order). Compare mode
  // shows every loaded column's colours by default, or just the selected
  // columns' when the scope toggle is switched to "selected".
  const mkColourBlock = (id) => ({
    colId: id,
    palette: colStates[id]?.palette || [],
    selectedColor: colStates[id]?.selectedColor,
    selectedSource: colStates[id]?.selectedSource,
    colourMultiSelect: colStates[id]?.colourMultiSelect || [],
    onSelectColor: (hex) => { if (id === activeIndex) handleStripColor(hex); else columnRefs.current[id]?.changeSelectedColor(hex); },
    onSelectSource: (s) => columnRefs.current[id]?.handleSelectSource(s),
    onToggleColourSelect: (idx) => columnRefs.current[id]?.toggleColourSelect(idx),
    onDeselectColours: () => columnRefs.current[id]?.deselectColours(),
    onRecolourSquare: (idx, hex) => columnRefs.current[id]?.handleRecolourSquare(idx, hex),
    onSelectShade: (idx, hex) => columnRefs.current[id]?.handleSelectShade(idx, hex),
    onDuplicateColour: (idx) => columnRefs.current[id]?.handleDuplicateColour(idx),
    onReorderPalette: (f, t) => columnRefs.current[id]?.handleReorderPalette(f, t),
  });
  const paletteCols = compareMode
    ? columns.filter(id => (colStates[id]?.palette || []).length > 0)
    : [activeIndex];
  const scopeCols = colourScope === "selected" ? paletteCols.filter(id => selectedCols.includes(id)) : paletteCols;
  const colourBlocks = (scopeCols.length ? scopeCols : paletteCols).map(mkColourBlock);
  const anyCanUndo = undoStackRef.current.length > 0;
  const anyCanRedo = redoStackRef.current.length > 0;
  const maxTabHeight = colStates.reduce((m, s) => Math.max(m, s?.tabHeight || 0), 0);

  // Per-column button visibility in compare mode.
  const furthestRightSelected = compareMode && selectedCols.length > 1
    ? [...selectedCols].sort((a, b) => columns.indexOf(a) - columns.indexOf(b))[selectedCols.length - 1]
    : null;
  function buttonModeFor(colId) {
    if (!compareMode) return "single";
    if (selectedCols.length === 1 && selectedCols[0] === colId) return "single";
    if (selectedCols.length > 1 && colId === furthestRightSelected) return "compareSave";
    return "none";
  }
  function saveDisabledFor(colId) {
    if (!compareMode) return !colStates[colId]?.videoLoaded;
    if (selectedCols.length === 1) return !colStates[colId]?.videoLoaded;
    if (colId === furthestRightSelected) return selectedCols.some(id => !colStates[id]?.videoLoaded);
    return true;
  }

  const grab = compareMode ? { draggingId, dropTargetId: dropTarget?.id, dropSide: dropTarget?.side, onGrabStart, onGrabOver, onGrabDrop, onGrabEnd } : null;

  return (
    <div style={{ display: "flex", background: TH.bg, color: TH.fg, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", position: "relative" }}>

      {/* Shared left strip (colour picker + undo/redo) */}
      <div style={{ width: 42, minWidth: 42, flexShrink: 0, background: TH.sidebar, borderRight: `1px solid ${TH.sidebarBorder}`, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, overflow: "visible" }}>
        <button onClick={() => setNoteNewMap(activeIndex)} title="Start a new map" style={{ fontSize: 22, lineHeight: 1, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>🎵</button>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={globalUndo} disabled={!anyCanUndo} title="Undo" style={iconBoxStyle(!anyCanUndo)}>↩</button>
          <button onClick={globalRedo} disabled={!anyCanRedo} title="Redo" style={iconBoxStyle(!anyCanRedo)}>↪</button>
        </div>
        <ColorPicker
          blocks={colourBlocks}
          activeColId={activeIndex}
          showScopeToggle={compareMode}
          scope={colourScope}
          pipes={compareMode ? columns.map(id => ({ dark: colourScope === "all" || selectedCols.includes(id) })) : []}
          onToggleScope={() => setColourScope(s => (s === "all" ? "selected" : "all"))}
          onAddColour={() => columnRefs.current[activeIndex]?.handleAddColour()}
          onRemoveColour={() => columnRefs.current[activeIndex]?.handleRemoveColour()}
        />
        <div onClick={() => columnRefs.current[activeIndex]?.deselectColours?.()} title="Deselect colours" style={{ flex: 1, minHeight: 20, width: "100%", cursor: "default" }} />
      </div>

      {/* Columns (stable DOM order; visual order via CSS `order` to avoid reloading iframes on reorder) */}
      <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
        {Array.from({ length: mapCount }, (_, i) => i).map((colId) => (
          <MapColumn
            key={colId}
            ref={(el) => { columnRefs.current[colId] = el; }}
            index={colId}
            order={columns.indexOf(colId)}
            active={colId === activeIndex}
            selected={!compareMode ? true : selectedCols.includes(colId)}
            preview={compareMode && previewCol === colId && !selectedCols.includes(colId)}
            compareMode={compareMode}
            grab={grab}
            buttonMode={buttonModeFor(colId)}
            saveDisabled={saveDisabledFor(colId)}
            alignTabHeight={compareMode ? maxTabHeight : 0}
            onState={handleColState}
            onSelect={handleColumnPointerDown}
            onHover={handleColumnHover}
            onNew={handleNew}
            onLoadCompareMap={loadCompareMap}
            onSave={handleSave}
            onSaveCompare={handleCompareSave}
            onUndo={globalUndo}
            onRedo={globalRedo}
            onHistoryPush={registerHistory}
            onHistoryReset={clearColumnHistory}
            loopChainNext={loopChainNextFor(colId)}
            onLoopHandoff={handleLoopHandoff}
            samplerOffset={samplerOffsetFor(colId)}
            onSamplerKey={handleSamplerKey}
            collapsed={collapsedCols.includes(colId)}
            onToggleCollapse={toggleCollapse}
            onDeselectAll={() => columnRefs.current.forEach(c => c?.deselectAll?.())}
          />
        ))}
      </div>

      {/* Single mode: inline divider + reference panel */}
      {!compareMode && (
        <>
          <ResizableDivider
            onResize={(deltaX) => { if (sidebarCollapsed) return; setRightSidebarWidth(w => Math.max(180, Math.min(700, w - deltaX))); }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => {
              if (sidebarCollapsed) { setSidebarCollapsed(false); if (prevSidebarWidthRef.current !== null) setRightSidebarWidth(prevSidebarWidthRef.current); }
              else { prevSidebarWidthRef.current = rightSidebarWidth; setSidebarCollapsed(true); }
            }}
          />
          {!sidebarCollapsed && (
            <div style={{ width: rightSidebarWidth, minWidth: 180, flexShrink: 0, background: TH.rightSidebar, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <ReferencePanel />
            </div>
          )}
        </>
      )}

      {/* Compare mode: reference slides over the columns (doesn't compress them) */}
      {compareMode && (
        <button
          onClick={() => setRefOverlayVisible(v => !v)}
          title="Show/hide Music Elements Reference"
          style={{ position: "fixed", right: refOverlayVisible ? rightSidebarWidth : 0, top: "50%", transform: "translateY(-50%)", width: 18, height: 48, background: TH.sidebar, border: `1px solid ${TH.sidebarBorder}`, borderRight: "none", borderRadius: "4px 0 0 4px", cursor: "pointer", fontSize: 10, color: TH.label, zIndex: 600 }}
        >{refOverlayVisible ? "▶" : "◀"}</button>
      )}
      {compareMode && refOverlayVisible && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: rightSidebarWidth, background: TH.rightSidebar, boxShadow: "-6px 0 18px rgba(0,0,0,0.18)", zIndex: 550, display: "flex", flexDirection: "column" }}>
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              const startX = e.clientX; const startW = rightSidebarWidth;
              const move = (ev) => setRightSidebarWidth(Math.max(180, Math.min(700, startW - (ev.clientX - startX))));
              const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
              document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
            }}
            style={{ width: 6, cursor: "ew-resize", background: TH.sidebarBorder, flexShrink: 0 }}
          />
          <div style={{ flex: 1, overflowY: "auto" }}><ReferencePanel /></div>
        </div>
      )}

      {/* Hidden file input for loading maps */}
      <input ref={fileInputRef} type="file" accept=".json,.wav,.mp3,.flv,.mp4" style={{ display: "none" }} onChange={onFileChange} />

      {/* Save / Discard prompt (entry to compare) */}
      {pendingEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#ffffff", border: `1px solid ${TH.sidebarBorder}`, borderRadius: 8, padding: "28px 32px", maxWidth: 380, textAlign: "center", color: TH.fg, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
            <p style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>You have unsaved changes. Save before starting a new comparison?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { downloadMapData(columnRefs.current[0]?.getMapData?.()); const k = pendingEntry.kind; setPendingEntry(null); if (k === "new") setCountPrompt({ kind: k }); else openLoadPicker(0); }} style={{ padding: "8px 20px", background: "#735bc1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Save &amp; Continue</button>
              <button onClick={() => { const k = pendingEntry.kind; setPendingEntry(null); if (k === "new") setCountPrompt({ kind: k }); else openLoadPicker(0); }} style={{ padding: "8px 20px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Discard</button>
              <button onClick={() => setPendingEntry(null)} style={{ padding: "8px 20px", background: TH.btnBg, color: TH.btnFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Map count prompt */}
      {countPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#ffffff", border: `1px solid ${TH.sidebarBorder}`, borderRadius: 8, padding: "28px 32px", maxWidth: 380, textAlign: "center", color: TH.fg, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
            <p style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>Number of maps</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => proceedCount(countPrompt.kind, n)} style={{ padding: "10px 18px", background: n === 1 ? "#735bc1" : "#e0e0e0", color: n === 1 ? "#fff" : "#333", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 16 }}>{n}</button>
              ))}
            </div>
            <button onClick={() => setCountPrompt(null)} style={{ marginTop: 14, padding: "6px 16px", background: TH.btnBg, color: TH.btnFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Confirm before replacing a loaded song in a column */}
      {confirmReplace && (
        <ConfirmModal
          message={confirmReplace.kind === "new" ? "Replace the song currently loaded in this map with a new one?" : "Replace the song currently loaded in this map by loading another?"}
          onConfirm={proceedReplace}
          onCancel={() => setConfirmReplace(null)}
          confirmLabel="Replace"
          confirmColor="#e74c3c"
          cancelLabel="Cancel"
        />
      )}

      {/* New-map confirmation from the note emoji */}
      {noteNewMap !== null && (
        <ConfirmModal
          message="Start a whole new map? This clears ALL columns and cannot be undone."
          onConfirm={() => {
            undoStackRef.current = [];
            redoStackRef.current = [];
            setHistVer(v => v + 1);
            setNoteNewMap(null);
            setCountPrompt({ kind: "new" });
          }}
          onCancel={() => setNoteNewMap(null)}
          confirmLabel="Start New Map"
          confirmColor="#735bc1"
          cancelLabel="Cancel"
        />
      )}

      {/* Compare-map save dialogue */}
      {compareSave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#ffffff", border: `1px solid ${TH.sidebarBorder}`, borderRadius: 8, padding: "28px 32px", maxWidth: 420, textAlign: "center", color: TH.fg, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
            <p style={{ fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>Save {compareSave.ids.length} maps as a single compare-map file?</p>
            <input value={compareSave.title}
              onChange={e => setCompareSave({ ...compareSave, title: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") confirmCompareSave(); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", fontSize: 13, border: `1px solid ${TH.inputBorder}`, borderRadius: 4, outline: "none", marginBottom: 16, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={confirmCompareSave} style={{ padding: "8px 20px", background: "#735bc1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Save</button>
              <button onClick={() => setCompareSave(null)} style={{ padding: "8px 20px", background: TH.btnBg, color: TH.btnFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}