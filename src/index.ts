import express from 'express';
import dotenv from 'dotenv';
import LLMService from './llm.service';
import SupabaseProvider from './supabase.provider';
import LLMProvider from './llm.provider';


dotenv.config();
const port = process.env.PORT;
const app = express();
app.use(express.json());

new SupabaseProvider().initiateSupabaseClient();
new LLMProvider().initiateLLMClient();

app.get('/injest', async (req, res) => {
    try {
        const response = await new LLMService().injestDocument();
        res.send({ data: response });
    } catch (error) {
        res.status(500).send({ error: 'Failed to injest document', details: error instanceof Error ? error.message : error });
    }
});

app.post('/promptTemplate', async (req, res) => {
    try {
        const response = await new LLMService().generateStandaloneQuestionWithPromptTemplate(req.body.text);
        res.send(response);
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
});

app.post('/context', async (req, res) => {
    try {
        const response = await new LLMService().getRelevantContext(req.body.text);
        res.send(response);
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
});

app.post('/chat', async (req, res) => {
    try {
        const response = await new LLMService().generateQueryResponse(req.body.text);
        res.send(response);
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
});

app.post('/runnable-sequence', async (req, res) => {
    try {
        const response = await new LLMService().runnableSequenceExample(req.body.text);
        res.send(response);
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
