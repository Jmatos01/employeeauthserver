module.exports = function(app, passport, socketio, isLoggedIn) {
  const crypto = require('crypto');
  const asynq = require('async');
  const nodemailer = require('nodemailer');
  const fs = require('fs-extra');
  const path = require('path');

  const User = require('../models/user');

  const io = socketio.io;
  const _unconfirmed = () => socketio.data().unconfirmed;
  const _unverified = () => socketio.data().unverified;
  const _get = (key) => socketio.get(key);
  const _del = (key, obj) => socketio.del(key, obj);
  const _put = (key, val, obj) => socketio.put(key, val, obj);
  const _map = (uid, sid) => socketio.map(uid, sid);

  const decode = require('../methods/decode');

  // CHECK FOR ACTIVE SESSION ==============================
  app.post('/user-session', isLoggedIn, function(req, res) {
    _map(req.user._id, req.body.socket_id);
   
    res.send({
      success: true,
      message: 'Active sesssion found',
      user: req.user
    });
  });

  
  // USER LOGOUT ==============================
  app.post('/user-sign-out', isLoggedIn, function(req, res) {
    _del(req.user._id, 'users');

    req.logout();
    
    res.send({
      success: true,
      message: 'Log out successful'
    });
  });


  // USER PASSWORD RECOVER ===============================
  app.post('/user-password-recovery', function(req, res, next) {
    asynq.waterfall([
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);
        });
      },
      function(token, done) {
        User.findOne({
          'email': req.body.email
        }, function(err, user) {

          if (!user) {
            return res.send({
              success: false,
              message: 'No user found'
            });
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
      function(token, user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'fviclass@gmail.com',
            pass: 'fviclass2017'
          }
        });
        var mailOptions = {
          to: user.email,
          from: 'Password Recovery',
          subject: 'Password Reset',
          text: `
            You are receiving this because you (or someone else) have requested the reset of the password for your account ${user.email}
            Please <a href="http://${req.headers.host}/user-verification/${token}">click here</a> to complete the process.\n
            If you did not request this, please ignore this email and your password will remain unchanged.
          `,
          html: `
          <p>
            You are receiving this because you (or someone else) have requested the reset of the password for your account ${user.email}
            Please <a href="http://${req.headers.host}/user-verification/${token}">click here</a> to complete the process.<br/>
            If you did not request this, please ignore this email and your password will remain unchanged.
          </p>`
        };

        smtpTransport.sendMail(mailOptions, function(err) {
          if(err) {
            return done(err);
          }

          console.log('>>>>>>>>>>>>>>>>>   ', req.body.socket_id);
          
// ============================================
          let socket = _get(req.body.socket_id);
          if (socket) {
            _put(token, socket, 'unverified');
          }
// ============================================

          return res.send({
            success: true,
            token: token,
            name: user.name,
            message: 'Hi ' + user.name.split(' ')[0] + ', an e-mail has been sent to ' + user.email
          });
        });
      }
    ], function (err, user) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        });
      }
      console.log('password reset email sent');
    });
  });


  // USER VERIFICATION ===============================
  app.get('/user-verification/:token', function(req, res) {
    var token = req.params.token;
    User.findOne({
        'resetPasswordToken': token,
        'resetPasswordExpires': {
          $gt: Date.now()
        }
      },
      function(err, user) {
        if (!user) {
          return res.render('emailverification.ejs', {
            success: false,
            message: 'Your token has expired.'
          });
        } else {

// ============================================
          var unverified = _unverified();

          // console.log('user >>>>>>>', unverified[token]); 

          if (unverified[token]) {
            unverified[token].emit('User Email Verified', {name: user.name.split(' ')[0], token: token});
            _del(token, 'unverified');
          }
// ============================================

          res.render('emailverification.ejs', {
            success: true,
            message: 'Now you can change your password.',
            name: user.name.split(' ')[0]
          });
        }

      });
  });


  // USER CHANGE PASSWORD ===============================
  app.post('/user-change-password/:token', function(req, res) {
    asynq.waterfall([
      function(done) {
        User.findOne({
            'resetPasswordToken': req.params.token,
            'resetPasswordExpires': {
              $gt: Date.now()
            }
          },
          function(err, user) {
            if (!user) {
              return res.send({
                success: false,
                message: 'Token expired.'
              });
            } else {
              user.password = user.generateHash(req.body.newPassword);
              user.resetPasswordToken = undefined;
              user.resetPasswordExpires = undefined;

              user.save(function(err) {
                done(err, user);
              });
            }
          });
      },
      function(user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'fviclass@gmail.com',
            pass: 'fviclass2017'
          }
        });
        var mailOptions = {
          to: user.email,
          from: 'Password Changed',
          subject: 'Your password has been changed',
          text: `Hi ${user.name},\n\n This is a confirmation that the password for your account ${user.email} has just been changed.`
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          done(err);
        });
      }
    ], function(err) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        });
      }
      console.log('password changed');
      return res.send({
        success: true,
        message: 'Your password has been updated successfully.'
      });
    });
  });


  // USER SIGNIN ===============================
  app.post('/user-sign-in', function(req, res, next) {
    passport.authenticate('user-sign-in', function(err, user, result) {
      if (err) {
        console.log('error authenticating user ', err);
        return res.send({
          success: false,
          message: 'Error authenticating user',
        });
      }

      if (!user) {
        return res.send(result);
      }

      req.logIn(user, function(err) {
        if (err) {
          console.log('error in user login ', err);
          return res.send({
            success: false,
            message: 'Error in user login',
          });
        }

        _map(req.user._id, req.body.socket_id);
    
        return res.send({
          success: true,
          message: 'Logged In Successfully',
          user: user
        });

      });
    })(req, res, next);
  });


  // USER SIGNUP =================================
  app.post('/user-sign-up', function(req, res, next) {
    passport.authenticate('user-sign-up', function(err, user, result) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        });
      }
      if (user){
        // console.log('>>>>>>>>> ', req.body.socket_id);
        let socket = _get(req.body.socket_id);
        if (socket) {
          _put(user.emailConfirmationToken, socket, 'unconfirmed');
        }

        if(req.body.image){
          let imageBuffer = decode(req.body.image);
          // console.log('image buffer ', imageBuffer);
          fs.mkdirs(path.join(rootDir, "/uploads/users/" + user.email), function (err) {
            if (err) {
              console.log(err);
            } else {

              let directory = path.join(rootDir, "/uploads/users/" + user.email);
              let fileName = 'avatar.jpg';

              // console.log('directory ', directory, fileName);

              fs.writeFile(path.join(directory, fileName), imageBuffer.data, function (err) {
                if (err) {
                  console.log(err);
                }

                io.emit('update image', user.email);

              });
            }
          });
        }
      }
      return res.send(result);
    })(req, res, next);
  });


  // USER UPDATE =============================
  app.post('/user-update', function(req, res, next){
    passport.authenticate('user-update', function (err, user, result) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        })
      }
      if (user) {
        if (req.body.image) {
          let imageBuffer = decode(req.body.image);
          // console.log('image buffer ', imageBuffer);
          fs.mkdirs(path.join(rootDir, "/uploads/users/" + user.email), function (err) {
            if (err) {
              console.log(err);
            } else {

              let directory = path.join(rootDir, "/uploads/users/" + user.email);
              let fileName = 'avatar.jpg';

              // console.log('directory ', directory, fileName);

              fs.writeFile(path.join(directory, fileName), imageBuffer.data, function (err) {
                if (err) {
                  console.log(err);
                }

                io.emit('update image', user.userId);
              });
            }
          });
        }

        return res.send({
          ...result,
          user: user,
        });
      }
      else {
        return res.send(result);
      }
    })(req, res, next);
  });


  // USER EMAIL CONFIRMATION ===============================
  app.get('/user-email-confirmation/:token', function(req, res) {
    var token = req.params.token;
    console.log(token);
    asynq.waterfall([
      function(done) {
        User.findOne({
            'emailConfirmationToken': token
          },
          function(err, user) {
            if (!user) {
              return res.redirect('/');
            }

            //Set the emailConfirmed to true.
            user.emailConfirmed = true;
            user.emailConfirmationToken = undefined;

            user.save(function(err) {
              if (err) {
                return res.render('emailconfirmation.ejs', {
                  success: false,
                  name: user.name.split(' ')[0]
                });
              }
              done(err, user);
            });
          }
        );
      },
      function(user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'fviclass@gmail.com',
            pass: 'fviclass2017'
          }
        });
        var mailOptions = {
          to: user.email,
          from: 'Email Confirmed',
          subject: 'Your email has been confirmed.',
          html: `Hello ${user.name},<br/> this is a confirmation that the email for your account ${user.email} has been confirmed.`
        };
        
        smtpTransport.sendMail(mailOptions);

// ============================================
        var unconfirmed   = _unconfirmed();
        console.log('>>>>>>>>>>>>> ', unconfirmed[token]);
        if (unconfirmed[token]) {
          unconfirmed[token].emit('User Email Confirmed', user.name.split(' ')[0]);
          _del(token, 'unconfirmed');
        }
// ============================================

        res.render('emailconfirmation.ejs', {
          success: true,
          name: user.name.split(' ')[0]
        });

      }
    ], function(err) {
      if (err) {
        return res.send({
          success: false,
          message: err.message
        });
      }
      console.log('Email Confirmed');
    });
  });
}
