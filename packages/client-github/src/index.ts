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
 * Interface representing configuration options for connecting to a GitHub repository.
 * @typedef GitHubConfig
 * @property {string} owner - The owner of the GitHub repository.
 * @property {string} repo - The name of the GitHub repository.
 * @property {string} [branch] - (Optional) The branch of the repository to connect to.
 * @property {string} [path] - (Optional) The path within the repository to interact with.
 * @property {string} token - The authentication token for accessing the repository.
 */
export interface GitHubConfig {
/**
 * The owner of the object, identified by a string value.
 */
    owner: string;
/**
 * The type of the repo, represented as a string.
 */
    repo: string;
/**
 * Represents a branch as an optional string field.
 */
    branch?: string;
@param {string} path - Optional parameter specifying the path.
    path?: string;
/**
 * Represents a string token.
 */
    token: string;
}

/**
 * GitHubClient class for interacting with GitHub repositories.
 * @class
 */
export class GitHubClient {
    private octokit: Octokit;
    private git: SimpleGit;
    private config: GitHubConfig;
    private runtime: AgentRuntime;
    private repoPath: string;

/**
 * Constructor for initializing the GitHubHandler class.
 * @param {AgentRuntime} runtime - The AgentRuntime instance to be used for retrieving settings.
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
 * Asynchronously initializes the repository by creating the 'repos' directory if it doesn't exist,
 * cloning or pulling the repository, and checking out a specified branch if provided.
 * 
 * @returns {Promise<void>} A Promise that resolves once the initialization is complete.
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
  * Asynchronously creates a pull request with the given title, branch, files, and optional description.
  * @param {string} title - The title of the pull request.
  * @param {string} branch - The name of the branch to create the pull request from.
  * @param {Array<{ path: string; content: string }>} files - An array of objects representing files to be added to the branch.
  * @param {string} [description] - Optional. The description of the pull request. If not provided, the title will be used.
  * @returns {Object} - The data of the created pull request.
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
 * Asynchronously creates a new commit with the given message and files.
 * Writes the content of each file to the specified path in the repository.
 * Commits the changes and pushes them to the remote repository.
 *
 * @param {string} message - The message for the commit.
 * @param {Array<{ path: string; content: string }>} files - An array of objects containing the path and content of each file to be committed.
 * @returns {Promise<void>} A Promise that resolves once the commit and push operations are completed.
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
