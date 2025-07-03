import fs from "fs";
import path from "path";
import { openai } from "./openai";

export type Waiter = "kb" | "first" | "prompt" | null;

export class AppState {
  private _prompt: string;
  private _kbId: string | null;
  private _firstMsg: string;
  private _resId: string | null = null;
  private _waiter: Waiter = null;

  constructor() {
    const config: {
      prompt: string;
      kbId: string;
      firstMsg: string;
    } = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "ai.config.json"), "utf-8"),
    );

    this._prompt = config.prompt;
    this._kbId = config.kbId;
    this._firstMsg = config.firstMsg;
  }

  private saveConfig(): void {
    fs.writeFileSync(
      path.join(process.cwd(), "ai.config.json"),
      JSON.stringify({
        prompt: this._prompt,
        kbPath: this._kbId,
        firstMsg: this._firstMsg,
      }),
    );
  }

  public get prompt(): string {
    return this.prompt;
  }

  public set prompt(value: string) {
    this._prompt = value;
    this.saveConfig();
  }

  public get firstMsg(): string {
    return this._firstMsg;
  }

  public set firstMsg(value: string) {
    this._firstMsg = value;
    this.saveConfig();
  }

  public get kbId(): string {
    if (!this._kbId) throw new Error("No KB Id");
    return this._kbId;
  }

  public async setKb(name: string, buffer: Buffer): Promise<void> {
    if (this._kbId) await openai.files.del(this._kbId);
    const file = new File([buffer], name);
    const res = await openai.files.create({
      file,
      purpose: "assistants",
    });
    this._kbId = res.id;
  }

  public get resId(): string | null {
    return this._resId;
  }

  public set resId(value: string | null) {
    this._resId = value;
  }

  public get waiter(): Waiter {
    return this._waiter;
  }

  public set waiter(value: Waiter) {
    this._waiter = value;
  }
}
