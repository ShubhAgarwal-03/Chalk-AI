import { useCallback, useRef, useState } from 'react';
import { startAudioCapture } from '../audio/audioCapture.js';
import { createAudioPlayback } from '../audio/audioPlayback.js';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8080';

export function useSession({ onDraw, onTranscript } = {}) {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [muted, setMuted] = useState(false);

  const wsRef = useRef(null);
  const captureRef = useRef(null);
  const playbackRef = useRef(null);
  const acceptedGenerationRef = useRef(0);
  const mutedRef = useRef(false);
  // Timers for AI captions delayed to match audio playback (see the
  // 'transcript' case below) — tracked so a barge-in or session end can
  // cancel any not-yet-shown ones instead of letting them pop up late.
  const pendingCaptionTimeoutsRef = useRef([]);

  const clearPendingCaptions = () => {
    pendingCaptionTimeoutsRef.current.forEach(clearTimeout);
    pendingCaptionTimeoutsRef.current = [];
  };

  const start = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);
    acceptedGenerationRef.current = 0;
    mutedRef.current = false;
    setMuted(false);
    clearPendingCaptions();

    try {
      const ws = new WebSocket(BACKEND_WS_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      const playback = createAudioPlayback();
      playbackRef.current = playback;

      ws.onopen = async () => {
        try {
          const capture = await startAudioCapture((chunk) => {
            if (!mutedRef.current && ws.readyState === WebSocket.OPEN) ws.send(chunk);
          });
          captureRef.current = capture;
          setStatus('connected');
        } catch (err) {
          setErrorMessage(`Mic access failed: ${err.message}`);
          setStatus('error');
        }
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data);
          const frameGeneration = view.getUint32(0, true);
          if (frameGeneration < acceptedGenerationRef.current) {
            return;
          }
          playback.enqueueChunk(event.data.slice(4));
          return;
        }

        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'draw':
            onDraw?.(msg.call);
            break;
          case 'transcript':
            if (msg.who === 'ai') {
              // Delay the AI's caption by however far the audio queue is
              // currently running ahead of real-time, so the sentence
              // appears roughly when it's actually heard, not the instant
              // the WS message arrives (which can be well before the
              // matching audio is scheduled to play).
              const delayMs = playback.getPendingDelayMs();
              if (delayMs > 30) {
                const timeoutId = setTimeout(() => onTranscript?.(msg.who, msg.text), delayMs);
                pendingCaptionTimeoutsRef.current.push(timeoutId);
              } else {
                onTranscript?.(msg.who, msg.text);
              }
            } else {
              // Student's own words — show immediately, nothing to sync against.
              onTranscript?.(msg.who, msg.text);
            }
            break;
          case 'interrupted':
            acceptedGenerationRef.current = msg.generation;
            playback.clearQueue();
            clearPendingCaptions();
            break;
          case 'error':
            setErrorMessage(msg.message);
            setStatus('error');
            break;
          case 'session_closed':
            setErrorMessage((prev) => prev || `Session ended: ${msg.reason || 'no reason given'}`);
            setStatus('ended');
            break;
          default:
            break;
        }
      };

      ws.onerror = () => {
        setErrorMessage('WebSocket connection error — is the backend running?');
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus((s) => (s === 'error' ? s : 'ended'));
      };
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  }, [onDraw, onTranscript]);

  const stop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
    }
    wsRef.current?.close();
    captureRef.current?.stop();
    playbackRef.current?.close();
    clearPendingCaptions();
    setStatus('ended');
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  return { status, errorMessage, start, stop, muted, toggleMute };
}