// Subsection length as bars.beats.eighths.sixteenths. Units carry upward:
// 16 sixteenths make an eighth, 8 eighths make a beat, and the beats in the
// bar (from the time signature and Beats setting) make a bar.
const SIXTEENTHS_PER_EIGHTH = 16;
const SIXTEENTHS_PER_BEAT = 8 * SIXTEENTHS_PER_EIGHTH;

export const LENGTH_FIELDS = ["bars", "beats", "eighths", "sixteenths"];

export function lengthContext({ sectionDuration, bars, timeSigN = 4, timeSigD = 4, beatsOverride }) {
  const barsVal = parseInt(bars, 10);
  if (!barsVal || barsVal <= 0 || !(sectionDuration > 0)) return null;
  const compound = (timeSigD === 8 || timeSigD === 16) && timeSigN % 3 === 0 && timeSigN >= 6;
  const beatsPerBar = parseInt(beatsOverride, 10) || (compound ? timeSigN / 3 : timeSigN);
  if (!beatsPerBar || beatsPerBar <= 0) return null;
  return { beatsPerBar, sixteenthSec: sectionDuration / barsVal / beatsPerBar / SIXTEENTHS_PER_BEAT };
}

export function lengthUnitSize(field, beatsPerBar) {
  return {
    bars: beatsPerBar * SIXTEENTHS_PER_BEAT,
    beats: SIXTEENTHS_PER_BEAT,
    eighths: SIXTEENTHS_PER_EIGHTH,
    sixteenths: 1,
  }[field];
}

export function lengthParts(totalSeconds, opts) {
  const ctx = lengthContext(opts);
  if (!ctx || !(totalSeconds > 0)) return null;
  const units = Math.round(totalSeconds / ctx.sixteenthSec);
  const unitsPerBar = ctx.beatsPerBar * SIXTEENTHS_PER_BEAT;
  const bars = Math.floor(units / unitsPerBar);
  let rem = units - bars * unitsPerBar;
  const beats = Math.floor(rem / SIXTEENTHS_PER_BEAT);
  rem -= beats * SIXTEENTHS_PER_BEAT;
  const eighths = Math.floor(rem / SIXTEENTHS_PER_EIGHTH);
  return { bars, beats, eighths, sixteenths: rem - eighths * SIXTEENTHS_PER_EIGHTH };
}
