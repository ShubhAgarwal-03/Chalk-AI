import { createProvider } from './providers/index.js';

/**
 * One of these runs per connected student. It only knows about the
 * provider CONTRACT (providers/index.js), never a specific provider —
 * that's what makes PROVIDER=openai a config change later, not a rewrite.
 *
 * Message shapes over the browser <-> backend WebSocket:
 *
 *   Browser -> Backend
 *     binary frames             = raw mic PCM chunks (16-bit, 16kHz, mono)
 *     {"type":"end_session"}    = student clicked "End Session"
 *
 *   Backend -> Browser
 *     binary frames             = AI speech PCM chunks to play, PREFIXED with
 *                                 a 4-byte little-endian generation id (see
 *                                 sendAudioFrame below) — read/strip it before
 *                                 playback, and drop frames whose generation
 *                                 is older than the latest 'interrupted' event
 *     {"type":"draw", "call":{name, args}}   = a draw_* / clear_canvas instruction to render
 *     {"type":"transcript", "who", "text"}   = optional, for a debug/history panel
 *     {"type":"interrupted", "generation"}   = student barged in; browser must stop playing
 *                                               queued audio AND ignore any audio frames
 *                                               tagged with a generation below this number
 *     {"type":"error", "message"}
 *     {"type":"session_closed", "reason"}
 *
 * Note on audio rates: Gemini Live sends output audio at 24kHz even though
 * input is 16kHz — the frontend AudioPlayback needs to be configured for
 * 24kHz on the *playback* AudioContext. See frontend/src/audio/AudioPlayback.js.
 */
export async function handleConnection(ws) {
  const provider = createProvider();
  let session = null;
  let generation = 0; // bumped on every interruption; tags every audio chunk so the

  const send = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  // Prefixes every outgoing audio frame with a 4-byte generation id. If the
  // student interrupts, `generation` is bumped BEFORE any further audio is
  // forwarded (see onInterrupted below) — so any chunk that was already
  // in flight for the now-cancelled response still carries the OLD number,
  // and the browser can tell it apart from real new audio and drop it,
  // instead of playing it back after the interruption like it was still
  // relevant. See frontend/src/ws/useSession.js for the matching read side.
  const sendAudioFrame = (buffer) => {
    if (ws.readyState !== ws.OPEN) return;
    const header = Buffer.alloc(4);
    header.writeUInt32LE(generation, 0);
    ws.send(Buffer.concat([header, buffer]));
  };

  try {
    session = await provider.connect({
      onAudioChunk: (buffer) => sendAudioFrame(buffer),
      onToolCall: (call) => {
        // Forward to the browser immediately, then ack immediately —
        // we do NOT wait for the browser to confirm it rendered. This is
        // the "non-blocking relay" decision from the project summary: the
        // model's speech should never stall waiting on us.
        send({ type: 'draw', call: { name: call.name, args: call.args } });
        session.sendToolResult(call.id, call.name, { ok: true });
      },
      onTranscript: (who, text) => send({ type: 'transcript', who, text }),
      onInterrupted: () => {
        generation += 1;
        send({ type: 'interrupted', generation });
      },
      onClose: (reason) => send({ type: 'session_closed', reason }),
      onError: (err) => {
        console.error('[provider error]', err);
        send({ type: 'error', message: err.message });
      },
    });
  } catch (err) {
    console.error('[failed to open provider session]', err);
    send({ type: 'error', message: err.message });
    ws.close();
    return;
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      session.sendAudioChunk(Buffer.from(data));
      return;
    }
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'end_session') {
        session.close();
        ws.close();
      }
    } catch {
      // ignore malformed non-binary frames
    }
  });

  ws.on('close', () => {
    session?.close();
  });
}