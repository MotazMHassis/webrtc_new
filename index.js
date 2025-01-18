const express = require('express');
const http = require('http');
const socketIO = require('socket.io');  // Changed import
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {          // Changed server creation
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const allClients = new Set();

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Add client to connected clients list
    allClients.add(socket.id);
    
    // Broadcast updated client list to all connected clients
    io.emit('allclientList', Array.from(allClients));
    
    // Handle incoming call
    socket.on('offer', (data) => {
        console.log(`Offer received from ${socket.id} to ${data.to}`);
        socket.to(data.to).emit('offer', {
            offer: data.offer,
            from: socket.id
        });
    });
    
    // Handle call answer
    socket.on('answer', (data) => {
        console.log(`Answer received from ${socket.id} to ${data.to}`);
        socket.to(data.to).emit('answer', {
            answer: data.answer,
            from: socket.id
        });
    });
    
    // Handle ICE candidates
    socket.on('candidate', (data) => {
        console.log(`ICE candidate received from ${socket.id} to ${data.to}`);
        socket.to(data.to).emit('candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });
    
    // Handle call rejection
    socket.on('rejectCall', (data) => {
        console.log(`Call rejected by ${socket.id}`);
        socket.to(data.to).emit('callRejected', {
            from: socket.id
        });
    });
    
    // Handle call end
    socket.on('endCall', (data) => {
        console.log(`Call ended by ${socket.id}`);
        if (data.to) {
            socket.to(data.to).emit('callEnded', {
                from: socket.id
            });
        }
    });
    
    // Handle client disconnect
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        allClients.delete(socket.id);
        io.emit('allclientList', Array.from(allClients));
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 3500;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
