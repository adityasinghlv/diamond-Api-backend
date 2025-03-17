const mongoose = require('mongoose');
const { Schema } = mongoose;

const matchOddsSchema = new Schema(
    {
        gameId: { type: String, required: true, index: true },
        matchId: { type: mongoose.Types.ObjectId, ref: 'betMatch', index:true },
        eventId: { type: Number, required: true, index: true },
        p_marketId: { type: String, required: true, index: true },
        bookmakers: { type: Array, default: [] }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('matchBookmakerOdd', matchOddsSchema);
