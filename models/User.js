const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  step: { type: Number, required: true },
  certificate: String,
  fullName: String,
  birthDate: String,
  passportNumber: String,
  photo: String,
  userId: { type: String, unique: true } 
});

module.exports = mongoose.model('User', userSchema);
