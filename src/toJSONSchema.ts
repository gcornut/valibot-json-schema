import type * as v from 'valibot';
import { type JSONSchema7 } from 'json-schema';
import { $schema, isJSONLiteral } from './utils/json-schema';
import { assert } from './utils/assert';
import { isOptionalSchema, isStringSchema } from './utils/valibot';

type SupportedSchemas =
    v.AnySchema
    | v.LiteralSchema<any>
    | v.NullSchema
    | v.NumberSchema
    | v.StringSchema
    | v.BooleanSchema
    | v.NullableSchema<any>
    | v.EnumSchema<any>
    | v.ObjectSchema<any>
    | v.RecordSchema<any, any>
    | v.ArraySchema<any>
    | v.TupleSchema<any>
    | v.IntersectionSchema<any>
    | v.UnionSchema<any>
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

type GetSchema<T extends string> = Extract<SupportedSchemas, { schema: T }>
type SchemaDefinitionReverseMap = Map<SupportedSchemas, string>;

const SCHEMA_CONVERTERS: { [K in SupportedSchemas['schema']]: Converter<GetSchema<K>> } = {
    'any': () => ({}),
    // Core types
    'null': () => ({ const: null }),
    'literal': ({ literal }) => ({ const: assert(literal, isJSONLiteral, 'Unsupported literal value type: %') }),
    'number': () => ({ type: 'number' }),
    'string': () => ({ type: 'string' }),
    'boolean': () => ({ type: 'boolean' }),
    // Compositions
    'nullable': ({ wrapped }, convert) => ({ anyOf: [{ const: null }, convert(wrapped)!] }),
    'enum': (schema) => ({ enum: schema.enum.map((v: any) => assert(v, isJSONLiteral, 'Unsupported literal value type: %')) }),
    'union': ({ union }, convert) => ({ anyOf: union.map(convert) }),
    'intersection': ({ intersection }, convert) => ({ allOf: intersection.map(convert) }),
    // Complex types
    'array': ({ array }, convert) => ({ type: 'array', items: convert(array.item) }),
    'tuple': ({ tuple }, convert) => {
        const length = tuple.items.length;
        return { type: 'array', minItems: length, maxItems: length, items: tuple.items.map(convert) };
    },
    'object': ({ object }, convert, context) => {
        const jsonSchema: JSONSchema7 = { type: 'object' };
        const required: string[] = [];
        jsonSchema['properties'] = Object.fromEntries(Object.entries(object).map(([propKey, propValue]) => {
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
    'record': ({ record }, convert) => {
        assert(record.key, isStringSchema, 'Unsupported record key type: %');
        return { type: 'object', additionalProperties: convert(record.value) };
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

        const schemaConverter = SCHEMA_CONVERTERS[schema.schema];
        assert(schemaConverter, Boolean, `Unsupported valibot schema: ${(schema as any)?.schema || schema}`);
        let converted = schemaConverter?.(schema as any, converter, context);
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

    const mainConverted = schema && converter(schema);
    const mainDefName = schema && schemaDefinitionNames.get(schema);
    const out: JSONSchema7 = { $schema };
    if (mainDefName) {
        out['$ref'] = toDefinitionURI(mainDefName);
    } else {
        Object.assign(out, mainConverted);
    }
    if (inputDefinitions && !schema) {
        // No main schema => convert all definitions
        Object.values(inputDefinitions).filter(Boolean).forEach(converter);
    }
    if (Object.keys(definitions).length) {
        out['definitions'] = definitions;
    }
    return out;
}
