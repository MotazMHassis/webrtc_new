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

  socket.on('callInvite', (data) => {
    socket.to(data.targetSocketId).emit('incomingCall', {
      callerSocketId: socket.id,
      callerName: data.callerName
    });
  });

  socket.on('callResponse', (data) => {
    if (data.response === 'accept') {
      io.to(data.callerSocketId).emit('callAccepted');
    } else {
      io.to(data.callerSocketId).emit('callRejected');
    }
  });

  socket.on('signal', (data) => {
    io.to(data.targetSocketId).emit('signal', data);
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
