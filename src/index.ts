import { AppDataSource } from "./data-source";
import { Agent, AgentInputItem, run } from "@openai/agents";
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";


let thread: AgentInputItem[] = [];
let waiter: "none" | "db" | "prompt" | "model" | "firstMessage" = "none";
let prompt = fs.readFileSync(path.join(process.cwd(), 'data', "prompt.txt"), "utf-8");
let db = fs.readFileSync(path.join(process.cwd(), 'data', "db.txt"), "utf-8");
let firstMessage = fs.readFileSync(path.join(process.cwd(), 'data', 'firstMessage.txt'), 'utf-8');
let model = fs.readFileSync(path.join(process.cwd(), 'data', 'model.txt'), 'utf-8');

// AppDataSource.initialize().then(async () => {
const bot = new TelegramBot(process.env.TG_TOKEN!, {
  polling: true,
});

bot.setMyCommands([
  {
    command: 'start',
    description: 'Начать новый диалог'
  },
  {
    command: 'prompt',
    description: 'Изменить промпт'
  },
  {
    command: 'db',
    description: 'Изменить Базу знаний (текстово)'
  },
  {
    command: 'model',
    description: 'Изменить модель'
  },
  {
    command: 'first',
    description: 'Изменить первое сообщение'
  }
])

const agent = new Agent({
  name: "МОП",
  model,
  instructions: `${prompt}\n\nДополнительные данные:${db}`,
});

bot.onText(/\/start/, async (msg) => {
  thread = [];
  waiter = 'none';
  await bot.sendMessage(msg.chat.id, firstMessage);
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
            text: firstMessage,
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
    const result = await run(agent, thread);

    thread = result.history;
    await bot.sendMessage(msg.from!.id, result.finalOutput!);
  } else {
    fs.writeFileSync(path.join(process.cwd(), `${waiter}.txt`), msg.text!, 'utf-8');
    waiter = 'none';
    thread = [];
    await bot.sendMessage(msg.from!.id, 'Изменил данные и сбросил диалог');
  }
});

bot.onText(/\/prompt/, async (msg) => {
  waiter = "prompt";
  await bot.sendMessage(msg.chat.id, prompt);
  await bot.sendMessage(msg.chat.id, "Пришлите мне новый системный промпт");
});

bot.onText(/\/db/, async (msg) => {
  waiter = "db";
  await bot.sendMessage(msg.chat.id, db);
  await bot.sendMessage(msg.chat.id, "Пришлите мне новую базу знаний");
});

bot.onText(/\/model/, async (msg) => {
    waiter = 'model';
    await bot.sendMessage(msg.chat.id, model);
    await bot.sendMessage(msg.chat.id, 'Пришлите мне новую модель (в формате OpenAI для кода, примеры: gpt-4o\ngpt-4.1-nano\ngpt-4o-mini\ngpt-4.1\ngpt-4-turbo\nИ др.)')
});

bot.onText(/\/first/, async (msg) => {
    waiter = 'firstMessage';
    await bot.sendMessage(msg.chat.id, firstMessage);
    await bot.sendMessage(msg.chat.id, 'Пришлите мне новое первое сообщение');
})
// });
