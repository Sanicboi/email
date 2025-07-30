import { simpleParser } from "mailparser";
import { manager } from ".";
import { User } from "../entities/User";
import { imap } from "./imap";
import { smtp } from "./smtp";
import { UserEvent } from "../entities/UserEvent";
import { createEvent } from "./createEvent";

export interface IIncomingMail {
  text: string;
}

export const poll = async (
  userCallback: (user: User, data: IIncomingMail) => Promise<void>,
): Promise<void> => {
  let lock = await imap.getMailboxLock("INBOX");
  try {
    for await (const message of imap.fetch(
      {
        seen: false,
      },
      {
        source: true,
        envelope: true,
      },
    )) {
      if (
        !message.envelope ||
        !message.envelope.sender ||
        !message.envelope.sender[0].address ||
        !message.source
      )
        continue;
      const user = await manager.findOne(User, {
        where: {
          email: message.envelope.sender[0].address,
        },
      });
      if (!user) continue;
      const raw = message.source.toString("utf-8");
      const parsed = await simpleParser(raw);
      if (!parsed.text) continue;
      createEvent(user, "Email Received");
      await userCallback(user, {
        text: parsed.text,
      });
      await imap.messageFlagsAdd(message.uid, ["\\Seen"]);
    }
  } catch (error) {
    console.error(error);
  } finally {
    lock.release();
  }
};
