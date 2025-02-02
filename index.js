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

  // User registration
  socket.on('register', (username) => {
    onlineUsers.set(socket.id, {
      id: socket.id,
      username: username,
      status: 'online'
    });
    io.emit('userList', Array.from(onlineUsers.values()));
  });

  // Call handling
  socket.on('callInvite', (data) => {
    socket.to(data.targetId).emit('incomingCall', {
      callerSocketId: socket.id,
      callerName: data.callerName,
      callType: data.callType
    });
  });

  socket.on('callResponse', (data) => {
    io.to(data.callerId).emit('callResponse', {
      response: data.response,
      targetSocketId: socket.id,
      callType: data.callType
    });
  });

  // Messaging
  socket.on('message', (data) => {
    const recipient = data.targetSocketId;
    if (recipient) {
      socket.to(recipient).emit('message', {
        ...data,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      });
    }
  });

  // WebRTC signaling
  socket.on('signal', (data) => {
    const targetSocketId = data.targetSocketId;
    if (targetSocketId) {
      socket.to(targetSocketId).emit('signal', {
        type: data.type,
        [data.type]: data[data.type],
        senderId: socket.id
      });
    }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    socket.to(data.targetSocketId).emit('typing', {
      senderId: socket.id,
      isTyping: data.isTyping
    });
  });

  // User list requests
  socket.on('requestUsers', () => {
    socket.emit('userList', Array.from(onlineUsers.values()));
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('userList', Array.from(onlineUsers.values()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
