import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Lead } from "./Lead";

@Entity()
export class Mailing {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Lead, (lead) => lead.mailing)
  leads: Lead[];
}
