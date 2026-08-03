import { useCallback, useRef, useState } from 'react';
import { startAudioCapture } from '../audio/audioCapture.js';
import { createAudioPlayback } from '../audio/audioPlayback.js';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8080';

/**
 * Owns the whole "session" lifecycle: opens the WS to the relay, starts
 * continuous mic capture, plays back incoming AI audio, and surfaces draw
 * instructions + transcript to whatever component wants them (App.jsx
 * today; Whiteboard.jsx once the real canvas replaces the log panel).
 */
export function useSession({ onDraw, onTranscript } = {}) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error | ended
  const [errorMessage, setErrorMessage] = useState(null);

  const wsRef = useRef(null);
  const captureRef = useRef(null);
  const playbackRef = useRef(null);

  const start = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);

    try {
      const ws = new WebSocket(BACKEND_WS_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      const playback = createAudioPlayback();
      playbackRef.current = playback;

      ws.onopen = async () => {
        try {
          const capture = await startAudioCapture((chunk) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
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
          playback.enqueueChunk(event.data);
          return;
        }

        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'draw':
            onDraw?.(msg.call);
            break;
          case 'transcript':
            onTranscript?.(msg.who, msg.text);
            break;
          case 'interrupted':
            playback.clearQueue();
            break;
          case 'error':
            setErrorMessage(msg.message);
            setStatus('error');
            break;
          case 'session_closed':
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
    setStatus('ended');
  }, []);

  return { status, errorMessage, start, stop };
}