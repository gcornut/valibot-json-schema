import { describe, expect, test } from 'vitest';
import { readFile, runCLI } from './test/utils';

function testCase({ run, expectedOutput }: { run: string; expectedOutput: string | RegExp }) {
    return async () => {
        const actual = await runCLI(run);
        if (expectedOutput instanceof RegExp) expect(actual.toString()).toMatch(expectedOutput);
        else expect(actual).toEqual(expectedOutput);
    };
}

describe('module formats', () => {
    test(
        'Convert named export',
        testCase({
            run: 'to-json-schema ./single-type-export.valibot.ts',
            expectedOutput: readFile('./single-type-export.schema.json'),
        }),
    );

    test(
        'Convert default export',
        testCase({
            run: 'to-json-schema ./single-type-export-default.valibot.ts',
            expectedOutput: readFile('./single-type-export-default.schema.json'),
        }),
    );

    test(
        'Convert both default export and named export',
        testCase({
            run: 'to-json-schema ./single-type-multi-exports.valibot.ts',
            expectedOutput: readFile('./single-type-multi-exports.schema.json'),
        }),
    );

    test(
        'Convert from CJS module',
        testCase({
            run: 'to-json-schema ./complex-type.valibot.cjs',
            expectedOutput: readFile('./complex-type.schema.json'),
        }),
    );
});

describe('main schema and definitions', () => {
    test(
        'Choose main type',
        testCase({
            run: 'to-json-schema ./complex-type.valibot.ts -t ListElement',
            expectedOutput: readFile('./complex-type-root-list-element.schema.json'),
        }),
    );

    test(
        'Convert nested main type',
        testCase({
            run: 'to-json-schema ./single-type-nested.valibot.ts -t schemas.NumberSchema',
            expectedOutput: readFile('./single-type-nested-with-main.schema.json'),
        }),
    );

    test(
        'Convert nested definitions type',
        testCase({
            run: 'to-json-schema ./single-type-nested.valibot.ts --definitions schemas',
            expectedOutput: readFile('./single-type-nested-with-definitions.schema.json'),
        }),
    );
});

describe('date strategy', () => {
    test(
        'Convert date type without date strategy',
        testCase({
            run: 'to-json-schema ./date-type.valibot.ts',
            expectedOutput: /Error: The "dateStrategy" option must be set to handle/i,
        }),
    );

    test(
        'Convert date type with integer date strategy',
        testCase({
            run: 'to-json-schema --dateStrategy integer ./date-type.valibot.ts',
            expectedOutput: readFile('./date-type-integer.schema.json'),
        }),
    );

    test(
        'Convert date type with string date strategy',
        testCase({
            run: 'to-json-schema --dateStrategy string ./date-type.valibot.ts',
            expectedOutput: readFile('./date-type-string.schema.json'),
        }),
    );
});

describe('undefined strategy', () => {
    test(
        'Convert undefined type without undefined strategy',
        testCase({
            run: 'to-json-schema ./undefined-type.valibot.ts',
            expectedOutput: /Error: The "undefinedStrategy" option must be set to handle/i,
        }),
    );

    test(
        'Convert undefined type with any undefined strategy',
        testCase({
            run: 'to-json-schema --undefinedStrategy any ./undefined-type.valibot.ts',
            expectedOutput: readFile('./undefined-type-any.schema.json'),
        }),
    );
});

describe('bigint strategy', () => {
    test(
        'Convert bigint type without bigint strategy',
        testCase({
            run: 'to-json-schema ./bigint-type.valibot.ts',
            expectedOutput: /Error: The "bigintStrategy" option must be set to handle/i,
        }),
    );

    test(
        'Convert bigint type with integer bigint strategy',
        testCase({
            run: 'to-json-schema --bigintStrategy integer ./bigint-type.valibot.ts',
            expectedOutput: readFile('./bigint-type-integer.schema.json'),
        }),
    );

    test(
        'Convert bigint type with string bigint strategy',
        testCase({
            run: 'to-json-schema --bigintStrategy string ./bigint-type.valibot.ts',
            expectedOutput: readFile('./bigint-type-string.schema.json'),
        }),
    );
});

describe('ignore unknown validation', () => {
    test(
        'Throw error on unknown validation',
        testCase({
            run: 'to-json-schema ./unknown-validation.valibot.ts',
            expectedOutput: /Error: Unsupported valibot validation `custom` for schema `object/i,
        }),
    );

    test(
        'Ignore unknown validation when asked',
        testCase({
            run: 'to-json-schema --ignoreUnknownValidation ./unknown-validation.valibot.ts',
            expectedOutput: readFile('./unknown-validation-ignored.schema.json'),
        }),
    );
});
