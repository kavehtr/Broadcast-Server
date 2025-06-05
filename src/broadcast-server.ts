import WebSocket, { WebSocketServer } from 'ws';
import * as readline from 'readline';
import * as process from 'process';

const PORT = 8080;

// ------------------------------
// Utility: graceful shutdown
// ------------------------------
function setupGracefulShutdownServer(wss: WebSocketServer) {
  function closeAllConnections() {
    console.log('\nShutting down server...');
    // Close all client connections
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server shutting down');
      }
    });
    wss.close(() => {
      console.log('Server has closed.');
      process.exit(0);
    });
  }

  process.on('SIGINT', closeAllConnections);
  process.on('SIGTERM', closeAllConnections);
}

function setupGracefulShutdownClient(ws: WebSocket) {
  function shutdownClient() {
    console.log('\nDisconnecting client...');
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Client exit');
    }
    process.exit(0);
  }

  process.on('SIGINT', shutdownClient);
  process.on('SIGTERM', shutdownClient);
}

// ------------------------------
// Server Implementation
// ------------------------------
function startServer() {
  const wss = new WebSocketServer({ port: PORT });

  wss.on('listening', () => {
    console.log(`Broadcast server started, listening on ws://localhost:${PORT}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected. Total clients:', wss.clients.size);

    // When a message arrives from any client, broadcast to all clients
    ws.on('message', (data) => {
      const msg = data.toString();
      console.log(`Received: ${msg}`);
      // Broadcast to everyone (including the sender)
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    });

    ws.on('close', () => {
      console.log('Client disconnected. Total clients:', wss.clients.size - 1);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  wss.on('error', (err) => {
    console.error('Server error:', err);
  });

  setupGracefulShutdownServer(wss);
}

// ------------------------------
// Client Implementation
// ------------------------------
function startClient() {
  const address = `ws://localhost:${PORT}`;
  const ws = new WebSocket(address);

  ws.on('open', () => {
    console.log(`Connected to server at ${address}. Type messages and hit Enter to send.`);
    // Set up readline to read lines from stdin
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', (line: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(line);
      } else {
        console.log('Connection is not open. Unable to send message.');
      }
    });
  });

  ws.on('message', (data) => {
    // Print any broadcasted message to the console
    console.log(`> ${data.toString()}`);
  });

  ws.on('close', (code, reason) => {
    console.log(`Disconnected from server (code: ${code}, reason: ${reason.toString()})`);
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  setupGracefulShutdownClient(ws);
}

// ------------------------------
// Entry Point: parse CLI args
// ------------------------------
const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.error('Usage: broadcast-server <start|connect>');
  process.exit(1);
}

const command = argv[0].toLowerCase();
if (command === 'start') {
  startServer();
} else if (command === 'connect') {
  startClient();
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: broadcast-server <start|connect>');
  process.exit(1);
}
