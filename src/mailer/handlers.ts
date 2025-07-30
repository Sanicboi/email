import { manager } from ".";
import { User, UserStatus } from "../entities/User";
import {
  FirstMessageGenerationRequest,
  InputEvaluationRequest,
  OutputEvaluationRequest,
  ResponseGenerationRequest,
} from "../grpc/generation";
import { config } from "./config";
import { createEvent } from "./createEvent";
import { client } from "./grpc";
import { IIncomingMail } from "./poll";
import { smtp } from "./smtp";

export const onReceive = async (
  user: User,
  data: IIncomingMail
): Promise<void> => {
  if (user.status === UserStatus.Error || user.status === UserStatus.Finished)
    return;
  const evaluation = await client.evaluateInput(
    new InputEvaluationRequest({
      text: data.text,
    })
  );
  await createEvent(
    user,
    "Message evaluated",
    `Rating: ${evaluation.rating}.\nComment:\n${evaluation.comment}`
  );

  if (user.status === UserStatus.Sent) {
    user.status = UserStatus.Dialogue;
    await manager.save(user);
  }

  if (evaluation.rating < config.responseRating) {
    await createEvent(user, "Rating is too low");
    user.status = UserStatus.Finished;
    await manager.save(user);
    return;
  }

  if (evaluation.rating >= config.specialRating) {
    await createEvent(user, 'Rated as "special". Pass.');
    user.status = UserStatus.Finished;
    await manager.save(user);
    return;
  }

  let response = await client.generateResponse(
    new ResponseGenerationRequest({
      previousId: user.resId,
      text: data.text,
    })
  );

  await createEvent(user, "Response created", response.text);
  user.resId = response.id;

  let resEval = await client.evaluateOutput(
    new OutputEvaluationRequest({
      id: response.id,
    })
  );
  await createEvent(user, `Response evaluated: ${resEval.rating}`, resEval.comment);

  let numGens = 1;

  while (resEval.rating < config.sendRating && numGens < config.attempts) {
    numGens++;
    response = await client.regenerateResponse(
      new ResponseGenerationRequest({
        previousId: response.id,
        text: resEval.comment,
      })
    );
    await createEvent(user, "Response created", response.text);
    resEval = await client.evaluateOutput(
      new OutputEvaluationRequest({
        id: response.id,
      })
    );
    await createEvent(user, `Response evaluated: ${resEval.rating}`, resEval.comment);
  }

  if (resEval.rating < config.sendRating) {
    await createEvent(user, 'Response rejected');
    user.status = UserStatus.Error;
    await manager.save(user);
    return;
  }

  user.resId = response.id;
  await manager.save(user);

  await smtp.sendMail({
    text: response.text,
    sender: process.env.YANDEX_USER!,
    to: user.email,
    subject: config.topic
  });
  await createEvent(user, 'Message sent');
};


export const onMail = async (amount: number) => {
  const users = await manager.find(User, {
    take: amount
  });

  for (const user of users) {
    try {
      const firstMessage = await client.generateFirstMessage(new FirstMessageGenerationRequest({
        userData: user.data
      }));
      await createEvent(user, 'First message created', firstMessage.text);
      user.status = UserStatus.Sent;
      user.resId = firstMessage.id;
      await manager.save(user);
      await smtp.sendMail({
        text: firstMessage.text,
        sender: process.env.YANDEX_USER!,
        subject: config.topic,
        to: user.email
      })
    } catch (error) {
      console.error(error);
      user.status = UserStatus.Error;
      await manager.save(user);
    }
  }
}