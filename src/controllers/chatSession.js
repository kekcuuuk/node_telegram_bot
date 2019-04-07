const ChatSession = require('../models/ChatSession');

const checkIfChatSessionExists = async chatId =>
  await ChatSession.findOne({ chatId }).exec();

const createChatSession = chatId => {
  const chatSession = { chatId };

  return new ChatSession(chatSession).save();
};

const findOrCreateChatSession = async chatId => {
  const chatSession = await checkIfChatSessionExists(chatId);

  return chatSession || createChatSession(chatId);
};

const findChatSessionsWithWatch = async () =>
  await ChatSession.find({
    watchAccounts: { $exists: true, $not: { $size: 0 } },
  }).exec();

module.exports = {
  findOrCreateChatSession,
  findChatSessionsWithWatch,
};
