import { MessageSquare, FileText, ListTree, History, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'transcript', label: 'Transcript', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'history', label: 'History', icon: History },
];

/**
 * App-level navigation rail — distinct from the floating canvas tool rail
 * (see CanvasToolRail.jsx), which controls the whiteboard itself. This one
 * switches which side panel is showing. Collapses to an icon-only strip;
 * `activePanel`/`onSelectPanel` are lifted to app.jsx so the panel choice
 * can drive what the transcript drawer shows.
 */
export default function Sidebar({ expanded, onToggle, activePanel, onSelectPanel }) {
  return (
    <aside className={`rail${expanded ? ' is-expanded' : ''}`}>
      <div className="rail-brand">
        <div className="rail-mark">
          <ChalkMark />
        </div>
        {expanded && <span className="rail-wordmark">CHALK AI</span>}
      </div>

      <nav className="rail-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`rail-item${activePanel === id ? ' is-active' : ''}`}
            onClick={() => onSelectPanel(id)}
            title={!expanded ? label : undefined}
          >
            <Icon size={18} strokeWidth={2} />
            {expanded && <span className="rail-item-label">{label}</span>}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="rail-toggle"
        onClick={onToggle}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
      </button>
    </aside>
  );
}

function ChalkMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 12.5 11 4.5M9.5 3l3.5 3.5-1.5 1.5L8 4.5 9.5 3ZM2.5 13.5l1-3 2 2-3 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}