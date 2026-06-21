const moment = require("moment");
const User = require("../models/User");
const Message = require("../models/Message");
const formatMessage = require("../utils/formatMessage");

const BOT_NAME = "C.O.E. Bot";
const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT, 10) || 50;
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 500;
const MESSAGE_RATE_MS = 500;

function sanitizeUsername(username) {
  if (typeof username !== "string") return null;
  const trimmed = username.trim();
  if (!trimmed || trimmed.length > 30) return null;
  if (!/^[a-zA-Z0-9_\-\s.]+$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeRoom(room) {
  if (typeof room !== "string") return null;
  const trimmed = room.trim();
  if (!trimmed || trimmed.length > 50) return null;
  return trimmed;
}

async function emitRoomUsers(io, room) {
  const users = await User.find({ room }).select("username id").lean();
  io.to(room).emit("roomUsers", { room, users });
}

async function emitRoomDirectory(io) {
  const rooms = await User.aggregate([
    { $group: { _id: "$room", count: { $sum: 1 } } },
    { $project: { room: "$_id", count: 1, _id: 0 } },
    { $sort: { room: 1 } },
  ]);
  io.emit("roomDirectory", rooms);
}

function registerSocketHandlers(io, socket) {
  let currentRoom = null;

  socket.on("getRooms", async () => {
    try {
      const rooms = await User.aggregate([
        { $group: { _id: "$room", count: { $sum: 1 } } },
        { $project: { room: "$_id", count: 1, _id: 0 } },
        { $sort: { room: 1 } },
      ]);
      socket.emit("roomDirectory", rooms);
    } catch (err) {
      console.error("[Socket] getRooms failed:", err.message);
    }
  });

  socket.on("joinRoom", async ({ username, room }) => {
    try {
      const cleanUsername = sanitizeUsername(username);
      const cleanRoom = sanitizeRoom(room);

      if (!cleanUsername || !cleanRoom) {
        socket.emit("joinError", { message: "Invalid username or room." });
        return;
      }

      const existing = await User.findOne({
        room: cleanRoom,
        username: { $regex: new RegExp(`^${cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });

      if (existing) {
        socket.emit("joinError", {
          message: `"${cleanUsername}" is already in ${cleanRoom}. Pick another name.`,
        });
        return;
      }

      const user = await User.create({
        id: socket.id,
        username: cleanUsername,
        room: cleanRoom,
        lastSeen: new Date(),
      });

      currentRoom = user.room;
      socket.join(user.room);

      const history = await Message.find({ room: user.room })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      const formattedHistory = history
        .reverse()
        .map((msg) => ({
          username: msg.username,
          text: msg.text,
          time: moment(msg.createdAt).format("h:mm a"),
          type: msg.type,
        }));

      socket.emit("messageHistory", {
        messages: formattedHistory,
        hasMore: history.length === HISTORY_LIMIT,
      });

      socket.emit("message", formatMessage(BOT_NAME, "Welcome to C.O.E. !!", "bot"));

      socket.broadcast
        .to(user.room)
        .emit(
          "message",
          formatMessage(BOT_NAME, `${user.username} has joined the chat`, "bot")
        );

      await emitRoomUsers(io, user.room);
      await emitRoomDirectory(io);
    } catch (err) {
      console.error("[Socket] joinRoom failed:", err.message);
      socket.emit("joinError", { message: "Could not join room. Try again." });
    }
  });

  socket.on("chatMessage", async (msg) => {
    try {
      if (typeof msg !== "string") return;

      const text = msg.trim();
      if (!text || text.length > MAX_MESSAGE_LENGTH) return;

      const now = Date.now();
      if (socket._lastMessage && now - socket._lastMessage < MESSAGE_RATE_MS) {
        return;
      }
      socket._lastMessage = now;

      const user = await User.findOne({ id: socket.id });
      if (!user) {
        socket.emit("joinError", { message: "Session expired. Please rejoin." });
        socket.disconnect();
        return;
      }

      user.lastSeen = new Date();
      await user.save();

      const saved = await Message.create({
        username: user.username,
        room: user.room,
        text,
        type: "user",
      });

      const payload = formatMessage(saved.username, saved.text, "user");
      io.to(user.room).emit("message", payload);
    } catch (err) {
      console.error("[Socket] chatMessage failed:", err.message);
    }
  });

  socket.on("typing", async () => {
    try {
      const user = await User.findOne({ id: socket.id });
      if (!user) return;
      socket.to(user.room).emit("typing", { username: user.username });
    } catch (err) {
      console.error("[Socket] typing failed:", err.message);
    }
  });

  socket.on("stopTyping", async () => {
    try {
      const user = await User.findOne({ id: socket.id });
      if (!user) return;
      socket.to(user.room).emit("stopTyping", { username: user.username });
    } catch (err) {
      console.error("[Socket] stopTyping failed:", err.message);
    }
  });

  socket.on("heartbeat", async () => {
    try {
      await User.updateOne({ id: socket.id }, { lastSeen: new Date() });
    } catch (err) {
      console.error("[Socket] heartbeat failed:", err.message);
    }
  });

  socket.on("leaveRoom", async () => {
    try {
      const user = await User.findOneAndDelete({ id: socket.id });
      if (!user) return;

      currentRoom = null;
      socket.leave(user.room);

      io.to(user.room).emit(
        "message",
        formatMessage(BOT_NAME, `${user.username} has left the chat`, "bot")
      );

      await emitRoomUsers(io, user.room);
      await emitRoomDirectory(io);
    } catch (err) {
      console.error("[Socket] leaveRoom failed:", err.message);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const user = await User.findOneAndDelete({ id: socket.id });
      if (!user) return;

      io.to(user.room).emit(
        "message",
        formatMessage(BOT_NAME, `${user.username} has left the chat`, "bot")
      );

      await emitRoomUsers(io, user.room);
      await emitRoomDirectory(io);
    } catch (err) {
      console.error("[Socket] disconnect failed:", err.message);
    }
  });
}

module.exports = registerSocketHandlers;
