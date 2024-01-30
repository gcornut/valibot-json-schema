import { type JSONSchema7 } from 'json-schema';
import { assignExtraJSONSchemaFeatures } from '../extension/assignExtraJSONSchemaFeatures.js';
import { assert } from '../utils/assert.js';
import { $schema } from '../utils/json-schema.js';
import { SCHEMA_CONVERTERS, SupportedSchemas } from './schemas.js';
import { toDefinitionURI } from './toDefinitionURI';
import { Context, DefinitionNameMap, ToJSONSchemaOptions } from './types.js';
import { convertPipe } from './validations.js';

function getDefNameMap(definitions: ToJSONSchemaOptions['definitions'] = {}) {
    const map: DefinitionNameMap = new Map();
    for (const [name, definition] of Object.entries(definitions)) {
        map.set(definition, name);
    }
    return map;
}

function createConverter(context: Context) {
    const definitions: Record<string, JSONSchema7> = {};

    function converter(schema: SupportedSchemas): JSONSchema7 {
        const defName = context.defNameMap.get(schema);
        const defURI = defName && toDefinitionURI(defName);
        if (defURI && defURI in definitions) {
            return { $ref: defURI };
        }

        const schemaConverter = SCHEMA_CONVERTERS[schema.type];
        assert(schemaConverter, Boolean, `Unsupported valibot schema: ${schema?.type || schema}`);

        // Convert schema
        const converted = schemaConverter(schema as any, converter, context);

        // Attach converted validation pipe
        Object.assign(converted, convertPipe(schema.type, (schema as any).pipe));

        // Attach extra JSON schema features
        assignExtraJSONSchemaFeatures(schema, converted);

        if (defURI) {
            definitions[defName] = converted;
            return { $ref: defURI };
        }
        return converted;
    }

    return { definitions, converter };
}

/**
 * Convert Valibot schemas to JSON schema.
 */
export function toJSONSchema(options: ToJSONSchemaOptions): JSONSchema7 {
    const { schema, definitions: inputDefinitions, ...more } = options;
    const defNameMap = getDefNameMap(inputDefinitions);
    const { definitions, converter } = createConverter({ defNameMap, ...more });

    if (!schema && !inputDefinitions) {
        throw new Error('No main schema or definitions provided.');
    }

    if (inputDefinitions) {
        Object.values(inputDefinitions).forEach(converter);
    }

    const mainConverted = schema && converter(schema as SupportedSchemas);
    const mainDefName = schema && defNameMap.get(schema as SupportedSchemas);
    const out: JSONSchema7 = { $schema };
    if (mainDefName) {
        out.$ref = toDefinitionURI(mainDefName);
    } else {
        Object.assign(out, mainConverted);
    }
    if (Object.keys(definitions).length) {
        out.definitions = definitions;
    }
    return out;
}
