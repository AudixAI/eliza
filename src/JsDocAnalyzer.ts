import type { TSESTree } from '@typescript-eslint/types';
import { TypeScriptParser } from './TypeScriptParser.js';

interface Location {
    start: number;
    end: number;
}

/**
 * Class to analyze JSDoc comments in TypeScript code.
 */
export class JsDocAnalyzer {

    public missingJsDocNodes: TSESTree.Node[] = [];

/**
 * Constructor for initializing a new instance.
 * @param {TypeScriptParser} typeScriptParser - An instance of TypeScriptParser used for parsing TypeScript code.
 */
    constructor(
        public typeScriptParser: TypeScriptParser,
    ) { }



/**
     * Analyzes the Abstract Syntax Tree (AST) of a program.
     * @param {TSESTree.Program} ast - The AST of the program to analyze.
     * @returns {void}
     */
    public analyze(ast: TSESTree.Program): void {
        this.traverse(ast, ast.comments || []);
    }

/**
 * Traverses the AST node and checks for JSDoc comments.
 *
 * @param {TSESTree.Node} node - The AST node to traverse.
 * @param {TSESTree.Comment[]} [comments] - Optional array of comments associated with the node.
 */
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
 * Check if the given node should have JSDoc comments.
 * @param {TSESTree.Node} node - The node to check
 * @returns {boolean} True if the node should have JSDoc comments, false otherwise
 */
    public shouldHaveJSDoc(node: TSESTree.Node): boolean {
        return (
            node.type === 'FunctionDeclaration' ||
            this.isClassNode(node) ||
            node.type === 'MethodDefinition'
        );
    }

/**
 * Check if the given node is a class node.
 * 
 * @param {TSESTree.Node} node - The node to check
 * @returns {boolean} Returns true if the node is a class node, false otherwise
 */
    public isClassNode(node: TSESTree.Node): boolean {
        if (node.type === 'ClassDeclaration') {
            return true;
        }

        if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration') {
            return true;
        }

        return false;
    }

/**
 * Retrieves the JSDoc comment associated with the given node from the provided comments array.
 * 
 * @param {TSESTree.Node} node The node for which to retrieve the JSDoc comment.
 * @param {TSESTree.Comment[]} comments Array of comments to search for the JSDoc comment.
 * @returns {string | undefined} The JSDoc comment if found, otherwise undefined.
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

/**
 * Returns the start and end location of the given Node.
 * 
 * @param {TSESTree.Node} node - The Node to get location from.
 * @returns {Location} The start and end location of the Node.
 */
    public getNodeLocation(node: TSESTree.Node): Location {
        return {
            start: node.loc.start.line,
            end: node.loc.end.line,
        };
    }

/**
 * Retrieves all methods of a specific class or all classes in a given file.
 * @param filePath - The path of the file to parse.
 * @param className - The name of the class to retrieve methods from. Optional.
 * @returns An array of MethodDefinition nodes representing the methods found.
 */
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