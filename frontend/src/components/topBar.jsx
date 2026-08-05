import { Clock, PhoneOff, MicOff, User } from 'lucide-react';

/**
 * `isTalking` toggles the extra "Stop Talking" control (image 2 in the
 * brief) — that's the mic/voice-turn toggle, separate from "End Session"
 * which tears down the whole WS session regardless of talk state.
 */
export default function TopBar({ topic, elapsed, isTalking, onStopTalking, onEndSession }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-title-group">
          <span className="topbar-title">Chalk AI Tutor</span>
        </div>
        {topic && (
          <span className="topic-pill">
            <DotIcon /> Topic: {topic}
          </span>
        )}
      </div>

      <div className="topbar-right">
        <span className="timer">
          <Clock size={14} />
          {elapsed}
        </span>

        {isTalking && (
          <button type="button" className="btn btn-danger" onClick={onStopTalking}>
            <MicOff size={15} />
            Stop Talking
          </button>
        )}

        <button type="button" className="btn btn-outline" onClick={onEndSession}>
          <PhoneOff size={15} />
          End Session
        </button>

        <div className="avatar">
          <User size={17} />
        </div>
      </div>
    </header>
  );
}

function DotIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
      <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
  );
}