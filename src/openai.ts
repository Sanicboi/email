import { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import {
  Evaluation,
  FirstMessageData,
  IDOnly,
  MsgInput,
  MsgOutput,
  TextInput,
  UnimplementedAIService,
} from "./grpc/ai";
import OpenAI from "openai";
import "dotenv/config";
import fs from "fs";
import path from "path";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import * as grpc from "@grpc/grpc-js";

const openai: OpenAI = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const writerPrompt: string = fs.readFileSync(
  path.join(process.cwd(), "writer.txt"),
  "utf-8",
);
const buffers: Buffer[] = (new Array(4)).map<Buffer>((el, idx) => fs.readFileSync(path.join(process.cwd(), `f${idx + 1}.${idx + 1 === 4 ? 'docx' : 'pdf'}`)));
let fileIds: string[] = [];


const EvaluationFormat = z.object({
  rating: z.number({
    description: "A number in the range [0, 10]",
  }),
  comment: z.string(),
});

class AIServiceImpl extends UnimplementedAIService {
  async generateFirstMessage(
    call: ServerUnaryCall<FirstMessageData, MsgOutput>,
    callback: sendUnaryData<MsgOutput>,
  ): Promise<void> {
    const generation = await openai.responses.create({
      input: [
        {
          role: "user",
          content: [
            ...fileIds.map<{
              type: 'input_file',
              file_id: string
            }>(el => ({
              type: 'input_file',
              file_id: el
            })),
            {
              type: "input_text",
              text: `Начни диалог. данные о клиенте: ${call.request.leadData}`,
            },
          ],
        },
      ],
      model: "gpt-4.1-nano",
      store: true,
      instructions: writerPrompt,
    });

    const firstMessage = new MsgOutput({
      id: generation.id,
      text: generation.output_text,
    });
    callback(null, firstMessage);
  }

  async evaluateInput(
    call: ServerUnaryCall<TextInput, Evaluation>,
    callback: sendUnaryData<Evaluation>,
  ): Promise<void> {
    const generation = await openai.responses.parse({
      instructions:
        "Проанализируй данное тебе сообщение. В ответе оцени важность (от 0 до 10 включительно) - насколько важно ответить на сообщение и дай комментарий к своему выбору.",
      store: false,
      text: {
        format: zodTextFormat(EvaluationFormat, "result"),
      },
      model: "gpt-4.1-nano",
      input: call.request.text,
    });
    if (!generation.output_parsed)
      return callback({
        message: "Could not parse the evaluation",
        name: "Internal Server Error",
      });
    return callback(null, new Evaluation(generation.output_parsed));
  }

  async generateResponse(
    call: ServerUnaryCall<MsgInput, MsgOutput>,
    callback: sendUnaryData<MsgOutput>,
  ): Promise<void> {
    const generation = await openai.responses.create({
      instructions: writerPrompt,
      previous_response_id: call.request.previousId,
      input: call.request.text,
      store: true,
      model: "gpt-4.1",
    });
    callback(
      null,
      new MsgOutput({
        id: generation.id,
        text: generation.output_text,
      }),
    );
  }

  async evaluateOutput(
    call: ServerUnaryCall<IDOnly, Evaluation>,
    callback: sendUnaryData<Evaluation>,
  ): Promise<void> {
    const generation = await openai.responses.parse({
      input: [
        {
          role: "developer",
          content:
            "Проанализируй последний ответ в предыдущем диалоге. Оцени его от 0 до 10 и дай комментарий (что нужно исправить).",
        },
      ],
      store: false,
      model: "gpt-4.1-nano",
      previous_response_id: call.request.id,
      text: {
        format: zodTextFormat(EvaluationFormat, "result"),
      },
    });

    if (!generation.output_parsed)
      return callback({
        message: "Could not parse the evaluation",
        name: "Internal Server Error",
      });
    callback(null, new Evaluation(generation.output_parsed));
  }

  async regenerateResponse(
    call: ServerUnaryCall<MsgInput, MsgOutput>,
    callback: sendUnaryData<MsgOutput>,
  ): Promise<void> {
    const generation = await openai.responses.create({
      instructions: writerPrompt,
      previous_response_id: call.request.previousId,
      input: [
        {
          role: "developer",
          content: `Ответь на последнее сообщение по-другому. Вот правки: ${call.request.text}`,
        },
      ],
      store: true,
      model: "gpt-4.1-nano",
    });
    callback(
      null,
      new MsgOutput({
        id: generation.id,
        text: generation.output_text,
      }),
    );
  }
}

const server = new grpc.Server();
server.addService(AIServiceImpl.definition, new AIServiceImpl());
server.bindAsync(
  "localhost:8080",
  grpc.ServerCredentials.createInsecure(),
  async () => {
    console.log("server started");
    const files = await openai.files.list();
    for (const f of files.data) {
      if (f.filename.endsWith('.pdf') && f.filename.startsWith('f') && f.filename.length === 6) {
        if (f.filename.includes('2')) continue;
        console.log('file found')
        fileIds.push(f.id);
      } else if (f.filename === 'f5.docx') {
        console.log('file found')
        fileIds.push(f.id);
      }
    } 
    if (fileIds.length < 4) {
      console.log('creating files...')
      let i = 1;
      for (const b of buffers) {
        if (i == 2) continue;
        let type: string = 'application/pdf';
        let extension: string = 'pdf';
        if (i == 4) {
          type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          extension = 'docx';
        }
        const res = await openai.files.create({
          file: new File([b], `f${i}.${extension}`, {
            type
          }),
          purpose: 'assistants'
        });
        i++;
        fileIds.push(res.id);
      }
    }

    console.log('files uploaded!');
  },
);
