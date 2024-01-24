import path from 'path';
import { expect, test } from 'vitest';
import { runCLI } from './runCLI';

const read = (file: string) => require(path.resolve(__dirname, file))
const testCase = ({ run, expectedOutput }: { run: string, expectedOutput: string | RegExp }) => async () => {
    const actual = await runCLI(run);
    if (expectedOutput instanceof  RegExp) expect(actual).toMatch(expectedOutput);
    else expect(actual).toEqual(expectedOutput);
};

test('Convert named export', testCase({
    run: 'to-json-schema ./single-type-export.valibot.ts',
    expectedOutput: read('./single-type-export.schema.json'),
}));

test('Convert default export', testCase({
    run: 'to-json-schema ./single-type-export-default.valibot.ts',
    expectedOutput: read('./single-type-export-default.schema.json'),
}));

test('Convert both default export and named export', testCase({
    run: 'to-json-schema ./single-type-multi-exports.valibot.ts',
    expectedOutput: read('./single-type-multi-exports.schema.json'),
}));

test('Convert from CJS module', testCase({
    run: 'to-json-schema ./complex-type.valibot.cjs',
    expectedOutput: read('./complex-type.schema.json'),
}));

test('Choose main type', testCase({
    run: 'to-json-schema ./complex-type.valibot.ts -t ListElement',
    expectedOutput: read('./complex-type-root-list-element.schema.json'),
}));

test('Convert nested main type', testCase({
    run: 'to-json-schema ./single-type-nested.valibot.ts -t schemas.NumberSchema',
    expectedOutput: read('./single-type-nested-with-main.schema.json'),
}));

test('Convert nested definitions type', testCase({
    run: 'to-json-schema ./single-type-nested.valibot.ts --definitions schemas',
    expectedOutput: read('./single-type-nested-with-definitions.schema.json'),
}));

test('Convert date type without date strategy', testCase({
    run: 'to-json-schema ./date-type.valibot.ts',
    expectedOutput: /Error: The "dateStrategy" option must be set/i
}))

test('Convert date type with integer date strategy', testCase({
    run: 'to-json-schema --dateStrategy integer ./date-type.valibot.ts',
    expectedOutput: read('./date-type-integer.schema.json')
}))

test('Convert date type with string date strategy', testCase({
    run: 'to-json-schema --dateStrategy string ./date-type.valibot.ts',
    expectedOutput: read('./date-type-string.schema.json')
}))
