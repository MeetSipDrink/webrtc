'use strict';

let os = require('os');
let nodeStatic = require('node-static');
const https = require('https');
let socketIO = require('socket.io');
const fs = require('fs');

const options = {
  key: fs.readFileSync('./private.pem'),
  cert: fs.readFileSync('./public.pem')
};

let fileServer = new(nodeStatic.Server)();
let app = https.createServer(options, (req, res) => {
  fileServer.serve(req, res);
}).listen(3000);

console.log('Started chatting server...');

let io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    let array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    if (message === "bye" && socket.rooms['foo']) {
      io.of('/').in('foo').clients((error, socketIds) => {
        if (error) throw error;

        socketIds.forEach(socketId => {
          io.sockets.sockets[socketId].leave('foo');
        });
      });
    }
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    let clientsInRoom = io.sockets.adapter.rooms[room];
    let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
      console.log('created');
    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
      console.log('joined')
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    let ifaces = os.networkInterfaces();
    for (let dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});