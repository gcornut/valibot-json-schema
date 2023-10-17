import path from 'path';
import { expect, test } from 'vitest';
import { runCLI } from './runCLI';

const testCase = ({ run, expectedOutput }: { run: string, expectedOutput: string }) => async () => {
    const expected = require(path.resolve(__dirname, `${expectedOutput}`));
    const actual = await runCLI(run);
    expect(actual).toEqual(expected);
};

test('Convert named export', testCase({
    run: 'to-json-schema ./single-type-export.valibot.ts',
    expectedOutput: './single-type-export.schema.json',
}));

test('Convert default export', testCase({
    run: 'to-json-schema ./single-type-export-default.valibot.ts',
    expectedOutput: './single-type-export-default.schema.json',
}));

test('Convert both default export and named export', testCase({
    run: 'to-json-schema ./single-type-multi-exports.valibot.ts',
    expectedOutput: './single-type-multi-exports.schema.json',
}));

test('Convert from CJS module', testCase({
    run: 'to-json-schema ./complex-type.valibot.cjs',
    expectedOutput: './complex-type.schema.json',
}));

test('Choose main type', testCase({
    run: 'to-json-schema ./complex-type.valibot.ts -t ListElement',
    expectedOutput: './complex-type-root-list-element.schema.json',
}));

test('Convert nested main type', testCase({
    run: 'to-json-schema ./single-type-nested.valibot.ts -t schemas.NumberSchema',
    expectedOutput: './single-type-nested-with-main.schema.json',
}));

test('Convert nested definitions type', testCase({
    run: 'to-json-schema ./single-type-nested.valibot.ts --definitions schemas',
    expectedOutput: './single-type-nested-with-definitions.schema.json',
}));
