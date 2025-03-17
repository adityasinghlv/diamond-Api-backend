const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const casinoWebhookSchema = new mongoose.Schema({
  data: { type: Schema.Types.Mixed }
}, { timestamps: true, versionKey: false });

const casinoWebhookModel = mongoose.model('CasinoWebhook', casinoWebhookSchema);
module.exports = casinoWebhookModel;