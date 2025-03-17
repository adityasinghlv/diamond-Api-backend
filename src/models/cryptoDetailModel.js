const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let cryptoDetailSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        required:true
    },
    network: {
        type: String
    },
    displayName: {
        type: String,
    },
    type: {
        type: String,
        default:"crypto"
    },
    status: {
        type: String,
        default:"1"
    }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('cryptodetail', cryptoDetailSchema);