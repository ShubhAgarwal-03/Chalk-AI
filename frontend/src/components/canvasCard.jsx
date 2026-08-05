import { useState } from 'react';
import Whiteboard from '../canvas/whiteboard.jsx';
import CanvasToolRail from './CanvasToolRail.jsx';
import StatusPills from './StatusPills.jsx';
import IdleOverlay from './IdleOverlay.jsx';
import TranscriptDrawer from './TranscriptDrawer.jsx';

export default function CanvasCard({
  elements,
  topic,
  lessonSubtitle,
  status,
  errorMessage,
  onStart,
  onStop,
  onClearCanvas,
  transcript,
  transcriptOpen,
  onToggleTranscript,
}) {
  const [activeTool, setActiveTool] = useState('hand');
  const isIdle = status === 'idle' || status === 'error';
  const isLive = status === 'connected' || status === 'connecting';

  return (
    <section className="canvas-card">
      <div className="canvas-card-header">
        <div>
          {isLive && (
            <>
              <h2 className="canvas-heading">{topic}</h2>
              {lessonSubtitle && <p className="canvas-subheading">{lessonSubtitle}</p>}
            </>
          )}
        </div>
        <StatusPills status={status} />
      </div>

      <div className="whiteboard-wrap">
        <Whiteboard elements={elements} />

        {isIdle && (
          <IdleOverlay topic={topic} status={status} errorMessage={errorMessage} onStart={onStart} onStop={onStop} />
        )}

        <CanvasToolRail
          variant={isLive ? 'live' : 'idle'}
          orientation={isLive ? 'horizontal' : 'vertical'}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onClear={onClearCanvas}
        />

        {isLive && (
          <TranscriptDrawer open={transcriptOpen} onToggle={onToggleTranscript} transcript={transcript} />
        )}
      </div>
    </section>
  );
}