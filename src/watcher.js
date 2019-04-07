const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const { findChatSessionsWithWatch } = require('./controllers/chatSession');
const { getInstagramUserInfo } = require('./utils/instagram');
const { asyncForEach } = require('./utils/common');

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true })
  .then(() => console.log('Подключение к БД успешно!'))
  .catch(err => console.error(err));

const bot = new TelegramBot(process.env.BOT_TOKEN);

const run = async () => {
  const chatSessionsWithWatch = await findChatSessionsWithWatch();

  console.info(
    `Нашли ${chatSessionsWithWatch.length} аккаунта с наблюдениями.`,
  );

  await asyncForEach(chatSessionsWithWatch, async chatSession => {
    await asyncForEach(
      chatSession.watchAccounts,
      async (accountName, index) => {
        if (!(await getInstagramUserInfo(accountName))) {
          bot.sendMessage(
            chatSession.chatId,
            `Что то не так с аккаунтом ${accountName}!`,
          );

          chatSession.watchAccounts = chatSession.watchAccounts.splice(
            index,
            1,
          );
          console.log(chatSession.watchAccounts.splice(index, 1));

          try {
            const result = await chatSession.save();
            console.log('Результат сохранения', result);
          } catch (err) {
            console.log('Ошибка при сохранении пользователя', err);
            bot.sendMessage(
              chatSession.chatId,
              `При добавлении аккаунта ${accountName} Возникла ошибка. Попробуй позднее :(`,
            );
          }
        }
      },
    );
  });
};
setInterval(async () => {
  try {
    await run();
  } catch (err) {
    console.error('Возникла ошибка', err);
  }
}, 1000);
