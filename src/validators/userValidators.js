const { Joi } = require('express-validation');

exports.login = {
    body: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
        country: Joi.string().allow('').optional(),
        ipAddress: Joi.string().allow('').optional(),
    })
};

exports.registerUser = {
    body: Joi.object({
        roleId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
        username: Joi.string().min(3).max(30).required(),
        name: Joi.string().min(3).max(100).required(),
        email: Joi.string().email().optional().allow(''),
        mobile: Joi.string().pattern(/^[0-9]{10}$/).optional().allow(''),
        password: Joi.string().min(6).max(128).required().pattern(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,128}$/),
        country: Joi.string().min(3).max(50).optional().default('India'),
        ipAddress: Joi.string().ip().optional(),
        accountType: Joi.string().valid('super-admin', 'master', 'agent', 'user').required(),
        commission: Joi.number().min(0).required(),
        mobileNumber: Joi.string().pattern(/^[0-9]{10}$/).required(),
        refer_code: Joi.string().allow('').optional()
    })
};
exports.registerUserSelf = {
    body: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().optional(),
        username: Joi.string().required(),
        password: Joi.string().required(),
        refercode: Joi.string().optional(),
        mobile: Joi.number().optional(),
        country: Joi.string().allow('').optional(),
        ipAddress: Joi.string().allow('').optional(),
    })
};

exports.changePassword = {
    body: Joi.object({
        password: Joi.string().required(),
        cnf_password: Joi.string().required(),
        userId: Joi.string().required(),
        previousPassword: Joi.string().required()
    })
};

exports.depositOrWithdrawMoney = {
    body: Joi.object({
        userId: Joi.string().required(),
        transferedBy: Joi.string().required(),
        type: Joi.string().required(),
        desc: Joi.string().required(),
        points: Joi.number().required()
    })
};

exports.depositOrWithdrawMoneyCommision = {
    body: Joi.object({
        userId: Joi.string().required(),
        transferedBy: Joi.string().required(),
        type: Joi.string().optional(),
        desc: Joi.string().required(),
        amount: Joi.number().required()
    })
};

exports.changeStatus = {
    body: Joi.object({
        userId: Joi.string().required(),
        status: Joi.string().required()
    })
};

exports.commission = {
    body: Joi.object({
        userId: Joi.string().required(),
        bookmakerCommission: Joi.number().optional(),
        isbookmakerCommissionOn: Joi.boolean().optional(),
        fancyCommission: Joi.number().optional(),
        isFancyCommissionOn: Joi.boolean().optional()
    })
};