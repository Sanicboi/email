import { AIMessage } from "../../grpc/ai";
import { openai } from "../openai";
import { FileStorage } from "../storage";
import { Agent } from "./Agent";

interface IWriterInput {
  type: "write" | "heat" | "respond";
  text?: string;
  resId?: string;
}

class Writer extends Agent<IWriterInput, AIMessage> {
  constructor() {
    super("writer.json");
  }

  public storage = new FileStorage();

  public async init(): Promise<void> {
    await this.load();
    await this.storage.init();
  }

  public async run(input: IWriterInput): Promise<AIMessage> {
    if (input.type === "respond") {
      if (!input.resId || !input.text) throw new Error("Invalid request");
      const res = await openai.responses.create({
        model: this.model,
        previous_response_id: input.resId,
        input: input.text,
        store: true,
        instructions: this._prompt,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [this.storage.id],
          },
        ],
      });
      return new AIMessage({
        id: res.id,
        text: res.output_text,
      });
    } else if (input.type === "heat") {
      if (!input.resId) throw new Error("Invalid request");
      const res = await openai.responses.create({
        model: this.model,
        previous_response_id: input.resId,
        input: `На основе предыдущего диалога, напиши клиенту сообщение, чтобы аккуратно вернуть его в диалог.`,
        store: true,
        instructions: this._prompt,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [this.storage.id],
          },
        ],
      });
      return new AIMessage({
        id: res.id,
        text: res.output_text,
      });
    } else {
      if (!input.text) throw new Error("Invalid request");
      const res = await openai.responses.create({
        model: this.model,
        input: `Начни диалог с клиентом. Данные о клиенте: ${input.text}`,
        store: true,
        instructions: this._prompt,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [this.storage.id],
          },
        ],
      });
      return new AIMessage({
        id: res.id,
        text: res.output_text,
      });
    }
  }
}

export const writer = new Writer();
