import { GoogleGenAI, Modality } from '@google/genai';
import { DRAW_TOOLS } from '../tools.js';
import { SYSTEM_PROMPT } from '../systemPrompt.js';

/**
 * Real implementation of the provider contract (see providers/index.js) for
 * Gemini Live API. Reference: https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
 *
 * Notes on choices made here, worth revisiting:
 * - Model defaults to gemini-3.1-flash-live-preview (current as of the PRD's
 *   writing). It only supports SYNCHRONOUS function calling — meaning the
 *   model's turn pauses until we send a tool result. That's fine for us
 *   because our tool "work" (forwarding a draw instruction to the browser)
 *   is instant — we don't wait for the browser to finish rendering before
 *   replying, we just ack immediately. If you switch to
 *   gemini-2.5-flash-live-preview you also get NON_BLOCKING/async tool
 *   calls, which isn't needed here but is available.
 * - responseModalities is AUDIO only — we don't need text output, the
 *   audio itself + tool calls are the whole product.
 */
export function createGeminiProvider() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const functionDeclarations = DRAW_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  async function connect({ onAudioChunk, onToolCall, onTranscript, onClose, onError }) {
    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
      // Native VAD/barge-in is on by default — the student's mic staying
      // live is all that's needed for interruption to work; no config here.
    };

    const geminiSession = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          // no-op; connection confirmed
        },
        onmessage: (message) => {
          try {
            handleMessage(message);
          } catch (err) {
            onError?.(err);
          }
        },
        onerror: (e) => onError?.(new Error(e?.message || 'Gemini Live error')),
        onclose: (e) => onClose?.(e?.reason || 'closed'),
      },
    });

    function handleMessage(message) {
      const content = message.serverContent;

      if (content?.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            onAudioChunk?.(Buffer.from(part.inlineData.data, 'base64'));
          }
        }
      }

      if (content?.inputTranscription?.text) {
        onTranscript?.('student', content.inputTranscription.text);
      }
      if (content?.outputTranscription?.text) {
        onTranscript?.('ai', content.outputTranscription.text);
      }

      if (message.toolCall?.functionCalls) {
        for (const fc of message.toolCall.functionCalls) {
          onToolCall?.({ id: fc.id, name: fc.name, args: fc.args || {} });
        }
      }
    }

    return {
      sendAudioChunk(buffer) {
        geminiSession.sendRealtimeInput({
          audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        });
      },

      sendToolResult(toolCallId, name, result) {
        geminiSession.sendToolResponse({
          functionResponses: [{ id: toolCallId, name, response: { result } }],
        });
      },

      close() {
        geminiSession.close();
      },
    };
  }

  return { connect };
}