import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

const httpServer = http.createServer(app);

// Socket.IO server setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Basic connection handler (extended in Phase 5)
io.on('connection', (socket) => {
  if (env.NODE_ENV !== 'test') {
    console.log(`🔌 Socket connected: ${socket.id}`);
  }

  socket.on('disconnect', () => {
    if (env.NODE_ENV !== 'test') {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    }
  });
});

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(env.PORT, () => {
      console.log(`🚀 Carpooling Platform Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      console.log(`📍 Health Check: http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  try {
    httpServer.close(async () => {
      console.log('🚪 HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Only start listening if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { httpServer };
export default httpServer;
