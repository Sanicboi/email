import express from "express";
import { db } from "./db";
import staticRouter from "./routers/static";
import authRouter from "./routers/auth";
import configRouter from "./routers/config";
import leadsRouter from "./routers/leads";
import filesRouter from "./routers/files";
import mailingsRouter from "./routers/mailings";
import { devAuth, simpleAuth } from "./middleware/auth";
import { email } from "./apis/email";
import { mailer } from "./agents/Mailer";
import cron from "node-cron";
import { pinoHttp } from "pino-http";

export const manager = db.manager;
db.initialize().then(async () => {
  const app = express();

  const logger = pinoHttp();

  app.use(logger);

  app.use(express.json());
  app.use(staticRouter);
  app.use("/api", authRouter);
  app.use("/api/config", /*devAuth,*/ configRouter);
  app.use("/api/leads", /*simpleAuth,*/ leadsRouter);
  app.use("/api/files", /*simpleAuth,*/ filesRouter);
  app.use("/api/mailings", /*simpleAuth,*/ mailingsRouter);

  await email.init();
  await mailer.init();
  cron.schedule("7 13 * * *", async () => await mailer.heat());

  app.listen(5000);
});
