import { simpleParser } from "mailparser";
import { manager } from ".";
import { User, UserStatus } from "../entities/User";
import { imap } from "./imap";
import { smtp } from "./smtp";
import { logger } from "../logger";

export interface IIncomingMail {
  text: string;
}

export const poll = async (
  userCallback: (user: User, data: IIncomingMail) => Promise<void>
): Promise<void> => {
  logger.info("Poll function called.");
  logger.info("Getting mailbox lock...");
  let lock = await imap.getMailboxLock("INBOX");
  logger.info("Lock acquired");
  try {
    logger.info("Searching for unseen messages...");
    const unseenList = await imap.search({
      seen: false,
      deleted: false,
    });
    logger.info(unseenList, "Found unseen messages!");
    if (!unseenList) throw new Error("No unseen messages!");
    logger.info("Fetching unseen messages...");
    const messages = await imap.fetchAll(unseenList, {
      source: true,
      envelope: true,
      uid: true
    });
    logger.info("Fetched unseen messages! Starting processing...");

    for (const message of messages) {
      try {
        logger.info(message.id, "Fetched a message");
        if (
          !message.envelope ||
          !message.envelope.sender ||
          !message.envelope.sender[0].address ||
          !message.source
        )
          throw new Error("Message envelope/source is invalid!");

        logger.info("Searching for a user...");
        const user = await manager.findOne(User, {
          where: {
            email: message.envelope.sender[0].address,
          },
        });
        if (!user) throw new Error("User not found!");
        logger.info(user, "User found");
        logger.info("Parsing the body...");
        const raw = message.source.toString("utf-8");
        const parsed = await simpleParser(raw);
        logger.info(parsed, "Parsing finished!");
        if (!parsed.text) throw new Error("Parsed body has no text!");
        logger.info("Starting callback execution...");
        await userCallback(user, {
          text: parsed.text,
        });
        logger.info("User callback ended");
      } catch (error) {
        logger.error(error, "Error when processing an incoming email!");
      } finally {
        logger.info("Marking email as seen...");
        await imap.messageFlagsAdd(message.uid, ["\\Seen"]);
      }
    }
  } catch (error) {
    logger.error(error, "Error while fetching messages");
  } finally {
    logger.info("Releasing the lock...");
    lock.release();
  }
};
