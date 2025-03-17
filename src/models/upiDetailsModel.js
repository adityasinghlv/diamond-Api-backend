const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let upiDetailSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required:true
    },
    upiDetails: {
        type: String
    },
    displayName: {
        type: String,
    },
    type: {
        type: String,
        default:"UPI"
    },
    status: {
        type: String,
        default:"1"
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('upidetail', upiDetailSchema);