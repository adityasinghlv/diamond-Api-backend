const jwt = require('jsonwebtoken');
const { handleErrorResponse } = require('../helpers/response');
const { userModel } = require('../models');
const { query } = require('../utils/mongodbQuery');


exports.jwtVerify = async (req, res, next) => {
    try {
        const token = req.headers.authorization.split('Bearer ')[1];
        const findToken = await userModel.findOne({ token });
        console.log(findToken);
        if (!findToken) return handleErrorResponse(res, 401, 'Invalid token', {});

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                console.log(err);
                return handleErrorResponse(res, err.status || 401, 'Invalid token', err);
            } else {
                req.auth = {
                    _id: decoded.userId,
                    name: decoded.name,
                    role: decoded.role
                };
                next();
            }
        });
    } catch (error) {
        const err = new Error(error);
        console.log(err)
        return handleErrorResponse(res, err.status || 401, 'Token Required', err);
    }
};

exports.serviceAuth = async (req, res, next) => {
    try {

        if (req.headers['apikey'] && req.headers['apisecret']) {
            const ApiKey = req.headers['apikey'];
            const ApiSecret = req.headers['apisecret'];
            if (ApiKey == process.env.ApiKey && ApiSecret == process.env.ApiSecret) {
                next();
            }
        } else {
            return handleErrorResponse(res, 401, 'Invalid token', "err");
        }
    } catch (error) {
        console.log(400, "error", error)
        const err = new Error(error);
    }
};

