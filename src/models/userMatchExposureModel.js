
const mongoose = require("mongoose");

const ExposureSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: "betMatch", required: true }, 
  type: { type: String, enum: ["odds", "fancy","toss", "bookmakers"], required: true },

  bets: [
    {
      runnerId: { type: String, required: true }, 
      betType: { type: String, required: true }, 
      stake: { type: Number, required: true }, 
      odds: { type: Number, required: true }, 
      potentialProfit: { type: Number, required: true }, 
      liability: { type: Number, required: true },
      fancyOdds: { type: String, default: '0' },
      status:{ type: Number, default: 1},
      id: { type: String }
    }
  ],

  netExposure: {type: mongoose.Schema.Types.Mixed, default: {}},

  marketExposure: { type: Number, default: 0 }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("userMatchExposure", ExposureSchema);