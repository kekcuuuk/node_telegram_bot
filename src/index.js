const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const PARSE_RESULT_FILE_OPTIONS = {
  filename: 'Результат парсинга.xlsx',
  contentType:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const { findOrCreateChatSession } = require('./controllers/chatSession');
const {
  parseInstagramAccount,
  getInstagramUserInfo,
} = require('./utils/instagram');
const { asyncForEach } = require('./utils/common');

const TOKEN = process.env.BOT_TOKEN;
const url = process.env.URL;
const port = process.env.PORT;

const bot = new TelegramBot(TOKEN);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true })
  .then(() => console.log('Подключение к БД успешно!'))
  .catch(err => console.error(err));

bot.setWebHook(`${url}/bot${TOKEN}`);

const app = express();

app.use(bodyParser.json());

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Express server is listening on ${port}`);
});

const COMMAND_REG_EXP = /^\/([^\s]+)(?:\s((?:.|\n)*))?/;

bot.on('message', async msg => {
  const {
    text,
    chat: { id: chatId },
  } = msg;

  let regexpResult = COMMAND_REG_EXP.exec(text);
  if (!regexpResult) {
    const chatSession = await findOrCreateChatSession(chatId);
    const lastMessage = chatSession.lastMessage || '';

    regexpResult = COMMAND_REG_EXP.exec(text + lastMessage.text);

    chatSession.lastMessage = null;
    await chatSession.save();
  }

  if (!regexpResult) {
    bot.sendMessage(chatId, 'Это не те дроиды что ты ищешь...');

    return;
  }

  const [, command, argument] = regexpResult;
  processCommand({ command, argument, msg });
});

const START_MESSAGE = `Привет!
Я бот для поплурной сети Instragram
Для работы со мной можешь использовать две команды:
- */parse* поможет тебе собрать статистическую информацию
- */watch* позволит поставить слежение за аккаунтом (слежение за блокировкой)
`;
const startCommand = ({ msg }) => bot.sendMessage(msg.chat.id, START_MESSAGE);

const parseCommand = async ({ argument, msg }) => {
  if (!argument) {
    return bot.sendMessage(msg.chat.id, 'Необходимы аккаунты для парсинга');
  }

  const accountNames = argument.split('\n');
  const message = `Начинаю парсинг\nЗавершено %s/${accountNames.length}`;
  const botMessage = await bot.sendMessage(
    msg.chat.id,
    message.replace('%s', 0),
  );

  const parsedData = [];
  await asyncForEach(accountNames, async (accountName, index) => {
    parsedData.push(
      await parseInstagramAccount(accountName.trim().toLowerCase()),
    );
    bot.editMessageText(message.replace('%s', index + 1), {
      message_id: botMessage.message_id,
      chat_id: msg.chat.id,
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(parsedData, { header: 'A' });
  XLSX.utils.book_append_sheet(wb, ws, 'Результаты');

  bot.sendDocument(
    msg.chat.id,
    XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }),
    {
      reply_to_message_id: msg.message_id,
    },
    PARSE_RESULT_FILE_OPTIONS,
  );
};

const watchCommand = async ({ argument, msg }) => {
  const chatId = msg.chat.id;
  if (!argument) {
    return bot.sendMessage(chatId, 'Необходим аккаунт для слежения');
  }

  const accountName = argument.trim().toLowerCase();
  const instaUser = await getInstagramUserInfo(accountName);

  if (!instaUser) {
    bot.sendMessage(
      chatId,
      `Похоже аккаунт ${accountName} не существует или уже заблокирован. Попробуй другой.`,
    );

    return;
  }

  const chatSession = await findOrCreateChatSession(chatId);

  const watchAccounts = chatSession.watchAccounts || [];
  watchAccounts.push(accountName);

  chatSession.watchAccounts = watchAccounts;

  try {
    const result = await chatSession.save();
    console.log('Результат сохранения', result);
    bot.sendMessage(
      chatId,
      `Аккаунт ${accountName} был успешно добавлен для отслеживания!`,
    );
  } catch (err) {
    console.log('Ошибка при сохранении пользователя', err);
    bot.sendMessage(
      chatId,
      `При добавлении аккаунта ${accountName} Возникла ошибка. Попробуй позднее :(`,
    );
  }
};

const SUPPORTED_COMMANDS = {
  start: startCommand,
  parse: parseCommand,
  watch: watchCommand,
};

const processCommand = ({ command, ...params }) => {
  if (command in SUPPORTED_COMMANDS) {
    return SUPPORTED_COMMANDS[command](params);
  }

  return bot.sendMessage(params.msg.chat.id, 'что ты сказал про мою маму?! ©');
};
