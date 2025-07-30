import { manager } from ".";
import { User } from "../entities/User";
import { UserEvent } from "../entities/UserEvent";

export const createEvent = async (
  user: User,
  name: string,
  details?: string,
): Promise<void> => {
  const event = new UserEvent();
  event.user = user;
  event.name = name;
  event.details = details ?? null;
  await manager.save(event);
};
