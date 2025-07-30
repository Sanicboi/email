import express from "express";
import { config, IConfig } from "./config";
import { db } from "./db";
import { User } from "../entities/User";
import { UserEvent } from "../entities/UserEvent";
import cron from "node-cron";
import { poll } from "./poll";
import { onMail, onReceive } from "./handlers";
import path from "path";
import { client } from "./grpc";
import { Empty } from "../grpc/shared";
import multer from "multer";
import { FileName, FileUploadRequest } from "../grpc/files";
import { v4 } from "uuid";
import { Model, Prompt } from "../grpc/configuration";

export const manager = db.manager;
db.initialize().then(async () => {
  const upload = multer({
    storage: multer.memoryStorage(),
  });

  const app = express();

  app.use(express.static(path.join(process.cwd(), "dist")));

  app.use(express.json());

  app.get("/api/config", (req, res) => {
    res.status(200).json(config.asConfig());
  });

  cron.schedule("*/10 * * * *", async () => await poll(onReceive));

  app.get("/api/ai/files", async (req, res) => {
    const files = await client.getFiles(new Empty());
    res.status(200).json({
      files: files.names,
    });
  });

  app.post("/api/ai/files", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).end();
    await client.addFile(
      new FileUploadRequest({
        content: req.file.buffer,
        name: `${v4()}${path.extname(req.file.originalname)}`,
      })
    );
    res.status(201).end();
  });

  app.delete("/api/ai/files/:name", async (req, res) => {
    try {
      await client.deleteFile(
        new FileName({
          name: req.params.name,
        })
      );
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).end();
    }
  });

  app.get("/api/ai/prompt", async (req, res) => {
    const prompt = await client.getPrompt(new Empty());
    res.status(200).json({
      prompt: prompt.prompt,
    });
  });

  app.put(
    "/api/ai/prompt",
    async (
      req: express.Request<
        any,
        any,
        {
          prompt: any;
        }
      >,
      res
    ) => {
      if (!req.body.prompt || typeof req.body.prompt !== "string")
        return res.status(400).end();
      await client.editPrompt(
        new Prompt({
          prompt: req.body.prompt,
        })
      );
      res.status(204).end();
    }
  );

  app.get("/api/ai/model", async (req, res) => {
    const model = await client.getModel(new Empty());
    res.status(200).json({
      model: model.model,
    });
  });

  app.put(
    "/api/ai/model",
    async (
      req: express.Request<
        any,
        any,
        {
          model?: string;
        }
      >,
      res
    ) => {
      try {
        if (!req.body.model || typeof req.body.model !== "string")
          return res.status(400).end();
        await client.editModel(
          new Model({
            model: req.body.model,
          })
        );
        res.status(204).end();
      } catch (error) {
        console.error(error);
        res.status(400).end();
      }
    }
  );

  app.put(
    "/api/config",
    async (req: express.Request<any, any, Partial<IConfig>>, res) => {
      if (req.body.attempts) config.attempts = req.body.attempts;
      if (req.body.responseRating)
        config.responseRating = req.body.responseRating;
      if (req.body.sendRating) config.sendRating = req.body.sendRating;
      if (req.body.specialRating) config.specialRating = req.body.specialRating;
      if (req.body.topic) config.topic = req.body.topic;
      if (req.body.waitTime) config.waitTime = req.body.waitTime;
      await config.save();
      res.status(204).end();
    }
  );

  app.get("/api/users", async (req, res) => {
    const users = await manager.find(User);
    res.status(200).json(users);
  });

  app.post(
    "/api/user",
    async (
      req: express.Request<
        any,
        any,
        {
          email?: string;
          data?: string;
        }
      >,
      res
    ) => {
      if (!req.body.email || !req.body.data) return res.status(400).end();
      const user = new User();
      user.email = req.body.email;
      user.data = req.body.data;
      await manager.save(user);
      res.status(201).end();
    }
  );

  app.get("/api/users/:id/events", async (req, res) => {
    const events = await manager
      .createQueryBuilder(UserEvent, "event")
      .select()
      .where("event.userId = :id", {
        id: req.params.id,
      })
      .orderBy("date", "ASC")
      .getMany();
    if (events.length === 0) return res.status(404).end();
    res.status(200).json(events);
  });

  app.post(
    "/api/mail",
    async (
      req: express.Request<
        any,
        any,
        {
          amount: any;
        }
      >,
      res
    ) => {
      if (!req.body.amount || typeof req.body.amount !== "number")
        return res.status(400).end();
      await onMail(req.body.amount);
      res.status(201).end();
    }
  );

  app.listen(5000);
});
