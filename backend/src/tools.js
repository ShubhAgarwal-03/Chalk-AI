/**
 * The "drawing DSL" — the small, composable set of tools the model calls
 * WHILE it's speaking, to drive the whiteboard. This is provider-agnostic:
 * it's plain JSON Schema, which both Gemini's functionDeclarations and
 * OpenAI's tool/function format can consume with only light reshaping
 * (see providers/geminiProvider.js and providers/openaiProvider.js for the
 * provider-specific wrapping).
 *
 * Every draw call includes an `id` so the frontend can reference or clear
 * a specific element later (e.g. "clear_canvas" with a list of ids, or a
 * follow-up label that attaches to an existing shape).
 */

export const DRAW_TOOLS = [
  {
    name: 'draw_shape',
    description:
      'Draw a basic geometric shape (circle, rectangle, triangle, line-based polygon) on the whiteboard. Use for diagrams, geometry figures, force diagrams, etc.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique id for this shape, e.g. "shape_1". Used to reference or clear it later.' },
        shape: { type: 'string', enum: ['circle', 'rectangle', 'triangle', 'polygon'] },
        x: { type: 'number', description: 'X position of the shape origin, in canvas units (0-1000).' },
        y: { type: 'number', description: 'Y position of the shape origin, in canvas units (0-1000).' },
        width: { type: 'number', description: 'Width (rectangle/triangle/polygon bounding box).' },
        height: { type: 'number', description: 'Height (rectangle/triangle/polygon bounding box).' },
        radius: { type: 'number', description: 'Radius (circle only).' },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'Flat [x1,y1,x2,y2,...] list for polygon shapes.',
        },
        color: { type: 'string', description: 'CSS color string, e.g. "#2563eb". Defaults to a sensible chalk color if omitted.' },
        strokeWidth: { type: 'number', description: 'Line thickness. Defaults to 2.' },
      },
      required: ['id', 'shape', 'x', 'y'],
    },
  },
  {
    name: 'draw_line',
    description:
      'Draw a straight or multi-segment line between points. Use for axes, sides of shapes, vectors without arrowheads, connecting strokes.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'Flat [x1,y1,x2,y2,...] list, at least 2 points (4 numbers).',
        },
        color: { type: 'string' },
        strokeWidth: { type: 'number' },
        dashed: { type: 'boolean', description: 'Draw as a dashed line.' },
      },
      required: ['id', 'points'],
    },
  },
  {
    name: 'draw_arrow',
    description: 'Draw an arrow from one point to another. Use for vectors, force directions, flow between diagram elements.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x1: { type: 'number' },
        y1: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
        color: { type: 'string' },
        strokeWidth: { type: 'number' },
      },
      required: ['id', 'x1', 'y1', 'x2', 'y2'],
    },
  },
  {
    name: 'draw_label',
    description: 'Write a short plain-text label or annotation at a position — e.g. naming a point, vertex, or axis.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        fontSize: { type: 'number', description: 'Defaults to 16.' },
        color: { type: 'string' },
      },
      required: ['id', 'text', 'x', 'y'],
    },
  },
  {
    name: 'draw_equation',
    description:
      'Render a mathematical equation or formula at a position, in LaTeX. Use for formulas, step-by-step working, substitutions.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        latex: { type: 'string', description: 'Valid KaTeX-renderable LaTeX, e.g. "a^2 + b^2 = c^2".' },
        x: { type: 'number' },
        y: { type: 'number' },
        fontSize: { type: 'number', description: 'Defaults to 20.' },
      },
      required: ['id', 'latex', 'x', 'y'],
    },
  },
  {
    name: 'clear_canvas',
    description:
      'Clear the whiteboard. Pass specific ids to remove just those elements, or omit ids to clear everything. Use sparingly — prefer building on the existing diagram, and clear only when starting a genuinely new topic.',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids to remove. Omit this field entirely to clear the whole canvas.',
        },
      },
      required: [],
    },
  },
];

/** Canvas is treated as a fixed 1000x1000 logical coordinate space; the frontend scales it to fit. */
export const CANVAS_UNITS = 1000;