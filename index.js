const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (username) => {
    onlineUsers.set(socket.id, username);
    io.emit('userList', Array.from(onlineUsers.entries()));
  });

  // Call handling
  socket.on('callInvite', (data) => {
    socket.to(data.targetSocketId).emit('incomingCall', {
      callerSocketId: socket.id,
      callerName: data.callerName
    });
  });

  socket.on('callResponse', (data) => {
    io.to(data.callerSocketId).emit('callResponse', {
      response: data.response,
      targetSocketId: socket.id
    });
  });

  // Messaging
  socket.on('textMessage', (data) => {
    io.to(data.targetSocketId).emit('textMessage', {
      senderId: socket.id,
      message: data.message,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });
  });

  socket.on('mediaMessage', (data) => {
    io.to(data.targetSocketId).emit('mediaMessage', {
      senderId: socket.id,
      type: data.type,
      url: data.url,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    });
  });

  // Message status
  socket.on('messageDelivered', (messageId) => {
    io.emit('messageDelivered', messageId);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('userList', Array.from(onlineUsers.entries()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
