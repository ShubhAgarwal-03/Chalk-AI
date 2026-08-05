import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useSession } from './ws/useSession.js';
import { drawingReducer, initDrawingState } from './canvas/drawingReducer.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import CanvasCard from './components/CanvasCard.jsx';
import CaptionDock from './components/CaptionDock.jsx';
import { Radio } from 'lucide-react';
import './styles/chalk.css';

const TOPIC = 'Pythagorean Theorem';
const LESSON_SUBTITLE = 'a² + b² = c²';

export default function App() {
  const [elements, dispatchDraw] = useReducer(drawingReducer, undefined, initDrawingState);
  const [transcript, setTranscript] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activePanel, setActivePanel] = useState('transcript');
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const onDraw = useCallback((call) => {
    dispatchDraw(call);
  }, []);

  const onTranscript = useCallback((who, text) => {
    setTranscript((t) => [...t.slice(-49), { who, text }]);
  }, []);

  const { status, errorMessage, start, stop } = useSession({ onDraw, onTranscript });

  const elapsed = useElapsedTimer(status === 'connected');
  const latestCaption = transcript[transcript.length - 1];

  const handleSelectPanel = (id) => {
    setActivePanel(id);
    if (id === 'transcript') setTranscriptOpen(true);
  };

  const handleClearCanvas = () => {
    dispatchDraw({ name: 'clear_canvas', args: {} });
  };

  return (
    <div className="chalk-app">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((v) => !v)}
        activePanel={activePanel}
        onSelectPanel={handleSelectPanel}
      />

      <main className="chalk-main">
        <TopBar
          topic={status === 'idle' || status === 'error' ? null : TOPIC}
          elapsed={elapsed}
          isTalking={status === 'connected'}
          onStopTalking={stop}
          onEndSession={stop}
        />

        <CanvasCard
          elements={elements}
          topic={TOPIC}
          lessonSubtitle={LESSON_SUBTITLE}
          status={status}
          errorMessage={errorMessage}
          onStart={start}
          onStop={stop}
          onClearCanvas={handleClearCanvas}
          transcript={transcript}
          transcriptOpen={transcriptOpen}
          onToggleTranscript={() => setTranscriptOpen((v) => !v)}
        />

        <div className="caption-dock">
          <CaptionDock status={status} latest={latestCaption} />
        </div>

        <footer className="chalk-footer">
          <span>© 2026 Chalk AI Learning Systems</span>
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#support">Support</a>
            <a href="#resources">Resources</a>
          </div>
          <span className="footer-status">
            <Radio size={12} />
            {status === 'connected' ? 'Live' : status === 'error' ? 'Connection issue' : 'System Ready'}
          </span>
        </footer>
      </main>
    </div>
  );
}

/** Counts up mm:ss while `running` is true, resets when it goes false. */
function useElapsedTimer(running) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}