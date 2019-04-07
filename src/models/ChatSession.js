const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  chatId: String,
  watchAccounts: Array,
});

module.exports = mongoose.model('ChastSession', ChatSessionSchema);
