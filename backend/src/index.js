
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import app from './app.js';
import connect from './config/db.config.js';
import { setupSocketIO } from './socket.js';
import { sendDailySummary } from './services/dailySummary.service.js';

const DAILY_SUMMARY_CRON = process.env.DAILY_SUMMARY_CRON || '0 8 * * *';
const SUMMARY_TIMEZONE = process.env.DAILY_SUMMARY_TIMEZONE || 'UTC';

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

    cron.schedule(
      DAILY_SUMMARY_CRON,
      async () => {
        const result = await sendDailySummary();
        if (result?.success) {
          console.log(`Daily summary sent to ${result.sent || 0} recipients`);
        } else {
          console.warn('Daily summary job completed with errors');
        }
      },
      { timezone: SUMMARY_TIMEZONE }
    );
    
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}...`);
      console.log(
        `Daily summary scheduler active: ${DAILY_SUMMARY_CRON} (${SUMMARY_TIMEZONE})`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
