import { FetchMessageObject, ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { manager } from "..";
import { Lead } from "../../entities/Lead";
import { simpleParser } from "mailparser";
import { logger } from "../../logger";
import MailComposer from "nodemailer/lib/mail-composer";

class EmailClient {
  private _smtp = nodemailer.createTransport({
    host: "smtp.yandex.ru",
    port: 465,
    secure: true,
    auth: {
      user: process.env.YANDEX_USER!,
      pass: process.env.YANDEX_PASS,
    },
  });
  private _imap = new ImapFlow({
    host: "imap.yandex.ru",
    port: 993,
    secure: true,
    auth: {
      user: process.env.YANDEX_USER!,
      pass: process.env.YANDEX_PASS,
    },
  });

  private _callback: (
    lead: Lead,
    text: string,
    message: FetchMessageObject,
  ) => Promise<void> = async () => {};
  private _cronExpr: string = "*/2 * * * *";

  constructor() {}

  private async reconnect() {
  //   this._imap.close();
  //   this._imap = new ImapFlow({
  //   host: "imap.yandex.ru",
  //   port: 993,
  //   secure: true,
  //   auth: {
  //     user: process.env.YANDEX_USER!,
  //     pass: process.env.YANDEX_PASS,
  //   },
  // });
  // await this.connect();
  }

  private async connect(): Promise<void> {
    await this._imap.connect();
  }

  private startPolling(): void {
    cron.schedule(this._cronExpr, async () => await this.poll());
  }

  public async init(): Promise<void> {
    await this.connect();
    this.startPolling();
  }

  public onNewMessage(
    callback: (
      lead: Lead,
      text: string,
      message: FetchMessageObject,
    ) => Promise<void>,
  ) {
    this._callback = callback;
  }

  private async poll() {
    if (!this._imap.usable) await this.reconnect();
    const lock = await this._imap.getMailboxLock("INBOX");
    await this._imap.mailboxOpen("INBOX");
    try {
      const unseen = await this._imap.search({
        seen: false,
        deleted: false,
      });
      logger.info(unseen, 'Unseen messages');
      if (!unseen) throw new Error("No unseen messages");

      const messages = await this._imap.fetchAll(unseen, {
        source: true,
        envelope: true,
        uid: true,
        headers: true,
      });

      logger.info(messages, 'messages fetched')

      for (const message of messages) {
        try {
          if (
            !message.envelope ||
            !message.envelope.sender ||
            !message.envelope.sender[0].address ||
            !message.source
          )
            throw new Error("Message is invalid");

          const lead = await manager.findOne(Lead, {
            where: {
              email: message.envelope.sender[0].address,
            },
          });
          if (!lead) throw new Error("Message not from a lead");

          const rawBody = message.source.toString("utf-8");
          const parsedBody = await simpleParser(rawBody);

          if (!parsedBody.text) throw new Error("Invalid email body");

          await this._callback(lead, parsedBody.text, message);
        } catch (error) {
          logger.error(error, "Error processing message");
        } finally {
          await this._imap.messageFlagsAdd(message, ["\\Seen"]);
        }

      }
    } catch (error) {
      logger.error(error, "Error fetching messages");
    } finally {
      logger.info('Releasing the lock')
      lock.release();
    }
  }

  private async addMessageToSent(content: string | Buffer, dnr: boolean) {
    if (!this._imap.usable && !dnr) await this.reconnect();
    await this._imap.append("Sent", content, ["\\Seen"], new Date());
  }

  public async send(to: string, text: string, subject: string): Promise<void> {
    const message = await new MailComposer({
      to,
      text,
      subject,
      from: process.env.YANDEX_USER!,
    })
      .compile()
      .build();
    await this._smtp.sendMail({
      to,
      text,
      subject,
      from: process.env.YANDEX_USER!,
    });
    await this.addMessageToSent(message, false);
  }

  public async respond(
    to: string,
    previousSubject: string,
    text: string,
    inReplyTo: string,
    references: string[],
  ): Promise<void> {
    const message = await new MailComposer({
      text,
      inReplyTo,
      references,
      from: process.env.YANDEX_USER!,
      subject: `Re: ${previousSubject}`,
      to
    })
      .compile()
      .build();
    await this._smtp.sendMail({
      text,
      inReplyTo,
      references,
      from: process.env.YANDEX_USER!,
      subject: `Re: ${previousSubject}`,
    });

    await this.addMessageToSent(message, true);
  }
}

export const email = new EmailClient();
