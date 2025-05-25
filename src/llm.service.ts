import { promises as fs } from 'fs';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { StringOutputParser  } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import SupabaseProvider from './supabase.provider';
import LLMProvider from './llm.provider';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { DocumentInterface } from '@langchain/core/documents';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';

export default class LLMService {
    async injestDocument() {
        const rawData: string = await this.readTextFile('documents/scrimba-info.txt');

        // Text Splitter
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
          });
        const splitTexts = await textSplitter.createDocuments([rawData]);

        // Embeddings and Vector upload to DB
        const dbClient = SupabaseProvider.dbClient;
        console.log('Text Splitting completed!');
        try {
            await SupabaseVectorStore.fromDocuments(
                splitTexts,
                new HuggingFaceInferenceEmbeddings({
                    apiKey: process.env.HUGGINGFACE_API_KEY,
                    model: "sentence-transformers/distilbert-base-nli-mean-tokens",
                }),
                {
                    client: dbClient,
                    tableName: 'documents',
                }
            )
            console.log('Documents embedded and vectors uploaded successfully!');
        } catch (e) {
            throw new Error(`Error occured while embedding: ${e}`);
        }

        return splitTexts;
    }

    private async readTextFile(path: string): Promise<string> {
        let data: string;
        try {
          data = await fs.readFile(path, 'utf8');
        } catch (err) {
          console.error('Error reading file:', err);
        }
        return data;
    }

    // Standalone questions: Reduce the original human query that would contain only the necessary information
    async generateStandaloneQuestionWithPromptTemplate(query: string) {
        const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:'
        // A prompt created using PromptTemplate and the fromTemplate method
        const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate)
        // Take the standaloneQuestionPrompt and PIPE the model
        const standaloneQuestionChain = standaloneQuestionPrompt.pipe(LLMProvider.llmClient).pipe(new StringOutputParser());
        // Await the response when you INVOKE the chain. 
        // Remember to pass in a question.
        const response = await standaloneQuestionChain.invoke({
            question: query
        })
        return response;
    }

    async getRelevantContext(query: string) {
        const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:'
        const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
        const retriever = this.getRetriever();
        const chain = standaloneQuestionPrompt.pipe(LLMProvider.llmClient).pipe(new StringOutputParser()).pipe(retriever);
        const retrievedDocs = await chain.invoke({
            question: query
        })
        const retrievedString = this.combineDocs(retrievedDocs);
        return retrievedString;
    }

    async generateQueryResponse(query: string) {
        // Standalone Prompt Chain
        const standaloneQuestionTemplate = 'Given a question, convert it to a standalone question. question: {question} standalone question:'
        const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
        const standaloneQuestionChain = RunnableSequence.from([
            standaloneQuestionPrompt,
            LLMProvider.llmClient,
            new StringOutputParser(),
        ])

        // Retriever Chain
        const retriever = this.getRetriever();
        const retrieverChain = RunnableSequence.from([
            prevResult => prevResult.standalone_question,
            retriever,
            this.combineDocs,
        ])

        // Answer Chain
        const answerTemplate = `You are a helpful and enthusiastic support bot who can answer a given question about Scrimba based on the context provided. Try to find the answer in the context. If you really don't know the answer, say "I'm sorry, I don't know the answer to that." And direct the questioner to email help@scrimba.com. Don't try to make up an answer. Always speak as if you were chatting to a friend.
            context: {context}
            question: {question}
            answer: `
        const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
        const answerChain = RunnableSequence.from([
            answerPrompt,
            LLMProvider.llmClient,
            new StringOutputParser(),
        ])

        const chain = RunnableSequence.from([
            {
                standalone_question: standaloneQuestionChain,
                original_input: new RunnablePassthrough()
            },
            {
                context: retrieverChain,
                question: ({ original_input }) => original_input.question
            },
            answerChain,
        ]);

        const response = await chain.invoke({
            question: query
        });

        return response;
    }

    private getRetriever(): VectorStoreRetriever<SupabaseVectorStore> {
        const vectorStore = new SupabaseVectorStore(
            new HuggingFaceInferenceEmbeddings({
                apiKey: process.env.HUGGINGFACE_API_KEY,
                model: "sentence-transformers/distilbert-base-nli-mean-tokens",
            }),
            {
                client: SupabaseProvider.dbClient,
                tableName: 'documents',
                queryName: 'match_documents'
            }
        )
        const retriever = vectorStore.asRetriever();
        return retriever;
    }

    private combineDocs(docs:  DocumentInterface<Record<string, any>>[]): string {
        return docs.map((doc)=>doc.pageContent).join('\n\n');
    }

    async runnableSequenceExample(sentence: string) {
        const llm = LLMProvider.llmClient; 
        const punctuationTemplate = `Given a sentence, add punctuation where needed. 
            sentence: {sentence}
            sentence with punctuation:`
        const punctuationPrompt = PromptTemplate.fromTemplate(punctuationTemplate)

        const grammarTemplate = `Given a sentence correct the grammar.
            sentence: {punctuated_sentence}
            sentence with correct grammar: 
            `
        const grammarPrompt = PromptTemplate.fromTemplate(grammarTemplate)

        const translationTemplate = `Given a sentence, translate that sentence into {language}
        sentence: {grammatically_correct_sentence}
        translated sentence:`
        const translationPrompt = PromptTemplate.fromTemplate(translationTemplate)
        
        const punctuationChain = RunnableSequence.from([
            punctuationPrompt,
            llm,
            new StringOutputParser()
        ])
        const grammarChain = RunnableSequence.from([
            grammarPrompt,
            llm,
            new StringOutputParser()
        ])
        const translationChain = RunnableSequence.from([
            translationPrompt,
            llm,
            new StringOutputParser()
        ])
        
        const chain = RunnableSequence.from([
            {
                punctuated_sentence: punctuationChain,
                original_input: new RunnablePassthrough()
            },
            {
                grammatically_correct_sentence: grammarChain,
                language: ({ original_input }) => original_input.language
            },
            translationChain
        ])

        const response = await chain.invoke({
            sentence,
            language: 'french'
        })
        return response;
    }
}