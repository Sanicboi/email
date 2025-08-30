import z from "zod";
import { MessageEvaluation } from "../../grpc/ai";
import { Agent } from "./Agent";
import { openai } from "../openai";
import { zodTextFormat } from "openai/helpers/zod";

interface IEvaluatorInput {
  resId: string;
}

const resultEvaluation = z.object({
  rating: z.number({
    description: "Оценка ответа, число в промежутке [0, 10]",
  }),
  comment: z.string({
    description: "Подробный комментарий к выбору оценки",
  }),
});

class Evaluator extends Agent<IEvaluatorInput, MessageEvaluation> {
  constructor() {
    super("evaluator.json");
  }

  public async init(): Promise<void> {
    await this.load();
  }

  public async run(input: IEvaluatorInput): Promise<MessageEvaluation> {
    const res = await openai.responses.parse({
      model: this.model,
      instructions: this.prompt,
      previous_response_id: input.resId,
      store: false,
      input: `Оцени, от 0 до 10, качество последнего ответа клиенту.`,
      text: {
        format: zodTextFormat(resultEvaluation, "result"),
      },
    });
    if (!res.output_parsed) throw new Error("Not parsed!");
    return new MessageEvaluation({
      comment: res.output_parsed.comment,
      rating: res.output_parsed.rating,
    });
  }
}

export const evaluator = new Evaluator();
