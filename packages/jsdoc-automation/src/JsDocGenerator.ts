import { AIService } from './AIService.js';
import { ASTQueueItem } from './types/index.js';

export class JsDocGenerator {
    constructor(public aiService: AIService) { }

    public async generateComment(queueItem: ASTQueueItem): Promise<string> {
        const prompt = this.buildPrompt(queueItem);
        const comment = await this.aiService.generateComment(prompt);
        return comment;
    }

    public async generateClassComment(
        queueItem: ASTQueueItem,
        methodComments: Record<string, string>
    ): Promise<string> {
        const prompt = this.buildClassPrompt(queueItem, methodComments);
        const comment = await this.aiService.generateComment(prompt);
        return comment;
    }

    private buildPrompt(queueItem: ASTQueueItem): string {
        return `Generate JSDoc comment for the following code:


        \`\`\`typescript
        ${queueItem.code}
        \`\`\`
        
        Only return the JSDoc comment, not the code itself.
        `;
    }

    private buildClassPrompt(
        queueItem: ASTQueueItem,
        methodComments: Record<string, string>
    ): string {
        const methodCommentsString = Object.entries(methodComments)
            .map(([methodName, comment]) => `@method ${methodName}\n${comment}`)
            .join('\n');

        return `Generate JSDoc comment for the following class:

        Class name: ${queueItem.code.match(/class (\w+)/)?.[1]}

        Methods:
        ${methodCommentsString}
        
        Only return the JSDoc comment, no other text or code.
        `;
    }
}