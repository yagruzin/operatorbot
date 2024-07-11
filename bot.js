const express = require('express');
const app = express();
const mongoose = require('mongoose');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config(); // Подключение dotenv

const User = require('./models/User');

app.use('/photos', express.static(path.join(__dirname, 'photos')));
app.set('view engine', 'ejs');

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/yourdbname', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB', err);
});

// Настройка сервера Express для отображения таблицы
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.render('table', { users });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

// Запуск сервера Express
const port = 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

// Настройка и запуск бота Telegram
const token = process.env.TELEGRAM_BOT_TOKEN; // Получение токена из .env файла
const bot = new TelegramBot(token, { polling: true });

function generateId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await User.updateOne({ chatId }, { step: 0 }, { upsert: true });

  bot.sendMessage(chatId, "Բարի գալուստ! Ընտրեք վարորդական իրավունքի կատեգորիան:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Վարորդական B', callback_data: 'cert_B' },
          { text: 'Վարորդական BC', callback_data: 'cert_BC' }
        ]
      ]
    }
  });
});

// Обработка callback_query от кнопок выбора сертификата
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;

  if (data === 'cert_B' || data === 'cert_BC') {
    await User.updateOne({ chatId }, { certificate: data, step: 1 }, { upsert: true });

    const formattedMessage = `
    <b>Մուտքագրեք ձեր Անուն Ազգանուն Հայրանունը:</b>\n
    <i>(Խնդրում ենք ուշադրություն դարձնել, կեղծ ինֆորմացիա տրամադրելու դեպքում գործարքը կհամարվի փակված, իսկ ձեր օգտատերը արգելափակված)</i>\n
    Ինֆորմացիան ստուգվում է ՀՀ տվյալների բազայում:
  `;
    bot.sendMessage(chatId, formattedMessage, { parse_mode: 'HTML' });
  }
});

// Обработка сообщений от пользователя
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const user = await User.findOne({ chatId });

  if (!user || user.step === undefined) return;

  switch (user.step) {
    case 1:
      await User.updateOne({ chatId }, { fullName: text, step: 2 });
      bot.sendMessage(chatId,
        '<b>Մուտքագրեք ձեր ծննդյան օր, ամիս, տարեթիվը:</b>\n<i>(ՕՕ.ԱԱ.ՏՏՏՏ): (Օրինակ՝ 31.12.1999)</i>',
        { parse_mode: 'HTML' }
      );
      break;
    case 2:
      await User.updateOne({ chatId }, { birthDate: text, step: 3 });
      bot.sendMessage(chatId,
        '<b>Մուտքագրեք ձեր անձնագրի սերիան:</b>\n<i>Օրինակ՝ (AT6969000) 2 տառ և 7 թվանիշ</i>\n',
        { parse_mode: 'HTML' }
      );
      break;
    case 3:
      await User.updateOne({ chatId }, { passportNumber: text, step: 4 });
      bot.sendMessage(chatId,
        '<b>Մուտքագրեք ձեր անձնագրի նկարը:</b>\n<i>որտեղ պարզ կդիտվի ձեր լուսանկարը, գրանցման հասցեն (5րդ Էջի կնիքը) և անձնագրային տվյալները ՄԵԿ ԼՈՒՍԱՆԿԱՐՈՎ</i>\n<i>Խնդրում ենք ուշադրություն դարձնել, կեղծ ինֆորմացիա տրամադրելու դեպքում գործարքը կհամարվի փակված, իսկ ձեր օգտատերը արգելափակված</i>\nԻնֆորմացիան ստուգվում է ՀՀ տվյալների բազայում:',
        { parse_mode: 'HTML' }
      );
      break;
    default:
      break;
  }
});

// Обработка фотографии, отправленной пользователем
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user || user.step !== 4) return;

  const photoId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(photoId);
    const filePath = file.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileName = `${chatId}_${Date.now()}.jpg`;
    const fileDest = path.resolve(__dirname, 'photos', fileName);

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(fs.createWriteStream(fileDest));

    // Генерируем userId и сохраняем его в базе данных
    const userId = generateId();
    await User.updateOne({ chatId }, { photo: fileName, step: 5, userId });

    const cost = user.certificate === 'cert_B' ? 120000 : 200000;
    bot.sendMessage(chatId, `
      <b>Ձեր տվյալները բարեհաջող գրանցված են.</b> \nԽնդրում ենք վճարել ծառայության գումարը կրիպտոարժույթի տեսքով (USDT) կիսով չափ. Տվյալ դեպքում՝ ${cost / 2} ՀՀ ԴրամԻն համարժեք USDT.\n Վճարումից 2 աշխատանքային օր անց օպերատորը կկապնվի ձեզ հետ և կհայտնի Վարորդական Իրավունքը ձեզ փոխանցելու կանոնակարգը. \nԴուք նաև կստանաք անձնական իդենտիֆիկացիոն համար որով կարող եք ստուգել ձեր տվյալները։ \nՀրահանգների ցանկը դիտելու համար /help`, { parse_mode: 'HTML' });

    bot.sendMessage(chatId, `Կրիպտոարժույթով վճարման հասցեները:
      <b> USDT (Ցանցի տեսակ՝ TON):</b> <pre>UQBm063NILzl5iTv7-J43okvFj02do4mrFGSNTrpUy0d0WDp</pre>
      <b> USDT (Ցանցի տեսակ՝ ERC20):</b><pre>0x350af3370214539Fb718093FCE9901BFCD24CAD1</pre>
      <b> USDT (Ցանցի տեսակ՝ TRX):</b> <pre>TUVgBNBgFgwGPHgVv9NXe81gFME8KPe7YK</pre>`, { parse_mode: 'HTML' });

    bot.sendMessage(chatId, `Ձեր իդենտիֆիկացիոն համարը՝ <code>${userId}</code>`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('ERORR_MSGP', error);
    bot.sendMessage(chatId, 'Պատկերը պահպանելուց տեղի է ունեցել սխալ. Խնդրում ենք փորձել կրկին։');
  }
});

// Команда /pay для оплаты второй половины стоимости сертификата
bot.onText(/\/pay/, async (msg) => {
  const chatId = msg.chat.id;

  const user = await User.findOne({ chatId });

  if (!user || user.step !== 5) {
    bot.sendMessage(chatId, 'Ձեր տվյալները լրացված չեն կամ լրացվում են.');
    return;
  }

  const cost = user.certificate === 'cert_B' ? 150000 : 250000;

  bot.sendMessage(chatId, `Խնդրում ենք, Վճարեք վարորդական իրավունքի արժեքի երկրորդ մասը. Վճարի չափը՝ ${cost / 2} ՀՀ Դրամին համարժեք USDT. Շնորհակալություն!`);
  await User.updateOne({ chatId }, { step: 6 });
});

// Команда /restart для перезапуска процесса
bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  await User.deleteOne({ chatId });
  bot.sendMessage(chatId, 'Տվյալների լրացման պրոցեսսը զրոյացվեց. Սկսեք նորից /start հրահանգով։');
});

// Обработка команд /check и /search для проверки данных по идентификационному номеру
bot.onText(/^\/(check|search)(\s+)(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const userId = match[3].trim(); // Получаем идентификационный номер из сообщения и убираем лишние пробелы

  const user = await User.findOne({ userId });

  if (user) {
    const { fullName, birthDate, passportNumber, photo, certificate } = user;
    const message = `
      <b>Ձեր տվյալները:</b>
      <b>ФИО:</b> ${fullName}
      <b>Ծննդյան օր, ամիս, տարեթիվ:</b> ${birthDate}
      <b>Անձնագրի սերիան:</b> ${passportNumber}
      <b>Նկարը:</b> ${photo}
      <b>Վարորդական իրավունքի տեսակը:</b> ${certificate}
    `;
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, 'Տվյալ իդենտիֆիկացիոն համարով անձ չգտնվեց.');
  }
});

// Команда /help для вывода списка доступных команд и форматов данных
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
    <b>Հասանելի հրահանգների ցանկ:</b>
    /start - Սկսել տվյալների լրացման պրոցեսսը
    /check Իդենտիֆիկացիոն համար - Ստուգել ձեր տվյալները բազայում (Օրինակ՝ /check 6zxlAd87f)
    /search Իդենտիֆիկացիոն համար - Ստուգել ձեր տվյալները բազայում (Օրինակ՝ /search 6zxlAd87f)
    /pay - Վճարեք վարորդական իրավունքի արժեքի երկրորդ մասը։
    /restart - Պրոցեսիի զրոյացում
    <b>ԱԱՀ:</b> ԱՆՈՒՆ ԱԶԳԱՆՈՒՆ ՀԱՅՐԱՆՈՒն
    <b>ԾՆՆԴՅԱՆ ՕՐ, ԱՄԻՍ, ՏԱՐԵԹԻՎ:</b> ՕՕ.ԱԱ.ՏՏՏՏ (Օրինակ՝ 31.12.2000)
    <b>ԱՆՁՆԱԳՐԻ ՍԵՐԻԱՆ:</b> Օրինակ ՝ (AT6969000) 2 տառ և 7 թվանիշ)
    <b>ՆԿԱՐ:</b> Տվյալների լրացման պրոցեսսում կցված պատկերը
  `;
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});
