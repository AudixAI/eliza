import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';

dotenv.config();

export class AIService {
    private chatModel: ChatOpenAI;

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set');
        }
        this.chatModel = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    public async generateComment(prompt: string): Promise<string> {
        try {
            const response = await this.chatModel.invoke(prompt);
            return response.content as string;
        } catch (error) {
            this.handleAPIError(error as Error);
            return '';
        }
    }

    public handleAPIError(error: Error): void {
        console.error('API Error:', error.message);
        throw error;
    }
}