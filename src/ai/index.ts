import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import { AIServiceImpl } from "./impl";
import { analyzer } from "./agents/Analyzer";
import { evaluator } from "./agents/Evaluator";
import { writer } from "./agents/Writer";

const server = new grpc.Server();
server.addService(AIServiceImpl.definition, new AIServiceImpl());
analyzer.init()
  .then(() => evaluator.init())
  .then(() => writer.init())
  .then(() => {
    server.bindAsync(
      "0.0.0.0:8080",
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error(error);
        } else {
          console.log(`Server listening on port ${port}`);
        }
      },
    );
  });
