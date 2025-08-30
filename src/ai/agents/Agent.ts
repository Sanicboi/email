import path from "path";
import { ModelName } from "../openai";
import fs from "fs/promises";

interface IConfig {
  model: ModelName;
  prompt: string;
}

export abstract class Agent<I, R> implements IConfig {
  protected _prompt: string = "";
  protected _model: ModelName = "gpt-4.1-nano";

  constructor(private fileName: string) {}

  public get prompt(): string {
    return this._prompt;
  }

  public get model(): ModelName {
    return this._model;
  }

  public set prompt(value: string) {
    this._prompt = value;
  }

  public set model(value: ModelName) {
    this._model = value;
  }

  public async save(): Promise<void> {
    await fs.writeFile(
      path.join(process.cwd(), "data", "ai", this.fileName),
      JSON.stringify({
        model: this._model,
        prompt: this.prompt,
      }),
      "utf-8",
    );
  }

  public async load(): Promise<void> {
    const dirData = await fs.readdir(path.join(process.cwd(), "data", "ai"));
    if (!dirData.includes(this.fileName)) {
      await this.save();
    } else {
      const config: IConfig = JSON.parse(
        await fs.readFile(
          path.join(process.cwd(), "data", "ai", this.fileName),
          "utf-8",
        ),
      );
      this._model = config.model;
      this._prompt = config.prompt;
    }
  }

  public abstract init(): Promise<void>;
  public abstract run(input: I): Promise<R>;
}
