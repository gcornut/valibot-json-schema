import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import without from 'lodash/without';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { toJSONSchema } from '.';
import { withJSONSchemaFeatures } from '../extension/withJSONSchemaFeatures';
import { $schema } from '../utils/json-schema';
import { and, negate } from '../utils/predicate';
import type { SupportedSchemas } from './schemas';
import type { ToJSONSchemaOptions } from './types';

const emptyObject = {} as const;
const emptyArray = [] as const;
const SAMPLE_VALUES = [undefined, null, 0, 9999, Number.NaN, false, true, '', 'foo', emptyObject, { a: '1' }, emptyArray, ['foo']];

/**
 * Valibot schema conversion test case
 */
type TestCase = {
    options?: ToJSONSchemaOptions;
    schema: SupportedSchemas;
    error?: string;
    jsonSchema?: JSONSchema7;
    validValues?: any[];
    invalidValues?: any[];
    hasDates?: boolean;
};

function testCase({ schema, options, error, jsonSchema, validValues = [], invalidValues = [] }: TestCase) {
    function test() {
        // Schema converted properly
        const convertedSchema = toJSONSchema({ schema, ...options });
        if (jsonSchema) expect(jsonSchema).toEqual(convertedSchema);
        const ajv = new Ajv();
        addFormats(ajv);

        const format = (a: any) => {
            if (options?.dateStrategy === 'integer' && a instanceof Date) {
                return a.getTime();
            }
            if (options?.dateStrategy === 'string' && a instanceof Date) {
                return a.toISOString();
            }
            if (isPlainObject(a) || Array.isArray(a)) {
                const out: any = Array.isArray(a) ? [] : {};
                for (const [key, value] of Object.entries(a)) {
                    out[key] = format(value);
                }
                return out;
            }
            return a;
        };
        if (options?.dateStrategy === 'integer') {
            ajv.addFormat('unix-time', { type: 'number', validate: Number.isInteger });
        }

        const jsonValidator = ajv.compile(convertedSchema);

        for (const validValue of validValues) {
            // Check valid values match the schema
            const safeParse = v.safeParse(schema, validValue);
            const jsonFormattedValue = format(validValue);

            expect(
                safeParse.success,
                `\`${JSON.stringify(validValue)}\` should match the valibot schema\n${JSON.stringify((safeParse as any).issues)}\n`,
            ).toBe(true);

            const isValid = jsonValidator(jsonFormattedValue);
            if (!isValid) throw new Error(JSON.stringify(jsonValidator.errors));
            expect(isValid, `\`${JSON.stringify(validValue)}\` should match the json schema`).toBe(true);
        }

        for (const invalidValue of invalidValues) {
            // Check invalid values do not match the schema
            expect(v.is(schema, invalidValue), `\`${JSON.stringify(invalidValue)}\` should not match the valibot schema`).toBe(false);

            expect(jsonValidator(invalidValue), `\`${JSON.stringify(invalidValue)}\` should not match the json schema`).toBe(false);
        }
    }

    return () => {
        if (error) {
            // Schema can't be converted to JSON schema
            expect(test).toThrowError(error);
        } else {
            test();
        }
    };
}

describe('exceptions', () => {
    it(
        'should fail with undefined schema',
        testCase({
            schema: undefined as any,
            error: 'No main schema or definitions provided.',
        }),
    );

    it(
        'should fail on unsupported schema',
        testCase({
            schema: v.nan() as any,
            error: 'Unsupported valibot schema: nan',
        }),
    );
});

describe('any', () => {
    it(
        'should convert any schema',
        testCase({
            schema: v.any(),
            jsonSchema: { $schema },
            validValues: SAMPLE_VALUES,
        }),
    );
});

describe('null', () => {
    it(
        'should convert null schema',
        testCase({
            schema: v.null_(),
            jsonSchema: { $schema, const: null },
            validValues: [null],
            invalidValues: without(SAMPLE_VALUES, null),
        }),
    );
});

describe('literal', () => {
    it(
        'should convert literal string schema',
        testCase({
            schema: v.literal('bar'),
            jsonSchema: { $schema, const: 'bar' },
            validValues: ['bar'],
            invalidValues: SAMPLE_VALUES,
        }),
    );

    it(
        'should fail on symbol literal schema',
        testCase({
            schema: v.literal(Symbol()),
            error: 'Unsupported literal value type: Symbol()',
        }),
    );

    it(
        'should fail on NaN literal schema',
        testCase({
            schema: v.literal(Number.NaN),
            error: 'Unsupported literal value type: NaN',
        }),
    );
});

describe('boolean', () => {
    it(
        'should convert boolean schema',
        testCase({
            schema: v.boolean(),
            jsonSchema: { $schema, type: 'boolean' },
            validValues: [true, false],
            invalidValues: without(SAMPLE_VALUES, true, false),
        }),
    );

    it(
        'should convert boolean schema with value',
        testCase({
            schema: v.boolean([v.value(true)]),
            jsonSchema: { $schema, type: 'boolean', const: true },
            validValues: [true],
            invalidValues: without(SAMPLE_VALUES, true),
        }),
    );
});

describe('number', () => {
    it(
        'should convert number schema',
        testCase({
            schema: v.number(),
            jsonSchema: { $schema, type: 'number' },
            validValues: [0, 9999],
            invalidValues: without(SAMPLE_VALUES, 0, 9999, Number.NaN),
        }),
    );

    it(
        'should convert number schema with min value',
        testCase({
            schema: v.number([v.minValue(1)]),
            jsonSchema: { $schema, type: 'number', minimum: 1 },
            validValues: [1, 9999],
            invalidValues: without(SAMPLE_VALUES, 9999, 0, Number.NaN),
        }),
    );

    it(
        'should convert number schema with max value',
        testCase({
            schema: v.number([v.maxValue(1)]),
            jsonSchema: { $schema, type: 'number', maximum: 1 },
            validValues: [0, 1],
            invalidValues: without(SAMPLE_VALUES, 0, Number.NaN),
        }),
    );

    it(
        'should convert number schema with value',
        testCase({
            schema: v.number([v.value(1)]),
            jsonSchema: { $schema, type: 'number', const: 1 },
            validValues: [1],
            invalidValues: without(SAMPLE_VALUES, 0, Number.NaN),
        }),
    );

    it(
        'should convert number schema with multipleOf',
        testCase({
            schema: v.number([v.multipleOf(2)]),
            jsonSchema: { $schema, type: 'number', multipleOf: 2 },
            validValues: [2, 4],
            invalidValues: [1, 3],
        }),
    );

    it(
        'should convert number schema with integer',
        testCase({
            schema: v.number([v.integer()]),
            jsonSchema: { $schema, type: 'integer' },
            validValues: [0, 9999],
            invalidValues: [0.1, 12.2],
        }),
    );
});

describe('bigint', () => {
    it(
        'should fail without the bigintStrategy option',
        testCase({
            schema: v.bigint(),
            error: 'The "bigintStrategy" option must be set to handle `bigint` validators',
        }),
    );

    it(
        'should convert with integer strategy',
        testCase({
            schema: v.bigint(),
            options: { bigintStrategy: 'integer' },
            jsonSchema: { $schema, type: 'integer', format: 'int64' },
        }),
    );

    it(
        'should convert with string strategy',
        testCase({
            schema: v.bigint(),
            options: { bigintStrategy: 'string' },
            jsonSchema: { $schema, type: 'string' },
        }),
    );
});

describe('string', () => {
    it(
        'should convert string schema',
        testCase({
            schema: v.string(),
            jsonSchema: { $schema, type: 'string' },
            validValues: ['', 'foo'],
            invalidValues: without(SAMPLE_VALUES, '', 'foo'),
        }),
    );

    it(
        'should convert string schema with length',
        testCase({
            schema: v.string([v.length(2)]),
            jsonSchema: { $schema, type: 'string', maxLength: 2, minLength: 2 },
            validValues: ['ba', 'ab'],
            invalidValues: SAMPLE_VALUES,
        }),
    );

    it(
        'should convert string schema with min and max length',
        testCase({
            schema: v.string([v.minLength(1), v.maxLength(2)]),
            jsonSchema: { $schema, type: 'string', maxLength: 2, minLength: 1 },
            validValues: ['a', 'ab'],
            invalidValues: SAMPLE_VALUES,
        }),
    );

    it(
        'should convert string schema with regex',
        testCase({
            schema: v.string([v.regex(/foo/)]),
            jsonSchema: { $schema, type: 'string', pattern: 'foo' },
            validValues: ['foo', 'foobar', 'bazfoo'],
            invalidValues: without(SAMPLE_VALUES, 'foo'),
        }),
    );

    it(
        'should convert string schema with value validation',
        testCase({
            schema: v.string([v.value('foo')]),
            jsonSchema: { $schema, type: 'string', const: 'foo' },
            validValues: ['foo'],
            invalidValues: without(SAMPLE_VALUES, 'foo'),
        }),
    );

    it(
        'should convert string schema with email validation',
        testCase({
            schema: v.string([v.email()]),
            jsonSchema: { $schema, type: 'string', format: 'email' },
            validValues: ['foo@example.com', 'user123@mail.co'],
            invalidValues: ['', 'spaces in@middle.com', 'double@at@host.com'],
        }),
    );

    it(
        'should convert string schema with isoDate validation',
        testCase({
            schema: v.string([v.isoDate()]),
            jsonSchema: { $schema, type: 'string', format: 'date' },
            validValues: ['2023-07-11'],
            invalidValues: ['2023', '07-11-2023', '2023/07/11'],
        }),
    );

    it(
        'should convert string schema with isoTimestamp validation',
        testCase({
            schema: v.string([v.isoTimestamp()]),
            jsonSchema: { $schema, type: 'string', format: 'date-time' },
            validValues: [
                '2023-07-11T17:26:27.243Z',
                '0000-01-01T00:00:00.000Z',
                '9999-12-31T23:59:59.999Z',
                '2024-01-04T17:40:21.157953900Z',
                '2024-01-16T16:00:34Z',
            ],
            invalidValues: ['07-11-2023', '2023/07/11'],
        }),
    );

    it(
        'should convert string schema with ipv4 validation',
        testCase({
            schema: v.string([v.ipv4()]),
            jsonSchema: { $schema, type: 'string', format: 'ipv4' },
            validValues: ['192.168.1.1', '255.255.255.255'],
            invalidValues: ['', '11.1', '0..0.0.0'],
        }),
    );

    it(
        'should convert string schema with ipv6 validation',
        testCase({
            schema: v.string([v.ipv6()]),
            jsonSchema: { $schema, type: 'string', format: 'ipv6' },
            validValues: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'fe80::1ff:fe23:4567:890a'],
            invalidValues: ['', '192.168.1.1', 'x:x:x:x:x:x:x:x'],
        }),
    );

    it(
        'should convert string schema with uuid validation',
        testCase({
            schema: v.string([v.uuid()]),
            jsonSchema: { $schema, type: 'string', format: 'uuid' },
            validValues: ['f0563a22-202e-11ee-be56-0242ac120002'],
            invalidValues: ['', 'ae102c2-202f-11ee-acec-2eb5a363657c'],
        }),
    );
});

describe('object', () => {
    it(
        'should convert an open empty object schema',
        testCase({
            schema: v.object({}),
            jsonSchema: { $schema, type: 'object', properties: {} },
            validValues: [{}, { foo: 'bar' }],
            invalidValues: SAMPLE_VALUES.filter(negate(isObject)),
        }),
    );

    it(
        'should convert a closed empty object schema',
        testCase({
            schema: v.object({}, v.never()),
            jsonSchema: { $schema, type: 'object', properties: {}, additionalProperties: false },
            validValues: [{}],
            invalidValues: without(SAMPLE_VALUES, emptyObject, emptyArray),
        }),
    );

    it(
        'should force an open empty object schema into a closed schema',
        testCase({
            options: { strictObjectTypes: true },
            schema: v.object({}),
            jsonSchema: { $schema, type: 'object', properties: {}, additionalProperties: false },
        }),
    );

    it(
        'should convert object schema with props',
        testCase({
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
            invalidValues: [{ optionalString: 'foo' }, { string: 'foo', optionalString: 1 }, ...SAMPLE_VALUES],
        }),
    );

    it(
        'should convert object closed schema with props',
        testCase({
            schema: v.object({ string: v.string(), optionalString: v.optional(v.string()) }, v.never()),
            jsonSchema: {
                $schema,
                type: 'object',
                additionalProperties: false,
                properties: { string: { type: 'string' }, optionalString: { type: 'string' } },
                required: ['string'],
            },
            validValues: [{ string: 'foo' }, { string: 'foo', optionalString: 'foo' }],
            invalidValues: [
                { string: 'foo', unknown: 'property' },
                { optionalString: 'foo' },
                { string: 'foo', optionalString: 1 },
                ...SAMPLE_VALUES,
            ],
        }),
    );

    it(
        'should add default values from object with optional fields',
        testCase({
            schema: v.object({ string: v.string(), optionalString: v.optional(v.string(), 'optional') }),
            jsonSchema: {
                $schema,
                type: 'object',
                properties: { string: { type: 'string' }, optionalString: { type: 'string', default: 'optional' } },
                required: ['string'],
            },
            validValues: [
                { string: 'foo', unknown: 'property' },
                { string: 'foo', optionalString: 'foo' },
            ],
            invalidValues: [{ optionalString: 'foo' }, { string: 'foo', optionalString: 1 }, ...SAMPLE_VALUES],
        }),
    );

    it(
        'should add default values from object with nullable fields',
        testCase({
            schema: v.object({ string: v.string(), nullableString: v.nullable(v.string(), 'nullable') }),
            jsonSchema: {
                $schema,
                type: 'object',
                properties: {
                    string: { type: 'string' },
                    nullableString: { anyOf: [{ const: null }, { type: 'string' }], default: 'nullable' },
                },
                required: ['string', 'nullableString'],
            },
            validValues: [
                { string: 'foo', nullableString: 'foo' },
                { string: 'foo', nullableString: 'foo', unknown: 'property' },
            ],
            invalidValues: [{ nullableString: 'foo' }, { string: 'foo', nullableString: 1 }, ...SAMPLE_VALUES],
        }),
    );

    it(
        'should add default values from object with a nullish field',
        testCase({
            schema: v.object({ string: v.string(), nullishString: v.nullish(v.string(), 'nullish') }),
            jsonSchema: {
                $schema,
                type: 'object',
                properties: {
                    string: { type: 'string' },
                    nullishString: { anyOf: [{ const: null }, { type: 'string' }], default: 'nullish' },
                },
                required: ['string'],
            },
            validValues: [
                { string: 'foo', nullishString: 'foo' },
                { string: 'foo', unknown: 'property' },
            ],
            invalidValues: [{ nullishString: 'foo' }, { string: 'foo', nullishString: 1 }, ...SAMPLE_VALUES],
        }),
    );
});

describe('record', () => {
    it(
        'should fail on array used as a record',
        testCase({
            schema: v.record(v.number()),
            validValues: [[]],
            // ajv JSON Schema error:
            error: '[{"instancePath":"","schemaPath":"#/type","keyword":"type","params":{"type":"object"},"message":"must be object"}]',
        }),
    );

    it(
        'should convert record of numbers schema',
        testCase({
            schema: v.record(v.number()),
            jsonSchema: {
                $schema,
                type: 'object',
                additionalProperties: { type: 'number' },
            },
            validValues: [{}, { a: 2 }],
            invalidValues: without(SAMPLE_VALUES, emptyObject, emptyArray),
        }),
    );
});

describe('array', () => {
    it(
        'should convert array of numbers schema',
        testCase({
            schema: v.array(v.number()),
            jsonSchema: { $schema, type: 'array', items: { type: 'number' } },
            validValues: [emptyArray, [2], [0, 9999]],
            invalidValues: without(SAMPLE_VALUES, emptyArray),
        }),
    );

    it(
        'should convert array with length',
        testCase({
            schema: v.array(v.number(), [v.length(1)]),
            jsonSchema: { $schema, type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 1 },
            validValues: [[2], [9999]],
            invalidValues: [[], [1, 2]],
        }),
    );
});

describe('tuple', () => {
    it(
        'should convert open 1-tuple schema',
        testCase({
            schema: v.tuple([v.number()]),
            jsonSchema: {
                $schema,
                type: 'array',
                items: [{ type: 'number' }],
                minItems: 1,
            },
            validValues: [[1], [1, 'foo']],
            invalidValues: [[], ['foo', 1], ['foo'], ...SAMPLE_VALUES],
        }),
    );

    it(
        'should convert closed 1-tuple schema',
        testCase({
            schema: v.tuple([v.number()], v.never()),
            jsonSchema: {
                $schema,
                type: 'array',
                items: [{ type: 'number' }],
                minItems: 1,
                maxItems: 1,
            },
            validValues: [[1], [0]],
            invalidValues: [[], ['foo', 1], ['foo'], ...SAMPLE_VALUES],
        }),
    );

    it(
        'should convert tuple of a number and a string schema',
        testCase({
            schema: v.tuple([v.number(), v.string()]),
            jsonSchema: {
                $schema,
                type: 'array',
                items: [{ type: 'number' }, { type: 'string' }],
                minItems: 2,
            },
            validValues: [[1, 'foo']],
            invalidValues: [[], [1], ['foo', 1], ['foo'], ...SAMPLE_VALUES],
        }),
    );

    it(
        'should convert tuple of a number and then strings schema',
        testCase({
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
        }),
    );

    it(
        'should convert tuple of a string and then more strings schema',
        testCase({
            schema: v.tuple([v.string()], v.string()),
            jsonSchema: {
                $schema,
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
            },
            validValues: [['a'], ['a', 'b'], ['a', 'b', 'c']],
            invalidValues: [[], ['foo', 1]],
        }),
    );
});

describe('composition types', () => {
    describe('nullable', () => {
        it(
            'should convert nullable schema',
            testCase({
                schema: v.nullable(v.number()),
                jsonSchema: { $schema, anyOf: [{ const: null }, { type: 'number' }] },
                validValues: [null, 0, 9999],
                invalidValues: without(SAMPLE_VALUES, null, 0, 9999),
            }),
        );
    });

    describe('picklist', () => {
        it(
            'should convert enum schema with single members',
            testCase({
                schema: v.picklist(['foo']),
                jsonSchema: { $schema, enum: ['foo'] },
                validValues: ['foo'],
                invalidValues: without(SAMPLE_VALUES, 'foo'),
            }),
        );

        it(
            'should convert enum schema with multiple members',
            testCase({
                schema: v.picklist(['foo', 'bar']),
                jsonSchema: { $schema, enum: ['foo', 'bar'] },
                validValues: ['foo', 'bar'],
                invalidValues: without(SAMPLE_VALUES, 'foo', 'bar'),
            }),
        );
    });

    describe('enum', () => {
        enum TestEnum {
            foo = 'foo',
            bar = 'bar',
        }

        it(
            'should convert enum schema',
            testCase({
                schema: v.enum_(TestEnum),
                jsonSchema: { $schema, enum: ['foo', 'bar'] },
                validValues: ['foo', 'bar'],
                invalidValues: without(SAMPLE_VALUES, 'foo', 'bar'),
            }),
        );
    });

    describe('union', () => {
        it(
            'should convert union schema',
            testCase({
                schema: v.union([v.string(), v.number()]),
                jsonSchema: { $schema, anyOf: [{ type: 'string' }, { type: 'number' }] },
                validValues: ['foo', '', 0, 9999],
                invalidValues: SAMPLE_VALUES.filter(and(negate(isString), negate(isNumber))),
            }),
        );
    });

    describe('variant', () => {
        it(
            'should convert variant schema',
            testCase({
                schema: v.variant('type', [v.object({ type: v.literal('a') }), v.object({ type: v.literal('b') })]),
                jsonSchema: {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    anyOf: [
                        {
                            properties: {
                                type: {
                                    const: 'a',
                                },
                            },
                            required: ['type'],
                            type: 'object',
                        },
                        {
                            properties: {
                                type: {
                                    const: 'b',
                                },
                            },
                            required: ['type'],
                            type: 'object',
                        },
                    ],
                },
                validValues: [{ type: 'a' }, { type: 'b' }],
                invalidValues: [SAMPLE_VALUES, { type: 'c' }],
            }),
        );
    });

    describe('intersection', () => {
        it(
            'should convert intersection of enums',
            testCase({
                schema: v.intersect([v.picklist(['foo', 'bar']), v.picklist(['bar', 'baz'])]),
                jsonSchema: {
                    $schema,
                    allOf: [{ enum: ['foo', 'bar'] }, { enum: ['bar', 'baz'] }],
                },
                validValues: ['bar'],
                invalidValues: ['foo', 'baz', ...SAMPLE_VALUES],
            }),
        );
    });
});

describe('date', () => {
    it(
        'should be able to use the "integer" strategy',
        testCase({
            schema: v.date(),
            jsonSchema: {
                $schema,
                type: 'integer',
                format: 'unix-time',
            },
            validValues: [new Date()],
            invalidValues: ['foo', 'baz', ...SAMPLE_VALUES.filter((v) => typeof v !== 'number')],
            options: { dateStrategy: 'integer' },
        }),
    );

    it(
        'should be able to use the "string" strategy',
        testCase({
            schema: v.date(),
            jsonSchema: {
                $schema,
                type: 'string',
                format: 'date-time',
            },
            validValues: [new Date()],
            invalidValues: SAMPLE_VALUES.filter((v) => typeof v !== 'string'),
            options: { dateStrategy: 'string' },
        }),
    );

    it(
        'should be able to use any strategy in an object',
        testCase({
            schema: v.object({ date: v.date() }),
            jsonSchema: {
                $schema,
                properties: {
                    date: {
                        format: 'unix-time',
                        type: 'integer',
                    },
                },
                required: ['date'],
                type: 'object',
            },
            validValues: [{ date: new Date() }],
            invalidValues: [{ date: 'no date' }],
            options: { dateStrategy: 'integer' },
        }),
    );

    it("should throw an error if the dateStrategy option isn't defined and a date validator exists", () => {
        expect(testCase({ schema: v.date() })).toThrow(Error);
    });

    it(
        'should add date constraints to date fields',
        testCase({
            schema: v.object({
                date: v.date([v.minValue(new Date('2024-03-25')), v.maxValue(new Date('2024-03-26'))]),
                exact: v.date([v.value(new Date('2024-03-27'))]),
            }),
            jsonSchema: {
                $schema,
                properties: {
                    date: {
                        format: 'unix-time',
                        type: 'integer',
                        maximum: 1711411200000,
                        minimum: 1711324800000,
                    },
                    exact: {
                        format: 'unix-time',
                        type: 'integer',
                        const: 1711497600000,
                    },
                },
                required: ['date', 'exact'],
                type: 'object',
            },
            validValues: [
                { date: new Date('2024-03-25'), exact: new Date('2024-03-27') },
                { date: new Date('2024-03-26'), exact: new Date('2024-03-27') },
            ],
            invalidValues: [
                { date: 'no date', exact: new Date('2024-03-27') },
                { date: new Date('2024-03-22'), exact: new Date('2024-03-27') },
                { date: new Date('2024-03-25'), exact: new Date('2024-03-29') },
            ],
            options: { dateStrategy: 'integer' },
        }),
    );

    it(
        'should fail converting minValue requirement with string date strategy',
        testCase({
            schema: v.date([v.minValue(new Date('2024-03-25')), v.maxValue(new Date('2024-03-26'))]),
            options: { dateStrategy: 'string' },
            error: "minValue validation is only available with 'integer' date strategy",
        }),
    );

    it(
        'should fail converting incorrect minValue date',
        testCase({
            schema: v.date([v.maxValue('foo' as any)]),
            options: { dateStrategy: 'integer' },
            error: 'Non-date value used for maxValue validation',
        }),
    );
});

describe('undefined_', () => {
    it("should throw an error if the undefinedStrategy option isn't defined", () => {
        expect(testCase({ schema: v.undefined_() })).toThrow(Error);
    });

    it(
        'should be able to use the "any" strategy',
        testCase({
            schema: v.undefined_(),
            jsonSchema: { $schema },
            validValues: [undefined],
            options: { undefinedStrategy: 'any' },
        }),
    );

    it(
        'should be able to use the "null" strategy',
        testCase({
            schema: v.undefined_(),
            jsonSchema: { $schema, type: 'null' },
            options: { undefinedStrategy: 'null' },
        }),
    );
});

describe('lazy type', () => {
    const listItem: any = v.object({
        type: v.literal('li'),
        children: v.array(v.union([v.string(), v.lazy(() => list)])),
    });
    const list = v.object({
        type: v.literal('ul'),
        children: v.array(listItem),
    });

    it(
        'should fail on lazy schema not provided in definitions',
        testCase({
            schema: list,
            error: 'Type inside lazy schema must be provided in the definitions',
        }),
    );

    it(
        'should convert complex lazy schema',
        testCase({
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
                                    anyOf: [{ type: 'string' }, { $ref: '#/definitions/list' }],
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
                                    children: [{ type: 'li', children: ['List item 2 (nested)'] }],
                                },
                            ],
                        },
                    ],
                },
            ],
        }),
    );
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
    it(
        'should convert array min length with json schema min items',
        testCase({
            schema: withJSONSchemaFeatures(v.array(v.string(), [v.minLength(2)]), { minItems: 2 }),
            jsonSchema: {
                $schema,
                items: {
                    type: 'string',
                },
                minItems: 2,
                type: 'array',
            },
            validValues: [
                ['a', 'b'],
                ['a', 'b', 'c'],
            ],
            invalidValues: [['a'], []],
        }),
    );

    it(
        'should attach to optional object property',
        testCase({
            schema: v.object({ foo: withJSONSchemaFeatures(v.optional(v.number()), { description: 'Foo' }) }),
            jsonSchema: {
                $schema,
                properties: {
                    foo: { type: 'number', description: 'Foo' },
                },
                type: 'object',
            },
        }),
    );
});

describe('custom schema conversion', () => {
    it(
        'should convert unsupported schema via a custom converter',
        testCase({
            schema: v.instance(String) as any,
            options: {
                customSchemaConversion: {
                    // Ignore the instance schema (as any)
                    instance: () => ({}),
                },
            },
            jsonSchema: { $schema },
        }),
    );

    it(
        'should customize conversion of supported schema',
        testCase({
            schema: v.number(),
            options: {
                customSchemaConversion: {
                    // Override conversion of number to use "string" instead
                    number: () => ({ type: 'string' }),
                },
            },
            jsonSchema: { $schema, type: 'string' },
        }),
    );

    it(
        'should customize conversion of unsupported nested schemas',
        testCase({
            schema: v.set(v.string()) as any,
            options: {
                customSchemaConversion: {
                    // Treat set type like an array
                    set: (schema, converter) => converter(v.array((schema as v.SetSchema<any>).value)),
                },
            },
            jsonSchema: { $schema, type: 'array', items: { type: 'string' } },
        }),
    );
});

describe('custom validation conversion', () => {
    it(
        'should convert unsupported validation',
        testCase({
            schema: v.string([v.custom(() => false)]) as any,
            options: {
                customValidationConversion: {
                    // Ignore custom string validation
                    string: { custom: () => ({}) },
                },
            },
            jsonSchema: { $schema, type: 'string' },
        }),
    );

    it(
        'should override supported validation',
        testCase({
            schema: v.string([v.minLength(2)]) as any,
            options: {
                customValidationConversion: {
                    string: { min_length: () => ({ pattern: '.{2,}' }) },
                },
            },
            jsonSchema: { $schema, type: 'string', pattern: '.{2,}' },
        }),
    );
});
