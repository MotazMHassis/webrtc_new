const port = process.env.PORT || 5000;
const IO = require("socket.io")(port, {
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
  console.log(`User ${socket.user} connected`); // Log when a user connects

  socket.join(socket.user);

  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;

    console.log(`User ${socket.user} is making a call to ${calleeId}`); // Log call offer
    console.log(`SDP Offer: ${JSON.stringify(sdpOffer)}`); // Log SDP offer

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
    });
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;

    console.log(`User ${socket.user} answered the call from ${callerId}`); // Log call answer
    console.log(`SDP Answer: ${JSON.stringify(sdpAnswer)}`); // Log SDP answer

    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });
  });

  socket.on("IceCandidate", (data) => {
    let calleeId = data.calleeId;
    let iceCandidate = data.iceCandidate;

    console.log(`User ${socket.user} sent ICE candidate to ${calleeId}`); // Log ICE candidate
    console.log(`ICE Candidate: ${JSON.stringify(iceCandidate)}`); // Log ICE candidate details

    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.user} disconnected`); // Log when a user disconnects
  });
});

console.log(`Server is running on port ${port}`);
