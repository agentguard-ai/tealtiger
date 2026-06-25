'use strict';

const { createServer } = require('node:http');
const { createReadStream, mkdirSync } = require('node:fs');
const { stat } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { dirname, extname, join, normalize, resolve, sep } = require('node:path');
const { homedir } = require('node:os');
const { createClient } = require('@libsql/client');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { validatePolicyFile } = require('./policy-validator');

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_DB_PATH = '~/.tealtiger/events.db';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ROWS = 1000;
const HISTORY_LIMIT = 10000;

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    printRootHelp();
    return;
  }

  if (command === 'validate') {
    const exitCode = runPolicyValidation(rest);
    process.exitCode = exitCode;
    return;
  }

  if (command !== 'dashboard') {
    throw new CliError(`Unknown command "${command}". Run "tealtiger --help" for usage.`, 1);
  }

  const options = parseDashboardArgs(rest);
  if (options.help) {
    printDashboardHelp();
    return;
  }

  await runDashboard(options);
}

function runPolicyValidation(argv) {
  const [policyFile, ...extra] = argv;

  if (!policyFile || policyFile === '--help' || policyFile === '-h') {
    printValidateHelp();
    return policyFile ? 0 : 1;
  }

  if (extra.length > 0) {
    throw new CliError('validate accepts exactly one policy file path.');
  }

  return validatePolicyFile(policyFile);
}

function parseDashboardArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    open: true,
    db: DEFAULT_DB_PATH,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--no-open') {
      options.open = false;
      continue;
    }

    if (arg === '--port') {
      const value = readFlagValue(argv, index, '--port');
      options.port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      options.port = parsePort(arg.slice('--port='.length));
      continue;
    }

    if (arg === '--db') {
      options.db = readFlagValue(argv, index, '--db');
      index += 1;
      continue;
    }

    if (arg.startsWith('--db=')) {
      options.db = arg.slice('--db='.length);
      if (!options.db) {
        throw new CliError('--db requires a database path.');
      }
      continue;
    }

    throw new CliError(`Unknown dashboard option "${arg}". Run "tealtiger dashboard --help" for usage.`);
  }

  return options;
}

async function runDashboard(options) {
  const rootDir = resolve(__dirname, '..');
  const host = DEFAULT_HOST;
  const dashboardUrl = `http://localhost:${options.port}`;
  const wsUrl = `ws://localhost:${options.port}/ws/events`;
  const database = resolveDatabasePath(options.db);
  let client = null;
  let poller = null;
  let server = null;

  console.log('TealTiger Dashboard starting...');

  try {
    const connection = await openEventStore(database.url);
    client = connection.client;

    const staticRoot = await buildDashboardAssets(rootDir, wsUrl);
    const stream = new DashboardEventStream();
    poller = new EventStorePoller(client, stream);
    await poller.start();

    server = createDashboardServer({ staticRoot, stream, database });
    await listen(server.httpServer, options.port, host);

    console.log(`Dashboard: ${dashboardUrl}`);
    console.log(`Connected to event store: ${database.displayPath}`);
    console.log(`WebSocket: ${wsUrl}`);
    if (!options.open) {
      console.log('Browser auto-open disabled.');
    } else {
      openBrowser(dashboardUrl);
    }
    console.log('Press Ctrl+C to stop.');

    await waitForShutdown();
  } catch (error) {
    if (isAddressInUse(error)) {
      throw new CliError(
        `Port ${options.port} is already in use. Re-run with --port <available-port>.`,
        1,
      );
    }
    throw error;
  } finally {
    if (poller) {
      await poller.stop();
    }
    if (server) {
      await server.close();
    }
    if (client) {
      client.close();
    }
  }
}

function createDashboardServer({ staticRoot, stream, database }) {
  const httpServer = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');

    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/v1/health')) {
      sendJson(response, 200, {
        status: 'ok',
        service: 'tealtiger-dashboard',
        database: 'connected',
        database_path: database.displayPath,
        metrics: stream.metrics(),
      });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'method_not_allowed' });
      return;
    }

    await serveStaticFile(staticRoot, url.pathname, request.method === 'HEAD', response);
  });

  const wsServer = new WebSocketServer({ server: httpServer, path: '/ws/events' });
  wsServer.on('error', () => {
    // The HTTP server owns startup error handling; keep ws from rethrowing bind errors.
  });
  stream.attach(wsServer);

  return {
    httpServer,
    close: async () => {
      stream.close();
      await closeWebSocketServer(wsServer);
      await closeHttpServer(httpServer);
    },
  };
}

class DashboardEventStream {
  constructor(historyLimit = HISTORY_LIMIT) {
    this.historyLimit = historyLimit;
    this.history = [];
    this.sequence = 0;
    this.published = 0;
    this.clients = new Set();
    this.heartbeat = null;
  }

  attach(wsServer) {
    wsServer.on('connection', (socket, request) => {
      this.clients.add(socket);
      const url = new URL(request.url || '/', 'http://localhost');
      socket.send(JSON.stringify(controlMessage('connection_ack', {
        cursor: this.latestCursor(),
      })));

      this.replay(socket, url.searchParams.get('cursor'));

      socket.on('message', (payload) => {
        const message = parseJson(payload.toString(), null);
        if (!message || message.type !== 'subscribe') {
          return;
        }
        socket.send(JSON.stringify(controlMessage('subscription_updated', { ok: true })));
      });
      socket.on('close', () => this.clients.delete(socket));
      socket.on('error', () => this.clients.delete(socket));
    });

    this.heartbeat = setInterval(() => {
      const message = JSON.stringify(controlMessage('heartbeat', {
        cursor: this.latestCursor(),
      }));
      for (const socket of this.clients) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }
    }, 30000);
    this.heartbeat.unref();
  }

  publish(receipt, options = {}) {
    const sequence = ++this.sequence;
    const message = {
      type: 'governance_event',
      id: options.id || receipt.event_id || `evt_${sequence}`,
      cursor: String(sequence),
      timestamp: normalizeTimestamp(options.timestamp || receipt.timestamp || Date.now()),
      data: receipt,
    };

    this.published += 1;
    this.history.push({ sequence, message });
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    const payload = JSON.stringify(message);
    for (const socket of this.clients) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }

    return message;
  }

  replay(socket, cursor) {
    const parsedCursor = parseCursor(cursor);
    const events = parsedCursor === null
      ? this.history
      : this.history.filter((event) => event.sequence > parsedCursor);

    for (const event of events) {
      socket.send(JSON.stringify(event.message));
    }
    socket.send(JSON.stringify(controlMessage('replay_complete', {
      cursor: this.latestCursor(),
      replayed: events.length,
    })));
  }

  latestCursor() {
    return String(this.sequence);
  }

  metrics() {
    return {
      published: this.published,
      retained: this.history.length,
      subscribers: this.clients.size,
    };
  }

  close() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    for (const socket of this.clients) {
      socket.close();
    }
    this.clients.clear();
  }
}

class EventStorePoller {
  constructor(client, stream, intervalMs = POLL_INTERVAL_MS) {
    this.client = client;
    this.stream = stream;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.lastTimestamp = 0;
    this.lastId = '';
  }

  async start() {
    await this.poll();
    this.timer = setInterval(() => {
      this.poll().catch((error) => {
        console.warn(`Event store polling failed: ${error.message}`);
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    const result = await this.client.execute({
      sql: `
        SELECT
          id,
          timestamp,
          agent_id,
          agent_name,
          decision,
          tool,
          provider,
          model,
          cost_usd,
          severity,
          reason,
          framework,
          receipt_json,
          metadata_json
        FROM governance_events
        WHERE timestamp > ? OR (timestamp = ? AND id > ?)
        ORDER BY timestamp ASC, id ASC
        LIMIT ?
      `,
      args: [this.lastTimestamp, this.lastTimestamp, this.lastId, MAX_POLL_ROWS],
    });

    for (const row of result.rows) {
      const id = String(row.id || '');
      if (!id) {
        continue;
      }

      const timestamp = Number(row.timestamp || 0);
      this.lastTimestamp = timestamp;
      this.lastId = id;
      this.stream.publish(rowToReceipt(row), {
        id,
        timestamp,
      });
    }
  }
}

async function openEventStore(databaseUrl) {
  ensureDatabaseDirectory(databaseUrl);
  const client = createClient({ url: databaseUrl });
  await initializeEventStore(client);
  return { client };
}

function ensureDatabaseDirectory(databaseUrl) {
  if (!databaseUrl.startsWith('file:') || databaseUrl === 'file::memory:') {
    return;
  }

  const filePath = databaseUrl.replace(/^file:/, '');
  if (!filePath || filePath.startsWith(':')) {
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
}

async function initializeEventStore(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS governance_events (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT,
      decision TEXT NOT NULL,
      tool TEXT,
      provider TEXT,
      model TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      severity TEXT,
      reason TEXT NOT NULL,
      framework TEXT,
      receipt_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON governance_events(timestamp)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_agent ON governance_events(agent_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_events_decision ON governance_events(decision)');
}

async function buildDashboardAssets(rootDir, wsUrl) {
  const dashboardRoot = join(rootDir, 'dashboard', 'governance-feed');
  const configFile = join(dashboardRoot, 'vite.config.ts');
  const outDir = join(rootDir, 'dist', 'governance-feed');
  const vite = await import('vite');
  const previousWsUrl = process.env.VITE_GOVERNANCE_WS_URL;

  process.env.VITE_GOVERNANCE_WS_URL = wsUrl;
  console.log('Building dashboard assets...');
  try {
    await vite.build({
      configFile,
      root: dashboardRoot,
      logLevel: 'warn',
      build: {
        outDir,
        emptyOutDir: true,
      },
    });
  } finally {
    if (previousWsUrl === undefined) {
      delete process.env.VITE_GOVERNANCE_WS_URL;
    } else {
      process.env.VITE_GOVERNANCE_WS_URL = previousWsUrl;
    }
  }

  return outDir;
}

async function serveStaticFile(staticRoot, pathname, headOnly, response) {
  const safePath = safeStaticPath(staticRoot, pathname);
  const filePath = await resolveStaticFile(staticRoot, safePath);

  if (!filePath) {
    sendJson(response, 404, { error: 'not_found', message: 'Dashboard asset not found' });
    return;
  }

  const fileStat = await stat(filePath);
  response.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Content-Length': fileStat.size,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  if (headOnly) {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function resolveStaticFile(staticRoot, safePath) {
  const directPath = safePath === staticRoot ? join(staticRoot, 'index.html') : safePath;
  if (await isFile(directPath)) {
    return directPath;
  }

  const indexPath = join(staticRoot, 'index.html');
  return await isFile(indexPath) ? indexPath : null;
}

function safeStaticPath(staticRoot, pathname) {
  const decoded = decodeURIComponent(pathname);
  const requested = normalize(join(staticRoot, decoded));
  const rootWithSeparator = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`;

  if (requested !== staticRoot && !requested.startsWith(rootWithSeparator)) {
    return join(staticRoot, 'index.html');
  }

  return requested;
}

async function isFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function resolveDatabasePath(rawPath, homeDirectory = homedir()) {
  const input = rawPath || DEFAULT_DB_PATH;
  if (input.startsWith('file:')) {
    return {
      url: input,
      displayPath: input.replace(/^file:/, ''),
    };
  }

  const expanded = input === '~'
    ? homeDirectory
    : input.startsWith(`~${sep}`) || input.startsWith('~/')
      ? join(homeDirectory, input.slice(2))
      : input;
  const absolutePath = resolve(expanded);
  mkdirSync(dirname(absolutePath), { recursive: true });

  return {
    url: `file:${absolutePath}`,
    displayPath: input === DEFAULT_DB_PATH ? DEFAULT_DB_PATH : absolutePath,
  };
}

function rowToReceipt(row) {
  const receipt = parseJson(String(row.receipt_json || '{}'), {});
  const metadata = parseJson(String(row.metadata_json || '{}'), {});
  const timestamp = normalizeTimestamp(Number(row.timestamp || Date.now()));

  return {
    ...receipt,
    event_id: String(row.id),
    timestamp,
    agent_id: String(row.agent_id),
    agent_name: nullableString(row.agent_name),
    decision: String(row.decision),
    tool: nullableString(row.tool),
    provider: nullableString(row.provider),
    model: nullableString(row.model),
    cost_usd: Number(row.cost_usd || 0),
    severity: nullableString(row.severity),
    reason: String(row.reason || receipt.reason || 'No decision reason provided'),
    framework: nullableString(row.framework),
    metadata,
  };
}

function openBrowser(url) {
  const platform = process.platform;
  const command = platform === 'darwin'
    ? 'open'
    : platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', (error) => {
    console.warn(`Unable to open browser automatically: ${error.message}`);
  });
  child.unref();
}

function waitForShutdown() {
  return new Promise((resolveShutdown) => {
    const shutdown = () => {
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      console.log('Stopping TealTiger Dashboard...');
      resolveShutdown();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

function listen(server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function closeHttpServer(server) {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
}

function closeWebSocketServer(wsServer) {
  return new Promise((resolveClose) => {
    wsServer.close(() => resolveClose());
  });
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new CliError(`${flagName} requires a value.`);
  }
  return value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliError(`Invalid port "${value}". Use a number between 1 and 65535.`);
  }
  return port;
}

function parseCursor(value) {
  if (!value) {
    return null;
  }
  const cursor = Number(value);
  return Number.isInteger(cursor) && cursor >= 0 ? cursor : null;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function nullableString(value) {
  return value === null || value === undefined ? null : String(value);
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function controlMessage(type, data) {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

function contentType(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };
  return types[extname(filePath)] || 'application/octet-stream';
}

function isAddressInUse(error) {
  return error && error.code === 'EADDRINUSE';
}

function printRootHelp() {
  console.log(`TealTiger CLI

Usage:
  tealtiger dashboard [options]
  tealtiger validate <path>

Commands:
  dashboard   Launch the local observability dashboard
  validate    Validate a TealTiger policy JSON or YAML file
`);
}

function printDashboardHelp() {
  console.log(`Launch the local TealTiger observability dashboard.

Usage:
  tealtiger dashboard [options]

Options:
  --port <port>  Port for the dashboard and WebSocket server (default: 3000)
  --db <path>    Event store database path (default: ~/.tealtiger/events.db)
  --no-open      Do not open the browser automatically
  -h, --help     Show help
`);
}

function printValidateHelp() {
  console.log(`Validate a TealTiger policy file.

Usage:
  tealtiger validate <path>

Arguments:
  <path>  Policy file to validate (.json, .yaml, or .yml)
`);
}

module.exports = {
  DEFAULT_DB_PATH,
  DEFAULT_PORT,
  CliError,
  DashboardEventStream,
  EventStorePoller,
  createDashboardServer,
  main,
  openEventStore,
  parseDashboardArgs,
  parsePort,
  runPolicyValidation,
  resolveDatabasePath,
  rowToReceipt,
};
