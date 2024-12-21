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
 * Type definition for Github configuration object
 */
export type GithubConfig = z.infer<typeof githubEnvSchema>;

/**
 * Asynchronously validates the Github configuration settings provided as inputs by fetching values from the runtime,
 * parsing them using the githubEnvSchema, and returning the validated GithubConfig object.
 * If validation fails due to any ZodError, it constructs a detailed error message containing the path and error message
 * for each validation error encountered, and throws a new Error with the formatted error messages.
 * @param {IAgentRuntime} runtime - The agent runtime instance that provides access to the settings required for validation.
 * @returns {Promise<GithubConfig>} - The validated GithubConfig object once validation is successfully completed.
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
