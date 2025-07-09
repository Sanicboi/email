import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { AppState, Waiter } from "./state";
import path from "path";
import axios, { AxiosResponse } from "axios";
import { determineType } from "./determiner";
import { replyToMessage } from "./writer";
import { evaluateResponse } from "./evaluator";
import mailer from "nodemailer";
import { ImapFlow, ImapFlowOptions } from "imapflow";
import { respond, sendFirst } from "./ai";

const bot = new TelegramBot(process.env.TG_TOKEN!, {
  polling: true,
});
const state = new AppState();

const poll = async () => {
  const config: ImapFlowOptions = {
    host: "imap.yandex.ru",
    port: 993,
    secure: true,
    auth: {
      user: "adamarttech@yandex.ru",
      pass: process.env.YANDEX_PASS,
    },
  };
  const client = new ImapFlow(config);

  try {
    await client.connect();

    let lock = await client.getMailboxLock("INBOX");
    try {
      const searchCriteria = ["UNSEEN"];
      const messageUids = await client.search({
        seen: false,
      });

      if (!messageUids) {
        console.log("no messages");
      } else {
        for await (let message of client.fetch(messageUids, {
          envelope: true,
          source: true,
        })) {
          if (message.envelope?.from) {
            if (message.envelope.from[0].address === state.email) {
              await respond(message.source!.toString(), state);
            }
          }

          await client.messageFlagsAdd(message, ["\\Seen"]);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error) {
    console.error(error);
  }
};

bot.setMyCommands([
  {
    command: "info",
    description: "Информация",
  },
  {
    command: "settings",
    description: "Настройки",
  },
  {
    command: 'mail',
    description: 'Запустить рассылку'
  }
]);

bot.onText(/\/start/, async (msg) => {
  state.waiter = null;
  state.resId = null;
  bot.sendMessage(msg.chat.id, state.firstMsg);
});

bot.onText(/\/info/, async (msg) => {
  bot.sendMessage(msg.chat.id, "");
});

bot.onText(/\/mail/, async (msg) => {
  state.waiter = null;
  state.resId = null;
  sendFirst(state);
})

bot.onText(/\/settings/, async (msg) => {
  bot.sendMessage(msg.chat.id, "Найстройки", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "База знаний",
            callback_data: "set-kb",
          },
        ],
        [
          {
            text: "Промпт",
            callback_data: "set-prompt",
          },
        ],
        [
          {
            text: "Первое сообщение",
            callback_data: "set-first",
          },
        ],
        [
          {
            text: 'Имейл для отправки',
            callback_data: 'set-email'
          }
        ]
      ],
    },
  });
});

bot.on("callback_query", async (q) => {
  if (q.data?.startsWith("set-")) {
    const waiter = q.data.split("-")[1] as Waiter;
    state.waiter = waiter;
    bot.sendMessage(q.from.id, "Пришлите мне новое значение файлом");
  }
});

bot.on("document", async (msg) => {
  if (!msg.document) return;
  if (!state.waiter) return;

  const url = await bot.getFileLink(msg.document.file_id);
  const res: AxiosResponse<Buffer> = await axios.get(url, {
    responseType: "arraybuffer",
  });
  if (state.waiter !== "kb") {
    const extName = path.extname(url);
    if (extName !== ".txt") {
      bot.sendMessage(
        msg.chat.id,
        "Файл для данной настройки должен быть .txt"
      );
      return;
    }
    const val: string = res.data.toString("utf-8");
    switch (state.waiter) {
      case "first":
        state.firstMsg = val;
        break;
      default:
        state.prompt = val;
        break;
    }
  } else {
    await state.setKb(path.basename(url), res.data);
  }

  state.resId = null;
  state.waiter = null;
  bot.sendMessage(msg.chat.id, "Найстройка изменена");
});

bot.onText(/./, async (msg) => {
  if (!msg.text) return;
  if (state.waiter != 'email') return;
  state.email = msg.text;
  state.waiter = null;

  await bot.sendMessage(msg.from!.id, 'Имейл изменен');
})

setInterval(poll, 10000);