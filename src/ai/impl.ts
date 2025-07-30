import { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import { UnimplementedAIService } from "../grpc/ai";
import { FileName, FilesList, FileUploadRequest } from "../grpc/files";
import { Empty } from "../grpc/shared";
import { Model, Prompt } from "../grpc/configuration";
import {
  Evaluation,
  FirstMessageGenerationRequest,
  InputEvaluationRequest,
  MessageGenerationResult,
  OutputEvaluationRequest,
  ResponseGenerationRequest,
} from "../grpc/generation";
import { storage } from "./storage";
import { config, model } from "./config";
import { openai } from "./openai";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const EvaluationFormat = z.object({
  rating: z.number({
    description: "A number in the range [0, 10]",
  }),
  comment: z.string(),
});

export class AIServiceImpl extends UnimplementedAIService {
  public async getFiles(
    call: ServerUnaryCall<Empty, FilesList>,
    callback: sendUnaryData<FilesList>,
  ): Promise<void> {
    const files = await storage.getAll();
    callback(
      null,
      new FilesList({
        names: files.map(
          (el) =>
            new FileName({
              name: el.name,
            }),
        ),
      }),
    );
  }

  public async addFile(
    call: ServerUnaryCall<FileUploadRequest, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    await storage.add({
      data: Buffer.from(call.request.content),
      name: call.request.name,
    });
    callback(null);
  }

  public async deleteFile(
    call: ServerUnaryCall<FileName, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    await storage.deleteFile(call.request.name);
    callback(null);
  }

  public async getModel(
    call: ServerUnaryCall<Empty, Model>,
    callback: sendUnaryData<Model>,
  ): Promise<void> {
    callback(
      null,
      new Model({
        model: config.model,
      }),
    );
  }

  public async editModel(
    call: ServerUnaryCall<Model, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    await config.setModel(call.request.model as model);
    callback(null);
  }

  public async getPrompt(
    call: ServerUnaryCall<Empty, Prompt>,
    callback: sendUnaryData<Prompt>,
  ): Promise<void> {
    callback(
      null,
      new Prompt({
        prompt: config.prompt,
      }),
    );
  }

  public async editPrompt(
    call: ServerUnaryCall<Prompt, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    await config.setPrompt(call.request.prompt);
    callback(null);
  }

  public async generateFirstMessage(
    call: ServerUnaryCall<
      FirstMessageGenerationRequest,
      MessageGenerationResult
    >,
    callback: sendUnaryData<MessageGenerationResult>,
  ): Promise<void> {
    const generation = await openai.responses.create({
      model: config.model,
      store: true,
      instructions: config.prompt,
      input: [
        {
          role: "user",
          content: [
            ...storage.getAll().map<{
              type: "input_file";
              file_id: string;
            }>((el) => ({
              type: "input_file",
              file_id: el.id,
            })),
            {
              type: "input_text",
              text: `Начни диалог. данные о клиенте: ${call.request.userData}`,
            },
          ],
        },
      ],
    });

    callback(
      null,
      new MessageGenerationResult({
        id: generation.id,
        text: generation.output_text,
      }),
    );
  }

  public async evaluateInput(
    call: ServerUnaryCall<InputEvaluationRequest, Evaluation>,
    callback: sendUnaryData<Evaluation>,
  ): Promise<void> {
    const evaluation = await openai.responses.parse({
      model: "gpt-4.1-nano",
      instructions:
        "Проанализируй данное тебе сообщение. В ответе оцени важность (от 0 до 10 включительно) - насколько важно ответить на сообщение и дай комментарий к своему выбору.",
      store: false,
      input: call.request.text,
      text: {
        format: zodTextFormat(EvaluationFormat, "result"),
      },
    });
    if (!evaluation.output_parsed) {
      callback({
        message: "Error parsing output",
        name: "Internal Server Error",
      });
      return;
    }
    callback(
      null,
      new Evaluation({
        ...evaluation.output_parsed,
      }),
    );
  }

  public async generateResponse(
    call: ServerUnaryCall<ResponseGenerationRequest, MessageGenerationResult>,
    callback: sendUnaryData<MessageGenerationResult>,
  ): Promise<void> {
    const gen = await openai.responses.create({
      instructions: config.prompt,
      input: call.request.text,
      previous_response_id: call.request.previousId,
      store: true,
      model: config.model,
    });

    callback(
      null,
      new MessageGenerationResult({
        id: gen.id,
        text: gen.output_text,
      }),
    );
  }

  public async evaluateOutput(
    call: ServerUnaryCall<OutputEvaluationRequest, Evaluation>,
    callback: sendUnaryData<Evaluation>,
  ): Promise<void> {
    const evaluation = await openai.responses.parse({
      model: config.model,
      input: [
        {
          role: "developer",
          content:
            "Проанализируй последний ответ в предыдущем диалоге. Оцени его от 0 до 10 и дай комментарий (что нужно исправить).",
        },
      ],
      store: false,
      previous_response_id: call.request.id,
      text: {
        format: zodTextFormat(EvaluationFormat, "result"),
      },
    });
    if (!evaluation.output_parsed) {
      callback({
        name: "Internal Server Error",
        message: "Could not parse output",
      });
      return;
    }
    callback(
      null,
      new Evaluation({
        ...evaluation.output_parsed,
      }),
    );
  }

  public async regenerateResponse(
    call: ServerUnaryCall<ResponseGenerationRequest, MessageGenerationResult>,
    callback: sendUnaryData<MessageGenerationResult>,
  ): Promise<void> {
    const res = await openai.responses.create({
      instructions: config.prompt,
      previous_response_id: call.request.previousId,
      input: [
        {
          role: "developer",
          content: `Ответь на последнее сообщение по-другому. Вот правки: ${call.request.text}`,
        },
      ],
      store: true,
      model: config.model,
    });
    callback(
      null,
      new MessageGenerationResult({
        id: res.id,
        text: res.output_text,
      }),
    );
  }
}
