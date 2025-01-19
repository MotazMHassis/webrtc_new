const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);

// Create a Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for simplicity
    methods: ['GET', 'POST'],
  },
});

// Store connected users
const users = {};

io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);

  // When a new user joins, add them to the users list and broadcast the updated list
  socket.on('join', (userName) => {
    users[socket.id] = userName;
    console.log(`${userName} joined with ID: ${socket.id}`);
    io.emit('allclientList', Object.values(users));
  });

  // Handle an offer from one client
  socket.on('offer', (data) => {
    const { to, offer } = data;
    console.log(`Offer sent from ${socket.id} to ${to}`);
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  // Handle an answer from one client
  socket.on('answer', (data) => {
    const { to, answer } = data;
    console.log(`Answer sent from ${socket.id} to ${to}`);
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  // Handle ICE candidates
  socket.on('candidate', (data) => {
    const { to, candidate } = data;
    console.log(`Candidate sent from ${socket.id} to ${to}`);
    io.to(to).emit('candidate', { from: socket.id, candidate });
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete users[socket.id];
    io.emit('allclientList', Object.values(users));
  });
});

// Basic route to check server status
app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server is running.');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
