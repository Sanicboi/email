import { determineType } from "./determiner";
import { evaluateResponse } from "./evaluator";
import { AppState } from "./state";
import { replyToMessage } from "./writer";
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: {
        user: 'adamarttech@yandex.ru',
        pass: process.env.YANDEX_PASS
    }
});



export const respond = async (text: string, state: AppState) => {
  const determination = await determineType(state.resId, state.kbId, text);
  if (determination.type != "reply") return;
  let gen = await replyToMessage(state.resId, state.kbId, text, state.prompt);
  let ev = await evaluateResponse(gen.id, state.kbId);
  let count = 1;

  while (count < 3 && ev.rating <= 3) {
    gen = await replyToMessage(
      gen.id,
      state.kbId,
      `Подкорректируй свой ответ, вот комментарий: ${ev.comment}`,
      state.prompt,
      true
    );
    ev = await evaluateResponse(gen.id, state.kbId);
    count++;
  }

  state.resId = gen.id;
  await new Promise<void>((resolve, reject) => {
    transporter.sendMail({
        to: state.email!,
        subject: 'Mailing test',
        text: gen.text,
    }, (err, info) => {
        if (!err) {
            resolve()
        } else {
            reject()
        }
    })
  })
};


export const sendFirst = async (state: AppState) => {
      await new Promise<void>((resolve, reject) => {
    transporter.sendMail({
        to: state.email!,
        subject: 'Mailing test',
        text: state.firstMsg,
    }, (err, info) => {
        if (!err) {
            resolve()
        } else {
            reject()
        }
    })
  })
}