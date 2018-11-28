module.exports = function (subject, emailBody, from, emails, req, res) {
  var asynq         = require('async');
  var nodemailer    = require('nodemailer');
  var smtpTransport = require('nodemailer-smtp-transport');

  asynq.waterfall([
    function(callback) {
      console.log('first function');
      for (var i = 0; i < emails.length; i++) {
        var email = emails[i].trim();
        var transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'axedatacorp@gmail.com',
            pass: 'axetheshitoutofthemagain'
          }
        });
        var mailOptions = {
          to: email,
          from: from,
          subject: subject,
          html: emailBody
        };
        smtpTransport.sendMail(mailOptions, function(error, info) {
          if (err) {
            console.log(error); //Something Went Wrong
            callback(err);
          } else {
            console.log('Email Sent');
          }
        });
      }
      callback(null,'success');
    },
    function(result, callback){
      if(result === 'success'){
        callback(null,'done')
      }
    }
  ],
  function(err, result) {
    console.log('second function');
    if(err){
      res.send({
        success: false,
        message: 'There was a problem sending the email'
      });
    }
    else{
      res.send({
        success: true,
        message: 'Email Sent'
      });
    }
  });
}
