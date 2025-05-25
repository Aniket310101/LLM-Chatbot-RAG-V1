"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = require("@langchain/openai");
class LLMProvider {
    initiateLLMClient() {
        try {
            console.log('Creating LLM Client connection...');
            const openAIApiKey = process.env.OPENROUTER_API_KEY;
            LLMProvider.llmClient = new openai_1.ChatOpenAI({
                openAIApiKey,
                model: "gpt-4o-mini",
                temperature: 0.5,
                configuration: {
                    baseURL: 'https://openrouter.ai/api/v1',
                }
            });
        }
        catch (e) {
            throw new Error(`Error initialising OpenAI LLM Client: ${e}`);
        }
    }
    getLLMClient() {
        return LLMProvider.llmClient;
    }
}
exports.default = LLMProvider;
