import OverflowToolbar from "@/components/OverflowToolbar";
import { LoopButton, SliceButton, SectionControlItems, DownloadButton, ZoomControlItems, DeselectButton, TH, formatTime } from "@/components/mapControls";

export default function SectionEditBar({
  isPlaying, onToggle, showVolume,
  selectedSection, loopActive, loopCount, canLoop, onToggleLoop, loopUnit, loopSingleLabel, sliceTarget,
  onSlice, videoLoaded, onAddSection, onDelete, currentTime,
  showWaveform, onToggleWaveform,
  binTooltip, canDelete, mediaType, onDownload, showWaveformToggle,
  zoomLevel, applyZoom, duration, playbackRate, setPlaybackRate, speedActive, setSpeedActive,
  hasSelection, onDeselect, showDeselect,
  volume, onVolumeChange,
  focusMode, onToggleFocus,
}) {
  const items = [
    <button key="play" onPointerDown={e => { e.preventDefault(); onToggle(); }}
      style={{ background: "#1abc9c", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#fff", fontWeight: "bold", flexShrink: 0 }}>
      {isPlaying ? "⏸" : "▶"}
    </button>,
    <span key="time" style={{ fontSize: 12, color: TH.controlBarText, flexShrink: 0, userSelect: "none", WebkitUserSelect: "none" }}>{formatTime(currentTime)} / {formatTime(duration)}</span>,
    <LoopButton key="loop" loopActive={loopActive} loopCount={loopCount} canLoop={canLoop} onToggle={onToggleLoop} unit={loopUnit} singleLabel={loopSingleLabel} />,
    <SliceButton key="slice" selectedSection={selectedSection} onSlice={onSlice} sliceTarget={sliceTarget} />,
    ...SectionControlItems({ videoLoaded, addSection: onAddSection, deleteSection: onDelete, showWaveform, onToggleWaveform, binTooltip, canDelete, showWaveformToggle }),
    <DownloadButton key="dl" enabled={!!selectedSection} onClick={onDownload} mediaType={mediaType} />,
  ];

  if (showVolume) {
    items.push(
      <div key="vol" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {mediaType === "local" && <DeselectButton hasSelection={hasSelection} onDeselect={onDeselect} />}
        <span style={{ fontSize: 12, color: TH.controlBarText }}>vol</span>
        <input type="range" min={0} max={1} step={0.01} value={volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
          style={{ width: 55, accentColor: TH.accent, touchAction: "none" }} />
      </div>
    );
  }

  items.push(
    ...ZoomControlItems({ zoomLevel, applyZoom, currentTime, duration, playbackRate, setPlaybackRate, speedActive, setSpeedActive, hasSelection, onDeselect, showDeselect })
  );

  items.push(
    <button
      key="focus"
      onPointerDown={e => e.preventDefault()}
      onClick={onToggleFocus}
      title={focusMode ? "Exit full-screen mode" : "Expand to full-screen (collapses other columns & notes)"}
      style={{
        background: focusMode ? "#0a5cd6" : "#e4e4e4",
        color: focusMode ? "#fff" : "#333",
        border: `1px solid ${focusMode ? "#0a5cd6" : "#bbb"}`,
        borderRadius: 4, padding: "3px 8px", fontSize: 13,
        cursor: "pointer", height: 24, flexShrink: 0, lineHeight: 1, fontWeight: "bold",
      }}
    >{focusMode ? "⇱" : "⇲"}</button>
  );

  return (
    <OverflowToolbar barStyle={{ display: "flex", alignItems: "center", gap: 3, padding: "5px 8px", background: TH.controlBar, borderTop: `1px solid ${TH.controlBarBorder}`, flexWrap: "nowrap" }}>
      {items}
    </OverflowToolbar>
  );
}