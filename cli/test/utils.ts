import childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';

const root = path.resolve(__dirname, '../../');
const readJSON = (file: string) => JSON.parse(fs.readFileSync(file).toString());
const packageJson = readJSON(path.join(root, 'package.json'));

const exec = util.promisify(childProcess.exec);
let cliBuiltPromise: Promise<void> | undefined;

// Build it once
async function buildOnce() {
    if (cliBuiltPromise) return cliBuiltPromise;
    const command = 'yarn build';
    cliBuiltPromise = exec(command) as Promise<any>;
    await cliBuiltPromise;
}

/** Run CLI with args */
export async function runCLI(args: string) {
    await buildOnce();
    const cli = path.join(root, packageJson.bin);
    try {
        const nodeCmd = os.platform() === 'win32' ? 'node ' : '';
        const { stdout } = await exec(`${nodeCmd}${cli} ${args}`, { cwd: __dirname });
        return JSON.parse(stdout);
    } catch (error) {
        return error;
    }
}

/** Read test resource */
export const readFile = (file: string) => readJSON(path.resolve(__dirname, file));
