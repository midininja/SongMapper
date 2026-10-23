import { TH } from "@/components/mapControls";

// Slim strip shown in place of a collapsed compare column: the expand triangle
// sits above the drag handle (same arrangement as the expanded header) and the
// map name runs vertically so collapsed columns stay identifiable.
export default function CollapsedColumnStrip({ index, order, selected, preview, grab, mapName, onSelect, onHover, onToggleCollapse }) {
  return (
    <div
      onPointerDown={(e) => { if (e.target.closest('button,input,select')) return; onSelect?.(index, e); }}
      onPointerMove={(e) => onHover?.(index, e)}
      onDragOver={(e) => { if (grab) { e.preventDefault(); grab.onGrabOver(index, e); } }}
      onDrop={(e) => { if (grab) { e.preventDefault(); grab.onGrabDrop(index, e); } }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        width: 40, minWidth: 40, flexShrink: 0, order, padding: "8px 0",
        background: TH.sidebar, borderRight: `1px solid ${TH.sidebarBorder}`,
        outline: selected ? "2px solid #735bc1" : preview ? "2px dashed #735bc1" : "none",
        outlineOffset: -2, position: "relative",
        userSelect: "none", WebkitUserSelect: "none", color: TH.fg,
      }}
    >
      {grab && grab.dropTargetId === index && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: grab.dropSide === "left" ? 0 : undefined, right: grab.dropSide === "right" ? 0 : undefined, width: 3, background: "#735bc1", zIndex: 700 }} />
      )}
      <button
        onPointerDown={(e) => { onSelect?.(index, e); }}
        onClick={() => onToggleCollapse?.(index)}
        title="Expand column"
        style={{ cursor: "pointer", background: "transparent", border: "none", color: "#999", fontSize: 11, lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}
      >▼</button>
      {grab && (
        <button
          draggable
          onPointerDown={(e) => { onSelect?.(index, e); }}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; grab.onGrabStart(index); }}
          onDragEnd={() => grab.onGrabEnd()}
          title="Drag to reorder column"
          style={{ cursor: "grab", background: "transparent", border: "none", color: "#999", fontSize: 14, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
        >⋮⋮</button>
      )}
      <div
        title={mapName}
        style={{
          writingMode: "vertical-rl", transform: "rotate(180deg)",
          fontSize: 11, color: "#735bc1", fontWeight: "bold",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          flex: 1, minHeight: 0, maxHeight: 320, width: "100%", textAlign: "center",
        }}
      >{mapName}</div>
    </div>
  );
}