import type { TSESTree } from '@typescript-eslint/types';
import { TypeScriptParser } from './TypeScriptParser.js';

interface Location {
    start: number;
    end: number;
}

export class JsDocAnalyzer {

    public missingJsDocNodes: TSESTree.Node[] = [];

    constructor(
        public typeScriptParser: TypeScriptParser,
    ) { }



    public analyze(ast: TSESTree.Program): void {
        this.traverse(ast, ast.comments || []);
    }

    private traverse(node: TSESTree.Node, comments?: TSESTree.Comment[]): void {
        if (this.shouldHaveJSDoc(node)) {
            const jsDocComment = this.getJSDocComment(node, comments || []);
            if (!jsDocComment) {
                this.missingJsDocNodes.push(node);
            }
        }

        // Handle specific node types that can have children
        if ('body' in node) {
            const body = Array.isArray(node.body) ? node.body : [node.body];
            body.forEach(child => {
                if (child && typeof child === 'object') {
                    this.traverse(child as TSESTree.Node, comments);
                }
            });
        }

        // Handle other common child properties
        ['consequent', 'alternate', 'init', 'test', 'update'].forEach(prop => {
            if (prop in node && node[prop as keyof TSESTree.Node]) {
                this.traverse(node[prop as keyof TSESTree.Node] as TSESTree.Node, comments);
            }
        });
    }

    /**
     * Checks if a node should have JSDoc documentation
     */
    public shouldHaveJSDoc(node: TSESTree.Node): boolean {
        return (
            node.type === 'FunctionDeclaration' ||
            node.type === 'ClassDeclaration' ||
            node.type === 'MethodDefinition'
        );
    }

    /**
     * Gets the JSDoc comment for a node if it exists
     */
    public getJSDocComment(node: TSESTree.Node, comments: TSESTree.Comment[]): string | undefined {
        if (!this.shouldHaveJSDoc(node)) {
            return undefined;
        }

        const functionStartLine = node.loc?.start.line;
        return comments.find((comment) => {
            const commentEndLine = comment.loc?.end.line;
            return (
                comment.type === 'Block' &&
                comment.value.startsWith('*') &&
                commentEndLine === functionStartLine - 1
            );
        })?.value;
    }

    public getNodeLocation(node: TSESTree.Node): Location {
        return {
            start: node.loc.start.line,
            end: node.loc.end.line,
        };
    }

    public getClassMethods(filePath: string, className?: string): TSESTree.MethodDefinition[] {
        const ast = this.typeScriptParser.parse(filePath);
        if (!ast) return [];

        // Find all class declarations in the file
        const classNodes = ast.body.filter(
            (node: TSESTree.Node): node is TSESTree.ClassDeclaration =>
                node.type === 'ClassDeclaration' &&
                // If className is provided, match it, otherwise accept any class
                (className ? node.id?.name === className : true)
        );

        // Collect methods from all matching classes
        const methods: TSESTree.MethodDefinition[] = [];
        for (const classNode of classNodes) {
            const classMethods = classNode.body.body.filter(
                (node: TSESTree.Node): node is TSESTree.MethodDefinition =>
                    node.type === 'MethodDefinition'
            );
            methods.push(...classMethods);
        }

        return methods;
    }
}