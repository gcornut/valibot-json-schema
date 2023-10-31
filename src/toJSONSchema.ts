import type * as v from 'valibot';
import { type JSONSchema7 } from 'json-schema';
import { $schema, isJSONLiteral } from './utils/json-schema';
import { isEqual } from './utils/isEqual';
import { assert } from './utils/assert';
import { isOptionalSchema, isStringSchema } from './utils/valibot';
import { getJSONSchemaFeatures } from './extension/withJSONSchemaFeatures';

export type SupportedSchemas =
    v.AnySchema
    | v.LiteralSchema<any>
    | v.NullSchema
    | v.NumberSchema
    | v.StringSchema
    | v.BooleanSchema
    | v.NullableSchema<any>
    | v.ObjectSchema<any>
    | v.RecordSchema<any, any>
    | v.ArraySchema<any>
    | v.TupleSchema<any, any>
    | v.IntersectSchema<any>
    | v.UnionSchema<any>
    | v.PicklistSchema<any>
    | v.RecursiveSchema<any>;

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

type Converter<S extends SupportedSchemas> = (schema: S, convert: ReturnType<typeof createConverter>, context: Context) => JSONSchema7;

type GetSchema<T extends string> = Extract<SupportedSchemas, { type: T }>
type SchemaDefinitionReverseMap = Map<SupportedSchemas, string>;

const SCHEMA_CONVERTERS: { [K in SupportedSchemas['type']]: Converter<GetSchema<K>> } = {
    'any': () => ({}),
    // Core types
    'null': () => ({ const: null }),
    'literal': ({ literal }) => ({ const: assert(literal, isJSONLiteral, 'Unsupported literal value type: %') }),
    'number': () => ({ type: 'number' }),
    'string': () => ({ type: 'string' }),
    'boolean': () => ({ type: 'boolean' }),
    // Compositions
    'nullable': ({ wrapped }, convert) => ({ anyOf: [{ const: null }, convert(wrapped)!] }),
    'picklist': ({ options }) => ({ enum: options.map((v: any) => assert(v, isJSONLiteral, 'Unsupported literal value type: %')) }),
    'union': ({ options }, convert) => ({ anyOf: options.map(convert) }),
    'intersect': ({ options }, convert) => ({ allOf: options.map(convert) }),
    // Complex types
    'array': ({ item }, convert) => ({ type: 'array', items: convert(item) }),
    'tuple': ({ items, rest }, convert) => {
        const length = items.length;
        const array: JSONSchema7 = { type: 'array', minItems: length, items: items.map(convert) };
        if (rest) {
            array.additionalItems = convert(rest);
            // Simplification of uniform 1-tuple => simple array schema with min length = 1
            if (Array.isArray(array.items) && array.items.length === 1 && isEqual(array.items[0], array.additionalItems)) {
                array.items = array.items[0];
                delete array.additionalItems;
            }
        } else {
            array.maxItems = length;
        }
        return array;
    },
    'object': ({ entries }, convert, context) => {
        const jsonSchema: JSONSchema7 = { type: 'object' };
        const required: string[] = [];
        jsonSchema['properties'] = Object.fromEntries(Object.entries(entries).map(([propKey, propValue]) => {
            let propSchema = propValue as any;
            if (isOptionalSchema(propSchema)) {
                propSchema = propSchema.wrapped;
            } else {
                required.push(propKey);
            }
            return [propKey, convert(propSchema)!];
        }));
        if (required.length) jsonSchema['required'] = required;
        if (context.strictObjectTypes) jsonSchema['additionalProperties'] = false;
        return jsonSchema;
    },
    'record': ({ key, value }, convert) => {
        assert(key, isStringSchema, 'Unsupported record key type: %');
        return { type: 'object', additionalProperties: convert(value) };
    },
    'recursive': (schema, convert, context) => {
        const nested = schema.getter();
        const defName = context.schemaDefinitionNames.get(nested);
        if (!defName) {
            throw new Error('Type inside recursive schema must be provided in the definitions');
        }
        return { $ref: toDefinitionURI(defName) };
    },
};

function getDefinitionReverseMap(definitions: Record<string, SupportedSchemas> = {}) {
    const map: SchemaDefinitionReverseMap = new Map();
    for (let [name, definition] of Object.entries(definitions)) {
        map.set(definition, name);
    }
    return map;
}

interface Context {
    /**
     * JSON Schema definitions
     */
    definitions: Required<JSONSchema7>['definitions'],
    /**
     * Mapping from schema to name
     */
    schemaDefinitionNames: SchemaDefinitionReverseMap;
    /**
     * Activate strict object types
     */
    strictObjectTypes: Options['strictObjectTypes']
}

const toDefinitionURI = (name: string) => `#/definitions/${name}`;

function createConverter(context: Context) {
    return function converter(schema: SupportedSchemas): JSONSchema7 | undefined {
        const defName = context.schemaDefinitionNames.get(schema);
        const defURI = defName && toDefinitionURI(defName);
        if (defURI && defURI in context.definitions) {
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
            context.definitions[defName] = converted;
            return { $ref: defURI };
        }
        return converted;
    };
}

/**
 * Convert Valibot schemas to JSON schema.
 *
 * @param schema            Main schema to be converted to the root JSON schema definition
 * @param definitions       Schemas indexed by name to be converted to the JSON schema `definitions`
 * @param strictObjectTypes Produce strict object types that do not allow unknown properties
 */
export function toJSONSchema(
    {
        schema,
        strictObjectTypes,
        definitions: inputDefinitions,
    }: Options,
): JSONSchema7 | undefined {
    const definitions = {};
    const schemaDefinitionNames = getDefinitionReverseMap(inputDefinitions);
    const converter = createConverter({ definitions, schemaDefinitionNames, strictObjectTypes });

    if (!schema && !inputDefinitions) {
        throw new Error('No main schema or definitions provided.');
    }

    if (inputDefinitions) {
        Object.values(inputDefinitions).forEach(converter);
    }

    const mainConverted = schema && converter(schema);
    const mainDefName = schema && schemaDefinitionNames.get(schema);
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
