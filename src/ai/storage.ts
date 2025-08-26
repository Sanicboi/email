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
  private _dir = path.join(process.cwd(), "data", "ai", "storage");
  private _confPath = path.join(process.cwd(), "data", "ai", "storage.json");
  private _files: Map<string, StorageFile> = new Map();
  private _vectorStoreId: string = "";

  public constructor() {}

  public async init(): Promise<void> {
    const config: {
      files: IStorageFile[];
      vectorStoreId: string;
    } = JSON.parse(await fs.readFile(this._confPath, "utf-8"));

    // check that the vector store exists
    try {
      const vectorStoreData = await openai.vectorStores.retrieve(
        config.vectorStoreId,
      );
    } catch (error) {
      config.vectorStoreId = (
        await openai.vectorStores.create({
          file_ids: [],
        })
      ).id;
    }
    this._vectorStoreId = config.vectorStoreId;

    // check that all the files exist in openai
    for (const file of config.files) {
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

    // check that all files are in the vector store
    const storeFiles = await openai.vectorStores.files.list(
      this._vectorStoreId,
    );
    for (const [name, file] of this._files) {
      if (!storeFiles.data.find((el) => el.id === file.id)) {
        await openai.vectorStores.files.create(this._vectorStoreId, {
          file_id: file.id,
        });
      }
    }

    await this.save();
  }

  private async save(): Promise<void> {
    await fs.writeFile(
      this._confPath,
      JSON.stringify({
        files: Array.from(this._files.values()),
        vectoreStoreId: this._vectorStoreId,
      }),
    );
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
      file: new File([file.data as BlobPart], file.name),
      purpose: "assistants",
    });
    await openai.vectorStores.files.create(this._vectorStoreId, {
      file_id: res.id,
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

  public get storeId(): string {
    return this._vectorStoreId;
  }
}

export const storage = new Storage();
