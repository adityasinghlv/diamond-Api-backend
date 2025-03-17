const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const LOG_ID = 'dataSource/dbConnection';

/**
 * Connects to the MongoDB database using the provided URL and database name.
 *
 * @returns {Promise<void>} A Promise that resolves when the connection is established or rejects on error.
 */
mongoose.set('strictQuery', true);
exports.connectDB = async () => {
    try {
        const conn = await mongoose.connect(`${process.env.DB_URL}`, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        logger.info(LOG_ID, `Database connected successfully on ${conn.connection.host}`);
    } catch (error) {
        console.log('error--->', error);
        logger.error(LOG_ID, 'Database not connected', error);
    }
};