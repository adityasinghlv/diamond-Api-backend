const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let usercommissionreportSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true },
    throughId: { type: mongoose.Types.ObjectId, required: true },
    betId: { type: mongoose.Types.ObjectId, required: true },
    type: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    amount: { type: Number, required: true },
    status: { type: String, default: '1' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('usercommissionreport', usercommissionreportSchema);
