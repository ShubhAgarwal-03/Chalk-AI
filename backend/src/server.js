import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { handleConnection } from './wsRelay.js';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('[chalk] student connected');
  handleConnection(ws);
  ws.on('close', () => console.log('[chalk] student disconnected'));
});

console.log(`[chalk] relay server listening on ws://localhost:${PORT}`);