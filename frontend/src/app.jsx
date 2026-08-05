import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useSession } from './ws/useSession.js';
import { drawingReducer, initDrawingState } from './canvas/drawingReducer.js';
import Sidebar from './components/sidebar.jsx';
import TopBar from './components/topBar.jsx';
import CanvasCard from './components/canvasCard.jsx';
import CaptionDock from './components/captionDoc.jsx';
import { Radio } from 'lucide-react';
import './styles/chalk.css';

export default function App() {
  const [elements, dispatchDraw] = useReducer(drawingReducer, undefined, initDrawingState);
  const [transcript, setTranscript] = useState([]);
  const [topic, setTopic] = useState(null); // set live by the model's set_topic tool call
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activePanel, setActivePanel] = useState('transcript');
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const onDraw = useCallback((call) => {
    // set_topic isn't a canvas element — it's a header label, so it's
    // intercepted here rather than going into drawingReducer (which would
    // just silently no-op on an unrecognized tool name).
    if (call.name === 'set_topic') {
      if (call.args?.topic) setTopic(call.args.topic);
      return;
    }
    dispatchDraw(call);
  }, []);

  const onTranscript = useCallback((who, text) => {
    setTranscript((t) => [...t.slice(-49), { who, text }]);
  }, []);

  const { status, errorMessage, start, stop, muted, toggleMute } = useSession({ onDraw, onTranscript });

  const elapsed = useElapsedTimer(status === 'connected');
  const latestCaption = transcript[transcript.length - 1];
  const isLive = status === 'connected' || status === 'connecting';

  const handleSelectPanel = (id) => {
    setActivePanel(id);
    if (id === 'transcript') setTranscriptOpen(true);
  };

  const handleClearCanvas = () => {
    dispatchDraw({ name: 'clear_canvas', args: {} });
  };

  const handleStart = () => {
    setTopic(null); // fresh session — wait for the model's first set_topic call
    start();
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
          topic={topic}
          elapsed={elapsed}
          live={isLive}
          muted={muted}
          onToggleMute={toggleMute}
          onEndSession={stop}
        />

        <CanvasCard
          elements={elements}
          topic={topic}
          lessonSubtitle={null}
          status={status}
          errorMessage={errorMessage}
          onStart={handleStart}
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