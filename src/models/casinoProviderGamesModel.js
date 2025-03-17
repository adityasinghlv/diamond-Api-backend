const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const casinoProviderGamesModelSchema = new Schema(
  {
    gameId: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: Number,
      required: true
    },
    provider: {
      type: String,
      required: true
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'spacexCasinoProviderModel',
      required: true
    },
    provider_code: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    category: {
      type: [String],
      required: true
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const casinoProviderGames = mongoose.model('casinoProviderGames', casinoProviderGamesModelSchema);
module.exports = casinoProviderGames;