/*
 * DroneNav Bridge — bridge.js
 * Run: node bridge.js
 * Requires: npm install ws node-fetch
 *
 * What this does:
 *   - Polls ESP32 http://192.168.4.1/telemetry every 200ms
 *   - Sends heartbeat ping to ESP32 every 2s (keeps RTH watchdog alive)
 *   - Hosts WebSocket server at ws://localhost:8765
 *   - Broadcasts telemetry JSON to all connected dashboard clients
 *   - Forwards commands from dashboard to ESP32 via POST /command
 */

const { WebSocketServer, WebSocket } = require('ws');
const fetch = require('node-fetch');

const ESP32_IP   = 'http://192.168.4.1';
const WS_PORT    = 8765;
const POLL_MS    = 200;
const PING_MS    = 2000;

const wss = new WebSocketServer({ port: WS_PORT });
let clients = new Set();
let esp32Reachable = false;

console.log('================================================');
console.log(' DroneNav Bridge v4.0');
console.log('================================================');
console.log(`WebSocket server: ws://localhost:${WS_PORT}`);
console.log(`ESP32 target:     ${ESP32_IP}`);
console.log('Waiting for dashboard connection...');
console.log('');
console.log('STEPS:');
console.log('  1. Connect laptop WiFi to "DroneNav-AP" (password: drone1234)');
console.log('  2. Open index.html in your browser');
console.log('  3. Dashboard will auto-connect to ws://localhost:8765');
console.log('================================================\n');

// ── WebSocket server ─────────────────────────────────────────
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Dashboard connected. Total clients: ${clients.size}`);

  // Send current status immediately on connect
  ws.send(JSON.stringify({
    _bridge: true,
    esp32Reachable,
    ts: Date.now()
  }));

  // Handle commands from dashboard
  ws.on('message', async (data) => {
    let cmd;
    try {
      cmd = JSON.parse(data.toString());
    } catch (e) {
      ws.send(JSON.stringify({ error: 'bad_json', ts: Date.now() }));
      return;
    }

    console.log(`[CMD] Received: ${JSON.stringify(cmd)}`);

    try {
      const res = await fetch(`${ESP32_IP}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
        timeout: 3000
      });
      const text = await res.text();
      console.log(`[CMD] ESP32 response: ${text}`);
      ws.send(JSON.stringify({ _cmdResponse: true, status: res.status, body: text, ts: Date.now() }));
    } catch (err) {
      console.log(`[CMD] Failed to reach ESP32: ${err.message}`);
      ws.send(JSON.stringify({ _cmdResponse: true, error: 'esp32_unreachable', ts: Date.now() }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Dashboard disconnected. Total clients: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.log(`[WS] Client error: ${err.message}`);
    clients.delete(ws);
  });
});

// ── Broadcast to all connected clients ───────────────────────
function broadcast(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  }
}

// ── Telemetry polling loop ────────────────────────────────────
async function pollTelemetry() {
  try {
    const res = await fetch(`${ESP32_IP}/telemetry`, { timeout: 500 });
    if (res.ok) {
      const text = await res.text();
      esp32Reachable = true;
      broadcast(text);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    esp32Reachable = false;
    broadcast(JSON.stringify({ error: 'esp32_unreachable', ts: Date.now() }));
  }
}

// ── Heartbeat ping (keeps drone RTH watchdog alive) ──────────
async function sendPing() {
  try {
    await fetch(`${ESP32_IP}/ping`, { timeout: 1000 });
    if (!esp32Reachable) {
      console.log('[PING] ESP32 back online');
    }
    esp32Reachable = true;
  } catch (err) {
    if (esp32Reachable) {
      console.log('[PING] ESP32 unreachable — drone will RTH in 5s if flying');
    }
    esp32Reachable = false;
  }
}

// ── Start loops ───────────────────────────────────────────────
setInterval(pollTelemetry, POLL_MS);
setInterval(sendPing, PING_MS);

// Initial poll immediately
pollTelemetry();

// ── Graceful shutdown ─────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[BRIDGE] Shutting down...');
  console.log('[BRIDGE] WARNING: Drone heartbeat will stop. If flying, drone will RTH in 5s.');
  wss.close(() => process.exit(0));
});
