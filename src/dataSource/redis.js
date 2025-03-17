let redis = require('redis');
const { REDIS_HOST, REDIS_PORT } = require('../config/dev.config');

let redisClient = redis.createClient({ url:`redis://${REDIS_HOST || '127.0.0.1'}:${REDIS_PORT || 6379}` });
redisClient.connect().catch(console.error)
    .then(async () => {
        await setkeydata('rinku1', { status: true }, 60 * 60);
        console.log('Connected to Redis server successfully');
    });

async function getkeydata(key) {
    let result;
    let data = await redisClient.get(key);
    if (data)
        result = JSON.parse(data);
    else
        result = null;
    return result;
}

function setkeydata(key, data, timing) {
    redisClient.set(key, JSON.stringify(data), { EX: timing });
    return data;

}

function deletedata(key) {
    redisClient.del(key);
}

module.exports = { getkeydata, setkeydata, deletedata,redisClient };
