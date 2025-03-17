const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], required: true },
  image: { type: String, required: true }
});

const Game = mongoose.model('Game', gameSchema);
module.exports = Game;
