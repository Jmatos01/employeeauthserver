const Message = require('./models/message');

const sockets = {};
const unconfirmed = {};
const unverified = {};
const users = {};

const data = () => ({ sockets: sockets, unconfirmed: unconfirmed, unverified: unverified });

const get = (key) => {
  return sockets[key] || users[key];
};

const del = (key, obj) => {
  if (obj === 'sockets') delete sockets[key];
  if (obj === 'unconfirmed') delete unconfirmed[key];
  if (obj === 'unverified') delete unverified[key];
  if (obj === 'users') delete users[key];
};

const put = (key, val, obj) => {
  if (obj === 'unconfirmed') unconfirmed[key] = val;
  if (obj === 'unverified') unverified[key] = val;
}

const map = (uid, sid) => {
  users[uid] = sockets[sid];
}

module.exports = function (server) {
  const io = require('socket.io')(server);

  io.on('connection', function (socket) {
    console.log('socket id ', socket.id);

    sockets[socket.id] = socket;

    socket.emit('connected', 'socket.io conection established');

    socket.on('MESSAGE', function (message) {
      // save in the database and emit to all users
      let newMessage = new Message(message);

      console.log('received message');

      newMessage.save()
        .then(message => {
          io.emit('MESSAGE', message);
        })
        .catch(err => console.error(err));
    });

    socket.on('error', function (err) {
      console.log("error " + err);
    });

    socket.on('disconnect', function () {
      delete sockets[socket.id];
    });
  });

  return {
    io: io,
    data: data,
    get: get,
    put: put,
    del: del,
    map: map
  };
}