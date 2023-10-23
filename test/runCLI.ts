import util from 'util';
import childProcess from 'child_process';
import path from 'path';
import fs from 'fs';

const root = path.resolve(__dirname, '../');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json')).toString());

const exec = util.promisify(childProcess.exec);
const execFile = util.promisify(childProcess.execFile);
let cliBuiltPromise: Promise<void> | undefined;

// Build it once
async function buildOnce() {
    if (cliBuiltPromise) return cliBuiltPromise;
    const command = `yarn build`;
    cliBuiltPromise = exec(command) as Promise<any>;
    await cliBuiltPromise;
}

/** Run CLI with args */
export async function runCLI(args: string) {
    await buildOnce();
    const cli = path.join(root, packageJson.bin);
    const { stdout } = await exec(`${cli} ${args}`, { cwd: __dirname });
    return JSON.parse(stdout);
}
