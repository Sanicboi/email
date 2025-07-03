import { z } from "zod";
import { openai } from "./openai";
import { zodTextFormat } from "openai/helpers/zod";

const Evaluation = z.object({
  rating: z.number(),
  comment: z.string(),
});

export const evaluateResponse = async (
  thread: string | null,
  fileId: string | null,
): Promise<{
  rating: number;
  comment: string;
}> => {
  const res = await openai.responses.parse({
    model: "gpt-4.1-mini",
    input: [
      {
        type: "message",
        role: "developer",
        content: [
          {
            type: "input_file",
            file_id: fileId ?? undefined,
          },
        ],
      },
    ],
    store: false,
    instructions:
      "Тебе будет дана база знаний. Оцени предыдущий диалог менеджера (тебя) и пользователя, основываясь на базе знаний. В ответе укажи оценку последнего ответа от 0 до 10 и дай комментарий, почему ты так решил.",
    previous_response_id: thread ?? null,
    text: {
      format: zodTextFormat(Evaluation, "result"),
    },
  });
  if (!res.output_parsed) throw new Error("Parse error");
  return res.output_parsed;
};
