import type { JSONSchema7 } from 'json-schema';
import type { GenericSchema } from 'valibot';

const JSON_SCHEMA_FEATURES_KEY = '__json_schema_features';

export type JSONSchemaFeatures = Partial<JSONSchema7>;

export interface WithJSONSchemaFeatures {
    [JSON_SCHEMA_FEATURES_KEY]: JSONSchemaFeatures;
}

export function withJSONSchemaFeatures<S extends GenericSchema>(schema: S, features: JSONSchemaFeatures): S & WithJSONSchemaFeatures {
    return Object.assign(schema, { [JSON_SCHEMA_FEATURES_KEY]: features });
}

export function getJSONSchemaFeatures<S extends WithJSONSchemaFeatures | GenericSchema<any>>(schema: S): JSONSchemaFeatures | undefined {
    return (schema as any)[JSON_SCHEMA_FEATURES_KEY];
}
