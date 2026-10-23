// Musical length decomposition: seconds → bars.beats.eighths.sixteenths,
// relative to a section's time signature and its Bars/Beats values.
// Compound metres count dotted beats the traditional way (a 6/8 bar is
// 2 beats of 3 eighths each).
export function musicalLengthParts(totalSeconds, { sectionDuration, bars, timeSigN = 4, timeSigD = 4, beatsOverride }) {
  const barsVal = parseInt(bars, 10);
  if (!barsVal || barsVal <= 0 || !(sectionDuration > 0) || !(totalSeconds > 0)) return null;
  const secPerBar = sectionDuration / barsVal;
  const compound = (timeSigD === 8 || timeSigD === 16) && timeSigN % 3 === 0 && timeSigN >= 6;
  const beatsPerBar = parseInt(beatsOverride, 10) || (compound ? timeSigN / 3 : timeSigN);
  if (!beatsPerBar || beatsPerBar <= 0) return null;
  const secPerBeat = secPerBar / beatsPerBar;
  const eighthDur = secPerBar * timeSigD / (8 * timeSigN);
  const sixteenthDur = eighthDur / 2;
  const eps = 1e-4;
  let rem = totalSeconds;
  const b = Math.floor(rem / secPerBar + eps); rem -= b * secPerBar;
  const bt = Math.floor(rem / secPerBeat + eps); rem -= bt * secPerBeat;
  const e = Math.floor(rem / eighthDur + eps); rem -= e * eighthDur;
  const s = Math.floor(rem / sixteenthDur + eps);
  return `${b}.${bt}.${e}.${s}`;
}