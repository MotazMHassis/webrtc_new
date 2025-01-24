const port = process.env.PORT || 5000;
const { v4: uuidv4 } = require('uuid');
const connectedUsers = new Set();
const IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const users = new Map(); // Map to store connected users

IO.use((socket, next) => {
  const callerId = socket.handshake.query.callerId;
  if (callerId) {
    socket.callerId = callerId;
    next();
  } else {
    next(new Error("No callerId provided"));
  }
});
IO.on("connection", (socket) => {
  console.log(`Caller connected`);
  // User registration
  socket.on('registerUser', (data) => {
    const { userId, status } = data;
    if (status === 'available') {
      connectedUsers.add(userId);
      
      // Broadcast available users to all clients
      IO.emit('availableUsers', {
        users: Array.from(connectedUsers)
      });
    }
  });

  socket.on("answerCall", (data) => {
    const { callerId, sdpAnswer } = data;
    const callerSocketId = users.get(callerId);

    if (callerSocketId) {
      console.log(`User ${socket.callerId} answered the call`);
      console.log(`SDP Answer: ${JSON.stringify(sdpAnswer)}`);
      IO.to(callerSocketId).emit("callAnswered", { 
        callerId: socket.callerId, 
        sdpAnswer 
      });
    } else {
      console.log(`Caller ${callerId} not found`);
      socket.emit("callError", { message: "Caller not available" });
    }
  });

  socket.on("IceCandidate", (data) => {
    const { calleeId, iceCandidate } = data;
    const calleeSocketId = users.get(calleeId);

    if (calleeSocketId) {
      console.log(`Sending ICE candidate to ${calleeId}`);
      IO.to(calleeSocketId).emit("IceCandidate", { 
        callerId: socket.callerId,
        iceCandidate 
      });
    }
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.callerId);
    console.log(`Caller  disconnect`);
});
      IO.emit('availableUsers', {
      users: Array.from(connectedUsers)
    });
  });

console.log(`Server is running on port ${port}`);
