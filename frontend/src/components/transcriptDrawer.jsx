import { X, MessageSquare } from 'lucide-react';

const SPEAKER_LABEL = { ai: 'Tutor', student: 'You' };

export default function TranscriptDrawer({ open, onToggle, transcript }) {
  return (
    <>
      {!open && (
        <button type="button" className="transcript-tab" onClick={onToggle}>
          <MessageSquare size={12} />
          Transcript
        </button>
      )}

      <div className={`transcript-drawer${open ? ' is-open' : ''}`}>
        <div className="transcript-drawer-header">
          <span className="transcript-drawer-title">Transcript</span>
          <button type="button" className="transcript-close" onClick={onToggle} aria-label="Close transcript">
            <X size={16} />
          </button>
        </div>
        <div className="transcript-list">
          {transcript.length === 0 && <p className="transcript-empty">Nothing said yet.</p>}
          {transcript.map((t, i) => (
            <div key={i} className="transcript-row">
              <span className={`transcript-who${t.who === 'ai' ? ' is-tutor' : ''}`}>
                {SPEAKER_LABEL[t.who] || t.who}
              </span>
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}