import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";

@Entity()
export class UserEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  date: Date;

  @Column()
  name: string;

  @Column("text", { nullable: true })
  details: string | null;

  @ManyToOne(() => User, (user) => user.events)
  user: User;
}
