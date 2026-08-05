/**
 * The "drawing DSL" — the small, composable set of tools the model calls
 * WHILE it's speaking, to drive the whiteboard. This is provider-agnostic
 * JSON Schema, consumed by both Gemini's functionDeclarations and OpenAI's
 * tool/function format with only light reshaping (see providers/*.js).
 *
 * Design philosophy: this is a small set of GENERAL 2D primitives, not a
 * library of pre-built diagrams — no "draw_cylinder", no "draw_bird" (see
 * PRD: explicitly out of scope). draw_path is the escape hatch: any organic
 * or irregular shape (a leaf, a bird, a coastline, a respiratory tract) is
 * built from a few draw_path/draw_shape/draw_arc calls composed together,
 * the way a teacher sketches it by hand — a handful of confident strokes,
 * not a photographic outline.
 *
 * Every draw call includes an `id` so the frontend can reference or clear
 * a specific element later.
 */

export const DRAW_TOOLS = [
  {
    name: 'draw_shape',
    description:
      'Draw a basic filled or outlined 2D shape: circle, ellipse, rectangle, triangle, or arbitrary closed polygon. Use for geometric figures, chemistry ring skeletons (hexagon = benzene ring), map regions (as a fill), organ outlines, or any shape with straight or simple closed edges. For organic/irregular outlines (an animal, a leaf, a coastline, a curved organ silhouette), prefer draw_path instead.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique id, e.g. "shape_1".' },
        shape: { type: 'string', enum: ['circle', 'ellipse', 'rectangle', 'triangle', 'polygon'] },
        x: { type: 'number', description: 'X position of the shape origin/center, in canvas units (0-1000).' },
        y: { type: 'number', description: 'Y position of the shape origin/center, in canvas units (0-1000).' },
        width: { type: 'number', description: 'Width (rectangle/triangle bounding box).' },
        height: { type: 'number', description: 'Height (rectangle/triangle bounding box).' },
        radius: { type: 'number', description: 'Radius (circle only).' },
        rx: { type: 'number', description: 'Horizontal radius (ellipse only).' },
        ry: { type: 'number', description: 'Vertical radius (ellipse only). E.g. a cylinder cap viewed at an angle is a wide, short ellipse: large rx, small ry.' },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'Flat [x1,y1,x2,y2,...] list for polygon shapes — pentagons, hexagons (benzene rings), trapezoids, irregular quadrilaterals, map region outlines, etc.',
        },
        rotation: { type: 'number', description: 'Rotation in degrees around the shape center. For tilted squares, rotated triangles in proofs, angled map regions.' },
        color: { type: 'string', description: 'Stroke/outline color, CSS string e.g. "#2563eb". Defaults to a sensible chalk color if omitted.' },
        fill: { type: 'string', description: 'Fill color. Omit for outline-only (usually preferred, so it reads as a diagram not a solid icon). Use sparingly for real emphasis: a filled map region, a shaded atom, a highlighted cell.' },
        fillOpacity: { type: 'number', description: 'Fill opacity 0-1, defaults to 1 if fill is set. Use low values (e.g. 0.2) for a shaded overlay region, like area-under-a-curve.' },
        strokeWidth: { type: 'number', description: 'Defaults to 2.' },
        strokeStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted'], description: 'Dashed/dotted for construction lines, hidden edges, estimated/projected regions.' },
      },
      required: ['id', 'shape', 'x', 'y'],
    },
  },
  {
    name: 'draw_path',
    description:
      'Draw an arbitrary freeform 2D path with straight and curved segments — the general-purpose tool for anything that is not a basic geometric shape: an animal or its anatomy (a bird, a fish, a respiratory tract, a leaf cross-section, a cell), a coastline, a skeletal chemistry structure with curved bonds, any hand-sketch-style figure. Build complex figures as 2-6 confident draw_path/draw_shape calls — not one photorealistic outline.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        segments: {
          type: 'array',
          description: 'Ordered path commands. First must be "move". Then: "line" (straight to x,y), "curve" (cubic bezier to x,y via cx1,cy1,cx2,cy2), "quad" (quadratic bezier to x,y via one control point cx1,cy1).',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['move', 'line', 'curve', 'quad'] },
              x: { type: 'number' },
              y: { type: 'number' },
              cx1: { type: 'number' },
              cy1: { type: 'number' },
              cx2: { type: 'number' },
              cy2: { type: 'number' },
            },
            required: ['type', 'x', 'y'],
          },
        },
        closed: { type: 'boolean', description: 'Close the path back to its start — true for a filled/closed silhouette, false for an open line like a river or nerve pathway.' },
        color: { type: 'string' },
        fill: { type: 'string', description: 'Fill color for a closed path. Omit for outline-only.' },
        fillOpacity: { type: 'number' },
        strokeWidth: { type: 'number' },
        strokeStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
      },
      required: ['id', 'segments'],
    },
  },
  {
    name: 'draw_line',
    description:
      'Draw a straight or multi-segment line. Use for axis segments, sides of shapes, plain vectors, connecting strokes, and chemistry bonds — strokeStyle "wedge"/"dashedWedge" are the standard stereo-bond notations (toward/away from viewer), and doubled draws a parallel double line for a double covalent bond.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'Flat [x1,y1,x2,y2,...] list, at least 2 points.',
        },
        color: { type: 'string' },
        strokeWidth: { type: 'number' },
        strokeStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'wedge', 'dashedWedge'], description: '"wedge"/"dashedWedge" are for chemistry 3D stereo bonds only.' },
        doubled: { type: 'boolean', description: 'Draw as a parallel double line — standard notation for a double covalent bond.' },
      },
      required: ['id', 'points'],
    },
  },
  {
    name: 'draw_arc',
    description:
      'Draw a circular arc, or a filled pie/wedge slice. Use for angles in geometry (small radius near the vertex), orbital paths, circular motion in physics, pie charts, or protractor-style angle markers.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x: { type: 'number', description: 'Center x.' },
        y: { type: 'number', description: 'Center y.' },
        radius: { type: 'number' },
        startAngle: { type: 'number', description: 'Degrees, 0 = pointing right, clockwise positive.' },
        endAngle: { type: 'number' },
        filled: { type: 'boolean', description: 'True = filled pie/wedge slice (pie charts, highlighting an angle region). False = arc stroke only (angle markers, orbits).' },
        color: { type: 'string' },
        fill: { type: 'string' },
        strokeWidth: { type: 'number' },
      },
      required: ['id', 'x', 'y', 'radius', 'startAngle', 'endAngle'],
    },
  },
  {
    name: 'draw_curve',
    description:
      'Plot a smooth curve through sampled points — for graphing a function (parabola, sine wave, exponential), a trajectory, a trend line, or anything that should read as continuous rather than jagged. Sample 8-30 points depending on curvature; the renderer interpolates between them.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        points: {
          type: 'array',
          items: { type: 'number' },
          description: 'Flat [x1,y1,x2,y2,...] list of sampled points, in path order.',
        },
        color: { type: 'string' },
        strokeWidth: { type: 'number' },
        strokeStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
      },
      required: ['id', 'points'],
    },
  },
  {
    name: 'draw_axes',
    description:
      'Draw a labeled coordinate system (x-axis + y-axis + tick marks) in one call, instead of composing it from several draw_line/draw_label calls. Call this first whenever you are about to graph a function or plot data, then draw_curve/draw_shape on top of it.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x: { type: 'number', description: 'Canvas x of the origin.' },
        y: { type: 'number', description: 'Canvas y of the origin.' },
        width: { type: 'number', description: 'Total x-axis length in canvas units.' },
        height: { type: 'number', description: 'Total y-axis length in canvas units.' },
        xLabel: { type: 'string' },
        yLabel: { type: 'string' },
        ticks: { type: 'number', description: 'Approx tick marks per axis. Defaults to 5.' },
        color: { type: 'string' },
      },
      required: ['id', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'draw_label',
    description:
      'Write a short plain-text label — naming a point, vertex, axis, atom, region, or organ. Use background for a callout-chip style (small rounded box behind the text) when it needs to stand out on a busy diagram.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        fontSize: { type: 'number', description: 'Defaults to 16.' },
        color: { type: 'string' },
        rotation: { type: 'number', description: 'Degrees — align a label along a slanted side or axis.' },
        background: { type: 'string', description: 'Optional callout-chip background color behind the text. Omit for a plain label.' },
        italic: { type: 'boolean', description: 'Conventional for variable names (a, b, x) vs. fixed terms.' },
      },
      required: ['id', 'text', 'x', 'y'],
    },
  },
  {
    name: 'draw_equation',
    description: 'Render a math or chemistry equation/formula at a position, in LaTeX (mhchem \\ce{} supported for balanced chemical equations).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        latex: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        fontSize: { type: 'number', description: 'Defaults to 20.' },
      },
      required: ['id', 'latex', 'x', 'y'],
    },
  },
  {
    name: 'draw_arrow',
    description:
      'Draw a straight or curved arrow. Use for vectors, force directions, flow between elements, map wind/current directions, or curved electron-pushing arrows in reaction mechanisms (set curved true).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x1: { type: 'number' },
        y1: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
        curved: { type: 'boolean' },
        curveOffset: { type: 'number', description: 'Perpendicular offset of the curve\'s midpoint from the straight line. Only used if curved is true.' },
        doubleHeaded: { type: 'boolean', description: 'Arrowheads on both ends — equilibrium reactions, two-way relationships.' },
        color: { type: 'string' },
        strokeWidth: { type: 'number' },
      },
      required: ['id', 'x1', 'y1', 'x2', 'y2'],
    },
  },
  {
    name: 'clear_canvas',
    description:
      'Clear the whiteboard. Pass specific ids to remove just those elements, or omit ids to clear everything. Call this as your FIRST action whenever the student moves to a new question or topic that is not a direct continuation of what is currently drawn.',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Ids to remove. Omit entirely to clear the whole canvas.' },
      },
      required: [],
    },
  },
];

/** Canvas is a fixed 1000x1000 logical coordinate space; the frontend scales it to fit. */
export const CANVAS_UNITS = 1000;