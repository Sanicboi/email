import * as grpc from '@grpc/grpc-js';
import { AIClient } from '../grpc/ai';





export const client = new AIClient(process.env.AI_ADDR!, grpc.credentials.createInsecure());
