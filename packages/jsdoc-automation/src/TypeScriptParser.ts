import * as fs from 'fs';
import { parse } from '@typescript-eslint/parser';

/**
 * A class for parsing TypeScript files.
 */
export class TypeScriptParser {
    /**
     * Parses the content of a file using the given file path.
     * 
     * @param {string} file - The file path containing the content to be parsed.
     * @returns {any} The abstract syntax tree (AST) representation of the parsed content.
     */
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

    /**
     * Handles a parse error that occurs during TypeScript parsing.
     * 
     * @param {Error} error - The error that occurred during parsing
     * @returns {void}
     */
    public handleParseError(error: Error): void {
        console.error('TypeScript Parsing Error:', error);
    }
}