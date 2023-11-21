import { SupportedSchemas } from '../toJSONSchema/schemas';
import { JSONSchema7 } from 'json-schema';
import { getJSONSchemaFeatures } from './withJSONSchemaFeatures';

export function assignExtraJSONSchemaFeatures(schema: SupportedSchemas, converted: JSONSchema7) {
    const jsonSchemaFeatures = getJSONSchemaFeatures(schema as any);
    if (jsonSchemaFeatures) {
        Object.assign(converted, jsonSchemaFeatures);
    }
}
