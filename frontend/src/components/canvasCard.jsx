import { useState } from 'react';
import Whiteboard from '../canvas/whiteboard.jsx';
import CanvasToolRail from './canvasToolRail.jsx';
import StatusPills from './statusPill.jsx';
import IdleOverlay from './idleOverlay.jsx';
import TranscriptDrawer from './transcriptDrawer.jsx';

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

  const isIdle = status === 'idle' || status === 'error' || status === 'ended'; // was: 'idle' || 'error'
  const isLive = status === 'connected' || status === 'connecting';
  const hasTranscript = transcript.length > 0;

  return (
    <section className="canvas-card">
      <div className="canvas-card-header">
        <div>
      {isLive && topic && (  
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

        {(isLive || hasTranscript) && (   // was: {isLive && (
          <TranscriptDrawer open={transcriptOpen} onToggle={onToggleTranscript} transcript={transcript} />
        )}
      </div>
    </section>
  );
}