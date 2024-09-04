const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create-room', ({ roomId, streamerId }) => {
        if (rooms.has(roomId)) {
            socket.emit('error', { message: 'Room already exists' });
            return;
        }
        rooms.set(roomId, { streamerId, viewers: new Set() });
        socket.join(roomId);
        io.emit('room-created', { roomId, streamerId });
        console.log(`Room created: ${roomId} by streamer: ${streamerId}`);
    });

    socket.on('join-room', ({ roomId, viewerId }) => {
        const room = rooms.get(roomId);
        console.log(room , 'tinku saini')
        if (room) {
            room.viewers.add(viewerId);
            socket.join(roomId);
            io.to(roomId).emit('viewer-joined', { viewerId, totalViewers: room.viewers.size });
            console.log(`Viewer ${viewerId} joined room ${roomId}`);
        } else {
            socket.emit('error', { message: 'Room not found' });
        }
    });

    socket.on('send-offer', ({ roomId, viewerId, offer }) => {
        const room = rooms.get(roomId);
        if (room && room.viewers.has(viewerId)) {
            io.to(viewerId).emit('receive-offer', { offer, roomId });
        } else {
            socket.emit('error', { message: 'Invalid room or viewer' });
        }
    });

    socket.on('send-answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room) {
            io.to(room.streamerId).emit('receive-answer', { answer, roomId });
        } else {
            socket.emit('error', { message: 'Room not found' });
        }
    });

    socket.on('send-message', ({ roomId, viewerId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            io.to(roomId).emit('new-message', { viewerId, message });
        } else {
            socket.emit('error', { message: 'Room not found' });
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            if (room.streamerId === socket.id) {
                io.to(roomId).emit('stream-ended', { roomId });
                rooms.delete(roomId);
            } else if (room.viewers.has(socket.id)) {
                room.viewers.delete(socket.id);
                io.to(roomId).emit('viewer-left', { viewerId: socket.id, totalViewers: room.viewers.size });
            }
        });
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});