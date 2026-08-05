import { GoogleGenAI, Modality } from '@google/genai';
import { DRAW_TOOLS } from '../tools.js';
import { SYSTEM_PROMPT } from '../systemPrompt.js';

/**
 * Real implementation of the provider contract (see providers/index.js) for
 * Gemini Live API. Reference: https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
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

  async function connect({ onAudioChunk, onToolCall, onTranscript, onInterrupted, onClose, onError }) {
    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
      // Without this, long sessions hit Gemini's context window limit and
      // the connection just closes with little warning. This lets the
      // server compress/trim older turns to keep the session going instead
      // of hard-cutting it — recommended by Google for any session expected
      // to run more than a few minutes, which a tutoring session will.
      contextWindowCompression: { slidingWindow: {} },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
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

      // Fires when the student's speech interrupted the AI mid-response
      // (native barge-in detection). The browser must stop playing any
      // already-buffered audio right away, or stale speech overlaps the
      // student talking.
      if (content?.interrupted) {
        onInterrupted?.();
      }

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

      // Gemini sends this shortly before it force-closes the connection
      // (session/context limits) — surfacing it turns "the app silently
      // died" into a legible warning instead.
      if (message.goAway) {
        const secondsLeft = message.goAway.timeLeft ? Math.round(Number(message.goAway.timeLeft.replace('s', ''))) : null;
        onError?.(
          new Error(
            secondsLeft
              ? `Session will be closed by the server in ~${secondsLeft}s (Gemini Live session limit). Consider wrapping up.`
              : 'Session will be closed by the server soon (Gemini Live session limit).'
          )
        );
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