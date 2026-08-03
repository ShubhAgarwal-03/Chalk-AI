import { useCallback, useReducer, useState } from 'react';
import { useSession } from './ws/useSession.js';
import Whiteboard from './canvas/whiteboard.jsx';
import { drawingReducer, initDrawingState } from './canvas/drawingReducer.js';

/**
 * Voice loop confirmed working — this now renders the real whiteboard
 * instead of the draw-call log panel. `elements` is owned by
 * drawingReducer.js and handed straight to Whiteboard.jsx to render;
 * app.jsx itself doesn't know anything about shapes/coordinates.
 */
export default function App() {
  const [elements, dispatchDraw] = useReducer(drawingReducer, undefined, initDrawingState);
  const [transcript, setTranscript] = useState([]);

  const onDraw = useCallback((call) => {
    dispatchDraw(call);
  }, []);

  const onTranscript = useCallback((who, text) => {
    setTranscript((t) => [...t.slice(-19), { who, text }]);
  }, []);

  const { status, errorMessage, start, stop } = useSession({ onDraw, onTranscript });

  const isActive = status === 'connecting' || status === 'connected';

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>CHALK</h1>
      <p style={styles.subtitle}>a voice AI tutor that draws</p>

      <button
        style={{ ...styles.button, background: isActive ? '#dc2626' : '#2563eb' }}
        onClick={isActive ? stop : start}
      >
        {isActive ? 'End Session' : 'Start Talking'}
      </button>

      <p style={styles.status}>Status: {status}</p>
      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

      <div style={styles.layout}>
        <Whiteboard elements={elements} />

        <div style={styles.transcriptPanel}>
          <h3>Transcript</h3>
          {transcript.map((t, i) => (
            <div key={i}>
              <strong>{t.who}:</strong> {t.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: 'sans-serif', maxWidth: 1100, margin: '40px auto', padding: '0 20px' },
  title: { fontSize: 32, marginBottom: 0 },
  subtitle: { color: '#666', marginTop: 4 },
  button: { padding: '12px 24px', fontSize: 16, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  status: { marginTop: 12, color: '#333' },
  error: { color: '#dc2626' },
  layout: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 24, alignItems: 'start' },
  transcriptPanel: { border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 300, maxHeight: 900, overflowY: 'auto' },
};