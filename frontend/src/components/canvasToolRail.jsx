import { Hand, Pencil, Shapes, MoveUpRight, Eraser, Trash2 } from 'lucide-react';

/**
 * Purely a tool-select affordance for now — drawing itself is still driven
 * by the model's tool calls (see drawingReducer.js), not manual input, so
 * `activeTool` just toggles the icon highlight. `onClear` is the one item
 * that's already fully wired: it dispatches clear_canvas up to app.jsx.
 * Swap the tool set based on session state to match the two reference
 * layouts: a drawing-focused set before the board has anything on it,
 * a navigation-focused set (hand/pencil/arrow) once a lesson is live.
 */
export default function CanvasToolRail({ variant, orientation, activeTool, onSelectTool, onClear }) {
  const tools = variant === 'live' ? LIVE_TOOLS : IDLE_TOOLS;

  return (
    <div className={`tool-rail is-${orientation}`}>
      {tools.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`tool-btn${activeTool === id ? ' is-active' : ''}`}
          onClick={() => onSelectTool(id)}
          title={id}
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
      <button type="button" className="tool-btn is-danger" onClick={onClear} title="Clear board">
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

const IDLE_TOOLS = [
  { id: 'pencil', icon: Pencil },
  { id: 'shapes', icon: Shapes },
  { id: 'eraser', icon: Eraser },
];

const LIVE_TOOLS = [
  { id: 'hand', icon: Hand },
  { id: 'pencil', icon: Pencil },
  { id: 'arrow', icon: MoveUpRight },
];