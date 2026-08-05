import { useEffect, useRef, useState } from 'react';
import {
  Stage, Layer, Circle, Ellipse, Rect, Line, Arrow, Text, Path, Wedge, Group, Shape,
} from 'react-konva';
import Equation from './equation.jsx';
import { CANVAS_UNITS } from './drawingReducer.js';

const DEFAULT_COLOR = '#1e293b';

export default function Whiteboard({ elements }) {
  const containerRef = useRef(null);
  const [box, setBox] = useState({ width: 600, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Container is a full flexible rect (sized by CanvasCard.jsx), not a
  // fixed square — scale the fixed 1000x1000 logical drawing space to fit
  // and center it inside whatever space is available.
  const size = Math.max(Math.min(box.width, box.height), 1);
  const scale = size / CANVAS_UNITS;
  const offsetX = (box.width - size) / 2;
  const offsetY = (box.height - size) / 2;
  const items = Object.values(elements);

  return (
    <div ref={containerRef} className="whiteboard">
      <Stage width={box.width} height={box.height}>
        <Layer x={offsetX} y={offsetY}>{items.map((el) => renderElement(el, scale))}</Layer>
      </Stage>

      <div style={{ position: 'absolute', left: offsetX, top: offsetY, width: size, height: size, pointerEvents: 'none' }}>
        {items
          .filter((el) => el.type === 'draw_equation')
          .map((el) => (
            <Equation key={el.id} latex={el.latex} x={el.x} y={el.y} fontSize={el.fontSize} scale={scale} />
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function renderElement(el, scale) {
  switch (el.type) {
    case 'draw_shape': return renderShape(el, scale);
    case 'draw_path': return renderPath(el, scale);
    case 'draw_line': return renderLine(el, scale);
    case 'draw_arc': return renderArc(el, scale);
    case 'draw_curve': return renderCurve(el, scale);
    case 'draw_axes': return renderAxes(el, scale);
    case 'draw_arrow': return renderArrowEl(el, scale);
    case 'draw_label': return renderLabel(el, scale);
    default: return null; // draw_equation is an HTML overlay, not Konva
  }
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function dashArray(style, scale) {
  if (style === 'dashed') return [8 * scale, 6 * scale];
  if (style === 'dotted') return [2 * scale, 4 * scale];
  return undefined; // solid / unset
}

function perpendicular(ax, ay, bx, by, dist) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * dist, y: (dx / len) * dist };
}

function angleBetween(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Rotates a flat [x1,y1,x2,y2,...] point list around its own centroid,
// rather than around the canvas origin (Konva's default rotation pivot),
// so a rotated triangle/polygon spins in place like you'd expect.
function polygonProps(points, rotation) {
  if (!rotation) return { points };
  let sx = 0, sy = 0;
  const n = points.length / 2;
  for (let i = 0; i < points.length; i += 2) { sx += points[i]; sy += points[i + 1]; }
  const cx = sx / n, cy = sy / n;
  const rel = [];
  for (let i = 0; i < points.length; i += 2) rel.push(points[i] - cx, points[i + 1] - cy);
  return { points: rel, x: cx, y: cy, rotation };
}

// ---------------------------------------------------------------------------
// draw_shape — circle, ellipse, rectangle, triangle, polygon
// ---------------------------------------------------------------------------

function renderShape(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const dash = dashArray(el.strokeStyle, scale);
  const fillProps = el.fill ? { fill: el.fill, opacity: el.fillOpacity ?? 1 } : {};
  const rotation = el.rotation || 0;

  switch (el.shape) {
    case 'circle':
      return (
        <Circle key={el.id} x={el.x * scale} y={el.y * scale} radius={(el.radius || 40) * scale}
          stroke={color} strokeWidth={strokeWidth} dash={dash} rotation={rotation} {...fillProps} />
      );

    case 'ellipse':
      // The primitive that was missing before — flattened for a 3D cap
      // (cylinder, cup, cone base): large rx, small ry.
      return (
        <Ellipse key={el.id} x={el.x * scale} y={el.y * scale}
          radiusX={(el.rx || 50) * scale} radiusY={(el.ry || 25) * scale}
          stroke={color} strokeWidth={strokeWidth} dash={dash} rotation={rotation} {...fillProps} />
      );

    case 'rectangle': {
      const w = (el.width || 80) * scale, h = (el.height || 60) * scale;
      // Center-pivot so rotation (e.g. a tilted square in a proof) spins
      // around the shape's own middle, not its top-left corner.
      const cx = el.x * scale + w / 2, cy = el.y * scale + h / 2;
      return (
        <Rect key={el.id} x={cx} y={cy} width={w} height={h} offsetX={w / 2} offsetY={h / 2}
          rotation={rotation} stroke={color} strokeWidth={strokeWidth} dash={dash} {...fillProps} />
      );
    }

    case 'triangle': {
      const w = (el.width || 80) * scale, h = (el.height || 80) * scale;
      const x = el.x * scale, y = el.y * scale;
      const pts = [x, y + h, x + w / 2, y, x + w, y + h];
      const props = polygonProps(pts, rotation);
      return (
        <Line key={el.id} closed stroke={color} strokeWidth={strokeWidth} dash={dash} {...props} {...fillProps} />
      );
    }

    case 'polygon': {
      if (!el.points) return null;
      const pts = el.points.map((v) => v * scale);
      const props = polygonProps(pts, rotation);
      // Also covers benzene rings (hexagon), pentagons, trapezoids, map regions.
      return (
        <Line key={el.id} closed stroke={color} strokeWidth={strokeWidth} dash={dash} {...props} {...fillProps} />
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// draw_path — the general escape hatch for organic/irregular shapes
// ---------------------------------------------------------------------------

function pathData(segments, scale) {
  let d = '';
  for (const seg of segments) {
    const x = seg.x * scale, y = seg.y * scale;
    if (seg.type === 'move') d += `M ${x} ${y} `;
    else if (seg.type === 'line') d += `L ${x} ${y} `;
    else if (seg.type === 'curve') d += `C ${seg.cx1 * scale} ${seg.cy1 * scale} ${seg.cx2 * scale} ${seg.cy2 * scale} ${x} ${y} `;
    else if (seg.type === 'quad') d += `Q ${seg.cx1 * scale} ${seg.cy1 * scale} ${x} ${y} `;
  }
  return d.trim();
}

function renderPath(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const dash = dashArray(el.strokeStyle, scale);
  let d = pathData(el.segments || [], scale);
  if (el.closed) d += ' Z';
  return (
    <Path key={el.id} data={d} stroke={color} strokeWidth={strokeWidth} dash={dash}
      fill={el.fill} opacity={el.fill ? (el.fillOpacity ?? 1) : 1} />
  );
}

// ---------------------------------------------------------------------------
// draw_line — including chemistry stereo bonds (wedge/dashedWedge) + doubled
// ---------------------------------------------------------------------------

function renderLine(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const pts = (el.points || []).map((v) => v * scale);
  if (pts.length < 4) return null;

  if (el.strokeStyle === 'wedge' || el.strokeStyle === 'dashedWedge') {
    return renderWedgeBond(el, scale, color, strokeWidth, pts);
  }

  const dash = dashArray(el.strokeStyle, scale);

  if (el.doubled) {
    const [ax, ay, bx, by] = pts;
    const off = perpendicular(ax, ay, bx, by, 3 * scale);
    return (
      <Group key={el.id}>
        <Line points={[ax + off.x, ay + off.y, bx + off.x, by + off.y]} stroke={color} strokeWidth={strokeWidth} dash={dash} />
        <Line points={[ax - off.x, ay - off.y, bx - off.x, by - off.y]} stroke={color} strokeWidth={strokeWidth} dash={dash} />
      </Group>
    );
  }

  return <Line key={el.id} points={pts} stroke={color} strokeWidth={strokeWidth} dash={dash} />;
}

// Simplified but standard stereo-bond notation: solid wedge = filled
// triangle, narrow at the start (stereocenter) widening toward the end.
// Dashed wedge = short-to-long hash marks along the same axis.
function renderWedgeBond(el, scale, color, strokeWidth, pts) {
  const [ax, ay, bx, by] = pts;
  const maxWidth = 8 * scale;

  if (el.strokeStyle === 'wedge') {
    const perp = perpendicular(ax, ay, bx, by, maxWidth / 2);
    return (
      <Line key={el.id} closed stroke={color} fill={color} strokeWidth={1}
        points={[ax, ay, bx + perp.x, by + perp.y, bx - perp.x, by - perp.y]} />
    );
  }

  const steps = 6;
  const dashes = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    const perp = perpendicular(ax, ay, bx, by, (maxWidth / 2) * t);
    dashes.push(
      <Line key={`${el.id}_d${i}`} stroke={color} strokeWidth={strokeWidth}
        points={[x + perp.x, y + perp.y, x - perp.x, y - perp.y]} />
    );
  }
  return <Group key={el.id}>{dashes}</Group>;
}

// ---------------------------------------------------------------------------
// draw_arc — angle markers, orbits, pie/wedge slices
// ---------------------------------------------------------------------------

function renderArc(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const cx = el.x * scale, cy = el.y * scale;
  const r = el.radius * scale;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const span = el.endAngle - el.startAngle;

  if (el.filled) {
    return (
      <Wedge key={el.id} x={cx} y={cy} radius={r} angle={span} rotation={el.startAngle}
        fill={el.fill || color} stroke={color} strokeWidth={strokeWidth} />
    );
  }

  return (
    <Shape
      key={el.id}
      stroke={color}
      strokeWidth={strokeWidth}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, (el.startAngle * Math.PI) / 180, (el.endAngle * Math.PI) / 180, false);
        ctx.strokeShape(shape);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// draw_curve — smooth curve through sampled points (functions, trajectories)
// ---------------------------------------------------------------------------

function renderCurve(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const dash = dashArray(el.strokeStyle, scale);
  const pts = (el.points || []).map((v) => v * scale);
  return (
    <Line key={el.id} points={pts} stroke={color} strokeWidth={strokeWidth} dash={dash}
      tension={0.4} lineCap="round" lineJoin="round" />
  );
}

// ---------------------------------------------------------------------------
// draw_axes — one call instead of composing several draw_line/draw_label calls
// ---------------------------------------------------------------------------
// Convention: `height` extends UPWARD from (x, y) — standard math orientation
// — even though canvas y grows downward. Ticks are evenly spaced.

function renderAxes(el, scale) {
  const color = el.color || '#94a3b8';
  const x0 = el.x * scale, y0 = el.y * scale;
  const w = el.width * scale, h = el.height * scale;
  const ticks = el.ticks || 5;
  const tickWidth = 1.5 * scale;
  const tickEls = [];

  for (let i = 1; i <= ticks; i++) {
    const tx = x0 + (w * i) / ticks;
    tickEls.push(<Line key={`${el.id}_xt${i}`} points={[tx, y0 - 4 * scale, tx, y0 + 4 * scale]} stroke={color} strokeWidth={tickWidth} />);
    const ty = y0 - (h * i) / ticks;
    tickEls.push(<Line key={`${el.id}_yt${i}`} points={[x0 - 4 * scale, ty, x0 + 4 * scale, ty]} stroke={color} strokeWidth={tickWidth} />);
  }

  return (
    <Group key={el.id}>
      <Line points={[x0, y0, x0 + w, y0]} stroke={color} strokeWidth={tickWidth} />
      <Line points={[x0, y0, x0, y0 - h]} stroke={color} strokeWidth={tickWidth} />
      {tickEls}
      {el.xLabel && <Text x={x0 + w - 10 * scale} y={y0 + 8 * scale} text={el.xLabel} fontSize={14 * scale} fill={color} />}
      {el.yLabel && <Text x={x0 + 4 * scale} y={y0 - h - 16 * scale} text={el.yLabel} fontSize={14 * scale} fill={color} />}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// draw_arrow — straight or curved, single or double-headed
// ---------------------------------------------------------------------------

function renderArrowHead(x, y, angle, color, strokeWidth) {
  const len = 8 + strokeWidth * 2;
  const spread = 0.5;
  const p1 = { x: x - len * Math.cos(angle - spread), y: y - len * Math.sin(angle - spread) };
  const p2 = { x: x - len * Math.cos(angle + spread), y: y - len * Math.sin(angle + spread) };
  return <Line points={[p1.x, p1.y, x, y, p2.x, p2.y]} closed stroke={color} fill={color} strokeWidth={1} />;
}

function renderArrowEl(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const strokeWidth = (el.strokeWidth || 2) * scale;
  const x1 = el.x1 * scale, y1 = el.y1 * scale, x2 = el.x2 * scale, y2 = el.y2 * scale;

  if (el.curved) {
    // For reaction-mechanism electron-pushing arrows.
    const offset = (el.curveOffset ?? 30) * scale;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const perp = perpendicular(x1, y1, x2, y2, offset);
    const cx = mx + perp.x, cy = my + perp.y;
    const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    return (
      <Group key={el.id}>
        <Path data={d} stroke={color} strokeWidth={strokeWidth} />
        {renderArrowHead(x2, y2, angleBetween(cx, cy, x2, y2), color, strokeWidth)}
        {el.doubleHeaded && renderArrowHead(x1, y1, angleBetween(cx, cy, x1, y1), color, strokeWidth)}
      </Group>
    );
  }

  return (
    <Arrow key={el.id} points={[x1, y1, x2, y2]} stroke={color} fill={color} strokeWidth={strokeWidth}
      pointerLength={8 * scale} pointerWidth={8 * scale} pointerAtBeginning={!!el.doubleHeaded} />
  );
}

// ---------------------------------------------------------------------------
// draw_label — plain text, optional callout-chip background, rotation, italic
// ---------------------------------------------------------------------------

function renderLabel(el, scale) {
  const color = el.color || DEFAULT_COLOR;
  const fontSize = (el.fontSize || 16) * scale;
  const x = el.x * scale, y = el.y * scale;
  const fontStyle = el.italic ? 'italic' : 'normal';

  if (!el.background) {
    return (
      <Text key={el.id} x={x} y={y} text={el.text} fontSize={fontSize} fill={color}
        fontStyle={fontStyle} rotation={el.rotation || 0} />
    );
  }

  // Rough width estimate for the chip — good enough at this font-size range,
  // not a real text-measurement pass.
  const paddingX = 6 * scale, paddingY = 3 * scale;
  const approxWidth = el.text.length * fontSize * 0.55 + paddingX * 2;
  const approxHeight = fontSize + paddingY * 2;

  return (
    <Group key={el.id} x={x} y={y} rotation={el.rotation || 0}>
      <Rect width={approxWidth} height={approxHeight} fill={el.background} cornerRadius={4 * scale} />
      <Text x={paddingX} y={paddingY} text={el.text} fontSize={fontSize} fill={color} fontStyle={fontStyle} />
    </Group>
  );
}