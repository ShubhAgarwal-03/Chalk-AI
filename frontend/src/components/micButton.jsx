import { Mic, MicOff, Loader2 } from 'lucide-react';

export default function MicButton({ status, onStart, onStop }) {
  const isConnecting = status === 'connecting';
  const isActive = status === 'connecting' || status === 'connected';

  return (
    <div className="mic-wrap">
      {status === 'connected' && (
        <>
          <span className="mic-ring" />
          <span className="mic-ring ring-2" />
        </>
      )}
      <button
        type="button"
        className={`mic-btn${isConnecting ? ' is-connecting' : ''}`}
        onClick={isActive ? onStop : onStart}
        disabled={isConnecting}
        aria-label={isActive ? 'End session' : 'Start talking'}
      >
        {isConnecting ? (
          <Loader2 size={24} className="spin" />
        ) : isActive ? (
          <MicOff size={24} />
        ) : (
          <Mic size={24} />
        )}
      </button>
    </div>
  );
}