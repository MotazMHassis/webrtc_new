const port = process.env.PORT || 5000;

// Create HTTP server first
const http = require('http');
const server = http.createServer();

// Initialize Socket.IO with the HTTP server
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware for user authentication
io.use((socket, next) => {
  const callerId = socket.handshake.query.callerId;
  if (!callerId) {
    return next(new Error('Caller ID is required'));
  }
  socket.user = callerId;
  next();
});

// Connection handling
io.on("connection", (socket) => {
  console.log(`User ${socket.user} connected`);
  socket.join(socket.user);

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User ${socket.user} disconnected`);
  });

  socket.on("makeCall", (data) => {
    const { calleeId, sdpOffer } = data;
    if (!calleeId || !sdpOffer) {
      socket.emit("error", { message: "Invalid call data" });
      return;
    }

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
    });
  });

  socket.on("answerCall", (data) => {
    const { callerId, sdpAnswer } = data;
    if (!callerId || !sdpAnswer) {
      socket.emit("error", { message: "Invalid answer data" });
      return;
    }

    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });
  });

  socket.on("IceCandidate", (data) => {
    const { calleeId, iceCandidate } = data;
    if (!calleeId || !iceCandidate) {
      socket.emit("error", { message: "Invalid ICE candidate data" });
      return;
    }

    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Signaling server running on port ${port}`);
});
