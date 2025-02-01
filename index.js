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
const groups = new Map();

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
    const recipients = data.groupId ? 
      io.sockets.adapter.rooms.get(data.groupId) || [] : 
      [data.targetSocketId];

    recipients.forEach(recipient => {
      io.to(recipient).emit('message', {
        ...data,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      });
    });
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

  // Group management
  socket.on('createGroup', (groupName) => {
    const groupId = `group_${Date.now()}`;
    groups.set(groupId, {
      id: groupId,
      name: groupName,
      members: [socket.id]
    });
    socket.join(groupId);
    io.emit('groupList', Array.from(groups.values()));
  });

  socket.on('joinGroup', (groupId) => {
    if (groups.has(groupId)) {
      groups.get(groupId).members.push(socket.id);
      socket.join(groupId);
      io.emit('groupList', Array.from(groups.values()));
    }
  });

  // Group messaging
  socket.on('groupMessage', (data) => {
    const groupId = data.groupId;
    const recipients = io.sockets.adapter.rooms.get(groupId) || [];
    recipients.forEach(recipient => {
      io.to(recipient).emit('message', {
        ...data,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      });
    });
  });

  // Typing indicators
  socket.on('typing', (data) => {
    if (data.groupId) {
      socket.to(data.groupId).emit('typing', {
        senderId: socket.id,
        isTyping: data.isTyping
      });
    } else {
      socket.to(data.targetSocketId).emit('typing', {
        senderId: socket.id,
        isTyping: data.isTyping
      });
    }
  });

  // User list requests
  socket.on('requestUsers', () => {
    socket.emit('userList', Array.from(onlineUsers.values()));
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    
    // Remove from groups
    groups.forEach((group, groupId) => {
      group.members = group.members.filter(member => member !== socket.id);
      if (group.members.length === 0) {
        groups.delete(groupId);
      }
    });

    io.emit('userList', Array.from(onlineUsers.values()));
    io.emit('groupList', Array.from(groups.values()));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
