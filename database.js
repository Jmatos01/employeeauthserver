const mongoose = require('mongoose');
module.exports = function () {
  mongoose.connect('mongodb://localhost:27017/tmail', { useNewUrlParser: true });
}