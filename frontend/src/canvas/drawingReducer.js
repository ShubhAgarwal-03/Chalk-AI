/**
 * Converts the raw {name, args} tool calls coming over the WebSocket (see
 * backend/src/tools.js for the schema) into a flat map of renderable
 * elements, keyed by id. whiteboard.jsx just renders whatever's in this
 * map — it doesn't know anything about the wire format.
 *
 * Same CANVAS_UNITS as the backend (backend/src/tools.js) — the model
 * always draws in this 1000x1000 logical space regardless of the
 * student's actual screen size; whiteboard.jsx scales it to fit.
 */

export const CANVAS_UNITS = 1000;

const initialState = {}; // { [id]: element }

export function drawingReducer(state, call) {
  switch (call.name) {
    case 'draw_shape':
    case 'draw_path':
    case 'draw_line':
    case 'draw_arc':
    case 'draw_curve':
    case 'draw_axes':
    case 'draw_arrow':
    case 'draw_label':
    case 'draw_equation': {
      const { id, ...rest } = call.args;
      if (!id) return state; // malformed call from the model, ignore rather than crash
      return {
        ...state,
        [id]: { type: call.name, id, ...rest },
      };
    }

    case 'clear_canvas': {
      const ids = call.args?.ids;
      if (!ids || ids.length === 0) {
        return {}; // clear everything
      }
      const next = { ...state };
      for (const id of ids) delete next[id];
      return next;
    }

    default:
      return state; // unknown tool call, ignore
  }
}

export function initDrawingState() {
  return initialState;
}