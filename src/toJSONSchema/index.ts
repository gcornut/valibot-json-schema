import type { JSONSchema7 } from 'json-schema';
import { assignExtraJSONSchemaFeatures } from '../extension/assignExtraJSONSchemaFeatures';
import { assert } from '../utils/assert';
import { $schema } from '../utils/json-schema';
import { SCHEMA_CONVERTERS, type SupportedSchemas } from './schemas';
import { toDefinitionURI } from './toDefinitionURI';
import type { Context, DefinitionNameMap, ToJSONSchemaOptions } from './types';

import { convertPipe } from './actions/convertPipe';

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

        const schemaConverter = context.customSchemaConversion?.[schema.type] || SCHEMA_CONVERTERS[schema.type];
        assert(schemaConverter, Boolean, `Unsupported valibot schema: ${schema?.type || schema}`);
        let converted: JSONSchema7 = schemaConverter(schema as any, converter, context) || {};

        // Attach converted validation pipe
        const convertedValidation = convertPipe(schema.type, (schema as any).pipe, context);
        converted = { ...converted, ...convertedValidation };

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
