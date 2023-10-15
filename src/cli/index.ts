import { Command } from 'commander';
import stableStringify from 'safe-stable-stringify';
import path from 'path';
import fs from 'fs';

import { toJSONSchema } from '../toJSONSchema';
import { isSchema } from '../utils/valibot';

const program = new Command();

program.command('to-json-schema')
    .description('Convert a Valibot schema exported from a JS module.')
    .requiredOption('-p, --path <path>', 'Source file path')
    .option('-t, --type <name>', 'Main type')
    .option('-d, --definitions <name...>', 'Definition types')
    .option('-o, --out <file>', 'Set the output file (default: stdout)')
    .action((args) => {
        // Enable auto transpile of ESM & TS modules required
        require('esbuild-runner/register');

        const inputDefinitionNames = args.definitions && new Set(args.definitions?.flatMap((name: string) => name.split(',')));

        const module = require(path.resolve(args.path));
        const definitions: any = {};
        for (const [name, value] of Object.entries(module)) {
            if (!isSchema(value)) continue;
            if (inputDefinitionNames) {
                if (!inputDefinitionNames.has(name)) continue;
                inputDefinitionNames.delete(name);
            }
            definitions[name] = value;
        }
        inputDefinitionNames?.forEach((name: string) => {
            throw new Error(`Definition type '${name}' could not be found in ${args.path}`);
        })

        if (args.type && !(args.type in definitions)) {
            throw new Error(`Main type '${args.type}' could not be found in ${args.path}`);
        }
        const jsonSchema = toJSONSchema({ schema: definitions[args.type], definitions });
        const jsonSchemaString = stableStringify(jsonSchema, null, 2)!;
        if (args.out) {
            // Output to file
            fs.writeFileSync(args.out, jsonSchemaString);
        } else {
            // Output to stdout
            process.stdout.write(`${jsonSchemaString}\n`);
        }
    });

program.parse(process.argv);
