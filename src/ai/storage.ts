import fs from "fs/promises";
import path from "path";
import { openai } from "./openai";
import { v4 } from "uuid";

interface IStorageFile {
  id: string;
  name: string;
}

interface IStorageConfig {
  id: string;
  files: IStorageFile[];
}

class StorageConfig implements IStorageConfig {
  constructor(
    public id: string = "",
    public files: IStorageFile[] = [],
  ) {}
}

export class FileStorage {
  private _dir: string = path.join(process.cwd(), "data", "ai", "storage");
  private _configPath: string = path.join(
    process.cwd(),
    "data",
    "ai",
    "storage.json",
  );
  private config: StorageConfig;
  constructor() {}

  public async init(): Promise<void> {
    // check config
    try {
      const confData: IStorageConfig = JSON.parse(
        await fs.readFile(this._configPath, "utf-8"),
      );
      this.config = new StorageConfig(confData.id, confData.files);
    } catch (error) {
      this.config = new StorageConfig();
      await this.saveConfig();
    }

    // check vector store id
    try {
      if (!this.config.id) throw new Error("No vector store id");
      const vsData = await openai.vectorStores.retrieve(this.config.id);
    } catch (error) {
      this.config.id = (
        await openai.vectorStores.create({
          file_ids: [],
        })
      ).id;
      await this.saveConfig();
    }

    const idsSet: Set<string> = new Set();

    for (const file of this.config.files) {
      try {
        await openai.files.retrieve(file.id);
        await this.loadFile(file.name);
        idsSet.add(file.id);
      } catch (error) {
        continue;
      }
    }

    this.config.files = this.config.files.filter((el) => idsSet.has(el.id));
  }

  private async saveConfig(): Promise<void> {
    await fs.writeFile(this._configPath, JSON.stringify(this.config), "utf-8");
  }

  private async loadFile(name: string): Promise<Buffer> {
    const buf = await fs.readFile(path.join(this._dir, name));
    return buf;
  }

  public async addFile(buffer: Buffer, extension: string): Promise<string> {
    const name = `${v4()}${extension}`;
    await fs.writeFile(path.join(this._dir, name), buffer);

    const r = await openai.files.create({
      file: new File([buffer as BlobPart], name),
      purpose: "assistants",
    });

    await openai.vectorStores.files.create(this.config.id, {
      file_id: r.id,
    });

    this.config.files.push({
      id: r.id,
      name,
    });

    await this.saveConfig();
    return name;
  }

  public getFiles(): string[] {
    return this.config.files.map((el) => el.name);
  }

  public async deleteFile(name: string): Promise<void> {
    const f = this.config.files.find((el) => el.name === name);
    if (!f) throw new Error("Not found");
    this.config.files = this.config.files.filter((el) => el.name !== name);
    await this.saveConfig();
    await openai.files.delete(f.id);
    await fs.rm(path.join(this._dir, f.name));
  }

  public get id(): string {
    return this.config.id;
  }
}
