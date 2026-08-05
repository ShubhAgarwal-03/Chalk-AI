import { Clock, PhoneOff, MicOff, Mic, User } from 'lucide-react';

/**
 * `live` is status === 'connected' | 'connecting' — while live, shows a
 * real mute toggle (Stop Talking <-> Resume Talking) plus End Session as
 * two genuinely different controls: muting just gates the outgoing audio
 * (session, playback, and canvas stay alive), End Session tears the whole
 * WS session down. See useSession.js's toggleMute for the muted side.
 */
export default function TopBar({ topic, elapsed, live, muted, onToggleMute, onEndSession }) {
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

        {live && (
          <button type="button" className={muted ? 'btn btn-outline' : 'btn btn-danger'} onClick={onToggleMute}>
            {muted ? <Mic size={15} /> : <MicOff size={15} />}
            {muted ? 'Resume Talking' : 'Stop Talking'}
          </button>
        )}

        {live && (
          <button type="button" className="btn btn-outline" onClick={onEndSession}>
            <PhoneOff size={15} />
            End Session
          </button>
        )}

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