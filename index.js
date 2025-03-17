
require('pkginfo')(module, 'name', 'version');
require('dotenv').config();
const pkgInfo = module.exports;

const { logger } = require('./src/utils/logger');
const { app } = require('./src/server/app');

const port = process.env.PORT || 5050;
const HOST = process.env.HOST || 'localhost';
const LOG_ID = 'server/index';
const start = async () => {
    try {
        // logger.info(LOG_ID, `~~~ ${pkgInfo.name} v${pkgInfo.version} ~~~`);
        let isConnected = false;
        app.listen(port, (err) => {
            console.log("port: " + port)
            if (err) logger.error(LOG_ID, err);
            isConnected = true;
            // logger.info(LOG_ID, `🌷 ${pkgInfo.name} src/index.js, version ${pkgInfo.version}, listening on port ${port}!`);
            return isConnected;
        });
    } catch (error) {
        logger.error(LOG_ID, error);
    }
};

start();