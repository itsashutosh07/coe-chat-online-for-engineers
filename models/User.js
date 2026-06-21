const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  lastSeen: { type: Date, default: Date.now },
});

userSchema.index({ room: 1, username: 1 });
userSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 120 });

module.exports = mongoose.model("User", userSchema);
