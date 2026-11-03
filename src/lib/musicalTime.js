// Subsection length as bars.beats.sixteenths. Four sixteenths make a beat,
// and the beats in the bar (from the time signature and Beats setting) make a bar.
const SIXTEENTHS_PER_BEAT = 4;

export const LENGTH_FIELDS = ["bars", "beats", "sixteenths"];

export function lengthContext({ sectionDuration, bars, timeSigN = 4, timeSigD = 4, beatsOverride }) {
  const barsVal = parseInt(bars, 10);
  if (!barsVal || barsVal <= 0 || !(sectionDuration > 0)) return null;
  const compound = (timeSigD === 8 || timeSigD === 16) && timeSigN % 3 === 0 && timeSigN >= 6;
  const beatsPerBar = parseInt(beatsOverride, 10) || (compound ? timeSigN / 3 : timeSigN);
  if (!beatsPerBar || beatsPerBar <= 0) return null;
  return { beatsPerBar, sixteenthSec: sectionDuration / barsVal / beatsPerBar / SIXTEENTHS_PER_BEAT };
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
  return { bars, beats, sixteenths: rem };
}
