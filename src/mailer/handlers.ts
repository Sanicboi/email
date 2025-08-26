import { manager } from ".";
import { User, UserStatus } from "../entities/User";
import { EvaluationStatus, UserData, UserMessage } from "../grpc/ai";
import { logger } from "../logger";

import { config } from "./config";
import { client } from "./grpc";
import { IIncomingMail } from "./poll";
import { smtp } from "./smtp";

export const onReceive = async (
  user: User,
  data: IIncomingMail
): Promise<void> => {
  try {
    logger.info("Checking user status...");
    if (user.status === UserStatus.Error || user.status === UserStatus.Finished)
      throw new Error("User's status is not valid");
    logger.info("Calling the grpc AI interface...");
    const result = await client.respond(
      new UserMessage({
        id: user.resId,
        text: data.text,
      })
    );
    logger.info(result, "AI Response");

    if (result.status === EvaluationStatus.FAIL) throw new Error("Evaluation was failed!");

    logger.info("Updating user...");
    if (user.status === UserStatus.Sent) user.status = UserStatus.Dialogue;
    user.resId = result.responseId;
    await manager.save(user);

    logger.info("Sending an email...");
    await smtp.sendMail({
      text: result.response,
      from: process.env.YANDEX_USER!,
      subject: config.topic,
      to: user.email,
    });
    logger.info("Email sent!");
  } catch (error) {
    logger.error(error, "Error during the response process");
  }
};

export const onMail = async (amount: number) => {
  logger.info("fetching users...");
  const users = await manager.find(User, {
    take: amount,
  });
  logger.info(users, "Users");


  for (const user of users) {
    try {
      logger.info(user, "Generating the first message...");
      const res = await client.generateFirstMessage(
        new UserData({
          data: `Данные о клиенте: ${user.data}`,
        })
      );
      logger.info(res, "First message");

      logger.info("Sending the email...");
      await smtp.sendMail({
        text: res.text,
        to: user.email,
        subject: config.topic,
        from: process.env.YANDEX_USER!,
      });

      logger.info("Email sent. Updating the user...");
      user.status = UserStatus.Sent;
      user.resId = res.id;
      await manager.save(user);
    } catch (error) {
      logger.info("Error sending an email. User's status is being changed")
      user.status = UserStatus.Error;
      await manager.save(user);
    }
  }
};
