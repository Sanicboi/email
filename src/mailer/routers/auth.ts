import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { manager } from "..";
import { User } from "../../entities/User";

const router = express.Router();

router.post(
  "/user",
  async (
    req: express.Request<
      any,
      any,
      {
        username: unknown;
        password: unknown;
        masterPassword: unknown;
      }
    >,
    res,
  ) => {
    if (!req.body.masterPassword || !req.body.password || !req.body.username)
      return res.status(400).end();

    if (
      typeof req.body.masterPassword !== "string" ||
      typeof req.body.password !== "string" ||
      typeof req.body.username !== "string"
    )
      return res.status(400).end();

    const isMasterValid = await bcrypt.compare(
      req.body.masterPassword,
      process.env.MASTER_PASS!,
    );
    if (!isMasterValid) return res.status(401).end();

    const existsAlready = await manager
      .createQueryBuilder(User, "user")
      .select()
      .where("user.name = :uname", {
        uname: req.body.username,
      })
      .getExists();
    if (existsAlready) return res.status(409).end();

    const user = new User();
    user.password = await bcrypt.hash(req.body.password, 12);
    user.name = req.body.username;
    await manager.save(user);

    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_KEY!,
      {
        expiresIn: "1d",
      },
    );

    res.status(201).json({
      token,
    });
  },
);

router.post(
  "/login",
  async (
    req: express.Request<
      any,
      any,
      {
        username: unknown;
        password: unknown;
      }
    >,
    res,
  ) => {
    if (!req.body.password || !req.body.username) return res.status(400).end();
    if (
      typeof req.body.password !== "string" ||
      typeof req.body.username !== "string"
    )
      return res.status(400).end();

    const user = await manager.findOne(User, {
      where: {
        name: req.body.username,
      },
    });
    if (!user) return res.status(404).end();

    const passwordIsCorrect = await bcrypt.compare(
      req.body.password,
      user.password,
    );
    if (!passwordIsCorrect) return res.status(401).end();

    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_KEY!,
      {
        expiresIn: "1d",
      },
    );

    res.status(201).json({
      token,
    });
  },
);

export default router;
