import * as fs from 'fs';
import * as path from 'path';

/**
 * DirectoryTraversal class for traversing through directories and files.
 * @class DirectoryTraversal
 */
export class DirectoryTraversal {
    /**
     * Constructor for a class that represents a directory structure.
     * 
     * @param {string} targetDirectory - The root directory of the structure.
     * @param {string[]} [excludedDirectories=[]] - Directories to be excluded from the structure.
     * @param {string[]} [excludedFiles=[]] - Files to be excluded from the structure.
     * @param {string[]} [prFiles=[]] - PR files related to the structure.
     */
    constructor(
        public targetDirectory: string,
        public excludedDirectories: string[] = [],
        public excludedFiles: string[] = [],
        public prFiles: string[] = []
    ) { }

    /**
     * Traverses the directory based on PRFiles or all files in the root directory.
     * If PRFiles are detected, processes only files from the PR.
     * Otherwise, scans all files in the root directory for TypeScript files.
     * 
     * @returns An array of string containing the files to process.
     */
    public traverse(): string[] {
        if (this.prFiles.length > 0) {
            console.log('Detected PR Files: ', this.prFiles);
            // PR mode: only process files from the PR
            const files = this.prFiles
                .filter((file) => {
                    const filePath = path.join(this.targetDirectory, file);
                    return (
                        // only process files that exist in the config root directory
                        fs.existsSync(filePath) &&
                        // exclude files that are in the excludedFiles array
                        !this.isExcluded(filePath) &&
                        // only process files with .ts or .tsx extensions
                        (path.extname(file) === '.ts' || path.extname(file) === '.tsx')
                    );
                })
                .map((file) => path.join(this.targetDirectory, file));

            console.log('Files to process: ', files);
            return files;
        } else {
            console.log('No PR Files Detected, Scanning all files in root directory');
            const typeScriptFiles: string[] = [];

            const traverseDirectory = (currentDirectory: string) => {
                const files = fs.readdirSync(currentDirectory);

                files.forEach((file) => {
                    const filePath = path.join(currentDirectory, file);
                    const stats = fs.statSync(filePath);

                    if (stats.isDirectory()) {
                        if (!this.isExcluded(filePath)) {
                            traverseDirectory(filePath);
                        }
                    } else if (stats.isFile() && !this.isExcluded(filePath)) {
                        if (path.extname(file) === '.ts' || path.extname(file) === '.tsx') {
                            typeScriptFiles.push(filePath);
                        }
                    }
                });
            };

            traverseDirectory(this.targetDirectory);
            return typeScriptFiles;
        }
    }

    /**
     * Check if a file path is excluded based on the list of excluded directories and files.
     * @param {string} filePath - The path of the file to be checked.
     * @returns {boolean} - True if the file path is excluded, otherwise false.
     */
    public isExcluded(filePath: string): boolean {
        return (
            this.excludedDirectories.includes(path.dirname(filePath)) ||
            this.excludedFiles.includes(path.basename(filePath))
        );
    }
}