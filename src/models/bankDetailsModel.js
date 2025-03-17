const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let bankDetailsSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required:true
    },
    AccountNumber: {
        type: String
    },
    bankName: {
        type: String,
    },
    type: {
        type: String,
        default:'Bank Transfer'
    },
    ifscCode: {
        type: String,
    },
    accHolderName: {
        type: String,
    },
    status: {
        type: String,
        default:'1'
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('bankdetail', bankDetailsSchema);