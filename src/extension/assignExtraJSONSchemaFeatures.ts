import type { JSONSchema7 } from 'json-schema';
import type { SupportedSchemas } from '../toJSONSchema/schemas';
import { getJSONSchemaFeatures } from './withJSONSchemaFeatures';

export function assignExtraJSONSchemaFeatures(schema: SupportedSchemas, converted: JSONSchema7) {
    const jsonSchemaFeatures = getJSONSchemaFeatures(schema as any);
    if (jsonSchemaFeatures) {
        Object.assign(converted, jsonSchemaFeatures);
    }
}
