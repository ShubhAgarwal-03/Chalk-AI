/**
 * Plays back the AI's speech chunks in order, gapless. Gemini Live sends
 * output audio at 24kHz (different from the 16kHz we send it) — this
 * context is intentionally separate from AudioCapture's 16kHz context.
 *
 * clearQueue() is what makes barge-in actually feel instant: when the
 * backend forwards an {type:'interrupted'} message (student spoke over the
 * AI), we stop every scheduled-but-not-yet-played chunk immediately rather
 * than letting stale speech keep playing.
 */
const PLAYBACK_SAMPLE_RATE = 24000;

export function createAudioPlayback() {
  const audioContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
  let nextStartTime = 0;
  let activeSources = [];

  function getPendingDelayMs() {
    return Math.max(0, (nextStartTime - audioContext.currentTime) * 1000);
  }

  function enqueueChunk(arrayBuffer) {
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x8000;
    }

    const audioBuffer = audioContext.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const now = audioContext.currentTime;
    const startAt = Math.max(now, nextStartTime);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;

    activeSources.push(source);
    source.onended = () => {
      activeSources = activeSources.filter((s) => s !== source);
    };
  }

  function clearQueue() {
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // already stopped/ended — fine to ignore
      }
    }
    activeSources = [];
    nextStartTime = audioContext.currentTime;
  }

  function close() {
    clearQueue();
    audioContext.close();
  }

  return { enqueueChunk, clearQueue, close, getPendingDelayMs };
}