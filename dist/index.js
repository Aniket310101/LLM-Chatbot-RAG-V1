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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const llm_service_1 = __importDefault(require("./llm.service"));
const supabase_provider_1 = __importDefault(require("./supabase.provider"));
const llm_provider_1 = __importDefault(require("./llm.provider"));
dotenv_1.default.config();
const port = process.env.PORT;
const app = (0, express_1.default)();
app.use(express_1.default.json());
new supabase_provider_1.default().initiateSupabaseClient();
new llm_provider_1.default().initiateLLMClient();
app.get('/injest', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield new llm_service_1.default().injestDocument();
        res.send({ data: response });
    }
    catch (error) {
        res.status(500).send({ error: 'Failed to injest document', details: error instanceof Error ? error.message : error });
    }
}));
app.post('/promptTemplate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield new llm_service_1.default().generateStandaloneQuestionWithPromptTemplate(req.body.text);
        res.send(response);
    }
    catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
}));
app.post('/context', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield new llm_service_1.default().getRelevantContext(req.body.text);
        res.send(response);
    }
    catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
}));
app.post('/chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield new llm_service_1.default().generateQueryResponse(req.body.text);
        res.send(response);
    }
    catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
}));
app.post('/runnable-sequence', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield new llm_service_1.default().runnableSequenceExample(req.body.text);
        res.send(response);
    }
    catch (error) {
        res.status(500).send({ error: 'Failed to generate prompt template', details: error instanceof Error ? error.message : error });
    }
}));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
