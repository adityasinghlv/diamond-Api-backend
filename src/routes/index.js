const { apiV1Prefix } = require('../../config/default.json');


module.exports = (app) => {
    app.use(`${apiV1Prefix}/user`, require('./user'));
    app.use(`${apiV1Prefix}/bet`, require('./betGames'));
    app.use(`/api/poker/`, require('./casinoGames'));
    app.use(`/api/spacex/`, require('./spacexCasino'));
    // app.use(`/api/poker/auth`, require('./user'));
    // app.use(`${apiV1Prefix}/casino`, require('./casinoGames'));
    // app.use(`${apiV1Prefix}/casinoApi`, require('./casinoAPI'));
    // app.use(`${apiV1Prefix}/`, require('./promotionRoutes'));
    // app.use(`${apiV1Prefix}/wallet`, require('./walletConverter'));
    // app.use(`${apiV1Prefix}/wallet-service`, require('./walletForService'));
    // app.use(`${apiV1Prefix}/`, require('./affiliateRoutes'));
    // app.use(`${apiV1Prefix}/chat`, require('./chatRoutes'));
    // app.use(`${apiV1Prefix}/market`, require('./marketRoutes'));
};

