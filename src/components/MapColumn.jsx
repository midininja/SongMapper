import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import SectionNotesPanel from "@/components/SectionNotesPanel";
import SectionBoundaryEditor from "@/components/SectionBoundaryEditor";
import SectionDownloader from "@/components/SectionDownloader";
import LoadMediaPanel from "@/components/LoadMediaPanel";
import WaveformOverlay from "@/components/WaveformOverlay";
import { PRESET_COLOURS, SHADE_STEPS, lighten, hexToName } from "@/components/ColorPicker";
import { computePeaks } from "@/lib/waveform";
import {
  TH, MAX_ZOOM, SAMPLER_KEYS, getYouTubeId, isYouTubeUrl, isSoundCloudUrl, isAuralPapersUrl,
  randomPresetColour, pickContrasting, ConfirmModal,
} from "@/components/mapControls";
import SectionEditBar from "@/components/SectionEditBar";
import TrimHandle from "@/components/TrimHandle";
import CollapsedColumnStrip from "@/components/CollapsedColumnStrip";

const YT_INIT_QUEUE = [];
const PENCIL_CURSOR = "url(data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M11 1l4 4-8 8H3v-4z' fill='%23333' stroke='%23fff' stroke-width='1'/></svg>) 2 14, text";
const MapColumn = forwardRef(function MapColumn({ index = 0, order = 0, active = true, selected = false, preview = false, compareMode = false, grab = null, buttonMode = "single", saveDisabled = false, onState, onSelect, onHover, onNew, onLoadCompareMap, onSave, onSaveCompare, onUndo, onRedo, onHistoryPush, onHistoryReset, onDeselectAll, loopChainNext = null, onLoopHandoff, samplerOffset = 0, onSamplerKey, collapsed = false, onToggleCollapse, alignTabHeight = 0, focusMode = false, onToggleFocus, hidden = false }, ref) {
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const playerRef = useRef(null);
  const timelineRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const rafRef = useRef(null);
  const isDraggingRef = useRef(false);
  const timelineDragRef = useRef(false);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const reattachInputRef = useRef(null);
  const localPlayerRef = useRef(null);
  const apPlayerRef = useRef(null);
  const histRef = useRef([]);
  const histIdxRef = useRef(-1);
  const sectionsRef = useRef([]);
  const wasSelectedRef = useRef(selected);
  const lastEditEnterRef = useRef(0);
  const ytReadyRef = useRef(false);
  const pendingYtIdRef = useRef(null);
  const pendingYtCueRef = useRef(false);
  const scWidgetRef = useRef(null);
  const mapNameInputRef = useRef(null);
  const tabsRef = useRef(null);
  const ytPlayerId = `yt-player-${index}`;
  const scIframeId = `sc-iframe-${index}`;

  // ── State ────────────────────────────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState("");
  const [pendingLoad, setPendingLoad] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [activeUrl, setActiveUrl] = useState("");
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLOURS[0].hex);
  const [palette, setPalette] = useState([]);
  const [selectedSource, setSelectedSource] = useState("preview");
  const [colourMultiSelect, setColourMultiSelect] = useState([]);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [labelValue, setLabelValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState(null);
  const [localFileName, setLocalFileName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [apPlaying, setApPlaying] = useState(false);
  const [scPlaying, setScPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [embedDurationInput, setEmbedDurationInput] = useState("");
  const [notes, setNotes] = useState({});
  const [loopSectionId, setLoopSectionId] = useState(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [editingBoundarySection, setEditingBoundarySection] = useState(null);
  const [mapName, setMapName] = useState("Untitled Map");
  const [editingMapName, setEditingMapName] = useState(false);
  const [tabHeight, setTabHeight] = useState(0);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const [showDownloader, setShowDownloader] = useState(false);
  const [confirmNewMap, setConfirmNewMap] = useState(false);
  const samplerRef = useRef({ active: false, endTime: 0 });
  const multiLoopRef = useRef({ active: false, sections: [], currentIdx: 0 });
  const shadeIterRef = useRef(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedActive, setSpeedActive] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [subFocus, setSubFocus] = useState(null); // focused subsection strip: { sectionId, rowId }
  const [confirmSectionDelete, setConfirmSectionDelete] = useState(false);
  const [subSelection, setSubSelection] = useState(null); // reported by notes panel: { sectionId, rowId, ids }
  const [subLoop, setSubLoop] = useState(null); // active subsection loop: { sectionId, rowId, ids }
  const [tabLabelValue, setTabLabelValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingUnsaved, setPendingUnsaved] = useState(null);
  const [showWaveform, setShowWaveform] = useState(true);
  const [waveformPeaks, setWaveformPeaks] = useState(null);
  const waveformLoadIdRef = useRef(0);
  const [mediaStart, setMediaStart] = useState(0);
  const [mediaEnd, setMediaEnd] = useState(0);
  const [mediaHeight, setMediaHeight] = useState(160); // draggable bottom border

  // Keep a ref of sections so async media callbacks can tell fresh loads apart from
  // saved-map loads / re-attached files (which must NOT re-init sections).
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  // ── Playback rate effect ──────────────────────────────────────────────────────
  useEffect(() => {
    const rate = speedActive ? playbackRate : 1;
    if (localPlayerRef.current) localPlayerRef.current.playbackRate = rate;
    if (apPlayerRef.current) apPlayerRef.current.playbackRate = rate;
    if (playerRef.current?.setPlaybackRate) playerRef.current.setPlaybackRate(rate);
  }, [playbackRate, speedActive]);

  // ── Unified history (sections + notes, chronological) ───────────────────────
  function pushHistory(newSections, newPalette = palette, newNotes = notes) {
    const trimmed = histRef.current.slice(0, histIdxRef.current + 1);
    trimmed.push({ sections: newSections, palette: newPalette, notes: newNotes });
    if (trimmed.length > 50) trimmed.shift();
    histRef.current = trimmed;
    histIdxRef.current = trimmed.length - 1;
    setSections(newSections);
    if (newPalette !== palette) setPalette(newPalette);
    if (newNotes !== notes) setNotes(newNotes);
    onHistoryPush?.(index);
    setDirty(true);
  }
  function pushNotesHistory(newNotes) {
    pushHistory(sections, palette, newNotes);
  }
  function undo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current -= 1;
    const snap = histRef.current[histIdxRef.current];
    setSections(snap.sections);
    setPalette(snap.palette);
    setNotes(snap.notes);
    if (selectedId !== null && !snap.sections.some(s => s.id === selectedId)) {
      setSelectedId(null);
    }
  }
  function redo() {
    if (histIdxRef.current >= histRef.current.length - 1) return;
    histIdxRef.current += 1;
    const snap = histRef.current[histIdxRef.current];
    setSections(snap.sections);
    setPalette(snap.palette);
    setNotes(snap.notes);
    if (selectedId !== null && !snap.sections.some(s => s.id === selectedId)) {
      setSelectedId(null);
    }
  }
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < histRef.current.length - 1;

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  function applyZoom(newZoom, anchorPct) {
    newZoom = Math.max(1, Math.min(MAX_ZOOM, newZoom));
    const oldZoom = zoomLevel;
    const anchor = anchorPct ?? (zoomOffset + 0.5 / oldZoom);
    let newOffset = anchor - 0.5 / newZoom;
    newOffset = Math.max(0, Math.min(1 - 1 / newZoom, newOffset));
    setZoomLevel(newZoom);
    setZoomOffset(newOffset);
  }

  function panBy(delta) {
    if (zoomLevel <= 1) return;
    const newOffset = Math.max(0, Math.min(1 - 1 / zoomLevel, zoomOffset + delta));
    setZoomOffset(newOffset);
  }

  // ── Low-level play/pause helpers ─────────────────────────────────────────────
  function pauseMedia() {
    if (mediaType === "youtube" && playerRef.current) playerRef.current.pauseVideo();
    else if (mediaType === "local" && localPlayerRef.current) { localPlayerRef.current.pause(); setIsPlaying(false); }
    else if (mediaType === "auralpapers" && apPlayerRef.current) { apPlayerRef.current.pause(); setApPlaying(false); }
    else if (mediaType === "soundcloud" && scWidgetRef.current) scWidgetRef.current.pause();
  }
  function playMedia() {
    if (mediaType === "youtube" && playerRef.current) playerRef.current.playVideo();
    else if (mediaType === "local" && localPlayerRef.current) { localPlayerRef.current.play(); setIsPlaying(true); }
    else if (mediaType === "auralpapers" && apPlayerRef.current) { apPlayerRef.current.play().then(() => setApPlaying(true)).catch(() => {}); }
    else if (mediaType === "soundcloud" && scWidgetRef.current) scWidgetRef.current.play();
  }

  // ── Sampler key trigger ──────────────────────────────────────────────────────
  function triggerSamplerKey(keyIdx) {
    // When subsections hold selection focus, the sampler keys trigger them
    // instead of the section strip's sections.
    let startTime, endTime;
    const sel = (subSelection && subFocus && subFocus.sectionId === subSelection.sectionId
      && subFocus.rowId === subSelection.rowId && subSelection.sectionId === selectedId) ? subSelection : null;
    if (sel) {
      const ivs = getSubIntervals(sel);
      if (keyIdx < 0 || keyIdx >= ivs.length) return;
      startTime = ivs[keyIdx].start;
      endTime = ivs[keyIdx].end;
    } else {
      const sortedMulti = [...sections]
        .filter(s => multiSelectedIds.includes(s.id))
        .sort((a, b) => a.time - b.time);
      if (keyIdx < 0 || keyIdx >= sortedMulti.length) return;
      startTime = sortedMulti[keyIdx].time;
      endTime = sortedMulti[keyIdx].endTime;
    }
    samplerRef.current = { active: true, endTime };

    const audioEl = mediaType === "local" ? localPlayerRef.current : mediaType === "auralpapers" ? apPlayerRef.current : null;
    if (audioEl) {
      pauseMedia();
      audioEl.currentTime = startTime;
      setCurrentTime(startTime);
      const onSeeked = () => {
        audioEl.removeEventListener("seeked", onSeeked);
        audioEl.play().then(() => {
          if (mediaType === "local") setIsPlaying(true);
          if (mediaType === "auralpapers") setApPlaying(true);
        }).catch(() => {});
      };
      audioEl.addEventListener("seeked", onSeeked);
    } else {
      seekTo(startTime);
      playMedia();
    }
  }

  useEffect(() => {
    if (!samplerRef.current.active) return;
    if (currentTime >= samplerRef.current.endTime - 0.08) {
      samplerRef.current.active = false;
      pauseMedia();
    }
  }, [currentTime]);

  // ── Global key handler ────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (!active) return;
      // Use the event TARGET, not document.activeElement: React can unmount the
      // focused input during this very keydown (Enter confirming a rename), and
      // focus then falls to <body> — activeElement would pass every guard.
      const el = e.target;
      const inNote = !!el?.closest?.('[data-notearea="true"]');
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName);
      const inButton = el?.tagName === "BUTTON";
      const inEditable = !!el?.isContentEditable;
      const inTextarea = el?.tagName === "TEXTAREA" || el?.isContentEditable;

      // Enter consumed by a text edit / control — remember it so an immediately
      // following Enter (key repeat or double-tap) can't create a section.
      if (e.key === "Enter" && (inNote || inInput || inEditable || inButton)) lastEditEnterRef.current = Date.now();

      if (inNote && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      if (inInput && !inNote) return;

      if (!inNote && (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); (onUndo || undo)(); return; }
      if (!inNote && (e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); (onRedo || redo)(); return; }
      if (!inNote && !inInput && (e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); deselect(); return; }

      if (e.key === "Enter" && !inNote && !inInput && !inEditable && !inButton && videoLoaded) {
        if (Date.now() - lastEditEnterRef.current < 800) return;
        e.preventDefault();
        // A focused subsection strip captures Enter: add a division at the
        // strip's playhead instead of a new section (works on undivided strips
        // too — their placeholder row is materialized on the fly).
        if (subFocus && subFocus.sectionId === selectedId && addSubsectionAtPlayhead()) return;
        addSection();
        return;
      }

      if (e.key === " " && !inNote && !inInput && videoLoaded) {
        e.preventDefault();
        togglePlayPause();
        return;
      }

      if (!inNote && !inInput && e.key === "Delete") {
        if (colourMultiSelect.length > 0) {
          e.preventDefault();
          handleRemoveColour();
          return;
        }
        if (videoLoaded) {
          e.preventDefault();
          deleteSelected();
          return;
        }
      }

      if (!inNote || !inTextarea) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (speedActive) {
            const next = Math.round((playbackRate + 0.05) * 100) / 100;
            setPlaybackRate(Math.max(0.25, Math.min(2.0, next)));
          } else {
            applyZoom(zoomLevel * 1.3);
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (speedActive) {
            const next = Math.round((playbackRate - 0.05) * 100) / 100;
            setPlaybackRate(Math.max(0.25, Math.min(2.0, next)));
          } else {
            applyZoom(zoomLevel / 1.3);
          }
          return;
        }

        if (!inNote) {
          if (e.key === "ArrowRight" && !e.shiftKey) { e.preventDefault(); seekTo(currentTime + 5); return; }
          if (e.key === "ArrowLeft" && !e.shiftKey) { e.preventDefault(); seekTo(currentTime - 5); return; }
        }

        if (e.key === "ArrowRight" && e.shiftKey) {
          e.preventDefault();
          const s2 = [...sections].sort((a, b) => a.time - b.time);
          const idx = s2.findIndex(s => s.id === selectedId);
          if (idx >= 0 && idx < s2.length - 1) selectSection(s2[idx + 1]);
          return;
        }
        if (e.key === "ArrowLeft" && e.shiftKey) {
          e.preventDefault();
          const s2 = [...sections].sort((a, b) => a.time - b.time);
          const idx = s2.findIndex(s => s.id === selectedId);
          if (idx > 0) selectSection(s2[idx - 1]);
          return;
        }

        if (!inInput) {
          const keyIdx = SAMPLER_KEYS.indexOf(e.key);
          if (keyIdx >= 0) {
            e.preventDefault();
            onSamplerKey?.(keyIdx);
            return;
          }
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // ── YouTube API ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function doInit() { initYTPlayer(ytPlayerId); }
    if (window.YT && window.YT.Player) { doInit(); return; }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    YT_INIT_QUEUE.push(doInit);
    window.onYouTubeIframeAPIReady = () => { while (YT_INIT_QUEUE.length) YT_INIT_QUEUE.shift()(); };
    return () => {
      const i = YT_INIT_QUEUE.indexOf(doInit);
      if (i >= 0) YT_INIT_QUEUE.splice(i, 1);
    };
  }, [ytPlayerId]);

  // Resize the YouTube iframe when mediaHeight or focusMode changes — the YT API
  // creates the iframe with fixed pixel dimensions that don't respond to container CSS.
  useEffect(() => {
    if (mediaType !== "youtube") return;
    const iframe = document.getElementById(ytPlayerId)?.querySelector("iframe") || document.getElementById(ytPlayerId);
    const targetH = focusMode ? "100%" : `${mediaHeight}px`;
    if (iframe) {
      iframe.style.height = targetH;
      iframe.style.width = "100%";
    }
    if (playerRef.current?.setSize && !focusMode) {
      try { playerRef.current.setSize(640, mediaHeight); } catch {}
    }
  }, [mediaHeight, mediaType, ytPlayerId, focusMode]);

  function initYTPlayer(playerId) {
    if (playerRef.current && typeof playerRef.current.getPlayerState === "function") return;
    const el = document.getElementById(playerId);
    if (!el) return;
    playerRef.current = new window.YT.Player(playerId, {
      height: "140", width: "640",
      playerVars: { controls: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ytReadyRef.current = true;
          if (pendingYtIdRef.current) {
            if (pendingYtCueRef.current) playerRef.current.cueVideoById(pendingYtIdRef.current);
            else playerRef.current.loadVideoById(pendingYtIdRef.current);
            pendingYtIdRef.current = null;
          }
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) { startTracking(); setYtPlaying(true); }
          else { stopTracking(); setYtPlaying(false); }
        }
      }
    });
  }

  function startTracking() {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(d => { const nd = playerRef.current.getDuration() || 0; return nd !== d ? nd : d; });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopTracking() { cancelAnimationFrame(rafRef.current); }

  // ── Loop effect ──────────────────────────────────────────────────────────────
  // When several columns have an active loop (compare mode), their selected
  // sections join ONE shared cycle: at the end of this column's last selected
  // section, hand off to the next loop-enabled column instead of restarting.
  useEffect(() => {
    if (duration === 0) return;
    const handoff = () => { pauseMedia(); onLoopHandoff?.(loopChainNext); };
    if (subLoop) {
      const ivs = getSubIntervals(subLoop);
      if (ivs.length === 0) { setSubLoop(null); return; }
      const cur = ivs.find(iv => currentTime >= iv.start && currentTime < iv.end);
      if (cur) {
        if (currentTime >= cur.end - 0.12) {
          const idx = ivs.indexOf(cur);
          if (idx === ivs.length - 1 && loopChainNext != null) { handoff(); return; }
          const next = ivs[(idx + 1) % ivs.length];
          seekTo(next.start);
        }
      } else {
        seekTo(ivs[0].start);
      }
      return;
    }
    if (!loopSectionId) return;
    if (multiSelectedIds.length > 1) {
      const loopSections = [...sections]
        .filter(s => multiSelectedIds.includes(s.id))
        .sort((a, b) => a.time - b.time);
      if (loopSections.length === 0) return;
      const currentSec = loopSections.find(s => currentTime >= s.time && currentTime < s.endTime);
      if (currentSec) {
        if (currentTime >= currentSec.endTime - 0.12) {
          const idx = loopSections.indexOf(currentSec);
          if (idx === loopSections.length - 1 && loopChainNext != null) { handoff(); return; }
          const next = loopSections[(idx + 1) % loopSections.length];
          seekTo(next.time);
        }
      } else {
        seekTo(loopSections[0].time);
      }
      return;
    }
    const loopSec = sections.find(s => s.id === loopSectionId);
    if (!loopSec) { setLoopSectionId(null); return; }
    if (currentTime >= loopSec.endTime - 0.15) {
      if (loopChainNext != null) { handoff(); return; }
      seekTo(loopSec.time);
    }
  }, [currentTime, loopSectionId, subLoop, loopChainNext]);

  // An active subsection loop follows the current subsection selection (same
  // rule as the section loop, which tracks the selected section).
  useEffect(() => {
    if (!subLoop || !subSelection || !subFocus) return;
    if (subFocus.sectionId !== subSelection.sectionId || subFocus.rowId !== subSelection.rowId) return;
    if (subSelection.sectionId !== subLoop.sectionId || subSelection.rowId !== subLoop.rowId) return;
    const same = subLoop.ids.length === subSelection.ids.length && subLoop.ids.every(id => subSelection.ids.includes(id));
    if (!same) setSubLoop({ ...subLoop, ids: [...subSelection.ids] });
  }, [subSelection, subFocus]);

  // Constrain playback to the trimmed range [mediaStart, mediaEnd]
  useEffect(() => {
    if (!videoLoaded || !mediaEnd) return;
    if (currentTime >= mediaEnd - 0.05) pauseMedia();
    else if (currentTime < mediaStart) seekTo(mediaStart);
  }, [currentTime, mediaStart, mediaEnd, videoLoaded]);

  // ── SoundCloud ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType !== "soundcloud" || !activeUrl) return;
    function bindWidget() {
      const iframe = document.getElementById(scIframeId);
      if (!iframe || !window.SC?.Widget) return;
      const widget = window.SC.Widget(iframe);
      scWidgetRef.current = widget;
      widget.bind(window.SC.Widget.Events.READY, () => {
        widget.getDuration(ms => {
          if (ms && ms > 0) { const d = ms / 1000; setDuration(d); setVideoLoaded(true); if (sectionsRef.current.length === 0) initSections(d); }
        });
        widget.getCurrentSound(sound => { if (sound && sound.title) setMapName(sound.title); });
      });
      widget.bind(window.SC.Widget.Events.PLAY, () => setScPlaying(true));
      widget.bind(window.SC.Widget.Events.PAUSE, () => setScPlaying(false));
      widget.bind(window.SC.Widget.Events.FINISH, () => setScPlaying(false));
      widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data) => { setCurrentTime(data.currentPosition / 1000); });
    }
    if (!window.SC) {
      if (!document.querySelector('script[src*="w.soundcloud.com/player/api"]')) {
        const s = document.createElement("script");
        s.src = "https://w.soundcloud.com/player/api.js";
        s.onload = bindWidget;
        document.head.appendChild(s);
      } else {
        const poll = setInterval(() => { if (window.SC) { clearInterval(poll); bindWidget(); } }, 200);
        return () => clearInterval(poll);
      }
    } else { bindWidget(); }
    return () => { scWidgetRef.current = null; };
  }, [mediaType, activeUrl]);

  // ── Init sections ─────────────────────────────────────────────────────────────
  function initSections(d) {
    const pc = randomPresetColour();
    const initialPalette = [{ hex: pc.hex, name: pc.name, base: pc.hex }];
    const initial = [{ id: Date.now(), time: 0, endTime: d, color: pc.hex, label: "Section 1", subsections: [] }];
    const emptyNotes = {};
    histRef.current = [{ sections: initial, palette: initialPalette, notes: emptyNotes }]; histIdxRef.current = 0;
    setSections(initial); setPalette(initialPalette);
    setNotes(emptyNotes); setSelectedId(null);
    setSelectedColor(pc.hex); setSelectedSource("preview");
    setMediaStart(0); setMediaEnd(d);
    shadeIterRef.current = 0;
    onHistoryReset?.(index);
  }

  // ── Load gate ─────────────────────────────────────────────────────────────────
  const hasActiveMap = videoLoaded && sections.length > 0;
  function requestLoad(type, payload) {
    if (hasActiveMap) setPendingLoad({ type, payload });
    else executeLoad(type, payload);
  }
  function executeLoad(type, payload) {
    setPendingLoad(null); stopTracking();
    setApPlaying(false); setIsPlaying(false); setScPlaying(false);
    setVideoLoaded(false); setDuration(0); setCurrentTime(0);
    setSections([]); setNotes({}); setSelectedId(null);
    setSubLoop(null); setSubSelection(null);
    setEmbedDurationInput(""); setLoopSectionId(null);
    setZoomLevel(1); setZoomOffset(0); scWidgetRef.current = null;
    setMultiSelectedIds([]); samplerRef.current = { active: false, endTime: 0 };
    setPalette([]);
    setSelectedSource("preview"); setShowWaveform(true);
    setWaveformPeaks(null);
    setMediaStart(0); setMediaEnd(0);
    shadeIterRef.current = 0;
    const loadId = ++waveformLoadIdRef.current;
    setDirty(false);

    if (type === "youtube") {
      const { id } = payload;
      setMediaType("youtube"); setLocalFileUrl(null); setActiveUrl(payload.url);
      pendingYtCueRef.current = false;
      if (ytReadyRef.current && playerRef.current?.loadVideoById) playerRef.current.loadVideoById(id);
      else pendingYtIdRef.current = id;
      let attempts = 0;
      const wait = setInterval(() => {
        attempts++;
        if (!playerRef.current?.getDuration) { if (attempts > 60) clearInterval(wait); return; }
        const d = playerRef.current.getDuration();
        if (d && d > 0) {
          setDuration(d); setVideoLoaded(true); initSections(d);
          const vd = playerRef.current.getVideoData?.();
          if (vd && vd.title) setMapName(vd.title);
          clearInterval(wait);
        }
        if (attempts > 60) clearInterval(wait);
      }, 500);
    } else if (type === "soundcloud") {
      setMediaType("soundcloud"); setLocalFileUrl(null); setActiveUrl(payload.url);
    } else if (type === "auralpapers") {
      setMediaType("auralpapers"); setLocalFileUrl(null); setActiveUrl(payload.url);
      const seg = decodeURIComponent((payload.url.split("/").pop() || "").split("?")[0]).replace(/\.[^.]+$/, "");
      if (seg) setMapName(seg);
      computePeaks(payload.url).then(p => { if (waveformLoadIdRef.current === loadId) setWaveformPeaks(p); });
    } else if (type === "local") {
      const { file } = payload;
      setLocalFileUrl(URL.createObjectURL(file)); setLocalFileName(file.name);
      setMediaType("local"); setActiveUrl("");
      setMapName(file.name.replace(/\.[^.]+$/, ""));
      computePeaks(file).then(p => { if (waveformLoadIdRef.current === loadId) setWaveformPeaks(p); });
    }
  }

  function startNewMap() {
    stopTracking();
    setApPlaying(false); setIsPlaying(false); setScPlaying(false);
    setMediaType(null); setActiveUrl(""); setLocalFileUrl(null); setLocalFileName("");
    setVideoLoaded(false); setDuration(0); setCurrentTime(0);
    setSections([]); setNotes({}); setSelectedId(null);
    setSubLoop(null); setSubSelection(null);
    setEmbedDurationInput(""); setLoopSectionId(null);
    setZoomLevel(1); setZoomOffset(0); scWidgetRef.current = null;
    setMultiSelectedIds([]); samplerRef.current = { active: false, endTime: 0 };
    setPalette([]);
    setSelectedSource("preview"); setShowWaveform(true);
    setWaveformPeaks(null); waveformLoadIdRef.current++;
    setMediaStart(0); setMediaEnd(0);
    shadeIterRef.current = 0;
    setMapName("Untitled Map");
    histRef.current = []; histIdxRef.current = -1;
    onHistoryReset?.(index);
    setDirty(false);
    setConfirmNewMap(false);
  }

  function loadFromUrl(url) {
    url = url.trim(); if (!url) return;
    if (isYouTubeUrl(url)) requestLoad("youtube", { id: getYouTubeId(url), url });
    else if (isSoundCloudUrl(url)) requestLoad("soundcloud", { url });
    else if (isAuralPapersUrl(url)) requestLoad("auralpapers", { url });
    else alert("Please enter a valid YouTube, SoundCloud, or AuralPapers URL.");
  }

  function handleAudioMetadata(elRef) {
    const el = elRef.current; if (!el) return;
    const d = el.duration;
    if (d && isFinite(d) && d > 0) { setDuration(d); setVideoLoaded(true); if (sectionsRef.current.length === 0) initSections(d); }
  }
  function handleAudioTimeUpdate(elRef) { if (elRef.current) setCurrentTime(elRef.current.currentTime); }

  function toggleLocalPlay() {
    const el = localPlayerRef.current; if (!el) return;
    setSubFocus(null);
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause(); setIsPlaying(false);
    }
  }
  function toggleApPlay() {
    const el = apPlayerRef.current; if (!el) return;
    setSubFocus(null);
    if (el.paused) {
      el.play().then(() => setApPlaying(true)).catch(() => {
        alert("Cannot play this audio directly — the server does not allow cross-origin playback.\n\nTip: Download the file and load it via 'Drop file or click to browse'.");
        setApPlaying(false);
      });
    } else {
      el.pause(); setApPlaying(false);
    }
  }
  function toggleScPlay() {
    if (!scWidgetRef.current) return;
    setSubFocus(null);
    if (scPlaying) scWidgetRef.current.pause(); else scWidgetRef.current.play();
  }
  function handleVolumeChange(v) {
    setSubFocus(null);
    setVolume(v);
    if (localPlayerRef.current) localPlayerRef.current.volume = v;
    if (apPlayerRef.current) apPlayerRef.current.volume = v;
  }
  function toggleYTPlayPause() {
    if (!playerRef.current) return;
    setSubFocus(null);
    const state = playerRef.current.getPlayerState();
    if (state === window.YT?.PlayerState?.PLAYING) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }

  function togglePlayPause() {
    if (mediaType === "youtube") toggleYTPlayPause();
    else if (mediaType === "local") toggleLocalPlay();
    else if (mediaType === "auralpapers") toggleApPlay();
    else if (mediaType === "soundcloud") toggleScPlay();
  }

  function handleEmbedDurationSet() {
    const raw = embedDurationInput.trim();
    const parts = raw.split(":").map(Number);
    let secs = 0;
    if (parts.length === 2) secs = parts[0] * 60 + parts[1];
    else if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else secs = parseFloat(raw);
    if (secs > 0) { setDuration(secs); setVideoLoaded(true); initSections(secs); }
  }

  // Re-attach a local media file to a map loaded from saved JSON (keeps sections intact).
  function reattachLocalFile(file) {
    if (/\.json$/i.test(file.name)) return;
    setLocalFileUrl(URL.createObjectURL(file));
    setLocalFileName(file.name);
    const loadId = ++waveformLoadIdRef.current;
    computePeaks(file).then(p => { if (waveformLoadIdRef.current === loadId) setWaveformPeaks(p); });
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (/\.json$/i.test(file.name)) loadMapFile(file);
      else requestLoad("local", { file });
    } else { const url = e.dataTransfer.getData("text/plain"); if (url) { setUrlInput(url); loadFromUrl(url); } }
  }

  // ── Section actions ───────────────────────────────────────────────────────────
  // Enter while a subsection strip has focus: add a division at the playhead
  // on that row's strip instead of creating a new section.
  function addSubsectionAtPlayhead() {
    const f = subFocus;
    if (!f) return false;
    const sec = sections.find(s => s.id === f.sectionId);
    if (!sec) return false;
    const raw = notes[f.sectionId];
    const rows = Array.isArray(raw) ? raw : null;
    const row = rows ? rows.find(r => r.id === f.rowId) : null;
    // Rows not yet materialized in notes (the empty placeholder row, or a
    // legacy plain-string note) still render a strip — they are valid targets.
    const placeholderId = typeof raw === "string" ? f.sectionId : `empty-${f.sectionId}`;
    if (!row && !(!rows && f.rowId === placeholderId)) return false;
    const t = currentTime;
    if (t <= sec.time + 0.05 || t >= sec.endTime - 0.05) return true;
    if (row && (row.subsections || []).some(x => Math.abs(x.time - t) < 0.05)) return true;
    const newSub = { id: `sub-${Date.now()}`, time: t, label: null };
    const newNotes = { ...notes };
    newNotes[f.sectionId] = rows
      ? rows.map(r => r.id === f.rowId
        ? { ...r, subsections: [...(r.subsections || []), newSub].sort((a, b) => a.time - b.time) }
        : r)
      : [{ id: f.rowId, text: typeof raw === "string" ? raw : "", height: 36, dynamic: "", startLabel: null, subsections: [newSub] }];
    pushNotesHistory(newNotes);
    return true;
  }

  function addSection() {
    if (!videoLoaded || duration === 0) return;
    let t = currentTime;
    if (mediaType === "youtube" && playerRef.current?.getCurrentTime) t = playerRef.current.getCurrentTime();
    else if (mediaType === "local" && localPlayerRef.current) t = localPlayerRef.current.currentTime;
    else if (mediaType === "auralpapers" && apPlayerRef.current) t = apPlayerRef.current.currentTime;
    else if (mediaType === "soundcloud") t = currentTime;
    const sorted = [...sections].sort((a, b) => a.time - b.time);
    const idx = sorted.findIndex(s => t > s.time && t < s.endTime);
    if (idx === -1) return;
    const containing = sorted[idx];
    const oldEnd = containing.endTime;
    const newId = Date.now();
    let newColor = selectedColor;
    let newPalette = palette;
    if (selectedSource === "preview") {
      const pc = pickContrasting(containing.color);
      newColor = pc.hex;
      if (!palette.some(p => p.hex.toLowerCase() === pc.hex.toLowerCase()) && palette.length < 16) {
        newPalette = [...palette, { hex: pc.hex, name: pc.name }];
      }
    } else if (typeof selectedSource === "number" && palette[selectedSource]) {
      const entry = palette[selectedSource];
      const main = entry.base || entry.hex;
      const shades = [main, ...SHADE_STEPS.map(s => lighten(main, s))];
      newColor = shades[shadeIterRef.current % shades.length];
      shadeIterRef.current += 1;
    }
    const updated = sorted.map((s, i) => i === idx ? { ...s, endTime: t } : s);
    updated.push({ id: newId, time: t, endTime: oldEnd, color: newColor, label: "New Section", subsections: [] });
    updated.sort((a, b) => a.time - b.time);
    // Carry the containing section's row subsections (and their notes) that
    // fall inside the new section's space over to it, so splitting a section
    // doesn't silently delete subsection notes.
    let splitNotes = notes;
    const oldRows = Array.isArray(notes[containing.id]) ? notes[containing.id] : null;
    if (oldRows) {
      splitNotes = { ...notes };
      const rowsA = [];
      let rowsB = null;
      oldRows.forEach((r, ri) => {
        const subsA = (r.subsections || []).filter(x => x.time < t);
        const subsB = (r.subsections || []).filter(x => x.time >= t);
        if (subsB.length > 0) {
          const rowBId = `row-${newId}-${ri}`;
          if (!rowsB) rowsB = [];
          // Nudge divisions sitting exactly on the split point just inside the
          // new section so they (and their notes) survive the prune.
          const subsBMoved = subsB.map(x => x.time < t + 0.02 ? { ...x, time: t + 0.02 } : x);
          rowsB.push({ ...r, id: rowBId, text: "", startLabel: null, subsections: subsBMoved });
          subsB.forEach(x => {
            const fromKey = `${containing.id}#${r.id}#${x.id}`;
            const toKey = `${newId}#${rowBId}#${x.id}`;
            if (splitNotes[fromKey] !== undefined) { splitNotes[toKey] = splitNotes[fromKey]; delete splitNotes[fromKey]; }
          });
        }
        rowsA.push({ ...r, subsections: subsA });
      });
      splitNotes[containing.id] = rowsA;
      if (rowsB) splitNotes[newId] = rowsB;
    }
    pushHistory(updated, newPalette, pruneSubNotes(updated, splitNotes));
    // Auto-select the new section so its notes tab is the active one.
    setSubFocus(null);
    setSelectedId(newId);
    setMultiSelectedIds([newId]);
  }

  // Subsections live per note row (inside notes[<sectionId>] rows). When a
  // section's bounds change, prune any row subsections that fall outside —
  // and drop their sub-note entries — so strips stay in sync.
  function pruneSubNotes(newSections, baseNotes) {
    const n = { ...baseNotes };
    newSections.forEach(sec => {
      if (!Array.isArray(n[sec.id])) return;
      let removed = false;
      const rows = n[sec.id].map(r => {
        const subs = (r.subsections || []).filter(x => {
          const keep = x.time > sec.time + 0.01 && x.time < sec.endTime - 0.01;
          if (!keep) { delete n[`${sec.id}#${r.id}#${x.id}`]; removed = true; }
          return keep;
        });
        return { ...r, subsections: subs };
      });
      if (removed) n[sec.id] = rows;
    });
    return n;
  }

  function deselect() {
    setSubFocus(null);
    setSelectedId(null);
    setMultiSelectedIds([]);
  }
  function deleteSelected() {
    if (!hasSelection) return;
    setConfirmSectionDelete(true);
  }
  function doDeleteSelected() {
    setConfirmSectionDelete(false);
    if (multiSelectedIds.length > 1) { deleteMultiSections(); return; }
    deleteSection();
  }

  // Delete several sections at once — each merges into its neighbour (same rule as
  // single delete) so the timeline stays gapless; their notes are removed too.
  function deleteMultiSections() {
    const sorted = [...sections].sort((a, b) => a.time - b.time);
    const ids = new Set(multiSelectedIds);
    if (ids.size === 0 || ids.size >= sorted.length) return;
    const newNotes = { ...notes };
    let updated = [...sorted];
    sorted.filter(s => ids.has(s.id)).forEach(sec => {
      const i = updated.findIndex(s => s.id === sec.id);
      if (i === -1) return;
      if (i > 0) updated[i - 1] = { ...updated[i - 1], endTime: updated[i].endTime };
      else if (updated.length > 1) updated[1] = { ...updated[1], time: updated[0].time };
      else return;
      updated.splice(i, 1);
      delete newNotes[sec.id];
      Object.keys(newNotes).forEach(k => { if (k.startsWith(`${sec.id}#`)) delete newNotes[k]; });
    });
    setSelectedId(null);
    setMultiSelectedIds([]);
    pushHistory(updated, palette, newNotes);
  }
  const hasSelection = selectedId !== null || multiSelectedIds.length > 0;
  const binTooltip = "Delete section";

  // ── Subsection loop / slice / sampler helpers ────────────────────────────────
  // Intervals of the selected subsections (their division up to the next cut),
  // computed live from the notes so dragging a division moves loop/sampler
  // bounds in real time. "start" = the leftmost part before the first division.
  function getSubIntervals(sel) {
    const sec = sections.find(s => s.id === sel.sectionId);
    const rows = Array.isArray(notes[sel.sectionId]) ? notes[sel.sectionId] : [];
    const row = rows.find(r => r.id === sel.rowId);
    if (!sec || !row) return [];
    const subs = [...(row.subsections || [])].sort((a, b) => a.time - b.time);
    const ivs = [];
    sel.ids.forEach(k => {
      if (k === "start") {
        if (subs.length === 0) return;
        ivs.push({ start: sec.time, end: subs[0].time });
      } else {
        const i = subs.findIndex(s => s.id === k);
        if (i === -1) return;
        ivs.push({ start: subs[i].time, end: i < subs.length - 1 ? subs[i + 1].time : sec.endTime });
      }
    });
    return ivs.sort((a, b) => a.start - b.start);
  }

  // Loop toggle: whichever of section(s) / subsection(s) holds selection focus
  // wins; enabling one clears the other.
  function toggleLoop() {
    if (subLoop) { setSubLoop(null); return; }
    if (loopSectionId !== null && loopSectionId === selectedId) { setLoopSectionId(null); return; }
    const sel = activeSubSel;
    if (sel) { setSubLoop({ sectionId: sel.sectionId, rowId: sel.rowId, ids: [...sel.ids] }); return; }
    if (selectedId != null) { setSubLoop(null); setLoopSectionId(selectedId); }
  }

  // Slice each selected subsection part into N equal divisions.
  function handleSlice(count) {
    if (activeSubSel) { sliceSelectedSubs(count, activeSubSel); return; }
    sliceSection(count);
  }
  function sliceSelectedSubs(count, sel) {
    const sec = sections.find(s => s.id === sel.sectionId);
    const rows = Array.isArray(notes[sel.sectionId]) ? notes[sel.sectionId] : [];
    const row = rows.find(r => r.id === sel.rowId);
    if (!sec || !row) return;
    const subs = [...(row.subsections || [])].sort((a, b) => a.time - b.time);
    const newSubs = [...subs];
    sel.ids.forEach(k => {
      let start, end;
      if (k === "start") {
        if (subs.length === 0) return;
        start = sec.time; end = subs[0].time;
      } else {
        const i = subs.findIndex(s => s.id === k);
        if (i === -1) return;
        start = subs[i].time;
        end = i < subs.length - 1 ? subs[i + 1].time : sec.endTime;
      }
      const step = (end - start) / count;
      for (let j = 1; j < count; j++) {
        newSubs.push({ id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: start + j * step, label: null });
      }
    });
    newSubs.sort((a, b) => a.time - b.time);
    pushNotesHistory({ ...notes, [sel.sectionId]: rows.map(r => r.id === sel.rowId ? { ...r, subsections: newSubs } : r) });
  }

  function deleteSection() {
    if (selectedId === null) return;
    const sorted = [...sections].sort((a, b) => a.time - b.time);
    const idx = sorted.findIndex(s => s.id === selectedId);
    if (idx === -1 || sorted.length === 1) return;
    let updated;
    if (idx > 0) updated = sorted.map((s, i) => i === idx - 1 ? { ...s, endTime: sorted[idx].endTime } : s).filter((_, i) => i !== idx);
    else updated = sorted.map((s, i) => i === 1 ? { ...s, time: sorted[0].time } : s).filter((_, i) => i !== 0);
    const newNotes = { ...notes }; delete newNotes[selectedId];
    Object.keys(newNotes).forEach(k => { if (k.startsWith(`${selectedId}#`)) delete newNotes[k]; });
    setSelectedId(null);
    pushHistory(updated, palette, newNotes);
  }

  function sliceSection(count) {
    if (!selectedId) return;
    setSubFocus(null);
    const sec = sections.find(s => s.id === selectedId);
    if (!sec) return;
    const dur = sec.endTime - sec.time;
    const sliceDur = dur / count;
    const newSections = sections.filter(s => s.id !== selectedId);
    for (let i = 0; i < count; i++) {
      newSections.push({
        id: Date.now() + i,
        time: sec.time + i * sliceDur,
        endTime: sec.time + (i + 1) * sliceDur,
        color: sec.color,
        label: `${sec.label} ${i + 1}`,
        subsections: [],
      });
    }
    newSections.sort((a, b) => a.time - b.time);
    pushHistory(newSections);
    setSelectedId(null);
  }

  function changeSelectedColor(color) {
    setSelectedColor(color);
    if (selectedId !== null) pushHistory(sections.map(s => s.id === selectedId ? { ...s, color } : s));
  }
  function handleSelectSource(source) {
    setSelectedSource(source);
    setColourMultiSelect([]);
    if (typeof source === "number") shadeIterRef.current = 0;
  }
  function toggleColourSelect(idx) {
    setColourMultiSelect(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }
  function deselectColours() {
    setColourMultiSelect([]);
    setSelectedSource("preview");
  }
  function handleAddColour() {
    if (palette.length >= 16) return;
    const avail = PRESET_COLOURS.filter(c => !palette.some(p => p.hex.toLowerCase() === c.hex.toLowerCase()));
    const pick = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : randomPresetColour();
    pushHistory(sections, [...palette, { hex: pick.hex, name: pick.name, base: pick.hex }]);
  }
  function handleRemoveColour() {
    if (colourMultiSelect.length > 0) {
      if (palette.length - colourMultiSelect.length < 1) { setColourMultiSelect([]); return; }
      const toRemove = new Set(colourMultiSelect);
      const newPalette = palette.filter((_, j) => !toRemove.has(j));
      setColourMultiSelect([]);
      setSelectedSource("preview");
      pushHistory(sections, newPalette);
      return;
    }
    if (palette.length <= 1) return;
    let idx = typeof selectedSource === "number" ? selectedSource : palette.findIndex(p => p.hex.toLowerCase() === selectedColor.toLowerCase());
    if (idx === -1 || idx >= palette.length) idx = palette.length - 1;
    const newPalette = palette.filter((_, j) => j !== idx);
    if (typeof selectedSource === "number") {
      if (selectedSource === idx) setSelectedSource(Math.max(0, idx - 1));
      else if (selectedSource > idx) setSelectedSource(selectedSource - 1);
    }
    pushHistory(sections, newPalette);
  }
  function handleReorderPalette(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= palette.length || toIdx >= palette.length) return;
    const next = [...palette];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    if (typeof selectedSource === "number") {
      let ns = selectedSource;
      if (ns === fromIdx) ns = toIdx;
      else { if (fromIdx < ns) ns--; if (toIdx <= ns) ns++; }
      setSelectedSource(ns);
    }
    pushHistory(sections, next);
  }
  function handleRecolourSquare(idx, hex) {
    const newPalette = palette.map((s, j) => j === idx ? { hex, name: hexToName(hex), base: hex } : s);
    setSelectedColor(hex);
    const newSections = selectedId !== null ? sections.map(s => s.id === selectedId ? { ...s, color: hex } : s) : sections;
    pushHistory(newSections, newPalette);
  }
  // Pick a lighter shade of a square's MAIN colour: the square displays the shade
  // but remembers which main colour its shade popout derives from.
  function handleSelectShade(idx, shadeHex) {
    const entry = palette[idx];
    if (!entry) return;
    const main = entry.base || entry.hex;
    const newPalette = palette.map((s, j) => j === idx ? { ...s, hex: shadeHex, base: main } : s);
    setSelectedColor(shadeHex);
    const newSections = selectedId !== null ? sections.map(s => s.id === selectedId ? { ...s, color: shadeHex } : s) : sections;
    pushHistory(newSections, newPalette);
  }
  function handleDuplicateColour(idx) {
    if (palette.length >= 16 || idx < 0 || idx >= palette.length) return;
    const orig = palette[idx];
    const newPalette = [...palette];
    newPalette.splice(idx + 1, 0, { hex: orig.hex, name: orig.name, base: orig.base || orig.hex });
    pushHistory(sections, newPalette);
  }

  function selectSectionTab(sec, ctrlKey = false) {
    setSubFocus(null);
    setSelectedId(sec.id);
    if (ctrlKey) {
      seekTo(sec.time);
      playMedia();
    }
    setMultiSelectedIds([sec.id]);
    if (loopSectionId !== null && loopSectionId !== sec.id) setLoopSectionId(sec.id);
  }

  function selectSection(sec, shiftKey = false, ctrlKey = false) {
    setSelectedId(sec.id);
    setSubFocus(null);
    seekTo(sec.time);
    if (shiftKey) {
      const sortedAll = [...sections].sort((a, b) => a.time - b.time);
      const anchorId = multiSelectedIds.length > 0 ? multiSelectedIds[0] : sec.id;
      const anchorIdx = sortedAll.findIndex(s => s.id === anchorId);
      const targetIdx = sortedAll.findIndex(s => s.id === sec.id);
      const lo = Math.min(anchorIdx, targetIdx);
      const hi = Math.max(anchorIdx, targetIdx);
      const rangeIds = sortedAll.slice(lo, hi + 1).map(s => s.id);
      setMultiSelectedIds(rangeIds);
    } else if (ctrlKey) {
      setMultiSelectedIds(prev =>
        prev.includes(sec.id) ? prev.filter(id => id !== sec.id) : [...prev, sec.id]
      );
    } else {
      setMultiSelectedIds([sec.id]);
    }
    if (loopSectionId !== null && loopSectionId !== sec.id) setLoopSectionId(sec.id);
  }

  // ── Wheel listener on timeline ────────────────────────────────────────────────
  useEffect(() => {
    const el = timelineScrollRef.current; if (!el) return;
    function handleWheel(e) {
      if (!videoLoaded) return;
      e.preventDefault(); e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const anchorPct = (e.clientX - rect.left) / rect.width / zoomLevel + zoomOffset;
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        applyZoom(zoomLevel * (1 + delta), anchorPct);
      } else {
        const panAmount = e.deltaX / rect.width / zoomLevel;
        setZoomOffset(o => Math.max(0, Math.min(1 - 1 / zoomLevel, o + panAmount)));
      }
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [videoLoaded, zoomLevel, zoomOffset]);

  // ── Timeline helpers ──────────────────────────────────────────────────────────
  const visibleStart = zoomOffset * duration;
  const visibleEnd = visibleStart + duration / zoomLevel;

  function timeToTimelinePct(t) {
    if (duration === 0) return 0;
    return ((t - visibleStart) / (visibleEnd - visibleStart)) * 100;
  }
  function timelineClientToTime(clientX) {
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return visibleStart + pct * (visibleEnd - visibleStart);
  }

  // Left-drag on the section strip pans when zoomed (suppresses the click,
  // same behaviour as the subsection strip).
  function handleTimelinePanDown(e) {
    if (e.button !== 0) return;
    setSubFocus(null);
    const startX = e.clientX;
    const startOffset = zoomOffset;
    const rectW = timelineRef.current?.getBoundingClientRect().width || 1;
    const move = (ev) => {
      if (zoomLevel <= 1) return;
      const dx = ev.clientX - startX;
      if (Math.abs(dx) <= 3) return;
      timelineDragRef.current = true;
      const delta = (-dx / rectW) / zoomLevel;
      setZoomOffset(Math.max(0, Math.min(1 - 1 / zoomLevel, startOffset + delta)));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setTimeout(() => { timelineDragRef.current = false; }, 50);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  function handleTimelineClick(e) {
    if (isDraggingRef.current || timelineDragRef.current) return;
    setSelectedId(null);
    setMultiSelectedIds([]);
    setSubFocus(null);
    if (!videoLoaded || duration === 0) return;
    seekTo(timelineClientToTime(e.clientX));
  }

  function seekTo(t) {
    const lo = mediaStart || 0;
    const hi = (mediaEnd && mediaEnd > 0) ? mediaEnd : duration;
    t = Math.max(lo, Math.min(hi, t));
    if (mediaType === "youtube" && playerRef.current) playerRef.current.seekTo(t, true);
    else if (mediaType === "local" && localPlayerRef.current) localPlayerRef.current.currentTime = t;
    else if (mediaType === "auralpapers" && apPlayerRef.current) apPlayerRef.current.currentTime = t;
    else if (mediaType === "soundcloud" && scWidgetRef.current) scWidgetRef.current.seekTo(t * 1000);
    setCurrentTime(t);
  }

  function handlePlayheadMouseDown(e) {
    e.stopPropagation();
    isDraggingRef.current = true;
    setSubFocus(null);
    if (isPlaying || apPlaying || scPlaying || ytPlaying) pauseMedia();
    const onMove = (ev) => { seekTo(timelineClientToTime(ev.clientX)); };
    const onUp = () => {
      setTimeout(() => { isDraggingRef.current = false; }, 50);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // Drag the far-left / far-right ends of the section strip to trim the song.
  // The outermost section is cropped to the handle so its timecode reflects the trim.
  function handleTrimDrag(which, e) {
    e.stopPropagation();
    setSubFocus(null);
    isDraggingRef.current = true;
    const sortedSections = [...sections].sort((a, b) => a.time - b.time);
    const first = sortedSections[0];
    const last = sortedSections[sortedSections.length - 1];
    let latestSections = sections;
    let moved = false;
    const onMove = (ev) => {
      const t = timelineClientToTime(ev.clientX);
      moved = true;
      if (which === "left") {
        const ns = Math.max(0, Math.min((first ? first.endTime - 0.1 : mediaEnd - 0.5), t));
        setMediaStart(ns);
        if (first) {
          latestSections = sections.map(s => s.id === first.id ? { ...s, time: ns } : s);
          setSections(latestSections);
        }
        seekTo(ns);
      } else {
        const ns = Math.min(duration, Math.max((last ? last.time + 0.1 : mediaStart + 0.5), t));
        setMediaEnd(ns);
        if (last) {
          latestSections = sections.map(s => s.id === last.id ? { ...s, endTime: ns } : s);
          setSections(latestSections);
        }
        seekTo(ns);
      }
    };
    const onUp = () => {
      setTimeout(() => { isDraggingRef.current = false; }, 50);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (moved) pushHistory(latestSections, palette, pruneSubNotes(latestSections, notes));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleBoundaryDrag(e, idx) {
    e.stopPropagation();
    setSubFocus(null);
    const sorted = [...sections].sort((a, b) => a.time - b.time);
    const left = sorted[idx], right = sorted[idx + 1];
    if (!left || !right) return;
    let latestSections = sections;
    const onMove = (ev) => {
      let t = timelineClientToTime(ev.clientX);
      // Snap to the playhead when dragged onto it.
      if (Math.abs(t - currentTime) < 0.3) t = currentTime;
      const nb = Math.max(left.time + 0.1, Math.min(right.endTime - 0.1, t));
      latestSections = sorted.map(s => {
        if (s.id === left.id) return { ...s, endTime: nb };
        if (s.id === right.id) return { ...s, time: nb };
        return s;
      });
      setSections(latestSections);
      seekTo(nb); // scrub the audio to the boundary position
    };
    const onUp = () => {
      pushHistory(latestSections);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function commitLabel() {
    if (editingLabelId === null) return;
    pushHistory(sections.map(s => s.id === editingLabelId ? { ...s, label: labelValue } : s));
    setEditingLabelId(null);
  }
  function commitTabLabel() {
    if (editingTabId === null) return;
    const trimmed = tabLabelValue.trim();
    if (trimmed) {
      pushHistory(sections.map(s => s.id === editingTabId ? { ...s, label: trimmed } : s));
    }
    setEditingTabId(null);
  }

  function commitBoundaryEdit(newTime, newEndTime) {
    if (!editingBoundarySection) return;
    const sorted = [...sections].sort((a, b) => a.time - b.time);
    const idx = sorted.findIndex(s => s.id === editingBoundarySection.id);
    if (idx === -1) { setEditingBoundarySection(null); return; }
    let updated = [...sorted];
    const prevEnd = idx > 0 ? sorted[idx - 1].time : 0;
    const nextStart = idx < sorted.length - 1 ? sorted[idx + 1].endTime : duration;
    const safeStart = Math.max(prevEnd, Math.min(newTime, newEndTime - 0.1));
    const safeEnd = Math.min(nextStart, Math.max(newEndTime, newTime + 0.1));
    updated[idx] = { ...updated[idx], time: safeStart, endTime: safeEnd, subsections: (updated[idx].subsections || []).filter(x => x.time > safeStart + 0.01 && x.time < safeEnd - 0.01) };
    if (idx > 0) updated[idx - 1] = { ...updated[idx - 1], endTime: safeStart, subsections: (updated[idx - 1].subsections || []).filter(x => x.time > updated[idx - 1].time + 0.01 && x.time < safeStart - 0.01) };
    if (idx < updated.length - 1) updated[idx + 1] = { ...updated[idx + 1], time: safeEnd, subsections: (updated[idx + 1].subsections || []).filter(x => x.time > safeEnd + 0.01 && x.time < updated[idx + 1].endTime - 0.01) };
    pushHistory(updated, palette, pruneSubNotes(updated, notes));
    setEditingBoundarySection(null);
  }

  function recolorSelected(hex) {
    const ids = multiSelectedIds.length > 0 ? [...multiSelectedIds] : (selectedId !== null ? [selectedId] : []);
    setSelectedColor(hex);
    if (ids.length > 0) pushHistory(sections.map(s => ids.includes(s.id) ? { ...s, color: hex } : s));
  }

  // Colour multi-select is invalidated whenever the palette changes (add/remove/reorder/recolour)
  useEffect(() => { setColourMultiSelect([]); }, [palette]);

  // Measure the section-tabs row height so compare-mode columns can align their notes panels.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => setTabHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [videoLoaded, sections.length]);

  // Report colour + selection state up to the container (shared strip / cross-column recolour)
  useEffect(() => {
    const loopSections = sections
      .filter(s => multiSelectedIds.includes(s.id))
      .sort((a, b) => a.time - b.time)
      .map(({ id, time, endTime }) => ({ id, time, endTime }));
    onState?.(index, { palette, selectedColor, selectedSource, colourMultiSelect, canUndo, canRedo, hasSelection, dirty, videoLoaded, mapName, tabHeight, loopSectionId, multiSelectedIds, loopSections });
  }, [palette, selectedColor, selectedSource, colourMultiSelect, selectedId, multiSelectedIds, dirty, videoLoaded, mapName, canUndo, canRedo, hasSelection, tabHeight, loopSectionId, sections]);

  useImperativeHandle(ref, () => ({
    changeSelectedColor, handleSelectSource, handleAddColour, handleRemoveColour,
    handleReorderPalette, handleRecolourSquare, handleSelectShade, handleDuplicateColour, undo, redo, recolorSelected,
    toggleColourSelect, deselectColours, triggerSamplerKey, pause: pauseMedia,
    setLoop: (id) => setLoopSectionId(id), clearLoop: () => setLoopSectionId(null),
    continueLoopChain: () => {
      const sorted = [...sections].filter(s => multiSelectedIds.includes(s.id)).sort((a, b) => a.time - b.time);
      if (sorted.length === 0) return;
      seekTo(sorted[0].time);
      playMedia();
    },
    getMapData: () => ({ version: 2, mapName, mediaType, activeUrl, localFileName, duration, mediaStart, mediaEnd, sections, notes, palette, selectedColor, selectedSource }),
    loadMapFile, loadMediaFile: (file) => requestLoad("local", { file }), loadMapData: applyMapData, startNewMap,
    deselectAll: deselect,
  }));

  // ── Save / Load map ───────────────────────────────────────────────────────────
  function saveMap() {
    const data = { version: 2, mapName, mediaType, activeUrl, localFileName, duration, sections, notes, palette, selectedColor, selectedSource };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${mapName.replace(/[^a-z0-9\-_ ]/gi, "_")}.json`; a.click();
    URL.revokeObjectURL(a.href);
    setDirty(false);
  }

  function normSubs(subs) {
    return (subs || []).map(x => {
      const t = typeof x === "number" ? x : x.time;
      const label = typeof x === "number" ? null : (x.label ?? null);
      const id = (typeof x === "object" && x.id) || `sub-${Math.round(t * 1000)}`;
      return { time: t, label, id };
    }).filter(x => typeof x.time === "number");
  }
  function normalizePalette(p) {
    return (p && p.length ? p : PRESET_COLOURS.map(c => ({ ...c, base: c.hex }))).map(x => ({ ...x, base: x.base || x.hex }));
  }
  function applyMapData(data) {
    if (!data || !data.sections || !data.duration) return false;
    stopTracking();
    setApPlaying(false); setIsPlaying(false); setScPlaying(false);
    setVideoLoaded(true); setDuration(data.duration); setCurrentTime(0);
    // Subsection strips are per note row: migrate legacy section-level
    // divisions into every existing row of that section (same sub ids keep
    // saved sub-notes valid); sections keep an empty legacy list.
    const migratedSections = data.sections.map(s => ({ ...s, subsections: normSubs(s.subsections) }));
    const migratedNotes = { ...(data.notes || {}) };
    migratedSections.forEach(sec => {
      const baseSubs = sec.subsections || [];
      const raw = migratedNotes[sec.id];
      if (Array.isArray(raw)) {
        migratedNotes[sec.id] = raw.map(r => ({
          ...r,
          startLabel: r.startLabel ?? sec.startLabel ?? null,
          subsections: r.subsections ? normSubs(r.subsections) : baseSubs.map(x => ({ ...x })),
        }));
      } else if (baseSubs.length > 0 || sec.startLabel != null) {
        migratedNotes[sec.id] = [{ id: `row-${sec.id}`, text: typeof raw === "string" ? raw : "", height: 36, dynamic: "", startLabel: sec.startLabel ?? null, subsections: baseSubs.map(x => ({ ...x })) }];
      }
      sec.subsections = [];
    });
    setSections(migratedSections); setNotes(migratedNotes);
    setSelectedId(null); setLoopSectionId(null); setSubLoop(null); setSubSelection(null);
    setMediaType(data.mediaType || null); setActiveUrl(data.activeUrl || "");
    setLocalFileName(data.localFileName || "");
    setMapName(data.mapName || "Untitled Map");
    setMediaStart(data.mediaStart ?? 0);
    setMediaEnd(data.mediaEnd ?? data.duration);
    // Colour squares mirror the section strip (left-to-right, deduped) rather
    // than the palette the map was saved with.
    const stripPalette = [];
    const seenHex = new Set();
    migratedSections.forEach(sec => {
      const hex = (sec.color || "").toLowerCase();
      if (hex && !seenHex.has(hex) && stripPalette.length < 16) {
        seenHex.add(hex);
        stripPalette.push({ hex: sec.color, name: hexToName(sec.color), base: sec.color });
      }
    });
    const newPalette = stripPalette.length > 0 ? stripPalette : normalizePalette(data.palette);
    setPalette(newPalette);
    setSelectedColor(data.selectedColor || (newPalette[0] ? newPalette[0].hex : PRESET_COLOURS[0].hex));
    const savedSource = typeof data.selectedSource !== "undefined" ? data.selectedSource : "preview";
    setSelectedSource(typeof savedSource === "number" && savedSource >= newPalette.length ? "preview" : savedSource);
    setWaveformPeaks(null);
    shadeIterRef.current = 0;
    setDirty(false);
    // Re-load the media so a saved YouTube map actually plays again
    if ((data.mediaType || null) === "youtube" && data.activeUrl) {
      const ytId = getYouTubeId(data.activeUrl);
      if (ytId) {
        pendingYtCueRef.current = true;
        if (ytReadyRef.current && playerRef.current?.cueVideoById) playerRef.current.cueVideoById(ytId);
        else pendingYtIdRef.current = ytId;
      }
    }
    if ((data.mediaType || null) === "auralpapers" && data.activeUrl) {
      const apLoadId = ++waveformLoadIdRef.current;
      computePeaks(data.activeUrl).then(p => { if (waveformLoadIdRef.current === apLoadId) setWaveformPeaks(p); });
    }
    histRef.current = [{ sections: migratedSections, palette: newPalette, notes: migratedNotes }]; histIdxRef.current = 0;
    onHistoryReset?.(index);
    return true;
  }
  function loadMapFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data && data.type === "compare" && Array.isArray(data.maps)) {
          if (compareMode) {
            alert("Can't load a compare map into a single column of an existing comparison.");
            return;
          }
          onLoadCompareMap?.(data);
          return;
        }
        if (!data.mapName) data.mapName = file.name.replace(/\.json$/i, "");
        if (!applyMapData(data)) alert("Invalid map file.");
      } catch { alert("Could not parse map file."); }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    if (editingMapName && mapNameInputRef.current) { mapNameInputRef.current.focus(); mapNameInputRef.current.select(); }
  }, [editingMapName]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const playheadPct = (visibleEnd > visibleStart && currentTime >= visibleStart && currentTime <= visibleEnd)
    ? ((currentTime - visibleStart) / (visibleEnd - visibleStart)) * 100
    : currentTime < visibleStart ? -2 : 102;
  const sorted = [...sections].sort((a, b) => a.time - b.time);
  const selectedSection = selectedId != null ? sections.find(s => s.id === selectedId) : null;
  // The subsection selection holds focus only while its strip is focused.
  const activeSubSel = (subSelection && subFocus && subFocus.sectionId === subSelection.sectionId
    && subFocus.rowId === subSelection.rowId && subSelection.sectionId === selectedId) ? subSelection : null;

  // Shared props for the section-edit toolbar (used by every media type).
  const barProps = {
    selectedSection,
    loopActive: !!subLoop || (loopSectionId !== null && loopSectionId === selectedId),
    loopCount: subLoop ? subLoop.ids.length : multiSelectedIds.length,
    canLoop: !!subLoop || !!selectedSection,
    onToggleLoop: toggleLoop,
    loopUnit: subLoop ? "subsection" : "section",
    loopSingleLabel: selectedSection?.label,
    sliceTarget: activeSubSel ? `Slice selected subsection${activeSubSel.ids.length > 1 ? "s" : ""}` : null,
    onSlice: handleSlice, videoLoaded, onAddSection: addSection, onDelete: deleteSelected,
    currentTime, showWaveform,
    onToggleWaveform: () => { setSubFocus(null); setShowWaveform(v => !v); }, binTooltip, canDelete: hasSelection,
    mediaType, onDownload: () => { setSubFocus(null); setShowDownloader(true); }, showWaveformToggle: mediaType === "local",
    zoomLevel, applyZoom, duration, playbackRate, setPlaybackRate, speedActive, setSpeedActive,
    hasSelection, onDeselect: deselect, showDeselect: mediaType !== "local",
    volume, onVolumeChange: handleVolumeChange,
    focusMode, onToggleFocus,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {pendingLoad && (
        <ConfirmModal
          message="You have an active map. Start fresh for the new track, or keep your current sections?"
          onConfirm={() => executeLoad(pendingLoad.type, pendingLoad.payload)}
          onCancel={() => setPendingLoad(null)}
          confirmLabel="Start New Map"
          cancelLabel="Keep Current Map"
        />
      )}

      {confirmSectionDelete && (
        <ConfirmModal
          message={multiSelectedIds.length > 1 ? `Delete these ${multiSelectedIds.length} sections? Their notes will be lost.` : "Delete this section? Its notes will be lost."}
          onConfirm={doDeleteSelected}
          onCancel={() => setConfirmSectionDelete(false)}
          confirmLabel="Delete"
          confirmColor="#e74c3c"
          cancelLabel="Cancel"
        />
      )}

      {confirmNewMap && (
        <ConfirmModal
          message="Start a new map? This clears the current media and all sections."
          onConfirm={startNewMap}
          onCancel={() => setConfirmNewMap(false)}
          confirmLabel="Start New Map"
          confirmColor="#735bc1"
          cancelLabel="Cancel"
        />
      )}

      {pendingUnsaved && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#ffffff", border: `1px solid ${TH.sidebarBorder}`, borderRadius: 8, padding: "28px 32px", maxWidth: 380, textAlign: "center", color: TH.fg, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
            <p style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>You have unsaved changes. Save before continuing?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { saveMap(); const a = pendingUnsaved; setPendingUnsaved(null); if (a === "new") setConfirmNewMap(true); else jsonInputRef.current.click(); }} style={{ padding: "8px 20px", background: "#735bc1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Save &amp; Continue</button>
              <button onClick={() => { const a = pendingUnsaved; setPendingUnsaved(null); if (a === "new") setConfirmNewMap(true); else jsonInputRef.current.click(); }} style={{ padding: "8px 20px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>Discard</button>
              <button onClick={() => setPendingUnsaved(null)} style={{ padding: "8px 20px", background: TH.btnBg, color: TH.btnFg, border: `1px solid ${TH.btnBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDownloader && (
        <SectionDownloader
          selectedSection={selectedSection}
          multiSelectedIds={multiSelectedIds.length > 0 ? multiSelectedIds : (selectedSection ? [selectedSection.id] : [])}
          sections={sections}
          duration={duration}
          mediaType={mediaType}
          activeUrl={activeUrl}
          audioElRef={mediaType === "local" ? localPlayerRef : apPlayerRef}
          onClose={() => setShowDownloader(false)}
        />
      )}

      {editingBoundarySection && (
        <SectionBoundaryEditor
          section={editingBoundarySection}
          duration={duration}
          onCommit={commitBoundaryEdit}
          onCancel={() => setEditingBoundarySection(null)}
        />
      )}

      {collapsed && (
        <CollapsedColumnStrip index={index} order={order} selected={selected} preview={preview} grab={grab} mapName={mapName} onSelect={onSelect} onHover={onHover} onToggleCollapse={onToggleCollapse} />
      )}
      <div
        onPointerDown={(e) => { if (e.target.closest('button,input,select')) return; wasSelectedRef.current = selected; onSelect?.(index, e); }}
        onPointerMove={(e) => onHover?.(index, e)}
        onDragOver={(e) => { if (grab) { e.preventDefault(); grab.onGrabOver(index, e); } }}
        onDrop={(e) => { if (grab) { e.preventDefault(); grab.onGrabDrop(index, e); } }}
        className="sm-col"
        style={{ display: (collapsed || hidden) ? "none" : "flex", flex: 1, minWidth: focusMode ? undefined : 0, order, color: TH.fg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", border: selected ? "2px solid #735bc1" : preview ? "2px dashed #735bc1" : "2px solid transparent", boxSizing: "border-box", position: "relative" }}>

        {grab && grab.dropTargetId === index && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: grab.dropSide === "left" ? 0 : undefined, right: grab.dropSide === "right" ? 0 : undefined, width: 3, background: "#735bc1", zIndex: 700 }} />
        )}

        {/* ── CENTRE (player + timeline + notes) ───────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column", padding: "16px 12px 16px 12px" }}>

          {/* Map name row + grab handle + save/load buttons aligned right */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 8 }}>
            {compareMode && grab && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <button
                  onPointerDown={(e) => { wasSelectedRef.current = selected; onSelect?.(index, e); }}
                  onClick={() => onToggleCollapse?.(index)}
                  title="Collapse column"
                  style={{ cursor: "pointer", background: "transparent", border: "none", color: "#777", fontSize: 11, lineHeight: 1, padding: "2px 3px" }}
                >▶</button>
                <button
                  draggable
                  onPointerDown={(e) => { wasSelectedRef.current = selected; onSelect?.(index, e); }}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; grab.onGrabStart(index); }}
                  onDragEnd={() => grab.onGrabEnd()}
                  title="Drag to reorder column"
                  style={{ cursor: "grab", background: "transparent", border: "none", color: "#999", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                >⋮⋮</button>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, visibility: videoLoaded ? "visible" : "hidden" }}>
              {editingMapName ? (
                <input ref={mapNameInputRef} value={mapName}
                  onChange={e => setMapName(e.target.value)}
                  onBlur={() => setEditingMapName(false)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingMapName(false); }}
                  style={{ fontSize: 16, fontWeight: "bold", color: "#735bc1", background: "transparent", border: "none", borderBottom: `2px solid #735bc1`, outline: "none", width: "100%", fontFamily: "inherit" }}
                />
              ) : (
                <h2 onClick={() => { if (wasSelectedRef.current && selected) setEditingMapName(true); }} title={selected ? "Click to rename" : "Click to select this column"} className={selected ? "sm-label" : undefined}
                  style={{ margin: 0, fontSize: 18, fontWeight: "bold", color: "#735bc1", cursor: "pointer", userSelect: "none", borderBottom: "2px solid transparent", padding: "1px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mapName}
                </h2>
              )}
            </div>
            <div style={{ display: "flex", gap: 5, flexShrink: 0, visibility: videoLoaded ? "visible" : "hidden" }}>
              {buttonMode === "single" && (
                <>
                  <button onClick={() => onNew?.(index)}
                    style={{ padding: "5px 10px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                    ✚ New
                  </button>
                  <button onClick={() => onSave?.(index)} disabled={saveDisabled}
                    style={{ padding: "5px 10px", background: saveDisabled ? TH.btnDisabled : "#e0e0e0", color: saveDisabled ? TH.btnDisabledFg : "#333", border: "none", borderRadius: 4, cursor: saveDisabled ? "not-allowed" : "pointer", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                    💾 Save
                  </button>
                </>
              )}
              {buttonMode === "compareSave" && (
                <button onClick={() => onSaveCompare?.(index)} disabled={saveDisabled}
                  style={{ padding: "5px 10px", background: saveDisabled ? TH.btnDisabled : "#e0e0e0", color: saveDisabled ? TH.btnDisabledFg : "#333", border: "none", borderRadius: 4, cursor: saveDisabled ? "not-allowed" : "pointer", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                  💾 Save
                </button>
              )}
              <input ref={jsonInputRef} type="file" accept=".json,.wav,.mp3,.flv,.mp4" style={{ display: "none" }}
                onChange={e => { const f = e.target.files[0]; if (f) { if (/\.json$/i.test(f.name)) loadMapFile(f); else requestLoad("local", { file: f }); } e.target.value = ""; }} />
              <input ref={reattachInputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files[0]; if (f) reattachLocalFile(f); e.target.value = ""; }} />
            </div>
          </div>

          {/* Player — height is user-resizable via the drag handle below */}
          <div className="sm-media-wrap" style={{ width: "100%", background: "#000", borderRadius: 4, overflow: "hidden", marginBottom: 0, flex: focusMode ? 1 : undefined, minHeight: focusMode ? 0 : undefined, display: focusMode ? "flex" : undefined, flexDirection: focusMode ? "column" : undefined }}>

            {/* YouTube */}
            <div style={{ display: mediaType === "youtube" ? "flex" : "none", width: "100%", flex: focusMode ? 1 : undefined, minHeight: focusMode ? 0 : undefined, flexDirection: "column" }}>
              <div id={ytPlayerId} style={{ width: "100%", height: focusMode ? "100%" : mediaHeight, overflow: "hidden", flex: focusMode ? 1 : undefined }} />
              {videoLoaded && (
                <SectionEditBar {...barProps} isPlaying={ytPlaying} onToggle={toggleYTPlayPause} showVolume={false} />
              )}
            </div>

            {/* Local file */}
            {mediaType === "local" && (() => {
              const isVideo = /\.(mp4|webm|ogv|mov|mkv)$/i.test(localFileName);
              return (
                <div style={{ background: "#000" }}>
                  {localFileUrl ? (
                    isVideo ? (
                      <div style={{ position: "relative", background: "#000" }}>
                        <video ref={localPlayerRef} src={localFileUrl}
                          onLoadedMetadata={() => handleAudioMetadata(localPlayerRef)}
                          onTimeUpdate={() => handleAudioTimeUpdate(localPlayerRef)}
                          onEnded={() => setIsPlaying(false)}
                          style={{ width: "100%", height: focusMode ? "100%" : mediaHeight, objectFit: "contain", display: "block", flex: focusMode ? 1 : undefined }} />
                        <div style={{ position: "absolute", top: 4, left: 6, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 5px", borderRadius: 3, maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none", WebkitUserSelect: "none" }}>{localFileName}</div>
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: focusMode ? "100%" : mediaHeight, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f5f5", flex: focusMode ? 1 : undefined }}>
                        <audio ref={localPlayerRef} src={localFileUrl}
                          onLoadedMetadata={() => handleAudioMetadata(localPlayerRef)}
                          onTimeUpdate={() => handleAudioTimeUpdate(localPlayerRef)}
                          onEnded={() => setIsPlaying(false)} />
                        <div style={{ fontSize: 28, marginBottom: 2 }}>🎵</div>
                        <div style={{ fontSize: 12, color: TH.controlBarText, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none", WebkitUserSelect: "none" }}>{localFileName}</div>
                      </div>
                    )
                  ) : (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) reattachLocalFile(f); }}
                      onClick={() => reattachInputRef.current?.click()}
                      title="Drop the audio file here or click to browse to re-attach it"
                      style={{ width: "100%", height: mediaHeight, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dragOver ? "#ece6f7" : "#f5f5f5", border: `2px dashed ${dragOver ? "#735bc1" : "#b0b0b0"}`, cursor: "pointer" }}>
                      <div style={{ fontSize: 28, marginBottom: 2 }}>🎵</div>
                      <div style={{ fontSize: 12, color: TH.controlBarText, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{localFileName}</div>
                      <div style={{ fontSize: 11, color: "#f39c12", marginTop: 4 }}>Drop the audio file here or click to browse</div>
                    </div>
                  )}
                  <SectionEditBar {...barProps} isPlaying={isPlaying} onToggle={toggleLocalPlay} showVolume />
                </div>
              );
            })()}

            {/* AuralPapers */}
            {mediaType === "auralpapers" && activeUrl && (
              <div style={{ background: "#f5f5f5" }}>
                <div style={{ width: "100%", height: Math.min(mediaHeight, 80), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <audio ref={apPlayerRef} src={activeUrl} crossOrigin="anonymous"
                    onLoadedMetadata={() => handleAudioMetadata(apPlayerRef)}
                    onTimeUpdate={() => handleAudioTimeUpdate(apPlayerRef)}
                    onEnded={() => setApPlaying(false)} />
                  <div style={{ fontSize: 28, marginBottom: 2 }}>🎧</div>
                  <div style={{ fontSize: 12, color: TH.controlBarText, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                    {activeUrl.split("/").pop() || "AuralPapers Audio"}
                  </div>
                </div>
                {videoLoaded
                  ? <SectionEditBar {...barProps} isPlaying={apPlaying} onToggle={toggleApPlay} showVolume />
                  : (
                    <div style={{ padding: "8px 10px", background: TH.controlBar, borderTop: `1px solid ${TH.controlBarBorder}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "#f39c12" }}>⚠ Enter duration manually:</span>
                      <input value={embedDurationInput} onChange={e => setEmbedDurationInput(e.target.value)}
                        placeholder="m:ss or seconds"
                        onKeyDown={e => e.key === "Enter" && handleEmbedDurationSet()}
                        style={{ width: 90, padding: "2px 5px", background: TH.inputBg, color: TH.inputFg, border: `1px solid ${TH.inputBorder}`, borderRadius: 4, fontSize: 10 }} />
                      <button onClick={handleEmbedDurationSet}
                        style={{ padding: "2px 8px", background: TH.accent, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}>Set</button>
                    </div>
                  )
                }
              </div>
            )}

            {/* SoundCloud */}
            {mediaType === "soundcloud" && (
              <div>
                <iframe id={scIframeId} width="100%" height={focusMode ? "100%" : mediaHeight} scrolling="no" frameBorder="no" allow="autoplay"
                  src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(activeUrl)}&color=%230a5cd6&auto_play=false&show_artwork=true`}
                  style={{ display: "block", flex: focusMode ? 1 : undefined }} />
                {videoLoaded
                  ? <SectionEditBar {...barProps} isPlaying={scPlaying} onToggle={toggleScPlay} showVolume={false} />
                  : (
                    <div style={{ padding: "5px 10px", background: TH.controlBar, borderTop: `1px solid ${TH.controlBarBorder}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                      <span style={{ fontSize: 10, color: "#f39c12" }}>⚠ Enter track duration:</span>
                      <input value={embedDurationInput} onChange={e => setEmbedDurationInput(e.target.value)}
                        placeholder="m:ss"
                        onKeyDown={e => e.key === "Enter" && handleEmbedDurationSet()}
                        style={{ width: 80, padding: "2px 5px", background: TH.inputBg, color: TH.inputFg, border: `1px solid ${TH.inputBorder}`, borderRadius: 4, fontSize: 10 }} />
                      <button onClick={handleEmbedDurationSet}
                        style={{ padding: "2px 8px", background: TH.accent, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}>Set</button>
                    </div>
                  )}
              </div>
            )}

            {/* Empty state — load media directly in the player window */}
            {!mediaType && (
              <LoadMediaPanel
                th={TH}
                dragOver={dragOver}
                setDragOver={setDragOver}
                onDrop={handleDrop}
                onFile={(file) => { if (/\.json$/i.test(file.name)) loadMapFile(file); else requestLoad("local", { file }); }}
                urlInput={urlInput}
                setUrlInput={setUrlInput}
                onLoadUrl={loadFromUrl}
              />
            )}
          </div>

          {/* Section strip + scroll */}
          <div
            ref={timelineScrollRef}
            className="sm-timeline"
            style={{ width: "100%", position: "relative", marginTop: 0 }}
            onClick={e => {
              if (!videoLoaded || duration === 0) return;
              if (isDraggingRef.current) return;
              if (timelineRef.current && timelineRef.current.contains(e.target)) return;
              if (!timelineRef.current) return;
              const rect = timelineRef.current.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const t = visibleStart + pct * (visibleEnd - visibleStart);
              seekTo(Math.max(0, Math.min(duration, t)));
            }}
          >
            {/* Playhead triangle at TOP of strip */}
            {duration > 0 && playheadPct >= 0 && playheadPct <= 100 && (
              <div
                onMouseDown={handlePlayheadMouseDown}
                style={{
                  position: "absolute", top: -10, left: `${playheadPct}%`,
                  transform: "translateX(-50%)",
                  width: 0, height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "12px solid #0f0f0f",
                  cursor: "grab", zIndex: 200,
                }}
              />
            )}
            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              onMouseDown={handleTimelinePanDown}
              onDoubleClick={() => { if (!timelineDragRef.current) { setZoomLevel(1); setZoomOffset(0); } }}
              style={{
                position: "relative", width: "100%", height: 52,
                cursor: videoLoaded ? "crosshair" : "default",
                backgroundColor: TH.timelineBg, borderRadius: 3, overflow: "visible",
                marginTop: 10,
              }}
            >
              <WaveformOverlay peaks={waveformPeaks} duration={duration} visibleStart={visibleStart} visibleEnd={visibleEnd} show={showWaveform} containerRef={timelineRef} />
              {duration > 0 && sorted.map((sec, i) => {
                if (sec.endTime < visibleStart || sec.time > visibleEnd) return null;
                const leftPct = Math.max(0, timeToTimelinePct(sec.time));
                const rightPct = Math.min(100, timeToTimelinePct(sec.endTime));
                const widthPct = rightPct - leftPct;
                if (widthPct <= 0) return null;
                const isSelected = sec.id === selectedId;
                const multiIdx = [...sections]
                  .filter(s => multiSelectedIds.includes(s.id))
                  .sort((a, b) => a.time - b.time)
                  .findIndex(s => s.id === sec.id);
                const isMulti = multiSelectedIds.includes(sec.id);
                const samplerKey = isMulti && multiIdx >= 0 ? SAMPLER_KEYS[samplerOffset + multiIdx] : null;
                return (
                  <div key={sec.id}>
                    <div
                      onClick={e => { e.stopPropagation(); if (timelineDragRef.current) return; selectSection(sec, e.shiftKey, e.ctrlKey || e.metaKey); }}
                      title={`${sec.label}${samplerKey ? ` [${samplerKey}]` : ""}`}
                      style={{
                        position: "absolute", top: 0, height: "100%",
                        left: `${leftPct}%`, width: `${widthPct}%`,
                        backgroundColor: sec.color, cursor: "pointer",
                        boxSizing: "border-box",
                        outline: isSelected ? "2px solid #0f0f0f" : isMulti ? "2px solid #f39c12" : "none",
                        borderRadius: 2, overflow: "hidden",
                        userSelect: "none", WebkitUserSelect: "none"
                      }}
                    >
                      {editingLabelId === sec.id ? (
                        <input autoFocus value={labelValue}
                          onChange={e => setLabelValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") setEditingLabelId(null); }}
                          onBlur={commitLabel}
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={e => e.stopPropagation()}
                          style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)", width: "90%", fontSize: 11, background: "rgba(255,255,255,0.85)", color: "#000", border: "1px solid #333", borderRadius: 2, padding: "1px 3px", zIndex: 65 }}
                        />
                      ) : (
                        <>
                          <span
                            onClick={e => { e.stopPropagation(); if (timelineDragRef.current) return; selectSectionTab(sec, e.ctrlKey || e.metaKey); setLabelValue(sec.label); setEditingLabelId(sec.id); }}
                            onDoubleClick={e => e.stopPropagation()}
                            className="sm-label"
                            style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#fff", fontWeight: "bold", textShadow: "0 0 4px #000", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "80%", padding: "1px 4px", pointerEvents: "all", zIndex: 65 }}
                          >{sec.label}</span>
                          {samplerKey && (
                            <span style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#000", background: "rgba(243,156,18,0.85)", borderRadius: 2, padding: "0 3px", fontWeight: "bold", pointerEvents: "none", zIndex: 65 }}>{samplerKey}</span>
                          )}
                        </>
                      )}
                    </div>
                    {i < sorted.length - 1 && sec.endTime >= visibleStart && sec.endTime <= visibleEnd && (
                      <div
                        onMouseDown={e => handleBoundaryDrag(e, i)}
                        style={{ position: "absolute", top: 0, left: `calc(${timeToTimelinePct(sec.endTime)}% - 4px)`, width: 8, height: "100%", cursor: "ew-resize", background: "transparent", zIndex: 50 }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Trimmed-region overlays + draggable end handles */}
              {videoLoaded && mediaEnd > 0 && (() => {
                const lp = Math.max(0, Math.min(100, timeToTimelinePct(mediaStart)));
                const rp = Math.max(0, Math.min(100, timeToTimelinePct(mediaEnd)));
                return (
                  <>
                    <div style={{ position: "absolute", top: 0, left: 0, width: `${lp}%`, height: "100%", background: TH.controlBar, zIndex: 70, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 0, left: `${rp}%`, right: 0, height: "100%", background: TH.controlBar, zIndex: 70, pointerEvents: "none" }} />
                    <TrimHandle leftPct={lp} onMouseDown={(e) => handleTrimDrag("left", e)} title="Drag to set song start" />
                    <TrimHandle leftPct={rp} onMouseDown={(e) => handleTrimDrag("right", e)} title="Drag to set song end" />
                  </>
                );
              })()}

              {/* Playhead line */}
              {duration > 0 && playheadPct >= 0 && playheadPct <= 100 && (
                <div style={{ position: "absolute", top: 0, left: `${playheadPct}%`, width: 2, height: "100%", background: "#0f0f0f", transform: "translateX(-1px)", zIndex: 100, pointerEvents: "none" }} />
              )}
            </div>

            {/* Pan via horizontal wheel/trackpad when zoomed — pinch to zoom back out (no slider) */}
          </div>

          {/* Section Notes Tabs — hidden in focus mode */}
          {videoLoaded && sorted.length > 0 && !focusMode && (
            <div className="sm-notes" style={{ width: "100%" }}>
              <div onClick={e => { if (e.target === e.currentTarget) onDeselectAll?.(); }} style={{ height: 10 + (compareMode ? Math.max(0, (alignTabHeight || 0) - tabHeight) : 0), cursor: "default" }} />
              <div ref={tabsRef} onClick={e => { if (e.target === e.currentTarget) onDeselectAll?.(); }} style={{ display: "flex", gap: 2, marginBottom: 0, flexWrap: "wrap" }}>
                {sorted.map(sec => {
                  const isActive = sec.id === selectedId;
                  const isEditingTab = editingTabId === sec.id;
                  return (
                    <div
                      key={sec.id}
                      onClick={e => {
                        if (isEditingTab) return;
                        selectSectionTab(sec, e.ctrlKey || e.metaKey);
                      }}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        setTabLabelValue(sec.label);
                        setEditingTabId(sec.id);
                        setSelectedId(sec.id);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 3,
                        padding: "4px 8px", fontSize: 11, fontWeight: "bold",
                        backgroundColor: isActive ? sec.color : "#e0e0e0",
                        color: isActive ? "#fff" : "#555",
                        borderRadius: "3px 3px 0 0", cursor: "pointer",
                        border: isActive ? `2px solid ${sec.color}` : "2px solid #d0d0d0",
                        borderBottom: "none", maxWidth: 120,
                        userSelect: "none", WebkitUserSelect: "none",
                      }}
                      title={`${sec.label} — click to select, dbl-click to rename, Ctrl+click to play`}
                    >
                      {!isEditingTab && (() => {
                        const isThisPlaying = isActive && (isPlaying || apPlaying || scPlaying || ytPlaying);
                        return (
                          <span
                            onPointerDown={e => e.preventDefault()}
                            onClick={e => {
                              e.stopPropagation();
                              setSubFocus(null);
                              setSelectedId(sec.id);
                              setMultiSelectedIds([sec.id]);
                              if (isThisPlaying) {
                                pauseMedia();
                              } else {
                                seekTo(sec.time);
                                playMedia();
                              }
                            }}
                            title={isThisPlaying ? `Pause` : `Play from start of "${sec.label}"`}
                            style={{ fontSize: 10, opacity: 0.8, flexShrink: 0, cursor: "pointer", lineHeight: 1 }}
                          >{isThisPlaying ? "⏸" : "▶"}</span>
                        );
                      })()}
                      {isEditingTab ? (
                        <input
                          autoFocus
                          value={tabLabelValue}
                          onChange={e => setTabLabelValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); commitTabLabel(); }
                            if (e.key === "Escape") setEditingTabId(null);
                            e.stopPropagation();
                          }}
                          onBlur={commitTabLabel}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: "rgba(255,255,255,0.8)", color: "#000",
                            border: "1px solid #333", borderRadius: 2,
                            fontSize: 11, padding: "0 3px", width: 90, outline: "none",
                            fontFamily: "inherit", fontWeight: "bold",
                          }}
                        />
                      ) : (
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>{sec.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <SectionNotesPanel
                stripFocus={subFocus}
                onSubSelectionChange={setSubSelection}
                samplerOffset={samplerOffset}
                onSubsectionFocus={(sectionId, rowId) => setSubFocus({ sectionId, rowId })}
                selectedSection={selectedSection}
                notes={notes}
                setNotes={pushNotesHistory}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onUpdateSection={(id, data) => pushHistory(sections.map(s => s.id === id ? { ...s, ...data } : s))}
                currentTime={currentTime}
                onSeek={seekTo}
                previewNotes={setNotes}
              />
            </div>
          )}
          <div onClick={e => { if (e.target === e.currentTarget) onDeselectAll?.(); }} style={{ flex: focusMode ? 0 : 1, minHeight: focusMode ? 0 : 16 }} />
        </div>
      </div>
    </>
  );
});
export default MapColumn;