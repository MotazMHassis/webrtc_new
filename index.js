const port = process.env.PORT || 5000;
const IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const usersInRoom = new Map(); // Map to store users in each room

IO.use((socket, next) => {
  const callerId = socket.handshake.query.callerId;
  if (callerId) {
    socket.callerId = callerId; // Attach callerId to the socket object
    next();
  } else {
    next(new Error("No callerId provided"));
  }
});

IO.on("connection", (socket) => {
  console.log(`User ${socket.callerId} connected`);

  socket.on("makeCall", (data) => {
    const { callerId, calleeId, sdpOffer } = data;
    console.log(`sdpOffer ${sdpOffer}`);
    console.log(`User ${callerId} is making a call to ${calleeId}`);
    socket.to(calleeId).emit("newCall", { callerId, sdpOffer });
  });

  socket.on("answerCall", (data) => {
    const { callerId, sdpAnswer } = data;
     console.log(`sdpAnswer ${sdpAnswer}`);
    console.log(`User ${callerId} answered the call`);
    socket.to(callerId).emit("callAnswered", { sdpAnswer });
  });

  socket.on("IceCandidate", (data) => {
    const { calleeId, iceCandidate } = data;
    console.log(`Sending ICE candidate to ${calleeId}`);
    socket.to(calleeId).emit("IceCandidate", { iceCandidate });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.callerId} disconnected`);
  });
});

console.log(`Server is running on port ${port}`);
