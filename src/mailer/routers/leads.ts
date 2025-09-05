import express from "express";
import { manager } from "..";
import { Lead } from "../../entities/Lead";

const router = express.Router();

router.get("/", async (req, res) => {
  const leads = await manager.find(Lead);
  res.status(200).json(leads);
});

router.get("/:id", async (req, res) => {
  const lead = await manager.findOne(Lead, {
    where: {
      id: req.params.id,
    },
    relations: {
      mailing: true,
      messages: true,
      responses: true,
    },
  });

  if (!lead) return res.status(404).end();

  res.status(200).json(lead);
});

router.post(
  "/",
  async (
    req: express.Request<
      any,
      any,
      {
        email: unknown;
        data: unknown;
      }
    >,
    res,
  ) => {
    if (!req.body.data || !req.body.email) return res.status(400).end();
    if (typeof req.body.data !== "string" || typeof req.body.email !== "string")
      return res.status(400).end();

    const lead = new Lead();
    lead.data = req.body.data;
    lead.email = req.body.email;
    await manager.save(lead);

    res.status(201).end();
  },
);

router.delete('/:id', async (req, res) => {
  
})

export default router;
