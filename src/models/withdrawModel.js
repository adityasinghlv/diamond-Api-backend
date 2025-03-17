const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let withdrawSchema = new Schema({
    userid: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        index: true
    },
    accountHolderName: {
        type: String
        // required: true,
    },
    ifscCode: {
        type: String
        // required: true,
    },
    bankName: {
        type: String
        // required: true,
    },
    accountNumber: {
        type: String
        // required: true,
    },
    upi: {
        type: String
        // required: true,
    },
    amount: {
        type: Number,
        default: 0
        // required:true
    },
    beneld: {
        type: String,
        default: null
    },
    tranfer_id: {
        type: String,
        default: null
    },
    payout_id: {
        type: String,
        default: ''
    },
    withdraw_req_id: {
        type: String,
        default: null
    },
    comment: {
        type: String,
        default: ''
    },
    approved_date: {
        type: String
    },
    status: {
        type: Number,
        default: 0
    },
    status_description: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        default: null
    },
    paytm_number: {
        type: Number,
        default: null
    },
    withdrawfrom: {
        type: String,
        default: null
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    transaction_id: {
        type: String
    }

}, {
    timestamps: true,
    versionKey: false
});
module.exports = mongoose.model('withdraw', withdrawSchema);