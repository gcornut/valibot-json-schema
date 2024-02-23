import { JSONSchema7 } from 'json-schema';
import {
    AnySchema,
    ArraySchema,
    BigintSchema,
    BooleanSchema,
    DateSchema,
    EnumSchema,
    IntersectSchema,
    LazySchema,
    LiteralSchema,
    NullSchema,
    NullableSchema,
    NullishSchema,
    NumberSchema,
    ObjectSchema,
    OptionalSchema,
    PicklistSchema,
    RecordSchema,
    StringSchema,
    TupleSchema,
    UndefinedSchema,
    UnionSchema,
    VariantSchema,
    getDefault,
} from 'valibot';
import { assignExtraJSONSchemaFeatures } from '../extension/assignExtraJSONSchemaFeatures';
import { assert } from '../utils/assert';
import { isEqual } from '../utils/isEqual';
import { assertJSONLiteral } from '../utils/json-schema';
import { isNeverSchema, isNullishSchema, isOptionalSchema, isStringSchema } from '../utils/valibot';
import { toDefinitionURI } from './toDefinitionURI';
import { BaseConverter, Context } from './types';

export type SupportedSchemas =
    | AnySchema
    | LiteralSchema<any>
    | NullSchema
    | NumberSchema
    | BigintSchema
    | StringSchema
    | BooleanSchema
    | NullableSchema<any>
    | ObjectSchema<any, any>
    | RecordSchema<any, any>
    | ArraySchema<any>
    | TupleSchema<any, any>
    | IntersectSchema<any>
    | UnionSchema<any>
    | VariantSchema<any, any>
    | PicklistSchema<any>
    | EnumSchema<any>
    | LazySchema<any>
    | DateSchema
    | NullishSchema<any>
    | OptionalSchema<any>
    | UndefinedSchema;

type SchemaConverter<S extends SupportedSchemas> = (schema: S, convert: BaseConverter, context: Context) => JSONSchema7;

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
    tuple({ items: originalItems, rest, pipe }, convert) {
        const minItems = originalItems.length;
        let maxItems: JSONSchema7['maxItems'];
        let items = originalItems.map(convert);
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
        return { type: 'array', items, additionalItems, minItems, maxItems };
    },
    object({ entries, rest }, convert, context) {
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
    record({ key, value }, convert) {
        assert(key, isStringSchema, 'Unsupported record key type: %');
        return { type: 'object', additionalProperties: convert(value) };
    },
    lazy(schema, _, context) {
        const nested = schema.getter();
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

// Keep recursive => lazy aliasing for backward compatibility
// @ts-ignore
SCHEMA_CONVERTERS['recursive'] = SCHEMA_CONVERTERS['lazy'];
