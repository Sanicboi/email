import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";

export const db = new DataSource({
  type: "postgres",
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  username: process.env.POSTGRES_USER,
  migrations: [],
  entities: [User],
  host: "postgres",
  port: 5432,
  logging: false,
  synchronize: true,
});
