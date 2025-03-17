const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, 
  title: { type: String, required: true }, 
  message: { type: String, required: true }, 
  type: { 
    type: String, 
    enum: ['info', 'warning', 'error', 'success','delete-bets'], 
    default: 'info' 
  },
  betIds: { type: [mongoose.Schema.Types.ObjectId], default: null },
  matchId: { type: mongoose.Schema.Types.ObjectId, default: null },
  selectionId: { type:String, default: null },
  betType: { type: String },
  isRead: { type: Boolean, default: false }, 
  createdAt: { type: Date, default: Date.now }, 
  isDeleted: { type: Boolean, default: false } 
});

module.exports = mongoose.model('Notification', notificationSchema);
