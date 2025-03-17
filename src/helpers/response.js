const { statusCode } = require('../../config/default.json');

class Response {
    constructor(status, data) {
        this.status = status;
        this.data = data;
    }
}

class ErrorResponse {
    constructor(status, message, error = {}) {
        this.status = status;
        this.message = message;
        this.error = error;
    }
}


const handleResponse = (res, status = statusCode.OK, data) => {
    const response = new Response(status, data);
    res.status(status).send(response);
};

const handleResponseCustom = (res, status = statusCode.OK, data) => {
    const response = new Response(status, data);
    res.status(status).json(response);
};

const handleErrorResponse = (res, status = 500, message, error) => {
    const response = new ErrorResponse(status, message, error);
    res.status(status).send(response);
};

module.exports = {
    handleResponse,
    handleErrorResponse,
    handleResponseCustom
};