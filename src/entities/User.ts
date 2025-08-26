import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { UserEvent } from "./UserEvent";

export enum UserStatus {
  Error = 0,
  NotSent = 1,
  Sent = 2,
  Dialogue = 3,
  Finished = 4,
}

@Entity()
export class User {
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

  @Column("int", {
    default: UserStatus.NotSent,
  })
  status: UserStatus;

  @OneToMany(() => UserEvent, (event) => event.user)
  events: UserEvent[];
}
