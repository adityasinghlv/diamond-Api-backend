const mongoose = require('mongoose');
const { Schema } = mongoose;

const MergedMatchSchema = new mongoose.Schema({
  sport: { type: String },
  league: { type: String },
  match: { type: String },
  marketType: { type: String },
  marketId: { type: String },
  series_id: { type: String },
  sportsId :{ type: String },
  stopBet: { type: Boolean, default: false },
  eventId: { type: String },
  team1: { type: String },
  liveTv: { type: String },
  team2: { type: String },
  team1SelectionId: { type: String },
  team2SelectionId: { type: String },
  runners: { type: Array, default: [] },
  bookmakers: { type: Array, default: [] },
  fancy: { type: Array, default: [] },
  result: { type: Array, default: [] },
  dateTime: { type: String },
  
  oddsDelay: { type: Number, default: 0 },
  oddsMinStake: { type: Number, default: 100 },
  oddsMaxStake: { type: Number, default: 10000 },
  oddsMaxProfit: { type: Number, default: 5000000 },
  oddsMessage: { type: String, default: '' },
  oddsStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },

  sessionDelay: { type: Number, default: 0 },
  sessionMinStake: { type: Number, default: 100 },
  sessionMaxStake: { type: Number, default: 100000 },
  sessionMaxProfit: { type: Number, default: 3000000 },
  sessionMessage: { type: String, default: '' },
  sessionStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },

  bookDelay: { type: Number, default: 0 },
  bookMinStake: { type: Number, default: 100 },
  bookMaxStake: { type: Number, default: 300000 },
  bookMaxProfit: { type: Number, default: 2500000 },
  bookmakerMessage: { type: String, default: '' },
  bookMakerStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },

  tossDelay: { type: Number, default: 0 },
  tossMinStake: { type: Number, default: 100 },
  tossMaxStake: { type: Number, default: 50000 },
  tossMaxProfit: { type: Number, default: 50000 },
  tossMessage: { type: String, default: '' },
  tossStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },

  scoreId: { type: String, default: '' },
  scoreUrl: { type: String, default: '' },
  tvURL: { type: String, default: '' },
  matchStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  gameId: { type: String, default: '',index:true },
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', default: null, index:true },
  scoreboard_id: { type: String, default: '' },
  selections: { type: String, default: '' },
  marketStartTime: { type: String, default: '' },
  inPlay: { type: Boolean, default: false },
  marketCount: { type: Number, default: 0 },
  undeclared_markets: { type: Number, default: 0 },
  liability_type: { type: Number, default: 0 },
  totalMatched: { type: Number, default: 0 },
  oddsResult: { type: Number, default: 0 },  // 0=Pending  , 1=Declared , 2=Completed
  bookMakerResult: { type: Number, default: 0 }, // 0=Pending  , 1=Declared , 2=Completed
  fancyResult: { type: Number, default: 0 }, // 0=Pending  , 1=Declared , 2=Completed
  match_status: { type: Number, default: 0 },
  tossMarket: {type: [Schema.Types.Mixed]},
  event: {
      id: { type: Number, unique: true },
      name: { type: String, default: '' },
      countryCode: { type: String, default: '' },
      timezone: { type: String, default: 'GMT' },
      openDate: { type: String },
    },

  status: { type: String, default: '' },
  series_name : { type: String, default : '' },
  market: {type: [Schema.Types.Mixed], default: []},
  createdManually: {
    type: String,
    enum: ['yes', 'no'],
    default: 'no',
  },

}, { timestamps: true });

module.exports = mongoose.model('betMatch', MergedMatchSchema);