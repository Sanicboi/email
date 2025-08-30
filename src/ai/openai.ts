import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_TOKEN!,
});

export type ModelName =
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "gpt-5"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "gpt-4";
