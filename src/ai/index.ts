import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import { AIServiceImpl } from "./impl";
import { config } from "./config";
import { storage } from "./storage";

const server = new grpc.Server();
server.addService(AIServiceImpl.definition, new AIServiceImpl());
config
  .init()
  .then(() => storage.init())
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
