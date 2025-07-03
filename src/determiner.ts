import { z } from "zod";
import { openai } from "./openai";
import { zodTextFormat } from "openai/helpers/zod";

const Determination = z.object({
  type: z.enum(["noreply", "reply", "pass"]),
  importance: z.number(),
  comment: z.string(),
});

export const determineType = async (
  thread: string | null,
  fileId: string | null,
  message: string,
): Promise<{
  type: "noreply" | "reply" | "pass";
  importance: number;
}> => {
  const res = await openai.responses.parse({
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
      {
        type: "message",
        role: "user",
        content: message,
      },
    ],
    previous_response_id: thread ?? undefined,
    model: "gpt-4.1-mini",
    store: false,
    text: {
      format: zodTextFormat(Determination, "result"),
    },
    instructions:
      "Ты - менеджер по продажам. Тебе будет дана база знаний и диалог менеджера (тебя) и потенциального клиента. Определи, что нужно делать с сообщением. В ответе укажи важность сообщения (от 0 до 10) и действие с ним. Действие - без ответа, ответить, передать старшему менеджеру. К своему выбору дай комментарий, почему ты так решил.",
  });

  if (!res.output_parsed) throw new Error("Parse error");
  return res.output_parsed;
};
