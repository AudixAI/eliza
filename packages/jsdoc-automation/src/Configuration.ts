// Configuration.ts
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Repository } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Gets the repository root path by going up two levels from the current file
 * This assumes the code is in src/ directory of the package
 */
const getRepoRoot = () => path.resolve(__dirname, '../../../');

interface ConfigurationData {
    rootDirectory: {
        absolute: string;  // Full path from filesystem root
        relative: string;  // Path relative to repository root
    };
    excludedDirectories: string[];
    repository: Repository;
    commitMessage: string;
    pullRequestTitle: string;
    pullRequestDescription: string;
    pullRequestLabels: string[];
    pullRequestReviewers: string[];
    excludedFiles: string[];
}

/**
 * Represents a configuration object that holds various settings for a project.
 * Handles both absolute and relative paths for different operations.
 */
export class Configuration implements Omit<ConfigurationData, 'rootDirectory'> {
    private _rootDirectory!: ConfigurationData['rootDirectory'];
    private readonly repoRoot: string;

    public excludedDirectories: string[] = [];
    public repository: Repository = {
        owner: 'AudixAI',
        name: 'eliza',
        pullNumber: undefined
    };
    public commitMessage: string = 'Generated JSDoc comments';
    public pullRequestTitle: string = 'JSDoc Generation';
    public pullRequestDescription: string = 'Automated JSDoc generation for the codebase';
    public pullRequestLabels: string[] = ['documentation'];
    public pullRequestReviewers: string[] = [];
    public excludedFiles: string[] = [];
    public branch: string = 'main';

    constructor() {
        this.repoRoot = getRepoRoot();
        this.loadConfiguration();
    }

    get rootDirectory(): ConfigurationData['rootDirectory'] {
        return this._rootDirectory;
    }

    get absolutePath(): string {
        return this._rootDirectory.absolute;
    }

    get relativePath(): string {
        return this._rootDirectory.relative;
    }

    public toRelativePath(absolutePath: string): string {
        return path.relative(this.repoRoot, absolutePath);
    }

    public toAbsolutePath(relativePath: string): string {
        return path.resolve(this.repoRoot, relativePath);
    }

    private loadConfiguration(): void {
        // Use repo root to find workflow file
        const workflowPath = join(this.repoRoot, '.github/workflows/jsdoc-automation.yml');
        const workflowContent = fs.readFileSync(workflowPath, 'utf8');
        const workflow = yaml.parse(workflowContent);
        const inputs = workflow.on.workflow_dispatch.inputs;

        // Get the target directory path (e.g., 'packages/core/src')
        const targetDir = inputs.root_directory.default;

        // Set up root directory paths
        this._rootDirectory = {
            absolute: path.resolve(this.repoRoot, targetDir),
            relative: targetDir.replace(/^\/+/, '') // Remove leading slashes if any
        };

        this.excludedDirectories = inputs.excluded_directories?.default
        ? inputs.excluded_directories.default
            .split(',')
            .map((dir: string) => dir.trim())
        : [];

        this.pullRequestReviewers = inputs.reviewers?.default
            ? inputs.reviewers.default
                .split(',')
                .filter(Boolean)
                .map((reviewer: string) => reviewer.trim())
            : [];

        if (inputs.pull_number) {
            this.repository.pullNumber = parseInt(inputs.pull_number);
        }
    }
}