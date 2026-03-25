
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connect from './config/db.config.js';
import { setupSocketIO } from './socket.js';

const startServer = async () => {
  try {
    await connect();
    
    const httpServer = createServer(app);
    
    // Setup Socket.IO
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    
    // Initialize socket handlers
    setupSocketIO(io);
    
    // Make io accessible in controllers
    app.set('io', io);
    
    httpServer.listen(process.env.PORT || 3000, () => {
      console.log(`Server is running on port ${process.env.PORT || 3000}...`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
