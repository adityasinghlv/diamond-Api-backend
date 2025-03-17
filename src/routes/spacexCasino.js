const express = require('express');
const { validate } = require('express-validation');

const { logger } = require('../utils/logger');
const { statusCode, } = require('../../config/default.json');
const { handleResponse, handleErrorResponse } = require('../helpers/response');
const { spacexCasinoService } = require('../services');
const { jwtVerify } = require('../middleware/auth');
const router = express.Router();
const LOG_ID = 'routes/user';


router.get('/getProviders', async (req, res) => {
    try {
        const result = await spacexCasinoService.getProviders();
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getProviderGames/:id', async (req, res) => {
    try {
        const result = await spacexCasinoService.getProviderGames(req.params.id);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        handleErrorResponse(res, err.status, err.message, err);
    }
});

router.get('/getGameDetails/:id', jwtVerify, async (req, res) => {
    try {
        const result = await spacexCasinoService.getGameDetails(req.params.id,req);
        if (result.success) {
            return handleResponse(res, statusCode.OK, result);
        }
        return handleResponse(res, statusCode.BAD_REQUEST, result);
    } catch (err) {
        handleErrorResponse(res, err.status, err.message, err);
    }
});


router.post('/casinoWebhook', async (req, res) => {
    try {
        console.log('req.body---->>>>>', JSON.stringify(req.body));
        const result = await spacexCasinoService.casinoWebhook(req.body);
        return res.status(200).json(result);
    } catch (err) {
        logger.error(
            LOG_ID,
            `Error occurred during bet limit : ${err.message}`
        );
        handleErrorResponse(res, err.status, err.message, err);
    }
});



module.exports = router;
