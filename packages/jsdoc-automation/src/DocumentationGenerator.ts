import { DirectoryTraversal } from './DirectoryTraversal.js';
import { TypeScriptFileIdentifier } from './TypeScriptFileIdentifier.js';
import { TypeScriptParser } from './TypeScriptParser.js';
import { JsDocAnalyzer } from './JsDocAnalyzer.js';
import { JsDocGenerator } from './JsDocGenerator.js';
import type { TSESTree } from '@typescript-eslint/types';
import { ASTQueueItem, FullModeFileChange, PrModeFileChange } from './types/index.js';
import { GitManager } from './GitManager.js';
import fs from 'fs';
import { Configuration } from './Configuration.js';
import path from 'path';
import { AIService } from './AIService.js';


export class DocumentationGenerator {
    public missingJsDocQueue: ASTQueueItem[] = [];
    public existingJsDocQueue: ASTQueueItem[] = [];
    private hasChanges: boolean = false;
    private fileContents: Map<string, string> = new Map();
    private branchName: string = '';


    constructor(
        public directoryTraversal: DirectoryTraversal,
        // public typeScriptFileIdentifier: TypeScriptFileIdentifier,
        public typeScriptParser: TypeScriptParser,
        public jsDocAnalyzer: JsDocAnalyzer,
        public jsDocGenerator: JsDocGenerator,
        public gitManager: GitManager,
        // public githubActionsWorkflow: GithubActionsWorkflow,
        public configuration: Configuration,
        public aiService: AIService
    ) { }

    private async insertJSDocComments(queueItem: ASTQueueItem): Promise<void> {
        if (queueItem.nodeType === 'ClassDeclaration') {
            // First process all method JSDoc comments - but don't insert yet
            const methodComments = await this.processClassMethods(queueItem);

            // First insert the class comment
            const classComment = await this.jsDocGenerator.generateClassComment(queueItem, methodComments);
            await this.updateFileWithJSDoc(queueItem.filePath, classComment, queueItem.startLine);

            // Now process and insert each method comment
            const methods = this.jsDocAnalyzer.getClassMethods(queueItem.filePath, queueItem.className);
            for (const methodNode of methods) {
                const methodName = this.getMethodName(methodNode);
                if (!methodName || !methodComments[methodName]) continue;

                const startLine = methodNode.loc?.start.line || 0;
                // Add offset for the class comment we just inserted
                const adjustedLine = startLine + classComment.split('\n').length - 1;
                await this.updateFileWithJSDoc(queueItem.filePath, methodComments[methodName], adjustedLine);
            }
        } else {
            // For non-class nodes, simply insert the JSDoc comment
            const comment = await this.jsDocGenerator.generateComment(queueItem);
            await this.updateFileWithJSDoc(queueItem.filePath, comment, queueItem.startLine);
        }
    }

    public async generate(pullNumber?: number): Promise<void> {
        let fileChanges: PrModeFileChange[] | FullModeFileChange[] = [];


        // If in PR mode, only process files from the PR that are within rootDir and not excluded
        if (pullNumber) {
            const prFiles = await this.gitManager.getFilesInPullRequest(pullNumber);
            fileChanges = prFiles.filter(file => {
                const normalizedPath = path.normalize(file.filename);
                console.log('Checking file:', normalizedPath);

                // All files are considered in root if rootDirectory is ./ or .
                const rootDir = this.configuration.rootDirectory;
                const isInRootDir = rootDir === './' || rootDir === '.' || normalizedPath.startsWith(rootDir);
                console.log('Root directory:', rootDir, 'isInRootDir:', isInRootDir);

                const isExcluded = this.configuration.excludedDirectories.some(dir => {
                    const normalizedExcludeDir = path.normalize(dir);
                    return normalizedPath.includes(normalizedExcludeDir);
                }) || this.configuration.excludedFiles.some(excludedFile => {
                    const normalizedExcludeFile = path.normalize(excludedFile);
                    return normalizedPath.endsWith(normalizedExcludeFile);
                });
                console.log('isExcluded:', isExcluded);

                return isInRootDir && !isExcluded;
            });
            console.log('Filtered PR files:', fileChanges);
        } else {
            // Normal mode: process all TypeScript files in the root directory, besides excluded files
            const typeScriptFiles = this.directoryTraversal.traverse();
            console.log('Full Mode TypeScript files:', typeScriptFiles);
            fileChanges = typeScriptFiles.map((file) => ({
                filename: file,
                status: 'modified',
            }));
        }

        // Process each TypeScript file
        for (const fileChange of fileChanges) {
            if (fileChange.status === 'deleted') {
                continue; // Skip deleted files
            }

            const filePath = path.join(fileChange.filename); // todo - need? this.configuration.rootDirectory,

            // Load and store file content
            if (fileChange.status === 'added' && 'contents_url' in fileChange) {
                const fileContent = await this.getFileContent(fileChange.contents_url);
                this.fileContents.set(filePath, fileContent);
            } else {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                this.fileContents.set(filePath, fileContent);
            }


            const ast = this.typeScriptParser.parse(filePath);
            if (!ast) continue;
            // Analyze JSDoc comments
            this.jsDocAnalyzer.analyze(ast);

            for (const node of ast.body) {

                if (!this.jsDocAnalyzer.shouldHaveJSDoc(node)) {
                    continue;
                }

                const jsDocComment = this.jsDocAnalyzer.getJSDocComment(node, ast.comments || []);
                const queueItem: ASTQueueItem = {
                    filePath: filePath,
                    startLine: node.loc?.start.line || 0,
                    endLine: node.loc?.end.line || 0,
                    nodeType: node.type,
                    className: node.type === 'ClassDeclaration' ? node.id?.name : undefined,
                    methodName: node.type === 'MethodDefinition' ? node.key.name : undefined,
                    code: this.getNodeCode(filePath, node),
                };

                if (jsDocComment) {
                    queueItem.jsDoc = jsDocComment;
                    this.existingJsDocQueue.push(queueItem);
                } else {
                    this.missingJsDocQueue.push(queueItem);
                }
            }
        }

        // Process the AST queue
        if (this.missingJsDocQueue.length > 0) {
            // Only create branch if we have missing JSDoc comments
            // @note Create a new branch based off this.configuration.branch for documentation updates
            this.branchName = `docs-update-${pullNumber || 'full'}-${Date.now()}`;
            await this.gitManager.createBranch(this.branchName, this.configuration.branch);

            // Sort queue to process non-class items first
            this.missingJsDocQueue.sort((a, b) => {
                if (a.nodeType === 'ClassDeclaration' && b.nodeType !== 'ClassDeclaration') return 1;
                if (a.nodeType !== 'ClassDeclaration' && b.nodeType === 'ClassDeclaration') return -1;
                return 0;
            });

            // Process the AST queue
            // Process the AST queue
            while (this.missingJsDocQueue.length > 0) {
                const queueItem = this.missingJsDocQueue.shift();
                if (!queueItem) continue;

                await this.insertJSDocComments(queueItem);
                this.hasChanges = true;
            }

            // Commit changes if any updates were made
            if (this.hasChanges && this.branchName) {
                for (const [filePath, content] of this.fileContents) {
                    await this.gitManager.commitFile(
                        this.branchName,
                        filePath,
                        content,
                        `docs: Add JSDoc documentation to ${path.basename(filePath)}`
                    );
                }

                // Generate PR content using AI
                const prContent = await this.generatePRContent(pullNumber);

                // Create the pull request
                await this.gitManager.createPullRequest({
                    title: prContent.title,
                    body: prContent.body,
                    head: this.branchName,
                    base: this.configuration.branch,
                    labels: ['documentation', 'automated-pr'],
                    reviewers: this.configuration.pullRequestReviewers || []
                });
            }
        }
    }

    private async updateFileWithJSDoc(filePath: string, jsDoc: string, insertLine: number): Promise<void> {
        const content = this.fileContents.get(filePath) || '';
        const lines = content.split('\n');
        const formattedJSDoc = jsDoc.trim() + '\n';  // Ensure single newline
        lines.splice(insertLine - 1, 0, formattedJSDoc);
        this.fileContents.set(filePath, lines.join('\n'));
    }

    private async processClassMethods(queueItem: ASTQueueItem): Promise<Record<string, string>> {
        const className = queueItem.className;
        const methodComments: Record<string, string> = {};

        for (const methodNode of this.jsDocAnalyzer.getClassMethods(queueItem.filePath, className)) {
            const methodName = this.getMethodName(methodNode);
            if (!methodName) continue;

            // Check existing JSDoc comments first
            const existingNode = this.existingJsDocQueue.find(
                node => node.className === className && node.methodName === methodName
            );

            if (existingNode && existingNode.jsDoc) {
                methodComments[methodName] = existingNode.jsDoc;
            } else {
                const methodQueueItem: ASTQueueItem = {
                    ...queueItem,
                    nodeType: methodNode.type,
                    methodName: methodName,
                    code: this.getNodeCode(queueItem.filePath, methodNode),
                    startLine: methodNode.loc?.start.line || 0,
                    endLine: methodNode.loc?.end.line || 0
                };
                const methodComment = await this.jsDocGenerator.generateComment(methodQueueItem);
                methodComments[methodName] = methodComment;
            }
        }

        return methodComments;
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

    private async getFileContent(contentsUrl: string): Promise<string> {
        const response = await fetch(contentsUrl);
        const data = await response.json();
        return Buffer.from(data.content, 'base64').toString('utf-8');
    }


    private async generatePRContent(pullNumber?: number): Promise<{ title: string; body: string }> {
        const modifiedFiles = Array.from(this.fileContents.keys());
        const filesContext = modifiedFiles.map(file => `- ${file}`).join('\n');

        const prompt = `Generate a pull request title and description for adding JSDoc documentation.
            Context:
            - ${modifiedFiles.length} files were modified
            - Files modified:\n${filesContext}
            - This is ${pullNumber ? `related to PR #${pullNumber}` : 'a full repository documentation update'}
            - This is an automated PR for adding JSDoc documentation

            Generate both a title and description. The description should be detailed and include:
            1. A clear summary of changes
            2. Summary of modified files
            3. Instructions for reviewers

            Do not return any special characters or markdown in the response.

            Format the response as a JSON object with 'title' and 'body' fields as shown below:
            {
                "title": "PR Title",
                "body": "PR Description"
            }
            
            `;

        const response = await this.aiService.generateComment(prompt);
        try {
            const content = JSON.parse(response);
            return {
                title: content.title,
                body: content.body
            };
        } catch (error) {
            console.error('Error parsing AI response:', error);
            // Fallback to default PR content
            return {
                title: `docs: Add JSDoc documentation${pullNumber ? ` for PR #${pullNumber}` : ''}`,
                body: this.generateDefaultPRBody()
            };
        }
    }

    private generateDefaultPRBody(): string {
        const changes = Array.from(this.fileContents.keys())
            .map(filePath => `- Added JSDoc documentation to \`${filePath}\``)
            .join('\n');

        return `## 📝 Documentation Updates
        This PR adds JSDoc documentation to TypeScript files that were missing proper documentation.

        ### 🔍 Changes Made:
        ${changes}

        ### 🤖 Generated by Documentation Bot
        This is an automated PR created by the documentation generator tool.`;
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