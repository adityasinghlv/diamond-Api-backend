const mongoose = require('mongoose');
const { Schema } = mongoose;


const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  roleId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index:true
    },
  accountType: { type: String, required: true, enum: ['super-admin','demo-user', 'master', 'agent', 'user'] },
  status: { type: String, default:'active', enum: ['active', 'suspended'] },
  commission: { type: Number, required: true },
  commissionBalance: { type: Number, required: true,default:0 },
  openingBalance: { type: Number, default: 0 },
  profitLossBalance: { type: Number, default: 0 },
  totalBalance: { type: Number, default: 0 },
  creditReference: { type: Number, default: 0 },
  mobileNumber: { type: String, required: true },
  refer_code:{ type: String },
  ipAddress :{ type: String },
  exposer: { type: Number, default: 0 },
  country :{ type: String, default:"India" },
  partnership: { type: Number }, 
  firstTime:{ type: Boolean, default: true },
  password: { type: String, required: true },
  rollingCommission: {
    fancy: { type: Number, default: 0 },
    matka: { type: Number, default: 0 },
    casino: { type: Number, default: 0 },
    binary: { type: Number, default: 0 },
    sportbook: { type: Number, default: 0 },
    bookmaker: { type: Number, default: 0 }
  },
  agentRollingCommission: {
    fancy: { type: Number, default: 0 },
    matka: { type: Number, default: 0 },
    casino: { type: Number, default: 0 },
    binary: { type: Number, default: 0 },
    sportbook: { type: Number, default: 0 },
    bookmaker: { type: Number, default: 0 }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  token: { type: String },
  createdAt: { type: Date, default: Date.now },
  exposureLimit: { 
    type: Number, 
    default: 0,  
    required: function() { return this.accountType === 'user'; } 
  },
  betBidValue : {type: [mongoose.Schema.Types.Mixed], default: ['100','200','500','1000','2000','5000','10000','25000','50000']},
  color : {type: [Schema.Types.Mixed], default: ['red']},
  isDeleted: { type: Boolean, default: false }, 
  deletedAt: { type: Date },
});

module.exports = mongoose.model('User', userSchema);
