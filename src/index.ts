import * as grpc from "@grpc/grpc-js";
import { AIClient, MSG, UnimplementedAIService } from "./grpc/ai";

class AIServiceImpl extends UnimplementedAIService {
  async ping(
    call: grpc.ServerUnaryCall<MSG, MSG>,
    callback: grpc.sendUnaryData<MSG>,
  ): Promise<void> {
    const res = new MSG();
    console.log(call.request.data);
    res.data = "PONG";
    callback(null, res);
  }
}

const server = new grpc.Server();
server.addService(UnimplementedAIService.definition, new AIServiceImpl());
server.bindAsync(
  "localhost:8080",
  grpc.ServerCredentials.createInsecure(),
  () => {
    const client = new AIClient(
      "localhost:8080",
      grpc.credentials.createInsecure(),
    );
    const request = new MSG();
    request.data = "PING";

    client.ping(request, async (err, response) => {
      console.log(response?.data);
    });
  },
);
