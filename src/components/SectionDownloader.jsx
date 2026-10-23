import { useState } from "react";

// ── WAV encoder ────────────────────────────────────────────────────────────────
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16;
  const samples = audioBuffer.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function floatTo16Bit(val) {
    const s = Math.max(-1, Math.min(1, val));
    return s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, floatTo16Bit(audioBuffer.getChannelData(ch)[i]), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function decodeAudioElementSrc(audioEl) {
  const src = audioEl.src;
  if (!src) throw new Error("No audio source found.");
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  return decoded;
}

function sliceToWav(audioBuffer, startSec, endSec) {
  const sr = audioBuffer.sampleRate;
  const startSample = Math.round(startSec * sr);
  const endSample = Math.min(audioBuffer.length, Math.round(endSec * sr));
  const length = endSample - startSample;
  if (length <= 0) throw new Error("Section has zero length.");
  const numChannels = audioBuffer.numberOfChannels;
  const sliced = new AudioBuffer({ numberOfChannels: numChannels, length, sampleRate: sr });
  for (let ch = 0; ch < numChannels; ch++) {
    sliced.copyToChannel(audioBuffer.getChannelData(ch).slice(startSample, endSample), ch);
  }
  return encodeWAV(sliced);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function zeroPad(n, width = 2) { return String(n).padStart(width, "0"); }

const MAX_TOTAL_SECONDS = 30;

// ── Timecode helpers ───────────────────────────────────────────────────────────
function toTC(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${m}:${zeroPad(s)}.${zeroPad(cs)}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SectionDownloader({
  selectedSection,
  multiSelectedIds,
  sections,
  duration,
  mediaType,
  activeUrl,
  audioElRef,
  onClose,
}) {
  const [baseName, setBaseName] = useState(
    selectedSection?.label?.replace(/[^a-z0-9\-_ ]/gi, "_") || "section"
  );
  const [phase, setPhase] = useState("setup");
  const [progress, setProgress] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [copied, setCopied] = useState(null);

  const isDirectCapture = mediaType === "local" || mediaType === "auralpapers";
  const isCueSheet = mediaType === "youtube" || mediaType === "soundcloud";

  const sectionsToRecord = (() => {
    if (!sections || sections.length === 0) return [];
    const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedSection ? [selectedSection.id] : []);
    return [...sections].filter(s => ids.includes(s.id)).sort((a, b) => a.time - b.time);
  })();

  const totalSeconds = sectionsToRecord.reduce((sum, s) => sum + (s.endTime - s.time), 0);
  const overLimit = totalSeconds > MAX_TOTAL_SECONDS;

  const cappedSections = (() => {
    let acc = 0;
    return sectionsToRecord.filter(s => {
      if (acc >= MAX_TOTAL_SECONDS) return false;
      acc += s.endTime - s.time;
      return true;
    });
  })();

  async function startDownload() {
    setPhase("processing");
    setProgress(cappedSections.map(() => 0));
    try {
      const audioEl = audioElRef?.current;
      if (!audioEl) throw new Error("Audio element not found.");
      setProgress(cappedSections.map(() => 0.1));
      const fullBuffer = await decodeAudioElementSrc(audioEl);
      setProgress(cappedSections.map(() => 0.5));
      const files = [];
      for (let i = 0; i < cappedSections.length; i++) {
        const sec = cappedSections[i];
        const suffix = cappedSections.length > 1 ? `_${zeroPad(i + 1)}` : "";
        const filename = `${baseName.trim() || "section"}${suffix}.wav`;
        const wavBlob = sliceToWav(fullBuffer, sec.time, sec.endTime);
        downloadBlob(wavBlob, filename);
        files.push(filename);
        setProgress(prev => prev.map((v, idx) => idx <= i ? 1 : 0.5));
      }
      setDownloadedFiles(files);
      setPhase("done");
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("error");
    }
  }

  function copyText(key, text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const formatDur = (s) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#1a1a1a", border: "1px solid #444", borderRadius: 10,
        padding: "28px 32px", width: 440, maxHeight: "85vh", overflowY: "auto",
        color: "#eee", fontFamily: "Arial, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>⬇</span>
          <span style={{ fontSize: 15, fontWeight: "bold", color: "#00d4ff" }}>
            {isCueSheet ? "Export Timecode List" : "Download Section Audio"}
          </span>
          <button onClick={onClose} disabled={phase === "processing"}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#666", fontSize: 18, cursor: phase === "processing" ? "not-allowed" : "pointer" }}>✕</button>
        </div>

        {phase === "setup" && (
          <>
            {/* ── Timecode list (YouTube / SoundCloud) ── */}
            {isCueSheet && (
              <>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                  {sectionsToRecord.length} section{sectionsToRecord.length !== 1 ? "s" : ""} — in/out timecodes
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {sectionsToRecord.map((sec, i) => {
                    const inTC = toTC(sec.time);
                    const outTC = toTC(sec.endTime);
                    const line = `${sec.label}\t${inTC}\t${outTC}`;
                    return (
                      <div key={sec.id} style={{ background: "#222", border: `1px solid ${sec.color}44`, borderRadius: 6, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: "bold", color: "#eee", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.label}</div>
                          <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>
                            In: <span style={{ color: "#00d4ff" }}>{inTC}</span>
                            <span style={{ margin: "0 6px", color: "#555" }}>→</span>
                            Out: <span style={{ color: "#00d4ff" }}>{outTC}</span>
                            <span style={{ marginLeft: 8, color: "#666" }}>({formatDur(sec.endTime - sec.time)})</span>
                          </div>
                        </div>
                        <button onClick={() => copyText(i, line)}
                          style={{ padding: "3px 8px", background: copied === i ? "#27ae60" : "#333", color: "#eee", border: "none", borderRadius: 3, fontSize: 10, cursor: "pointer", flexShrink: 0 }}>
                          {copied === i ? "✓" : "Copy"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Download all as .txt */}
                {(() => {
                  const fullText = sectionsToRecord.map(sec =>
                    `${sec.label}\t${toTC(sec.time)}\t${toTC(sec.endTime)}`
                  ).join("\n");
                  return (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        const blob = new Blob([fullText], { type: "text/plain" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${baseName.trim() || "sections"}_timecodes.txt`;
                        a.click(); URL.revokeObjectURL(a.href);
                      }}
                        style={{ flex: 1, padding: "9px", background: "#00d4ff", color: "#000", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
                        ⬇ Download .txt
                      </button>
                      <button onClick={() => copyText("all", fullText)}
                        style={{ padding: "9px 14px", background: copied === "all" ? "#27ae60" : "#333", color: "#eee", border: "1px solid #555", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                        {copied === "all" ? "✓ Copied" : "Copy All"}
                      </button>
                      <button onClick={onClose}
                        style={{ padding: "9px 14px", background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                        Close
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── Direct WAV export (local / auralpapers) ── */}
            {isDirectCapture && (
              <>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>
                  {cappedSections.length} section{cappedSections.length !== 1 ? "s" : ""} selected
                  {overLimit && <span style={{ color: "#e74c3c" }}> (capped at 30s total)</span>}
                </div>

                <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  {cappedSections.map((sec) => (
                    <div key={sec.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.label}</span>
                      <span style={{ color: "#888", flexShrink: 0, fontFamily: "monospace", fontSize: 10 }}>{toTC(sec.time)} → {toTC(sec.endTime)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #333", paddingTop: 6, marginTop: 4, fontSize: 11, color: "#888", textAlign: "right" }}>
                    Total: <strong style={{ color: overLimit ? "#e74c3c" : "#eee" }}>{formatDur(Math.min(totalSeconds, MAX_TOTAL_SECONDS))}</strong>
                    <span style={{ color: "#555" }}> / 30s max</span>
                  </div>
                </div>

                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>Base filename</label>
                <input
                  value={baseName}
                  onChange={e => setBaseName(e.target.value)}
                  placeholder="section"
                  style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "#222", color: "#eee", border: "1px solid #555", borderRadius: 4, fontSize: 13, marginBottom: 4, fontFamily: "monospace" }}
                />
                {cappedSections.length > 1 ? (
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 14 }}>
                    Files: {baseName || "section"}_01.wav, {baseName || "section"}_02.wav…
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 14 }}>
                    File: {baseName || "section"}.wav
                  </div>
                )}

                <button
                  onClick={startDownload}
                  disabled={cappedSections.length === 0}
                  style={{
                    width: "100%", padding: "10px",
                    background: cappedSections.length > 0 ? "#00d4ff" : "#555",
                    color: cappedSections.length > 0 ? "#000" : "#eee",
                    border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 14,
                    cursor: cappedSections.length > 0 ? "pointer" : "not-allowed",
                  }}
                >⬇ Export as WAV</button>
              </>
            )}
          </>
        )}

        {phase === "processing" && (
          <>
            <div style={{ fontSize: 12, color: "#00d4ff", marginBottom: 16, fontWeight: "bold" }}>⏳ Exporting…</div>
            {cappedSections.map((sec, i) => (
              <div key={sec.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{sec.label}</span>
                  <span>{Math.round((progress[i] || 0) * 100)}%</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "#333", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    background: progress[i] >= 1 ? "#27ae60" : "#00d4ff",
                    width: `${(progress[i] || 0) * 100}%`,
                    transition: "width 0.2s, background 0.3s",
                  }} />
                </div>
              </div>
            ))}
          </>
        )}

        {phase === "done" && (
          <>
            <div style={{ fontSize: 14, color: "#27ae60", marginBottom: 14, fontWeight: "bold" }}>✓ Export complete!</div>
            <div style={{ marginBottom: 20 }}>
              {downloadedFiles.map(f => (
                <div key={f} style={{ color: "#aaa", fontSize: 11, marginBottom: 2 }}>📄 {f}</div>
              ))}
            </div>
            <button onClick={onClose}
              style={{ width: "100%", padding: "9px", background: "#27ae60", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
              Close
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 14 }}>⚠ Export failed</div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 20, lineHeight: 1.6 }}>{errorMsg}</div>
            <button onClick={() => setPhase("setup")}
              style={{ width: "100%", padding: "9px", background: "#555", color: "#eee", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 13, cursor: "pointer" }}>
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}