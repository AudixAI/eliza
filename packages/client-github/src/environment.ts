import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const githubEnvSchema = z.object({
    GITHUB_OWNER: z.string().min(1, "GitHub owner is required"),
    GITHUB_REPO: z.string().min(1, "GitHub repo is required"),
    GITHUB_BRANCH: z.string().min(1, "GitHub branch is required"),
    GITHUB_PATH: z.string().min(1, "GitHub path is required"),
    GITHUB_API_TOKEN: z.string().min(1, "GitHub API token is required"),
});

/**
 * Type definition for Github configuration settings,
 * inferred from the githubEnvSchema.
 */
export type GithubConfig = z.infer<typeof githubEnvSchema>;

/**
 * Validates the GitHub config based on the provided runtime settings.
 * @param {IAgentRuntime} runtime - The runtime object containing the settings.
 * @returns {Promise<GithubConfig>} The validated GitHub config.
 */
export async function validateGithubConfig(
    runtime: IAgentRuntime
): Promise<GithubConfig> {
    try {
        const config = {
            GITHUB_OWNER: runtime.getSetting("GITHUB_OWNER"),
            GITHUB_REPO: runtime.getSetting("GITHUB_REPO"),
            GITHUB_BRANCH: runtime.getSetting("GITHUB_BRANCH"),
            GITHUB_PATH: runtime.getSetting("GITHUB_PATH"),
            GITHUB_API_TOKEN: runtime.getSetting("GITHUB_API_TOKEN"),
        };

        return githubEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `GitHub configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
