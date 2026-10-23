import { useState } from "react";
import { PRESET_COLOURS } from "@/components/ColorPicker";

export function randomPresetColour() {
  return PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)];
}
export function hueFromHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h;
}
export function pickContrasting(lastHex) {
  if (!lastHex) return randomPresetColour();
  const lastHue = hueFromHex(lastHex);
  const candidates = PRESET_COLOURS.filter((c) => {
    const dh = Math.abs(hueFromHex(c.hex) - lastHue);
    return Math.min(dh, 360 - dh) > 60;
  });
  const pool = candidates.length > 0 ? candidates : PRESET_COLOURS.filter((c) => c.hex.toLowerCase() !== lastHex.toLowerCase());
  return pool[Math.floor(Math.random() * pool.length)] || randomPresetColour();
}

export const MAX_ZOOM = 40;
export const SAMPLER_KEYS = ["z","x","c","v","a","s","d","f","q","w","e","r","1","2","3","4"];

// Ableton Learn-inspired theme
export const TH = {
  bg: "#ffffff",
  fg: "#0f0f0f",
  sidebar: "#f5f5f5",
  sidebarBorder: "#e0e0e0",
  inputBg: "#ffffff",
  inputBorder: "#d0d0d0",
  inputFg: "#0f0f0f",
  btnBg: "#f0f0f0",
  btnBorder: "#d0d0d0",
  btnFg: "#333",
  btnDisabled: "#e8e8e8",
  btnDisabledFg: "#bbb",
  label: "#888",
  rightSidebar: "#fafafa",
  controlBar: "#f0f0f0",
  controlBarBorder: "#e0e0e0",
  controlBarText: "#666",
  timelineBg: "#e8e8e8",
  accent: "#0a5cd6",
};

export function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v");
  } catch { return null; }
}
export function isYouTubeUrl(url) { return !!getYouTubeId(url); }
export function isSoundCloudUrl(url) { try { return new URL(url).hostname.includes("soundcloud.com"); } catch { return false; } }
export function isAuralPapersUrl(url) { try { const h = new URL(url).hostname; return h.includes("auralpapers.com"); } catch { return false; } }

export function btnStyle(bg, color, disabled = false) {
  return {
    padding: "7px 0", width: "100%",
    background: disabled ? TH.btnDisabled : bg,
    color: disabled ? TH.btnDisabledFg : color,
    border: "none", borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "bold", fontSize: 12,
    marginBottom: 6,
  };
}

export function iconBoxStyle(disabled = false) {
  return {
    width: 24, height: 22, borderRadius: 3,
    background: disabled ? TH.btnDisabled : "#e0e0e0",
    color: disabled ? TH.btnDisabledFg : "#333",
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, fontWeight: "bold", padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

export function formatTime(t) {
  if (!t || isNaN(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LoopButton({ loopActive = false, loopCount = 0, canLoop = false, onToggle, unit = "section", singleLabel = "" }) {
  const isMultiLoop = loopActive && loopCount > 1;
  const title = loopActive
    ? (isMultiLoop ? `Looping ${loopCount} ${unit}s` : "Stop looping")
    : canLoop
      ? (loopCount > 1 ? `Loop ${loopCount} selected ${unit}s` : (unit === "subsection" ? "Loop selected subsection" : `Loop: ${singleLabel}`))
      : `Select a ${unit} to loop`;
  return (
    <button
      onPointerDown={e => e.preventDefault()}
      onClick={() => { if (!canLoop) return; onToggle(); }}
      title={title}
      style={{
        background: "#e4e4e4",
        border: `1px solid ${TH.btnBorder}`,
        borderRadius: 4, padding: "3px 8px",
        cursor: canLoop ? "pointer" : "not-allowed",
        color: loopActive ? "#333" : "#aaa",
        fontSize: 12, fontWeight: "bold", flexShrink: 0,
        opacity: canLoop ? 1 : 0.5, height: 24,
      }}
    >↻{isMultiLoop ? loopCount : ""}</button>
  );
}

export function SliceButton({ selectedSection, onSlice, sliceTarget }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [sliceCount, setSliceCount] = useState(4);
  const canSlice = !!selectedSection;

  if (!showPrompt) {
    return (
      <button
        onPointerDown={e => e.preventDefault()}
        onClick={() => canSlice && setShowPrompt(true)}
        title={canSlice ? (sliceTarget || `Slice "${selectedSection.label}"`) : "Select a section to slice"}
        style={{
          background: canSlice ? "#e4e4e4" : TH.btnDisabled, border: `1px solid ${TH.btnBorder}`,
          borderRadius: 4, padding: "3px 8px", height: 24,
          cursor: canSlice ? "pointer" : "not-allowed",
          color: canSlice ? "#333" : TH.btnDisabledFg,
          fontSize: 12, flexShrink: 0,
          opacity: canSlice ? 1 : 0.5,
        }}
      >{"\u2702\uFE0E"}</button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: TH.btnBg, border: "1px solid #f39c12", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: "#f39c12" }}>Slices:</span>
      <select value={sliceCount} onChange={e => setSliceCount(Number(e.target.value))}
        style={{ background: TH.inputBg, color: TH.inputFg, border: "none", fontSize: 10, outline: "none" }}>
        {Array.from({ length: 15 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <button onPointerDown={e => e.preventDefault()} onClick={() => { onSlice(sliceCount); setShowPrompt(false); }}
        style={{ background: "#f39c12", color: "#000", border: "none", borderRadius: 3, fontSize: 10, fontWeight: "bold", cursor: "pointer", padding: "1px 6px" }}>OK</button>
      <button onPointerDown={e => e.preventDefault()} onClick={() => setShowPrompt(false)}
        style={{ background: "transparent", color: "#888", border: "none", fontSize: 12, cursor: "pointer" }}>✕</button>
    </div>
  );
}

export function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = "Confirm", confirmColor = TH.accent, confirmTextColor = "#fff", cancelLabel = "Cancel" }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#ffffff", border: `1px solid ${TH.sidebarBorder}`, borderRadius: 8, padding: "28px 32px", maxWidth: 380, textAlign: "center", color: TH.fg, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
        <p style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onConfirm} style={{ padding: "8px 20px", background: confirmColor, color: confirmTextColor, border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ padding: "8px 20px", background: TH.btnBg, color: TH.btnFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Returns the zoom tools as SEPARATE items (deselect / zoom group / speed) so the
// overflow toolbar can split between them in narrow compare columns.
export function ZoomControlItems({ zoomLevel, applyZoom, currentTime, duration, playbackRate, setPlaybackRate, speedActive, setSpeedActive, hasSelection, onDeselect, showDeselect = true }) {
  const sliderVal = zoomLevel <= 1 ? 0 : Math.log(zoomLevel) / Math.log(MAX_ZOOM);
  const playheadAnchor = duration > 0 ? currentTime / duration : 0.5;
  function onSliderChange(v) {
    const newZoom = v <= 0 ? 1 : Math.exp(v * Math.log(MAX_ZOOM));
    applyZoom(newZoom, playheadAnchor);
  }
  function nudgeSpeed(dir) {
    const next = Math.round((playbackRate + dir * 0.05) * 100) / 100;
    setPlaybackRate(Math.max(0.25, Math.min(2.0, next)));
  }
  const items = [];
  if (showDeselect) items.push(<DeselectButton key="deselect" hasSelection={hasSelection} onDeselect={onDeselect} />);
  items.push(
    <div key="zoom" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <button onPointerDown={e => e.preventDefault()} onClick={() => applyZoom(Math.max(1, zoomLevel / 1.5), playheadAnchor)} title="Zoom out"
        style={{ background: "none", border: "none", color: zoomLevel <= 1 ? "#ccc" : "#666", cursor: zoomLevel <= 1 ? "not-allowed" : "pointer", fontSize: 11, lineHeight: 1, padding: "0 2px", fontWeight: "bold" }}>−</button>
      <input type="range" min={0} max={1} step={0.001}
        value={sliderVal}
        onChange={e => onSliderChange(parseFloat(e.target.value))}
        onPointerDown={e => e.stopPropagation()}
        style={{ width: 70, accentColor: TH.accent, touchAction: "none" }}
        title={`Zoom: ${zoomLevel.toFixed(1)}×`}
      />
      <button onPointerDown={e => e.preventDefault()} onClick={() => applyZoom(Math.min(MAX_ZOOM, zoomLevel * 1.5), playheadAnchor)} title="Zoom in"
        style={{ background: "none", border: "none", color: zoomLevel >= MAX_ZOOM ? "#ccc" : "#666", cursor: zoomLevel >= MAX_ZOOM ? "not-allowed" : "pointer", fontSize: 11, lineHeight: 1, padding: "0 2px", fontWeight: "bold" }}>+</button>
      <span style={{ fontSize: 9, color: TH.label, minWidth: 28 }}>{zoomLevel.toFixed(1)}×</span>
    </div>
  );
  items.push(
    <div key="speed" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 6, flexShrink: 0 }}>
      {speedActive && <button onPointerDown={e => e.preventDefault()} onClick={() => nudgeSpeed(1)} title="Speed up" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 9, lineHeight: 1, padding: "1px 3px" }}>＋</button>}
      <button
        onPointerDown={e => e.preventDefault()}
        onClick={() => { setSpeedActive(v => !v); if (speedActive) setPlaybackRate(1); }}
        title={speedActive ? `Speed: ${playbackRate.toFixed(2)}× (click to reset)` : "Enable speed control (↑↓ keys)"}
        style={{
          background: speedActive ? (playbackRate !== 1 ? "#f39c12" : TH.btnBg) : TH.btnBg,
          border: `1px solid ${speedActive ? "#f39c12" : TH.btnBorder}`,
          borderRadius: 4, padding: "1px 5px", cursor: "pointer",
          color: speedActive ? (playbackRate !== 1 ? "#000" : "#f39c12") : TH.label,
          fontSize: 9, fontWeight: "bold", minWidth: 36, textAlign: "center",
        }}
      >{speedActive ? `${playbackRate.toFixed(2)}×` : "spd"}</button>
      {speedActive && <button onPointerDown={e => e.preventDefault()} onClick={() => nudgeSpeed(-1)} title="Slow down" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 9, lineHeight: 1, padding: "1px 3px" }}>－</button>}
    </div>
  );
  return items;
}

export function ZoomControl(props) {
  return <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", flexShrink: 0 }}>{ZoomControlItems(props)}</div>;
}

// Returns the section tools as SEPARATE items so the overflow toolbar can split
// between them — in narrow compare columns a single grouped control wasted space.
export function SectionControlItems({ videoLoaded, addSection, deleteSection, showWaveform, onToggleWaveform, binTooltip, canDelete, showWaveformToggle = true }) {
  const items = [
    <button key="add" onPointerDown={e => e.preventDefault()} onClick={addSection} disabled={!videoLoaded} title="Add section (Enter)"
      style={{ background: videoLoaded ? "#e4e4e4" : TH.btnDisabled, color: videoLoaded ? "#333" : TH.btnDisabledFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, padding: "3px 8px", fontSize: 12, cursor: videoLoaded ? "pointer" : "not-allowed", height: 24, flexShrink: 0, lineHeight: 1 }}>
      ➕
    </button>,
    <button key="del" onPointerDown={e => e.preventDefault()} onClick={deleteSection} disabled={!canDelete} title={binTooltip}
      style={{ background: canDelete ? "#e4e4e4" : TH.btnDisabled, color: canDelete ? "#333" : TH.btnDisabledFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, padding: "3px 8px", fontSize: 12, cursor: canDelete ? "pointer" : "not-allowed", height: 24, flexShrink: 0, lineHeight: 1 }}>
      🗑️
    </button>,
  ];
  if (showWaveformToggle) {
    items.push(
      <button key="wave" onPointerDown={e => e.preventDefault()} onClick={onToggleWaveform} title="show/hide waveform"
        style={{ background: "#e4e4e4", color: showWaveform ? "#333" : "#aaa", border: `1px solid ${TH.btnBorder}`, borderRadius: 4, padding: "3px 8px", fontSize: 12, cursor: "pointer", height: 24, flexShrink: 0, lineHeight: 1, fontWeight: "bold" }}>
        ∿
      </button>
    );
  }
  return items;
}

export function SectionControls(props) {
  return <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>{SectionControlItems(props)}</div>;
}

export function DownloadButton({ enabled, onClick, mediaType }) {
  const isUrlMedia = mediaType === "youtube" || mediaType === "soundcloud" || mediaType === "auralpapers";
  const tooltip = enabled
    ? (isUrlMedia ? "Download section timecodes" : "Download section audio as .wav")
    : "Select a section to download";
  return (
    <button
      onPointerDown={e => e.preventDefault()}
      onClick={enabled ? onClick : undefined}
      title={tooltip}
      style={{
        background: enabled ? "#e4e4e4" : TH.btnDisabled,
        color: enabled ? "#333" : TH.btnDisabledFg,
        border: `1px solid ${TH.btnBorder}`,
        borderRadius: 4, padding: "3px 8px", fontSize: 12,
        cursor: enabled ? "pointer" : "not-allowed",
        opacity: enabled ? 1 : 0.5, height: 24, flexShrink: 0, lineHeight: 1,
      }}
      aria-label="Download section audio"
    >⤓</button>
  );
}

export function DeselectButton({ hasSelection, onDeselect }) {
  return (
    <button
      onPointerDown={e => e.preventDefault()}
      onClick={onDeselect}
      title="Deselect (Ctrl+D)"
      style={{
        background: "transparent", border: "none",
        cursor: hasSelection ? "pointer" : "default",
        color: hasSelection ? "#333" : "#aaa",
        fontSize: 14, padding: "0 4px", flexShrink: 0, lineHeight: 1,
      }}
    >{hasSelection ? "✊" : "✋"}</button>
  );
}