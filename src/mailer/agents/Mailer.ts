import { FetchMessageObject } from "imapflow";
import { manager } from "..";
import { AIResponse } from "../../entities/AIResponse";
import { Lead, LeadStatus } from "../../entities/Lead";
import { Mailing } from "../../entities/Mailing";
import { ConversationData, UserData, UserMessage } from "../../grpc/ai";
import { logger } from "../../logger";
import { email } from "../apis/email";
import { client } from "../apis/grpc";
import dayjs from "dayjs";
import { LeadMessage } from "../../entities/LeadMessage";
import fs from "fs/promises";
import path from "path";

class Mailer {
  private _subject: string = "";
  private _minRating: number = 0;

  public set rating(n: number) {
    if (n < 0 || n > 10) throw new Error("Invalid value");
    this._minRating = Math.round(n);
  }

  public get rating(): number {
    return this._minRating;
  }

  public set subject(value: string) {
    this._subject = value;
  }

  public get subject(): string {
    return this._subject;
  }

  public async save(): Promise<void> {
    await fs.writeFile(
      path.join(process.cwd(), "data", "mailer", "config.json"),
      JSON.stringify({
        rating: this.rating,
        subject: this.subject,
      }),
      "utf-8",
    );
  }

  public async init(): Promise<void> {
    try {
      const data = await fs.readFile(
        path.join(process.cwd(), "data", "mailer", "config.json"),
        "utf-8",
      );
      const obj: {
        rating: number;
        subject: string;
      } = JSON.parse(data);
      this._minRating = obj.rating;
      this._subject = obj.subject;
    } catch (error) {
      this._minRating = 0;
      this._subject = "Тема";
      await this.save();
    }
  }

  public async mail(limit: number) {
    const mailing = new Mailing();
    await manager.save(mailing);
    const leads = await manager.find(Lead, {
      where: {
        status: LeadStatus.NotSent,
      },
      take: limit,
    });

    for (const lead of leads) {
      try {
        const msg = await client.write(
          new UserData({
            data: lead.data,
          }),
        );
        await email.send(lead.email, msg.text, this._subject);
        lead.status = LeadStatus.Sent;
        lead.mailing = mailing;
        lead.resId = msg.id;
        await manager.save(lead);
        const aiMsg = new AIResponse();
        aiMsg.lead = lead;
        aiMsg.rating = 10;
        aiMsg.text = msg.text;
        aiMsg.id = msg.id;
        await manager.save(aiMsg);
      } catch (error) {
        logger.error(error);
        lead.status = LeadStatus.Error;
        await manager.save(lead);
      }
    }
  }

  public async respond(
    lead: Lead,
    text: string,
    message: FetchMessageObject,
  ): Promise<void> {
    if (
      lead.status === LeadStatus.Delayed &&
      dayjs(lead.delayDate).isBefore(new Date())
    )
      lead.status = LeadStatus.Dialogue;
    if (lead.status !== LeadStatus.Dialogue && lead.status !== LeadStatus.Sent)
      return;
    if (lead.status === LeadStatus.Sent) lead.status = LeadStatus.Dialogue;

    await manager.save(lead);

    try {
      const analysis = await client.analyze(
        new UserMessage({
          resId: lead.resId,
          text,
        }),
      );

      if (analysis.rating < this._minRating) {
        /**
         * Автоматическая "задержка" диалога при слабо важном письме.
         * Тут нужно отправить сообщение Админу!!!
         */
        lead.status = LeadStatus.Delayed;
        lead.delayDate = dayjs().add(7, "days").toDate();
        await manager.save(lead);
        return;
      }

      if (analysis.isDelayed) {
        /**
         * Пользователь потребовал задержку. Отвечаем.
         */
        lead.delayDate = new Date(analysis.delayDate);
        lead.status = LeadStatus.Delayed;
      }
      lead.lastMsg = new Date();
      await manager.save(lead);

      const response = await client.respond(
        new UserMessage({
          resId: lead.resId,
          text,
        }),
      );

      //@ts-ignore
      const references: string | null = message.headers!.get("references");

      const evaluation = await client.evaluate(
        new ConversationData({
          resId: lead.resId,
        }),
      );

      const clientMsg = new LeadMessage();
      clientMsg.enthusiasm = analysis.enthusiasm;
      clientMsg.lead = lead;
      clientMsg.rating = analysis.rating;
      clientMsg.text = text;
      await manager.save(clientMsg);

      const aiRes = new AIResponse();
      aiRes.lead = lead;
      aiRes.id = lead.resId;
      aiRes.rating = evaluation.rating;
      aiRes.text = response.text;
      await manager.save(aiRes);

      await email.respond(
        lead.email,
        message.envelope?.subject!,
        response.text,
        message.envelope?.messageId!,
        references
          ? [...references.split(" "), message.envelope?.messageId!]
          : [message.envelope?.messageId!],
      );
    } catch (error) {
      logger.error(error);
      lead.status = LeadStatus.Error;
      await manager.save(lead);
    }
  }

  public async heat() {
    const leads = await manager
      .createQueryBuilder(Lead, "lead")
      .select()
      .where("lead.status = :isDelayed AND lead.delayDate < :now", {
        isDelayed: LeadStatus.Delayed,
        now: new Date(),
      })
      .orWhere(
        "lead.status = :sent OR lead.status = :dialogue AND lead.lastMsg < :weekAgo",
        {
          sent: LeadStatus.Sent,
          dialogue: LeadStatus.Dialogue,
          weekAgo: dayjs().subtract(7, "days").toDate(),
        },
      )
      .getMany();

    for (const lead of leads) {
      try {
        if (lead.status === LeadStatus.Delayed)
          lead.status = LeadStatus.Dialogue;

        const heatMsg = await client.heat(
          new ConversationData({
            resId: lead.resId,
          }),
        );

        await email.send(lead.email, heatMsg.text, this._subject);
        lead.lastMsg = new Date();
        lead.resId = heatMsg.id;
        await manager.save(lead);

        const msg = new AIResponse();
        msg.id = lead.resId;
        msg.lead = lead;
        msg.rating = 10;
        msg.text = heatMsg.text;
        await manager.save(msg);
      } catch (error) {
        logger.error(error);
        lead.status = LeadStatus.Error;
        await manager.save(lead);
      }
    }
  }
}

export const mailer = new Mailer();
