import type {
    AnySchema,
    ArraySchema,
    BooleanSchema,
    IntersectSchema,
    LiteralSchema,
    NullableSchema,
    NullSchema,
    NumberSchema,
    ObjectSchema,
    PicklistSchema,
    RecordSchema,
    RecursiveSchema,
    StringSchema,
    TupleSchema,
    UnionSchema,
} from 'valibot';
import { type JSONSchema7 } from 'json-schema';
import { $schema, assertJSONLiteral } from './utils/json-schema';
import { isEqual } from './utils/isEqual';
import { assert } from './utils/assert';
import { isNeverSchema, isOptionalSchema, isStringSchema } from './utils/valibot';
import { getJSONSchemaFeatures } from './extension/withJSONSchemaFeatures';

export type SupportedSchemas =
    AnySchema
    | LiteralSchema<any>
    | NullSchema
    | NumberSchema
    | StringSchema
    | BooleanSchema
    | NullableSchema<any>
    | ObjectSchema<any, any>
    | RecordSchema<any, any>
    | ArraySchema<any>
    | TupleSchema<any, any>
    | IntersectSchema<any>
    | UnionSchema<any>
    | PicklistSchema<any>
    | RecursiveSchema<any>;

export interface Options {
    /**
     * Main schema (referenced at the root of the JSON schema).
     */
    schema?: SupportedSchemas,
    /**
     * Additional schemas (referenced in the JSON schema `definitions`).
     */
    definitions?: Record<string, SupportedSchemas>;
    /**
     * Make all object type strict (`additionalProperties: false`).
     */
    strictObjectTypes?: boolean
}

type Converter<S extends SupportedSchemas> = (schema: S, convert: ReturnType<typeof createConverter>['converter'], context: Context) => JSONSchema7;

type GetSchema<T extends string> = Extract<SupportedSchemas, { type: T }>
type DefinitionNameMap = Map<SupportedSchemas, string>;

const SCHEMA_CONVERTERS: { [K in SupportedSchemas['type']]: Converter<GetSchema<K>> } = {
    'any': () => ({}),
    // Core types
    'null': () => ({ const: null }),
    'literal': ({ literal }) => ({ const: assertJSONLiteral(literal) }),
    'number': () => ({ type: 'number' }),
    'string': () => ({ type: 'string' }),
    'boolean': () => ({ type: 'boolean' }),
    // Compositions
    'nullable': ({ wrapped }, convert) => ({ anyOf: [{ const: null }, convert(wrapped)] }),
    'picklist': ({ options }) => ({ enum: options.map(assertJSONLiteral) }),
    'union': ({ options }, convert) => ({ anyOf: options.map(convert) }),
    'intersect': ({ options }, convert) => ({ allOf: options.map(convert) }),
    // Complex types
    'array': ({ item }, convert) => ({ type: 'array', items: convert(item) }),
    'tuple': ({ items: originalItems, rest }, convert) => {
        const minItems = originalItems.length;
        let maxItems: JSONSchema7['maxItems'];
        let items = originalItems.map(convert);
        let additionalItems: JSONSchema7['additionalItems'] = undefined;
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
    'object': ({ entries, rest }, convert, context) => {
        const properties: any = {};
        const required: string[] = [];
        for (const [propKey, propValue] of Object.entries(entries)) {
            let propSchema = propValue as any;
            if (isOptionalSchema(propSchema)) {
                propSchema = propSchema.wrapped;
            } else {
                required.push(propKey);
            }
            properties[propKey] = convert(propSchema)!;
        }
        let additionalProperties: JSONSchema7['additionalProperties'];
        if (rest) {
            additionalProperties = isNeverSchema(rest) ? false : convert(rest);
        } else if (context.strictObjectTypes) {
            additionalProperties = false;
        }
        return { type: 'object', properties, required: required.length ? required : undefined, additionalProperties };
    },
    'record': ({ key, value }, convert) => {
        assert(key, isStringSchema, 'Unsupported record key type: %');
        return { type: 'object', additionalProperties: convert(value) };
    },
    'recursive': (schema, _, context) => {
        const nested = schema.getter();
        const defName = context.defNameMap.get(nested);
        if (!defName) {
            throw new Error('Type inside recursive schema must be provided in the definitions');
        }
        return { $ref: toDefinitionURI(defName) };
    },
};

function getDefNameMap(definitions: Record<string, SupportedSchemas> = {}) {
    const map: DefinitionNameMap = new Map();
    for (let [name, definition] of Object.entries(definitions)) {
        map.set(definition, name);
    }
    return map;
}

interface Context {
    /**
     * Mapping from schema to name
     */
    defNameMap: DefinitionNameMap;
    /**
     * Activate strict object types
     */
    strictObjectTypes?: Options['strictObjectTypes']
}

const toDefinitionURI = (name: string) => `#/definitions/${name}`;

function createConverter(context: Context) {
    const definitions: Required<JSONSchema7['definitions']> = {};
    return {
        definitions,
        converter: function converter(schema: SupportedSchemas): JSONSchema7 {
            const defName = context.defNameMap.get(schema);
            const defURI = defName && toDefinitionURI(defName);
            if (defURI && defURI in definitions) {
                return { $ref: defURI };
            }

            const schemaConverter = SCHEMA_CONVERTERS[schema.type];
            assert(schemaConverter, Boolean, `Unsupported valibot schema: ${schema?.type || schema}`);
            const converted = schemaConverter(schema as any, converter, context);
            const jsonSchemaFeatures = getJSONSchemaFeatures(schema as any);
            if (jsonSchemaFeatures) {
                Object.assign(converted, jsonSchemaFeatures);
            }
            if (defURI) {
                definitions[defName] = converted;
                return { $ref: defURI };
            }
            return converted;
        },
    };
}

/**
 * Convert Valibot schemas to JSON schema.
 */
export function toJSONSchema(
    {
        schema,
        definitions: inputDefinitions,
        ...more
    }: Options,
): JSONSchema7 | undefined {
    const defNameMap = getDefNameMap(inputDefinitions);
    const { definitions, converter } = createConverter({ defNameMap, ...more });

    if (!schema && !inputDefinitions) {
        throw new Error('No main schema or definitions provided.');
    }

    if (inputDefinitions) {
        Object.values(inputDefinitions).forEach(converter);
    }

    const mainConverted = schema && converter(schema);
    const mainDefName = schema && defNameMap.get(schema);
    const out: JSONSchema7 = { $schema };
    if (mainDefName) {
        out['$ref'] = toDefinitionURI(mainDefName);
    } else {
        Object.assign(out, mainConverted);
    }
    if (Object.keys(definitions).length) {
        out['definitions'] = definitions;
    }
    return out;
}
