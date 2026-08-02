/**
 * STUB — not implemented yet. Fill this in if/when swapping to OpenAI's
 * Realtime API, which has the same core shape (a persistent audio session
 * where the model can emit function/tool calls interleaved with its own
 * audio generation), so this fits the same provider contract as
 * geminiProvider.js — see providers/index.js for the contract.
 *
 * Rough mapping when you build this out (verify against current OpenAI
 * Realtime API docs, this shifts fast):
 * - Connect over WebSocket to the Realtime API with OPENAI_API_KEY.
 * - Session config: set `modalities: ['audio']`, pass DRAW_TOOLS reshaped
 *   into OpenAI's `tools: [{ type: 'function', name, description, parameters }]`
 *   format (nearly identical JSON Schema to what tools.js already exports).
 *   Set `instructions` to SYSTEM_PROMPT.
 *   Server-side VAD/interruption is again just "keep streaming mic audio";
 *   OpenAI's Realtime API also detects barge-in on its own.
 * - Incoming events: 'response.audio.delta' (base64 audio chunks),
 *   'response.function_call_arguments.done' (tool calls),
 *   'conversation.item.input_audio_transcription.completed' (transcripts).
 * - Sending audio: 'input_audio_buffer.append' events with base64 PCM.
 * - Acking a tool call: send a 'conversation.item.create' with the function
 *   output, then 'response.create' to let the model continue.
 */
export function createOpenAIProvider() {
  return {
    async connect() {
      throw new Error(
        'OpenAI provider is a stub. Implement connect() here (see comments in this file) then set PROVIDER=openai in .env.'
      );
    },
  };
}