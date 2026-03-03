import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { closePool, getConnectionInfo } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import leaguesRouter from './routes/leagues.js';
import clubsRouter from './routes/clubs.js';
import jerseysRouter from './routes/jerseys.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security and parsing middleware (in order)
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/leagues', leaguesRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/jerseys', jerseysRouter);

// 404 middleware
app.use(notFound);

// Error handler middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}, beginning graceful shutdown...`);
  try {
    await closePool();
    console.log('Database pool closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, () => {
  const dbInfo = getConnectionInfo();
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`);
});

export default app;
