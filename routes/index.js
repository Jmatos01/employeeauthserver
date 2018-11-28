module.exports = function (app, passport, socketio) {
  // messages routes
  require('./messages')(app, isLoggedIn);

  // auth routes
  require('./auth')(app, passport, socketio, isLoggedIn);
}

// MIDDLEWARE TO ENSURE USER IS LOGGED IN ====================================
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } 
  else {
    res.send({
      active: false,
      message: 'No Session Found'
    });
  }
}