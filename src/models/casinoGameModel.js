const mongoose = require('mongoose');

const casinoGameSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        gameId: {
            type: Number,
            required: true,
        },
        launchId: {
            type: String,
            required: true,
        },
        iFrameId: {
            type: String,
            required: true, // Store the specific iFrame ID (e.g., "70014_8")
        },
        category: {
            type: Number,
            ref: 'Category', 
            required: true,
        },
        provider: {
            type: String,
            trim: true,
        },
        imgUrl: {
            type: String,
            trim: true,
            default : ""
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

module.exports = mongoose.model('Casinogame', casinoGameSchema);
