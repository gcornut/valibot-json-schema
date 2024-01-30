import fs from 'fs';
import path from 'path';
import { Command, Option } from 'commander';
import get from 'lodash/get';
import stableStringify from 'safe-stable-stringify';

import { toJSONSchema } from '../src';
import { DateStrategy } from '../src/toJSONSchema/types';
import { isSchema } from '../src/utils/valibot';

const program = new Command();

program
    .command('to-json-schema <path>')
    .description('Convert a Valibot schema exported from a JS or TS module.')
    .option('-o, --out <file>', 'Set the output file (default: stdout)')
    .option('-t, --type <type>', 'Path to the main type')
    .option('-d, --definitions <object_path>', 'Path to the definitions')
    .option('--strictObjectTypes', 'Make object strict object types (no unknown keys)')
    .option('--ignoreUnknownValidation', 'If true, do not throw an error on validations that cannot be converted to JSON schema.')
    .addOption(
        new Option('--dateStrategy <strategy>', 'Define how date validator should be converted').choices(Object.values(DateStrategy)),
    )
    .action((sourcePath, { type, definitions: definitionsPath, out, strictObjectTypes, dateStrategy, ignoreUnknownValidation }) => {
        try {
            // Enable auto transpile of ESM & TS modules required
            require('esbuild-runner/register');
        } catch (e) {
            console.warn('Could not load module `esbuild-runner`: ESM/TS modules might not load properly.\n');
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
        const jsonSchema = toJSONSchema({ schema, definitions, strictObjectTypes, dateStrategy, ignoreUnknownValidation });
        const jsonSchemaString = stableStringify(jsonSchema, null, 2);
        if (out) {
            // Output to file
            fs.writeFileSync(out, jsonSchemaString);
        } else {
            // Output to stdout
            process.stdout.write(`${jsonSchemaString}\n`);
        }
    });

program.parse(process.argv);
