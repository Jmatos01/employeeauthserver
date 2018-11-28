const Message = require('../models/message');

module.exports = function (app) {
  app.get('/messages', function(req, res) {
    Message.find({}, function(err, messages) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        });
      }

      res.send({
        success: true,
        messages: messages
      });
    })
  });
}