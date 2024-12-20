import * as fs from 'fs';
import * as path from 'path';

export class TypeScriptFileIdentifier {
    public isTypeScriptFile(file: string): boolean {
        const extension = path.extname(file);
        return extension === '.ts' || extension === '.tsx';
    }

    public getTypeScriptFiles(directory: string): string[] {
        const files = fs.readdirSync(directory);
        return files.filter((file) => this.isTypeScriptFile(file));
    }
}