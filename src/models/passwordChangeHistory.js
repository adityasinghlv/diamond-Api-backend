const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const passwordChangeHistorySchema = new Schema(
  {
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    changedBy: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    remarks: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('passwordChangeHistory', passwordChangeHistorySchema);
