import { type JSONSchema7 } from 'json-schema';
import { assignExtraJSONSchemaFeatures } from '../extension/assignExtraJSONSchemaFeatures';
import { assert } from '../utils/assert';
import { $schema } from '../utils/json-schema';
import { SCHEMA_CONVERTERS, SupportedSchemas } from './schemas';
import { toDefinitionURI } from './toDefinitionURI';
import { Context, DefinitionNameMap, ToJSONSchemaOptions } from './types';
import { convertPipe } from './validations';

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

        let converted: JSONSchema7;

        const customConverter = context.customSchemaConversion?.[schema.type];
        if (customConverter) {
            converted = customConverter(schema as any, converter, context);
            assert(converted, Boolean, `Custom schema converter \`${schema.type}\` returned an invalid JSON schema`);
        } else {
            const schemaConverter = context.customSchemaConversion?.[schema.type] || SCHEMA_CONVERTERS[schema.type];
            assert(schemaConverter, Boolean, `Unsupported valibot schema: ${schema?.type || schema}`);
            converted = schemaConverter(schema as any, converter, context);
        }

        // Attach converted validation pipe
        Object.assign(converted, convertPipe(schema.type, (schema as any).pipe || [], context));

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
