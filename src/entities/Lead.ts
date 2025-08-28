import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AIResponse } from "./AIResponse";
import { LeadMessage } from "./LeadMessage";
import { Mailing } from "./Mailing";

export enum LeadStatus {
  Error = 0,
  NotSent = 1,
  Sent = 2,
  Dialogue = 3,
  Finished = 4,
  Delayed = 5,
}

@Entity()
export class Lead {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column()
  data: string;

  @Column({
    nullable: true,
  })
  resId: string;

  @Column({
    nullable: true,
  })
  delayDate: Date;

  @Column({
    nullable: true,
  })
  lastMsg: Date;

  @Column("enum", {
    enum: LeadStatus,
    default: LeadStatus.NotSent,
  })
  status: LeadStatus;

  @OneToMany(() => AIResponse, (response) => response.lead)
  responses: AIResponse[];

  @OneToMany(() => LeadMessage, (message) => message.lead)
  messages: LeadMessage[];

  @ManyToOne(() => Mailing, (mailing) => mailing.leads)
  mailing: Mailing;
}
