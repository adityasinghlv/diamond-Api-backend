const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const spacexCasinoProviderModelSchema = new Schema(
  {
    provider: {
      type: String,
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

const spacexCasinoProvider = mongoose.model('spacexCasinoProvider', spacexCasinoProviderModelSchema);
module.exports = spacexCasinoProvider;