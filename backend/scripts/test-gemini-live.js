/**
 * Standalone sanity check — confirms your GEMINI_API_KEY can open a Live
 * API session AND that function calling works, before we build the full
 * relay on top of it. No browser needed — just this model's real output
 * (audio) plus a text transcript of it, over the same Live connection
 * type the real app uses.
 *
 * Run: npm run test:gemini   (from backend/, after `cp .env.example .env`
 * and filling in GEMINI_API_KEY)
 */
import 'dotenv/config';
import { GoogleGenAI, Modality } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

console.log('key length:', apiKey.length, 'starts with:', apiKey.slice(0, 6), 'ends with:', apiKey.slice(-4));

const ai = new GoogleGenAI({ apiKey });

const draw_shape = {
  name: 'draw_shape',
  description: 'Draw a basic shape on a whiteboard.',
  parameters: {
    type: 'object',
    properties: {
      shape: { type: 'string', enum: ['circle', 'rectangle', 'triangle'] },
      x: { type: 'number' },
      y: { type: 'number' },
    },
    required: ['shape', 'x', 'y'],
  },
};

async function main() {
  console.log(`Connecting to Gemini Live (${model})...`);

  const responseQueue = [];
  let toolWasCalled = false;
  let gotAudioOrText = false;

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO], // this model only supports AUDIO output, not TEXT
      outputAudioTranscription: {}, // ask for a text transcript of the audio too, so we can print something readable
      tools: [{ functionDeclarations: [draw_shape] }],
    },
    callbacks: {
      onopen: () => console.log('✓ Connected — your key has Live API access.'),
      onmessage: (message) => responseQueue.push(message),
      onerror: (e) => {
        console.error('✗ Connection error:', e.message);
        process.exit(1);
      },
      onclose: (e) => console.log('Connection closed:', e.reason || '(no reason given)'),
    },
  });

  session.sendClientContent({
    turns: 'Please call draw_shape once to draw a small circle at position 100,100, then say one short sentence about it.',
  });

  const deadline = Date.now() + 20000;
  let turnComplete = false;

  while (!turnComplete && Date.now() < deadline) {
    const message = responseQueue.shift();
    if (!message) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    if (message.toolCall?.functionCalls) {
      toolWasCalled = true;
      const functionResponses = [];
      for (const fc of message.toolCall.functionCalls) {
        console.log(`✓ Tool call received: ${fc.name}(${JSON.stringify(fc.args)})`);
        functionResponses.push({ id: fc.id, name: fc.name, response: { result: { ok: true } } });
      }
      session.sendToolResponse({ functionResponses });
    }

    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          gotAudioOrText = true;
          console.log(`✓ Received audio chunk (${part.inlineData.data.length} base64 chars)`);
        }
        if (part.text) {
          gotAudioOrText = true;
          console.log('✓ Model said:', part.text);
        }
      }
    }

    if (message.serverContent?.outputTranscription?.text) {
      console.log('✓ Transcript:', message.serverContent.outputTranscription.text);
    }

    if (message.serverContent?.turnComplete) {
      turnComplete = true;
    }
  }

  session.close();

  console.log('\n--- Result ---');
  console.log('Live session opened:', true);
  console.log('Tool calling worked:', toolWasCalled);
  console.log('Got audio/transcript back:', gotAudioOrText);

  if (toolWasCalled && gotAudioOrText) {
    console.log('\n✅ Your key is good to go for the full backend.');
  } else {
    console.log('\n⚠️  Connected, but did not see both a tool call and audio — rerun, or check the model name / tool schema.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Failed:', err.message);
  process.exit(1);
});