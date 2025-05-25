"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const textsplitters_1 = require("@langchain/textsplitters");
const hf_1 = require("@langchain/community/embeddings/hf");
const supabase_1 = require("@langchain/community/vectorstores/supabase");
const output_parsers_1 = require("@langchain/core/output_parsers");
const prompts_1 = require("@langchain/core/prompts");
const supabase_provider_1 = __importDefault(require("./supabase.provider"));
const llm_provider_1 = __importDefault(require("./llm.provider"));
const runnables_1 = require("@langchain/core/runnables");
class LLMService {
    injestDocument() {
        return __awaiter(this, void 0, void 0, function* () {
            const rawData = yield this.readTextFile('documents/scrimba-info.txt');
            // Text Splitter
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 50,
            });
            const splitTexts = yield textSplitter.createDocuments([rawData]);
            // Embeddings and Vector upload to DB
            const dbClient = supabase_provider_1.default.dbClient;
            console.log('Text Splitting completed!');
            try {
                yield supabase_1.SupabaseVectorStore.fromDocuments(splitTexts, new hf_1.HuggingFaceInferenceEmbeddings({
                    apiKey: process.env.HUGGINGFACE_API_KEY,
                    model: "sentence-transformers/distilbert-base-nli-mean-tokens",
                }), {
                    client: dbClient,
                    tableName: 'documents',
                });
                console.log('Documents embedded and vectors uploaded successfully!');
            }
            catch (e) {
                throw new Error(`Error occured while embedding: ${e}`);
            }
            return splitTexts;
        });
    }
    readTextFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            let data;
            try {
                data = yield fs_1.promises.readFile(path, 'utf8');
            }
            catch (err) {
                console.error('Error reading file:', err);
            }
            return data;
        });
    }
    // Standalone questions: Reduce the original human query that would contain only the necessary information
    generateStandaloneQuestionWithPromptTemplate(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:';
            // A prompt created using PromptTemplate and the fromTemplate method
            const standaloneQuestionPrompt = prompts_1.PromptTemplate.fromTemplate(standaloneQuestionTemplate);
            // Take the standaloneQuestionPrompt and PIPE the model
            const standaloneQuestionChain = standaloneQuestionPrompt.pipe(llm_provider_1.default.llmClient).pipe(new output_parsers_1.StringOutputParser());
            // Await the response when you INVOKE the chain. 
            // Remember to pass in a question.
            const response = yield standaloneQuestionChain.invoke({
                question: query
            });
            return response;
        });
    }
    getRelevantContext(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:';
            const standaloneQuestionPrompt = prompts_1.PromptTemplate.fromTemplate(standaloneQuestionTemplate);
            const retriever = this.getRetriever();
            const chain = standaloneQuestionPrompt.pipe(llm_provider_1.default.llmClient).pipe(new output_parsers_1.StringOutputParser()).pipe(retriever);
            const retrievedDocs = yield chain.invoke({
                question: query
            });
            const retrievedString = this.combineDocs(retrievedDocs);
            return retrievedString;
        });
    }
    generateQueryResponse(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // Standalone Prompt Chain
            const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:';
            const standaloneQuestionPrompt = prompts_1.PromptTemplate.fromTemplate(standaloneQuestionTemplate);
            const standaloneQuestionChain = runnables_1.RunnableSequence.from([
                standaloneQuestionPrompt,
                llm_provider_1.default.llmClient,
                new output_parsers_1.StringOutputParser(),
            ]);
            // Retriever Chain
            const retriever = this.getRetriever();
            const retrieverChain = runnables_1.RunnableSequence.from([
                prevResult => prevResult.standalone_question,
                retriever,
                this.combineDocs,
            ]);
            // Answer Chain
            const answerTemplate = `You are a helpful and enthusiastic support bot who can answer a given question about Scrimba based on the context provided. Try to find the answer in the context. If you really don't know the answer, say "I'm sorry, I don't know the answer to that." And direct the questioner to email help@scrimba.com. Don't try to make up an answer. Always speak as if you were chatting to a friend.
            context: {context}
            question: {question}
            answer: `;
            const answerPrompt = prompts_1.PromptTemplate.fromTemplate(answerTemplate);
            const answerChain = runnables_1.RunnableSequence.from([
                answerPrompt,
                llm_provider_1.default.llmClient,
                new output_parsers_1.StringOutputParser(),
            ]);
            const chain = runnables_1.RunnableSequence.from([
                {
                    standalone_question: standaloneQuestionChain,
                    original_input: new runnables_1.RunnablePassthrough()
                },
                {
                    context: retrieverChain,
                    question: ({ original_input }) => original_input.question
                },
                answerChain,
            ]);
            const response = yield chain.invoke({
                question: query
            });
            return response;
        });
    }
    getRetriever() {
        const vectorStore = new supabase_1.SupabaseVectorStore(new hf_1.HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HUGGINGFACE_API_KEY,
            model: "sentence-transformers/distilbert-base-nli-mean-tokens",
        }), {
            client: supabase_provider_1.default.dbClient,
            tableName: 'documents',
            queryName: 'match_documents'
        });
        const retriever = vectorStore.asRetriever();
        return retriever;
    }
    combineDocs(docs) {
        return docs.map((doc) => doc.pageContent).join('\n\n');
    }
    runnableSequenceExample(sentence) {
        return __awaiter(this, void 0, void 0, function* () {
            const llm = llm_provider_1.default.llmClient;
            const punctuationTemplate = `Given a sentence, add punctuation where needed. 
            sentence: {sentence}
            sentence with punctuation:`;
            const punctuationPrompt = prompts_1.PromptTemplate.fromTemplate(punctuationTemplate);
            const grammarTemplate = `Given a sentence correct the grammar.
            sentence: {punctuated_sentence}
            sentence with correct grammar: 
            `;
            const grammarPrompt = prompts_1.PromptTemplate.fromTemplate(grammarTemplate);
            const translationTemplate = `Given a sentence, translate that sentence into {language}
        sentence: {grammatically_correct_sentence}
        translated sentence:`;
            const translationPrompt = prompts_1.PromptTemplate.fromTemplate(translationTemplate);
            const punctuationChain = runnables_1.RunnableSequence.from([
                punctuationPrompt,
                llm,
                new output_parsers_1.StringOutputParser()
            ]);
            const grammarChain = runnables_1.RunnableSequence.from([
                grammarPrompt,
                llm,
                new output_parsers_1.StringOutputParser()
            ]);
            const translationChain = runnables_1.RunnableSequence.from([
                translationPrompt,
                llm,
                new output_parsers_1.StringOutputParser()
            ]);
            const chain = runnables_1.RunnableSequence.from([
                {
                    punctuated_sentence: punctuationChain,
                    original_input: new runnables_1.RunnablePassthrough()
                },
                {
                    grammatically_correct_sentence: grammarChain,
                    language: ({ original_input }) => original_input.language
                },
                translationChain
            ]);
            const response = yield chain.invoke({
                sentence,
                language: 'french'
            });
            return response;
        });
    }
}
exports.default = LLMService;
