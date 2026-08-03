import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Konva can't render real math typesetting, so equations are a normal HTML
 * element absolutely positioned on top of the Konva <Stage> (see
 * whiteboard.jsx, which layers this in a wrapping <div>). `scale` is the
 * canvas-units-to-pixels ratio the whiteboard computes from its own size,
 * so this stays aligned with the shapes drawn underneath it.
 */
export default function Equation({ latex, x, y, fontSize = 20, scale }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex, ref.current, { throwOnError: false, displayMode: false });
    } catch (err) {
      ref.current.textContent = latex; // fall back to raw text rather than a blank spot
    }
  }, [latex]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        fontSize: fontSize * scale,
        color: '#1e293b',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    />
  );
}