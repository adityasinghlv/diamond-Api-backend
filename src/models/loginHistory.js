const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let loginHistory = new Schema({
    userId: { type: mongoose.Types.ObjectId, ref: 'users', index: true, required: true },
    login_method:{
        type:String
    },
    country:{
        type:String
    },
    ip_address:{
        type:String
    },
    city:{
        type:String
    }
}, {
    timestamps: true,
    versionKey: false
})
module.exports = mongoose.model('login_history', loginHistory);