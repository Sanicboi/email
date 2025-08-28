import express from "express";
import { manager } from "..";
import { Mailing } from "../../entities/Mailing";
import { mailer } from "../agents/Mailer";

const router = express.Router();

router.get("/", async (req, res) => {
  const mailings = await manager.find(Mailing, {
    relations: {
      leads: true,
    },
  });

  res.status(200).json(mailings);
});

router.get("/:id", async (req, res) => {
  const mailing = await manager.findOne(Mailing, {
    where: {
      id: +req.params.id,
    },
    relations: {
      leads: {
        messages: true,
        responses: true,
      },
    },
  });
  if (!mailing) return res.status(404).end();
  res.status(200).json(mailing);
});

router.post(
  "/",
  async (
    req: express.Request<
      any,
      any,
      {
        limit: unknown;
      }
    >,
    res,
  ) => {
    if (!req.body.limit || typeof req.body.limit !== "number")
      return res.status(400).end();
    res.status(201).end();
    setImmediate(async () => await mailer.mail(Number(req.body.limit)));
  },
);

export default router;
