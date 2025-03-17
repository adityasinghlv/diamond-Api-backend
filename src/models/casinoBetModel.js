const mongoose = require('mongoose');
const { Schema } = mongoose;


const casinobetSchema = new mongoose.Schema({
  token: { type: String, required: true },
  gameId: { type: String, required: true },
  matchName: { type: String, required: true },
  roundId: { type: String, required: true },
  marketId: { type: String, required: true },
  marketType: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  calculateExposure: { type: Number, required: true },
  exposureTime: { type: Number, required: true },
  betInfo: {
    gameId: { type: String, required: true },
    marketId: { type: String, required: true },
    runnerId: { type: String, required: true },
    runnerName: { type: String, required: true },
    reqStake: { type: Number, required: true },
    requestedOdds: { type: String, required: true },
    pnl: { type: Number, required: true },
    liability: { type: Number, required: true },
    status: { type: String, required: true, enum: ['OPEN', 'CLOSED'] },
    isBack: { type: Boolean, required: true },
    roundId: { type: String, required: true },
    pl: { type: Number, default: 0 },
    orderId: { type: String, required: true },
    betExposure: { type: Number, required: true },
  },
  runners: {type: [Schema.Types.Mixed], default: []},
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CasinoBet', casinobetSchema);
