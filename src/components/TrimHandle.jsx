import { useState } from "react";

// Transparent trim handle for the section-strip ends. Shows a double-headed
// arrow glyph on hover; the cursor is a resize (double-headed arrow) at all times.
export default function TrimHandle({ leftPct, onMouseDown, title }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      style={{
        position: "absolute", top: 0, height: "100%", width: 12,
        left: `calc(${leftPct}% - 6px)`,
        cursor: "ew-resize", zIndex: 90, background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span style={{
        fontSize: 12, color: "#0f0f0f", fontWeight: "bold", lineHeight: 1,
        opacity: hover ? 0.95 : 0, transition: "opacity 0.1s",
        background: hover ? "rgba(255,255,255,0.9)" : "transparent",
        borderRadius: 3, padding: "0 1px", pointerEvents: "none",
      }}>⇿</span>
    </div>
  );
}