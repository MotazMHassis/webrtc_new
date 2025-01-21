let port = process.env.PORT || 5000;

let IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

IO.use((socket, next) => {
  if (socket.handshake.query) {
    let callerId = socket.handshake.query.callerId;
    socket.user = callerId;
    next();
  }
});

IO.on("connection", (socket) => {
  // Log when a users connects
  console.log(`User ${socket.user} connected with socket ID: ${socket.id}`);

  // Join the user to their own room
  socket.join(socket.user);

  // Handle making a call
  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;

    // Emit the new call event to the callee
    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
    });

    // Log the call initiation
    console.log(`User ${socket.user} is calling ${calleeId}`);
  });

  // Handle answering a call
  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;

    // Emit the call answered event to the caller
    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });

    // Log the call answer
    console.log(`User ${socket.user} answered the call from ${callerId}`);
  });

  // Handle ICE candidates
  socket.on("IceCandidate", (data) => {
    let calleeId = data.calleeId;
    let iceCandidate = data.iceCandidate;

    // Emit the ICE candidate to the callee
    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });

    // Log the ICE candidate exchange
    console.log(`User ${socket.user} sent an ICE candidate to ${calleeId}`);
  });

  // Log when a user disconnects
  socket.on("disconnect", () => {
    console.log(`User ${socket.user} disconnected with socket ID: ${socket.id}`);
  });
});
