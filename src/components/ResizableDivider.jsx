import { useRef, useCallback } from "react";

export default function ResizableDivider({ onResize, collapsed, onToggleCollapse }) {
  const isDragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (collapsed) return;
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;

    function onMove(ev) {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onResize(delta);
    }
    function onUp() {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [onResize, collapsed]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 8, flexShrink: 0,
        background: "#e8e8e8",
        borderLeft: "1px solid #e0e0e0",
        borderRight: "1px solid #e0e0e0",
        position: "relative",
        cursor: collapsed ? "default" : "ew-resize",
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none", zIndex: 10,
      }}
    >
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#bbb" }} />
          ))}
        </div>
      )}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 16, height: 32,
          background: "#f0f0f0", border: "1px solid #ccc",
          borderRadius: 3, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#888", fontSize: 8, padding: 0, zIndex: 20, lineHeight: 1,
        }}
        onMouseOver={e => { e.currentTarget.style.background = "#e0e0e0"; e.currentTarget.style.color = "#333"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#f0f0f0"; e.currentTarget.style.color = "#888"; }}
      >
        {collapsed ? "◀" : "▶"}
      </button>
    </div>
  );
}