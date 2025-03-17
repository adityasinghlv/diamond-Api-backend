const socketIo = require('socket.io');
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { REDIS_HOST, REDIS_PORT } = require('./src/config/dev.config');
const { redisClient }=require("./src/dataSource/redis");


let io;

async function initializeSocket(server) {
    io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            transports: ['websocket', 'polling'],
            credentials: true
        },
        allowEIO3: true
    });
    // const pubClient = createClient({ url: `redis://${REDIS_HOST || '127.0.0.1'}:${REDIS_PORT || 6379}` });
    const pubClient=redisClient.duplicate();
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    const redisAdapter = createAdapter(pubClient, subClient);
    io.adapter(redisAdapter);

    global.io = io;

    console.log('Socket.IO initialized with Redis');
}

function getIO() {
    if (!global.io) {
        throw new Error("Socket.io not initialized yet. Please call initializeSocket first.");
    }
    return global.io;
}

module.exports = { initializeSocket, getIO };