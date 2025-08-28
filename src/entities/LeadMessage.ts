import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Lead } from "./Lead";

@Entity()
export class LeadMessage {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  enthusiasm: number;

  @Column()
  rating: number;

  @Column()
  text: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lead, (lead) => lead.messages)
  lead: Lead;
}
