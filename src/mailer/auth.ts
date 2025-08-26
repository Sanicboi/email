import fs from "fs/promises";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

class AuthManager {
  private _pass: string;

  constructor() {}

  public async init() {
    this._pass = await fs.readFile(
      path.join(process.cwd(), process.env.PASSWD_PATH!),
      "utf-8",
    );
  }

  public async authorize(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const header = req.headers.authorization;
      if (!header) throw new Error("Header is null");
      if (!header.startsWith("Bearer "))
        throw new Error("Authorization is not bearer");
      const split = header.split(" ");
      if (split.length !== 2) throw new Error("Header has too many spaces");
      const token = split[1];
      const content = jwt.verify(token, process.env.JWT_KEY!);
      if (typeof content !== "string") throw new Error("Invalid token content");
      if (content !== "PASS") throw new Error("Invalid token content");
      next();
    } catch (error) {
      console.error(error);
      res.status(401).end();
    }
  }

  public async getToken(
    req: Request<
      any,
      any,
      {
        password: unknown;
      }
    >,
    res: Response,
  ): Promise<unknown> {
    if (!req.body) return res.status(400).end();
    if (!req.body.password) return res.status(400).end();
    if (typeof req.body.password !== "string") return res.status(400).end();

    try {
      const verResult = await bcrypt.compare(req.body.password, this._pass);
      if (!verResult) return res.status(401).end();
      const token = jwt.sign("PASS", process.env.JWT_KEY!, {
        expiresIn: "1d",
      });
      res.status(201).json({
        token,
      });
    } catch (error) {
      console.error(error);
      res.status(500).end();
    }
  }
}

export const authManager = new AuthManager();
