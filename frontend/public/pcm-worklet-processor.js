/**
 * Runs on the audio rendering thread (not the main thread), so it can't
 * touch the DOM or import bundled modules — that's why this lives in
 * public/ and is loaded via audioWorklet.addModule('/pcm-worklet-processor.js')
 * as a plain script, not imported like the rest of the app.
 *
 * Job: take Float32 mic samples (already at 16kHz — see AudioCapture.js,
 * which creates the AudioContext with sampleRate:16000 so the browser
 * resamples for us) and convert them to 16-bit PCM, little-endian, then
 * hand each block to the main thread over the worklet's message port.
 */
class PCMWorkletProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono, Float32Array in range [-1, 1]
    const pcm16 = new Int16Array(channelData.length);

    for (let i = 0; i < channelData.length; i++) {
      const clamped = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Transfer the underlying buffer to avoid copying across the thread boundary.
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);

    return true; // keep processor alive
  }
}

registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);