export default function StatusPills({ status }) {
  if (status !== 'connected') return null;

  return (
    <div className="canvas-status-group">
      <span className="status-pill">
        <span className="status-dot is-live" />
        Capturing Audio
      </span>
      <span className="status-pill">
        <span className="status-dot" />
        Live Rendering
      </span>
    </div>
  );
}