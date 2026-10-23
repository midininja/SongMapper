import { useState } from "react";

function parseTimeInput(str) {
  // Accepts m:ss, m:ss.ms, or raw seconds
  str = str.trim();
  const parts = str.split(":");
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function formatTimeDetailed(t) {
  if (isNaN(t) || t == null) return "0:00.000";
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

export default function SectionBoundaryEditor({ section, duration, onCommit, onCancel }) {
  const [inVal, setInVal] = useState(formatTimeDetailed(section.time));
  const [outVal, setOutVal] = useState(formatTimeDetailed(section.endTime));
  const [error, setError] = useState("");

  function handleCommit() {
    const inTime = parseTimeInput(inVal);
    const outTime = parseTimeInput(outVal);
    if (inTime === null || outTime === null) { setError("Invalid time format. Use m:ss.ms or seconds."); return; }
    if (inTime < 0 || outTime > duration) { setError(`Times must be within 0 – ${formatTimeDetailed(duration)}.`); return; }
    if (inTime >= outTime) { setError("In point must be before out point."); return; }
    onCommit(inTime, outTime);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{
        background: "#1e1e1e", border: `2px solid ${section.color}`,
        borderRadius: 8, padding: "24px 28px", width: 340, color: "#eee"
      }}>
        <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 16, color: section.color }}>
          Edit "{section.label}" In/Out Points
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12 }}>
            <span style={{ color: "#aaa", display: "block", marginBottom: 4 }}>In point (m:ss.ms)</span>
            <input
              value={inVal}
              onChange={e => { setInVal(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleCommit()}
              style={{ width: "100%", padding: "6px 8px", background: "#2a2a2a", color: "#eee", border: "1px solid #555", borderRadius: 4, fontSize: 13, boxSizing: "border-box", fontFamily: "monospace" }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={{ color: "#aaa", display: "block", marginBottom: 4 }}>Out point (m:ss.ms)</span>
            <input
              value={outVal}
              onChange={e => { setOutVal(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleCommit()}
              style={{ width: "100%", padding: "6px 8px", background: "#2a2a2a", color: "#eee", border: "1px solid #555", borderRadius: 4, fontSize: 13, boxSizing: "border-box", fontFamily: "monospace" }}
            />
          </label>
          {error && <div style={{ fontSize: 11, color: "#e74c3c" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onCancel} style={{ padding: "7px 16px", background: "#333", color: "#eee", border: "1px solid #555", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            <button onClick={handleCommit} style={{ padding: "7px 16px", background: section.color, color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}