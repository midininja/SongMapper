import { useState } from "react";
import PaletteBlock from "@/components/PaletteBlock";

export const PRESET_COLOURS = [
  { hex: "#735bc1", name: "purple" },
  { hex: "#ff7f7f", name: "melon" },
  { hex: "#80b1d3", name: "blue" },
  { hex: "#fdb462", name: "orange" },
  { hex: "#95a5a6", name: "grey" },
  { hex: "#33cc33", name: "green" },
  { hex: "#ff69b4", name: "pink" },
  { hex: "#34495e", name: "dusk" },
  { hex: "#ffed6f", name: "yellow" },
  { hex: "#1abc9c", name: "aqua" },
  { hex: "#f71818", name: "red" },
];

const ACCENT = "#0a5cd6";
const SWATCH = 24;
export const SHADE_STEPS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

function lighten(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  const hx = (n) => n.toString(16).padStart(2, "0");
  return `#${hx(nr)}${hx(ng)}${hx(nb)}`;
}

function darken(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  const hx = (n) => n.toString(16).padStart(2, "0");
  return `#${hx(nr)}${hx(ng)}${hx(nb)}`;
}

const COLOUR_NAMES = [
  ["black", "#000000"], ["white", "#ffffff"], ["grey", "#808080"],
  ["dark grey", "#404040"], ["light grey", "#c0c0c0"], ["tan", "#d2b48c"],
  ["red", "#ff0000"], ["dark red", "#7f0000"], ["pink", "#ff7f7f"],
  ["scarlet", "#f71818"], ["brown", "#7f3f00"],
  ["orange", "#ff7f00"], ["apricot", "#fdb462"], ["amber", "#f39c12"],
  ["yellow", "#ffff00"], ["olive", "#7f7f00"], ["pale yellow", "#ffed6f"],
  ["green", "#00ff00"], ["dark green", "#007f00"], ["forest green", "#33cc33"],
  ["teal", "#1abc9c"], ["sea green", "#16a085"], ["cyan", "#00ffff"],
  ["dark teal", "#007f7f"], ["sky blue", "#80b1d3"], ["blue", "#0000ff"],
  ["navy", "#00007f"], ["azure", "#3399ff"], ["purple", "#735bc1"],
  ["indigo", "#7f007f"], ["violet", "#9b59b6"], ["magenta", "#ff00ff"],
  ["hot pink", "#ff1493"], ["rose", "#ff69b4"], ["slate", "#34495e"],
  ["silver", "#95a5a6"],
];

function hexToName(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best = COLOUR_NAMES[0][0], bestD = Infinity;
  for (const [nm, h] of COLOUR_NAMES) {
    const cr = parseInt(h.slice(1, 3), 16), cg = parseInt(h.slice(3, 5), 16), cb = parseInt(h.slice(5, 7), 16);
    const d = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
    if (d < bestD) { bestD = d; best = nm; }
  }
  return best;
}

export { lighten, darken, hexToName };

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Resolve a hex (which may be a lighter shade of a palette main colour) to its
// display name: "Hot pink" for a main colour, "Hot pink 2" for its 2nd shade,
// falling back to the nearest named colour when no palette entry matches.
export function colourDisplayName(hex, palette = []) {
  if (!hex) return "";
  const target = hex.toLowerCase();
  for (const entry of palette) {
    const main = entry.base || entry.hex;
    const mainName = entry.name && !entry.name.startsWith("#") ? entry.name : hexToName(main);
    if (main.toLowerCase() === target) return cap(mainName);
    const idx = SHADE_STEPS.findIndex(s => lighten(main, s).toLowerCase() === target);
    if (idx >= 0) return `${cap(mainName)} ${idx + 1}`;
  }
  return cap(hexToName(hex));
}

// Indicator square showing the left-most currently selected section's colour.
// Hover reveals the colour name; right-click offers "Copy colour" (same
// clipboard as the section strip's right-click menu).
function SelectedSectionSwatch({ hex, colourClipboard, onCopyColour, palette }) {
  const [ctxOpen, setCtxOpen] = useState(false);
  const name = colourDisplayName(hex, palette);
  return (
    <div style={{ position: "relative" }}>
      <div
        title={name}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxOpen(true); }}
        style={{
          width: 24, height: 24, borderRadius: 3, backgroundColor: hex,
          cursor: "default", boxSizing: "border-box",
          border: "2px solid rgba(0,0,0,0.25)", marginBottom: 4,
        }}
      />
      {ctxOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setCtxOpen(false)} onContextMenu={(e) => { e.preventDefault(); setCtxOpen(false); }} />
          <div
            style={{
              position: "absolute", top: 0, left: 28, zIndex: 8001,
              padding: 4, background: "#fff", borderRadius: 5,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)", border: "1px solid #d0d0d0",
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            <button
              onClick={() => { onCopyColour?.(hex); setCtxOpen(false); }}
              title="Copy this colour"
              style={{ background: "#e0e0e0", color: "#333", border: "none", borderRadius: 3, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap", textAlign: "left" }}
            >Copy colour</button>
            {colourClipboard && (
              <button
                onClick={() => setCtxOpen(false)}
                title={`Clipboard: ${colourClipboard}`}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#e0e0e0", color: "#333", border: "none", borderRadius: 3, padding: "3px 8px", fontSize: 11, cursor: "default", fontWeight: "bold", whiteSpace: "nowrap", textAlign: "left" }}
              >Clipboard <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: colourClipboard, border: "1px solid #999" }} /></button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Shared colour strip. Renders one palette block per column (compare mode shows
// every loaded column's palette, top-to-bottom in visual order, with a small
// vertical gap between blocks), plus the random toggle, add/remove and — in
// compare mode — the all/selected scope toggle styled like the + and − buttons.
export default function ColorPicker({ blocks = [], activeColId, showScopeToggle = false, scope = "all", pipes = [], onToggleScope, onAddColour, onRemoveColour, selectedSectionColour = null, colourClipboard = null, onCopyColour }) {
  const active = blocks.find(b => b.colId === activeColId) || blocks[0];
  const empty = !active || active.palette.length === 0;
  const atMax = active ? active.palette.length >= 16 : false;
  const atMin = !active || active.palette.length <= 1;
  const randomActive = active ? active.selectedSource === "preview" : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Random toggle */}
      <button
        onClick={() => active?.onDeselectColours?.()}
        disabled={empty}
        title="Random colour (toggle)"
        style={{
          width: SWATCH, height: SWATCH, borderRadius: 3,
          background: empty ? "#e8e8e8" : "#e0e0e0",
          border: `2px solid ${randomActive ? ACCENT : "transparent"}`,
          boxShadow: randomActive ? `0 0 0 2px ${ACCENT}` : "none",
          cursor: empty ? "not-allowed" : "pointer", fontSize: 13, padding: 0,
          opacity: empty ? 0.5 : 1, marginBottom: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxSizing: "border-box",
        }}
      >🎲</button>

      {/* Selected-section colour indicator — shows the left-most currently
          selected section's colour. Hover to see the colour name; right-click
          to copy it (same clipboard as section right-click > copy colour). */}
      {selectedSectionColour && (
        <SelectedSectionSwatch hex={selectedSectionColour} colourClipboard={colourClipboard} onCopyColour={onCopyColour} palette={active?.palette || []} />
      )}

      {/* Divider between the indicator and the column colour lists */}
      <div style={{ width: SWATCH, height: 1, background: "#666", margin: "6px 0" }} />

      {/* One block per column palette — floating line spacer between blocks */}
      {blocks.map((b, i) => (
        <div key={b.colId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {i > 0 && <div style={{ width: SWATCH, height: 1, background: "#666", margin: "7px 0 6px 0" }} />}
          <PaletteBlock
            palette={b.palette}
            selectedColor={b.selectedColor}
            selectedSource={b.selectedSource}
            colourMultiSelect={b.colourMultiSelect}
            onSelectColor={b.onSelectColor}
            onSelectSource={b.onSelectSource}
            onToggleColourSelect={b.onToggleColourSelect}
            onDeselectColours={b.onDeselectColours}
            onRecolourSquare={b.onRecolourSquare}
            onSelectShade={b.onSelectShade}
            onDuplicateColour={b.onDuplicateColour}
            onReorderPalette={b.onReorderPalette}
          />
        </div>
      ))}

      {/* Add / Remove colour squares — stacked, undo/redo style */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onAddColour()}
          disabled={atMax || empty}
          title={atMax ? "Maximum 16 colours" : (empty ? "Load media to add colours" : "Add a colour square")}
          style={{
            width: 24, height: 22, borderRadius: 3,
            background: (atMax || empty) ? "#e8e8e8" : "#e0e0e0",
            color: (atMax || empty) ? "#bbb" : "#333",
            border: "none", cursor: (atMax || empty) ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: "bold", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >＋</button>
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onRemoveColour()}
          disabled={atMin}
          title={atMin ? "Minimum 1 colour" : "Remove the selected colour square"}
          style={{
            width: 24, height: 22, borderRadius: 3,
            background: atMin ? "#e8e8e8" : "#e0e0e0",
            color: atMin ? "#bbb" : "#333",
            border: "none", cursor: atMin ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: "bold", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >－</button>
      </div>

      {/* Scope toggle — one pipe per column; all dark = all map colours, dark
          pipes mark the selected columns in "selected map colours" mode. */}
      {showScopeToggle && (
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={onToggleScope}
          title={scope === "all" ? "all map colours" : "selected map colours"}
          style={{
            width: 24, height: 22, borderRadius: 3,
            background: "#e0e0e0", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: "bold", padding: 0, marginTop: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {pipes.map((p, i) => (
            <span key={i} style={{ color: p.dark ? "#333" : "#bbb" }}>|</span>
          ))}
        </button>
      )}
    </div>
  );
}