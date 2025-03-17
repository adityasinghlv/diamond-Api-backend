const mongoose = require('mongoose');
const { Schema } = mongoose;

const referCodeSchema = new Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      default: null,
      ref: 'User',
    },
    referCode: {
      type: String,
      default: '',
      unique: true,
    },
    referLink: {
      type: String,
      default: '',
    },
    commissionRate: {
      type: Number,
      default: 0,
    },
    commissionEarned: {
      type: Number,
      default: 0,
    },
    totalClaimed: {
      type: Number,
      default: 0,
    },
    totalAvailable: {
      type: Number,
      default: 0,
    },
    claimed: {
      type: Number,
      default: 0,
    },
    refs: {
      type: Number,
      default: 0,
    },
    wagered: {
      type: Number,
      default: 0,
    },
    claim: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('ReferCode', referCodeSchema);
