const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let qrdetailsSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required:true
    },
    image: {
        type: String
    },
    displayName: {
        type: String,
    },
    type: {
        type: String,
        default:"QR Code"
    },
    status: {
        type: String,
        default:"1"
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('qrdetail', qrdetailsSchema);