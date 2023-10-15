import { Command } from 'commander';
import stableStringify from 'safe-stable-stringify';
import path from 'path';
import fs from 'fs';
import get from 'lodash/get';
import last from 'lodash/last';

import { toJSONSchema } from '../toJSONSchema';
import { isSchema } from '../utils/valibot';

const program = new Command();

const parseList = (strings: string[]) => strings?.flatMap((name: string) => name.split(',')) || [];

program.command('to-json-schema <path>')
    .description('Convert a Valibot schema exported from a JS or TS module.')
    .option('-o, --out <file>', 'Set the output file (default: stdout)')
    .option('-t, --type <type>', 'Main type')
    .option('-i, --include <types...>', 'Exclude types')
    .option('-e, --exclude <types...>', 'Include types')
    .option('--strictObjectTypes', 'Make object strict object types (no unknown keys)')
    .action((sourcePath, { type, include, exclude, out, strictObjectTypes }) => {
        // Enable auto transpile of ESM & TS modules required
        require('esbuild-runner/register');

        // Load the source path module
        const { default: defaultExport, ...module } = require(path.resolve(sourcePath));


        const definitions: any = {};
        if (include) {
            for (const name of parseList(include)) {
                const schema = get(module, name);
                if (!schema) {
                    throw new Error(`Include type '${name}' could not be found in ${sourcePath}`);
                }
                definitions[last(name.split('.'))!] = schema;
            }
        } else {
            // Load all exported schemas
            for (const [name, value] of Object.entries(module)) {
                if (!isSchema(value)) continue;
                definitions[name] = value;
            }
        }

        for (let name of parseList(exclude)) {
            delete definitions[name];
        }

        // Main type
        let schema = get(module, type);
        if (type && !schema) {
            throw new Error(`Main type '${type}' could not be found in ${sourcePath}`);
        }
        if (!type && defaultExport) {
            // Fallback: use default export as the main type
            schema = defaultExport;
        }

        // Convert
        const jsonSchema = toJSONSchema({ schema, definitions, strictObjectTypes });
        const jsonSchemaString = stableStringify(jsonSchema, null, 2)!;
        if (out) {
            // Output to file
            fs.writeFileSync(out, jsonSchemaString);
        } else {
            // Output to stdout
            process.stdout.write(`${jsonSchemaString}\n`);
        }
    });

program.parse(process.argv);
