import { ImapFlow } from "imapflow";

export const imap = new ImapFlow({
  host: "imap.yandex.ru",
  port: 993,
  secure: true,
  auth: {
    user: process.env.YANDEX_USER!,
    pass: process.env.YANDEX_PASS,
  },
});
