import { Radio } from 'lucide-react';

/** Backend sends who as 'student' | 'ai' (see wsRelay.js) — map to display labels. */
const SPEAKER_LABEL = { ai: 'Tutor', student: 'You' };

export default function CaptionDock({ status, latest }) {
  const isLive = status === 'connected';

  return (
    <div className={`caption-card${isLive ? ' is-bar' : ''}`}>
      <span className="caption-label">
        <Radio size={11} />
        Live Captions
      </span>
      {latest ? (
        <p className="caption-text">
          {isLive && <span className="caption-speaker">{SPEAKER_LABEL[latest.who] || latest.who}:</span>}
          &ldquo;{latest.text}&rdquo;
        </p>
      ) : (
        <p className="caption-text caption-empty">
          {isLive ? 'Listening…' : 'Captions will appear here once the session starts.'}
        </p>
      )}
    </div>
  );
}