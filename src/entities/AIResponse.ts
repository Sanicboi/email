import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Lead } from "./Lead";

@Entity()
export class AIResponse {
  @PrimaryColumn()
  id: string;

  @Column()
  text: string;

  @Column()
  rating: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Lead, (lead) => lead.responses)
  lead: Lead;
}
