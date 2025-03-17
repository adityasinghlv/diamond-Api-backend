const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, 
  transferedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    // required: true 
  }, 
  matchId:{
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'betMatch',
  },
  betId:{
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'userbet',
  },
  casinoBetId:{
   type: String
  },
  casinoRoundId:{
   type: String
  },
  transactionType: { 
    type: String, 
    enum: ['credit', 'debit'], 
    required: true 
  }, 
  status: { 
    type: String, 
    enum: ['pending', 'confirm', 'failed'], 
    default: "confirm" 
  }, 
  transactionId: { 
    type: String, 
    unique: true, 
    required: true 
  }, 
  amount: { 
    type: Number, 
    required: true 
  },
  previousMainWallet: { 
    type: Number, 
    required: true 
  }, 
  currentMainWallet: { 
    type: Number, 
    required: true 
  }, 
  description: { 
    type: String, 
    default: '' 
  },
  type :{
    type: String,
    enum: ['deposit', 'withdraw', 'transfer', 'settlement','commission','betplace', 'deleteBet'],
    required: true
  },
  isSettlement: { 
    type: Boolean, 
    default: false 
  },
  betType :{
    type: String,
    enum: ['odds', 'bookmakers','fancy','other','casino'],
    default: 'other' 
 },
  parentTransactionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transaction', 
    default: null 
  },  
  createdAt: { 
    type: Date, 
    default: Date.now 
  } 
});

module.exports = mongoose.model('Transaction', transactionSchema);