const mongoose = require('mongoose');
const { Schema } = mongoose;

const seriesSchema = new Schema({
  id: { type: String, required: true },
  gameId: { type: String, required: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, {
  timestamps: true, 
});

const Series = mongoose.model('GameSeries', seriesSchema);
module.exports = Series;