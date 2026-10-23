import { useRef } from "react";

// Sits inside the player window when no media is loaded.
export default function LoadMediaPanel({ th, dragOver, setDragOver, onDrop, onFile, urlInput, setUrlInput, onLoadUrl }) {
  const fileInputRef = useRef(null);

  return (
    <div style={{ width: "100%", minHeight: 220, background: th.sidebar, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
      <div style={{ fontSize: 11, color: th.label, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>Load Audio / Video</div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current.click()}
        style={{
          width: "100%", maxWidth: 380, boxSizing: "border-box",
          border: `2px dashed ${dragOver ? th.accent : "#ccc"}`,
          borderRadius: 6, padding: "22px", textAlign: "center", cursor: "pointer",
          transition: "border-color 0.2s",
          background: dragOver ? th.accent + "11" : "transparent",
        }}
      >
        <div style={{ fontSize: 30, marginBottom: 4 }}>📂</div>
        <div style={{ fontSize: 12, color: th.label }}>Drop file or click to browse</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.aiff,.aif,.ogg,.mp4,.mov,.mkv,.webm,.json"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }}
      />

      <div style={{ display: "flex", gap: 6, width: "100%", maxWidth: 380 }}>
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="YouTube / SoundCloud / AuralPapers URL"
          onKeyDown={(e) => e.key === "Enter" && onLoadUrl(urlInput)}
          style={{ flex: 1, minWidth: 0, padding: "6px 8px", boxSizing: "border-box", background: th.inputBg, color: th.inputFg, border: `1px solid ${th.inputBorder}`, borderRadius: 4, fontSize: 11 }}
        />
        <button
          onClick={() => onLoadUrl(urlInput)}
          style={{ padding: "6px 14px", background: "#735bc1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
        >Load URL</button>
      </div>
    </div>
  );
}