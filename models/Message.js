const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  room: { type: String, required: true, index: true },
  text: { type: String, required: true },
  type: { type: String, enum: ["user", "bot"], default: "user" },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("Message", messageSchema);
