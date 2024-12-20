import * as fs from 'fs';
import { parse } from '@typescript-eslint/parser';

export class TypeScriptParser {
    public parse(file: string): any {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const ast = parse(content, {
                sourceType: 'module',
                ecmaVersion: 'latest',
                jsDocParsingMode: 'all',
            });
            return ast;
        } catch (error) {
            if (error instanceof Error) {
                this.handleParseError(error);
            } else {
                console.error('Unknown error:', error);
            }
            return null;
        }
    }

    public handleParseError(error: Error): void {
        console.error('TypeScript Parsing Error:', error);
    }
}