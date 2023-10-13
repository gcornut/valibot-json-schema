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
    | v.IntersectionSchema<any>
    | v.UnionSchema<any>
    | v.RecursiveSchema<any>;

export interface Options {
    definitions?: Record<string, SupportedSchemas>;
}

type Converter<S extends SupportedSchemas> = (schema: S, convert: ReturnType<typeof convertNode>, context: Context) => JSONSchema7;

type GetSchema<T extends string> = Extract<SupportedSchemas, { schema: T }>
type SchemaDefinitionReverseMap = Map<SupportedSchemas, string>;
type JSONSchemaDefinitions = Required<JSONSchema7>['definitions'];

const CONVERTERS: { [K in SupportedSchemas['schema']]: Converter<GetSchema<K>> } = {
    'any': () => ({}),
    // Core types
    'null': () => ({ const: null }),
    'literal': ({ literal }) => ({ const: assert(literal, isJSONLiteral, 'Unsupported literal value type: %') }),
    'number': () => ({ type: 'number' }),
    'string': () => ({ type: 'string' }),
    'boolean': () => ({ type: 'boolean' }),
    // Compositions
    'nullable': ({ wrapped }, convert) => ({ anyOf: [{ 'const': null }, convert(wrapped)!] }),
    'enum': (schema) => ({ anyOf: schema.enum.map((v: any) => ({ const: v })) }),
    'union': ({ union }, convert) => ({ anyOf: union.map(convert) }),
    'intersection': ({ intersection }, convert) => ({ allOf: intersection.map(convert) }),
    // Complex types
    'array': ({ array }, convert) => ({ type: 'array', items: convert(array.item) }),
    'object': ({ object }, convert) => {
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
    definitions: JSONSchemaDefinitions,
    schemaDefinitionNames: SchemaDefinitionReverseMap;
}

const toDefinitionURI = (name: string) => `#/definitions/${name}`;

function convertNode(context: Context) {
    return function inner(schema: SupportedSchemas): JSONSchema7 | undefined {
        const defName = context.schemaDefinitionNames.get(schema);
        const defURI = defName && toDefinitionURI(defName);
        if (defURI && defURI in context.definitions) {
            return { $ref: defURI };
        }

        const converter = CONVERTERS[schema.schema];
        assert(converter, Boolean, `Unsupported valibot schema: ${(schema as any)?.schema || schema}`);
        let converted = converter?.(schema as any, inner, context);
        if (defURI) {
            context.definitions[defName] = converted;
            return { $ref: defURI };
        }
        return converted;
    };
}

// TODO: closed object type ? (additionalProperties: false)
// TODO: warn on pipeline? (can't be converted?)
// TODO: warn on any (can't work exactly the same as json schema)
// TODO: print schema path on error/assert
// TODO: tuple & record
// TODO: extension system (ex: a size/length pipeline wrapper that produce an introspectable schema convertable to JSON schema)
export function toJSONSchema(schema: SupportedSchemas, options: Options = {}): JSONSchema7 | undefined {
    const definitions = {};
    const schemaDefinitionNames = getDefinitionReverseMap(options?.definitions);
    const converted = convertNode({ definitions, schemaDefinitionNames })(schema);
    if (!converted) {
        return undefined;
    }

    const defName = schemaDefinitionNames.get(schema);
    const out: JSONSchema7 = { $schema };
    if (Object.keys(definitions).length) {
        out['definitions'] = definitions;
    }
    if (defName) {
        out['$ref'] = toDefinitionURI(defName);
    } else {
        Object.assign(out, converted);
    }
    return out;
}
