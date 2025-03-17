const jwt = require('jsonwebtoken');

exports.generateAuthToken = (userDetails) => {
    return jwt.sign(userDetails, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

exports.generatePokerToken = (userDetails) => {
    return jwt.sign(userDetails, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};
