import { createGeminiProvider } from './geminiProvider.js';
import { createOpenAIProvider } from './openaiProvider.js';

/**
 * PROVIDER CONTRACT
 * -----------------
 * Every provider module exports a `create<X>Provider()` factory returning
 * an object shaped like this. wsRelay.js only talks to this shape — it
 * never imports a specific provider directly — so swapping PROVIDER=gemini
 * for PROVIDER=openai in .env is the only change needed once a provider
 * module is filled in.
 *
 *   connect({ onAudioChunk, onToolCall, onTranscript, onClose, onError }) -> Promise<session>
 *     Opens a live session. Callbacks fire as events arrive from the model:
 *       onAudioChunk(buffer)        - Buffer of raw 16-bit PCM audio to play to the student
 *       onToolCall(toolCall)        - { id, name, args } — a draw_* or clear_canvas call
 *       onTranscript(who, text)     - who: 'student' | 'ai', for optional debug/history UI
 *       onClose(reason)
 *       onError(err)
 *
 *   session.sendAudioChunk(buffer)
 *     Buffer of raw 16-bit PCM audio (16kHz, little-endian, mono) from the student's mic.
 *
 *   session.sendToolResult(toolCallId, name, result)
 *     Acknowledges a tool call. Must be called (even with a trivial {ok:true})
 *     or the model's turn stalls waiting on it — this is what "non-blocking
 *     relay" in the PRD refers to: reply instantly, don't wait on the browser
 *     to confirm it finished rendering.
 *
 *   session.close()
 */
export function createProvider(providerName = process.env.PROVIDER || 'gemini') {
  switch (providerName) {
    case 'gemini':
      return createGeminiProvider();
    case 'openai':
      return createOpenAIProvider();
    default:
      throw new Error(`Unknown PROVIDER "${providerName}". Expected "gemini" or "openai".`);
  }
}