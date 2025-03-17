const mongoose = require('mongoose');

const betLimitSchema = new mongoose.Schema({
  INR: {
    minBet: { type: Number, required: true, min: 0 },
    maxBet: { type: Number, required: true, min: 0 },
    maxMarketPL: { type: Number, required: true, min: 0 }
  },
  HKD: {
    minBet: { type: Number, required: true, min: 0 },
    maxBet: { type: Number, required: true, min: 0 },
    maxMarketPL: { type: Number, required: true, min: 0 }
  }
}, { _id: false }); 

module.exports = mongoose.model('BetLimits', betLimitSchema);

