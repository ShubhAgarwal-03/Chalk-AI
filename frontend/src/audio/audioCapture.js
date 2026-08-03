/**
 * Continuous mic capture, per the project summary: this keeps streaming
 * audio to the backend THE ENTIRE SESSION, including while the AI is
 * speaking — that's what lets Gemini's native VAD detect barge-in. There's
 * no "mute while AI talks" logic anywhere, on purpose.
 */
export async function startAudioCapture(onChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Requesting sampleRate:16000 here means the browser resamples the mic's
  // native rate (usually 48kHz) down to 16kHz for us — matches what Gemini
  // Live expects (raw 16-bit PCM, 16kHz) without us hand-rolling a resampler.
  const audioContext = new AudioContext({ sampleRate: 16000 });

  await audioContext.audioWorklet.addModule('/pcm-worklet-processor.js');

  const source = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet-processor');

  workletNode.port.onmessage = (event) => {
    onChunk(event.data); // ArrayBuffer of 16-bit PCM
  };

  source.connect(workletNode);
  // Deliberately NOT connecting workletNode to audioContext.destination —
  // we don't want to hear our own mic echoed back.

  return {
    stop() {
      workletNode.port.onmessage = null;
      source.disconnect();
      workletNode.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close();
    },
  };
}