// Compute mono peak waveform data from a local File/Blob or a fetchable URL.
// Returns a Float32Array of peak amplitudes (0..1), or null on failure.
export async function computePeaks(source, samples = 4000) {
  try {
    let arrayBuffer;
    if (source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
    } else {
      const res = await fetch(source);
      arrayBuffer = await res.arrayBuffer();
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    let audioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      ctx.close();
    }
    const chs = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    let mono;
    if (chs > 1) {
      mono = new Float32Array(len);
      for (let c = 0; c < chs; c++) {
        const cd = audioBuffer.getChannelData(c);
        for (let i = 0; i < len; i++) mono[i] += cd[i];
      }
      for (let i = 0; i < len; i++) mono[i] /= chs;
    } else {
      mono = audioBuffer.getChannelData(0);
    }
    const blockSize = Math.max(1, Math.floor(len / samples));
    const peaks = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(mono[start + j] || 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  } catch (e) {
    return null;
  }
}