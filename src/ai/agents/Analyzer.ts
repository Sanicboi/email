import z from "zod";
import { Agent } from "./Agent";
import { ConversationAnalysis } from "../../grpc/ai";
import { openai } from "../openai";
import { zodTextFormat } from "openai/helpers/zod";

const ImportanceAnalysisFormat = z.object({
  importance: z.number({
    description: "Важность ответа на письмо. Число из промежутка [0, 10]",
  }),
  comment: z.string({
    description: "Твой комментарий к выбору",
  }),
  enthusiasm: z.number({
    description:
      "Энтузиазм (радость) клиента, на основе письма и предыдущего диалога. Число из промежутка [0, 10]",
  }),
  delayed: z.boolean({
    description: "Просит ли клиент подождать до определенного времени",
  }),
  delayDate: z.number({
    description:
      "Дата, до которой нужно ждать, если нужно. Только если delayed == true. Формат - Unix Epoch time, 13-digit",
  }),
});

interface IAnalyzerInput {
  resId: string;
  text: string;
}

class Analyzer extends Agent<IAnalyzerInput, ConversationAnalysis> {
  public constructor() {
    super("analyzer.json");
  }

  public async init(): Promise<void> {
    await this.load();
  }

  public async run(input: IAnalyzerInput): Promise<ConversationAnalysis> {
    const res = await openai.responses.parse({
      instructions: this._prompt,
      model: this._model,
      input: input.text,
      previous_response_id: input.resId,
      text: {
        format: zodTextFormat(ImportanceAnalysisFormat, "result"),
      },
      store: false,
    });
    if (!res.output_parsed) throw new Error("Not parsed!");
    return new ConversationAnalysis({
      comment: res.output_parsed.comment,
      delayDate: new Date(res.output_parsed.delayDate).toJSON(),
      enthusiasm: res.output_parsed.enthusiasm,
      isDelayed: res.output_parsed.delayed,
      rating: res.output_parsed.importance,
    });
  }
}

export const analyzer = new Analyzer();
