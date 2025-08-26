import { manager } from ".";
import { User, UserStatus } from "../entities/User";
import { EvaluationStatus, UserData, UserMessage } from "../grpc/ai";

import { config } from "./config";
import { client } from "./grpc";
import { IIncomingMail } from "./poll";
import { smtp } from "./smtp";

export const onReceive = async (
  user: User,
  data: IIncomingMail,
): Promise<void> => {
  if (user.status === UserStatus.Error || user.status === UserStatus.Finished)
    return;
  const result = await client.respond(
    new UserMessage({
      id: user.resId,
      text: data.text,
    }),
  );

  if (result.status === EvaluationStatus.FAIL) {
    // Not good enough
    return;
  }

  if (user.status === UserStatus.Sent) user.status = UserStatus.Dialogue;
  user.resId = result.responseId;
  await manager.save(user);
  await smtp.sendMail({
    text: result.response,
    sender: process.env.YANDEX_USER!,
    subject: config.topic,
    to: user.email,
  });
};

export const onMail = async (amount: number) => {
  const users = await manager.find(User, {
    take: amount,
  });

  for (const user of users) {
    try {
      const res = await client.generateFirstMessage(
        new UserData({
          data: `Данные о клиенте: ${user.data}`,
        }),
      );

      await smtp.sendMail({
        text: res.text,
        to: user.email,
        subject: config.topic,
        sender: process.env.YANDEX_USER!,
      });

      user.status = UserStatus.Sent;
      user.resId = res.id;
      await manager.save(user);
    } catch (error) {
      console.error(error);
      user.status = UserStatus.Error;
      await manager.save(user);
    }
  }
};
