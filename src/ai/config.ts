import path from "path";
import fs from "fs/promises";

export type model =
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "gpt-4o"
  | "gpt-4o-mini";

class AIConfiguration {
  private _prompt: string;
  private _model: model;
  private _path = path.join(process.cwd(), "data", 'ai', "config.json");

  public constructor() {}

  public async init() {
    const data = await fs.readFile(this._path, "utf-8");
    const conf: {
      model: model;
      prompt: string;
    } = JSON.parse(data);
    this._model = conf.model;
    this._prompt = conf.prompt;
  }

  private async save() {
    await fs.writeFile(
      this._path,
      JSON.stringify({
        model: this._model,
        prompt: this._prompt,
      }),
    );
  }

  public get model(): string {
    return this._model;
  }

  public get prompt(): string {
    return this._prompt;
  }

  public async setModel(m: model): Promise<void> {
    this._model = m;
    await this.save();
  }

  public async setPrompt(p: string): Promise<void> {
    this._prompt = p;
    await this.save();
  }
}

export const config = new AIConfiguration();
