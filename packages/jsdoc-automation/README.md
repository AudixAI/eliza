# Codebase Documentation
- https://github.com/ai16z/eliza/issues/1110

## GitHub Workflow Automation

The codebase includes a GitHub Actions workflow (`Update Config and Run`) that allows triggering the documentation generation process with custom parameters. The workflow is defined in the `.github/workflows` directory.

### Workflow Dispatch Inputs

The workflow can be triggered manually using the `workflow_dispatch` event, which accepts the following inputs:

- `pull_number` (required): The pull request number to generate documentation for. If provided, the workflow will only process files related to the specified pull request. If not provided provided, all files in the target_directory will be processed. 
- `target_directory` (required): The root directory of the codebase. Default is `'./'`.
- `excluded_directories` (required): Comma-separated list of directories to exclude from documentation generation. Default is `'node_modules'`.
- `reviewers` (required): Comma-separated list of GitHub usernames to request as reviewers for the generated pull request.

### Environment Variables

The following environment variables need to be added to the GitHub repository secrets:

- `GH_PAT`: Personal Access Token with sufficient permissions to create branches, commit changes, and create pull requests in the repository.
- `OPENAI_API_KEY`: API key for accessing the OpenAI chat API used by the `AIService` to generate comments.

### Config File

The `src/config/config.json` file contains various configuration options for the documentation generation process. The relevant options that are updated by the workflow are:

- `repository.pullNumber`: The pull request number to generate documentation for. Set to `null` for full repository documentation generation.
- `targetDirectory`: The root directory of the codebase.
- `excludedDirectories`: An array of directories to exclude from documentation generation.
- `pullRequestReviewers`: An array of GitHub usernames to request as reviewers for the generated pull request.

To change the Repo this is used with, modify the repository object in `src/config/config.json`: 
```json
  "repository": {
        "owner": "AudixAI",
        "name": "plugin-audix",
        "pullNumber": null
    },
```

# Codebase Documentation

## `JsDocGenerator` Class
The `JsDocGenerator` class is responsible for generating JSDoc comments for code snippets and classes. It uses the `AIService` to generate comments based on the code provided.

## `TypeScriptFileIdentifier` Class  
The `TypeScriptFileIdentifier` class handles identifying and retrieving TypeScript files from a specified directory. It checks file extensions to determine if a file is a TypeScript file.

## `TypeScriptParser` Class
The `TypeScriptParser` class parses TypeScript files using the `@typescript-eslint/parser`. It generates an abstract syntax tree (AST) representation of the parsed content.

## `DocumentationGenerator` Class
The `DocumentationGenerator` class orchestrates the generation of JSDoc documentation for a codebase. It traverses the directory, identifies TypeScript files, parses them, analyzes existing JSDoc comments, generates missing comments using the `JsDocGenerator`, and updates the files with the generated documentation. It also handles creating git branches, committing changes, and creating pull requests.

## `JsDocAnalyzer` Class
The `JsDocAnalyzer` class analyzes JSDoc comments in TypeScript code. It traverses the AST and identifies nodes that should have JSDoc comments. It also provides methods to check if a node is a class node and retrieve JSDoc comments associated with a node.

## `AIService` Class
The `AIService` class is a service for interacting with the OpenAI chat API. It uses the `ChatOpenAI` class from the `@langchain/openai` package to generate comments based on provided prompts.

## `DirectoryTraversal` Class
The `DirectoryTraversal` class handles traversing directories and files. It can traverse based on provided PR files or scan all files in a root directory. It filters files based on excluded directories and file extensions.

## `GitManager` Class
The `GitManager` class manages operations related to interacting with a Git repository using the GitHub API. It can retrieve files in a pull request, create branches, commit files, and create pull requests.

## `Configuration` Class
The `Configuration` class represents a configuration object that holds various settings for a project. It can load configuration data from a JSON file and save the current configuration data to a file.

## `Main` Function
The `main` function is the entry point of the documentation generation process. It creates instances of necessary classes, loads the configuration, retrieves files from a pull request if specified, traverses the directory, parses TypeScript files, analyzes JSDoc comments, and generates documentation using the `DocumentationGenerator`. It also handles error logging.