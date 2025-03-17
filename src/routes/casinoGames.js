const express = require('express');
const { validate } = require('express-validation');

const { logger } = require('../utils/logger');
const { statusCode, } = require('../../config/default.json');
const { handleResponse, handleErrorResponse } = require('../helpers/response');
const { casinoGameService } = require('../services');
const { jwtVerify } = require('../middleware/auth');
const router = express.Router();
const LOG_ID = 'routes/user';


router.post('/auth', async (req, res) => {
    try {
        const result = await casinoGameService.auth(req.body);

        return res.status(200).json(result);

    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during login: ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/exposure', async (req, res) => {
    try {
        const result = await casinoGameService.exposure(req.body);

        return res.status(200).json(result);

    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during create exposure : ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/result', async (req, res) => {
    try {
        const result = await casinoGameService.updateResults(req.body);

        return res.status(200).json(result);

    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during create result : ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.post('/refund', async (req, res) => {
    try {
        const result = await casinoGameService.refund(req.body);

        return res.status(200).json(result);

    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during create refund : ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});


module.exports = router;
