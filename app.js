require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const moment = require("moment");
const mongoose = require("mongoose");

if (!process.env.MONGODB_URI) {
  console.error("[DB] MONGODB_URI is not set");
  process.exit(1);
}

const mongooseOptions = { useNewUrlParser: true, useUnifiedTopology: true };

mongoose.connect(process.env.MONGODB_URI, mongooseOptions).catch((err) => {
  console.error("[DB] Initial connection failed:", err.message);
});

mongoose.connection.on("connecting", () => {
  console.log("connecting");
  console.log(mongoose.connection.readyState);
});
mongoose.connection.on("connected", () => {
  console.log("connected");
  console.log(mongoose.connection.readyState);
});
mongoose.connection.on("error", (err) => {
  console.error("[DB] Connection error:", err.message);
});
mongoose.connection.on("disconnecting", () => {
  console.log("disconnecting");
  console.log(mongoose.connection.readyState);
});
mongoose.connection.on("disconnected", () => {
  console.log("disconnected");
  console.log(mongoose.connection.readyState);
});

const userSchema = new mongoose.Schema({
  id: String,
  username: String,
  room: String,
});
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const User = mongoose.model("User", userSchema);

app.use(express.static(path.join(__dirname, "public")));

const botName = "C.O.E. Bot";

function formatMessage(username, text) {
  return {
    username,
    text,
    time: moment().format("h:mm a"),
  };
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const newUser = new User({
      id: socket.id,
      username: username,
      room: room,
    });

    newUser.save(function (err, user) {
      if (err || !user) {
        console.error(
          "[DB] joinRoom save failed:",
          err?.message || "user undefined",
          { socketId: socket.id, username, room }
        );
        return;
      }

      socket.join(user.room);

      socket.emit("message", formatMessage(botName, "Welcome to C.O.E. !!"));

      socket.broadcast
        .to(user.room)
        .emit(
          "message",
          formatMessage(botName, `${user.username} has joined the chat`)
        );

      User.find({ room: user.room }, function (findErr, res) {
        if (findErr) {
          console.error("[DB] joinRoom list users failed:", findErr.message, {
            room: user.room,
          });
          return;
        }
        io.to(user.room).emit("roomUsers", {
          room: user.room,
          users: res,
        });
      });
    });
  });

  socket.on("chatMessage", (msg) => {
    User.findOne({ id: socket.id }, function (err, user) {
      if (err) {
        console.error("[DB] chatMessage lookup failed:", err.message, {
          socketId: socket.id,
        });
        return;
      }
      if (user) {
        io.to(user.room).emit("message", formatMessage(user.username, msg));
      } else {
        console.error("[DB] chatMessage: no user for socket", {
          socketId: socket.id,
        });
        socket.disconnect();
      }
    });
  });

  socket.on("disconnect", () => {
    User.findOneAndDelete({ id: socket.id }, function (err, user) {
      if (err) {
        console.error("[DB] disconnect delete failed:", err.message, {
          socketId: socket.id,
        });
        return;
      }
      if (!user) {
        console.error("[DB] disconnect: no user found for socket", {
          socketId: socket.id,
        });
        return;
      }

      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      User.find({ room: user.room }, function (findErr, res) {
        if (findErr) {
          console.error("[DB] disconnect list users failed:", findErr.message, {
            room: user.room,
          });
          return;
        }
        io.to(user.room).emit("roomUsers", {
          room: user.room,
          users: res,
        });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
