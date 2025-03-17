const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
    {
        _id: {
            type: Number,
            required: true,
        },
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        status: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true, 
    }
);

module.exports = mongoose.model('Category', categorySchema);
