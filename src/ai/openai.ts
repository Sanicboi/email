import OpenAI from "openai";
import { config } from "./config";
import { storage } from "./storage";
import { EvaluationStatus, ResponseData } from "../grpc/ai";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_TOKEN,
});

const ImportanceAnalysisFormat = z.object({
  importance: z.number({
    description: "Важность ответа на письмо. Число из промежутка [0, 10]",
  }),
  comment: z.string({
    description: "Твой комментарий к выбору"
  }),
  enthusiasm: z.number({
    description: "Энтузиазм (радость) клиента, на основе письма и предыдущего диалога. Число из промежутка [0, 10]",
  }),
  delayed: z.boolean({
    description: "Просит ли клиент подождать до определенного времени"
  }),
  delayDate: z.number({
    description: "Дата, до которой нужно ждать, если нужно. Только если delayed == true. Формат - Unix Epoch time, 13-digit"
  })
});

const resultEvaluation = z.object({
  rating: z.number({
    description: "Оценка ответа, число в промежутке [0, 10]"
  }),
  comment: z.string({
    description: "Подробный комментарий к выбору оценки"
  })
})


export const generateFirstMessage = async (data: string): Promise<{
  text: string,
  id: string
}> => {
  const res = await openai.responses.create({
    model: config.model,
    instructions: config.prompt,
    input: [
      {
        role: 'user',
        content: storage.getAll().map(el => ({
          type: "input_file",
          file_id: el.id,
        })),
      },
      {
        role: 'user',
        content: `Начни диалог с клиентом. Данные о клиенте: ${data}`
      }
    ],
    store: true,
  });
  return {
    id: res.id,
    text: res.output_text
  }
}

export const generateHeatMessage = async (id: string): Promise<{
  id: string,
  text: string
}> => {
  const res = await openai.responses.create({
    model: config.model,
    instructions: config.prompt,
    previous_response_id: id,
    input: `На основе предыдущего диалога, напиши клиенту сообщение, чтобы аккуратно вернуть его в диалог.`,
    store: true
  });
  return {
    id: res.id,
    text: res.output_text
  };
}

export const respond = async (text: string, id: string): Promise<ResponseData> => {
  // 1 - оценка
  const evaluation = await openai.responses.parse({
    model: config.model,
    instructions: `Ты - аналитик-социолог. Тебе будет дано пиьсмо (имейл) и предыдущий диалог. Твоя задача - проанализировать последнее письмо, и указать следующие параметры. 1) Важность ответа на данное письмо. 2) Энтузиазм клиента. 3) Необходимо ли временно приостановить диалог (только по требованию клиента). 4) Если необходимо - дата, до которой надо приостановить диалог. 5) ПОдробный комментарий к твоему выбору. Текущая дата и время: ${(new Date()).getTime()} (milliseconds since epoch)`,
    input: text,
    previous_response_id: id,
    text: {
      format: zodTextFormat(ImportanceAnalysisFormat, 'result')
    },
    store: false
  });

  if (!evaluation.output_parsed) throw new Error("Parsing error");

  // 2 - фильтр
  if (evaluation.output_parsed.importance < config.filter) {
    const d = evaluation.output_parsed;
    return new ResponseData({
      delayDate: (new Date(d.delayDate)).toISOString(),
      delayed: d.delayed,
      enthusiasm: d.enthusiasm,
      importance: d.importance,
      evaluationComment: d.comment,
      status: EvaluationStatus.FAIL
    });
  }

  // 3 - генерация ответа
  const response = await openai.responses.create({
    instructions: config.prompt,
    model: config.model,
    input: text,
    previous_response_id: id,
    store: true,
  });

  // 4 - оценка ответа
  const resEval = await openai.responses.parse({
    instructions: 'Ты - профессиональный аналитик-социолог и менеджер по продажам.',
    store: false,
    text: {
      format: zodTextFormat(resultEvaluation, 'result')
    },
    previous_response_id: response.id,
    input: 'Оцени, от 0 до 10, качество последнего ответа клиенту.',
    model: config.model,
  });
  
  if (!resEval.output_parsed) {
    throw new Error("Parsing error");
  }
  // 5 - вернуть результат

  const d1 = evaluation.output_parsed;
  const d2 = resEval.output_parsed;
  return new ResponseData({
    delayDate: (new Date(d1.delayDate)).toISOString(),
    delayed: d1.delayed,
    enthusiasm: d1.enthusiasm,
    evaluationComment: d1.comment,
    importance: d1.importance,
    response: response.output_text,
    responseId: response.id,
    responseComment: d2.comment,
    responseRating: d2.rating,
    status: EvaluationStatus.PASS
  });
}