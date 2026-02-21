require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const morgan       = require('morgan');
const path         = require('path');
const http         = require('http');
const { WebSocketServer } = require('ws');

const audioRoutes   = require('./routes/audioRoutes');
const errorHandler  = require('./middleware/errorHandler');

// ─────────────────────────────────────────────────────────────
//  App & HTTP server setup
// ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);          // wrap for WebSocket support
const PORT   = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
//  MongoDB connection
// ─────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are the recommended defaults for Mongoose 8.x
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);   // fatal — nothing works without the DB
  }
};

// ─────────────────────────────────────────────────────────────
//  CORS — allow the Vite dev server and the production client
// ─────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL 
  // || 
  // 'http://localhost:5173',
  // 'http://localhost:3000',   // fallback if client runs on 3000
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow REST tools (Postman, curl) that send no Origin header
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,                           // allow cookies / auth headers
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────────────────────
//  Core middleware
// ─────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));          // parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────────────
//  Static file serving — uploaded & processed audio
//  Accessible at:  GET /uploads/<filename>
// ─────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────────────────────
//  API routes
// ─────────────────────────────────────────────────────────────
app.use('/api', audioRoutes);

// ─────────────────────────────────────────────────────────────
//  Health-check endpoint (useful for Docker / Render)
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'SoundGuard AI API',
    timestamp: new Date().toISOString(),
    mongo:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ─────────────────────────────────────────────────────────────
//  404 handler — must come AFTER all valid routes
// ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─────────────────────────────────────────────────────────────
//  Global error handler — must be the LAST app.use()
// ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────
//  WebSocket server — used for real-time processing progress
//  Frontend connects to:  ws://localhost:5000
// ─────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log(`🔌  WebSocket client connected (${req.socket.remoteAddress})`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('WS message received:', msg);
    } catch {
      console.warn('WS: non-JSON message received');
    }
  });

  ws.on('close', () => console.log('🔌  WebSocket client disconnected'));
  ws.on('error', (err) => console.error('WS error:', err.message));

  // Send a welcome ping so the client knows it's live
  ws.send(JSON.stringify({ type: 'connected', message: 'SoundGuard AI WebSocket ready' }));
});

// Helper used by controllers to broadcast progress updates to ALL clients
app.set('wss', wss);   // attach to app so controllers can reach it via req.app.get('wss')

// ─────────────────────────────────────────────────────────────
//  Boot sequence
// ─────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log('');
    console.log('🎵  ─────────────────────────────────────────');
    console.log(`🎵   SoundGuard AI API  →  http://localhost:${PORT}`);
    console.log(`🎵   Health check       →  http://localhost:${PORT}/health`);
    console.log(`🎵   Python service     →  ${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}`);
    console.log(`🎵   Allowed origin     →  ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log('🎵  ─────────────────────────────────────────');
    console.log('');
  });
};

// ─────────────────────────────────────────────────────────────
//  Graceful shutdown
// ─────────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n⚠️   Received ${signal}. Shutting down gracefully…`);
  await mongoose.connection.close();
  console.log('✅  MongoDB connection closed.');
  server.close(() => {
    console.log('✅  HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled promise rejections so the process never dies silently
process.on('unhandledRejection', (reason) => {
  console.error('💥  Unhandled Rejection:', reason);
});

start();