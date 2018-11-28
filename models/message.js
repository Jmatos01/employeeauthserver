const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  uid: String,
  text: String,
  date: { type: Date, default: Date.now },
  name: String,
  email: String
});

module.exports = mongoose.model('Message', messageSchema);