import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { verifyTokenSocket } from './middlewares/auth.js';
import Room from './models/Room.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

connectDB();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Map to track all sockets per userName
const userSockets = new Map(); // Map<userName, Set<socket.id>>

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    await verifyTokenSocket(socket);
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const rooms = new Set();
  let currentUserName = null;

  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', async (roomId, userName) => {
    currentUserName = userName;

    socket.join(roomId);
    rooms.add(roomId);

    if (!userSockets.has(userName)) {
      userSockets.set(userName, new Set());
    }
    userSockets.get(userName).add(socket.id);

    console.log(
      `User ${userName} joined room ${roomId} with socket ${socket.id}`
    );

    try {
      const user = await import('./models/User.js').then((m) =>
        m.default.findOne({ username: userName })
      );
      if (user) {
        await Room.updateOne(
          { roomName: roomId },
          { $addToSet: { participants: user._id } }
        );
      }
    } catch (err) {
      console.error('Failed to update room participants:', err);
    }
    io.to(roomId).emit('user-connected', { userId: socket.id, userName });
  });

  socket.on('send-message', ({ roomId, message, userName }) => {
    console.log(
      `[BACKEND] Received message from ${userName} in room ${roomId}: ${message}`
    );
    io.to(roomId).emit('receive-message', {
      message,
      userName,
      timestamp: new Date(),
    });
    console.log(`[BACKEND] Broadcasted message to room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(
      `Socket disconnected: ${socket.id} for user ${currentUserName}`
    );

    if (currentUserName && userSockets.has(currentUserName)) {
      const socketsSet = userSockets.get(currentUserName);
      socketsSet.delete(socket.id);
      if (socketsSet.size === 0) {
        userSockets.delete(currentUserName);
      }
    }

    rooms.forEach((roomId) => {
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
