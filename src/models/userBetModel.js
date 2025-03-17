const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userBetSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, ref: 'users', index: true, required: true },
    type: { type: String },
    betId : { type : String},
    matchId: { type: mongoose.Types.ObjectId, ref: 'betMatches', index: true },
    gameId: { type: mongoose.Types.ObjectId, index: true },
    packageSubscriptionId: { type: mongoose.Types.ObjectId },
    betType: { type: String },
    scoreUrl: { type: String, default: '' },
    marketId: { type: String, index: true },
    selectionId: { type: String, default: null, index: true },
    odds: { type: String, default: '' },
    originalOdds:  {type: [Schema.Types.Mixed], default: []},
    fancyOdds: { type: String, default: '0' },
    transaction_id: { type: String, default: null },
    potentialWin: { type: Number, default: 0 },
    marketStartTime: { type: String, default: '' },
    sportsId: { type: String, default: null },
    game_id: { type: Number, default: null },
    id: { type: String },
    status: { type: String },
    stake: { type: Number },
    roundId: { type: String },
    amount: { type: Number },
    casinoId: { type: Number },
    currency: { type: String, default: 'INR' },
    marketName: { type: String, default: '' },
    marketType: { type: String, default: '' },
    result: { type: Object, default: '' },
    settledTime : {type: String, default: ''},
    isDeleted: { type: Boolean, default: false },
    oddsWinner: { type: String },
    commission: { type: Number, default: 0 },
    placeTime: { type: String },
    actualWinningAmount: { type: Number, default: 0 },
    matchTime: { type: String },
    betstatus: {
        type: String,
        enum: ['settled', 'unsettled', 'void'],
        default: 'unsettled'
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('userbet', userBetSchema);
