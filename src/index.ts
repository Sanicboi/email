import { AppDataSource } from "./data-source";
import { Agent, AgentInputItem, run } from '@openai/agents';
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const firstMessage = `
Игорь, здравствуйте!
Получила ваше письмо – очень вовремя.
Прикладываю чек-лист типовых ошибок для вашей категории
товара.
Если по ходу возникнут вопросы или потребуется разбор
именно вашей схемы – пишите, договоримся о созвоне.
Я всегда на связи.
Мария Соколова
ПРОВЕ ГРУПП`

let thread: AgentInputItem[] = [];


AppDataSource.initialize().then(async () => {
    const bot = new TelegramBot(process.env.TG_TOKEN!, {
        polling: true
    });

    const agent = new Agent({
        name: 'МОП',
        model: ''
    })


    bot.onText(/\/start/, async (msg) => {
        thread = [];
        await bot.sendMessage(msg.chat.id, firstMessage);
    });

    bot.onText(/./, async (msg) => {
        if (msg.text?.startsWith('/')) return;

        const result = await run(
            agent,
            thread.concat({
                status: 'completed',
                role: 'assistant',
                content: [
                    {
                        type: 'output_text',
                        text: firstMessage,
                    }
                ],
            }, {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: msg.text!
                    }
                ]
            })
        );
        thread = result.history;
        await bot.sendMessage(msg.from!.id, result.finalOutput!);
    })
});

