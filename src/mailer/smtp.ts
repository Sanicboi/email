import nodemailer from "nodemailer";

export const smtp = nodemailer.createTransport({
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  auth: {
    user: process.env.YANDEX_USER!,
    pass: process.env.YANDEX_PASS,
  },
});
