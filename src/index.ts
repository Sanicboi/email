import { AppDataSource } from "./data-source";
import { Agent, AgentInputItem, run } from "@openai/agents";
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import fs, { read, write } from "fs";
import path from "path";
import { z } from "zod";
import axios, { AxiosResponse } from "axios";

/**
 * AI configuration object
 */
interface IConfig {
  /**
   * The path to knowledge base
   */
  kb: string;
  /**
   * The prompt
   */
  prompt: string;
  /**
   * The model
   */
  model: string;
  /**
   * The first message
   */
  firstMessage: string;
}



let thread: AgentInputItem[] = [];
let waiter: "none" | keyof IConfig = "none";
let config: IConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "ai.config.json"), "utf-8")
);

const readKB = (): string => {
  if (!config.kb) throw new Error("No kb!");
  return fs.readFileSync(
    path.join(process.cwd(), "data", config.kb),
    "utf-8"
  )
}

const getWriterInstructions = (): string => {
  let result: string = `${config.prompt}`
  if (config.kb) result += `${config.prompt}\n\n\nБаза знаний:${readKB()}`;
  return result;
};

const getValidatorInstructions = (): string => {
  let result: string = `Ты - менеджер по продажам. Тебе будет дана цепочка писем. Убедись, что последнее сообщение соответствует требованиям, указанным в Базе знаний. В ответе укажи соответсвует ли оно и дай комментарий (почему)`;
  if (config.kb) result += `${config.prompt}\n\n\nБаза знаний:${readKB()}`;
  return result;
}

const getDeterminerInstructions = (): string => {
  return `Ты - менеджер по продажам. Тебе будет дана цепочка писем. Определи, нужно ли отвечать на последнее электронное письмо, и объясни, почему. В ответе укажи результат определения (answer) и комментарий (comment)`
}
const bot = new TelegramBot(process.env.TG_TOKEN!, {
  polling: true,
});

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
    command: "prompt",
    description: "Изменить промпт",
  },
  {
    command: "kb",
    description: "Изменить Базу знаний (текстовый файл)",
  },
  {
    command: "model",
    description: "Изменить модель",
  },
  {
    command: "first",
    description: "Изменить первое сообщение",
  },
  {
    command: "info",
    description: "Информация",
  },
]);

const writer = new Agent({
  name: "МОП",
  model: config.model,
  instructions: getWriterInstructions,
});

const validator = new Agent({
  name: "Валидатор",
  model: config.model,
  instructions: getValidatorInstructions,
  outputType: z.object({
    ok: z.boolean(),
    comment: z.string(),
  }),
});

const determiner = new Agent({
  name: "Определитель",
  model: config.model,
  instructions: getDeterminerInstructions,
  outputType: z.object({
    answer: z.boolean(),
    comment: z.string(),
  }),
});

bot.onText(/\/info/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "Демо версия рассыльщика. Определитель работает полностью, валидатор не мешает не отправлять сообщение. БЗ на данный момент исключительно в формате .txt (поскольку сейчас она подгружается в диалог как сообщение, а не векторно, т.к. нет возможности прочитать доки библиотеки агентов опенаи, ), изменю в след версии на пдф"
  );
});

bot.onText(/\/start/, async (msg) => {
  thread = [];
  waiter = "none";
  await bot.sendMessage(msg.chat.id, config.firstMessage);
});

bot.onText(/./, async (msg) => {
  if (msg.text?.startsWith("/")) return;
  if (waiter === "none") {
    if (thread.length === 0) {
      thread.push({
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: config.firstMessage,
          },
        ],
      });
    }

    thread.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: msg.text!,
        },
      ],
    });

    await bot.sendMessage(msg.chat.id, 'Запускаю определителя...');
    const determinationResult = await run(determiner, thread);
    await bot.sendMessage(msg.chat.id, `Результат определителя: ${determinationResult.finalOutput?.answer}\nКомментарий:${determinationResult.finalOutput?.comment}`);
    if (!determinationResult.finalOutput?.answer) return;
    await bot.sendMessage(msg.chat.id, 'Запускаю писателя')
    
    const result = await run(writer, thread);
    thread = result.history;
    await bot.sendMessage(msg.from!.id, result.finalOutput!);

    await bot.sendMessage(msg.chat.id, 'Запускаю валидатора...');
    const validation = await run(validator, thread);
    await bot.sendMessage(msg.chat.id, `Результат определителя: ${validation.finalOutput?.ok}\nКомментарий:${validation.finalOutput?.comment}`);

  } else if (waiter != 'kb') {
    config[waiter] = msg.text!;
    fs.writeFileSync(path.join(process.cwd(), 'ai.config.json'), JSON.stringify(config), 'utf-8');
    waiter = "none";
    thread = [];
    await bot.sendMessage(msg.from!.id, "Изменил данные и сбросил диалог");
  }
});

bot.onText(/\/prompt/, async (msg) => {
  waiter = "prompt";
  await bot.sendMessage(msg.chat.id, "Пришлите мне новый системный промпт");
});

bot.onText(/\/kb/, async (msg) => {
  waiter = "kb";
  await bot.sendMessage(msg.chat.id, "Пришлите мне новую базу знаний (файлом .txt)");
});

bot.onText(/\/model/, async (msg) => {
  waiter = "model";
  await bot.sendMessage(
    msg.chat.id,
    "Пришлите мне новую модель (в формате OpenAI для кода, примеры: gpt-4o\ngpt-4.1-nano\ngpt-4o-mini\ngpt-4.1\ngpt-4-turbo\nИ др.)"
  );
});

bot.onText(/\/first/, async (msg) => {
  waiter = "firstMessage";
  await bot.sendMessage(msg.chat.id, "Пришлите мне новое первое сообщение");
});

bot.on('document', async (msg) => {
  if (!msg.document) return;
  if (waiter !== 'kb') return;
  const url = await bot.getFileLink(msg.document.file_id);
  if (path.extname(url) !== '.txt') {
    await bot.sendMessage(msg.chat.id, 'Пришлите файл .txt!');
    return;
  }
  const {data}: AxiosResponse<Buffer> = await axios.get(url, {
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(
    path.join(process.cwd(), 'data', config.kb),
    data,
    'utf-8'
  );
  waiter = 'none';
  thread = [];
  await bot.sendMessage(msg.chat.id, 'База данных изменена и диалог сброшен');
})