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
    .option('-t, --type <type>', 'Path to the main type')
    .option('--definitions <object_path>', 'Path to the definitions')
    .option('--strictObjectTypes', 'Make object strict object types (no unknown keys)')
    .action((sourcePath, { type, definitions: definitionsPath, out, strictObjectTypes }) => {
        try {
            // Enable auto transpile of ESM & TS modules required
            require('esbuild-runner/register');
        } catch (e) {
        }

        // Load the source path module
        const module = require(path.resolve(sourcePath));
        let definitions: any = {};
        if (definitionsPath) {
            definitions = get(module, definitionsPath);
            if (!definitions) {
                throw new Error(`Definitions path '${definitionsPath}' could not be found in ${sourcePath}`);
            }
        } else {
            // Load all exported schemas
            for (const [name, value] of Object.entries(module)) {
                if (name === 'default' || !isSchema(value)) continue;
                definitions[name] = value;
            }
        }

        // Main type
        let schema = get(module, type);
        if (type && !schema) {
            throw new Error(`Main type '${type}' could not be found in ${sourcePath}`);
        }
        if (!type && module.default) {
            // Fallback: use default export as the main type
            schema = module.default;
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
