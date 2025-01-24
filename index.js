const port = process.env.PORT || 5000;
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
  console.log(`User ${socket.callerId} connected`);
  
  // Register the user when they connect
  users.set(socket.callerId, socket.id);

  socket.on("makeCall", (data) => {
    const { callerId, calleeId, sdpOffer } = data;
    const calleeSocketId = users.get(calleeId);

    if (calleeSocketId) {
      console.log(`User ${callerId} is making a call to ${calleeId}`);
      IO.to(calleeSocketId).emit("newCall", { callerId, sdpOffer });
      console.log(`SDP Offer: ${JSON.stringify(sdpOffer)}`);
    } else {
      console.log(`Callee ${calleeId} not found`);
      socket.emit("callError", { message: "Callee not available" });
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

  socket.on("disconnect", () => {
    users.delete(socket.callerId);
    console.log(`User ${socket.callerId} disconnected`);
  });
});

console.log(`Server is running on port ${port}`);
