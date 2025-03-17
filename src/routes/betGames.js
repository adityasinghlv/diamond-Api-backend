const express = require('express');
const { logger } = require('../utils/logger');
const { statusCode } = require('../../config/default.json');
const { handleResponse, handleErrorResponse } = require('../helpers/response');
const { betGameService} = require('../services');
const router = express.Router();
const { jwtVerify } = require('../middleware/auth');
const { default: mongoose } = require('mongoose');

const LOG_ID = 'routes/betGames';


router.get('/gameSeries', async (req, res) => {
    try {
        const result = await betGameService.gameSeries(req.query);

        if (result.success) {
            return handleResponse(
                res, 
                statusCode.OK, 
                result
            );
        } else {
            return handleResponse(
                res, 
                statusCode.BAD_REQUEST, 
                result
            );
        }
    } catch (err) {
        logger.error(LOG_ID, `Error occurred while fetching games: ${err.message}`);
        handleErrorResponse(
            res, 
            err.status, 
            err.message, 
            err);
    }
});

router.post('/place', jwtVerify, async (req, res) => {
    try {
        const result = await betGameService.place(req.body, req.auth);
        if (result.success) {
            return handleResponse(
                res, 
                statusCode.OK, 
                result
            );
        } else {
            return handleResponse(
                res, 
                statusCode.BAD_REQUEST, 
                result
            );
        }
    } catch (err) {
        handleErrorResponse(
            res, 
            err.status, 
            err.message, 
            err
        );
    }
});


router.get('/betHistory', jwtVerify,async (req, res) => {
    try {
        const result = await betGameService.betHistory(req);

        if (result.success) {
            return handleResponse(
                res,
                statusCode.OK,
                result
            );
        } else {
            return handleResponse(
                res,
                statusCode.BAD_REQUEST,
                result
            );
        }
    } catch (err) {
        logger.error(LOG_ID, `Error occurred while fetching games: ${err.message}`);
        handleErrorResponse(
            res,
            err.status,
            err.message,
            err);
    }
});

router.get('/getLiveMatches', async (req, res) => {
    try {
        const result = await betGameService.getLiveMatches(req);

        if (result.success) {
            return handleResponse(
                res,
                statusCode.OK,
                result
            );
        } else {
            return handleResponse(
                res,
                statusCode.BAD_REQUEST,
                result
            );
        }
    } catch (err) {
        logger.error(LOG_ID, `Error occurred while fetching games: ${err.message}`);
        handleErrorResponse(
            res,
            err.status,
            err.message,
            err);
    }
});

router.get('/getTVUrl/:id', async (req, res) => {
    try {
        const result = await betGameService.getTVUrl(req);

        if (result.success) {
            return handleResponse(
                res,
                statusCode.OK,
                result
            );
        } else {
            return handleResponse(
                res,
                statusCode.BAD_REQUEST,
                result
            );
        }
    } catch (err) {
        logger.error(LOG_ID, `Error occurred while fetching TV URL: ${err.message}`);
        handleErrorResponse(
            res,
            err.status,
            err.message,
            err);
    }
});







module.exports = router;