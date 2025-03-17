const mongoose = require('mongoose');

const casinoLogsSchema = new mongoose.Schema({
  data:{ type:String, default:""}
},{ timestamps: true, versionKey: false });

const CasinoLog = mongoose.model('CasinoLog', casinoLogsSchema);
module.exports = CasinoLog;