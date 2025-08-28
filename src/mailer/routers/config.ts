import express from "express";
import { Agent, AgentType, Prompt } from "../../grpc/prompts";
import { client } from "../apis/grpc";
import { logger } from "../../logger";
import OpenAI from "openai";
import { ModelData } from "../../grpc/model";
import { mailer } from "../agents/Mailer";

const router = express.Router();

const toEnum = (name: "evaluator" | "writer" | "analyzer"): AgentType => {
  switch (name) {
    case "analyzer":
      return AgentType.Analyzer;
    case "writer":
      return AgentType.Writer;
    case "evaluator":
      return AgentType.Evaluator;
  }
};

const validModels: string[] = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
];

router.param("type", async (req, res, next, type) => {
  if (type !== "evaluator" && type !== "writer" && type !== "analyzer")
    return res.status(400).end();
  res.locals.agent = toEnum(type);
  next();
});

router.get(
  "/prompts/:type",
  async (
    req,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    try {
      const prompt = await client.getPrompt(
        new Agent({
          agent: res.locals.agent,
        }),
      );
      res.status(200).json({
        prompt: prompt.prompt,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).end();
    }
  },
);

router.put(
  "/prompts/:type",
  async (
    req: express.Request<
      any,
      any,
      {
        prompt: unknown;
      }
    >,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    if (!req.body.prompt || typeof req.body.prompt !== "string")
      return res.status(400).end();
    try {
      await client.setPrompt(
        new Prompt({
          agent: res.locals.agent,
          prompt: req.body.prompt,
        }),
      );
      res.status(204).end();
    } catch (error) {
      logger.error(error);
      res.status(500).end();
    }
  },
);

router.get(
  "/model/:type",
  async (
    req,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    try {
      const model = await client.getModel(
        new Agent({
          agent: res.locals.agent,
        }),
      );
      res.status(200).json({
        model: model.name,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).end();
    }
  },
);

router.put(
  "/model/:type",
  async (
    req: express.Request<
      any,
      any,
      {
        model: unknown;
      }
    >,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    if (!req.body.model || typeof req.body.model !== "string")
      return res.status(400).end();
    if (!validModels.includes(req.body.model)) return res.status(400).end();

    try {
      await client.setModel(
        new ModelData({
          agent: res.locals.agent,
          name: req.body.model,
        }),
      );
    } catch (error) {
      logger.error(error);
      res.status(500).end();
    }
  },
);

router.get(
  "/rating",
  async (
    req,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    const rating = mailer.rating;
    res.status(200).json({
      rating,
    });
  },
);

router.put(
  "/rating",
  async (
    req: express.Request<
      any,
      any,
      {
        rating: unknown;
      }
    >,
    res: express.Response<
      any,
      {
        agent: AgentType;
      }
    >,
  ) => {
    if (!req.body.rating) return res.status(400).end();
    if (typeof req.body.rating !== "number") return res.status(400).end();
    try {
      mailer.rating = req.body.rating;
      await mailer.save();
      res.status(204).end();
    } catch (error) {
      logger.error(error);
      res.status(400).end();
    }
  },
);

router.get("/subject", async (req, res) => {
  res.status(200).json({
    topic: mailer.subject,
  });
});

router.put(
  "/subject",
  async (
    req: express.Request<
      any,
      any,
      {
        subject: unknown;
      }
    >,
    res,
  ) => {
    if (!req.body.subject) return res.status(400).end();
    if (typeof req.body.subject !== "string") return res.status(400).end();
    mailer.subject = req.body.subject;
    await mailer.save();
    res.status(204).end();
  },
);

export default router;
