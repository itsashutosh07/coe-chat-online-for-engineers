const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const moment = require('moment');
const mongoose = require('mongoose');
mongoose.connect('mongodb://AshutoshAdmin:abcd1234@ashutoshwebchatapp-shard-00-00.ovcla.mongodb.net:27017,ashutoshwebchatapp-shard-00-01.ovcla.mongodb.net:27017,ashutoshwebchatapp-shard-00-02.ovcla.mongodb.net:27017/usersDB?ssl=true&replicaSet=atlas-g8bqwp-shard-0&authSource=admin&retryWrites=true&w=majority', {useNewUrlParser: true, useUnifiedTopology: true})


// console.log(mongoose.connection.readyState); //logs 0
mongoose.connection.on('connecting', () => { 
  console.log('connecting')
  console.log(mongoose.connection.readyState); //logs 2
});
mongoose.connection.on('connected', () => {
  console.log('connected');
  console.log(mongoose.connection.readyState); //logs 1
});
mongoose.connection.on('disconnecting', () => {
  console.log('disconnecting');
  console.log(mongoose.connection.readyState); // logs 3
});
mongoose.connection.on('disconnected', () => {
  console.log('disconnected');
  console.log(mongoose.connection.readyState); //logs 0
});
const userSchema = new mongoose.Schema(
  {
    id : String,
    username : String,
    room : String
  }
)
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const User = mongoose.model('User', userSchema);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'C.O.E. Bot';


function formatMessage(username, text) {
  return {
    username,
    text,
    time: moment().format('h:mm a')
  };
}

// Run when client connects
io.on('connection', socket => {

  socket.on('joinRoom', ({ username, room }) => {
    const newUser = new User({
      id : socket.id,
      username: username,
      room : room
    })

    newUser.save(function(err,user){
      socket.join(user.room);

      // Welcome current user
      socket.emit('message', formatMessage(botName, 'Welcome to C.O.E. !!'));

      // Broadcast when a user connects
      socket.broadcast
        .to(user.room)
        .emit(
          'message',
          formatMessage(botName, `${user.username} has joined the chat`)
        );

      // Send users and room info
      // io.to(user.room).emit('roomUsers', {
      //   room: user.room,
      //   users: getRoomUsers(user.room)
      // });

      User.find({room : user.room}, function(err, res){
        io.to(user.room).emit('roomUsers', {
          room : user.room,
          users : res
        })
      })
    });

    })



  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    // console.log('Mesaage Aaya');
    // const user = getCurrentUser(socket.id);

    User.findOne({id : socket.id}, function(err, user){
      if(err)
      {
        console.log(err);
      }
      else
      {
          // console.log(formatMessage(user.username,msg));
          if(user){
            io.to(user.room).emit('message', formatMessage(user.username, msg));

          }
          else{
            socket.disconnect()
          }

      }
    })
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {

    User.findOneAndDelete({id : socket.id }, function(err, user){
      if(err){
        console.log(err);
      }
      else{
        // return userFound;
        io.to(user.room).emit(
          'message',
          formatMessage(botName, `${user.username} has left the chat`)
        );

        // Send users and room info
        User.find({room : user.room}, function(err, res){
          io.to(user.room).emit('roomUsers', {
            room : user.room,
            users : res
          })
        })
      }
    })

  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
