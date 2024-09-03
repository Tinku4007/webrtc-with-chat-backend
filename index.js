const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New connection established:', socket.id);

    socket.on("create-room", (data) => {
        const { roomId, streamerId } = data;
        console.log(`Streamer ${streamerId} created room ${roomId}`);
        rooms.set(roomId, { streamerId, viewers: new Set() });
        socket.join(roomId);
        socket.emit("room-created", { roomId });
    });

    socket.on("join-room", (data) => {
        const { roomId, viewerId } = data;
        const room = rooms.get(roomId);
        if (room) {
            console.log(`Viewer ${viewerId} joined room ${roomId}`);
            room.viewers.add(viewerId);
            socket.join(roomId);
            socket.to(roomId).emit("viewer-joined", { viewerId });
            socket.emit("joined-room", { roomId });
        } else {
            socket.emit("room-not-found");
        }
    });

    socket.on("send-offer", (data) => {
        const { viewerId, offer } = data;
        console.log(`Sending offer to viewer ${viewerId}`);
        socket.to(viewerId).emit('receive-offer', { offer });
    });

    socket.on("send-answer", (data) => {
        const { roomId, answer } = data;
        console.log(`Sending answer to room ${roomId}`);
        socket.to(roomId).emit('receive-answer', { answer });
    });

    socket.on("send-message", (data) => {
        const { roomId, viewerId, message } = data;
        console.log(`New message in room ${roomId} from ${viewerId}`);
        socket.to(roomId).emit('new-message', { viewerId, message });
    });

    socket.on("disconnect", () => {
        rooms.forEach((room, roomId) => {
            if (room.streamerId === socket.id) {
                console.log(`Streamer disconnected from room ${roomId}`);
                io.to(roomId).emit("stream-ended");
                rooms.delete(roomId);
            } else if (room.viewers.has(socket.id)) {
                console.log(`Viewer ${socket.id} disconnected from room ${roomId}`);
                room.viewers.delete(socket.id);
                socket.to(roomId).emit("viewer-left", { viewerId: socket.id });
            }
        });
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});