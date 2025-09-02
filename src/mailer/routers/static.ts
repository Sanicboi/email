import express from "express";
import path from "path";
import fs from "fs/promises";

const router = express.Router();

router.use(express.static(path.join(process.cwd(), "dist")));

router.get("*", async (req, res) => {
  const file = await fs.readFile(
    path.join(process.cwd(), "dist", "index.html"),
    "utf-8",
  );
  res.status(200).contentType(".html").send(file).end();
});

export default router;
