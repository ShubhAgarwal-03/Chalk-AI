import { GoogleGenAI, Modality } from '@google/genai';
import { DRAW_TOOLS } from '../tools.js';
import { SYSTEM_PROMPT } from '../systemPrompt.js';

/**
 * Peels complete sentences off the front of a growing transcription
 * buffer. Gemini's transcription stream sends fragments like "The" then
 * " area of" then " a square" — this accumulates them and only releases
 * text once it hits a `.`/`!`/`?` followed by whitespace (or end of
 * buffer), leaving any trailing partial sentence for the next chunk to
 * complete. Deliberately simple (no abbreviation handling like "Mr." or
 * "3.14") — good enough for spoken tutoring language, and a false split
 * just means one sentence briefly showed as two, not a lost word.
 */
function extractCompleteSentences(buffer) {
  const sentences = [];
  let remainder = buffer;
  const sentenceEnd = /^([^.!?]*[.!?]+)(?:\s+|$)/;

  let match = sentenceEnd.exec(remainder);
  while (match) {
    const sentence = match[1].trim();
    if (sentence) sentences.push(sentence);
    remainder = remainder.slice(match[0].length);
    match = sentenceEnd.exec(remainder);
  }

  return { sentences, remainder };
}

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
    // Gemini streams transcription as small incremental fragments (partial
    // words, not sentences) — these buffer per-speaker and only reach
    // onTranscript() once a full sentence is detected, so the frontend
    // gets readable sentence-at-a-time captions instead of a word flicker.
    const sentenceBuffers = { student: '', ai: '' };

    function appendToSentenceBuffer(who, textChunk) {
      sentenceBuffers[who] += textChunk;
      const { sentences, remainder } = extractCompleteSentences(sentenceBuffers[who]);
      sentenceBuffers[who] = remainder;
      for (const sentence of sentences) onTranscript?.(who, sentence);
    }

    function flushSentenceBuffer(who) {
      const leftover = sentenceBuffers[who].trim();
      sentenceBuffers[who] = '';
      if (leftover) onTranscript?.(who, leftover);
    }

    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
    };

    const geminiSession = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {},
        onmessage: (message) => {
          try {
            handleMessage(message);
          } catch (err) {
            onError?.(err);
          }
        },
        onerror: (e) => onError?.(new Error(e?.message || 'Gemini Live error')),
        onclose: (e) => {
          flushSentenceBuffer('ai');
          flushSentenceBuffer('student');
          onClose?.(e?.reason || 'closed');
        },
      },
    });

    function handleMessage(message) {
      const content = message.serverContent;

      // Fires when the student's speech interrupted the AI mid-response
      // (native barge-in detection). Flush whatever the AI actually got
      // out before being cut off — the student did hear those words.
      if (content?.interrupted) {
        flushSentenceBuffer('ai');
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
        appendToSentenceBuffer('student', content.inputTranscription.text);
      }
      if (content?.outputTranscription?.text) {
        appendToSentenceBuffer('ai', content.outputTranscription.text);
      }

      // The model may speak several sentences in one turn — turnComplete
      // only fires once at the very end. This just catches whatever
      // trailing partial text didn't end in terminal punctuation.
      if (content?.turnComplete) {
        flushSentenceBuffer('ai');
        flushSentenceBuffer('student');
      }

      if (message.toolCall?.functionCalls) {
        for (const fc of message.toolCall.functionCalls) {
          onToolCall?.({ id: fc.id, name: fc.name, args: fc.args || {} });
        }
      }

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