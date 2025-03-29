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

const onlineUsers = new Map(); // Stores socket.id -> username
const activeCalls = new Map(); // Stores callerSocketId -> { targetSocketId, isVideoCall }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Register user with username
  socket.on('register', (username) => {
    if (typeof username !== 'string' || username.trim() === '') {
      socket.emit('error', 'Invalid username');
      return;
    }

    onlineUsers.set(socket.id, username);
    updateUserList();
    console.log(`User registered: ${socket.id} as ${username}`);
  });

  // Initiate a call
  socket.on('callInvite', (data) => {
    if (!data.targetSocketId || !onlineUsers.has(data.targetSocketId)) {
      socket.emit('error', 'Target user not found');
      return;
    }

    if (activeCalls.has(socket.id)) {
      socket.emit('error', 'You already have an active call');
      return;
    }

    const isVideoCall = data.isVideoCall !== false; // Default to true if not specified
    activeCalls.set(socket.id, {
      targetSocketId: data.targetSocketId,
      isVideoCall: isVideoCall
    });

    socket.to(data.targetSocketId).emit('incomingCall', {
      callerSocketId: socket.id,
      callerName: onlineUsers.get(socket.id),
      isVideoCall: isVideoCall
    });

    console.log(`Call initiated from ${socket.id} to ${data.targetSocketId} (${isVideoCall ? 'Video' : 'Voice'})`);
  });

  // Handle call response
  socket.on('callResponse', (data) => {
    const callData = activeCalls.get(data.callerSocketId);
    
    if (!callData || callData.targetSocketId !== socket.id) {
      socket.emit('error', 'Invalid call response');
      return;
    }

    if (data.response === 'accept') {
      io.to(data.callerSocketId).emit('callAccepted', {
        isVideoCall: callData.isVideoCall
      });
      console.log(`Call accepted between ${data.callerSocketId} and ${socket.id}`);
    } else {
      io.to(data.callerSocketId).emit('callRejected');
      console.log(`Call rejected by ${socket.id}`);
    }

    // Remove from active calls if rejected or after signaling is complete
    if (data.response !== 'accept') {
      activeCalls.delete(data.callerSocketId);
    }
  });

  // WebRTC signaling
  socket.on('signal', (data) => {
    if (!data.targetSocketId || !onlineUsers.has(data.targetSocketId)) {
      socket.emit('error', 'Target user not found');
      return;
    }

    // Verify this is part of an active call
    const isValidCall = 
      (activeCalls.has(socket.id) || 
      (Array.from(activeCalls.values()).some(call => call.targetSocketId === socket.id));

    if (!isValidCall) {
      socket.emit('error', 'Not part of an active call');
      return;
    }

    io.to(data.targetSocketId).emit('signal', data);
  });

  // End call cleanup
  socket.on('endCall', () => {
    const callData = activeCalls.get(socket.id);
    if (callData) {
      io.to(callData.targetSocketId).emit('callEnded');
      activeCalls.delete(socket.id);
      console.log(`Call ended by ${socket.id}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const callData = activeCalls.get(socket.id);
    if (callData) {
      io.to(callData.targetSocketId).emit('callEnded');
      activeCalls.delete(socket.id);
      console.log(`Call ended due to disconnection of ${socket.id}`);
    }

    onlineUsers.delete(socket.id);
    updateUserList();
    console.log('User disconnected:', socket.id);
  });

  // Helper function to update all clients with current user list
  function updateUserList() {
    const usersArray = Array.from(onlineUsers.entries());
    io.emit('userList', usersArray);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
