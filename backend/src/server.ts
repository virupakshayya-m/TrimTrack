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

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// App Routes
app.use('/api/auth', authRoutes);
app.use('/api', servicesRoutes);
app.use('/api', barbersRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', queueRoutes);
app.use('/api', bookingsRoutes);
app.use('/api', userRoutes);

// Socket.io Setup
initializeSocketIO(io);

// Basic connection fallback if needed outside rooms

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
