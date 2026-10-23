import { useEffect, useRef } from "react";

// Draws a mono peak waveform over the section strip.
// Peaks rise from the bottom (rest line at bottom), peaks only (no troughs).
// Semi-transparent dark fill reads as "slightly darker than the section colour".
export default function WaveformOverlay({ peaks, duration, visibleStart, visibleEnd, show, containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    if (!canvas || !container || !peaks || duration <= 0 || visibleEnd <= visibleStart) return;

    const draw = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const n = peaks.length;
      const visDur = visibleEnd - visibleStart;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x < w; x++) {
        const t = visibleStart + (x / w) * visDur;
        const idx = Math.min(n - 1, Math.max(0, Math.floor((t / duration) * n)));
        const peak = peaks[idx] || 0;
        ctx.lineTo(x, h - peak * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [peaks, duration, visibleStart, visibleEnd, show]);

  if (!show || !peaks) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 35 }}
    />
  );
}