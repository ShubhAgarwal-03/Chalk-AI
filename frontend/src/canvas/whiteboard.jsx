import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Rect, Line, Arrow, Text } from 'react-konva';
import Equation from './equation.jsx';
import { CANVAS_UNITS } from './drawingReducer.js';

const DEFAULT_COLOR = '#1e293b';

/**
 * `elements` is the map produced by drawingReducer.js: { [id]: element }.
 * Everything here draws in the fixed 1000x1000 logical space the model
 * uses (CANVAS_UNITS) — `scale` converts those coordinates to actual
 * pixels based on the container's real size, so the board looks right at
 * any screen size without the model needing to know pixel dimensions.
 *
 * Equations are the one element type NOT drawn by Konva — KaTeX needs a
 * real DOM node, so they're rendered as an absolutely-positioned HTML
 * overlay in the same wrapping div, using the same `scale`.
 */
export default function Whiteboard({ elements }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setSize(Math.min(width, 900));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scale = size / CANVAS_UNITS;
  const items = Object.values(elements);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        maxWidth: 900,
        background: '#fdfdfb',
        border: '1px solid #ddd',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <Stage width={size} height={size}>
        <Layer>
          {items.map((el) => renderShapeElement(el, scale))}
        </Layer>
      </Stage>

      {items
        .filter((el) => el.type === 'draw_equation')
        .map((el) => (
          <Equation key={el.id} latex={el.latex} x={el.x} y={el.y} fontSize={el.fontSize} scale={scale} />
        ))}
    </div>
  );
}

function renderShapeElement(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;

  switch (el.type) {
    case 'draw_shape': {
      if (el.shape === 'circle') {
        return (
          <Circle
            key={el.id}
            x={el.x * scale}
            y={el.y * scale}
            radius={(el.radius || 40) * scale}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      }
      if (el.shape === 'rectangle') {
        return (
          <Rect
            key={el.id}
            x={el.x * scale}
            y={el.y * scale}
            width={(el.width || 80) * scale}
            height={(el.height || 60) * scale}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      }
      if (el.shape === 'triangle') {
        const w = (el.width || 80) * scale;
        const h = (el.height || 80) * scale;
        const x = el.x * scale;
        const y = el.y * scale;
        return (
          <Line
            key={el.id}
            points={[x, y + h, x + w / 2, y, x + w, y + h]}
            closed
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      }
      if (el.shape === 'polygon' && el.points) {
        return (
          <Line
            key={el.id}
            points={el.points.map((v) => v * scale)}
            closed
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      }
      return null;
    }

    case 'draw_line': {
      if (!el.points) return null;
      return (
        <Line
          key={el.id}
          points={el.points.map((v) => v * scale)}
          stroke={color}
          strokeWidth={strokeWidth}
          dash={el.dashed ? [8, 6] : undefined}
        />
      );
    }

    case 'draw_arrow': {
      return (
        <Arrow
          key={el.id}
          points={[el.x1 * scale, el.y1 * scale, el.x2 * scale, el.y2 * scale]}
          stroke={color}
          fill={color}
          strokeWidth={strokeWidth}
          pointerLength={8 * scale}
          pointerWidth={8 * scale}
        />
      );
    }

    case 'draw_label': {
      return (
        <Text
          key={el.id}
          x={el.x * scale}
          y={el.y * scale}
          text={el.text}
          fontSize={(el.fontSize || 16) * scale}
          fill={color}
        />
      );
    }

    default:
      return null; // draw_equation is rendered as an HTML overlay, not here
  }
}