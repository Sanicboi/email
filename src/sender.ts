import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import {
  AIClient,
  Evaluation,
  FirstMessageData,
  MsgInput,
  MsgOutput,
  TextInput,
} from "./grpc/ai";
import * as grpc from "@grpc/grpc-js";
import { simpleParser } from "mailparser";
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

const imapflow = new ImapFlow({
  host: "imap.yandex.ru",
  port: 993,
  secure: true,
  auth: {
    user: process.env.YANDEX_USER!,
    pass: process.env.YANDEX_PASS,
  },
});

const mailer = nodemailer.createTransport({
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  auth: {
    user: process.env.YANDEX_USER!,
    pass: process.env.YANDEX_PASS,
  },
});

const bot = new TelegramBot(process.env.TG_TOKEN!, {
  polling: true,
});

let emailsSet: Set<string> = new Set([]);

let idsMap: Map<string, string> = new Map();

const client = new AIClient(
  process.env.AI_ADDR!,
  grpc.credentials.createInsecure(),
);

const poll = async () => {
  let lock = await imapflow.getMailboxLock("INBOX");
  try {
    for await (const message of imapflow.fetch(
      {
        seen: false,
      },
      {
        source: true,
        envelope: true,
      },
    )) {
      try {
        console.log("Message found");
        if (!message.envelope?.sender || !message.envelope.sender[0].address)
          continue;
        console.log("Message has a sender");
        const addr = message.envelope.sender[0].address;
        if (!idsMap.has(addr)) {
          await imapflow.messageFlagsAdd(message.uid, ["\\Seen"]);
          continue;
        }
        console.log("Sender is in the map");
        if (!message.source) continue;
        console.log("Message has a body");
        const rawBody = message.source.toString("utf8");
        const parsedBody = await simpleParser(rawBody);

        console.log("Evaluating...");
        const inputEvaluation = await new Promise<Evaluation>(
          (resolve, reject) => {
            client.evaluateInput(
              new TextInput({
                text: parsedBody.text,
              }),
              (err, value) => {
                if (err || !value) return reject(err);
                resolve(value);
              },
            );
          },
        );

        if (inputEvaluation.rating <= 2) {
          console.log("Not important enough");
          continue;
        }
        console.log("Evaluated");

        const response = await new Promise<MsgOutput>((resolve, reject) => {
          client.generateResponse(
            new MsgInput({
              previousId: idsMap.get(addr),
              text: parsedBody.text,
            }),
            (err, value) => {
              if (err || !value) return reject(err);
              resolve(value);
            },
          );
        });

        idsMap.set(addr, response.id);
        console.log(response.text);
        console.log("Sending...");

        await mailer.sendMail({
          text: response.text,
          to: addr,
          from: process.env.YANDEX_USER!,
          subject: "Тестовые сообщения",
        });
        await imapflow.messageFlagsAdd(message.uid, ["\\Seen"]);
      } catch (error) {
        console.log("Error processing");
        console.error(error);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    lock.release();
  }
};

const mail = async () => {
  for (const addr of emailsSet) {
    const first = await new Promise<MsgOutput>((resolve, reject) => {
      client.generateFirstMessage(
        new FirstMessageData({
          leadData: "Имя: Игорь",
        }),
        (err, value) => {
          if (err || !value) return reject(err);
          resolve(value);
        },
      );
    });
    idsMap.set(addr, first.id);
    console.log("Generated. Sending...");
    const info = await mailer.sendMail({
      to: addr,
      text: first.text,
      from: process.env.YANDEX_USER!,
      subject: "Test",
    });
    emailsSet.delete(addr);
  }
};

bot.onText(/\/mail /, async (msg) => {
  emailsSet.add(msg.text!.split(" ")[1]);
  await bot.sendMessage(msg.chat.id, "Письмо отправляется...");
  await mail();
  await bot.sendMessage(msg.chat.id, "Письма отправлены");
});
bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    'Я - тестовый интерфейс рассыльщика. Запустить рассылку можно командой /mail. Для этого нужно написать боту "/mail address@mail.com"',
  );
});

imapflow
  .connect()
  .then(() =>
    bot.setMyCommands([
      {
        command: "start",
        description: "Инфо",
      },
    ]),
  )
  .then(() => setInterval(poll, 5000));
