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
const messages = new Map();
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User registration
  socket.on('register', (username) => {
    onlineUsers.set(socket.id, {
      id: socket.id,
      username: username,
      status: 'online',
      lastSeen: Date.now(),
      typingStatus: false
    });
    io.emit('userList', Array.from(onlineUsers.values()));
  });
  socket.on('messageRead', (messageIds) => {
    messageIds.forEach(id => {
      const msg = messages.get(id);
      if (msg) msg.status = 'read';
    });
  });
  // Call handling
  socket.on('callInvite', (data) => {
    socket.to(data.targetId).emit('incomingCall', {
      callerSocketId: socket.id,
      callerName: data.callerName,
      callType: data.callType
    });
  });
  socket.on('typingStatus', ({ isTyping }) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      user.typingStatus = isTyping;
      io.emit('userList', Array.from(onlineUsers.values()));
    }
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
    const messageId = require('crypto').randomBytes(16).toString('hex');
    messages.set(messageId, {
      ...data,
      id: messageId,
      status: 'sent',
      timestamp: Date.now()
    });
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
// Update disconnect handler
socket.on('disconnect', () => {
  const user = onlineUsers.get(socket.id);
  if (user) {
    user.status = 'offline';
    user.lastSeen = Date.now();
    io.emit('userList', Array.from(onlineUsers.values()));
  }
  onlineUsers.delete(socket.id);
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
