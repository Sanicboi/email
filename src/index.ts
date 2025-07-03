import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { AppState, Waiter } from "./state";
import path from "path";
import axios, { AxiosResponse } from "axios";
import { determineType } from "./determiner";
import { replyToMessage } from "./writer";
import { evaluateResponse } from "./evaluator";

const bot = new TelegramBot(process.env.TG_TOKEN!, {
  polling: true,
});
const state = new AppState();

bot.setMyCommands([
  {
    command: "start",
    description: "Начать новый диалог",
  },
  {
    command: "info",
    description: "Информация",
  },
  {
    command: "settings",
    description: "Настройки",
  },
]);

bot.onText(/\/start/, async (msg) => {
  state.waiter = null;
  state.resId = null;
  bot.sendMessage(msg.chat.id, state.firstMsg);
});

bot.onText(/\/info/, async (msg) => {
  bot.sendMessage(msg.chat.id, "");
});

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
        "Файл для данной настройки должен быть .txt",
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
  if (msg.text.startsWith("/")) return;
  if (state.waiter) return;

  {
    await bot.sendMessage(msg.chat.id, "Запускаю определителя...");
    const res = await determineType(state.resId, state.kbId, msg.text);
    await bot.sendMessage(
      msg.chat.id,
      `Результат определения:\nВажность:${res.importance}/10\nДействие:${res.type}`,
    );
    if (res.type !== "reply") return;
  }
  await bot.sendMessage(msg.chat.id, "Генерирую ответ...");
  let generation = await replyToMessage(
    state.resId,
    state.kbId,
    msg.text,
    state.prompt,
  );
  await bot.sendMessage(msg.chat.id, generation.text);

  await bot.sendMessage(msg.chat.id, "Запускаю оценку...");
  let evaluation = await evaluateResponse(generation.id, state.kbId);
  await bot.sendMessage(
    msg.chat.id,
    `Оценка:${evaluation.rating}\nКомментарий:${evaluation.comment}`,
  );

  let count = 1;

  while (count < 3 && evaluation.rating <= 3) {
    await bot.sendMessage(
      msg.chat.id,
      "Оценка ниже 3х. Переделываю и переоцениваю...",
    );
    generation = await replyToMessage(
      generation.id,
      state.kbId,
      `Подкорректируй свой ответ, вот комментарий: ${evaluation.comment}`,
      state.prompt,
      true,
    );
    await bot.sendMessage(msg.chat.id, generation.text);
    evaluation = await evaluateResponse(generation.id, state.kbId);
    await bot.sendMessage(
      msg.chat.id,
      `Оценка:${evaluation.rating}\nКомментарий:${evaluation.comment}`,
    );
    count++;
  }

  if (count === 3) {
    await bot.sendMessage(msg.chat.id, "Оценка не пройдена!");
  }

  state.resId = generation.id;
});
