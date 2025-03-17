const mongoose = require('mongoose');
const { Schema } = mongoose;

const matchFancySchema = new Schema({
    eventId: { type: String, required: true, index: true }, 
    matchId: { type: mongoose.Types.ObjectId, ref: 'betMatch', index: true },
    gameId: { type: String, required: true, index: true },
    p_marketId: { type: String, required: true, index: true },  
    inPlay: { type: Boolean, default: false },
    Fancy: { type: Array, default: [] }
}, {
    timestamps: true,  
    versionKey: false  
});

module.exports = mongoose.model('matchFancy', matchFancySchema);
