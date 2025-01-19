const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store connected users and their room information
const users = new Map();
const rooms = new Map();

// Middleware to handle connection rate limiting
let connectionAttempts = new Map();
setInterval(() => connectionAttempts.clear(), 60000);

io.use((socket, next) => {
  const clientIp = socket.handshake.address;
  const attempts = connectionAttempts.get(clientIp) || 0;
  
  if (attempts > 100) {
    return next(new Error('Too many connection attempts'));
  }
  
  connectionAttempts.set(clientIp, attempts + 1);
  next();
});

io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);

  // Enhanced join handler with room support
  socket.on('join', ({ userName, room = 'default' }) => {
    try {
      if (typeof userName !== 'string' || userName.length > 50) {
        throw new Error('Invalid username');
      }

      users.set(socket.id, { userName, room });
      socket.join(room);

      // Update room users
      const roomUsers = Array.from(users.entries())
        .filter(([_, user]) => user.room === room)
        .map(([id, user]) => ({
          id,
          userName: user.userName
        }));

      io.to(room).emit('userList', roomUsers);
      
      console.log(`${userName} joined room ${room} with ID: ${socket.id}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Enhanced signaling handlers with validation
  socket.on('offer', ({ to, offer }) => {
    try {
      if (!users.has(to)) {
        throw new Error('Target user not found');
      }

      const sender = users.get(socket.id);
      if (!sender) {
        throw new Error('Not authenticated');
      }

      console.log(`Offer sent from ${socket.id} to ${to}`);
      io.to(to).emit('offer', {
        from: socket.id,
        offer,
        userName: sender.userName
      });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('answer', ({ to, answer }) => {
    try {
      if (!users.has(to)) {
        throw new Error('Target user not found');
      }

      console.log(`Answer sent from ${socket.id} to ${to}`);
      io.to(to).emit('answer', { from: socket.id, answer });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('candidate', ({ to, candidate }) => {
    try {
      if (!users.has(to)) {
        throw new Error('Target user not found');
      }

      console.log(`Candidate sent from ${socket.id} to ${to}`);
      io.to(to).emit('candidate', { from: socket.id, candidate });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Enhanced disconnect handler
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { room } = user;
      users.delete(socket.id);

      // Update room users
      const roomUsers = Array.from(users.entries())
        .filter(([_, u]) => u.room === room)
        .map(([id, u]) => ({
          id,
          userName: u.userName
        }));

      io.to(room).emit('userList', roomUsers);
      io.to(room).emit('userDisconnected', socket.id);
      
      console.log(`User disconnected: ${socket.id} from room ${room}`);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Basic route
app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server is running.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
