const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let roleSchema = new Schema({
    role_name: {
        type: String,
        required: true,  
        unique: true    
    },
    admin_route_permission: {
        type: [String], 
        default: []      
    },
    status: {
        type: String,
        enum: ['active', 'inactive'], 
        default: 'active'  
    },
    role_order: {
        type: Number,
        required: true,
        unique: true
    }
}, {
    timestamps: true, 
    versionKey: false  
});

module.exports = mongoose.model('Role', roleSchema);
