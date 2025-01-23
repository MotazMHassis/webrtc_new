const port = process.env.PORT || 5000;
const IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const usersInRoom = new Map(); // Map to store users in each room

IO.use((socket, next) => {
  if (socket.handshake.query) {
    let callerId = socket.handshake.query.callerId;
    let room = socket.handshake.query.room || 'default'; // Default room if not provided
    socket.user = callerId;
    socket.room = room;
    next();
  }
});

IO.on("connection", (socket) => {
  console.log(`User ${socket.user} connected to room ${socket.room}`);

  // Add user to the room
  socket.join(socket.room);

  // Initialize the room if it doesn't exist
  if (!usersInRoom.has(socket.room)) {
    usersInRoom.set(socket.room, new Set());
  }

  // Add the user to the room's user list
  usersInRoom.get(socket.room).add(socket.user);

  // Emit the updated user list to all clients in the room
  IO.to(socket.room).emit('userList', Array.from(usersInRoom.get(socket.room)));

  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;

    console.log(`User ${socket.user} is making a call to ${calleeId}`);
    console.log(`SDP Offer: ${JSON.stringify(sdpOffer)}`);

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
    });
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;

    console.log(`User ${socket.user} answered the call from ${callerId}`);
    console.log(`SDP Answer: ${JSON.stringify(sdpAnswer)}`);

    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });
  });

  socket.on("IceCandidate", (data) => {
    let calleeId = data.calleeId;
    let iceCandidate = data.iceCandidate;

    console.log(`User ${socket.user} sent ICE candidate to ${calleeId}`);
    console.log(`ICE Candidate: ${JSON.stringify(iceCandidate)}`);

    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.user} disconnected from room ${socket.room}`);

    // Remove the user from the room's user list
    if (usersInRoom.has(socket.room)) {
      usersInRoom.get(socket.room).delete(socket.user);

      // Emit the updated user list to all clients in the room
      IO.to(socket.room).emit('userList', Array.from(usersInRoom.get(socket.room)));
    }
  });
});

console.log(`Server is running on port ${port}`);
