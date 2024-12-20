import * as fs from 'fs';
import * as path from 'path';

export class DirectoryTraversal {
    constructor(
        public rootDirectory: string,
        public excludedDirectories: string[] = [],
        public excludedFiles: string[] = [],
        public prFiles: string[] = []
    ) { }

    public traverse(): string[] {
        if (this.prFiles.length > 0) {
            console.log('Detected PR Files: ', this.prFiles);
            // PR mode: only process files from the PR
            const files = this.prFiles
                .filter((file) => {
                    const filePath = path.join(this.rootDirectory, file);
                    return (
                        // only process files that exist in the config root directory
                        fs.existsSync(filePath) &&
                        // exclude files that are in the excludedFiles array
                        !this.isExcluded(filePath) &&
                        // only process files with .ts or .tsx extensions
                        (path.extname(file) === '.ts' || path.extname(file) === '.tsx')
                    );
                })
                .map((file) => path.join(this.rootDirectory, file));

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

            traverseDirectory(this.rootDirectory);
            return typeScriptFiles;
        }
    }

    public isExcluded(filePath: string): boolean {
        return (
            this.excludedDirectories.includes(path.dirname(filePath)) ||
            this.excludedFiles.includes(path.basename(filePath))
        );
    }

    public handleError(error: Error): void {
        console.error('Directory Traversal Error:', error);
        // Additional error handling logic
    }
}