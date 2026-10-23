import { useState, useRef, useEffect } from "react";
import { SHADE_STEPS, lighten, hexToName } from "@/components/ColorPicker";

const ACCENT = "#0a5cd6";
const SWATCH = 24;

// 8-bit style palette — 36 colours fills a 6×6 grid (bottom-right = tan)
const PALETTE_8BIT = [
  "#000000", "#404040", "#808080", "#c0c0c0", "#ffffff",
  "#7f0000", "#ff0000", "#ff7f7f", "#f71818",
  "#7f3f00", "#ff7f00", "#fdb462", "#f39c12",
  "#7f7f00", "#ffff00", "#ffed6f",
  "#007f00", "#00ff00", "#33cc33", "#1abc9c", "#16a085",
  "#007f7f", "#00ffff", "#80b1d3",
  "#00007f", "#0000ff", "#3399ff",
  "#7f007f", "#735bc1", "#9b59b6",
  "#ff00ff", "#ff1493", "#ff69b4",
  "#34495e", "#95a5a6", "#d2b48c",
];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// One column's palette — swatches with hover shades, recolour popout, drag
// reorder and Ctrl+click multi-select. Extracted so a compare map can stack
// several palettes (one per column) with small gaps between them.
export default function PaletteBlock({
  palette, selectedColor, selectedSource, colourMultiSelect,
  onSelectColor, onSelectSource, onToggleColourSelect, onDeselectColours,
  onRecolourSquare, onSelectShade, onDuplicateColour, onReorderPalette,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [openPaletteIdx, setOpenPaletteIdx] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [ctxMenuIdx, setCtxMenuIdx] = useState(null);
  const popoverRef = useRef(null);
  const ctxMenuRef = useRef(null);

  useEffect(() => {
    if (openPaletteIdx === null && ctxMenuIdx === null) return;
    function handle(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpenPaletteIdx(null);
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setCtxMenuIdx(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openPaletteIdx, ctxMenuIdx]);

  function handleSquareClick(hex, idx) {
    onSelectColor(hex);
    onSelectSource(idx);
  }
  function onDragStart(e, idx) { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e, idx) { e.preventDefault(); setDropIdx(idx); }
  function onDrop(e, idx) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) onReorderPalette(dragIdx, idx);
    setDragIdx(null); setDropIdx(null);
  }
  function onDragEnd() { setDragIdx(null); setDropIdx(null); }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onDeselectColours?.(); }}
      style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}
    >
      {palette.map(({ hex, name, base }, idx) => {
        const isHovered = hoveredIdx === idx;
        const isOpen = openPaletteIdx === idx;
        const isSource = selectedSource === idx;
        const isCurrent = selectedColor && selectedColor.toLowerCase() === hex.toLowerCase();
        const showShades = isHovered && !isOpen;
        const displayName = name.startsWith("#") ? hexToName(hex) : name;
        const main = base || hex;

        return (
          <div key={idx} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* drag-in guide line above this slot */}
            {dragIdx !== null && dragIdx !== idx && dropIdx === idx && (
              <div style={{ width: SWATCH + 6, height: 0, borderTop: `2px solid ${ACCENT}`, marginBottom: 1, borderRadius: 1 }} />
            )}
            <div
              style={{ position: "relative", opacity: dragIdx === idx ? 0.4 : 1 }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenuIdx(idx); setOpenPaletteIdx(null); }}
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
            >
              {/* Swatch — click selects the colour (Ctrl+click toggles multi-select) */}
              <div
                onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.stopPropagation(); onToggleColourSelect?.(idx); } else handleSquareClick(hex, idx); }}
                title={cap(displayName)}
                style={{
                  width: SWATCH, height: SWATCH, borderRadius: 3,
                  backgroundColor: hex, cursor: "pointer", boxSizing: "border-box",
                  border: isSource ? `2px solid ${ACCENT}` : isCurrent ? `2px dashed ${ACCENT}` : "2px solid transparent",
                  boxShadow: (colourMultiSelect || []).includes(idx) ? "0 0 0 2px #f39c12" : "none",
                }}
              />
              {/* Triangle — focused hit-area to pop out the custom colour swatch */}
              {(isHovered || isOpen) && (
                <div
                  onClick={(e) => { e.stopPropagation(); setCtxMenuIdx(null); setOpenPaletteIdx(isOpen ? null : idx); }}
                  title="Pick a new main colour"
                  style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 10, height: 10, cursor: "pointer", zIndex: 30,
                  }}
                >
                  <div style={{
                    width: 0, height: 0, borderStyle: "solid", borderWidth: "0 0 9px 9px",
                    borderColor: "transparent transparent rgba(0,0,0,0.6) transparent",
                  }} />
                </div>
              )}
              {/* Shade popover — derived from the ORIGINAL main colour; the square
                  may currently display one of its lighter shades (marked with the
                  selection border). */}
              {showShades && (
                <div
                  style={{
                    position: "absolute", top: 0, left: SWATCH,
                    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3,
                    zIndex: 300, padding: 6, background: "#fff", borderRadius: 5,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)", border: "1px solid #d0d0d0",
                  }}
                >
                  <div
                    onClick={() => onRecolourSquare(idx, main)}
                    title={cap(displayName)}
                    style={{
                      width: SWATCH, height: SWATCH, borderRadius: 3,
                      backgroundColor: main, cursor: "pointer",
                      border: main.toLowerCase() === hex.toLowerCase() ? `2px solid ${ACCENT}` : "2px solid transparent",
                    }}
                  />
                  {SHADE_STEPS.map((step, i) => {
                    const c = lighten(main, step);
                    return (
                      <div
                        key={i}
                        onClick={() => onSelectShade(idx, c)}
                        title={`${cap(displayName)} ${i + 1}`}
                        style={{
                          width: SWATCH, height: SWATCH, borderRadius: 3,
                          backgroundColor: c, cursor: "pointer",
                          border: c.toLowerCase() === hex.toLowerCase() ? `2px solid ${ACCENT}` : "2px solid transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
              {/* 8-bit palette popover — pick a new main colour for this square */}
              {isOpen && (
                <div
                  ref={popoverRef}
                  style={{
                    position: "absolute", top: 0, left: SWATCH,
                    display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3,
                    zIndex: 400, padding: 6, background: "#fff", borderRadius: 5,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)", border: "1px solid #d0d0d0",
                  }}
                >
                  {PALETTE_8BIT.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => { onRecolourSquare(idx, c); setOpenPaletteIdx(null); }}
                      title={hexToName(c)}
                      style={{
                        width: SWATCH, height: SWATCH, borderRadius: 3,
                        backgroundColor: c, cursor: "pointer",
                        border: c.toLowerCase() === hex.toLowerCase() ? `2px solid ${ACCENT}` : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Right-click context menu — duplicate colour */}
              {ctxMenuIdx === idx && (
                <div
                  ref={ctxMenuRef}
                  style={{
                    position: "absolute", top: 0, left: SWATCH,
                    zIndex: 500, padding: 4, background: "#fff", borderRadius: 5,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)", border: "1px solid #d0d0d0",
                  }}
                >
                  <button
                    onClick={() => { onDuplicateColour(idx); setCtxMenuIdx(null); }}
                    title="Duplicate this colour below"
                    style={{
                      background: "#e0e0e0", color: "#333", border: "none", borderRadius: 3,
                      padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap",
                    }}
                  >Duplicate</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}