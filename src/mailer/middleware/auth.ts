import express from "express";
import jwt from "jsonwebtoken";
import { manager } from "..";
import { User } from "../../entities/User";

export const simpleAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).end();
  if (!header.startsWith("Bearer ")) return res.status(401).end();
  const split = header.split(" ");
  if (split.length !== 2) return res.status(401).end();
  const token = split[1];

  try {
    const data = jwt.verify(token, process.env.JWT_KEY!);
    if (typeof data === "string") throw new Error("wrong token");
    if (!data.id) throw new Error("No ID field");
    if (typeof data.id !== "string") throw new Error("ID is not a string");

    const exists = await manager.exists(User, {
      where: {
        id: data.id,
      },
    });
    if (!exists) return res.status(404).end();
    next();
  } catch (error) {
    res.status(401).end();
  }
};

export const devAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).end();
  if (!header.startsWith("Bearer ")) return res.status(401).end();
  const split = header.split(" ");
  if (split.length !== 2) return res.status(401).end();
  const token = split[1];

  try {
    const data = jwt.verify(token, process.env.JWT_KEY!);
    if (typeof data === "string") throw new Error("wrong token");
    if (!data.id) throw new Error("No ID field");
    if (typeof data.id !== "string") throw new Error("ID is not a string");

    const user = await manager.findOne(User, {
      where: {
        id: data.id,
      },
    });
    if (!user) return res.status(404).end();
    if (!user.isDev) return res.status(403).end();
    next();
  } catch (error) {
    res.status(401).end();
  }
};
