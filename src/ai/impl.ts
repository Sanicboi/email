import { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import {
  DialogueData,
  FilterValue,
  FirstMessage,
  ResponseData,
  UnimplementedAIService,
  UserData,
  UserMessage,
} from "../grpc/ai";
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
import {
  generateFirstMessage,
  generateHeatMessage,
  openai,
  respond,
} from "./openai";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";

export class AIServiceImpl extends UnimplementedAIService {
  public async getFiles(
    call: ServerUnaryCall<Empty, FilesList>,
    callback: sendUnaryData<FilesList>
  ): Promise<void> {
    const files = await storage.getAll();
    callback(
      null,
      new FilesList({
        names: files.map(
          (el) =>
            new FileName({
              name: el.name,
            })
        ),
      })
    );
  }

  public async addFile(
    call: ServerUnaryCall<FileUploadRequest, Empty>,
    callback: sendUnaryData<Empty>
  ): Promise<void> {
    await storage.add({
      data: Buffer.from(call.request.content),
      name: call.request.name,
    });
    callback(null, new Empty());
  }

  public async deleteFile(
    call: ServerUnaryCall<FileName, Empty>,
    callback: sendUnaryData<Empty>
  ): Promise<void> {
    await storage.deleteFile(call.request.name);
    callback(null, new Empty());
  }

  public async getModel(
    call: ServerUnaryCall<Empty, Model>,
    callback: sendUnaryData<Model>
  ): Promise<void> {
    callback(
      null,
      new Model({
        model: config.model,
      })
    );
  }

  public async editModel(
    call: ServerUnaryCall<Model, Empty>,
    callback: sendUnaryData<Empty>
  ): Promise<void> {
    await config.setModel(call.request.model as model);
    callback(null, new Empty());
  }

  public async getPrompt(
    call: ServerUnaryCall<Empty, Prompt>,
    callback: sendUnaryData<Prompt>
  ): Promise<void> {
    callback(
      null,
      new Prompt({
        prompt: config.prompt,
      })
    );
  }

  public async editPrompt(
    call: ServerUnaryCall<Prompt, Empty>,
    callback: sendUnaryData<Empty>
  ): Promise<void> {
    await config.setPrompt(call.request.prompt);
    callback(null, new Empty());
  }

  public async generateFirstMessage(
    call: ServerUnaryCall<UserData, FirstMessage>,
    callback: sendUnaryData<FirstMessage>
  ): Promise<void> {
    try {
      const res = await generateFirstMessage(call.request.data);
      callback(null, new FirstMessage(res));
    } catch (error) {
      console.error(error);
      callback(new Error("Unknown error"));
    }
  }

  public async generateHeatMessage(
    call: ServerUnaryCall<DialogueData, FirstMessage>,
    callback: sendUnaryData<FirstMessage>
  ): Promise<void> {
    try {
      const res = await generateHeatMessage(call.request.id);
      callback(null, new FirstMessage(res));
    } catch (error) {
      callback(new Error("Unknown error"));
    }
  }

  public async respond(
    call: ServerUnaryCall<UserMessage, ResponseData>,
    callback: sendUnaryData<ResponseData>
  ): Promise<void> {
    try {
      const res = await respond(call.request.text, call.request.id);
      callback(null, res);
    } catch (error) {
      callback(new Error("Parsing error"));
    }
  }

  public async getFilterValue(
    call: ServerUnaryCall<Empty, FilterValue>,
    callback: sendUnaryData<FilterValue>
  ): Promise<void> {
    callback(
      null,
      new FilterValue({
        value: config.filter,
      })
    );
  }

  public async setFilterValue(
    call: ServerUnaryCall<FilterValue, Empty>,
    callback: sendUnaryData<Empty>
  ): Promise<void> {
    try {
      await config.setFilter(call.request.value);
      callback(null, new Empty());
    } catch (error) {
      callback(new Error("Invalid filter value"));
    }
  }
}
