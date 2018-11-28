// set up ======================================================================
// get all the tools we need
const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const passport = require('passport');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const database = require('./database')();
const path = require('path');
const server = require('http').Server(app);
const socketio = require('./socket')(server);

// ALLOW CROSS ORIGIN COMUNICATION WITH THE SERVER 
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
  next();
});

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set up ejs for templating
app.set('view engine', 'ejs'); 

// required for passport
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  secret: '10172009',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use("/assets", express.static(__dirname + "/assets"));

global.rootDir = path.resolve(__dirname);

// initialize passport strategies
require('./passport')(passport); // pass passport for configuration

// initialize routes 
require('./routes')(app, passport, socketio); // load our routes and pass in our app and fully configured passport

// launch 
server.listen(port, function(err) {
  if (err) console.error(err);

  console.log('The magic happens on port ' + port);
});