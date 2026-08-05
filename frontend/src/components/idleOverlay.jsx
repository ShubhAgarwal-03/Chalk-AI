import { PencilLine } from 'lucide-react';
import MicButton from './MicButton.jsx';

export default function IdleOverlay({ topic, status, errorMessage, onStart, onStop }) {
  return (
    <div className="idle-overlay">
      <div className="idle-icon">
        <PencilLine size={24} strokeWidth={1.8} />
      </div>
      <h2 className="idle-heading">Ready to learn?</h2>
      <p className="idle-copy">
        Your whiteboard is set up for <strong>{topic}</strong>. Click below to start our voice session.
      </p>
      {errorMessage && <p className="idle-error">{errorMessage}</p>}
      <MicButton status={status} onStart={onStart} onStop={onStop} />
    </div>
  );
}