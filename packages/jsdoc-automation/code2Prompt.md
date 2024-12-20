Here's an improved plan that covers all the requirements from the user story and addresses potential edge cases:

* Determine the directory structure:
   * Identify the root directory of your TypeScript codebase that needs to be scanned.
   * Decide on any specific directories or files that should be excluded from the scanning process.
   * Consider edge cases, such as symlinks, hidden files, or directories with special characters in their names.
* Implement directory traversal:
   * Use the `fs` module in Node.js to traverse the directory structure recursively.
   * Start from the root directory and navigate through all subdirectories.
   * Filter out any excluded directories or files based on your predefined criteria.
   * Handle edge cases gracefully, such as permissions issues or inaccessible directories.
* Identify TypeScript files:
   * During the directory traversal, check the file extensions to identify TypeScript files (e.g., `.ts` or `.tsx`).
   * Exclude any non-TypeScript files from further processing.
   * Consider edge cases, such as files with multiple extensions or files with unconventional extensions.
* Read and parse TypeScript files:
   * Use the `fs` module to read the content of each identified TypeScript file.
   * Utilize a TypeScript parser library, such as `@typescript-eslint/parser`, to parse the TypeScript code into an AST (Abstract Syntax Tree).
   * Handle edge cases, such as files with syntax errors or files that cannot be parsed successfully.
* Analyze the AST for missing JSDoc comments:
   * Traverse the AST of each TypeScript file using a library like `@typescript-eslint/typescript-estree`.
   * Look for function declarations, class declarations, and other relevant nodes in the AST.
   * Check if the corresponding JSDoc comments are present for each identified node.
   * Keep track of the files and specific lines where JSDoc comments are missing.
   * Consider edge cases, such as comments with unconventional formatting or comments that don't adhere to the JSDoc standards.
* Generate JSDoc comments using AI:
   * Integrate with an AI service (e.g., OpenAI API) to generate contextually accurate JSDoc comments for the missing cases.
   * Provide the necessary context, such as the surrounding code and existing comments, to the AI model for accurate comment generation.
   * Ensure that the generated comments follow the existing JSDoc standards and TypeDoc configuration.
   * Validate the generated comments for completeness and accuracy, including proper documentation of parameters, return types, and function descriptions.
   * Handle edge cases, such as comments that exceed the maximum length or comments that contain special characters.
* Create a new branch and commit changes:
   * Create a new branch specifically for the documentation updates.
   * Commit the generated JSDoc comments to the respective files in the new branch.
   * Use a clear and descriptive commit message that explains the purpose of the documentation update.
* Generate a pull request:
   * Create a pull request from the documentation update branch to the main branch.
   * Include a detailed description in the pull request, explaining the changes made and the purpose of the documentation update.
   * Add appropriate labels to the pull request, such as 'documentation' and 'automated'.
   * Assign relevant reviewers to the pull request for feedback and approval.
* Implement a GitHub Actions workflow:
   * Create a GitHub Actions workflow that triggers the entire process on-demand (via `workflow_dispatch`) or when specific files change.
   * Define the workflow steps, including checking out the codebase, running the directory traversal, identifying TypeScript files, analyzing the AST, generating JSDoc comments, creating a new branch, committing changes, and generating a pull request.
   * Configure the workflow to use the appropriate AI service and provide the necessary credentials securely.
* Provide configuration options:
   * Allow customization of AI prompt templates to guide the comment generation process.
   * Provide options to include or exclude specific files or directories from the documentation update process.
   * Allow configuration of commit message and pull request templates to maintain consistency.
* Test and validate:
   * Thoroughly test the automated documentation generation process to ensure it functions as expected.
   * Validate the generated comments for accuracy, completeness, and adherence to the JSDoc standards.
   * Test edge cases and handle them gracefully to prevent any disruptions to the workflow.
* Document and communicate:
   * Create comprehensive documentation explaining how to use and configure the automated documentation generation process.
   * Communicate the availability and usage instructions of the new workflow to the development team.
   * Provide guidelines on how to review and approve the generated documentation changes.

By following this improved plan, you can create a robust and automated solution for generating JSDoc comments in your TypeScript codebase. The plan takes into account the requirements from the user story, addresses potential edge cases, and ensures a seamless integration into your development workflow.

----------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------

- DirectoryTraversal
  - rootDirectory: string
  - excludedDirectories: string[]
  - excludedFiles: string[]
  - traverse(): void
  - isExcluded(path: string): boolean
  - handleError(error: Error): void

- TypeScriptFileIdentifier
  - isTypeScriptFile(file: string): boolean
  - getTypeScriptFiles(directory: string): string[]

- TypeScriptParser
  - parse(file: string): AST
  - handleParseError(error: Error): void

- JsDocAnalyzer
  - ast: AST
  - missingJsDocNodes: Node[]
  - analyze(): void
  - isMissingJsDoc(node: Node): boolean
  - getNodeLocation(node: Node): Location

- JsDocGenerator
  - aiService: AIService
  - node: Node
  - generateComment(): string
  - validateComment(comment: string): boolean
  - formatComment(comment: string): string

- AIService
  - apiKey: string
  - generateComment(prompt: string): string
  - handleAPIError(error: Error): void

- GitManager
  - repository: Repository
  - branch: string
  - createBranch(): void
  - commit(files: string[], message: string): void
  - createPullRequest(title: string, description: string, labels: string[], reviewers: string[]): void

- GithubActionsWorkflow
  - triggers: Trigger[]
  - steps: Step[]
  - run(): void
  - handleWorkflowError(error: Error): void

- Configuration
  - aiPromptTemplates: string[]
  - includedFiles: string[]
  - excludedFiles: string[]
  - commitMessageTemplate: string
  - pullRequestTemplate: string
  - load(): void
  - save(): void

- DocumentationGenerator
  - directoryTraversal: DirectoryTraversal
  - typeScriptFileIdentifier: TypeScriptFileIdentifier
  - typeScriptParser: TypeScriptParser
  - jsDocAnalyzer: JsDocAnalyzer
  - jsDocGenerator: JsDocGenerator
  - gitManager: GitManager
  - githubActionsWorkflow: GithubActionsWorkflow
  - configuration: Configuration
  - generate(): void
  - createWorkflow(): void
  - runTests(): void
  - validate(): void
  - document(): void
  - communicate(): void


Project Path: src

Source Tree:

```
src
├── JsDocGenerator.ts
├── types
│   └── index.ts
├── TypeScriptFileIdentifier.ts
├── config
│   └── config.json
├── TypeScriptParser.ts
├── DocumentationGenerator.ts
├── JsDocAnalyzer.ts
├── AIService.ts
├── DirectoryTraversal.ts
├── GitManager.ts
├── index.ts
├── GithubActionsWorkflow.ts
└── Configuration.ts

```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/JsDocGenerator.ts`:

```ts
// src/JsDocGenerator.ts
import type { TSESTree } from '@typescript-eslint/types';
import { AIService } from './AIService';
import { ASTQueueItem } from './types';

export class JsDocGenerator {
    constructor(public aiService: AIService) { }

    public async generateComment(queueItem: ASTQueueItem): Promise<string> {
        const prompt = this.buildPrompt(queueItem);
        const comment = await this.aiService.generateComment(prompt);
        const formattedComment = this.formatComment(comment);
        return formattedComment;
    }

    public async generateClassComment(
        queueItem: ASTQueueItem,
        methodComments: Record<string, string>
    ): Promise<string> {
        const prompt = this.buildClassPrompt(queueItem, methodComments);
        const comment = await this.aiService.generateComment(prompt);
        const formattedComment = this.formatComment(comment);
        return formattedComment;
    }

    private buildPrompt(queueItem: ASTQueueItem): string {
        return `Generate JSDoc comment for the following code:

        \`\`\`typescript
        ${queueItem.code}
        \`\`\`
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
        `;
    }

    private formatComment(comment: string): string {
        // Format the comment to adhere to the project's coding style
        return `/**\n * ${comment.trim().replace(/\n/g, '\n * ')}\n */`;
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/types/index.ts`:

```ts
export interface ASTQueueItem {
    filePath: string;
    startLine: number;
    endLine: number;
    nodeType: string;
    code: string;
    className?: string;
    methodName?: string;
    jsDoc?: string;
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/TypeScriptFileIdentifier.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

export class TypeScriptFileIdentifier {
    public isTypeScriptFile(file: string): boolean {
        const extension = path.extname(file);
        return extension === '.ts' || extension === '.tsx';
    }

    public getTypeScriptFiles(directory: string): string[] {
        const files = fs.readdirSync(directory);
        return files.filter((file) => this.isTypeScriptFile(file));
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/config/config.json`:

```json
{
    "aiPromptTemplates": [],
    "includedFiles": [],
    "excludedFiles": [],
    "commitMessageTemplate": "",
    "pullRequestTemplate": "",
    "rootDirectory": "./test",
    "excludedDirectories": [
        "node_modules"
    ],
    "aiService": {
        "apiKey": "your-api-key"
    },
    "repository": "your-repository",
    "branch": "main",
    "committedFiles": [],
    "commitMessage": "Generated JSDoc comments",
    "pullRequestTitle": "JSDoc Generation",
    "pullRequestDescription": "Automated JSDoc generation for the codebase",
    "pullRequestLabels": [
        "documentation"
    ],
    "pullRequestReviewers": [
        "user1",
        "user2"
    ],
    "workflowTriggers": [],
    "workflowSteps": []
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/TypeScriptParser.ts`:

```ts
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
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/DocumentationGenerator.ts`:

```ts
import { DirectoryTraversal } from './DirectoryTraversal';
import { TypeScriptFileIdentifier } from './TypeScriptFileIdentifier';
import { TypeScriptParser } from './TypeScriptParser';
import { JsDocAnalyzer } from './JsDocAnalyzer';
import { JsDocGenerator } from './JsDocGenerator';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTQueueItem } from './types';
import fs from 'fs';
export class DocumentationGenerator {
    public missingJsDocQueue: ASTQueueItem[] = [];
    public existingJsDocQueue: ASTQueueItem[] = [];


    constructor(
        public directoryTraversal: DirectoryTraversal,
        // public typeScriptFileIdentifier: TypeScriptFileIdentifier,
        public typeScriptParser: TypeScriptParser,
        public jsDocAnalyzer: JsDocAnalyzer,
        public jsDocGenerator: JsDocGenerator,
        // public gitManager: GitManager,
        // public githubActionsWorkflow: GithubActionsWorkflow,
        // public configuration: Configuration
    ) { }

    public async generate(): Promise<void> {
        // Traverse the directory and get TypeScript files
        const typeScriptFiles = this.directoryTraversal.traverse();

        // Process each TypeScript file
        for (const file of typeScriptFiles) {
            const ast = this.typeScriptParser.parse(file);
            if (ast) {
                // Analyze JSDoc comments
                this.jsDocAnalyzer.analyze(ast);

                for (const node of ast.body) {

                    if (!this.jsDocAnalyzer.shouldHaveJSDoc(node)) {
                        continue;
                    }

                    const jsDocComment = this.jsDocAnalyzer.getJSDocComment(node, ast.comments || []);
                    const queueItem: ASTQueueItem = {
                        filePath: file,
                        startLine: node.loc?.start.line || 0,
                        endLine: node.loc?.end.line || 0,
                        nodeType: node.type,
                        className: node.type === 'ClassDeclaration' ? node.id?.name : undefined,
                        methodName: node.type === 'MethodDefinition' ? node.key.name : undefined,
                        code: this.getNodeCode(file, node),
                    };

                    if (jsDocComment) {
                        queueItem.jsDoc = jsDocComment;
                        this.existingJsDocQueue.push(queueItem);
                    } else {
                        this.missingJsDocQueue.push(queueItem);
                    }
                }
            }
        }

        // Process the AST queue
        while (this.missingJsDocQueue.length > 0) {
            const queueItem = this.missingJsDocQueue.shift();
            if (queueItem) {
                let comment = '';
                if (queueItem.nodeType === 'ClassDeclaration') {
                    const className = queueItem.className;
                    // Generate JSDoc comments for class methods first
                    // Reason: Avoiding sending the entire Class to the AI, instead sending the method JSDoc only to provide context
                    const methodComments: Record<string, string> = {};
                    for (const methodNode of this.jsDocAnalyzer.getClassMethods(queueItem.filePath, className)) {

                        // check if a node on existingJsDocQueue has same class & method name - if Yes, get the jsDoc from there
                        // else pop it from the missingJsDocQueue and generate JSDoc
                        const existingNode = this.existingJsDocQueue.find(node => node.className === className && node.methodName === this.getMethodName(methodNode));
                        if (existingNode && existingNode.jsDoc) {
                            this.addMethodComment(methodNode, existingNode.jsDoc, methodComments);
                        } else {
                            const methodQueueItem: ASTQueueItem = {
                                ...queueItem,
                                nodeType: methodNode.type,
                                code: this.getNodeCode(queueItem.filePath, methodNode),
                            };
                            const methodComment = await this.jsDocGenerator.generateComment(methodQueueItem);
                            this.addMethodComment(methodNode, methodComment, methodComments);
                        }
                    }
                    console.log('methodComments', methodComments);
                    // Generate JSDoc comment for the class itself
                    comment = await this.jsDocGenerator.generateClassComment(queueItem, methodComments);
                } else {
                    // Generate JSDoc comment for small AST nodes
                    comment = await this.jsDocGenerator.generateComment(queueItem);
                }
                console.log(`Generated JSDoc comment for ${queueItem.nodeType} in ${queueItem.filePath}:`);
                console.log(comment);
            }
        }
    }

    private getMethodName(methodNode: TSESTree.MethodDefinition): string {
        return methodNode.key.type === 'Identifier' ? methodNode.key.name : '';
    }

    // Add method comment to the methodComments object
    private addMethodComment(methodNode: TSESTree.MethodDefinition, comment: string, methodComments: Record<string, string>): void {
        const methodName = this.getMethodName(methodNode);
        if (methodName) {
            methodComments[methodName] = comment;
        }
    }

    public getNodeCode(filePath: string, node: TSESTree.Node): string {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        const startLine = node.loc?.start.line || 0;
        const endLine = node.loc?.end.line || 0;
        return lines.slice(startLine - 1, endLine).join('\n');
    }

    public createWorkflow(): void {
        // Create the GitHub Actions workflow
    }

    public runTests(): void {
        // Run tests to ensure the generated documentation is accurate
    }

    public validate(): void {
        // Validate the generated documentation
    }

    public document(): void {
        // Generate documentation for the codebase
    }

    public communicate(): void {
        // Communicate the availability and usage instructions to the team
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/JsDocAnalyzer.ts`:

```ts
import type { TSESTree } from '@typescript-eslint/types';
import { TypeScriptParser } from './TypeScriptParser';

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
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/AIService.ts`:

```ts
export class AIService {
    constructor(public apiKey: string) { }

    public generateComment(prompt: string): string {
        return prompt;
        // Call the AI service API to generate a JSDoc comment based on the prompt
    }

    public handleAPIError(error: Error): void {
        // Handle any errors that occur during API calls
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/DirectoryTraversal.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

export class DirectoryTraversal {
    constructor(
        public rootDirectory: string,
        public excludedDirectories: string[] = [],
        public excludedFiles: string[] = []
    ) { }

    public traverse(): string[] {
        const typeScriptFiles: string[] = [];

        const traverseDirectory = (currentDirectory: string) => {
            const files = fs.readdirSync(currentDirectory);

            files.forEach((file) => {
                const filePath = path.join(currentDirectory, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    if (!this.isExcluded(filePath)) {
                        traverseDirectory(filePath);
                    }
                } else if (stats.isFile() && !this.isExcluded(filePath)) {
                    if (path.extname(file) === '.ts' || path.extname(file) === '.tsx') {
                        typeScriptFiles.push(filePath);
                    }
                }
            });
        };

        traverseDirectory(this.rootDirectory);
        return typeScriptFiles;
    }

    public isExcluded(filePath: string): boolean {
        return (
            this.excludedDirectories.includes(path.dirname(filePath)) ||
            this.excludedFiles.includes(path.basename(filePath))
        );
    }

    public handleError(error: Error): void {
        console.error('Directory Traversal Error:', error);
        // Additional error handling logic
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/GitManager.ts`:

```ts
class GitManager {
    constructor(public repository: any, public branch: string) { }

    public createBranch(): void {
        // Create a new branch for documentation updates
    }

    public commit(files: string[], message: string): void {
        // Commit the specified files with the given commit message
    }

    public createPullRequest(
        title: string,
        description: string,
        labels: string[],
        reviewers: string[]
    ): void {
        // Create a pull request with the specified details
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/index.ts`:

```ts
import { DirectoryTraversal } from './DirectoryTraversal';
import { TypeScriptParser } from './TypeScriptParser';
import { JsDocAnalyzer } from './JsDocAnalyzer';
import { JsDocGenerator } from './JsDocGenerator';
import { DocumentationGenerator } from './DocumentationGenerator';
import { Configuration } from './Configuration';
import { AIService } from './AIService';
// import { GitManager } from './GitManager';
// import { GithubActionsWorkflow } from './GithubActionsWorkflow';

async function main() {
    try {
        // Load configuration
        const configuration = new Configuration();
        configuration.load();

        // Create instances of the required components
        const directoryTraversal = new DirectoryTraversal(
            configuration.rootDirectory,
            configuration.excludedDirectories,
            configuration.excludedFiles
        );
        const typeScriptParser = new TypeScriptParser();
        const jsDocAnalyzer = new JsDocAnalyzer(typeScriptParser);
        const aiService = new AIService(configuration.aiService.apiKey);
        const jsDocGenerator = new JsDocGenerator(aiService);
        const documentationGenerator = new DocumentationGenerator(
            directoryTraversal,
            typeScriptParser,
            jsDocAnalyzer,
            jsDocGenerator
        );

        // Generate documentation
        await documentationGenerator.generate();

        // // Run tests
        // documentationGenerator.runTests();

        // // Validate generated documentation
        // documentationGenerator.validate();

        // // Create a new branch and commit changes
        // const gitManager = new GitManager(
        //     configuration.repository,
        //     configuration.branch
        // );
        // gitManager.createBranch();
        // gitManager.commit(
        //     configuration.committedFiles,
        //     configuration.commitMessage
        // );

        // // Create a pull request
        // gitManager.createPullRequest(
        //     configuration.pullRequestTitle,
        //     configuration.pullRequestDescription,
        //     configuration.pullRequestLabels,
        //     configuration.pullRequestReviewers
        // );

        // // Create and run the GitHub Actions workflow
        // const githubActionsWorkflow = new GithubActionsWorkflow(
        //     configuration.workflowTriggers,
        //     configuration.workflowSteps
        // );
        // githubActionsWorkflow.run();

        // // Communicate the availability and usage instructions
        // documentationGenerator.communicate();
    } catch (error) {
        console.error('An error occurred during the documentation generation process:', error);
        process.exit(1);
    }
}

main();
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/GithubActionsWorkflow.ts`:

```ts
class GithubActionsWorkflow {
    public triggers: any[] = [];
    public steps: any[] = [];

    public run(): void {
        // Execute the GitHub Actions workflow
    }

    public handleWorkflowError(error: Error): void {
        // Handle any errors that occur during the workflow execution
    }
}
```

`/Users/edmarcavage/Documents/Development2024/agents/audix/plugin-audix/src/Configuration.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

interface ConfigurationData {
    aiPromptTemplates: string[];
    includedFiles: string[];
    excludedFiles: string[];
    commitMessageTemplate: string;
    pullRequestTemplate: string;
    rootDirectory: string;
    excludedDirectories: string[];
    aiService: {
        apiKey: string;
    };
    repository: string;
    branch: string;
    committedFiles: string[];
    commitMessage: string;
    pullRequestTitle: string;
    pullRequestDescription: string;
    pullRequestLabels: string[];
    pullRequestReviewers: string[];
    workflowTriggers: string[];
    workflowSteps: string[];
}

export class Configuration {
    public aiPromptTemplates: string[] = [];
    public includedFiles: string[] = [];
    public excludedFiles: string[] = [];
    public commitMessageTemplate: string = '';
    public pullRequestTemplate: string = '';
    public rootDirectory: string = '';
    public excludedDirectories: string[] = [];
    public aiService: {
        apiKey: string;
    } = {
            apiKey: '',
        };
    public repository: string = '';
    public branch: string = '';
    public committedFiles: string[] = [];
    public commitMessage: string = '';
    public pullRequestTitle: string = '';
    public pullRequestDescription: string = '';
    public pullRequestLabels: string[] = [];
    public pullRequestReviewers: string[] = [];
    public workflowTriggers: string[] = [];
    public workflowSteps: string[] = [];
    private configPath = path.join(__dirname, 'config', 'config.json');

    constructor() { }

    public load(): void {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            const parsedConfig: ConfigurationData = JSON.parse(configData);

            this.aiPromptTemplates = parsedConfig.aiPromptTemplates;
            this.includedFiles = parsedConfig.includedFiles;
            this.excludedFiles = parsedConfig.excludedFiles;
            this.commitMessageTemplate = parsedConfig.commitMessageTemplate;
            this.pullRequestTemplate = parsedConfig.pullRequestTemplate;
            this.rootDirectory = parsedConfig.rootDirectory;
            this.excludedDirectories = parsedConfig.excludedDirectories;
            this.aiService = parsedConfig.aiService;
            this.repository = parsedConfig.repository;
            this.branch = parsedConfig.branch;
            this.committedFiles = parsedConfig.committedFiles;
            this.commitMessage = parsedConfig.commitMessage;
            this.pullRequestTitle = parsedConfig.pullRequestTitle;
            this.pullRequestDescription = parsedConfig.pullRequestDescription;
            this.pullRequestLabels = parsedConfig.pullRequestLabels;
            this.pullRequestReviewers = parsedConfig.pullRequestReviewers;
            this.workflowTriggers = parsedConfig.workflowTriggers;
            this.workflowSteps = parsedConfig.workflowSteps;
        } catch (error) {
            console.error('Error loading configuration:', error);
            throw error;
        }
    }

    public save(): void {
        const configData: ConfigurationData = {
            aiPromptTemplates: this.aiPromptTemplates,
            includedFiles: this.includedFiles,
            excludedFiles: this.excludedFiles,
            commitMessageTemplate: this.commitMessageTemplate,
            pullRequestTemplate: this.pullRequestTemplate,
            rootDirectory: this.rootDirectory,
            excludedDirectories: this.excludedDirectories,
            aiService: this.aiService,
            repository: this.repository,
            branch: this.branch,
            committedFiles: this.committedFiles,
            commitMessage: this.commitMessage,
            pullRequestTitle: this.pullRequestTitle,
            pullRequestDescription: this.pullRequestDescription,
            pullRequestLabels: this.pullRequestLabels,
            pullRequestReviewers: this.pullRequestReviewers,
            workflowTriggers: this.workflowTriggers,
            workflowSteps: this.workflowSteps,
        };

        try {
            fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2));
        } catch (error) {
            console.error('Error saving configuration:', error);
            throw error;
        }
    }
}
```