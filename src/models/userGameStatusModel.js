const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userGameStatusSchema = new Schema(
  {
    gameId: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

const UserGameStatus = mongoose.model('UserGameStatus', userGameStatusSchema);
module.exports = UserGameStatus;