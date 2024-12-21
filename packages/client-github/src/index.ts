import { Octokit } from "@octokit/rest";
import { glob } from "glob";
import simpleGit, { SimpleGit } from "simple-git";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import {
    elizaLogger,
    AgentRuntime,
    Client,
    IAgentRuntime,
    knowledge,
    stringToUuid,
} from "@ai16z/eliza";
import { validateGithubConfig } from "./environment";

/**
 * Interface for configuring GitHub API requests.
 * @typedef {Object} GitHubConfig
 * @property {string} owner - The username or organization name which owns the GitHub repository.
 * @property {string} repo - The name of the GitHub repository.
 * @property {string} [branch] - The name of the branch to fetch data from (optional).
 * @property {string} [path] - The file path within the repository (optional).
 * @property {string} token - The personal access token for authentication.
 */
export interface GitHubConfig {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
    token: string;
}

/**
 * Class representing a GitHub Client.
 */
 */
export class GitHubClient {
    private octokit: Octokit;
    private git: SimpleGit;
    private config: GitHubConfig;
    private runtime: AgentRuntime;
    private repoPath: string;

/**
 * Initializes the GitHubClient with the specified AgentRuntime.
 * @param {AgentRuntime} runtime - The AgentRuntime instance to use for retrieving settings.
 */
    constructor(runtime: AgentRuntime) {
        this.runtime = runtime;
        this.config = {
            owner: runtime.getSetting("GITHUB_OWNER") as string,
            repo: runtime.getSetting("GITHUB_REPO") as string,
            branch: runtime.getSetting("GITHUB_BRANCH") as string,
            path: runtime.getSetting("GITHUB_PATH") as string,
            token: runtime.getSetting("GITHUB_API_TOKEN") as string,
        };
        this.octokit = new Octokit({ auth: this.config.token });
        this.git = simpleGit();
        this.repoPath = path.join(
            process.cwd(),
            ".repos",
            this.config.owner,
            this.config.repo
        );
    }

/**
 * Asynchronously initializes the process by:
 * - Creating a "repos" directory if it doesn't already exist
 * - Cloning the repository if it doesn't exist, or pulling updates if it does
 * - Checking out a specified branch, if provided in the configuration
 * 
 * @returns {Promise<void>} A Promise that resolves once the initialization process is complete
 */
    async initialize() {
        // Create repos directory if it doesn't exist
        await fs.mkdir(path.join(process.cwd(), ".repos", this.config.owner), {
            recursive: true,
        });

        // Clone or pull repository
        if (!existsSync(this.repoPath)) {
            await this.git.clone(
                `https://github.com/${this.config.owner}/${this.config.repo}.git`,
                this.repoPath
            );
        } else {
            const git = simpleGit(this.repoPath);
            await git.pull();
        }

        // Checkout specified branch if provided
        if (this.config.branch) {
            const git = simpleGit(this.repoPath);
            await git.checkout(this.config.branch);
        }
    }

/**
 * Asynchronously creates memories from files found in the specified path.
 * This method searches for files in the configured path (if provided) or in the entire repository.
 * For each file found, it reads the content, calculates its hash, and creates a knowledge document.
 * If a document with the same id exists and the content hash matches, it skips processing that file.
 * The knowledge document includes the text content, hash, source information, attachments, and metadata.
 */
    async createMemoriesFromFiles() {
        console.log("Create memories");
        const searchPath = this.config.path
            ? path.join(this.repoPath, this.config.path, "**/*")
            : path.join(this.repoPath, "**/*");

        const files = await glob(searchPath, { nodir: true });

        for (const file of files) {
            const relativePath = path.relative(this.repoPath, file);
            const content = await fs.readFile(file, "utf-8");
            const contentHash = createHash("sha256")
                .update(content)
                .digest("hex");
            const knowledgeId = stringToUuid(
                `github-${this.config.owner}-${this.config.repo}-${relativePath}`
            );

            const existingDocument =
                await this.runtime.documentsManager.getMemoryById(knowledgeId);

            if (
                existingDocument &&
                existingDocument.content["hash"] == contentHash
            ) {
                continue;
            }

            console.log(
                "Processing knowledge for ",
                this.runtime.character.name,
                " - ",
                relativePath
            );

            await knowledge.set(this.runtime, {
                id: knowledgeId,
                content: {
                    text: content,
                    hash: contentHash,
                    source: "github",
                    attachments: [],
                    metadata: {
                        path: relativePath,
                        repo: this.config.repo,
                        owner: this.config.owner,
                    },
                },
            });
        }
    }

/**
 * Asynchronously creates a new pull request with the specified title, branch, files, and optional description.
 * - Creates a new branch with the given name.
 * - Writes the content of each file into the specified path within the repository.
 * - Commits the changes, adds all files, and pushes to the remote branch.
 * - Creates a pull request using the specified title, description (or default to title), source branch, and base branch.
 * @param {string} title - The title of the pull request.
 * @param {string} branch - The name of the branch to create and push changes to.
 * @param {Array<{ path: string; content: string }>} files - An array of objects containing file paths and their content.
 * @param {string} [description] - Optional description for the pull request. If not provided, defaults to the title.
 * @returns {Promise<Object>} The data of the created pull request.
 */
    async createPullRequest(
        title: string,
        branch: string,
        files: Array<{ path: string; content: string }>,
        description?: string
    ) {
        // Create new branch
        const git = simpleGit(this.repoPath);
        await git.checkout(["-b", branch]);

        // Write files
        for (const file of files) {
            const filePath = path.join(this.repoPath, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.content);
        }

        // Commit and push changes
        await git.add(".");
        await git.commit(title);
        await git.push("origin", branch);

        // Create PR
        const pr = await this.octokit.pulls.create({
            owner: this.config.owner,
            repo: this.config.repo,
            title,
            body: description || title,
            head: branch,
            base: this.config.branch || "main",
        });

        return pr.data;
    }

/**
 * Asynchronously creates a new commit in the Git repository with the provided message and files.
 * @param {string} message - The commit message.
 * @param {Array<{ path: string; content: string }>} files - An array of objects containing the path and content of each file to be committed.
 * @returns {Promise<void>} A Promise that resolves when the commit and push operations are complete.
 */
    async createCommit(
        message: string,
        files: Array<{ path: string; content: string }>
    ) {
        const git = simpleGit(this.repoPath);

        // Write files
        for (const file of files) {
            const filePath = path.join(this.repoPath, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.content);
        }

        // Commit and push changes
        await git.add(".");
        await git.commit(message);
        await git.push();
    }
}

export const GitHubClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        await validateGithubConfig(runtime);
        elizaLogger.log("GitHubClientInterface start");

        const client = new GitHubClient(runtime as AgentRuntime);
        await client.initialize();
        await client.createMemoriesFromFiles();

        return client;
    },
    stop: async (_runtime: IAgentRuntime) => {
        elizaLogger.log("GitHubClientInterface stop");
    },
};

export default GitHubClientInterface;
