import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Repository } from './types/index.js';

// Get the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConfigurationData {
    aiPromptTemplates: string[];
    includedFiles: string[];
    excludedFiles: string[];
    commitMessageTemplate: string;
    pullRequestTemplate: string;
    targetDirectory: string;
    excludedDirectories: string[];
    repository: Repository;
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

/**
 * Represents a configuration object that holds various settings for a project.
 *
 **/
export class Configuration {
    public aiPromptTemplates: string[] = [];
    public includedFiles: string[] = [];
    public excludedFiles: string[] = [];
    public commitMessageTemplate: string = '';
    public pullRequestTemplate: string = '';
    public targetDirectory: string = '';
    public excludedDirectories: string[] = [];
    public repository: Repository = {
        owner: '',
        name: ''
    };
    public branch: string = '';
    public committedFiles: string[] = [];
    public commitMessage: string = '';
    public pullRequestTitle: string = '';
    public pullRequestDescription: string = '';
    public pullRequestLabels: string[] = [];
    public pullRequestReviewers: string[] = [];
    public workflowTriggers: string[] = [];
    public workflowSteps: string[] = [];
    private configPath = path.join(dirname(__dirname), 'src', 'config', 'config.json');

    /**
     * Constructor for initializing a new instance.
     */
    constructor() { }

    /**
     * Loads configuration data from a file, parses it, and assigns the values to respective properties.
     */
    public load(): void {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            const parsedConfig: ConfigurationData = JSON.parse(configData);

            this.aiPromptTemplates = parsedConfig.aiPromptTemplates;
            this.includedFiles = parsedConfig.includedFiles;
            this.excludedFiles = parsedConfig.excludedFiles;
            this.commitMessageTemplate = parsedConfig.commitMessageTemplate;
            this.pullRequestTemplate = parsedConfig.pullRequestTemplate;
            this.targetDirectory = parsedConfig.targetDirectory;
            this.excludedDirectories = parsedConfig.excludedDirectories;
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

    /**
     * Saves the current configuration data to a JSON file.
     */
    public save(): void {
        const configData: ConfigurationData = {
            aiPromptTemplates: this.aiPromptTemplates,
            includedFiles: this.includedFiles,
            excludedFiles: this.excludedFiles,
            commitMessageTemplate: this.commitMessageTemplate,
            pullRequestTemplate: this.pullRequestTemplate,
            targetDirectory: this.targetDirectory,
            excludedDirectories: this.excludedDirectories,
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