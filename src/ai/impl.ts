import { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import {
  AIMessage,
  ConversationAnalysis,
  ConversationData,
  MessageEvaluation,
  UnimplementedAIService,
  UserData,
  UserMessage,
} from "../grpc/ai";
import { FileData, FileName, FilesList } from "../grpc/files";
import { writer } from "./agents/Writer";
import { Empty } from "../grpc/shared";
import { ModelData } from "../grpc/model";
import { Agent, AgentType, Prompt } from "../grpc/prompts";
import { ModelName } from "./openai";
import { analyzer } from "./agents/Analyzer";
import { evaluator } from "./agents/Evaluator";

export class AIServiceImpl extends UnimplementedAIService {
  public async getFiles(
    call: ServerUnaryCall<Empty, FilesList>,
    callback: sendUnaryData<FilesList>,
  ): Promise<void> {
    const files = writer.storage.getFiles();
    callback(
      null,
      new FilesList({
        names: files.map(
          (el) =>
            new FileName({
              name: el,
            }),
        ),
      }),
    );
  }

  public async addFile(
    call: ServerUnaryCall<FileData, FileName>,
    callback: sendUnaryData<FileName>,
  ): Promise<void> {
    try {
      const name = await writer.storage.addFile(
        Buffer.from(call.request.content),
        call.request.extension,
      );
      callback(
        null,
        new FileName({
          name,
        }),
      );
    } catch (error) {
      callback(new Error("File upload error"));
    }
  }

  public async deleteFile(
    call: ServerUnaryCall<FileName, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    await writer.storage.deleteFile(call.request.name);
    callback(null, new Empty());
  }

  public async getModel(
    call: ServerUnaryCall<Agent, ModelData>,
    callback: sendUnaryData<ModelData>,
  ): Promise<void> {
    let model: ModelName;
    switch (call.request.agent) {
      case AgentType.Analyzer:
        model = analyzer.model;
        break;
      case AgentType.Evaluator:
        model = evaluator.model;
        break;
      case AgentType.Writer:
        model = writer.model;
        break;
    }
    callback(
      null,
      new ModelData({
        agent: call.request.agent,
        name: model,
      }),
    );
  }

  public async setModel(
    call: ServerUnaryCall<ModelData, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    switch (call.request.agent) {
      case AgentType.Writer:
        writer.model = call.request.name as ModelName;
        await writer.save();
        break;
      case AgentType.Analyzer:
        analyzer.model = call.request.name as ModelName;
        await analyzer.save();
        break;
      case AgentType.Evaluator:
        evaluator.model = call.request.name as ModelName;
        await evaluator.save();
        break;
    }

    callback(null, new Empty());
  }

  public async getPrompt(
    call: ServerUnaryCall<Agent, Prompt>,
    callback: sendUnaryData<Prompt>,
  ): Promise<void> {
    let prompt: string;
    switch (call.request.agent) {
      case AgentType.Analyzer:
        prompt = analyzer.prompt;
        break;
      case AgentType.Evaluator:
        prompt = evaluator.prompt;
        break;
      case AgentType.Writer:
        prompt = writer.prompt;
        break;
    }
    callback(
      null,
      new Prompt({
        agent: call.request.agent,
        prompt,
      }),
    );
  }

  public async setPrompt(
    call: ServerUnaryCall<Prompt, Empty>,
    callback: sendUnaryData<Empty>,
  ): Promise<void> {
    switch (call.request.agent) {
      case AgentType.Writer:
        writer.prompt = call.request.prompt;
        await writer.save();
        break;
      case AgentType.Analyzer:
        analyzer.prompt = call.request.prompt;
        await analyzer.save();
        break;
      case AgentType.Evaluator:
        evaluator.prompt = call.request.prompt;
        await evaluator.save();
        break;
    }
    callback(null, new Empty())
  }

  public async write(
    call: ServerUnaryCall<UserData, AIMessage>,
    callback: sendUnaryData<AIMessage>,
  ): Promise<void> {
    try {
      callback(
        null,
        await writer.run({
          type: "write",
          resId: "",
          text: call.request.data,
        }),
      );
    } catch (error) {
      callback(Error("Error running"));
    }
  }

  public async heat(
    call: ServerUnaryCall<ConversationData, AIMessage>,
    callback: sendUnaryData<AIMessage>,
  ): Promise<void> {
    try {
      callback(
        null,
        await writer.run({
          type: "heat",
          resId: call.request.resId,
          text: "",
        }),
      );
    } catch (error) {
      callback(Error("Error running"));
    }
  }

  public async respond(
    call: ServerUnaryCall<UserMessage, AIMessage>,
    callback: sendUnaryData<AIMessage>,
  ): Promise<void> {
    try {
      callback(
        null,
        await writer.run({
          type: "respond",
          resId: call.request.resId,
          text: call.request.text,
        }),
      );
    } catch (error) {
      callback(Error("Error running"));
    }
  }

  public async analyze(
    call: ServerUnaryCall<UserMessage, ConversationAnalysis>,
    callback: sendUnaryData<ConversationAnalysis>,
  ): Promise<void> {
    try {
      callback(null, await analyzer.run(call.request));
    } catch (error) {
      callback(Error("Error running"));
    }
  }

  public async evaluate(
    call: ServerUnaryCall<ConversationData, MessageEvaluation>,
    callback: sendUnaryData<MessageEvaluation>,
  ): Promise<void> {
    try {
      callback(null, await evaluator.run(call.request));
    } catch (error) {
      callback(Error("Error running"));
    }
  }
}
