/**
 * Automaker Backend Server
 *
 * Provides HTTP/WebSocket API for both web and Electron modes.
 * In Electron mode, this server runs locally.
 * In web mode, this server runs on a remote host.
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { createLogger } from '@automaker/utils';

const logger = createLogger('Server');

import { createEventEmitter, type EventEmitter } from './lib/events.js';
import { initAllowedPaths } from '@automaker/platform';
import { authMiddleware, getAuthStatus } from './lib/auth.js';
import { createFsRoutes } from './routes/fs/index.js';
import { createHealthRoutes } from './routes/health/index.js';
import { createAgentRoutes } from './routes/agent/index.js';
import { createSessionsRoutes } from './routes/sessions/index.js';
import { createFeaturesRoutes } from './routes/features/index.js';
import { createAutoModeRoutes } from './routes/auto-mode/index.js';
import { createEnhancePromptRoutes } from './routes/enhance-prompt/index.js';
import { createWorktreeRoutes } from './routes/worktree/index.js';
import { createGitRoutes } from './routes/git/index.js';
import { createSetupRoutes } from './routes/setup/index.js';
import { createSuggestionsRoutes } from './routes/suggestions/index.js';
import { createModelsRoutes } from './routes/models/index.js';
import { createRunningAgentsRoutes } from './routes/running-agents/index.js';
import { createWorkspaceRoutes } from './routes/workspace/index.js';
import { createTemplatesRoutes } from './routes/templates/index.js';
import {
  createTerminalRoutes,
  validateTerminalToken,
  isTerminalEnabled,
  isTerminalPasswordRequired,
} from './routes/terminal/index.js';
import { createSettingsRoutes } from './routes/settings/index.js';
import { AgentService } from './services/agent-service.js';
import { FeatureLoader } from './services/feature-loader.js';
import { AutoModeService } from './services/auto-mode-service.js';
import { getTerminalService } from './services/terminal-service.js';
import { SettingsService } from './services/settings-service.js';
import { createSpecRegenerationRoutes } from './routes/app-spec/index.js';
import { createClaudeRoutes } from './routes/claude/index.js';
import { ClaudeUsageService } from './services/claude-usage-service.js';
import { createGitHubRoutes } from './routes/github/index.js';
import { createContextRoutes } from './routes/context/index.js';
import { createBacklogPlanRoutes } from './routes/backlog-plan/index.js';
import { cleanupStaleValidations } from './routes/github/routes/validation-common.js';
import { createMCPRoutes } from './routes/mcp/index.js';
import { MCPTestService } from './services/mcp-test-service.js';
import { createPipelineRoutes } from './routes/pipeline/index.js';
import { pipelineService } from './services/pipeline-service.js';
import { getServerConfig } from './config/env.js';

// Load environment variables
dotenv.config();

// Load centralized configuration
const config = getServerConfig();

const PORT = config.port;
const DATA_DIR = config.dataDir;
const ENABLE_REQUEST_LOGGING = config.enableRequestLogging;

// Check for required environment variables
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (!hasAnthropicKey) {
  logger.warn(`
╔═══════════════════════════════════════════════════════════════════════╗
║  ⚠️  WARNING: No Claude authentication configured                      ║
║                                                                       ║
║  The Claude Agent SDK requires authentication to function.            ║
║                                                                       ║
║  Set your Anthropic API key:                                          ║
║    export ANTHROPIC_API_KEY="sk-ant-..."                              ║
║                                                                       ║
║  Or use the setup wizard in Settings to configure authentication.     ║
╚═══════════════════════════════════════════════════════════════════════╝
`);
} else {
  logger.info('[Server] ✓ ANTHROPIC_API_KEY detected (API key auth)');
}

// Initialize security
initAllowedPaths();

// Create Express app
const app = express();

// Middleware
// Custom colored logger showing only endpoint and status code (configurable via ENABLE_REQUEST_LOGGING env var)
if (ENABLE_REQUEST_LOGGING) {
  morgan.token('status-colored', (req, res) => {
    const status = res.statusCode;
    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // Red for server errors
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // Yellow for client errors
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // Cyan for redirects
    return `\x1b[32m${status}\x1b[0m`; // Green for success
  });

  app.use(
    morgan(':method :url :status-colored', {
      skip: (req) => req.url === '/api/health', // Skip health check logs
    })
  );
}
// SECURITY: Restrict CORS to localhost UI origins to prevent drive-by attacks
// from malicious websites. MCP server endpoints can execute arbitrary commands,
// so allowing any origin would enable RCE from any website visited while Automaker runs.
const DEFAULT_CORS_ORIGINS = ['http://localhost:3007', 'http://127.0.0.1:3007'];

// SECURITY: Validate CORS_ORIGIN against whitelist
// Only allow localhost origins to prevent CORS bypass attacks
function validateCorsOrigin(origin: string | string[] | undefined): string | string[] {
  if (!origin) {
    return DEFAULT_CORS_ORIGINS;
  }

  // Normalize to array
  const origins = Array.isArray(origin) ? origin : [origin];

  // Whitelist: only allow localhost/127.0.0.1 origins
  const ALLOWED_PATTERNS = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/\[::1\](:\d+)?$/, // IPv6 localhost
  ];

  const validOrigins = origins.filter((o) => {
    const matches = ALLOWED_PATTERNS.some((pattern) => pattern.test(o));
    if (!matches) {
      logger.warn(`[Security] Rejecting invalid CORS origin: ${o}`);
    }
    return matches;
  });

  if (validOrigins.length === 0) {
    logger.warn('[Security] No valid CORS origins found in CORS_ORIGIN env var, using defaults');
    return DEFAULT_CORS_ORIGINS;
  }

  return validOrigins.length === 1 ? validOrigins[0] : validOrigins;
}

const corsOrigin = validateCorsOrigin(process.env.CORS_ORIGIN);
logger.info('[Security] CORS origins configured:', corsOrigin);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));

// SECURITY: Rate limiting to prevent abuse
// General rate limit for all API endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// Stricter rate limit for agent/AI endpoints (expensive operations)
const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 agent requests per 15 minutes
  message: 'Too many AI agent requests. Please wait before starting new conversations.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use('/api/', generalLimiter);

// Create shared event emitter for streaming
const events: EventEmitter = createEventEmitter();

// Create services
// Note: settingsService is created first so it can be injected into other services
const settingsService = new SettingsService(DATA_DIR);
const agentService = new AgentService(DATA_DIR, events, settingsService);
const featureLoader = new FeatureLoader();
const autoModeService = new AutoModeService(events, settingsService);
const claudeUsageService = new ClaudeUsageService();
const mcpTestService = new MCPTestService(settingsService);

// Initialize services
(async () => {
  await agentService.initialize();
  logger.info('[Server] Agent service initialized');
})();

// Run stale validation cleanup every hour to prevent memory leaks from crashed validations
const VALIDATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  const cleaned = cleanupStaleValidations();
  if (cleaned > 0) {
    logger.info(`[Server] Cleaned up ${cleaned} stale validation entries`);
  }
}, VALIDATION_CLEANUP_INTERVAL_MS);

// Mount API routes - health is unauthenticated for monitoring
app.use('/api/health', createHealthRoutes());

// Apply authentication to all other routes
app.use('/api', authMiddleware);

app.use('/api/fs', createFsRoutes(events));
// Apply stricter rate limiting to AI agent endpoints
app.use('/api/agent', agentLimiter, createAgentRoutes(agentService, events));
app.use('/api/sessions', createSessionsRoutes(agentService));
app.use('/api/features', createFeaturesRoutes(featureLoader));
// Apply stricter rate limiting to auto-mode (uses AI agent internally)
app.use('/api/auto-mode', agentLimiter, createAutoModeRoutes(autoModeService));
// Apply stricter rate limiting to AI-powered endpoints
app.use('/api/enhance-prompt', agentLimiter, createEnhancePromptRoutes());
app.use('/api/worktree', createWorktreeRoutes());
app.use('/api/git', createGitRoutes());
app.use('/api/setup', createSetupRoutes());
app.use('/api/suggestions', agentLimiter, createSuggestionsRoutes(events, settingsService));
app.use('/api/models', createModelsRoutes());
app.use(
  '/api/spec-regeneration',
  agentLimiter,
  createSpecRegenerationRoutes(events, settingsService)
);
app.use('/api/running-agents', createRunningAgentsRoutes(autoModeService));
app.use('/api/workspace', createWorkspaceRoutes());
app.use('/api/templates', createTemplatesRoutes());
app.use('/api/terminal', createTerminalRoutes());
app.use('/api/settings', createSettingsRoutes(settingsService));
app.use('/api/claude', createClaudeRoutes(claudeUsageService));
app.use('/api/github', createGitHubRoutes(events, settingsService));
app.use('/api/context', createContextRoutes(settingsService));
// Apply stricter rate limiting to AI-powered backlog planning
app.use('/api/backlog-plan', agentLimiter, createBacklogPlanRoutes(events, settingsService));
app.use('/api/mcp', createMCPRoutes(mcpTestService));
app.use('/api/pipeline', createPipelineRoutes(pipelineService));

// Create HTTP server
const server = createServer(app);

// WebSocket servers using noServer mode for proper multi-path support
const wss = new WebSocketServer({ noServer: true });
const terminalWss = new WebSocketServer({ noServer: true });
const terminalService = getTerminalService();

// Handle HTTP upgrade requests manually to route to correct WebSocket server
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);

  if (pathname === '/api/events') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/terminal/ws') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Events WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  logger.info('[WebSocket] Client connected, ready state:', ws.readyState);

  // Track if already unsubscribed to prevent double-cleanup
  let hasUnsubscribed = false;
  const safeUnsubscribe = () => {
    if (!hasUnsubscribed) {
      hasUnsubscribed = true;
      unsubscribe();
    }
  };

  // Subscribe to all events and forward to this client
  const unsubscribe = events.subscribe((type, payload) => {
    logger.info('[WebSocket] Event received:', {
      type,
      hasPayload: !!payload,
      payloadKeys: payload ? Object.keys(payload) : [],
      wsReadyState: ws.readyState,
      wsOpen: ws.readyState === WebSocket.OPEN,
    });

    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type, payload });
        logger.info('[WebSocket] Sending event to client:', {
          type,
          messageLength: message.length,
          sessionId: (payload as any)?.sessionId,
        });
        ws.send(message);
      } catch (error) {
        logger.error('[WebSocket] ERROR sending message:', error);
        // Clean up subscription if send fails
        safeUnsubscribe();
        // Close the connection on send error
        ws.close();
      }
    } else {
      logger.info(
        '[WebSocket] WARNING: Cannot send event, WebSocket not open. ReadyState:',
        ws.readyState
      );
      // If WebSocket is not open, clean up subscription
      safeUnsubscribe();
    }
  });

  ws.on('close', () => {
    logger.info('[WebSocket] Client disconnected');
    safeUnsubscribe();
  });

  ws.on('error', (error) => {
    logger.error('[WebSocket] ERROR:', error);
    safeUnsubscribe();
  });
});

// Track WebSocket connections per session
const terminalConnections: Map<string, Set<WebSocket>> = new Map();
// Track last resize dimensions per session to deduplicate resize messages
const lastResizeDimensions: Map<string, { cols: number; rows: number }> = new Map();
// Track last resize timestamp to rate-limit resize operations (prevents resize storm)
const lastResizeTime: Map<string, number> = new Map();
const RESIZE_MIN_INTERVAL_MS = 100; // Minimum 100ms between resize operations

// Clean up resize tracking when sessions actually exit (not just when connections close)
terminalService.onExit((sessionId) => {
  lastResizeDimensions.delete(sessionId);
  lastResizeTime.delete(sessionId);
  terminalConnections.delete(sessionId);
});

// Terminal WebSocket connection handler
terminalWss.on('connection', (ws: WebSocket, req: import('http').IncomingMessage) => {
  // Parse URL to get session ID and token
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const token = url.searchParams.get('token');

  logger.info(`[Terminal WS] Connection attempt for session: ${sessionId}`);

  // Check if terminal is enabled
  if (!isTerminalEnabled()) {
    logger.info('[Terminal WS] Terminal is disabled');
    ws.close(4003, 'Terminal access is disabled');
    return;
  }

  // Validate token if password is required
  if (isTerminalPasswordRequired() && !validateTerminalToken(token || undefined)) {
    logger.info('[Terminal WS] Invalid or missing token');
    ws.close(4001, 'Authentication required');
    return;
  }

  if (!sessionId) {
    logger.info('[Terminal WS] No session ID provided');
    ws.close(4002, 'Session ID required');
    return;
  }

  // Check if session exists
  const session = terminalService.getSession(sessionId);
  if (!session) {
    logger.info(`[Terminal WS] Session ${sessionId} not found`);
    ws.close(4004, 'Session not found');
    return;
  }

  logger.info(`[Terminal WS] Client connected to session ${sessionId}`);

  // Track this connection
  if (!terminalConnections.has(sessionId)) {
    terminalConnections.set(sessionId, new Set());
  }
  terminalConnections.get(sessionId)!.add(ws);

  // Send initial connection success FIRST
  ws.send(
    JSON.stringify({
      type: 'connected',
      sessionId,
      shell: session.shell,
      cwd: session.cwd,
    })
  );

  // Send scrollback buffer BEFORE subscribing to prevent race condition
  // Also clear pending output buffer to prevent duplicates from throttled flush
  const scrollback = terminalService.getScrollbackAndClearPending(sessionId);
  if (scrollback && scrollback.length > 0) {
    ws.send(
      JSON.stringify({
        type: 'scrollback',
        data: scrollback,
      })
    );
  }

  // NOW subscribe to terminal data (after scrollback is sent)
  const unsubscribeData = terminalService.onData((sid, data) => {
    if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data }));
    }
  });

  // Subscribe to terminal exit
  const unsubscribeExit = terminalService.onExit((sid, exitCode) => {
    if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', exitCode }));
      ws.close(1000, 'Session ended');
    }
  });

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'input':
          // Validate input data type and length
          if (typeof msg.data !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid input type' }));
            break;
          }
          // Limit input size to 1MB to prevent memory issues
          if (msg.data.length > 1024 * 1024) {
            ws.send(JSON.stringify({ type: 'error', message: 'Input too large' }));
            break;
          }
          // Write user input to terminal
          terminalService.write(sessionId, msg.data);
          break;

        case 'resize':
          // Validate resize dimensions are positive integers within reasonable bounds
          if (
            typeof msg.cols !== 'number' ||
            typeof msg.rows !== 'number' ||
            !Number.isInteger(msg.cols) ||
            !Number.isInteger(msg.rows) ||
            msg.cols < 1 ||
            msg.cols > 1000 ||
            msg.rows < 1 ||
            msg.rows > 500
          ) {
            break; // Silently ignore invalid resize requests
          }
          // Resize terminal with deduplication and rate limiting
          if (msg.cols && msg.rows) {
            const now = Date.now();
            const lastTime = lastResizeTime.get(sessionId) || 0;
            const lastDimensions = lastResizeDimensions.get(sessionId);

            // Skip if resized too recently (prevents resize storm during splits)
            if (now - lastTime < RESIZE_MIN_INTERVAL_MS) {
              break;
            }

            // Check if dimensions are different from last resize
            if (
              !lastDimensions ||
              lastDimensions.cols !== msg.cols ||
              lastDimensions.rows !== msg.rows
            ) {
              // Only suppress output on subsequent resizes, not the first one
              // The first resize happens on terminal open and we don't want to drop the initial prompt
              const isFirstResize = !lastDimensions;
              terminalService.resize(sessionId, msg.cols, msg.rows, !isFirstResize);
              lastResizeDimensions.set(sessionId, {
                cols: msg.cols,
                rows: msg.rows,
              });
              lastResizeTime.set(sessionId, now);
            }
          }
          break;

        case 'ping':
          // Respond to ping
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          logger.warn(`[Terminal WS] Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      logger.error('[Terminal WS] Error processing message:', error);
    }
  });

  ws.on('close', () => {
    logger.info(`[Terminal WS] Client disconnected from session ${sessionId}`);
    unsubscribeData();
    unsubscribeExit();

    // Remove from connections tracking
    const connections = terminalConnections.get(sessionId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        terminalConnections.delete(sessionId);
        // DON'T delete lastResizeDimensions/lastResizeTime here!
        // The session still exists, and reconnecting clients need to know
        // this isn't the "first resize" to prevent duplicate prompts.
        // These get cleaned up when the session actually exits.
      }
    }
  });

  ws.on('error', (error) => {
    logger.error(`[Terminal WS] Error on session ${sessionId}:`, error);
    unsubscribeData();
    unsubscribeExit();
  });
});

// Start server with error handling for port conflicts
const startServer = (port: number) => {
  server.listen(port, () => {
    const terminalStatus = isTerminalEnabled()
      ? isTerminalPasswordRequired()
        ? 'enabled (password protected)'
        : 'enabled'
      : 'disabled';
    const portStr = port.toString().padEnd(4);
    logger.info(`
╔═══════════════════════════════════════════════════════╗
║           Automaker Backend Server                    ║
╠═══════════════════════════════════════════════════════╣
║  HTTP API:    http://localhost:${portStr}                 ║
║  WebSocket:   ws://localhost:${portStr}/api/events        ║
║  Terminal:    ws://localhost:${portStr}/api/terminal/ws   ║
║  Health:      http://localhost:${portStr}/api/health      ║
║  Terminal:    ${terminalStatus.padEnd(37)}║
╚═══════════════════════════════════════════════════════╝
`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`
╔═══════════════════════════════════════════════════════╗
║  ❌ ERROR: Port ${port} is already in use              ║
╠═══════════════════════════════════════════════════════╣
║  Another process is using this port.                  ║
║                                                       ║
║  To fix this, try one of:                             ║
║                                                       ║
║  1. Kill the process using the port:                  ║
║     lsof -ti:${port} | xargs kill -9                   ║
║                                                       ║
║  2. Use a different port:                             ║
║     PORT=${port + 1} npm run dev:server                ║
║                                                       ║
║  3. Use the init.sh script which handles this:        ║
║     ./init.sh                                         ║
╚═══════════════════════════════════════════════════════╝
`);
      process.exit(1);
    } else {
      logger.error('[Server] Error starting server:', error);
      process.exit(1);
    }
  });
};

startServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  terminalService.cleanup();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  terminalService.cleanup();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
