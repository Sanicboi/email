import express from "express";
import multer from "multer";
import { client } from "../apis/grpc";
import { Empty } from "../../grpc/shared";
import { logger } from "../../logger";
import { FileData, FileName } from "../../grpc/files";
import path from "path";

const upload = multer({
  storage: multer.memoryStorage(),
});

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const files = await client.getFiles(new Empty());
    res.status(200).json(files.names.map((el) => el.name));
  } catch (error) {
    logger.error(error);
    res.status(500).end();
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const name = await client.addFile(
      new FileData({
        content: req.file?.buffer,
        extension: path.extname(req.file?.originalname!),
      }),
    );
    res.status(201).json({
      name: name.name,
    });
  } catch (error) {
    logger.error(error);
    res.status(409).end();
  }
});

router.delete("/:name", async (req, res) => {
  try {
    await client.deleteFile(
      new FileName({
        name: req.params.name,
      }),
    );
  } catch (error) {
    logger.error(error);
    res.status(500).end();
  }
});

export default router;
