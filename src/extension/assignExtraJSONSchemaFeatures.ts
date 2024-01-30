import { JSONSchema7 } from 'json-schema';
import { SupportedSchemas } from '../toJSONSchema/schemas.js';
import { getJSONSchemaFeatures } from './withJSONSchemaFeatures.js';

export function assignExtraJSONSchemaFeatures(schema: SupportedSchemas, converted: JSONSchema7) {
    const jsonSchemaFeatures = getJSONSchemaFeatures(schema as any);
    if (jsonSchemaFeatures) {
        Object.assign(converted, jsonSchemaFeatures);
    }
}
