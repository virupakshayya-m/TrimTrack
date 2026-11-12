import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import servicesRoutes from './routes/services';
import barbersRoutes from './routes/barbers';
import dashboardRoutes from './routes/dashboard';
import queueRoutes from './routes/queue';
import bookingsRoutes from './routes/bookings';
import { initializeSocketIO } from './lib/socketio';

dotenv.config();

const app = express();
const server = http.createServer(app);
  
// Configure CORS for Express and Socket.io
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: corsOptions,
});

// Basic Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// App Routes
app.use('/api/auth', authRoutes);
app.use('/api', servicesRoutes);
app.use('/api', barbersRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', queueRoutes);
app.use('/api', bookingsRoutes);
app.use('/api', userRoutes);

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled API error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Socket.io Setup
initializeSocketIO(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const runningServer = server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Closing server gracefully...`);
    runningServer.close(() => {
      console.log('HTTP and Socket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer();
