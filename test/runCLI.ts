import util from 'util';
import childProcess from 'child_process';
import path from 'path';

const exec = util.promisify(childProcess.exec);
const execFile = util.promisify(childProcess.execFile);
let cliBuiltPromise: Promise<void> | undefined;

// Build it once
async function buildOnce() {
    if (cliBuiltPromise) return cliBuiltPromise;
    const command = `yarn build:cli`;
    cliBuiltPromise = exec(command) as Promise<any>;
    await cliBuiltPromise;
}

/** Run CLI with args */
export async function runCLI(args: string) {
    await buildOnce();
    const cli = path.resolve(__filename, '../../dist/cli.js');
    const { stdout } = await execFile(cli, args.split(' '), { cwd: __dirname });
    return JSON.parse(stdout);
}
