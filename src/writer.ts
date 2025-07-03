import OpenAI from "openai";
import { openai } from "./openai";

export const replyToMessage = async (
  thread: string | null,
  fileId: string | null,
  message: string,
  prompt: string | null,
  retry: boolean = false,
): Promise<{
  text: string;
  id: string;
}> => {
  const msgs: OpenAI.Responses.ResponseInputItem[] = [
    {
      type: "message",
      role: retry ? "developer" : "user",
      content: message,
    },
  ];
  if (!thread) {
    msgs.unshift({
      type: "message",
      role: "developer",
      content: [
        {
          type: "input_file",
          file_id: fileId ?? undefined,
        },
      ],
    });
  }
  const res = await openai.responses.create({
    model: "gpt-4.1",
    input: msgs,
    previous_response_id: thread ?? undefined,
    store: true,
    instructions: prompt ?? "",
  });

  return {
    id: res.id,
    text: res.output_text,
  };
};
