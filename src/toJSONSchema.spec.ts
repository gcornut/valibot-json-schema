import { describe, expect, it } from 'vitest';
import without from 'lodash/without';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import * as v from 'valibot';
import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv';

import { toJSONSchema, Options, SupportedSchemas } from './toJSONSchema';
import { $schema } from './utils/json-schema';
import { and, negate } from './utils/predicate';
import { withJSONSchemaFeatures } from './extension/withJSONSchemaFeatures';

const emptyObject = {} as const;
const emptyArray = [] as const;
const SAMPLE_VALUES = [undefined, null, 0, 9999, NaN, false, true, '', 'foo', emptyObject, { a: '1' }, emptyArray, ['foo']];

/**
 * Valibot schema conversion test case
 */
type TestCase = {
    testCase: string;
    options?: Options;
    schema: SupportedSchemas;
    error?: string;
    jsonSchema?: JSONSchema7;
    validValues?: any[];
    invalidValues?: any[];
}

function testSuite(testCases: TestCase[]) {
    it.each(testCases)(
        'should convert $testCase',
        ({
             schema,
             options,
             error,
             jsonSchema,
             validValues = [],
             invalidValues = [],
         }: any) => {
            function test() {
                // Schema converted properly
                const convertedSchema = toJSONSchema({ schema, ...options });
                if (jsonSchema)
                    expect(convertedSchema).toEqual(jsonSchema);
                const ajv = new Ajv();
                const jsonValidator = ajv.compile(convertedSchema!);

                for (let validValue of validValues) {
                    // Check valid values match the schema
                    let safeParse = v.safeParse(schema, validValue);
                    expect(safeParse.success, `\`${JSON.stringify(validValue)}\` should match the valibot schema\n${JSON.stringify((safeParse as any).issues)}\n`).toBe(true);
                    expect(jsonValidator(validValue), `\`${JSON.stringify(validValue)}\` should match the json schema`).toBe(true);
                }

                for (let invalidValue of invalidValues) {
                    // Check invalid values do not match the schema
                    expect(v.is(schema, invalidValue), `\`${JSON.stringify(invalidValue)}\` should not match the valibot schema`).toBe(false);
                    expect(jsonValidator(invalidValue), `\`${JSON.stringify(invalidValue)}\` should not match the json schema`).toBe(false);
                }
            }

            if (error) {
                // Schema can't be converted to JSON schema
                expect(test).toThrowError(error);
            } else {
                test();
            }
        },
    );
}

describe('exceptions', () => {
    testSuite([{
        testCase: 'unsupported schema',
        schema: v.nan() as any,
        error: 'Unsupported valibot schema: nan',
    }]);
});

describe('base types', () => {
    testSuite([
        {
            testCase: 'any',
            schema: v.any(),
            jsonSchema: { $schema },
            validValues: SAMPLE_VALUES,
        },
        {
            testCase: 'null',
            schema: v.nullType(),
            jsonSchema: { $schema, const: null },
            validValues: [null],
            invalidValues: without(SAMPLE_VALUES, null),
        },
        {
            testCase: 'literal string',
            schema: v.literal('bar'),
            jsonSchema: { $schema, const: 'bar' },
            validValues: ['bar'],
            invalidValues: SAMPLE_VALUES,
        },
        {
            testCase: 'literal symbol should throw',
            schema: v.literal(Symbol()),
            error: 'Unsupported literal value type: Symbol()',
        },
        {
            testCase: 'literal NaN should throw',
            schema: v.literal(NaN),
            error: 'Unsupported literal value type: NaN',
        },
        {
            testCase: 'number',
            schema: v.number(),
            jsonSchema: { $schema, type: 'number' },
            validValues: [0, 9999],
            invalidValues: without(SAMPLE_VALUES, 0, 9999, NaN),
        },
        {
            testCase: 'string',
            schema: v.string(),
            jsonSchema: { $schema, type: 'string' },
            validValues: ['', 'foo'],
            invalidValues: without(SAMPLE_VALUES, '', 'foo'),
        },
        {
            testCase: 'boolean',
            schema: v.boolean(),
            jsonSchema: { $schema, type: 'boolean' },
            validValues: [true, false],
            invalidValues: without(SAMPLE_VALUES, true, false),
        },
        {
            testCase: 'nullable',
            schema: v.nullable(v.number()),
            jsonSchema: { $schema, anyOf: [{ const: null }, { type: 'number' }] },
            validValues: [null, 0, 9999],
            invalidValues: without(SAMPLE_VALUES, null, 0, 9999),
        },
    ]);
});

describe('object', () => {
    testSuite([
        {
            testCase: 'object empty',
            schema: v.object(emptyObject),
            jsonSchema: { $schema, type: 'object', properties: {} },
            validValues: [emptyObject],
            invalidValues: SAMPLE_VALUES.filter(negate(isObject)),
        },
        {
            testCase: 'object with props',
            schema: v.object({ string: v.string(), optionalString: v.optional(v.string()) }),
            jsonSchema: {
                $schema,
                type: 'object',
                properties: { string: { type: 'string' }, optionalString: { type: 'string' } },
                required: ['string'],
            },
            validValues: [
                { string: 'foo', unknown: 'property' },
                { string: 'foo', optionalString: 'foo' },
            ],
            invalidValues: [
                { optionalString: 'foo' },
                { string: 'foo', optionalString: 1 },
                ...SAMPLE_VALUES,
            ],
        },
        {
            testCase: 'object strict properties',
            options: { strictObjectTypes: true },
            schema: v.strict(v.object({ string: v.string(), optionalString: v.optional(v.string()) })),
            jsonSchema: {
                $schema,
                type: 'object',
                additionalProperties: false,
                properties: { string: { type: 'string' }, optionalString: { type: 'string' } },
                required: ['string'],
            },
            validValues: [
                { string: 'foo' },
                { string: 'foo', optionalString: 'foo' },
            ],
            invalidValues: [
                { string: 'foo', unknown: 'property' },
                { optionalString: 'foo' },
                { string: 'foo', optionalString: 1 },
                ...SAMPLE_VALUES,
            ],
        },
    ]);
});

describe('record', () => {
    testSuite([
        {
            testCase: 'record as array not supported',
            schema: v.record(v.number()),
            validValues: [[]],
            // ajv JSON Schema error:
            error: '`[]` should match the json schema: expected false to be true // Object.is equality',
        },
        {
            testCase: 'record of numbers',
            schema: v.record(v.number()),
            jsonSchema: {
                $schema,
                type: 'object',
                additionalProperties: { type: 'number' },
            },
            validValues: [{}, { a: 2 }],
            invalidValues: without(SAMPLE_VALUES, emptyObject, emptyArray),
        },
    ]);
});

describe('array', () => {
    testSuite([
        {
            testCase: 'array of numbers',
            schema: v.array(v.number()),
            jsonSchema: { $schema, type: 'array', items: { type: 'number' } },
            validValues: [emptyArray, [2], [0, 9999]],
            invalidValues: without(SAMPLE_VALUES, emptyArray),
        },
    ]);
});

describe('tuple', () => {
    testSuite([
        {
            testCase: 'tuple of a number and a string',
            schema: v.tuple([v.number(), v.string()]),
            jsonSchema: {
                $schema,
                type: 'array',
                items: [{ type: 'number' }, { type: 'string' }],
                minItems: 2,
                maxItems: 2,
            },
            validValues: [[1, 'foo']],
            invalidValues: [[], [1], ['foo', 1], ['foo'], ...SAMPLE_VALUES],
        },
        {
            testCase: 'tuple of a number and then strings',
            schema: v.tuple([v.number()], v.string()),
            jsonSchema: {
                $schema,
                type: 'array',
                items: [{ type: 'number' }],
                additionalItems: { type: 'string' },
                minItems: 1,
            },
            validValues: [[1], [1, 'a'], [2, 'a', 'b', 'c']],
            invalidValues: [[], ['foo', 1], ['foo'], ...SAMPLE_VALUES],
        },
        {
            testCase: 'tuple of a string and then more strings',
            schema: v.tuple([v.string()], v.string()),
            jsonSchema: {
                $schema,
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
            },
            validValues: [['a'], ['a', 'b'], ['a', 'b', 'c']],
            invalidValues: [[], ['foo', 1]],
        },
    ]);
});

describe('composition types', () => {
    describe('enum', () => {
        testSuite([
            {
                testCase: 'enum single',
                schema: v.enumType(['foo']),
                jsonSchema: { $schema, enum: ['foo'] },
                validValues: ['foo'],
                invalidValues: without(SAMPLE_VALUES, 'foo'),
            },
            {
                testCase: 'enum multiple',
                schema: v.enumType(['foo', 'bar']),
                jsonSchema: { $schema, enum: ['foo', 'bar'] },
                validValues: ['foo', 'bar'],
                invalidValues: without(SAMPLE_VALUES, 'foo', 'bar'),
            }],
        );
    });

    describe('union', () => {
        testSuite([
            {
                testCase: 'union',
                schema: v.union([v.string(), v.number()]),
                jsonSchema: { $schema, anyOf: [{ type: 'string' }, { type: 'number' }] },
                validValues: ['foo', '', 0, 9999],
                invalidValues: SAMPLE_VALUES.filter(and(negate(isString), negate(isNumber))),
            },
        ]);
    });

    describe('intersection', () => {
        testSuite([
            {
                testCase: 'intersection of enums',
                schema: v.intersection([
                    v.enumType(['foo', 'bar']),
                    v.enumType(['bar', 'baz']),
                ]),
                jsonSchema: {
                    $schema,
                    allOf: [
                        { enum: ['foo', 'bar'] },
                        { enum: ['bar', 'baz'] },
                    ],
                },
                validValues: ['bar'],
                invalidValues: ['foo', 'baz', ...SAMPLE_VALUES],
            },
        ]);
    });
});

describe('recursive type', () => {
    const listItem: any = v.object({
        type: v.literal('li'),
        children: v.array(v.union([v.string(), v.recursive(() => list)])),
    });
    const list = v.object({
        type: v.literal('ul'),
        children: v.array(listItem),
    });

    testSuite([
        {
            testCase: 'recursive fail if not provided in definitions',
            schema: list,
            error: 'Type inside recursive schema must be provided in the definitions',
        },
        {
            testCase: 'recursive complex structure',
            schema: list,
            options: { definitions: { list, listItem } },
            jsonSchema: {
                $schema,
                $ref: '#/definitions/list',
                definitions: {
                    list: {
                        type: 'object',
                        properties: {
                            type: { const: 'ul' },
                            children: {
                                type: 'array',
                                items: { $ref: '#/definitions/listItem' },
                            },
                        },
                        required: ['type', 'children'],
                    },
                    listItem: {
                        type: 'object',
                        properties: {
                            type: { const: 'li' },
                            children: {
                                type: 'array',
                                items: {
                                    anyOf: [
                                        { type: 'string' },
                                        { $ref: '#/definitions/list' },
                                    ],
                                },
                            },
                        },
                        required: ['type', 'children'],
                    },
                },
            },
            validValues: [
                { type: 'ul', children: [{ type: 'li', children: ['List item 1'] }] },
                {
                    type: 'ul',
                    children: [
                        {
                            type: 'li',
                            children: [
                                'List item 1',
                                // Nested lists !
                                {
                                    type: 'ul',
                                    children: [
                                        { type: 'li', children: ['List item 2 (nested)'] },
                                    ],
                                },
                            ],
                        },

                    ],
                },
            ],
        },
    ]);
});

describe('definitions', () => {
    const NumberSchema = v.number();
    const StringSchema = v.string();

    it('should convert definitions without a main schema', () => {
        const actual = toJSONSchema({ definitions: { NumberSchema } });
        const expected = {
            $schema,
            definitions: {
                NumberSchema: { type: 'number' },
            },
        };
        expect(actual).toEqual(expected);
    });

    it('should convert with both a main schema and definitions', () => {
        const actual = toJSONSchema({ schema: NumberSchema, definitions: { NumberSchema, StringSchema } });
        const expected = {
            $schema,
            $ref: '#/definitions/NumberSchema',
            definitions: {
                NumberSchema: { type: 'number' },
                StringSchema: { type: 'string' },
            },
        };
        expect(actual).toEqual(expected);
    });
});


describe(withJSONSchemaFeatures.name, () => {
    testSuite([
        {
            testCase: 'array min length with json schema min items',
            schema: withJSONSchemaFeatures(v.array(v.string(), [v.minLength(2)]), { minItems: 2 }),
            jsonSchema: {
                $schema,
                items: {
                    type: 'string',
                },
                minItems: 2,
                type: 'array',
            },
            validValues: [['a', 'b'], ['a', 'b', 'c']],
            invalidValues: [['a'], []],
        },
    ]);
});