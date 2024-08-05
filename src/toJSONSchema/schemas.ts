import type { JSONSchema7 } from 'json-schema';
import {
    type AnySchema,
    type ArraySchema,
    type BigintSchema,
    type BooleanSchema,
    type DateSchema,
    type EnumSchema,
    type GenericIssue,
    type IntersectSchema,
    type LazySchema,
    type LiteralSchema,
    type NullSchema,
    type NullableSchema,
    type NullishSchema,
    type NumberSchema,
    type ObjectSchema,
    type ObjectWithRestSchema,
    type OptionalSchema,
    type PicklistSchema,
    type PipeItem,
    type RecordSchema,
    type SchemaWithPipe,
    type StrictObjectSchema,
    type StrictTupleSchema,
    type StringSchema,
    type TupleSchema,
    type TupleWithRestSchema,
    type UndefinedSchema,
    type UnionSchema,
    type VariantSchema,
    getDefault,
    never,
} from 'valibot';

import { assignExtraJSONSchemaFeatures } from '../extension/assignExtraJSONSchemaFeatures';
import { assert } from '../utils/assert';
import { isEqual } from '../utils/isEqual';
import { assertJSONLiteral } from '../utils/json-schema';
import { isNeverSchema, isNullishSchema, isOptionalSchema, isStringSchema } from '../utils/valibot';

import { toDefinitionURI } from './toDefinitionURI';
import type { SchemaConverter } from './types';

type NonPipeSchemas =
    | AnySchema
    | LiteralSchema<any, any>
    | NullSchema<any>
    | NumberSchema<any>
    | BigintSchema<any>
    | StringSchema<any>
    | BooleanSchema<any>
    | NullableSchema<any, any>
    | StrictObjectSchema<any, any>
    | ObjectSchema<any, any>
    | ObjectWithRestSchema<any, any, any>
    | RecordSchema<any, any, any>
    | ArraySchema<any, any>
    | TupleSchema<any, any>
    | StrictTupleSchema<any, any>
    | TupleWithRestSchema<readonly any[], any, any>
    | IntersectSchema<any, any>
    | UnionSchema<any, any>
    | VariantSchema<any, any, any>
    | PicklistSchema<any, any>
    | EnumSchema<any, any>
    | LazySchema<any>
    | DateSchema<any>
    | NullishSchema<any, any>
    | OptionalSchema<any, any>
    | UndefinedSchema<any>;

export type PipeSchema = SchemaWithPipe<[NonPipeSchemas, ...PipeItem<any, any, GenericIssue<any>>[]]>;
export type SupportedSchemas = NonPipeSchemas | PipeSchema;

export const SCHEMA_CONVERTERS: {
    [K in SupportedSchemas['type']]: SchemaConverter<
        Extract<
            SupportedSchemas,
            {
                type: K;
            }
        >
    >;
} = {
    any: () => ({}),
    // Core types
    null: () => ({ const: null }),
    literal: ({ literal }) => ({ const: assertJSONLiteral(literal) }),
    number: () => ({ type: 'number' }),
    string: () => ({ type: 'string' }),
    boolean: () => ({ type: 'boolean' }),
    // Compositions
    optional: (schema, convert) => {
        const output = convert(schema.wrapped);
        const defaultValue = getDefault(schema);
        if (defaultValue !== undefined) output.default = defaultValue;
        return output;
    },
    nullish: (schema, convert) => {
        const output: JSONSchema7 = { anyOf: [{ const: null }, convert(schema.wrapped)] };
        const defaultValue = getDefault(schema);
        if (defaultValue !== undefined) output.default = defaultValue;
        return output;
    },
    nullable: (schema, convert) => {
        const output: JSONSchema7 = { anyOf: [{ const: null }, convert(schema.wrapped)] };
        const defaultValue = getDefault(schema);
        if (defaultValue !== undefined) output.default = defaultValue;
        return output;
    },
    picklist: ({ options }) => ({ enum: options.map(assertJSONLiteral) }),
    enum: (options) => ({ enum: Object.values(options.enum).map(assertJSONLiteral) }),
    union: ({ options }, convert) => ({ anyOf: options.map(convert) }),
    intersect: ({ options }, convert) => ({ allOf: options.map(convert) }),
    // Complex types
    array: ({ item }, convert) => ({ type: 'array', items: convert(item) }),
    tuple_with_rest({ items: originalItems, rest }, convert) {
        const minItems = originalItems.length;
        let maxItems: JSONSchema7['maxItems'];
        let items: JSONSchema7 | JSONSchema7[] = originalItems.map(convert);
        let additionalItems: JSONSchema7['additionalItems'];
        if (isNeverSchema(rest)) {
            maxItems = minItems;
        } else if (rest) {
            const restItems = convert(rest);
            // Simplification of uniform 1-tuple => simple array schema with min length = 1
            if (items.length === 1 && isEqual(items[0], restItems)) {
                items = items[0];
            } else {
                additionalItems = restItems;
            }
        }
        return {
            type: 'array',
            items,
            ...(additionalItems && { additionalItems }),
            ...(minItems && { minItems }),
            ...(maxItems && { maxItems }),
        };
    },
    strict_tuple({ items: originalItems }, convert) {
        const items = originalItems.map(convert);
        return { type: 'array', items, minItems: items.length, maxItems: items.length };
    },
    tuple({ items: originalItems }, convert, context) {
        const items = originalItems.map(convert);
        return { type: 'array', items, minItems: items.length };
    },
    object_with_rest({ entries, rest }, convert, context) {
        const properties: any = {};
        const required: string[] = [];
        for (const [propKey, propValue] of Object.entries(entries)) {
            const propSchema = propValue as any;
            if (!isOptionalSchema(propSchema) && !isNullishSchema(propSchema)) {
                required.push(propKey);
            }
            properties[propKey] = convert(propSchema);
            assignExtraJSONSchemaFeatures(propValue as any, properties[propKey]);
        }
        let additionalProperties: JSONSchema7['additionalProperties'];
        if (rest) {
            additionalProperties = isNeverSchema(rest) ? false : convert(rest);
        } else if (context.strictObjectTypes) {
            additionalProperties = false;
        }
        const output: JSONSchema7 = { type: 'object', properties };
        if (additionalProperties !== undefined) output.additionalProperties = additionalProperties;
        if (required.length) output.required = required;

        return output;
    },
    object(schema, convert, context) {
        return SCHEMA_CONVERTERS.object_with_rest(schema as any, convert, context);
    },
    strict_object(schema, convert, context) {
        return SCHEMA_CONVERTERS.object_with_rest({ ...schema, rest: never() } as any, convert, context);
    },
    record({ key, value }, convert) {
        assert(key, isStringSchema, 'Unsupported record key type: %');
        return { type: 'object', additionalProperties: convert(value) };
    },
    lazy(schema, _, context) {
        const nested = schema.getter({});
        const defName = context.defNameMap.get(nested);
        if (!defName) {
            throw new Error('Type inside lazy schema must be provided in the definitions');
        }
        return { $ref: toDefinitionURI(defName) };
    },
    date(_, __, context) {
        if (!context.dateStrategy) {
            throw new Error('The "dateStrategy" option must be set to handle date validators');
        }

        switch (context.dateStrategy) {
            case 'integer':
                return { type: 'integer', format: 'unix-time' };
            case 'string':
                return { type: 'string', format: 'date-time' };
        }
    },
    undefined(_, __, context) {
        if (!context.undefinedStrategy) {
            throw new Error('The "undefinedStrategy" option must be set to handle the `undefined` schema');
        }

        switch (context.undefinedStrategy) {
            case 'any':
                return {};
            case 'null':
                return { type: 'null' };
        }
    },
    bigint(_, __, context) {
        if (!context.bigintStrategy) {
            throw new Error('The "bigintStrategy" option must be set to handle `bigint` validators');
        }

        switch (context.bigintStrategy) {
            case 'integer':
                return { type: 'integer', format: 'int64' };
            case 'string':
                return { type: 'string' };
        }
    },
    variant({ options }, ...args) {
        // Convert `variant` like a union
        return SCHEMA_CONVERTERS.union({ options } as any, ...args);
    },
};
