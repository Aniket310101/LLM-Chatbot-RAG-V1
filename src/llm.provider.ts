
import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';


export default class LLMProvider {
    static llmClient: ChatOpenAI<ChatOpenAICallOptions>;
    initiateLLMClient() {
        try {
            console.log('Creating LLM Client connection...')
            const openAIApiKey = process.env.OPENROUTER_API_KEY;
            LLMProvider.llmClient = new ChatOpenAI({ 
                openAIApiKey,
                model: "gpt-4o-mini",
                temperature: 0.5,
                configuration: {
                    baseURL: 'https://openrouter.ai/api/v1',
                }
            });
        } catch (e) {
            throw new Error(`Error initialising OpenAI LLM Client: ${e}`);
        }
    }

    getLLMClient(): ChatOpenAI<ChatOpenAICallOptions> {
        return LLMProvider.llmClient;
    }
}