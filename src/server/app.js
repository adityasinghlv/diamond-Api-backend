const express = require('express');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const app = express();
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { connectDB } = require('../dataSource/dbConnection');
const path = require('path');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 1000, 
    standardHeaders: 'draft-7', 
    legacyHeaders: false 
});

app.use(express.static(path.join(__dirname, '../../uploads/banners')));
const { Server } = require('socket.io');
const { globalErrors, routeNotFound } = require('../helpers/errorHandlers');

const LOG_ID = 'server/app';


logger.info(LOG_ID, '~~~ Setting up middlewares for app ~~~');
app.use(cors()); 
app.use(compression()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(limiter); 



connectDB(); 
require('../models/index.js'); 
require('../routes')(app);
app.use(routeNotFound);

app.use((req, res, next) => {
    console.log(req.method, req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log('body :', req.body, 'query :', req.query);
    req.date = new Date();
    next();
});

app.use(globalErrors);
const server = http.createServer(app);
const { SocketProcess } = require('../services/socketService');

(async () => {
    try {
        await SocketProcess(server);
    } catch (error) {
        console.error('Error in SocketProcess:', error);
    }
})();

exports.app = server;