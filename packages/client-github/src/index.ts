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

export interface GitHubConfig {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
    token: string;
}

/**
 * Represents a GitHub Client that interacts with a GitHub repository to handle operations such as initialization, creating memories from files, creating pull requests, and creating commits.
 * @constructor
 * @param {AgentRuntime} runtime - The agent runtime object.
 */
export class GitHubClient {
    private octokit: Octokit;
    private git: SimpleGit;
    private config: GitHubConfig;
    private runtime: AgentRuntime;
    private repoPath: string;

/**
 * Constructor for the GitHubClient class.
 * @param {AgentRuntime} runtime The runtime object for the agent.
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
 * Asynchronously initializes the repository by creating the necessary directory,
 * cloning or pulling the repository, and checking out a specified branch if provided.
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
 * Asynchronously creates memories from files found within a specified path.
 * Uses the configuration path if provided, otherwise defaults to the repository path.
 * Reads each file, calculates the content hash, and creates a unique knowledgeId based on the repository, owner, and relative path.
 * Checks if a memory with the same knowledgeId and matching content hash already exists before proceeding.
 * Logs the process of creating knowledge for the associated character and relative path.
 * Sets the knowledge with the generated knowledgeId and corresponding content, metadata, and attachments.
 * @returns {Promise<void>}
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
* Creates a pull request with the specified title, branch, files, and optional description.
* 
* @param {string} title - The title of the pull request.
* @param {string} branch - The name of the branch to create for the pull request.
* @param {Array<{path: string, content: string}>} files - An array of objects containing the path and content of each file to be added to the branch.
* @param {string} [description] - Optional description for the pull request. If not provided, the title will be used.
* @returns {Promise<any>} - A promise that resolves with the data of the created pull request.
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
 * Creates a new commit with the specified message and files.
 * 
 * @param {string} message - The commit message.
 * @param {Array<{ path: string; content: string }>} files - Array of objects representing the files to be committed.
 * @returns {Promise<void>} A promise that resolves once the commit is complete.
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
