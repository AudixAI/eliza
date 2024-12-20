import { DirectoryTraversal } from './DirectoryTraversal.js';
import { TypeScriptParser } from './TypeScriptParser.js';
import { JsDocAnalyzer } from './JsDocAnalyzer.js';
import { JsDocGenerator } from './JsDocGenerator.js';
import { DocumentationGenerator } from './DocumentationGenerator.js';
import { Configuration } from './Configuration.js';
import { AIService } from './AIService.js';
import { GitManager } from './GitManager.js';
// import { GithubActionsWorkflow } from './GithubActionsWorkflow';

async function main() {
    try {
        // Load configuration
        const configuration = new Configuration();
        configuration.load();

        const gitManager = new GitManager({
            owner: configuration.repository.owner,
            name: configuration.repository.name
        });

        let prFiles: string[] = [];
        if (typeof configuration.repository.pullNumber === 'number') {
            console.log('Pull Request Number: ', configuration.repository.pullNumber);
            const files = await gitManager.getFilesInPullRequest(configuration.repository.pullNumber);
            prFiles = files.map((file) => file.filename);
        }

        // Create instances of the required components
        const directoryTraversal = new DirectoryTraversal(
            configuration.rootDirectory,
            configuration.excludedDirectories,
            configuration.excludedFiles,
            prFiles
        );
        const typeScriptParser = new TypeScriptParser();
        const jsDocAnalyzer = new JsDocAnalyzer(typeScriptParser);
        const aiService = new AIService();
        const jsDocGenerator = new JsDocGenerator(aiService);

        const documentationGenerator = new DocumentationGenerator(
            directoryTraversal,
            typeScriptParser,
            jsDocAnalyzer,
            jsDocGenerator,
            gitManager,
            configuration,
            aiService
        );

        // Generate documentation
        await documentationGenerator.generate(configuration.repository.pullNumber);

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