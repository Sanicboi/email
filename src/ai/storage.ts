import fs from "fs/promises";
import path from "path";
import { openai } from "./openai";

export interface IStorageFile {
  id: string;
  name: string;
}

export interface ICreateStorageFile {
  name: string;
  data: Buffer;
}

export class StorageFile implements IStorageFile {
  constructor(
    private _dir: string,
    public id: string,
    public name: string,
  ) {}

  public static async create(
    _dir: string,
    id: string,
    name: string,
    data: Buffer,
  ): Promise<StorageFile> {
    await fs.writeFile(path.join(_dir, name), data);
    return new StorageFile(_dir, id, name);
  }

  public async getData(): Promise<Buffer> {
    return await fs.readFile(path.join(this._dir, this.name));
  }

  public async destroy(): Promise<void> {
    await fs.rm(path.join(this._dir, this.name));
  }
}

class Storage {
  private _dir = path.join(process.cwd(), "data", 'ai', "storage");
  private _confPath = path.join(process.cwd(), "data", 'ai', "storage.json");
  private _files: Map<string, StorageFile> = new Map();

  public constructor() {}

  public async init(): Promise<void> {
    const config: IStorageFile[] = JSON.parse(
      await fs.readFile(this._confPath, "utf-8"),
    );
    for (const file of config) {
      try {
        const fromApi = await openai.files.retrieve(file.id);
        if (!fromApi) continue;
        this._files.set(
          file.name,
          new StorageFile(this._dir, file.id, file.name),
        );
      } catch (error) {
        try {
          await this.add({
            data: await fs.readFile(path.join(this._dir, file.name)),
            name: file.name,
          });
        } catch (error) {
          console.error(`Error fallback adding file: ${error}`);
        }
      }
    }
  }

  public getOne(name: string): StorageFile | undefined {
    return this._files.get(name);
  }

  public getAll(): StorageFile[] {
    return Array.from(this._files.values());
  }

  public async add(file: ICreateStorageFile): Promise<void> {
    if (this._files.has(file.name)) return;
    const res = await openai.files.create({
      file: new File([file.data], file.name),
      purpose: "assistants",
    });
    this._files.set(
      file.name,
      await StorageFile.create(this._dir, res.id, file.name, file.data),
    );
  }

  public async deleteFile(name: string): Promise<void> {
    const file = this._files.get(name);
    if (!file) return;
    await file.destroy();
    await openai.files.delete(file.id);
  }
}

export const storage = new Storage();
